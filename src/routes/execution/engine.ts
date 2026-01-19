import express from 'express';
import { Container } from 'typedi';
import { EngineService } from '../../services/execution/EngineService';

const router = express.Router();

router.post('/run', async (req, res) => {
    console.log('[API] [POST /api/engine/run] Received Request');
    console.log('[API] Request Body:', JSON.stringify(req.body, null, 2));

    try {
        const { steps, options } = req.body;

        if (!steps || !Array.isArray(steps)) {
            console.error('[API] Validation Failed: Steps array missing');
            return res.status(400).json({ error: 'Valid steps array required' });
        }

        const engine = Container.get(EngineService);

        // Run asynchronously (fire and forget for this MVP? Or await? 
        // User asked to "Start", usually simpler to await for simple runs, 
        // but for long runs we might need background processing. 
        // For MVP JSON Engine, let's await to see logs in response or console easily).
        await engine.executeTest(steps, options);

        console.log('[API] Request Handled Successfully');
        res.json({ success: true, message: 'Test execution completed successfully' });

    } catch (error: any) {
        console.error('[API] Execution Failed:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

export default router;
