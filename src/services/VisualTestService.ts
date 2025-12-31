import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import { v4 as uuidv4 } from 'uuid';

const DATA_DIR = path.join(__dirname, '../../data');
const IMAGES_DIR = path.join(DATA_DIR, 'visual_images');
const METADATA_FILE = path.join(DATA_DIR, 'visual_tests.json');

// Ensure directories exist
if (!fs.existsSync(IMAGES_DIR)) fs.mkdirSync(IMAGES_DIR, { recursive: true });
if (!fs.existsSync(METADATA_FILE)) fs.writeFileSync(METADATA_FILE, JSON.stringify([]));

export interface VisualTest {
    id: string;
    projectId: string;
    name: string;
    target_url: string;
    createdAt: string;
    lastRun?: string;
    diffPercentage?: number;
    status: 'pass' | 'fail' | 'new';
}

export class VisualTestService {

    // CRUD Operations for Metadata
    getAll(projectId: string): VisualTest[] {
        const all = JSON.parse(fs.readFileSync(METADATA_FILE, 'utf-8'));
        return all.filter((t: VisualTest) => t.projectId === projectId);
    }

    create(projectId: string, name: string, targetUrl: string): VisualTest {
        const all = JSON.parse(fs.readFileSync(METADATA_FILE, 'utf-8'));
        const newTest: VisualTest = {
            id: uuidv4(),
            projectId,
            name,
            target_url: targetUrl,
            createdAt: new Date().toISOString(),
            status: 'new'
        };
        all.push(newTest);
        fs.writeFileSync(METADATA_FILE, JSON.stringify(all, null, 2));
        return newTest;
    }

    delete(id: string) {
        let all = JSON.parse(fs.readFileSync(METADATA_FILE, 'utf-8'));
        all = all.filter((t: VisualTest) => t.id !== id);
        fs.writeFileSync(METADATA_FILE, JSON.stringify(all, null, 2));

        // Cleanup images
        const testDir = path.join(IMAGES_DIR, id);
        if (fs.existsSync(testDir)) fs.rmSync(testDir, { recursive: true, force: true });
    }

    // Core Logic: Run and Compare
    async runTest(id: string): Promise<{ diffPercentage: number; status: string }> {
        const all = JSON.parse(fs.readFileSync(METADATA_FILE, 'utf-8'));
        const testIndex = all.findIndex((t: VisualTest) => t.id === id);
        if (testIndex === -1) throw new Error('Test not found');

        const test = all[testIndex];
        const testDir = path.join(IMAGES_DIR, id);
        if (!fs.existsSync(testDir)) fs.mkdirSync(testDir, { recursive: true });

        const latestPath = path.join(testDir, 'latest.png');
        const baselinePath = path.join(testDir, 'baseline.png');
        const diffPath = path.join(testDir, 'diff.png');

        console.log(`[VisualTest] Launching browser for: ${test.target_url}`);

        // 1. Capture Screenshot
        console.log(`[VisualTest] Launching browser for: ${test.target_url}`);
        const browser = await chromium.launch({ headless: false });
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
        all[testIndex].lastRun = new Date().toISOString();
        all[testIndex].diffPercentage = diffPercentage;
        all[testIndex].status = status;
        fs.writeFileSync(METADATA_FILE, JSON.stringify(all, null, 2));

        return { diffPercentage, status };
    }

    // Compare Buffer (Used by RecorderService)
    async compare(id: string, screenshotBuffer: Buffer): Promise<{ hasBaseline: boolean, diffPercentage: number }> {
        const testDir = path.join(IMAGES_DIR, id);
        if (!fs.existsSync(testDir)) fs.mkdirSync(testDir, { recursive: true });

        const latestPath = path.join(testDir, 'latest.png');
        const baselinePath = path.join(testDir, 'baseline.png');
        const diffPath = path.join(testDir, 'diff.png');

        fs.writeFileSync(latestPath, screenshotBuffer);

        if (fs.existsSync(baselinePath)) {
            const img1 = PNG.sync.read(fs.readFileSync(baselinePath));
            const img2 = PNG.sync.read(screenshotBuffer);
            const { width, height } = img1;
            const diff = new PNG({ width, height });

            const numDiffPixels = pixelmatch(img1.data, img2.data, diff.data, width, height, { threshold: 0.1 });
            const diffPercentage = (numDiffPixels / (width * height)) * 100;

            fs.writeFileSync(diffPath, PNG.sync.write(diff));

            // Update metadata if exists
            try {
                const all = JSON.parse(fs.readFileSync(METADATA_FILE, 'utf-8'));
                const idx = all.findIndex((t: VisualTest) => t.id === id);
                if (idx !== -1) {
                    all[idx].lastRun = new Date().toISOString();
                    all[idx].diffPercentage = diffPercentage;
                    all[idx].status = diffPercentage > 0 ? 'fail' : 'pass';
                    fs.writeFileSync(METADATA_FILE, JSON.stringify(all, null, 2));
                }
            } catch (e) {
                // Ignore metadata update errors if test ID doesn't exist in visual_tests.json (might be a script ID)
            }

            return { hasBaseline: true, diffPercentage };
        } else {
            // Treat as new baseline
            // Note: We don't automatically promote to baseline unless approved, but for Recorder flow
            // it seems to treat first run as "New Baseline".
            // Let's just save it.
            return { hasBaseline: false, diffPercentage: 0 };
        }
    }

    // Approve: Promote Latest to Baseline
    approve(id: string) {
        const testDir = path.join(IMAGES_DIR, id);
        const latestPath = path.join(testDir, 'latest.png');
        const baselinePath = path.join(testDir, 'baseline.png');

        if (fs.existsSync(latestPath)) {
            fs.copyFileSync(latestPath, baselinePath);

            // Reset status
            try {
                const all = JSON.parse(fs.readFileSync(METADATA_FILE, 'utf-8'));
                const idx = all.findIndex((t: VisualTest) => t.id === id);
                if (idx !== -1) {
                    all[idx].diffPercentage = 0;
                    all[idx].status = 'pass';
                    fs.writeFileSync(METADATA_FILE, JSON.stringify(all, null, 2));
                }
            } catch (e) {
                // Ignore if not in metadata (e.g. script run)
            }
        } else {
            throw new Error('No latest run to approve');
        }
    }

    // Alias for the API call
    approveBaseline(scriptId: string, runId: string) {
        // For script executions, the ID used for folder storage is the scriptId
        // In a real system, we might version by runId, but for now V1 uses scriptId as the 'test' container
        this.approve(scriptId);
    }

    getImagePath(id: string, type: 'baseline' | 'latest' | 'diff'): string | null {
        const p = path.join(IMAGES_DIR, id, `${type}.png`);
        return fs.existsSync(p) ? p : null;
    }
}

export const visualTestService = new VisualTestService();
