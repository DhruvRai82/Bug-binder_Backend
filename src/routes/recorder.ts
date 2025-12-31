import express from 'express';
import { recorderService } from '../services/RecorderService';

export const recorderRoutes = express.Router();

recorderRoutes.post('/start', async (req, res) => {
    try {
        const { url } = req.body;
        await recorderService.startRecording(url);
        res.json({ status: 'started' });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

recorderRoutes.post('/stop', async (req, res) => {
    try {
        const steps = await recorderService.stopRecording();
        res.json({ status: 'stopped', steps });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

recorderRoutes.post('/save', async (req, res) => {
    try {
        const script = await recorderService.saveScript(req.body);
        res.json(script);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

recorderRoutes.get('/list', async (req, res) => {
    try {
        const { projectId } = req.query;
        const scripts = await recorderService.getScripts(projectId as string);
        res.json(scripts);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Alias for frontend compatibility (VisualTests.tsx calls /scripts)
recorderRoutes.get('/scripts', async (req, res) => {
    try {
        const { projectId } = req.query;
        const scripts = await recorderService.getScripts(projectId as string);
        res.json(scripts);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

recorderRoutes.post('/play', async (req, res) => {
    try {
        const { scriptId } = req.body;
        const result = await recorderService.playScript(scriptId);
        res.json(result);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

recorderRoutes.get('/reports', async (req, res) => {
    try {
        const { projectId } = req.query;
        const reports = await recorderService.getReports(projectId as string);
        res.json(reports);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

recorderRoutes.delete('/reports/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await recorderService.deleteReport(id);
        res.json({ status: 'deleted' });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

recorderRoutes.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await recorderService.deleteScript(id);
        res.json({ status: 'deleted' });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

recorderRoutes.get('/export/:id/:format', async (req, res) => {
    try {
        const { id, format } = req.params;
        const result = await recorderService.exportScript(id, format as 'side' | 'java' | 'python');

        if (format === 'side') {
            res.header('Content-Type', 'application/json');
            res.attachment(`${id}.side`);
            res.send(JSON.stringify(result, null, 2));
        } else {
            res.header('Content-Type', 'text/plain');
            res.attachment(`${id}.${format === 'python' ? 'py' : 'java'}`);
            res.send(result);
        }
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});
