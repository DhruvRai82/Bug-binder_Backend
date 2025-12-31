import * as admin from 'firebase-admin';
import { db } from '../src/lib/firebase-admin';
import dotenv from 'dotenv';
import * as path from 'path';

// Load env vars
dotenv.config({ path: path.join(__dirname, '../.env') });

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId: process.env.FIREBASE_PROJECT_ID
    });
}

async function cleanupDuplicates() {
    console.log('Starting Duplicate Cleanup...');

    const projectsSnapshot = await db.collection('projects').get();
    console.log(`Found ${projectsSnapshot.size} projects.`);

    for (const projectDoc of projectsSnapshot.docs) {
        const projectId = projectDoc.id;
        console.log(`Checking Project: ${projectDoc.data().name} (${projectId})`);

        // 1. Cleanup Daily Data (Dedupe by Date + ID Check)
        const dailyRef = db.collection('projects').doc(projectId).collection('daily_data');
        const dailySnapshot = await dailyRef.get();

        if (!dailySnapshot.empty) {
            const dailyMap = new Map<string, FirebaseFirestore.QueryDocumentSnapshot[]>();

            // Group by DATE
            dailySnapshot.docs.forEach(doc => {
                const data = doc.data();
                const key = data.date || 'unknown';
                if (!dailyMap.has(key)) dailyMap.set(key, []);
                dailyMap.get(key)!.push(doc);
            });

            for (const [date, docs] of dailyMap.entries()) {
                if (docs.length > 1) {
                    console.log(`  - Found ${docs.length} entries for date ${date}. Cleaning up...`);
                    // Create Batch
                    const batch = db.batch();
                    // Keep the FIRST one, delete rest. 
                    // Since local data is deduped to one, Sync will check if that one exists on Remote.
                    // If we keep a random one, Sync might not match ID and create another logic?
                    // But we fixed ID generation to use Existing ID if passed.
                    // Sync passes the Local ID.
                    // Ideally we should keep the one that MATCHES Local ID. But we don't have it here.
                    // WE DELETE ALL. Sync will restore the one true Local ID.
                    // Safest.
                    console.log(`  - Deleting ALL ${docs.length} entries for date ${date} to let Sync restore the correct one.`);
                    docs.forEach(doc => batch.delete(doc.ref));
                    await batch.commit();
                } else {
                    // Even if 1 exists, if it has WRONG ID (random), Sync will propagate Local ID (correct) -> Duplicate.
                    // But we can't easily detect wrong ID without local data.
                    // Let's assume if 1 exists, it might be the right one or Sync will handle it?
                    // If Sync creates a NEW one, we will have 2. Then next cleanup will catch it.
                    // For now just handle obvious duplicates.
                }
            }
        }

        // 2. Cleanup Pages (Dedupe by Name)
        const pagesRef = db.collection('projects').doc(projectId).collection('pages');
        const pagesSnapshot = await pagesRef.get();

        if (!pagesSnapshot.empty) {
            const pagesMap = new Map<string, FirebaseFirestore.QueryDocumentSnapshot[]>();
            pagesSnapshot.docs.forEach(doc => {
                const data = doc.data();
                const key = data.name || 'unknown'; // Group by Name
                if (!pagesMap.has(key)) pagesMap.set(key, []);
                pagesMap.get(key)!.push(doc);
            });

            for (const [name, docs] of pagesMap.entries()) {
                if (docs.length > 1) {
                    console.log(`  - Found ${docs.length} pages checking name "${name}". Cleaning up...`);
                    console.log(`  - Deleting ALL to let Sync restore.`);
                    const batch = db.batch();
                    docs.forEach(doc => batch.delete(doc.ref));
                    await batch.commit();
                }
            }
        }
    }
    console.log('Cleanup Complete.');
}

cleanupDuplicates().catch(console.error);
