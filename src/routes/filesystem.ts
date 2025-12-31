import express from 'express';
import { fileSystemService } from '../services/FileSystemService';
import { authMiddleware } from '../middleware/auth';

const router = express.Router();

router.use(authMiddleware);

// GET /api/fs?projectId=...
router.get('/', async (req, res) => {
    try {
        const { projectId } = req.query;
        const userId = (req as any).user.uid;

        if (!projectId) {
            return res.status(400).json({ error: 'projectId is required' });
        }

        const nodes = await fileSystemService.getNodes(projectId as string, userId);
        res.json(nodes);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/fs
router.post('/', async (req, res) => {
    try {
        const { projectId, parentId, name, type, language } = req.body;
        const userId = (req as any).user.uid;

        if (!projectId || !name || !type) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Check duplicates
        const exists = await fileSystemService.checkExists(projectId, parentId, name);
        if (exists) {
            return res.status(409).json({ error: 'Item with this name already exists' });
        }

        const node = await fileSystemService.createNode({
            projectId,
            userId,
            parentId: parentId || null,
            name,
            type,
            language
        });

        res.json(node);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// PUT /api/fs/:id/content (Save File)
router.put('/:id/content', async (req, res) => {
    try {
        const { id } = req.params;
        const { content } = req.body;
        const userId = (req as any).user.uid;

        await fileSystemService.updateContent(id, content, userId);
        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// PATCH /api/fs/:id (Rename)
router.patch('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { name } = req.body;
        const userId = (req as any).user.uid;

        if (!name) {
            return res.status(400).json({ error: 'name is required' });
        }

        await fileSystemService.renameNode(id, name, userId);
        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// DELETE /api/fs/:id
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const userId = (req as any).user.uid;

        await fileSystemService.deleteNode(id, userId);
        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

export const fileSystemRoutes = router;
