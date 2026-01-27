/**
 * Project Type Definitions
 * 
 * Purpose: Replace 'any' types with proper interfaces
 * Benefits:
 * - Type safety
 * - Better IDE autocomplete
 * - Catch bugs at compile time
 * - Self-documenting code
 */

export interface Project {
    id: string;
    name: string;
    description: string;
    user_id: string;
    created_at: string;
    updated_at?: string;
}

export interface ProjectPage {
    id: string;
    project_id: string;
    title: string;
    content: string;
    order: number;
    created_at: string;
    updated_at?: string;
}

export interface DailyData {
    id: string;
    project_id: string;
    date: string;
    bugs: BugEntry[];
    test_cases: TestCaseEntry[];
    created_at: string;
    updated_at?: string;
}

export interface BugEntry {
    id: string;
    title: string;
    description: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    status: 'open' | 'in-progress' | 'resolved' | 'closed';
    assigned_to?: string;
    created_at: string;
    updated_at?: string;
}

export interface TestCaseEntry {
    id: string;
    title: string;
    description: string;
    steps: string[];
    expected_result: string;
    status: 'pass' | 'fail' | 'skip' | 'pending';
    created_at: string;
    updated_at?: string;
}

export interface FSNode {
    id: string;
    project_id: string;
    name: string;
    type: 'file' | 'folder';
    parent_id: string | null;
    content?: string;
    language?: string;
    created_at: string;
    updated_at?: string;
}
