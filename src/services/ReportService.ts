// import { supabase } from '../lib/supabase';
import { localProjectService } from './LocalProjectService';

export interface ExecutionReport {
    id: string;
    projectId: string;
    scriptId?: string;
    scriptName: string;
    module?: string;
    status: 'pass' | 'fail';
    startTime: string;
    endTime: string;
    duration: number; // in milliseconds
    error?: string;
    stepsCompleted: number;
    totalSteps: number;
    userId?: string;
    logs?: string;
}

export class ReportService {
    async addReport(report: Omit<ExecutionReport, 'id'>) {
        // Just store as camelCase for JSON
        const newReport = {
            ...report,
            id: Date.now().toString(),
            // Ensure types match what we want
            project_id: report.projectId, // Keep for legacy compatibility if needed, or migration
            script_id: report.scriptId,
            script_name: report.scriptName,
            user_id: report.userId,

            // Allow camelCase storage primarily
            projectId: report.projectId,
            scriptId: report.scriptId,
            scriptName: report.scriptName,
            module: report.module,
            status: report.status,
            startTime: report.startTime,
            endTime: report.endTime,
            duration: report.duration,
            error: report.error,
            stepsCompleted: report.stepsCompleted,
            totalSteps: report.totalSteps,
            userId: report.userId,
            logs: report.logs
        };

        // We require projectId for LocalProjectService
        if (!report.projectId) throw new Error("ProjectId required for Local Report Storage");

        try {
            return await localProjectService.addReport(report.projectId, newReport, report.userId || '');
        } catch (e) {
            console.error("Failed to add report locally:", e);
            throw e;
        }
    }

    async getReports(projectId?: string, userId?: string) {
        if (projectId) {
            const reports = await localProjectService.getReports(projectId, userId || '');
            // Filter by user if needed? LocalProjectService is file-based, maybe permissions matter later.
            if (userId) {
                return reports.filter((r: any) => r.userId === userId || r.user_id === userId);
            }
            return reports;
        } else {
            // Scan all projects
            const projects = await localProjectService.getAllProjects(userId || '');
            let allReports: any[] = [];
            for (const p of projects) {
                const reports = await localProjectService.getReports(p.id, userId || '');
                allReports = [...allReports, ...reports];
            }
            // Sort by startTime desc
            return allReports.sort((a, b) => new Date(b.startTime || b.start_time).getTime() - new Date(a.startTime || a.start_time).getTime());
        }
    }

    async deleteReport(id: string, userId?: string) {
        // Need ProjectID. Scan all projects to find it.
        const projects = await localProjectService.getAllProjects(userId || '');
        for (const p of projects) {
            const reports = await localProjectService.getReports(p.id, userId || '');
            if (reports.find((r: any) => r.id === id)) {
                await localProjectService.deleteReport(p.id, id, userId || '');
                return { status: 'deleted' };
            }
        }
        console.warn('Report not found for deletion:', id);
        return { status: 'not_found' };
    }
}

export const reportService = new ReportService();


