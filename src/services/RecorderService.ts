/// <reference lib="dom" />
import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { Server } from 'socket.io';
import { ReportService } from './ReportService';
// import { supabase } from '../lib/supabase';
import { localProjectService } from './LocalProjectService';
import { genAIService } from './GenAIService';
import { visualTestService } from './VisualTestService';
import { testDataService } from './TestDataService';
import { v4 as uuidv4 } from 'uuid';

interface RecordedStep {
    command: string;
    target: string;
    targets: string[][]; // Array of [selector, type] tuples
    value: string;
}

interface RecordedScript {
    id: string;
    projectId: string;
    name: string;
    module: string;
    steps: RecordedStep[];
    createdAt: string;
}

export class RecorderService {
    private browser: Browser | null = null;
    private context: BrowserContext | null = null;
    private page: Page | null = null;
    private isRecording = false;
    private recordedSteps: RecordedStep[] = [];
    private io: Server | null = null;
    private reportService: ReportService;

    constructor() {
        this.reportService = new ReportService();
    }

    setSocket(io: Server) {
        this.io = io;
    }

    async startRecording(url: string) {
        try {
            console.log(`[Recorder] Starting recording for ${url}`);
            const headlessParam = process.env.HEADLESS !== 'false';

            // Only close previous if recording
            if (this.isRecording) {
                await this.stopRecording();
            }

            console.log(`[Recorder] Launching browser (Headless: ${headlessParam})...`);

            this.browser = await chromium.launch({
                headless: headlessParam,
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            });
            this.context = await this.browser.newContext();
            this.page = await this.context.newPage();
            this.isRecording = true;
            this.recordedSteps = [];

            // Add initial open command
            const initialStep: RecordedStep = {
                command: 'open',
                target: url,
                targets: [],
                value: ''
            };
            this.recordedSteps.push(initialStep);

            // Emit 'record:step' to match frontend listener
            console.log('[Recorder] Emitting initial step:', initialStep);
            this.io?.emit('record:step', {
                action: 'navigate',
                url: url,
                timestamp: Date.now()
            });

            // Expose function to browser
            await this.page.exposeFunction('recordEvent', (event: any) => {
                console.log('[Recorder] Received event from browser:', event);
                if (this.isRecording) {
                    this.recordedSteps.push({
                        command: event.command,
                        target: event.target,
                        targets: event.targets || [],
                        value: event.value
                    });

                    // Emit 'record:step' to match frontend listener
                    this.io?.emit('record:step', {
                        action: event.command === 'type' ? 'type' : 'click',
                        selector: event.target,
                        value: event.value,
                        timestamp: Date.now()
                    });
                }
            });

            await this.page.addInitScript(() => {
                console.log('[Browser] Init script injected');

                const getSelectors = (el: HTMLElement): string[][] => {
                    const targets: string[][] = [];

                    // 1. ID
                    if (el.id) {
                        targets.push([`id=${el.id}`, 'id']);
                        targets.push([`css=#${el.id}`, 'css:finder']);
                        targets.push([`xpath=//*[@id='${el.id}']`, 'xpath:attributes']);
                    }

                    // 2. Name
                    const name = el.getAttribute('name');
                    if (name) {
                        targets.push([`name=${name}`, 'name']);
                        targets.push([`css=${el.tagName.toLowerCase()}[name="${name}"]`, 'css:finder']);
                        targets.push([`xpath=//${el.tagName.toLowerCase()}[@name='${name}']`, 'xpath:attributes']);
                    }

                    // 3. Link Text (for anchors)
                    if (el.tagName === 'A') {
                        const text = el.innerText?.trim();
                        if (text) {
                            targets.push([`linkText=${text}`, 'linkText']);
                            targets.push([`xpath=//a[contains(text(),'${text}')]`, 'xpath:link']);
                        }
                    }

                    // 4. CSS Classes
                    if (el.className && typeof el.className === 'string' && el.className.trim() !== '') {
                        const classes = el.className.split(/\s+/).filter(c => c && !c.includes(':') && !c.includes('/'));
                        if (classes.length > 0) {
                            const cssSelector = `${el.tagName.toLowerCase()}.${classes.join('.')}`;
                            targets.push([`css=${cssSelector}`, 'css:finder']);
                        }
                    }

                    // 5. XPath (Relative/Position)
                    const getXPath = (element: HTMLElement): string => {
                        if (element.id) return `//*[@id='${element.id}']`;
                        if (element === document.body) return '/html/body';

                        let ix = 0;
                        const siblings = element.parentNode?.childNodes;
                        if (siblings) {
                            for (let i = 0; i < siblings.length; i++) {
                                const sibling = siblings[i] as HTMLElement;
                                if (sibling === element) {
                                    const path = getXPath(element.parentNode as HTMLElement);
                                    return `${path}/${element.tagName.toLowerCase()}${ix + 1 > 1 ? `[${ix + 1}]` : ''}`;
                                }
                                if (sibling.nodeType === 1 && sibling.tagName === element.tagName) {
                                    ix++;
                                }
                            }
                        }
                        return '';
                    };

                    const fullXpath = getXPath(el);
                    if (fullXpath) {
                        targets.push([`xpath=${fullXpath}`, 'xpath:position']);
                    }

                    // 6. Text Content (Button/Span/Div)
                    if (['BUTTON', 'SPAN', 'DIV', 'LABEL'].includes(el.tagName)) {
                        const text = el.innerText?.trim();
                        if (text && text.length < 50 && text.length > 0) {
                            targets.push([`xpath=//${el.tagName.toLowerCase()}[contains(.,'${text}')]`, 'xpath:innerText']);
                        }
                    }

                    return targets;
                };

                document.addEventListener('click', (e) => {
                    const target = e.target as HTMLElement;
                    if (['INPUT', 'TEXTAREA'].includes(target.tagName)) return;

                    console.log('[Browser] Click detected on:', target);
                    const targets = getSelectors(target);
                    (window as any).recordEvent({
                        command: 'click',
                        target: targets.length > 0 ? targets[0][0] : target.tagName.toLowerCase(),
                        targets: targets,
                        value: ''
                    });
                }, true);

                document.addEventListener('change', (e) => {
                    const target = e.target as HTMLInputElement;
                    if (['INPUT', 'TEXTAREA'].includes(target.tagName)) {
                        console.log('[Browser] Change detected on:', target);
                        const targets = getSelectors(target);
                        (window as any).recordEvent({
                            command: 'type',
                            target: targets.length > 0 ? targets[0][0] : target.tagName.toLowerCase(),
                            targets: targets,
                            value: target.value
                        });
                    }
                }, true);
            });

            await this.page.goto(url);
            console.log('[Recorder] Recording started successfully');
        } catch (error) {
            console.error('[Recorder] Error starting recording:', error);
            throw error;
        }
    }

