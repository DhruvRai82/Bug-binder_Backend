import { Router } from 'express';
import { testDataService } from '../../services/persistence/TestDataService';
import multer from 'multer';

const router = Router();
const upload = multer(); // Use memory storage for simplicity

router.get('/', async (req, res) => {
    try {
        const { projectId } = req.query;
        if (!projectId) return res.status(400).json({ error: 'Project ID required' });

        const datasets = await testDataService.listDatasets(projectId as string);
        res.json(datasets);
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

// Preview route - duplicate of get data for now, could be optimized later to just return head
router.get('/:id/preview', async (req, res) => {
    try {
        const { projectId } = req.query;
        // if (!projectId) return res.status(400).json({ error: 'Project ID required' }); // Make robust
        const data = await testDataService.getData(req.params.id, projectId as string);
        // optimization: if array, return first 5 items
        if (Array.isArray(data)) {
            res.json(data.slice(0, 5));
        } else {
            res.json(data);
        }
    } catch (error) {
        res.status(404).json({ error: (error as Error).message });
    }
});

router.get('/:id', async (req, res) => {
    try {
        const { projectId } = req.query;
        const data = await testDataService.getData(req.params.id, projectId as string);
        res.json(data);
    } catch (error) {
        res.status(404).json({ error: (error as Error).message });
    }
});

// Upload route - expects a file named 'file'
router.post('/upload', upload.single('file'), async (req, res) => {
    try {
        const file = req.file;
        if (!file) return res.status(400).json({ error: "No file provided" });

        const content = file.buffer.toString('utf8');
        const originalName = file.originalname;
        const type = originalName.endsWith('.json') ? 'json' : 'csv';

        const { projectId } = req.body;
        if (!projectId) return res.status(400).json({ error: 'Project ID required' });

        const dataset = await testDataService.saveDataset(originalName, content, type, projectId);
        res.json(dataset);

    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

router.delete('/:id', async (req, res) => {
    try {
        const { projectId } = req.query;
        await testDataService.deleteDataset(req.params.id, projectId as string);
        res.json({ status: 'deleted' });
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

export default router;
