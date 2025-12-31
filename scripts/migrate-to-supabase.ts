import { supabase } from '../src/lib/supabase';
import fs from 'fs/promises';
import path from 'path';

const PROJECTS_DIR = path.join(__dirname, '../data');
const SCRIPTS_DIR = path.join(__dirname, '../../data');

async function migrateProjects() {
    console.log('Migrating Projects...');
    try {
        const content = await fs.readFile(path.join(PROJECTS_DIR, 'projects.json'), 'utf-8');
        const data = JSON.parse(content);
        const projects = data.projects || [];

        if (projects.length === 0) {
            console.log('No projects to migrate.');
            return;
        }

        const { error } = await supabase.from('projects').upsert(
            projects.map((p: any) => ({
                id: p.id,
                name: p.name,
                description: p.description,
                created_at: p.createdAt,
                updated_at: p.updatedAt
            }))
        );

        if (error) throw error;
        console.log(`Migrated ${projects.length} projects.`);
    } catch (error) {
        console.error('Error migrating projects:', error);
    }
}

async function migrateScripts() {
    console.log('Migrating Recorded Scripts...');
    try {
        const content = await fs.readFile(path.join(SCRIPTS_DIR, 'recorded-scripts.json'), 'utf-8');
        const scripts = JSON.parse(content);

        if (scripts.length === 0) {
            console.log('No scripts to migrate.');
            return;
        }

        const { error } = await supabase.from('recorded_scripts').upsert(
            scripts.map((s: any) => ({
                id: s.id,
                project_id: s.projectId,
                name: s.name,
                module: s.module,
                steps: s.steps,
                created_at: s.createdAt
            }))
        );

        if (error) throw error;
        console.log(`Migrated ${scripts.length} scripts.`);
    } catch (error) {
        console.error('Error migrating scripts:', error);
    }
}

async function migrateReports() {
    console.log('Migrating Execution Reports...');
    try {
        const content = await fs.readFile(path.join(SCRIPTS_DIR, 'execution-reports.json'), 'utf-8');
        const reports = JSON.parse(content);

        if (reports.length === 0) {
            console.log('No reports to migrate.');
            return;
        }

        const { error } = await supabase.from('execution_reports').upsert(
            reports.map((r: any) => ({
                id: r.id,
                project_id: r.projectId,
                script_id: r.scriptId,
                script_name: r.scriptName,
                module: r.module,
                status: r.status,
                start_time: r.startTime,
                end_time: r.endTime,
                duration: r.duration,
                error: r.error,
                steps_completed: r.stepsCompleted,
                total_steps: r.totalSteps
            }))
        );

        if (error) throw error;
        console.log(`Migrated ${reports.length} reports.`);
    } catch (error) {
        console.error('Error migrating reports:', error);
    }
}

async function main() {
    await migrateProjects();
    await migrateScripts();
    await migrateReports();
    console.log('Migration completed.');
}

main();
