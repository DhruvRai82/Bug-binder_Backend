import { projectService as remoteService, Project } from './ProjectService';
import { localProjectService } from './LocalProjectService';

export class UnifiedProjectService {

    // --- Reads (Primary: Remote/Supabase) ---

    async getAllProjects(userId: string): Promise<Project[]> {
        return remoteService.getAllProjects(userId);
    }

    async getProjectById(id: string, userId: string): Promise<Project | null> {
        return remoteService.getProjectById(id, userId);
    }

    async getProjectPages(projectId: string, userId: string): Promise<any[]> {
        return remoteService.getProjectPages(projectId, userId);
    }

    async getDailyData(projectId: string, userId: string, date?: string): Promise<any[]> {
        return remoteService.getDailyData(projectId, userId, date);
    }

    async exportBugs(projectId: string, date: string, userId: string): Promise<Buffer> {
        return remoteService.exportBugs(projectId, date, userId);
    }

    async exportTestCases(projectId: string, date: string, userId: string): Promise<Buffer> {
        return remoteService.exportTestCases(projectId, date, userId);
    }

    // --- Writes (Dual-Write: Remote + Local Backup) ---

    async createProject(name: string, description: string, userId: string): Promise<Project> {
        // 1. Create in Remote (Primary Source of Truth)
        const project = await remoteService.createProject(name, description, userId);

        // 2. Backup to Local (Best Effort)
        try {
            // We pass the ID from remote to ensure consistency
            await localProjectService.createProject(name, description, userId, project.id);
        } catch (error) {
            console.error('[Unified] Local backup failed for createProject:', error);
            // We do NOT throw here, as the primary operation succeeded
        }

        return project;
    }

    async updateProject(id: string, updates: Partial<Project>, userId: string): Promise<Project> {
        const project = await remoteService.updateProject(id, updates, userId);

        try {
            await localProjectService.updateProject(id, updates, userId);
        } catch (error) {
            console.error('[Unified] Local backup failed for updateProject:', error);
        }

        return project;
    }

    async deleteProject(id: string, userId: string): Promise<void> {
        await remoteService.deleteProject(id, userId);

        try {
            await localProjectService.deleteProject(id, userId);
        } catch (error) {
            console.error('[Unified] Local backup failed for deleteProject:', error);
        }
    }

    async createProjectPage(projectId: string, pageData: any, userId: string): Promise<any> {
        const page = await remoteService.createProjectPage(projectId, pageData, userId);

        try {
            // Pass the full 'page' object (which includes the new ID) as payload to local
            await localProjectService.createProjectPage(projectId, page, userId);
        } catch (error) {
            console.error('[Unified] Local backup failed for createProjectPage:', error);
        }

        return page;
    }

    async updateProjectPage(projectId: string, pageId: string, updates: any, userId: string): Promise<any> {
        const page = await remoteService.updateProjectPage(projectId, pageId, updates, userId);

        try {
            await localProjectService.updateProjectPage(projectId, pageId, updates, userId);
        } catch (error) {
            console.error('[Unified] Local backup failed for updateProjectPage:', error);
        }

        return page;
    }

    async deleteProjectPage(projectId: string, pageId: string, userId: string): Promise<void> {
        await remoteService.deleteProjectPage(projectId, pageId, userId);

        try {
            await localProjectService.deleteProjectPage(projectId, pageId, userId);
        } catch (error) {
            console.error('[Unified] Local backup failed for deleteProjectPage:', error);
        }
    }

    async createDailyData(projectId: string, dataPayload: any, userId: string): Promise<any> {
        const data = await remoteService.createDailyData(projectId, dataPayload, userId);

        try {
            // Pass the full 'data' object (which includes any DB-generated fields) as payload
            await localProjectService.createDailyData(projectId, data, userId);
        } catch (error) {
            console.error('[Unified] Local backup failed for createDailyData:', error);
        }

        return data;
    }

    async updateDailyData(projectId: string, date: string, updates: any, userId: string): Promise<any> {
        const data = await remoteService.updateDailyData(projectId, date, updates, userId);

        try {
            await localProjectService.updateDailyData(projectId, date, updates, userId);
        } catch (error) {
            console.error('[Unified] Local backup failed for updateDailyData:', error);
        }

        return data;
    }

    // --- Scripts (Dual-Write) ---

    async getScripts(projectId: string, userId: string): Promise<any[]> {
        return remoteService.getScripts(projectId, userId);
    }

