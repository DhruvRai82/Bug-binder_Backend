import { Router } from 'express';
import { proxyService } from '../../services/integration/ProxyService';
import { apiLabService } from '../../services/persistence/APILabService';

const router = Router();

// --- Proxy ---
router.post('/proxy', async (req, res) => {
    try {
        const result = await proxyService.forwardRequest(req.body);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

// --- Collections ---
router.get('/collections', async (req, res) => {
    try {
        const { projectId } = req.query;
        if (!projectId) return res.status(400).json({ error: "Project ID required" });
        const data = await apiLabService.getCollections(projectId as string);
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

router.get('/collections/:id/requests', async (req, res) => {
    try {
        const { projectId } = req.query;
        if (!projectId) return res.status(400).json({ error: "Project ID required" });
        const data = await apiLabService.getCollectionRequests(req.params.id, projectId as string);
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

router.post('/collections', async (req, res) => {
    try {
        const { name, projectId } = req.body;
        const data = await apiLabService.createCollection(name, projectId);
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

router.delete('/collections/:id', async (req, res) => {
    try {
        const { projectId } = req.query; // Get from query
        if (!projectId) return res.status(400).json({ error: "Project ID required" });
        await apiLabService.deleteCollection(req.params.id, projectId as string);
        res.json({ status: 'deleted' });
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

// --- Requests ---
router.post('/requests', async (req, res) => {
    try {
        const { collectionId, name, method, url, projectId } = req.body;
        const data = await apiLabService.createRequest(collectionId, name, method, url, projectId);
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

router.put('/requests/:id', async (req, res) => {
    try {
        const { projectId } = req.body;
        // Body includes projectId + updates.
        // We separate them.
        const { projectId: pid, ...updates } = req.body;
        if (!pid) return res.status(400).json({ error: "Project ID required" });

        const data = await apiLabService.updateRequest(req.params.id, updates, pid);
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

router.delete('/requests/:id', async (req, res) => {
    try {
        const { projectId } = req.query;
        if (!projectId) return res.status(400).json({ error: "Project ID required" });
        await apiLabService.deleteRequest(req.params.id, projectId as string);
        res.json({ status: 'deleted' });
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

export const apiLabRouter = router;
