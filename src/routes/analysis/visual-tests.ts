import { Router } from 'express';
import { visualTestService } from '../../services/analysis/VisualTestService';
import fs from 'fs';
import { authMiddleware } from '../../middleware/auth';

const router = Router();

// Middleware: All routes require auth
router.use(authMiddleware);

// Create Test
router.post('/', async (req, res) => {
    try {
        const { name, targetUrl, projectId } = req.body;
        if (!name || !targetUrl || !projectId) return res.status(400).json({ error: 'Missing fields' });

        const test = await visualTestService.create(projectId, name, targetUrl);
        res.json(test);
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

// List Tests
router.get('/', async (req, res) => {
    try {
        const { projectId } = req.query;
        if (!projectId) return res.status(400).json({ error: 'Project ID required' });

        const tests = await visualTestService.getAll(projectId as string);
        res.json(tests);
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

// Run Test
router.post('/:testId/run', async (req, res) => {
    try {
        const { projectId } = req.body;
        if (!projectId) return res.status(400).json({ error: 'Project ID required' });

        const result = await visualTestService.runTest(req.params.testId, projectId);
        res.json(result);
    } catch (error) {
        console.error("Run Error:", error);
        res.status(500).json({ error: "Failed to run test" });
    }
});

// Delete Test
router.delete('/:testId', async (req, res) => {
    try {
        const { projectId } = req.query;
        if (!projectId) return res.status(400).json({ error: 'Project ID required' });

        await visualTestService.delete(req.params.testId, projectId as string);
        res.json({ status: 'deleted' });
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

// Approve Latest
router.post('/:testId/approve', async (req, res) => {
    try {
        const { projectId } = req.body;
        if (!projectId) return res.status(400).json({ error: 'Project ID required' });

        await visualTestService.approve(req.params.testId, projectId);
        res.json({ status: 'approved' });
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

// Get Images (Baseline, Latest, Diff)
router.get('/:testId/:type', (req, res) => {
    try {
        const { testId, type } = req.params;

        // Validate type to prevent LFI
        if (!['baseline', 'latest', 'diff'].includes(type)) {
            return res.status(400).json({ error: 'Invalid type' });
        }

        const imagePath = visualTestService.getImagePath(testId, type as any);

        if (imagePath && fs.existsSync(imagePath)) {
            res.sendFile(imagePath);
        } else {
            // Return transparent 1x1 pixel instead of 404 to avoid console errors in UI
            const transparentPixelInfo = Buffer.from(
                'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
                'base64'
            );
            res.writeHead(200, {
                'Content-Type': 'image/png',
                'Content-Length': transparentPixelInfo.length
            });
            res.end(transparentPixelInfo);
        }
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

export const visualTestRouter = router;
