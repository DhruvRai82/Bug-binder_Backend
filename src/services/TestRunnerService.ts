
import { chromium, Browser, Page } from 'playwright';
// import { supabase } from '../lib/supabase';
import { localProjectService } from './LocalProjectService';
import { genAIService } from './GenAIService';
import { visualTestService } from './VisualTestService';

export class TestRunnerService {

    /**
     * Executes a recorded script by ID and logs everything to keys tables.
     */
    async executeTest(scriptId: string, projectId: string, triggerSource: 'manual' | 'scheduler' | 'ci' = 'manual', userId?: string): Promise<any> {
        let browser: Browser | null = null;
        let page: Page | null = null;
        let runId: string = '';
        const startTime = Date.now();

        try {
            // 1. Fetch Script Data from Local Project Service
            // We need to look up script. If projectId is known, excellent.
            const scripts = await localProjectService.getScripts(projectId, userId || '');
            const script = scripts.find((s: any) => s.id === scriptId);

            if (!script) throw new Error(`Script not found: ${scriptId}`);

            // 2. Initialize Run Record
            const runData = await localProjectService.createTestRun(projectId, {
                project_id: projectId,
                script_id: scriptId,
                status: 'running',
                started_at: new Date().toISOString(),
                trigger_source: triggerSource,
                user_id: userId
            });
            runId = runData.id;

            // 3. Launch Browser
            console.log(`[TestRunner] Starting Run ${runId} for Script ${script.name}`);
            browser = await chromium.launch({
                headless: process.env.HEADLESS !== 'false',
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            });
            const context = await browser.newContext();
            page = await context.newPage();

            // 4. Log Start
            await this.logStep(projectId, runId, 0, 'start', 'info', `Starting execution of ${script.name}`);

            // 5. Execute Steps
            const steps = script.steps || [];
            let stepsCompleted = 0;
            let scriptWasHealed = false;

            for (let i = 0; i < steps.length; i++) {
                const step = steps[i];
                let target = this.parseSelector(step.target);

                await this.logStep(projectId, runId, i + 1, step.command, 'info', `Executing: ${step.command} on ${step.target}`);

                try {
                    await this.executeStep(page!, step.command, target, step.value);
                    await this.logStep(projectId, runId, i + 1, step.command, 'pass', `Step ${i + 1} passed`);
                    stepsCompleted++;
                } catch (stepError: any) {

                    // --- SELF HEALING LOGIC ---
                    const errorMessage = stepError.message || '';
                    if ((errorMessage.includes('Timeout') || errorMessage.includes('waiting for selector')) && step.command !== 'open') {
                        console.log(`[TestRunner] 🩹 Step failed with timeout. Attempting Self-Healing for element: ${target} ...`);
                        await this.logStep(projectId, runId, i + 1, 'heal', 'warning', `Attempting self-healing for: ${target}`);

                        try {
                            const htmlSnapshot = await page!.content();
                            const healedSelector = await genAIService.healSelector(htmlSnapshot, target, errorMessage);

                            if (healedSelector) {
                                console.log(`[TestRunner] ✨ AI found a potential new selector: ${healedSelector}`);
                                await this.logStep(projectId, runId, i + 1, 'heal', 'info', `AI suggested: ${healedSelector}`);

                                // Retry with new selector
                                await this.executeStep(page!, step.command, healedSelector, step.value);

                                // Update script object in memory if successful
                                console.log(`[TestRunner] ✅ Retry successful! Updating script...`);
                                script.steps[i].target = healedSelector;
                                scriptWasHealed = true;

                                await this.logStep(projectId, runId, i + 1, step.command, 'pass', `Step healed and passed`);
                                stepsCompleted++;
                                continue;
                            } else {
                                await this.logStep(projectId, runId, i + 1, 'heal', 'fail', `AI could not find a fix.`);
                            }
                        } catch (healError) {
                            console.error('[TestRunner] Healing failed:', healError);
                        }
                    }
                    // ---------------------------

                    console.error(`[TestRunner] Step ${i + 1} failed:`, stepError.message);
                    await this.logStep(projectId, runId, i + 1, step.command, 'fail', `Failed: ${stepError.message}`);
                    throw stepError;
                }
            }

            // 5b. Visual Check
            if (process.env.ENABLE_VISUAL_TESTS !== 'false') {
                try {
                    await this.logStep(projectId, runId, 998, 'visual', 'info', 'Performing Visual Regression Check...');
                    const screenshotBuffer = await page!.screenshot({ fullPage: true });
                    const visualResult = await visualTestService.compare(script.id, screenshotBuffer);

                    if (visualResult.hasBaseline && visualResult.diffPercentage > 0) {
                        await this.logStep(projectId, runId, 998, 'visual', 'warning', `Visual Mismatch: ${visualResult.diffPercentage.toFixed(2)}%`);
                    } else if (!visualResult.hasBaseline) {
                        await this.logStep(projectId, runId, 998, 'visual', 'info', 'New Baseline Created.');
                    } else {
                        await this.logStep(projectId, runId, 998, 'visual', 'pass', 'Visual Check Passed.');
                    }
                } catch (e: any) {
                    console.error('[TestRunner] Visual Test Error', e);
                    await this.logStep(projectId, runId, 998, 'visual', 'fail', `Visual Test Error: ${e.message}`);
                }
            }

            // 5c. Persist Healing
            if (scriptWasHealed) {
                // Update script in local storage
                await localProjectService.updateScript(projectId, scriptId, { steps: script.steps }, userId || '');
                await this.logStep(projectId, runId, 999, 'save', 'info', 'Script updated with healed selectors');
            }

            // 6. Success Completion
            const duration = Date.now() - startTime;
            await localProjectService.updateTestRun(projectId, runId, {
                status: 'passed',
                completed_at: new Date().toISOString(),
                duration_ms: duration
            });

            await this.logStep(projectId, runId, 1000, 'end', 'info', 'Test completed successfully');

            return { status: 'passed', runId, duration };

        } catch (error: any) {
            console.error('[TestRunner] Run Failed:', error);
            if (runId) {
                const duration = Date.now() - startTime;
                await localProjectService.updateTestRun(projectId, runId, {
                    status: 'failed',
                    completed_at: new Date().toISOString(),
                    duration_ms: duration,
                    error_message: error.message
                });
            }
            return { status: 'failed', error: error.message, runId };
        } finally {
            if (browser) await browser.close();
        }
    }

