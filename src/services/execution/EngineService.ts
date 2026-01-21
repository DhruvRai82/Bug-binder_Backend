import { chromium, Browser, Page } from 'playwright';
import path from 'path';
import * as fs from 'fs';
import { Service } from 'typedi';
import { genAIService } from '../ai/GenAIService';

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

    // Resume Control
    private resumeResolver: null | ((value: any) => void) = null;

    constructor() {
        console.log('[EngineService] Initialized new instance');
    }

    public async executeTest(steps: TestStep[], options: { headless?: boolean; sourcePath?: string; userId?: string } = {}) {
        const runId = `RUN-${Date.now()}`;
        this.executionLogs = [];
        this.logsPath = null;
        this.resumeResolver = null;

        console.log(`[EngineService] [${runId}] STARTING INTERACTIVE SESSION`);

        // --- Path Setup (Same as before) ---
        if (options.sourcePath) {
            try {
                const projectRoot = path.join(__dirname, '../../../../');
                const filename = path.basename(options.sourcePath, '.flow.json');
                let relativeDir = path.dirname(options.sourcePath);
                if (relativeDir.match(/^[a-zA-Z]:/)) relativeDir = relativeDir.split(path.sep).slice(1).join(path.sep);
                relativeDir = relativeDir.replace(/^[\/\\]+/, '');
                const runsBase = path.join(projectRoot, 'runs');
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                this.logsPath = path.join(runsBase, relativeDir, filename, `Run_${timestamp}`);
                if (!fs.existsSync(this.logsPath)) fs.mkdirSync(this.logsPath, { recursive: true });
            } catch (e) { console.error('Path setup failed', e); }
        }

        try {
            console.log(`[EngineService] [${runId}] Launching Browser...`);
            this.browser = await chromium.launch({
                headless: false, // FORCE HEADED for Interactive Mode
                args: ['--no-sandbox', '--disable-web-security'] // disable web security for easier injections
            });

            const context = await this.browser.newContext();
            this.page = await context.newPage();

            // --- 1. BRIDGE: Node <-> Browser Communication ---
            await this.page.exposeFunction('testflow_bridge', (message: any) => {
                console.log(`[Bridge] Received: ${message.type}`, message.payload);
                if (message.type === 'resume') {
                    if (this.resumeResolver) {
                        this.resumeResolver(message.payload);
                        this.resumeResolver = null;
                    }
                }
            });

            // --- 2. INJECT UI ---
            await this.page.addInitScript((steps) => {
                if (window.hasOwnProperty('__tf_hud_installed')) return;
                (window as any).__tf_hud_installed = true;

                const installHUD = () => {
                    if (document.getElementById('tf-driver-host')) return;

                    const root = document.documentElement; // Stick to Root for safety
                    if (!root) return;

                    const host = document.createElement('div');
                    host.id = 'tf-driver-host';
                    Object.assign(host.style, { position: 'fixed', top: '0', right: '0', zIndex: '2147483647', pointerEvents: 'none', height: '100vh', width: '380px' });
                    root.appendChild(host);

                    const shadow = host.attachShadow({ mode: 'open' });

                    const style = document.createElement('style');
                    style.textContent = `
                        :host { font-family: 'Inter', system-ui, sans-serif; }
                        * { box-sizing: border-box; }
                        
                        .hud {
                            pointer-events: auto; /* ENABLE CLICKS */
                            position: absolute; top: 20px; right: 20px; bottom: 20px; left: 20px;
                            background: rgba(15, 23, 42, 0.95);
                            backdrop-filter: blur(12px);
                            border: 1px solid rgba(255,255,255,0.1);
                            border-radius: 12px;
                            display: flex; flex-direction: column;
                            box-shadow: -10px 0 40px rgba(0,0,0,0.5);
                            color: white; overflow: hidden;
                            transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
                        }
                        
                        .header {
                            padding: 16px; background: rgba(0,0,0,0.2);
                            border-bottom: 1px solid rgba(255,255,255,0.1);
                            display: flex; align-items: center; justify-content: space-between;
                        }
                        .brand { font-weight: 700; letter-spacing: 0.5px; display: flex; align-items: center; gap: 8px; font-size: 13px; }
                        .status-badge { padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; text-transform: uppercase; }
                        .status-running { background: rgba(59, 130, 246, 0.2); color: #60a5fa; border: 1px solid rgba(59, 130, 246, 0.4); }
                        .status-paused { background: rgba(245, 158, 11, 0.2); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.4); animation: pulse 2s infinite; }
                        .status-done { background: rgba(34, 197, 94, 0.2); color: #4ade80; border: 1px solid rgba(34, 197, 94, 0.4); }

                        .timeline { flex: 1; overflow-y: auto; padding: 12px; display: flex; flex-direction: column; gap: 8px; }
                        
                        .step-item {
                            display: flex; gap: 12px; padding: 10px; border-radius: 8px;
                            background: rgba(255,255,255,0.03); border: 1px solid transparent;
                            transition: all 0.2s;
                        }
                        .step-item.active { background: rgba(59, 130, 246, 0.1); border-color: rgba(59, 130, 246, 0.3); }
                        .step-item.error { background: rgba(239, 68, 68, 0.1); border-color: rgba(239, 68, 68, 0.3); }
                        .step-item.passed { opacity: 0.6; }

                        .step-icon {
                            width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center;
                            background: rgba(255,255,255,0.1); font-size: 12px; flex-shrink: 0;
                        }
                        .active .step-icon { background: #3b82f6; color: white; box-shadow: 0 0 10px rgba(59, 130, 246, 0.5); }
                        .error .step-icon { background: #ef4444; color: white; }
                        .passed .step-icon { background: #22c55e; color: white; }

                        .step-info { flex: 1; min-width: 0; }
                        .step-label { font-size: 13px; font-weight: 500; margin-bottom: 2px; color: #f1f5f9; }
                        .step-meta { font-size: 11px; color: #94a3b8; font-family: monospace; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

                        .fix-panel {
                            background: #1e1e2e; border-top: 1px solid rgba(255,255,255,0.1);
                            padding: 16px; display: flex; flex-direction: column; gap: 10px;
                            transform: translateY(100%); transition: transform 0.3s;
                        }
                        .fix-panel.visible { transform: translateY(0); }
                        .fix-title { font-size: 12px; font-weight: 600; color: #fbbf24; display: flex; align-items: center; gap: 6px; }
                        
                        input {
                            background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1);
                            padding: 8px; border-radius: 6px; color: white; font-family: monospace; font-size: 12px; width: 100%;
                        }
                        input:focus { outline: none; border-color: #fbbf24; }

                        .actions { display: flex; gap: 8px; }
                        button {
                            flex: 1; padding: 8px; border-radius: 6px; border: none; cursor: pointer; font-size: 12px; font-weight: 600;
                            transition: opacity 0.2s;
                        }
                        button:hover { opacity: 0.9; }
                        .btn-retry { background: #fbbf24; color: #000; }
                        .btn-skip { background: rgba(255,255,255,0.1); color: #fff; }

                        @keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.5; } 100% { opacity: 1; } }
                    `;
                    shadow.appendChild(style);

                    const hud = document.createElement('div');
                    hud.className = 'hud';
                    hud.innerHTML = `
                        <div class="header">
                            <div class="brand">⚡ TESTFLOW PRO</div>
                            <div class="status-badge status-running" id="global-status">RUNNING</div>
                        </div>
                        <div class="timeline" id="timeline">
                            <!-- Steps Injected Here -->
                        </div>
                        <div class="fix-panel" id="fix-panel">
                            <div class="fix-title">⚠️ STEP FAILED</div>
                            <input type="text" id="fix-input" placeholder="Enter new selector...">
                            <div class="actions">
                                <button class="btn-retry" id="btn-retry">Fix & Retry</button>
                                <button class="btn-skip" id="btn-skip">Skip</button>
                            </div>
                        </div>
                    `;
                    shadow.appendChild(hud);

                    // --- LOGIC ---
                    const timeline = shadow.getElementById('timeline')!;
                    const fixPanel = shadow.getElementById('fix-panel')!;
                    const fixInput = shadow.getElementById('fix-input') as HTMLInputElement;
                    const globalStatus = shadow.getElementById('global-status')!;

                    // Render Steps
                    steps.forEach((s: any, idx: number) => {
                        const row = document.createElement('div');
                        row.className = 'step-item';
                        row.id = `step-${idx + 1}`;
                        row.innerHTML = `
                            <div class="step-icon">${idx + 1}</div>
                            <div class="step-info">
                                <div class="step-label">${s.action.toUpperCase()}</div>
                                <div class="step-meta">${s.params.selector || s.params.url || s.params.value || ''}</div>
                            </div>
                        `;
                        timeline.appendChild(row);
                    });

                    // Event Listeners
                    window.addEventListener('testflow:update', (e: any) => {
                        const { index, status, error } = e.detail;
                        const row = shadow.getElementById(`step-${index}`);
                        if (!row) return;

                        // Reset classes
                        row.classList.remove('active', 'error', 'passed');

                        if (status === 'RUNNING') {
                            row.classList.add('active');
                            row.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            globalStatus.textContent = 'RUNNING';
                            globalStatus.className = 'status-badge status-running';
                            fixPanel.classList.remove('visible');
                        } else if (status === 'PASSED') {
                            row.classList.add('passed');
                        } else if (status === 'FAILED') {
                            row.classList.add('error');
                            globalStatus.textContent = 'PAUSED';
                            globalStatus.className = 'status-badge status-paused';

                            // Show Fix Panel
                            fixPanel.classList.add('visible');
                            fixInput.value = e.detail.selector || '';
                            fixInput.focus();
                        }
                    });

                    // Interactive Handlers
                    shadow.getElementById('btn-retry')?.addEventListener('click', () => {
                        globalStatus.textContent = 'RESUMING...';
                        fixPanel.classList.remove('visible');
                        (window as any).testflow_bridge({ type: 'resume', payload: { action: 'retry', selector: fixInput.value } });
                    });

                    shadow.getElementById('btn-skip')?.addEventListener('click', () => {
                        fixPanel.classList.remove('visible');
                        (window as any).testflow_bridge({ type: 'resume', payload: { action: 'skip' } });
                    });
                };

                // DOM Waiter logic
                if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', installHUD);
                else installHUD();
                setInterval(installHUD, 500); // Guardian

            }, steps); // Pass steps to initScript

            // --- EXECUTION LOOP ---
            for (let i = 0; i < steps.length; i++) {
                const step = steps[i];
                console.log(`[Executor] Processing Step ${i + 1}: ${step.action}`);

                // 1. Notify Start
                await this.page.evaluate(({ i, sel }) => {
                    window.dispatchEvent(new CustomEvent('testflow:update', { detail: { index: i, status: 'RUNNING', selector: sel } }));
                }, { i: i + 1, sel: step.params.selector });

                try {
                    await this.executeStep(step, i + 1, options.userId);

                    // 2. Notify Pass
                    await this.page.evaluate(({ i }) => {
                        window.dispatchEvent(new CustomEvent('testflow:update', { detail: { index: i, status: 'PASSED' } }));
                    }, { i: i + 1 });

                } catch (originalError: any) {
                    // --- ERROR HANDLING & HOT FIX ---
                    console.error(`[Executor] Error at step ${i + 1}: ${originalError.message}`);

                    // 3. Notify Fail & Wait
                    await this.page.evaluate(({ i, sel, err }) => {
                        window.dispatchEvent(new CustomEvent('testflow:update', { detail: { index: i, status: 'FAILED', selector: sel, error: err } }));
                    }, { i: i + 1, sel: step.params.selector, err: originalError.message });

                    // 4. Pause Node Execution until Browser signals
                    console.log('[Executor] ⏸️ execution paused, waiting for user input...');

                    const userAction = await new Promise<any>((resolve) => {
                        this.resumeResolver = resolve;
                    });

                    console.log('[Executor] ▶️ Resumed with action:', userAction);

                    if (userAction.action === 'retry') {
                        // Apply Fix
                        if (userAction.selector) {
                            console.log(`[Executor] Applying Hot-Fix Selector: ${userAction.selector}`);
                            step.params.selector = userAction.selector; // Update step
                        }

                        // Decrement index to re-run THIS loop iteration
                        i--;
                        continue;
                    } else if (userAction.action === 'skip') {
                        console.log('[Executor] Skipping step...');
                        // Just continue to next iteration
                        continue;
                    }
                }
            }

            console.log('[Executor] All steps finished.');

        } catch (error: any) {
            console.error('Fatal Error:', error);
            throw error;
        } finally {
            // Keep browser open for a moment if desired, or close
            // await this.browser?.close();
        }
    }

    private async executeStep(step: TestStep, index: number, userId?: string) {
        if (!this.page) throw new Error("Browser page not initialized");

        // Basic Execution - Removed complex healing for now to focus on Manual Fix
        // We rely on the "Pause & Fix" workflow now.
        switch (step.action) {
            case 'navigate':
                await this.page.goto(step.params.url!, { timeout: 15000 });
                break;
            case 'click':
                await this.page.click(this.sanitizeSelector(step.params.selector!), { timeout: 5000 }); // Fast fail for interactivity
                break;
            case 'type':
                await this.page.fill(this.sanitizeSelector(step.params.selector!), step.params.value || '', { timeout: 5000 });
                break;
            case 'wait':
                await this.page.waitForTimeout(parseInt(step.params.value || '1000'));
                break;
        }
    }

    private sanitizeSelector(selector: string): string {
        if (!selector) return '';
        let sanitized = selector.replace(/(\.[a-zA-Z0-9_-]+)\[([^=\]]+)\]/g, '$1\\[$2\\]');
        sanitized = sanitized.replace(/!/g, '\\!');
        return sanitized;
    }
}
