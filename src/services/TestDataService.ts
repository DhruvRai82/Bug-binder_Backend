// import { supabase } from '../lib/supabase';
import { localProjectService } from './LocalProjectService';

export interface Dataset {
    id: string;
    project_id: string;
    name: string;
    data_type: 'csv' | 'json';
    content: string;
    created_at: string;
    // Helper fields for UI (not in DB directly but derived)
    rowCount?: number;
    headers?: string[];
}

export class TestDataService {

    async listDatasets(projectId: string): Promise<Dataset[]> {
        try {
            const data = await localProjectService.getDatasets(projectId);
            // Sort by created_at desc
            data.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

            // Enrichment will use empty row counts since content is missing (OR we define if we include content)
            // LocalProjectService returns everything including content.
            // We should strip content if it's too big, but for local it's fine.
            return data.map((d: any) => this.enrichMetadata(d));
        } catch (error: any) {
            throw new Error(error.message);
        }
    }

    async saveDataset(name: string, content: string, type: 'csv' | 'json', projectId: string = 'default-project'): Promise<Dataset> {
        // Basic validation
        if (type === 'json') {
            try { JSON.parse(content); } catch (e) { throw new Error("Invalid JSON content"); }
        }

        const newDataset = {
            name,
            content,
            data_type: type,
            project_id: projectId
        };

        const saved = await localProjectService.saveDataset(projectId, newDataset);
        return this.enrichMetadata(saved);
    }

    async getData(id: string, projectId: string = ''): Promise<any[]> {
        // We need projectId to look it up in local service.
        // If not provided in args (breaking change?), we might have to scan?
        // Method signature of original `getData(id: string)`:
        // It didn't take projectId. This is a problem for `LocalProjectService` which needs projectId to find the file.
        // But since we store datasets INSIDE project data files, we MUST know the project.

        // HACK: If we don't have projectId, we might fail.
        // But wait, the Frontend calling this usually knows the context?
        // Let's UPDATE the signature to require projectId, or optional.

        // If we can't change signature easily (routes might rely on it), we are stuck.
        // Route `GET /api/test-data/:id` usually doesn't send project ID.
        // We might need to change the route to `/api/projects/:projectId/datasets/:id` OR
        // scan all projects to find the dataset ID.

        // Let's attempt scan if no projectId provided.
        // Since we are moving to fully local, let's just scan all projects if needed.
        // But `getData` implementation here:

        let dataset: any = null;
        if (projectId) {
            const datasets = await localProjectService.getDatasets(projectId);
            dataset = datasets.find((d: any) => d.id === id);
        } else {
            // Scan all projects
            // We need a userId to scan all projects... 'test-user-id' default?
            // This is getting messy.
            // Ideally we pass projectId from the controller.
            // I will assume for now we can scan or the controller updates.

            // Let's just Throw if not found for now, or try to find it.
            // The calling code (API route) likely has projectId in query or params?
            // Let's update this file to accept `projectId` even if original didn't, optional.
            // But callsites need to update.

            // For now, I will add `projectId` as optional 2nd arg.

            // Fallback: Scan known projects?
            const projects = await localProjectService.getAllProjects('test-user-id'); // Hack
            for (const p of projects) {
                const ds = await localProjectService.getDatasets(p.id);
                const found = ds.find((d: any) => d.id === id);
                if (found) {
                    dataset = found;
                    break;
                }
            }
        }

        if (!dataset) throw new Error('Dataset not found');

        if (dataset.data_type === 'json') {
            return JSON.parse(dataset.content);
        } else {
            // Lazy import csv-parse
            const { parse } = require('csv-parse/sync');
            return parse(dataset.content, { columns: true, skip_empty_lines: true });
        }
    }

    async deleteDataset(id: string, projectId: string = ''): Promise<void> {
        // Same issue with projectId.
        if (projectId) {
            await localProjectService.deleteDataset(projectId, id);
        } else {
            // Scan
            const projects = await localProjectService.getAllProjects('test-user-id');
            for (const p of projects) {
                await localProjectService.deleteDataset(p.id, id);
            }
        }
    }

    // Helper to add row count/headers for UI preview without saving them to DB redundant
    private enrichMetadata(dataset: any): Dataset {
        let rowCount = 0;
        let headers: string[] = [];

        try {
            if (!dataset.content) {
                // Content not valid or not fetched
                return {
                    ...dataset,
                    rowCount: 0,
                    headers: []
                };
            }

            if (dataset.data_type === 'json') {
                const json = JSON.parse(dataset.content);
                if (Array.isArray(json)) {
                    rowCount = json.length;
                    headers = json.length > 0 ? Object.keys(json[0]) : [];
                }
            } else {
                // Simple estimation for CSV to avoid full parsing on list
                const lines = dataset.content.split('\n').filter((l: string) => l.trim().length > 0);
                rowCount = Math.max(0, lines.length - 1);
                headers = lines.length > 0 ? lines[0].split(',') : [];
            }
        } catch (e) {
            console.warn(`Failed to parse metadata for dataset ${dataset.id}`);
        }

        return {
            ...dataset,
            rowCount,
            headers,
            // Don't send full content in list view if it's huge? 
            // For now, we are sending it. If huge, we should strip it in 'listDatasets' select.
        };
    }
}

export const testDataService = new TestDataService();
