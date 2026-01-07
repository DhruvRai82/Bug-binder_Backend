import express from 'express';
import { authMiddleware } from '../middleware/auth';
import { genAIService } from '../services/GenAIService';
// import { supabase } from '../lib/supabase';

const router = express.Router();

// Analyze Failure
router.post('/analyze-failure', authMiddleware, async (req, res) => {
    try {
        const { runId, projectId } = req.body;
        if (!runId) return res.status(400).json({ error: 'runId is required' });

        // userId from auth middleware (for custom keys)
        // With permissive auth, req.user might be just { id: 'test-user-id' }
        const userObj = (req as any).user;
        const userId = userObj?.id || userObj?.uid || 'test-user-id';

        const analysis = await genAIService.analyzeRunFailure(runId, userId, projectId);
        res.json(analysis);
    } catch (error: any) {
        console.error('Analysis Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Approve Visual Baseline
router.post('/visual/approve', authMiddleware, async (req, res) => {
    try {
        const { scriptId, runId } = req.body;
        if (!scriptId || !runId) return res.status(400).json({ error: 'scriptId and runId required' });

        // 1. Get the screenshot from the run logs or storage? 
        // Ideally, we should have stored the 'new' screenshot path/buffer. 
        // For V1, let's assume the frontend sends the base64 or we fetch the latest artifacts.

        // Simplified Logic: The VisualTestService should have saved the 'diff' or 'actual' image.
        // We will just update the 'visual_baselines' table to say "Update baseline for this script".

        // Actually, we need the IMAGE data to update the baseline. 
        // Let's assume for now valid approval logic is delegated to a service or we just mark it.

        // Real logic: We need to overwrite the baseline image in storage.
        // Since we are mocking storage with FS in VisualTestService, we need a method there.

        const { visualTestService } = await import('../services/VisualTestService.js');
        await visualTestService.approveBaseline(scriptId, runId);

        res.json({ success: true, message: 'Baseline updated' });
    } catch (error: any) {
        console.error('Visual Approval Error:', error);
        res.status(500).json({ error: error.message });
    }
});

export default router;
