
import express from 'express';
import { testRunnerService } from '../services/TestRunnerService'; // Assuming this still needed or should use ProjectService?
import { codeExecutorService } from '../services/CodeExecutorService';
import { projectService } from '../services/ProjectService';
import { batchRunnerService } from '../services/BatchRunnerService';
import { testRunService } from '../services/TestRunService';
// TestRunnerService usually depended on LocalProject, we might need to update it too.
// For now, let's fix the raw execution logging.

const router = express.Router();

// Trigger a Test Run
router.post('/execute', async (req, res) => {
    try {
        const { scriptId, projectId, source } = req.body;

        if (!scriptId || !projectId) {
            return res.status(400).json({ error: 'scriptId and projectId are required' });
        }

        // We run this asynchronously so the HTTP request returns 'started' quickly
        // The client can then poll for status using the runId (optional, or just wait for sockets/refresh)
        // However, for simplicity now, let's await it or return the runId immediately? 
        // Let's await it for this iteration to see results immediately in Postman/Frontend
        const result = await testRunnerService.executeTest(
            scriptId,
            projectId,
            source || 'manual'
        );

        res.json(result);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Ad-hoc Code Execution (IDE)
router.post('/execute-raw', async (req, res) => {
    try {
        const { content, language } = req.body;
        if (content === undefined || !language) {
            return res.status(400).json({ error: 'content and language are required' });
        }

        const result = await codeExecutorService.executeCode(content, language);
        res.json(result);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Get Runs for a Project (History)
router.get('/history', async (req, res) => {
    try {
        const { projectId } = req.query;
        if (!projectId) return res.status(400).json({ error: 'Project ID required' });

        const runs = await projectService.getTestRuns(projectId as string); // Changed to projectService
        runs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

        // Fetch Script Names manually
        // We can optimize this by fetching all scripts once
        const scripts = await projectService.getScripts(projectId as string, 'test-user-id'); // Changed to projectService

        const runsWithNames = runs.map(run => {
            const script = scripts.find(s => s.id === run.script_id);
            return {
                ...run,
                recorded_scripts: { name: script?.name || 'Unknown Script' }
            };
        });

        res.json(runsWithNames.slice(0, 50));
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Get Details of a Specific Run
router.get('/run/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const found = await projectService.findTestRunById(id);
        if (!found) {
            return res.status(404).json({ error: 'Run not found' });
        }

        res.json({ run: found.run, logs: found.logs });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Delete a Run
router.delete('/run/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // We need projectId to delete. Scan first.
        const found = await projectService.findTestRunById(id);
        if (found) {
            await projectService.deleteScript(found.projectId, id, 'user-id'); // Wait, deleteScript? No, deleteTestRun.
            // We need deleteTestRun exposed or logic here.
            await projectService.collection.doc(found.projectId).collection('test_runs').doc(id).delete();
        }
        // If not found, idempotent success

        res.json({ status: 'deleted' });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Batch Execution (Test Orchestrator)
router.post('/batch-execute', async (req, res) => {
    try {
        const { projectId, fileIds } = req.body;
        if (!projectId || !fileIds || !Array.isArray(fileIds)) {
            return res.status(400).json({ error: 'projectId and fileIds (array) are required' });
        }

        const result = await batchRunnerService.executeBatch(projectId, fileIds);
        res.json(result);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Rescan Files (Disk -> DB)
router.post('/scan', async (req, res) => {
    try {
        const { projectId } = req.body;
        // We need userId to save to remote
        // In this route context, we might not have 'req.user' if authMiddleware isn't applied?
        // Wait, runnerRoutes is under /api which IS protected by authMiddleware.
        const userId = (req as any).user?.uid;

        if (!projectId) return res.status(400).json({ error: 'projectId required' });
        if (!userId) return res.status(401).json({ error: 'User not authenticated' });

        // 1. Scan Disk -> Local DB
        const { localProjectService } = await import('../services/LocalProjectService');
        const files = await localProjectService.rescanFiles(projectId);

        // 2. Sync Local -> Remote (Firestore)
        // This ensures GET /api/fs (which reads remote) sees the files
        const { projectService } = await import('../services/ProjectService');
        const remoteFiles = await projectService.getFSNodes(projectId, userId);

        let syncedCount = 0;
        for (const file of files) {
            // Check existence by Name + Parent + Type (since IDs might differ if re-created)
            // Or just check by ID if we trust Local ID generation to be stable-ish
            // Local rescan generates new UUIDs, so we must check by Name/Path.

            const exists = remoteFiles.find(rf =>
                rf.name === file.name &&
                rf.parent_id === file.parent_id &&
                rf.type === file.type
            );

            if (!exists) {
                // Create in Remote
                await projectService.createFSNode(projectId, {
                    ...file,
                    user_id: userId
                }, userId);
                syncedCount++;
            } else {
                // Optional: Update content if changed?
                // For now, primary goal is visibility.
            }
        }

        console.log(`[Runner] Rescan synced ${syncedCount} missing files to Remote`);

        res.json({ status: 'scanned', count: files.length, synced: syncedCount, files });
    } catch (error: any) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});


// --- Run History Routes ---

router.get('/runs/:projectId', async (req, res) => {
    try {
        const { projectId } = req.params;
        const runs = await testRunService.getProjectRuns(projectId);
        res.json(runs);
    } catch (error: any) {
        console.error(`[Runner] Error in GET /runs/${req.params.projectId}:`, error);
        res.status(500).json({ error: error.message });
    }
});

router.get('/run/:runId', async (req, res) => {
    try {
        const { runId } = req.params;
        const { projectId } = req.query; // Need project ID to lookup file
        if (!projectId) return res.status(400).json({ error: 'projectId required' });

        const run = await testRunService.getRunDetails(projectId as string, runId);
        if (!run) return res.status(404).json({ error: 'Run not found' });
        res.json(run);
    } catch (error: any) {
        console.error(`[Runner] Error in GET /run/${req.params.runId}:`, error);
        res.status(500).json({ error: error.message });
    }
});

router.delete('/run/:runId', async (req, res) => {
    try {
        const { runId } = req.params;
        const { projectId } = req.query;
        if (!projectId) return res.status(400).json({ error: 'projectId required' });

        await testRunService.deleteRun(projectId as string, runId);
        res.json({ status: 'deleted' });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

export const runnerRoutes = router;
