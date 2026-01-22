import cron, { ScheduledTask } from 'node-cron';
import { localProjectService } from '../persistence/LocalProjectService';
import { batchRunnerService } from './BatchRunnerService';
import { projectService } from '../persistence/ProjectService'; // For resolving Suites via Firestore/Service

interface Schedule {
    id: string;
    suite_id: string;
    cron_expression: string;
    user_id: string;
    project_id: string;
    name?: string;
    is_active: boolean;
}

export class SchedulerService {
    private tasks: Map<string, ScheduledTask> = new Map();

    constructor() {
    }

    async init() {
        console.log('[Scheduler] Initializing schedules...');
        try {
            // Load ALL active schedules from ALL projects
            const allSchedules = await localProjectService.getAllSchedulesSystem();

            console.log(`[Scheduler] 🤖 Found ${allSchedules.length} active schedules across all projects.`);

            for (const item of allSchedules) {
                console.log(`[Scheduler] Loading Schedule: ${item.schedule.name} (${item.schedule.cron_expression}) [ID: ${item.schedule.id}]`);
                // Determine suiteId from script_id? Legacy migration or strict?
                // The new format uses suite_id. If specific field missing, skip or warn.
                const s = item.schedule;
                const schedule: Schedule = {
                    id: s.id,
                    suite_id: s.suite_id || s.script_id, // Fallback if migrating
                    cron_expression: s.cron_expression,
                    user_id: s.user_id,
                    project_id: item.projectId,
                    is_active: s.is_active,
                    name: s.name
                };

                if (schedule.is_active) {
                    this.scheduleJob(schedule);
                }
            }
        } catch (e) {
            console.error('[Scheduler] Failed to load schedules:', e);
        }
    }

    private scheduleJob(schedule: Schedule) {
        // Stop existing if in-memory update
        if (this.tasks.has(schedule.id)) {
            this.tasks.get(schedule.id)?.stop();
        }

        if (!cron.validate(schedule.cron_expression)) {
            console.error(`[Scheduler] Invalid Cron: ${schedule.cron_expression} for ID ${schedule.id}`);
            return;
        }

        const task = cron.schedule(schedule.cron_expression, async () => {
            console.log(`[Scheduler] ⏰ Triggering scheduled suite: ${schedule.suite_id} (${schedule.name})`);
            try {
                // 1. Fetch Suite Details to get fileIds and Config
                // We need the Suite Service logic. Since we moved Suite logic to backend (SuiteService.ts or direct Firestore), 
                // we should use a Service. "SuiteService" was created in Phase 1. 
                // Let's assume we can read it from Project Data (Local).

                // We need to implement getSuite locally if not exposed.
                // Or use `projectService` which talks to Firestore/Local?
                // Let's use `localProjectService.readProjectData` mostly, but Suites are stored in `test_suites` collection in Firestore usually? 
                // Wait, Phase 1 implementation used Firestore "test_suites" subcollection.
                // LocalProjectService might NOT have them if they are only in Firestore.
                // Let's try to fetch suite from Firestore via `projectService` or `SuiteService` (if migrated/available).

                // Assuming `SuiteService` is available:
                // 1. Fetch Suite Details
                const { suiteService } = await import('../persistence/SuiteService');
                let fileIds: string[] = [];
                let config: any = {};

                const suite = await suiteService.getSuite(schedule.project_id, schedule.suite_id);

                if (suite) {
                    fileIds = suite.fileIds;
                    config = suite.config || {};
                } else {
                    // Fallback: Check if it's a single Script
                    const scriptData = await localProjectService.findScriptById(schedule.suite_id);
                    if (scriptData && scriptData.projectId === schedule.project_id) {
                        console.log(`[Scheduler] 📄 Resolved ID ${schedule.suite_id} as Single Script.`);
                        fileIds = [schedule.suite_id];
                        config = { name: schedule.name };
                    } else {
                        console.error(`[Scheduler] ❌ Suite/Script ${schedule.suite_id} not found. Skipping.`);
                        return;
                    }
                }

                // 2. Execute Batch
                config.triggeredBy = 'schedule';
                config.scheduleId = schedule.id;

                await batchRunnerService.executeBatch(schedule.project_id, fileIds, config);
                console.log(`[Scheduler] ✅ Scheduled Run Initiated: ${schedule.name}`);

            } catch (e) {
                console.error(`[Scheduler] ❌ Scheduled Run Failed: ${schedule.name}`, e);
            }
        });

        this.tasks.set(schedule.id, task);
        console.log(`[Scheduler] Scheduled ${schedule.name} (${schedule.cron_expression})`);
    }

    async createSchedule(projectId: string, userId: string, suiteId: string, cronExpression: string, name: string) {
        // Store locally (and eventually sync to Firestore if LocalProjectService handles it)
        const newSchedule = {
            suite_id: suiteId,
            cron_expression: cronExpression,
            user_id: userId,
            project_id: projectId,
            name: name,
            is_active: true
        };

        if (!cron.validate(cronExpression)) {
            throw new Error(`Invalid cron expression: ${cronExpression}`);
        }

        const created = await localProjectService.createSchedule(projectId, newSchedule, userId);

        // Normalize for runtime
        const runtimeSchedule: Schedule = {
            id: created.id,
            suite_id: created.suite_id,
            cron_expression: created.cron_expression,
            user_id: created.user_id,
            project_id: projectId,
            name: created.name,
            is_active: created.is_active
        };

        // Activate runtime
        this.scheduleJob(runtimeSchedule);

        // Return frontend-friendly format
        return {
            id: created.id,
            scriptId: created.suite_id,
            scriptName: created.name,
            cronExpression: created.cron_expression,
            isActive: created.is_active,
            createdAt: created.created_at || new Date().toISOString()
        };
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

    async listSchedules(projectId: string, userId: string) {
        const schedules = await localProjectService.getSchedules(projectId, userId);

        // Map to frontend format
        // Map to frontend format
        return schedules.map(s => {
            return {
                id: s.id,
                scriptId: s.suite_id || s.script_id, // Fallback for legacy
                scriptName: s.name || 'Untitled Schedule',
                cronExpression: s.cron_expression,
                isActive: s.is_active,
                createdAt: s.created_at
            };
        });
    }
}

export const schedulerService = new SchedulerService();


