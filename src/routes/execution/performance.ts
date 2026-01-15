import { Router } from 'express';
import Container from 'typedi';
import { PerformanceService } from '../../services/execution/PerformanceService';

const router = Router();

router.post('/analyze', async (req, res) => {
    try {
        const { url, device } = req.body;
        if (!url) return res.status(400).json({ error: 'URL is required' });

        const service = Container.get(PerformanceService);
        const result = await service.analyzeUrl(url, device || 'mobile');

        res.json(result);
    } catch (error: any) {
        console.error("Performance API Error:", error.message);
        res.status(500).json({ error: error.message || 'Analysis failed' });
    }
});

export default router;