    private async executeStep(page: Page, command: string, target: string, value: string) {
        if (command === 'open') {
            await page.goto(target, { timeout: 30000 });
        }
        else if (command === 'click') {
            await page.click(target, { timeout: 10000 });
        }
        else if (command === 'type') {
            try {
                await page.fill(target, value || '', { timeout: 5000 });
            } catch (fillError: any) {
                if (fillError.message.includes('cannot be filled')) {
                    if (value === 'on' || value === 'true') {
                        await page.check(target, { timeout: 5000 });
                    } else {
                        await page.click(target, { timeout: 5000 });
                    }
                } else {
                    throw fillError;
                }
            }
        }
        else if (command === 'wait') {
            await page.waitForTimeout(parseInt(value) || 1000);
        }
    }

    private async logStep(projectId: string, runId: string, index: number, action: string, status: 'pass' | 'fail' | 'info' | 'warning', message: string) {
        try {
            await localProjectService.addTestLog(projectId, runId, {
                step_index: index,
                action,
                status,
                message,
                timestamp: new Date().toISOString()
            });
        } catch (err) {
            console.error('[TestRunner] Failed to log step:', err);
        }
    }

    private parseSelector(rawTarget: string): string {
        // Handle target formats like "css=.class" or "id=foo" or just "xpath=..."
        if (!rawTarget) return '';

        if (rawTarget.startsWith('css=')) return rawTarget.replace('css=', '');
        if (rawTarget.startsWith('id=')) return `#${rawTarget.replace('id=', '')}`;
        if (rawTarget.startsWith('xpath=')) return rawTarget.replace('xpath=', '');

        // Return as is if no prefix (playwright tries to auto-detect)
        return rawTarget;
    }
}

export const testRunnerService = new TestRunnerService();


