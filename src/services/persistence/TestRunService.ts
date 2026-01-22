
import { v4 as uuidv4 } from 'uuid';
import { localProjectService } from './LocalProjectService';

export interface TestRun {
    id: string;
    projectId: string;
    status: 'running' | 'completed' | 'failed';
    startTime: string;
    endTime?: string;
    triggeredBy: string; // 'manual' or 'schedule'
    files: string[];     // IDs of files run
    results: TestResult[];
    logs: any[];      // Unified log stream (Structured Objects)
}

export interface TestResult {
    file: string;
    status: 'passed' | 'failed' | 'skipped';
    duration?: number;
    error?: string;
    logs?: string[];
}

class TestRunService {
    // In-memory buffer for active runs to prevent race conditions during rapid logging
    private logBuffers: Map<string, any[]> = new Map();
    // Queue for sequential flushing per run
    private flushQueues: Map<string, Promise<void>> = new Map();


    async createRun(projectId: string, fileIds: string[]): Promise<string> {
        const runId = uuidv4();
        const newRun: TestRun = {
            id: runId,
            projectId,
            status: 'running',
            startTime: new Date().toISOString(),
            triggeredBy: 'manual',
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
        // Keep only last 50 runs to avoid bloat
        if (data.testRuns.length > 50) data.testRuns = data.testRuns.slice(0, 50);

        await localProjectService.writeProjectData(projectId, data);
        return runId;
    }

    async updateRun(runId: string, projectId: string, updates: Partial<TestRun>) {
        // Apply any buffered logs before updating status
        await this.flushLogs(runId, projectId);
        // Ensure all pending logs are flushed before updating the run's status or other properties
        await this.flushQueues.get(runId); // Wait for any pending flush operations to complete

        await this._updateRun(projectId, runId, (run) => {
            Object.assign(run, updates);
        });

        // If run is completed or failed, clear the buffer and queue
        if (updates.status === 'completed' || updates.status === 'failed') {
            this.logBuffers.delete(runId);
            this.flushQueues.delete(runId);
        }
    }

    // Helper to atomically update run
    private async _updateRun(projectId: string, runId: string, updater: (run: TestRun) => void) {
        await localProjectService.updateProjectData(projectId, (data) => {
            const run = data.testRuns?.find((r: TestRun) => r.id === runId);
            if (run) {
                updater(run);
            }
        });
    }

    async appendLog(runId: string, projectId: string, logEntry: any) {
        // Ensure timestamp exists
        if (typeof logEntry === 'object' && !logEntry.timestamp) {
            logEntry.timestamp = new Date().toISOString();
        }

        // Formatted for console/legacy if string
        const logContent = typeof logEntry === 'string'
            ? `[${new Date().toISOString()}] ${logEntry}`
            : logEntry;

        // Buffer immediately for live view
        if (!this.logBuffers.has(runId)) {
            this.logBuffers.set(runId, []);
        }
        this.logBuffers.get(runId)?.push(logContent);

        // Queue flush
        const previousFlush = this.flushQueues.get(runId) || Promise.resolve();
        const currentFlush = previousFlush.then(() => this.flushLogs(runId, projectId));

        this.flushQueues.set(runId, currentFlush);
        return currentFlush;
    }

    private async flushLogs(runId: string, projectId: string) {
        const buffer = this.logBuffers.get(runId);
        if (!buffer || buffer.length === 0) return;

        const logsToWrite = [...buffer];
        this.logBuffers.set(runId, []); // Clear buffer

        try {
            await this._updateRun(projectId, runId, (run) => {
                if (!run.logs) run.logs = [];
                run.logs.push(...logsToWrite);
            });
        } catch (error) {
            console.error(`Failed to flush logs for run ${runId}:`, error);
            // Restore logs to buffer? 
            // If update failed, they are lost from disk but still in 'logsToWrite'.
            // For now, logged error is sufficient to debug race conditions.
        }
    }

    async getProjectRuns(projectId: string): Promise<TestRun[]> {
        const data = await localProjectService.readProjectData(projectId);
        return data.testRuns || [];
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
