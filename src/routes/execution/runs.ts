import express from 'express';
import path from 'path';
import * as fs from 'fs';

const router = express.Router();

// Root runs directory
const RUNS_ROOT = path.join(__dirname, '../../../../runs');

// Helper to safely resolve path
const resolveSafePath = (relativePath: string) => {
    const safePath = path.normalize(relativePath).replace(/^(\.\.[\/\\])+/, '');
    return path.join(RUNS_ROOT, safePath);
};

// GET /api/runs?path=SubDir
// Lists contents of a directory in runs/
router.get('/', (req, res) => {
    try {
        const relativePath = (req.query.path as string) || '';
        const fullPath = resolveSafePath(relativePath);

        console.log(`[RunsAPI] Listing: '${relativePath}' -> '${fullPath}'`);

        if (!fs.existsSync(fullPath)) {
            console.warn(`[RunsAPI] Path does not exist: ${fullPath}`);
            // If output dir doesn't exist yet, just return empty list
            return res.json([]);
        }

        const items = fs.readdirSync(fullPath, { withFileTypes: true });
        console.log(`[RunsAPI] Found ${items.length} items`);

        const nodes = items.map(item => ({
            name: item.name,
            type: item.isDirectory() ? 'folder' : 'file',
            path: path.join(relativePath, item.name).replace(/\\/g, '/'), // normalized forward slash
            // Add extra metadata if needed
            createdAt: fs.statSync(path.join(fullPath, item.name)).birthtime
        }));

        // Sort: Folders first, then new to old
        nodes.sort((a, b) => {
            if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
            // If both runs (folders starting with Run_), sort newest first
            if (a.name.startsWith('Run_') && b.name.startsWith('Run_')) {
                return b.name.localeCompare(a.name);
            }
            return a.name.localeCompare(b.name);
        });

        res.json(nodes);
    } catch (error: any) {
        console.error("Runs API Error:", error);
        res.status(500).json({ error: error.message });
    }
});

// GET /api/runs/file?path=Flows/Login/Run_123/screenshot.png
// Serves a file
router.get('/file', (req, res) => {
    try {
        const relativePath = (req.query.path as string);
        if (!relativePath) return res.status(400).json({ error: "Path required" });

        const fullPath = resolveSafePath(relativePath);
        console.log(`[RunsAPI] Serving file: '${relativePath}' -> '${fullPath}'`);

        if (!fs.existsSync(fullPath)) {
            console.error(`[RunsAPI] File not found at: ${fullPath}`);
            return res.status(404).json({ error: "File not found" });
        }

        res.sendFile(fullPath);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// DELETE /api/runs?path=SubDir
// Deletes a file or directory
router.delete('/', (req, res) => {
    try {
        const relativePath = (req.query.path as string);
        if (!relativePath) return res.status(400).json({ error: "Path required" });

        const fullPath = resolveSafePath(relativePath);
        console.log(`[RunsAPI] Deleting: '${relativePath}' -> '${fullPath}'`);

        if (!fs.existsSync(fullPath)) {
            return res.status(404).json({ error: "Item not found" });
        }

        // Recursive delete for non-empty folders
        fs.rmSync(fullPath, { recursive: true, force: true });
        res.json({ success: true });
    } catch (error: any) {
        console.error("Runs API Delete Error:", error);
        res.status(500).json({ error: error.message });
    }
});

// POST /api/runs/rename
// Renames a file or directory
router.post('/rename', (req, res) => {
    try {
        const { path: oldPath, newName } = req.body;
        if (!oldPath || !newName) return res.status(400).json({ error: "Path and newName required" });

        const fullOldPath = resolveSafePath(oldPath);
        const parentDir = path.dirname(fullOldPath);
        const fullNewPath = path.join(parentDir, newName);

        console.log(`[RunsAPI] Renaming: '${fullOldPath}' -> '${fullNewPath}'`);

        if (!fs.existsSync(fullOldPath)) {
            return res.status(404).json({ error: "Item not found" });
        }

        if (fs.existsSync(fullNewPath)) {
            return res.status(409).json({ error: "Destination already exists" });
        }

        fs.renameSync(fullOldPath, fullNewPath);
        res.json({ success: true });
    } catch (error: any) {
        console.error("Runs API Rename Error:", error);
        res.status(500).json({ error: error.message });
    }
});

export const runsRouter = router;