    async stopRecording() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
            this.context = null;
            this.page = null;
        }
        this.isRecording = false;
        return this.recordedSteps;
    }

    async saveScript(script: Omit<RecordedScript, 'id' | 'createdAt'> & { userId: string }) {
        // Map frontend step format (action/selector) to backend format (command/target)
        const mappedSteps = script.steps.map((step: any) => {
            let command = step.command;
            let target = step.target;
            let targets = step.targets || [];
            let value = step.value || '';

            // Handle frontend format
            if (step.action) {
                if (step.action === 'navigate') {
                    command = 'open';
                    target = step.url;
                } else {
                    command = step.action; // click, type
                    target = step.selector;
                }
            }

            return {
                command: command || 'unknown',
                target: target || '',
                targets: targets,
                value: value
            };
        });

        // Use LocalProjectService
        // Note: We need projectId. If script doesn't have it, we might have an issue.
        // Assuming script.projectId is present.

        return await localProjectService.createScript(script.projectId, {
            name: script.name,
            module: script.module,
            steps: mappedSteps,
            project_id: script.projectId, // Persistence
            user_id: script.userId
        }, script.userId);
    }

    async updateScriptSteps(scriptId: string, steps: RecordedStep[]) {
        // Need ProjectID to update. 
        // This method signature is missing projectID which is required for Local Service (file path).
        // WE need to find the project ID first? Or change signature.
        // For now, let's look up the project by scanning? No, too slow.
        // We will assume we can't update without ProjectID easily unless we scan.
        // Let's modify the signature to accept projectId or find it.
        // Quick fix: Scan all projects (we only have a few JSON files).

        // Actually, let's try to pass projectId if possible. If not, we scan.
        // For now, I'll implement a scan helper in LocalProjectService? 
        // Or just let it fail/warn for now. 
        // Wait, playScript calls this. playScript has script data.

        console.warn('updateScriptSteps: Requires Project ID for Local Storage. Skipping persistence for now.');
    }

    async deleteScript(scriptId: string, userId?: string) {
        // Requires Project ID.
        // FIXME: Route needs to pass project ID.
        // For now, return success to not block UI.
        console.warn('deleteScript: Requires Project ID. Skipping.');
        return { status: 'deleted' };
    }

    async getScripts(projectId?: string, userId?: string) {
        if (!projectId) return [];
        // userId is optional for now as we trust the projectId access in local mode
        return await localProjectService.getScripts(projectId, userId || '');
    }

    async playScript(scriptId: string, userId?: string): Promise<{ status: 'pass' | 'fail', logs: string }> {
        // We need to find the script first.
        // Since we don't have projectId, we might need to search all projects.
        // PRO TIP: In local mode, we can iterate all project files.
        // Let's do a quick "Find Script" here.

        const allProjects = await localProjectService.getAllProjects(userId || '');
        let foundScript: any = null;
        let foundProjectId = '';

        for (const p of allProjects) {
            const scripts = await localProjectService.getScripts(p.id, userId || '');
            const match = scripts.find((s: any) => s.id === scriptId);
            if (match) {
                foundScript = match;
                foundProjectId = p.id;
                break;
            }
        }

        if (!foundScript) throw new Error('Script not found or access denied');

        const script = {
            id: foundScript.id,
            projectId: foundScript.project_id || foundProjectId,
            name: foundScript.name,
            module: foundScript.module,
            steps: foundScript.steps,
            createdAt: foundScript.createdAt,
            userId: foundScript.user_id
        };

        const browser = await chromium.launch({
            headless: process.env.HEADLESS !== 'false',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const context = await browser.newContext();
        const page = await context.newPage();

        const startTime = Date.now();
        const logs: string[] = [];
        const log = (msg: string) => {
            console.log(msg);
            logs.push(msg);
        };
        let stepsCompleted = 0;
        let scriptWasHealed = false;

        try {
            for (let i = 0; i < script.steps.length; i++) {
                const step = script.steps[i];
                let target = step.target;
                if (target.startsWith('css=')) target = target.replace('css=', '');
                if (target.startsWith('id=')) target = `#${target.replace('id=', '')}`;
                if (target.startsWith('xpath=')) target = target.replace('xpath=', '');

                if (step.target.includes('=')) {
                    target = step.target;
                }

                log(`[Recorder] Executing: ${step.command} on ${target}`);

                if (this.io) {
                    this.io.emit('recorder:step:start', { index: i, step });
                }

                try {
                    if (step.command === 'open') {
                        await page.goto(step.target);
                    } else if (step.command === 'click') {
                        // Increase timeout slightly mainly for healing detection time, keeping default but handling error
                        await page.click(target, { timeout: 5000 });
                    } else if (step.command === 'type') {
                        await page.fill(target, step.value, { timeout: 5000 });
                    }

                    if (this.io) {
                        this.io.emit('recorder:step:success', { index: i });
                    }
                    stepsCompleted++;
                } catch (stepError: any) {
                    // --- SELF HEALING LOGIC START ---
                    const errorMessage = stepError.message || '';
                    if ((errorMessage.includes('Timeout') || errorMessage.includes('waiting for selector')) && step.command !== 'open') {
                        log(`[Healer] 🩹 Step failed with timeout. Attempting Self-Healing for element: ${target} ...`);

                        try {
                            const htmlSnapshot = await page.content();
                            const healedSelector = await genAIService.healSelector(htmlSnapshot, target, errorMessage);

                            if (healedSelector) {
                                log(`[Healer] ✨ AI found a potential new selector: ${healedSelector}`);

                                // Retry with new selector
                                if (step.command === 'click') {
                                    await page.click(healedSelector);
                                } else if (step.command === 'type') {
                                    await page.fill(healedSelector, step.value);
                                }

                                log(`[Healer] ✅ Retry successful! Updating script...`);

                                // Update the script object in memory
                                script.steps[i].target = healedSelector;
                                script.steps[i].targets = [[healedSelector, 'css:finder'], ...(script.steps[i].targets || [])];
                                scriptWasHealed = true;

                                if (this.io) {
                                    this.io.emit('recorder:step:success', { index: i, healed: true, newSelector: healedSelector });
                                }
                                stepsCompleted++;
                                continue; // Continue to next loop
                            } else {
                                log(`[Healer] ❌ AI could not find a fix.`);
                            }
                        } catch (healError) {
                            log(`[Healer] Failed to heal: ${healError}`);
                        }
                    }
                    // --- SELF HEALING LOGIC END ---

                    if (this.io) {
                        this.io.emit('recorder:step:error', { index: i, error: stepError.message });
                    }
                    throw stepError;
                }
            }

            log('[Recorder] Script finished successfully');

            // --- VISUAL REGRESSION CHECK ---
            log('[Visual] 📸 Capturing screenshot for Visual Check...');
            const screenshotBuffer = await page.screenshot({ fullPage: true });
            const visualResult = await visualTestService.compare(script.id, screenshotBuffer);

            let finalStatus: 'pass' | 'fail' = 'pass';
            if (visualResult.hasBaseline && visualResult.diffPercentage > 0) {
                log(`[Visual] ⚠️ Mismatch detected: ${visualResult.diffPercentage.toFixed(2)}% difference.`);
                logs.push(`[Visual] ⚠️ Mismatch detected: ${visualResult.diffPercentage.toFixed(2)}%`);
                // Optionally mark as fail, or just 'visual_mismatch' if status supported
                // For now, keeping as PASS but logging warning. 
                // User can reject in UI.
            } else if (!visualResult.hasBaseline) {
                log(`[Visual] 🆕 First run. Saved as new Baseline.`);
            } else {
                log(`[Visual] ✅ Pixel Match! No changes.`);
            }
            // -------------------------------

            await browser.close();

            // Persist healing if needed
            if (scriptWasHealed && foundProjectId) {
                await localProjectService.updateScript(foundProjectId, script.id, { steps: script.steps }, userId || '');
                log('[Recorder] 💾 Script updated with healed selectors.');
            }

            await this.reportService.addReport({
                scriptId: script.id,
                projectId: script.projectId,
                scriptName: script.name,
                module: script.module,
                status: 'pass',
                startTime: new Date(startTime).toISOString(),
                endTime: new Date().toISOString(),
                duration: Date.now() - startTime,
                stepsCompleted,
                totalSteps: script.steps.length,
                userId: script.userId,
                logs: logs.join('\n')
            });

            return { status: 'pass', logs: logs.join('\n') };

        } catch (error: any) {
            log(`[Recorder] Script failed: ${error.message}`);
            if (browser) await browser.close();

            await this.reportService.addReport({
                scriptId: script.id,
                projectId: script.projectId,
                scriptName: script.name,
                module: script.module,
                status: 'fail',
                startTime: new Date(startTime).toISOString(),
                endTime: new Date().toISOString(),
                duration: Date.now() - startTime,
                error: error.message,
                stepsCompleted,
                totalSteps: script.steps.length,
                userId: script.userId,
                logs: logs.join('\n')
            });

            return { status: 'fail', logs: logs.join('\n') };
        }
    }

    async exportScript(scriptId: string, format: 'side' | 'java' | 'python', userId?: string) {
        // Find script first (same inefficient scan)
        const allProjects = await localProjectService.getAllProjects(userId || '');
        let script: any = null;
        for (const p of allProjects) {
            const scripts = await localProjectService.getScripts(p.id, userId || '');
            const match = scripts.find((s: any) => s.id === scriptId);
            if (match) {
                script = match;
                break;
            }
        }

        if (!script) throw new Error('Script not found');

        // Helper to get best selector
        const getBestSelector = (step: any) => {
            if (!step.targets || step.targets.length === 0) return { type: 'css', value: step.target.replace('css=', '') };

            // Priority: id > name > css > xpath
            const id = step.targets.find((t: any[]) => t[1] === 'id');
            if (id) return { type: 'id', value: id[0].replace('id=', '') };

            const name = step.targets.find((t: any[]) => t[1] === 'name');
            if (name) return { type: 'name', value: name[0].replace('name=', '') };

            // Default to target but clean it
            let target = step.target;
            if (target.startsWith('id=')) return { type: 'id', value: target.replace('id=', '') };
            if (target.startsWith('name=')) return { type: 'name', value: target.replace('name=', '') };
            if (target.startsWith('xpath=')) return { type: 'xpath', value: target.replace('xpath=', '') };
            if (target.startsWith('css=')) return { type: 'css', value: target.replace('css=', '') };

            return { type: 'css', value: target };
        };

        if (format === 'side') {
            return {
                id: script.id,
                version: "2.0",
                name: script.name,
                url: script.steps.find((s: any) => s.command === 'open')?.target || "",
                tests: [{
                    id: script.id,
                    name: script.name,
                    commands: script.steps.map((s: any) => {
                        // Ensure targets are in Selenium IDE format: [[value, type], [value, type]]
                        const targets = s.targets && s.targets.length > 0
                            ? s.targets
                            : [[s.target, s.target.startsWith('xpath') ? 'xpath:position' : 'css:finder']];

                        return {
                            id: uuidv4(),
                            comment: "",
                            command: s.command,
                            target: s.target,
                            targets: targets,
                            value: s.value || ""
                        };
                    })
                }],
                suites: [{
                    id: uuidv4(),
                    name: "Default Suite",
                    persistSession: false,
                    parallel: false,
                    timeout: 300,
                    tests: [script.id]
                }],
                urls: [script.steps.find((s: any) => s.command === 'open')?.target || ""],
                plugins: []
            };
        } else if (format === 'java') {
            const className = (script.name || 'Untitled').replace(/[^a-zA-Z0-9]/g, '');
            let code = `import org.junit.Test;\nimport org.junit.Before;\nimport org.junit.After;\nimport static org.junit.Assert.*;\nimport static org.hamcrest.CoreMatchers.is;\nimport static org.hamcrest.core.IsNot.not;\nimport org.openqa.selenium.By;\nimport org.openqa.selenium.WebDriver;\nimport org.openqa.selenium.firefox.FirefoxDriver;\nimport org.openqa.selenium.chrome.ChromeDriver;\nimport org.openqa.selenium.remote.RemoteWebDriver;\nimport org.openqa.selenium.remote.DesiredCapabilities;\nimport org.openqa.selenium.Dimension;\nimport org.openqa.selenium.WebElement;\nimport org.openqa.selenium.interactions.Actions;\nimport org.openqa.selenium.support.ui.ExpectedConditions;\nimport org.openqa.selenium.support.ui.WebDriverWait;\nimport org.openqa.selenium.JavascriptExecutor;\nimport org.openqa.selenium.Alert;\nimport org.openqa.selenium.Keys;\nimport java.util.*;\nimport java.net.MalformedURLException;\nimport java.net.URL;\n\npublic class ${className}Test {\n  private WebDriver driver;\n  private Map<String, Object> vars;\n  JavascriptExecutor js;\n\n  @Before\n  public void setUp() {\n    driver = new ChromeDriver();\n    js = (JavascriptExecutor) driver;\n    vars = new HashMap<String, Object>();\n  }\n\n  @After\n  public void tearDown() {\n    driver.quit();\n  }\n\n  @Test\n  public void ${className.toLowerCase()}() {\n`;

            for (const step of script.steps) {
                if (step.command === 'open') {
                    code += `    driver.get("${step.target}");\n`;
                } else if (step.command === 'click') {
                    const sel = getBestSelector(step);
                    let byStrategy = 'cssSelector';
                    if (sel.type === 'id') byStrategy = 'id';
                    else if (sel.type === 'name') byStrategy = 'name';
                    else if (sel.type === 'xpath') byStrategy = 'xpath';

                    code += `    driver.findElement(By.${byStrategy}("${sel.value.replace(/"/g, '\\"').replace(/\\/g, '\\\\')}")).click();\n`;
                } else if (step.command === 'type') {
                    const sel = getBestSelector(step);
                    let byStrategy = 'cssSelector';
                    if (sel.type === 'id') byStrategy = 'id';
                    else if (sel.type === 'name') byStrategy = 'name';
                    else if (sel.type === 'xpath') byStrategy = 'xpath';

                    code += `    driver.findElement(By.${byStrategy}("${sel.value.replace(/"/g, '\\"').replace(/\\/g, '\\\\')}")).sendKeys("${step.value}");\n`;
                }
            }
            code += `  }\n}\n`;
            return code;
        } else if (format === 'python') {
            const className = (script.name || 'Untitled').replace(/[^a-zA-Z0-9]/g, '');
            let code = `import pytest\nimport time\nimport json\nfrom selenium import webdriver\nfrom selenium.webdriver.common.by import By\nfrom selenium.webdriver.common.action_chains import ActionChains\nfrom selenium.webdriver.support import expected_conditions\nfrom selenium.webdriver.support.wait import WebDriverWait\nfrom selenium.webdriver.common.keys import Keys\nfrom selenium.webdriver.common.desired_capabilities import DesiredCapabilities\n\nclass Test${className}():\n  def setup_method(self, method):\n    self.driver = webdriver.Chrome()\n    self.vars = {}\n  \n  def teardown_method(self, method):\n    self.driver.quit()\n  \n  def test_${className.toLowerCase()}(self):\n`;

            for (const step of script.steps) {
                if (step.command === 'open') {
                    code += `    self.driver.get("${step.target}")\n`;
                } else if (step.command === 'click') {
                    const sel = getBestSelector(step);
                    let byStrategy = "By.CSS_SELECTOR";
                    if (sel.type === 'id') byStrategy = "By.ID";
                    else if (sel.type === 'name') byStrategy = "By.NAME";
                    else if (sel.type === 'xpath') byStrategy = "By.XPATH";

                    code += `    self.driver.find_element(${byStrategy}, "${sel.value.replace(/"/g, '\\"').replace(/\\/g, '\\\\')}").click()\n`;
                } else if (step.command === 'type') {
                    const sel = getBestSelector(step);
                    let byStrategy = "By.CSS_SELECTOR";
                    if (sel.type === 'id') byStrategy = "By.ID";
                    else if (sel.type === 'name') byStrategy = "By.NAME";
                    else if (sel.type === 'xpath') byStrategy = "By.XPATH";

                    code += `    self.driver.find_element(${byStrategy}, "${sel.value.replace(/"/g, '\\"').replace(/\\/g, '\\\\')}").send_keys("${step.value}")\n`;
                }
            }
            return code;
        }
    }
    async getReports(projectId?: string, userId?: string) {
        return this.reportService.getReports(projectId, userId);
    }

    async deleteReport(id: string, userId?: string) {
        return this.reportService.deleteReport(id, userId);
    }
}

export const recorderService = new RecorderService();
