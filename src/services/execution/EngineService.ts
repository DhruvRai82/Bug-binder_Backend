import { chromium, Browser, Page } from 'playwright';
import path from 'path';
import * as fs from 'fs';
import { Service } from 'typedi';

export interface TestStep {
    id: string;
    action: 'navigate' | 'click' | 'type' | 'wait' | 'screenshot';
    params: {
        url?: string;
        selector?: string;
        value?: string;
        timeout?: number;
    };
}

@Service()
export class EngineService {
    private browser: Browser | null = null;
    private page: Page | null = null;
    private logsPath: string | null = null;
    private executionLogs: any[] = [];

    constructor() {
        console.log('[EngineService] Initialized new instance');
    }

    /**
     * Executes a list of JSON Test Steps
     * @param steps Array of TestStep objects
     * @param options Execution options (headless, device, sourcePath)
     */
    public async executeTest(steps: TestStep[], options: { headless?: boolean; sourcePath?: string } = {}) {
        const runId = `RUN-${Date.now()}`;
        this.executionLogs = []; // Reset logs
        this.logsPath = null;

        console.log(`[EngineService] [${runId}] STARTING NEW TEST Execution`);

        // --- 0. Initialize Shadow Folder if sourcePath exists ---
        console.log(`[EngineService] Received Source Path: ${options.sourcePath}`);
        if (options.sourcePath) {
            try {
                // sourcePath: "f:\...\src\flows\Auth\Login.flow" or relative
                // We want: "runs\Auth\Login\Run_<TIMESTAMP>"

                // 1. Normalize and find relative structure
                const projectRoot = path.join(__dirname, '../../../../');

                const filename = path.basename(options.sourcePath, '.flow.json');

                // Remove drive letter and leading slashes to make it relative to runs/
                // e.g. "/Google/Google/MyFlow.flow.json" -> "Google/Google"
                let relativeDir = path.dirname(options.sourcePath);

                // Strip drive letter if present (Windows)
                if (relativeDir.match(/^[a-zA-Z]:/)) {
                    relativeDir = relativeDir.split(path.sep).slice(1).join(path.sep);
                }

                // Strip leading slashes
                relativeDir = relativeDir.replace(/^[\/\\]+/, '');

                // Construct Run Dir: backend/runs/<RelativePath>/<FlowName>/Run_<Date>
                const runsBase = path.join(projectRoot, 'runs');
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                this.logsPath = path.join(runsBase, relativeDir, filename, `Run_${timestamp}`);

                if (!fs.existsSync(this.logsPath)) {
                    fs.mkdirSync(this.logsPath, { recursive: true });
                }
                console.log(`[EngineService] [${runId}] 📂 Shadow Run Folder Created: ${this.logsPath}`);

            } catch (e) {
                console.error(`[EngineService] Failed to create shadow folder`, e);
            }
        }

        try {
            // 1. Launch Browser
            console.log(`[EngineService] [${runId}] Launching Browser...`);
            this.browser = await chromium.launch({
                headless: options.headless ?? true,
                args: ['--no-sandbox']
            });
            console.log(`[EngineService] [${runId}] Browser Launched Successfully`);

            // 2. Create Page
            const context = await this.browser.newContext();
            this.page = await context.newPage();

            // 3. Loop Execution
            for (let i = 0; i < steps.length; i++) {
                const step = steps[i];
                const logEntry = {
                    stepId: step.id,
                    action: step.action,
                    status: 'PENDING',
                    timestamp: new Date().toISOString(),
                    error: null
                };

                console.log(`[EngineService] [${runId}] Step ${i + 1}: ${step.action}`);

                try {
                    await this.executeStep(step, i + 1);
                    logEntry.status = 'PASSED';
                    console.log(`[EngineService] [${runId}] Step ${step.id} PASSED ✅`);
                } catch (stepError: any) {
                    logEntry.status = 'FAILED';
                    logEntry.error = stepError.message;
                    console.error(`[EngineService] [${runId}] Step ${step.id} FAILED ❌`);
                    this.executionLogs.push(logEntry);
                    throw stepError;
                }
                this.executionLogs.push(logEntry);
            }

            console.log(`[EngineService] [${runId}] TEST COMPLETED SUCCESSFULLY ✅`);

        } catch (error: any) {
            console.error(`[EngineService] [${runId}] TEST FAILED ❌`);
            throw error;
        } finally {
            // 4. Save Execution Log to Disk
            if (this.logsPath) {
                const logFile = path.join(this.logsPath, 'execution.json');
                fs.writeFileSync(logFile, JSON.stringify(this.executionLogs, null, 2));
                console.log(`[EngineService] 📝 Execution Log saved to ${logFile}`);
            }

            // 5. Cleanup
            if (this.browser) {
                await this.browser.close();
            }
            this.browser = null;
            this.page = null;
        }
    }

    private async executeStep(step: TestStep, index: number) {
        if (!this.page) throw new Error("Browser page not initialized");

        switch (step.action) {
            case 'navigate':
                if (!step.params.url) throw new Error("Missing URL");
                await this.page.goto(step.params.url, { timeout: step.params.timeout || 30000 });
                break;

            case 'click':
                if (!step.params.selector) throw new Error("Missing selector");
                await this.page.click(step.params.selector, { timeout: step.params.timeout || 5000 });
                break;

            case 'type':
                if (!step.params.selector) throw new Error("Missing selector");
                await this.page.fill(step.params.selector, step.params.value || '', { timeout: step.params.timeout || 5000 });
                break;

            case 'wait':
                const ms = parseInt(step.params.value || '1000');
                await this.page.waitForTimeout(ms);
                break;

            case 'screenshot':
                const buffer = await this.page.screenshot();
                if (this.logsPath) {
                    const filename = `step_${index}_screenshot.png`;
                    const filepath = path.join(this.logsPath, filename);
                    fs.writeFileSync(filepath, buffer);
                    console.log(`[EngineService] 📸 Screenshot saved: ${filename}`);
                }
                break;

            default:
                console.warn(`[EngineService] Unknown Action: ${step.action}`);
                break;
        }
    }
}


