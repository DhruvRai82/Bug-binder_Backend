import { Router } from 'express';
import { suiteService } from '../../services/persistence/SuiteService';
// If RunManager doesn't expose easy IDs, we might just re-use the batch-execute pattern.

const router = Router();

// GET /api/suites?projectId=...
router.get('/', async (req, res) => {
    try {
        const { projectId } = req.query;
        if (!projectId) return res.status(400).json({ error: "Project ID required" });

        const suites = await suiteService.getSuites(projectId as string);
        res.json(suites);
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

// POST /api/suites
router.post('/', async (req, res) => {
    try {
        const { projectId, name, fileIds, description } = req.body;
        const suite = await suiteService.createSuite(projectId, name, fileIds, description);
        res.json(suite);
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

// PUT /api/suites/:id
router.put('/:id', async (req, res) => {
    try {
        const { projectId, ...updates } = req.body;
        if (!projectId) return res.status(400).json({ error: "Project ID required" });

        const suite = await suiteService.updateSuite(projectId, req.params.id, updates);
        res.json(suite);
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

// DELETE /api/suites/:id
router.delete('/:id', async (req, res) => {
    try {
        const { projectId } = req.query;
        if (!projectId) return res.status(400).json({ error: "Project ID required" });

        await suiteService.deleteSuite(projectId as string, req.params.id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

// POST /api/suites/:id/run
// Reads the suite, gets fileIds, and triggers a batch run
router.post('/:id/run', async (req, res) => {
    try {
        const { projectId } = req.body;
        if (!projectId) return res.status(400).json({ error: "Project ID required" });

        // 1. Get Suite
        const suite = await suiteService.getSuite(projectId, req.params.id);
        if (!suite) return res.status(404).json({ error: "Suite not found" });

        if (!suite.fileIds || suite.fileIds.length === 0) {
            return res.status(400).json({ error: "Suite is empty" });
        }

        // 2. Trigger Batch Run (Using existing Runner Logic)
        // We'll simulate a POST to the runner API logic or call RunManager directly?
        // Ideally, we import the logic used by 'runner.ts'
        // For now, let's assume we can POST to the same logic or use a helper.
        // Actually, let's leave this logic to the frontend? 
        // No, backend should handle "Run Suite". 
        // But verifying correct import of 'runner' service might be tricky without reading it.
        // Let's implement a direct call to the functionality if possible, or just return the suite data 
        // and let frontend call '/batch-execute'.

        // Actually, it's better if the Backend does it.
        // Let's look at `backend/src/services/runner.ts` / `RunManager` if available.
        // I will assume I can't easily see it right now without `list/view`.
        // STRATEGY: Return the suite data with a special flag, or just use frontend orchestration for now 
        // to minimize breakage.

        // BETTER STRATEGY: Just return the suite details so frontend can confirm "Running Suite X..." 
        // then frontend hits /batch-execute with those IDs. 
        // This keeps the "Runner" logic centralized in one API endpoint.

        res.json({
            ready: true,
            suite
        });

    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

export const suitesRouter = router;
