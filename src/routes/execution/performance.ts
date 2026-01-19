import { Router } from 'express';
import Container from 'typedi';
import { PerformanceService } from '../../services/execution/PerformanceService';

const router = Router();

router.post('/analyze', async (req, res) => {
    try {
        const { url, device, projectId } = req.body;
        if (!url) return res.status(400).json({ error: 'URL is required' });

        const service = Container.get(PerformanceService);
        const result = await service.analyzeUrl(url, device || 'mobile');

        if (projectId) {
            await service.saveReport(projectId, result);
        }

        res.json(result);
    } catch (error: any) {
        console.error("Performance API Error:", error.message);
        res.status(500).json({ error: error.message || 'Analysis failed' });
    }
});

router.get('/history/:projectId', async (req, res) => {
    try {
        const { projectId } = req.params;
        const service = Container.get(PerformanceService);
        const history = await service.getHistory(projectId);
        res.json(history);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch history' });
    }
});

router.delete('/history/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const service = Container.get(PerformanceService);
        await service.deleteRun(id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete run' });
    }
});

export default router;
