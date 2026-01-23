
import { v4 as uuidv4 } from 'uuid';
import { localProjectService } from './LocalProjectService';

export interface TestRun {
    id: string;
    projectId: string;
    status: 'running' | 'completed' | 'failed';
    source: 'manual' | 'scheduler' | 'orchestrator' | 'recorder'; // NEW: Source of Truth
    startTime: string;
    endTime?: string;
    triggeredBy: string;
    files: string[];
    results: TestResult[];
    logs: LogEntry[]; // Strict Typing
    meta?: any; // Browser info, platform, etc.
}

export interface LogEntry {
    timestamp: string;
    level: 'info' | 'warn' | 'error' | 'debug';
    message: string;
    metadata?: any;
}

export interface TestResult {
    file: string;
    status: 'passed' | 'failed' | 'skipped';
    duration?: number;
    error?: string;
    logs?: string[];
}

class TestRunService {
    // In-memory buffer for active runs
    private logBuffers: Map<string, any[]> = new Map();
    private flushQueues: Map<string, Promise<void>> = new Map();

    async createRun(projectId: string, fileIds: string[], source: TestRun['source'] = 'manual', triggeredBy = 'user'): Promise<string> {
        const runId = uuidv4();
        const newRun: TestRun = {
            id: runId,
            projectId,
            status: 'running',
            source,
            startTime: new Date().toISOString(),
            triggeredBy,
            files: fileIds,
            results: [],
            logs: []
        };

        // Initialize empty buffer and queue
        this.logBuffers.set(runId, []);
        this.flushQueues.set(runId, Promise.resolve());

        const data: any = await localProjectService.readProjectData(projectId);
        if (!data.testRuns) data.testRuns = [];
        data.testRuns.unshift(newRun); // Add to top

        // Keep only last 100 runs (increased size)
        if (data.testRuns.length > 100) data.testRuns = data.testRuns.slice(0, 100);

        await localProjectService.writeProjectData(projectId, data);
        return runId;
    }

    async updateRun(runId: string, projectId: string, updates: Partial<TestRun>) {
        // Apply any buffered logs before updating status
        await this.flushLogs(runId, projectId);
        // Ensure all pending logs are flushed
        await this.flushQueues.get(runId);

        await this._updateRun(projectId, runId, (run) => {
            Object.assign(run, { ...updates, endTime: updates.status === 'completed' || updates.status === 'failed' ? new Date().toISOString() : undefined });
        });

        if (updates.status === 'completed' || updates.status === 'failed') {
            this.logBuffers.delete(runId);
            this.flushQueues.delete(runId);
        }
    }

    // ... (Helper _updateRun remains same)

    private async _updateRun(projectId: string, runId: string, updater: (run: TestRun) => void) {
        await localProjectService.updateProjectData(projectId, (data) => {
            const run = data.testRuns?.find((r: TestRun) => r.id === runId);
            if (run) {
                updater(run);
            }
        });
    }

    async appendLog(runId: string, projectId: string, message: string, level: 'info' | 'warn' | 'error' = 'info') {
        const entry: LogEntry = {
            timestamp: new Date().toISOString(),
            level,
            message
        };

        if (!this.logBuffers.has(runId)) {
            this.logBuffers.set(runId, []);
        }
        this.logBuffers.get(runId)?.push(entry);

        const previousFlush = this.flushQueues.get(runId) || Promise.resolve();
        const currentFlush = previousFlush.then(() => this.flushLogs(runId, projectId));

        this.flushQueues.set(runId, currentFlush);
        return currentFlush;
    }

    private async flushLogs(runId: string, projectId: string) {
        const buffer = this.logBuffers.get(runId);
        if (!buffer || buffer.length === 0) return;

        const logsToWrite = [...buffer];
        this.logBuffers.set(runId, []);

        try {
            await this._updateRun(projectId, runId, (run) => {
                if (!run.logs) run.logs = [];
                // Ensure legacy logs don't break strict typing if they exist, but we append new valid ones
                run.logs.push(...logsToWrite);
            });
        } catch (error) {
            console.error(`Failed to flush logs for run ${runId}:`, error);
        }
    }

    async getProjectRuns(projectId: string, filterSource?: string): Promise<TestRun[]> {
        const data = await localProjectService.readProjectData(projectId);
        let runs = data.testRuns || [];

        if (filterSource) {
            runs = runs.filter((r: TestRun) => r.source === filterSource);
        }
        return runs;
    }

    async getRunDetails(projectId: string, runId: string): Promise<TestRun | null> {
        try {
            const data: any = await localProjectService.readProjectData(projectId);

            if (!data) return null;

            const run = data.testRuns?.find((r: TestRun) => r.id === runId);

            if (run) {
                const persistentLogs = Array.isArray(run.logs) ? run.logs : [];
                const bufferedLogs = this.logBuffers.get(runId) || [];
                return {
                    ...run,
                    logs: [...persistentLogs, ...bufferedLogs]
                };
            }
            return null;
        } catch (error) {
            console.error(`[TestRunService] Error getting run details for ${runId}:`, error);
            throw error;
        }
    }
    async deleteRun(projectId: string, runId: string) {
        await localProjectService.updateProjectData(projectId, (data) => {
            if (data.testRuns) {
                data.testRuns = data.testRuns.filter((r: TestRun) => r.id !== runId);
            }
        });

        // Clear from buffers/queues if active
        this.logBuffers.delete(runId);
        this.flushQueues.delete(runId);
    }
}

export const testRunService = new TestRunService();
