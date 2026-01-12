
import express from 'express';
import { schedulerService } from '../../services/execution/SchedulerService';

const router = express.Router();

// Get Schedules (Scoped by Project)
router.get('/', async (req, res) => {
    try {
        const { projectId } = req.query;
        // User is attached by auth middleware (assuming it's there)
        const userId = (req as any).user?.uid || 'anonymous'; // Fallback for local

        if (!projectId) {
            return res.status(400).json({ error: 'projectId is required' });
        }

        const schedules = await schedulerService.listSchedules(projectId as string, userId);
        res.json(schedules);
    } catch (error: any) {
        console.error('[Scheduler API] Error fetching schedules:', error);
        res.status(500).json({ error: error.message });
    }
});

// Create Schedule
router.post('/', async (req, res) => {
    try {
        const { projectId, suiteId, cronExpression, name } = req.body;
        const userId = (req as any).user?.uid || 'anonymous';

        if (!projectId || !suiteId || !cronExpression || !name) {
            return res.status(400).json({ error: 'Missing required fields: projectId, suiteId, cronExpression, name' });
        }

        const schedule = await schedulerService.createSchedule(projectId, userId, suiteId, cronExpression, name);
        res.status(201).json(schedule);
    } catch (error: any) {
        console.error('[Scheduler API] Error creating schedule:', error);
        res.status(500).json({ error: error.message });
    }
});

// Delete Schedule
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await schedulerService.deleteSchedule(id);
        res.json({ status: 'deleted' });
    } catch (error: any) {
        console.error('[Scheduler API] Error deleting schedule:', error);
        res.status(500).json({ error: error.message });
    }
});

export const schedulerRouter = router;
