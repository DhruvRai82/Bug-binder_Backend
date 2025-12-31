import * as fs from 'fs/promises';
import * as path from 'path';
import * as admin from 'firebase-admin';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';

// Load env vars
dotenv.config({ path: path.join(__dirname, '../.env') });

// Initialize Firebase Admin
try {
    // Attempt to initialize using environment variables (ADC)
    // This matches src/firebase.ts logic
    if (!admin.apps.length) {
        admin.initializeApp({
            projectId: process.env.FIREBASE_PROJECT_ID || 'bug-binder'
        });
        console.log("Firebase Admin Initialized (Environment/ADC)");
    }
} catch (e) {
    console.error("Failed to init Firebase Admin:", e);
    console.log("Ensure GOOGLE_APPLICATION_CREDENTIALS is set in .env or environment.");
    process.exit(1);
}

const db = admin.firestore();
const DATA_DIR = path.join(process.cwd(), 'data');
console.log('Using Data Directory:', DATA_DIR);
const PROJECTS_FILE = path.join(DATA_DIR, 'projects.json');

async function migrate() {
    console.log("Starting Migration from Local JSON to Firestore...");

    // 1. Read Projects
    try {
        const projectsData = await fs.readFile(PROJECTS_FILE, 'utf-8');
        const projects = JSON.parse(projectsData).projects;

        console.log(`Found ${projects.length} projects.`);

        for (const project of projects) {
            console.log(`Migrating Project: ${project.name} (${project.id})`);

            // Create Project Doc
            const projectRef = db.collection('projects').doc(project.id);
            await projectRef.set({
                ...project,
                migratedAt: new Date().toISOString()
            }, { merge: true });

            // 2. Read Project Data (Sub-collections)
            const dataFilePath = path.join(DATA_DIR, `project-${project.id}-data.json`);
            try {
                const projectDataRaw = await fs.readFile(dataFilePath, 'utf-8');
                const projectData = JSON.parse(projectDataRaw);

                // Migrate Scripts
                if (projectData.scripts && projectData.scripts.length > 0) {
                    console.log(`  - Migrating ${projectData.scripts.length} scripts...`);
                    const batch = db.batch();
                    for (const script of projectData.scripts) {
                        const scriptRef = projectRef.collection('scripts').doc(script.id);
                        batch.set(scriptRef, script);
                    }
                    await batch.commit();
                }

                // Migrate Test Runs
                if (projectData.testRuns && projectData.testRuns.length > 0) {
                    console.log(`  - Migrating ${projectData.testRuns.length} test runs...`);
                    const batch = db.batch();
                    for (const run of projectData.testRuns) {
                        const runRef = projectRef.collection('test_runs').doc(run.id);
                        batch.set(runRef, run);
                    }
                    await batch.commit();
                }

                // Migrate Schedules
                if (projectData.schedules && projectData.schedules.length > 0) {
                    console.log(`  - Migrating ${projectData.schedules.length} schedules...`);
                    const batch = db.batch();
                    for (const schedule of projectData.schedules) {
                        const scheduleRef = projectRef.collection('schedules').doc(schedule.id);
                        if (!schedule.id) schedule.id = scheduleRef.id;
                        batch.set(scheduleRef, schedule);
                    }
                    await batch.commit();
                }

                // Migrate Daily Data (Test Cases & Bugs)
                if (projectData.dailyData && projectData.dailyData.length > 0) {
                    console.log(`  - Migrating ${projectData.dailyData.length} daily entries (Test Cases/Bugs)...`);
                    const batch = db.batch();
                    for (const day of projectData.dailyData) {
                        const dayId = day.id || uuidv4(); // Ensure ID
                        const dayRef = projectRef.collection('daily_data').doc(dayId);
                        batch.set(dayRef, { ...day, id: dayId });
                    }
                    await batch.commit();
                }

                // Migrate Custom Pages
                if (projectData.customPages && projectData.customPages.length > 0) {
                    console.log(`  - Migrating ${projectData.customPages.length} custom pages...`);
                    const batch = db.batch();
                    for (const page of projectData.customPages) {
                        const pageId = page.id || uuidv4();
                        const pageRef = projectRef.collection('pages').doc(pageId);
                        batch.set(pageRef, { ...page, id: pageId });
                    }
                    await batch.commit();
                }

            } catch (err: any) {
                if (err.code === 'ENOENT') {
                    console.log(`  - No data file found for project ${project.id}`);
                } else {
                    console.error(`  - Error reading data file for ${project.id}:`, err);
                }
            }
        }

        console.log("Migration Complete!");
        process.exit(0);

    } catch (error) {
        console.error("Migration Failed:", error);
        process.exit(1);
    }
}

migrate();