    async getScript(projectId: string, scriptId: string, userId: string): Promise<any | null> {
        return remoteService.getScript(projectId, scriptId, userId);
    }

    async createScript(projectId: string, scriptData: any, userId: string): Promise<any> {
        const script = await remoteService.createScript(projectId, scriptData, userId);
        try {
            // Local backup with same ID
            await localProjectService.createScript(projectId, { ...scriptData, id: script.id }, userId);
        } catch (error) {
            console.error('[Unified] Local backup failed for createScript:', error);
        }
        return script;
    }

    async updateScript(projectId: string, scriptId: string, updates: any, userId: string): Promise<any> {
        const script = await remoteService.updateScript(projectId, scriptId, updates, userId);
        try {
            await localProjectService.updateScript(projectId, scriptId, updates, userId);
        } catch (error) {
            console.error('[Unified] Local backup failed for updateScript:', error);
        }
        return script;
    }

    async deleteScript(projectId: string, scriptId: string, userId: string): Promise<void> {
        await remoteService.deleteScript(projectId, scriptId, userId);
        try {
            await localProjectService.deleteScript(projectId, scriptId, userId);
        } catch (error) {
            console.error('[Unified] Local backup failed for deleteScript:', error);
        }
    }

    // --- Auto-Sync (Local -> Firestore) ---
    async syncUserProjects(userId: string) {
        console.log(`[Unified] Starting Auto-Sync for user: ${userId}`);
        try {
            const localProjects = await localProjectService.getAllProjects(userId);
            console.log(`[Unified] Found ${localProjects.length} local projects to sync.`);

            for (const localProj of localProjects) {
                // 1. Sync Project
                let remoteProj = await remoteService.getProjectById(localProj.id, userId);
                if (!remoteProj) {
                    console.log(`[Unified] Creating missing remote project: ${localProj.name}`);
                    // @ts-ignore
                    remoteProj = await remoteService.createProject(localProj.name, localProj.description, userId, localProj.id);
                }

                // 2. Sync Scripts
                const localScripts = await localProjectService.getScripts(localProj.id, userId);
                for (const script of localScripts) {
                    const remoteScript = await remoteService.getScript(localProj.id, script.id, userId);
                    if (!remoteScript) {
                        console.log(`[Unified] Syncing script: ${script.name}`);
                        await remoteService.createScript(localProj.id, script, userId);
                    }
                }

                // 3. Sync Test Runs
                const localRuns = await localProjectService.getTestRuns(localProj.id);
                for (const run of localRuns) {
                    const existingRun = await remoteService.getTestRun(localProj.id, run.id);
                    if (!existingRun) {
                        console.log(`[Unified] Syncing test run: ${run.id}`);
                        await remoteService.createTestRun(localProj.id, run);
                    }
                }

                // 4. Sync Schedules
                const localSchedules = await localProjectService.getSchedules(localProj.id, userId);
                for (const schedule of localSchedules) {
                    const remoteSchedules = await remoteService.getSchedules(localProj.id, userId);
                    if (!remoteSchedules.find(s => s.id === schedule.id)) {
                        console.log(`[Unified] Syncing schedule: ${schedule.id}`);
                        await remoteService.createSchedule(localProj.id, schedule, userId);
                    }
                }

                // 5. Sync Daily Data (Test Cases/Bugs)
                const localDaily = await localProjectService.getDailyData(localProj.id, userId);
                if (localDaily && Array.isArray(localDaily)) {
                    for (const day of localDaily) {
                        const existingDays = await remoteService.getDailyData(localProj.id, userId, day.date);
                        const exists = existingDays.find(d => d.id === day.id);
                        if (!exists) {
                            console.log(`[Unified] Syncing daily data for: ${day.date}`);
                            await remoteService.createDailyData(localProj.id, day, userId);
                        }
                    }
                }

                // 6. Sync Custom Pages
                const localPages = await localProjectService.getProjectPages(localProj.id, userId);
                if (localPages && Array.isArray(localPages)) {
                    for (const page of localPages) {
                        const existingPages = await remoteService.getProjectPages(localProj.id, userId);
                        const exists = existingPages.find(p => p.id === page.id);
                        if (!exists) {
                            console.log(`[Unified] Syncing page: ${page.name}`);
                            await remoteService.createProjectPage(localProj.id, page, userId);
                        }
                    }
                }
            }
            console.log('[Unified] Auto-Sync Complete');
        } catch (error) {
            console.error('[Unified] Auto-Sync Failed:', error);
        }
    }
}

export const unifiedProjectService = new UnifiedProjectService();
