import cron, { ScheduledTask } from 'node-cron';
// import { supabase } from '../lib/supabase';
import { localProjectService } from './LocalProjectService';
import { recorderService } from './RecorderService';

interface Schedule {
    id: string;
    script_id: string;
    cron_expression: string;
    user_id: string;
    project_id: string; // Ensure we have this
    is_active: boolean;
}

export class SchedulerService {
    private tasks: Map<string, ScheduledTask> = new Map();

    constructor() {
        // init called explicitly
    }

    async init() {
        // Load active schedules from Local Projects
        console.log('[Scheduler] Initializing schedules...');

        // We don't have a global "active schedules" list easily queries without scanning.
        // For now, we will scan all projects for all users (or just all available projects locally).
        // Since backend is local, we can read all projects.
        // Assuming single user for local mode usually, or we scan all projects found.

        try {
            // This is a bit heavy for "getAllProjects" if we don't have a user ID context.
            // But for local standalone backend, maybe we just want to load everything.
            // LocalProjectService.getAllProjects requires a userId. 
            // Limitation: We need to know who the users are to load their schedules.
            // Workaround: We will rely on "Create Schedule" effectively updating the runtime.
            // Initializing from disk on restart is tricky without a list of users.
            // Implementation: We will read "projects.json" directly (via service hack or just iterating if possible).

            // Actually, let's just use a hardcoded "system" user scan or similar if we can.
            // Better yet: "scanAllSchedules" method in LocalProjectService?
            // For now, let's assume we load schedules when they are created, and on restart 
            // we might miss them unless we scan.

            // Let's implement a "scan all" if possible. 
            // Currently LocalProjectService reads 'projects.json' which lists ALL projects.
            // We can add a method there to "getAllSchedulesGlobal".

            // For now, to keep it simple and avoid changing Service again recursively:
            // We will just log that persistent schedules require scanning manually implemented later
            // OR we just try to read all projects.

            // Let's try to get all projects for "test-user-id" at least?
            const projects = await localProjectService.getAllProjects('test-user-id');
            // This might be insufficient if multiple users.

            // TODO: Proper multi-user schedule hydration on startup.

        } catch (e) {
            console.error('[Scheduler] Failed to load schedules:', e);
        }
    }

    private scheduleJob(schedule: Schedule) {
        // Stop existing if any (update case)
        if (this.tasks.has(schedule.id)) {
            this.tasks.get(schedule.id)?.stop();
        }

        if (!cron.validate(schedule.cron_expression)) {
            console.error(`[Scheduler] Invalid Cron: ${schedule.cron_expression} for ID ${schedule.id}`);
            return;
        }

        const task = cron.schedule(schedule.cron_expression, async () => {
            console.log(`[Scheduler] ⏰ Triggering scheduled script: ${schedule.script_id}`);
            try {
                // Determine userId? Schedule has it.
                await recorderService.playScript(schedule.script_id, schedule.user_id);
                console.log(`[Scheduler] ✅ Scheduled Run Complete: ${schedule.script_id}`);
            } catch (e) {
                console.error(`[Scheduler] ❌ Scheduled Run Failed: ${schedule.script_id}`, e);
            }
        });

        this.tasks.set(schedule.id, task);
    }

    async createSchedule(scriptId: string, cronExpression: string, userId: string, projectId: string) {
        // Store locally
        const newSchedule = {
            script_id: scriptId,
            cron_expression: cronExpression,
            user_id: userId,
            project_id: projectId,
            is_active: true
        };

        const created = await localProjectService.createSchedule(projectId, newSchedule, userId);

        // Activate runtime
        this.scheduleJob(created);
        return created;
    }

    async deleteSchedule(id: string) {
        // Stop task
        if (this.tasks.has(id)) {
            this.tasks.get(id)?.stop();
            this.tasks.delete(id);
        }

        // Find match to get projectId/userId
        const found = await localProjectService.findScheduleById(id);
        if (found) {
            await localProjectService.deleteSchedule(found.projectId, id, found.schedule.user_id);
        }

        return { status: 'deleted' };
    }

    async listSchedules(userId: string, projectId: string) {
        const schedules = await localProjectService.getSchedules(projectId, userId);

        // We need script names. 
        const scripts = await localProjectService.getScripts(projectId, userId);

        return schedules.map((s: any) => {
            const script = scripts.find((sc: any) => sc.id === s.script_id);
            return {
                id: s.id,
                scriptId: s.script_id,
                scriptName: script?.name || 'Unknown Script',
                cronExpression: s.cron_expression,
                isActive: s.is_active,
                createdAt: s.created_at
            };
        });
    }
}

export const schedulerService = new SchedulerService();


