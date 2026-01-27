/**
 * Test Run Type Definitions
 * 
 * Purpose: Type definitions for test execution and results
 */

export interface TestRun {
    id: string;
    project_id: string;
    script_ids: string[];
    status: 'running' | 'passed' | 'failed' | 'cancelled';
    source: 'manual' | 'scheduled' | 'api';
    triggered_by: string;
    started_at: string;
    completed_at?: string;
    duration_ms?: number;
    logs: TestLog[];
    results?: TestResult[];
    meta?: TestRunMeta;
}

export interface TestLog {
    step_index: number;
    action: string;
    status: 'pass' | 'fail' | 'info' | 'warning';
    message: string;
    timestamp: string;
}

export interface TestResult {
    script_id: string;
    status: 'pass' | 'fail' | 'skip';
    duration_ms: number;
    error?: string;
    screenshots?: string[];
}

export interface TestRunMeta {
    browser?: string;
    platform?: string;
    viewport?: {
        width: number;
        height: number;
    };
    [key: string]: unknown;
}
