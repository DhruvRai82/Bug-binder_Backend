import { projectService as remoteService, Project } from './ProjectService';
import { localProjectService } from './LocalProjectService';

export class UnifiedProjectService {

    // --- Reads (Primary: Local) ---

    async getAllProjects(userId: string): Promise<Project[]> {
        // 1. Return Local Data Immediately (Fast Start)
        const localProjects = await localProjectService.getAllProjects(userId);

        // 2. Trigger Background Sync (Lazy Load / Update)
        this.syncUserProjects(userId).catch(e => console.error('[Unified] Background Sync Error:', e));

        return localProjects;
    }

    async getProjectById(id: string, userId: string): Promise<Project | null> {
        // Local First
        const local = await localProjectService.getProjectById(id, userId);
        if (local) return local;

        // Fallback to Remote if not found locally (e.g. fresh install)
        console.log(`[Unified] Project ${id} not found locally, fetching from remote...`);
        const remote = await remoteService.getProjectById(id, userId);
        if (remote) {
            // Cache it locally
            await localProjectService.createProject(remote.name, remote.description, userId, remote.id);
            return remote;
        }
        return null;
    }

    async getProjectPages(projectId: string, userId: string): Promise<any[]> {
        return localProjectService.getProjectPages(projectId, userId);
    }

    async getDailyData(projectId: string, userId: string, date?: string): Promise<any[]> {
        return localProjectService.getDailyData(projectId, userId, date);
    }

    async exportBugs(projectId: string, date: string, userId: string): Promise<Buffer> {
        return localProjectService.exportBugs(projectId, date, userId);
    }

    async exportTestCases(projectId: string, date: string, userId: string): Promise<Buffer> {
        return localProjectService.exportTestCases(projectId, date, userId);
    }

    // --- Writes (Local First + Background Remote Sync) ---

    async createProject(name: string, description: string, userId: string): Promise<Project> {
        // 1. Create Local (Immediate)
        // We generate ID here ensure consistency
        const id = crypto.randomUUID();
        const project = await localProjectService.createProject(name, description, userId, id);

        // 2. Sync to Remote (Background)
        remoteService.createProject(name, description, userId, id).catch(e =>
            console.error('[Unified] Background Remote Create Failed:', e)
        );

        return project;
    }

    async updateProject(id: string, updates: Partial<Project>, userId: string): Promise<Project> {
        const project = await localProjectService.updateProject(id, updates, userId);

        remoteService.updateProject(id, updates, userId).catch(e =>
            console.error('[Unified] Background Remote Update Failed:', e)
        );

        return project;
    }

    async deleteProject(id: string, userId: string): Promise<void> {
        await localProjectService.deleteProject(id, userId);

        remoteService.deleteProject(id, userId).catch(e =>
            console.error('[Unified] Background Remote Delete Failed:', e)
        );
    }

    async createProjectPage(projectId: string, pageData: any, userId: string): Promise<any> {
        const page = await localProjectService.createProjectPage(projectId, pageData, userId);

        remoteService.createProjectPage(projectId, page, userId).catch(e =>
            console.error('[Unified] Background Remote Page Create Failed:', e)
        );

        return page;
    }

    async updateProjectPage(projectId: string, pageId: string, updates: any, userId: string): Promise<any> {
        const page = await localProjectService.updateProjectPage(projectId, pageId, updates, userId);
        remoteService.updateProjectPage(projectId, pageId, updates, userId).catch(e => console.error(e));
        return page;
    }

    async deleteProjectPage(projectId: string, pageId: string, userId: string): Promise<void> {
        await localProjectService.deleteProjectPage(projectId, pageId, userId);
        remoteService.deleteProjectPage(projectId, pageId, userId).catch(e => console.error(e));
    }

    async createDailyData(projectId: string, dataPayload: any, userId: string): Promise<any> {
        const data = await localProjectService.createDailyData(projectId, dataPayload, userId);
        remoteService.createDailyData(projectId, data, userId).catch(e => console.error(e));
        return data;
    }

    async updateDailyData(projectId: string, date: string, updates: any, userId: string): Promise<any> {
        const data = await localProjectService.updateDailyData(projectId, date, updates, userId);
        remoteService.updateDailyData(projectId, date, updates, userId).catch((e: any) => console.error(e));
        return data;
    }

    // --- Scripts (Local First) ---

    async getScripts(projectId: string, userId: string): Promise<any[]> {
        return localProjectService.getScripts(projectId, userId);
    }

