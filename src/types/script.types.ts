/**
 * Script Type Definitions
 * 
 * Purpose: Type definitions for test scripts and automation
 */

export interface Script {
    id: string;
    project_id: string;
    name: string;
    description?: string;
    language: 'typescript' | 'javascript' | 'python' | 'java';
    content: string;
    steps?: ScriptStep[];
    created_at: string;
    updated_at?: string;
}

export interface ScriptStep {
    command: string;
    target: string;
    targets?: string[][];
    value: string;
    description?: string;
}

export interface Schedule {
    id: string;
    project_id: string;
    script_id: string;
    name: string;
    cron_expression: string;
    enabled: boolean;
    last_run?: string;
    next_run?: string;
    created_at: string;
    updated_at?: string;
}
