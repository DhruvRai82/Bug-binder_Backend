import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import { v4 as uuidv4 } from 'uuid';
import { localProjectService } from './LocalProjectService';

const DATA_DIR = path.join(__dirname, '../../data');
const IMAGES_DIR = path.join(DATA_DIR, 'visual_images');
// METADATA_FILE is removed as we use LocalProjectService

// Ensure directories exist
if (!fs.existsSync(IMAGES_DIR)) fs.mkdirSync(IMAGES_DIR, { recursive: true });

export interface VisualTest {
    id: string;
    projectId: string; // Required now
    name: string;
    target_url: string;
    createdAt: string;
    lastRun?: string;
    diffPercentage?: number;
    status: 'pass' | 'fail' | 'new';
}

export class VisualTestService {

    // CRUD Operations for Metadata via LocalProjectService
    async getAll(projectId: string): Promise<VisualTest[]> {
        return await localProjectService.getVisualTests(projectId);
    }

    async create(projectId: string, name: string, targetUrl: string): Promise<VisualTest> {
        const newTest: VisualTest = {
            id: uuidv4(),
            projectId,
            name,
            target_url: targetUrl,
            createdAt: new Date().toISOString(),
            status: 'new'
        };
        return await localProjectService.saveVisualTest(projectId, newTest);
    }

    async delete(id: string, projectId: string) {
        await localProjectService.deleteVisualTest(projectId, id);

        // Cleanup images
        const testDir = path.join(IMAGES_DIR, id);
        if (fs.existsSync(testDir)) fs.rmSync(testDir, { recursive: true, force: true });
    }

    // Core Logic: Run and Compare
    async runTest(id: string, projectId: string): Promise<{ diffPercentage: number; status: string }> {
        const all = await this.getAll(projectId);
        const test = all.find(t => t.id === id);
        if (!test) throw new Error('Visual Test not found');

        const testDir = path.join(IMAGES_DIR, id);
        if (!fs.existsSync(testDir)) fs.mkdirSync(testDir, { recursive: true });

        const latestPath = path.join(testDir, 'latest.png');
        const baselinePath = path.join(testDir, 'baseline.png');
        const diffPath = path.join(testDir, 'diff.png');

        console.log(`[VisualTest] Launching browser for: ${test.target_url}`);

        // 1. Capture Screenshot
        const browser = await chromium.launch({ headless: false }); // Keeping headless: false as per user preference
        try {
            const page = await browser.newPage();
            await page.setViewportSize({ width: 1280, height: 720 });
            await page.goto(test.target_url, { waitUntil: 'networkidle' });
            await page.screenshot({ path: latestPath, fullPage: true });
        } finally {
            await browser.close();
        }

        // 2. Compare if baseline exists
        let diffPercentage = 0;
        let status: 'pass' | 'fail' | 'new' = 'pass';

        if (fs.existsSync(baselinePath)) {
            const img1 = PNG.sync.read(fs.readFileSync(baselinePath));
            const img2 = PNG.sync.read(fs.readFileSync(latestPath));
            const { width, height } = img1;
            const diff = new PNG({ width, height });

            const numDiffPixels = pixelmatch(img1.data, img2.data, diff.data, width, height, { threshold: 0.1 });
            diffPercentage = (numDiffPixels / (width * height)) * 100;

            fs.writeFileSync(diffPath, PNG.sync.write(diff));

            if (diffPercentage > 0) status = 'fail';
        } else {
            // First run, no baseline -> Treat as new/pass
            status = 'new';
        }

        // 3. Update Result
        const updatedTest = {
            ...test,
            lastRun: new Date().toISOString(),
            diffPercentage,
            status
        };
        await localProjectService.saveVisualTest(projectId, updatedTest);

        return { diffPercentage, status };
    }

    // Compare Buffer (Used by RecorderService)
    async compare(id: string, screenshotBuffer: Buffer, projectId: string): Promise<{ hasBaseline: boolean, diffPercentage: number }> {
        const testDir = path.join(IMAGES_DIR, id);
        if (!fs.existsSync(testDir)) fs.mkdirSync(testDir, { recursive: true });

        const latestPath = path.join(testDir, 'latest.png');
        const baselinePath = path.join(testDir, 'baseline.png');
        const diffPath = path.join(testDir, 'diff.png');

        fs.writeFileSync(latestPath, screenshotBuffer);

        let diffPercentage = 0;
        let hasBaseline = false;

        if (fs.existsSync(baselinePath)) {
            hasBaseline = true;
            const img1 = PNG.sync.read(fs.readFileSync(baselinePath));
            const img2 = PNG.sync.read(screenshotBuffer);
            const { width, height } = img1;
            const diff = new PNG({ width, height });

            const numDiffPixels = pixelmatch(img1.data, img2.data, diff.data, width, height, { threshold: 0.1 });
            diffPercentage = (numDiffPixels / (width * height)) * 100;

            fs.writeFileSync(diffPath, PNG.sync.write(diff));

            // Update metadata if exists
            try {
                const all = await this.getAll(projectId);
                const test = all.find(t => t.id === id);
                if (test) {
                    const updatedTest = {
                        ...test,
                        lastRun: new Date().toISOString(),
                        diffPercentage,
                        status: diffPercentage > 0 ? 'fail' : 'pass'
                    };
                    await localProjectService.saveVisualTest(projectId, updatedTest);
                }
            } catch (e) {
                // Ignore if test not found (e.g. ad-hoc script run)
            }
        } else {
            // Treat as new
            hasBaseline = false;
        }

        return { hasBaseline, diffPercentage };
    }

    // Approve: Promote Latest to Baseline
    async approve(id: string, projectId: string) {
        const testDir = path.join(IMAGES_DIR, id);
        const latestPath = path.join(testDir, 'latest.png');
        const baselinePath = path.join(testDir, 'baseline.png');

        if (fs.existsSync(latestPath)) {
            fs.copyFileSync(latestPath, baselinePath);

            // Reset status
            const all = await this.getAll(projectId);
            const test = all.find(t => t.id === id);
            if (test) {
                const updatedTest = {
                    ...test,
                    diffPercentage: 0,
                    status: 'pass'
                };
                await localProjectService.saveVisualTest(projectId, updatedTest);
            }
        } else {
            throw new Error('No latest run to approve');
        }
    }

    // Alias for the API call - requires projectId now!
    async approveBaseline(scriptId: string, projectId: string) {
        // For script executions, the ID used for folder storage is the scriptId
        await this.approve(scriptId, projectId);
    }

    getImagePath(id: string, type: 'baseline' | 'latest' | 'diff'): string | null {
        const p = path.join(IMAGES_DIR, id, `${type}.png`);
        return fs.existsSync(p) ? p : null;
    }
}

export const visualTestService = new VisualTestService();