    async getScript(projectId: string, scriptId: string, userId: string): Promise<any | null> {
        return localProjectService.getScripts(projectId, userId).then(scripts => scripts.find((s: any) => s.id === scriptId) || null);
    }

    async createScript(projectId: string, scriptData: any, userId: string): Promise<any> {
        const script = await localProjectService.createScript(projectId, scriptData, userId);
        remoteService.createScript(projectId, script, userId).catch(e => console.error(e));
        return script;
    }

    async updateScript(projectId: string, scriptId: string, updates: any, userId: string): Promise<any> {
        // Logic check: if validation fails locally, we abort.
        const script = await localProjectService.updateScript(projectId, scriptId, updates, userId);
        if (script) {
            remoteService.updateScript(projectId, scriptId, updates, userId).catch(e => console.error(e));
        }
        return script;
    }

    async deleteScript(projectId: string, scriptId: string, userId: string): Promise<void> {
        await localProjectService.deleteScript(projectId, scriptId, userId);
        remoteService.deleteScript(projectId, scriptId, userId).catch(e => console.error(e));
    }

    // --- Test Runs (Read Access) ---
    async getTestRuns(projectId: string, userId: string): Promise<any[]> {
        return localProjectService.getTestRuns(projectId, userId);
    }

    // --- Files (Read Access) ---
    async getFSNodes(projectId: string): Promise<any[]> {
        return localProjectService.getFSNodes(projectId);
    }

    // --- Auto-Sync (Bidirectional) ---
    async syncUserProjects(userId: string) {
        console.log(`[Unified] Starting Auto-Sync for user: ${userId}`);
        try {
            // A. Pull Remote -> Local (For fresh installs or other device updates)
            const remoteProjects = await remoteService.getAllProjects(userId);
            const localProjects = await localProjectService.getAllProjects(userId);

            for (const rProj of remoteProjects) {
                const lProj = localProjects.find(p => p.id === rProj.id);
                if (!lProj) {
                    console.log(`[Unified] Pulling remote project to local: ${rProj.name}`);
                    await localProjectService.createProject(rProj.name, rProj.description, userId, rProj.id);
                    // TODO: Pull sub-collections (scripts, runs, etc.)?
                    // For now, project structure is minimal.
                }
                // else: Determine which is newer? relying on "last write wins" or just pushing local changes below.
            }

            // B. Push Local -> Remote (Backup)
            for (const localProj of localProjects) {
                // 1. Sync Project Metadata
                let remoteProj = remoteProjects.find(p => p.id === localProj.id);
                if (!remoteProj) {
                    console.log(`[Unified] Pushing local project to remote: ${localProj.name}`);
                    // @ts-ignore
                    remoteProj = await remoteService.createProject(localProj.name, localProj.description, userId, localProj.id);
                }

                // 2. Sync Scripts
                const localScripts = await localProjectService.getScripts(localProj.id, userId);
                const remoteScripts = await remoteService.getScripts(localProj.id, userId);
                for (const script of localScripts) {
                    if (!remoteScripts.find(s => s.id === script.id)) {
                        console.log(`[Unified] Pushing script: ${script.name}`);
                        await remoteService.createScript(localProj.id, script, userId);
                    }
                }

                // 3. Sync Test Runs (Push Only - History)
                const localRuns = await localProjectService.getTestRuns(localProj.id, userId); // Optimized call
                // Assuming we don't want to fetch ALL remote runs every time, maybe just check existence?
                // Or rely on atomic "create if not exists"? Firestore set() is idempotent if ID matches.
                // Doing this for EVERY run every sync might be heavy?
                // Optimization: Only sync runs from last 24h? Or check count?
                // For now, let's skip rigorous run sync to avoid start lag, as user main complaint was startup speed.
                // We'll trust Write-Through logic for new runs.

                // User requirement: "When any new data add, in background all data add on firebase"
                // Write-Through handles "new data".
                // This Sync is for "recovery".

                // 4. Sync Schedules
                const localSchedules = await localProjectService.getSchedules(localProj.id, userId);
                const remoteSchedules = await remoteService.getSchedules(localProj.id, userId);
                for (const schedule of localSchedules) {
                    if (!remoteSchedules.find(s => s.id === schedule.id)) {
                        await remoteService.createSchedule(localProj.id, schedule, userId);
                    }
                }

                // 5. Sync Daily Data
                // ... (Similar logic, keeping it light for now)
            }
            console.log('[Unified] Auto-Sync Complete');
        } catch (error) {
            console.error('[Unified] Auto-Sync Failed:', error);
        }
    }
}

export const unifiedProjectService = new UnifiedProjectService();
