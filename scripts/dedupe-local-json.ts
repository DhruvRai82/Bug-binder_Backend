import * as fs from 'fs';
import * as path from 'path';

const DATA_DIR = path.join(__dirname, '../data');

async function dedupeLocalData() {
    console.log('Starting Local Data Deduplication...');

    // 1. Get all project-*-data.json files
    const files = fs.readdirSync(DATA_DIR).filter(f => f.startsWith('project-') && f.endsWith('-data.json'));
    console.log(`Found ${files.length} data files.`);

    for (const file of files) {
        const filePath = path.join(DATA_DIR, file);
        console.log(`Processing ${file}...`);

        try {
            const content = fs.readFileSync(filePath, 'utf-8');
            const data = JSON.parse(content);
            let modified = false;

            // 1. Dedupe customPages
            if (data.customPages && Array.isArray(data.customPages)) {
                const uniquePages = new Map();
                data.customPages.forEach((p: any) => {
                    // Use ID as key, keep latest
                    uniquePages.set(p.id, p);
                });
                if (data.customPages.length !== uniquePages.size) {
                    console.log(`  - Fixed customPages: ${data.customPages.length} -> ${uniquePages.size}`);
                    data.customPages = Array.from(uniquePages.values());
                    modified = true;
                }
            }

            // 2. Dedupe dailyData
            if (data.dailyData && Array.isArray(data.dailyData)) {
                const uniqueDays = new Map<string, any>();

                data.dailyData.forEach((day: any) => {
                    if (!day.date) return;

                    if (!uniqueDays.has(day.date)) {
                        uniqueDays.set(day.date, day);
                    } else {
                        // Merge!
                        const existing = uniqueDays.get(day.date);
                        console.log(`  - Merging duplicate for date ${day.date}`);

                        // Merge Test Cases
                        const allTestCases = [...(existing.testCases || []), ...(day.testCases || [])];
                        // Dedupe Test Cases by ID
                        const uniqueTC = new Map();
                        allTestCases.forEach(tc => uniqueTC.set(tc.id || tc.testCaseId, tc)); // Use ID preferrably
                        existing.testCases = Array.from(uniqueTC.values());

                        // Merge Bugs
                        const allBugs = [...(existing.bugs || []), ...(day.bugs || [])];
                        const uniqueBugs = new Map();
                        allBugs.forEach(b => uniqueBugs.set(b.id, b));
                        existing.bugs = Array.from(uniqueBugs.values());

                        // Update mod time to latest?
                        // existing.updated_at = ...

                        uniqueDays.set(day.date, existing);
                        modified = true;
                    }
                });

                if (data.dailyData.length !== uniqueDays.size) {
                    console.log(`  - Fixed dailyData: ${data.dailyData.length} -> ${uniqueDays.size}`);
                    data.dailyData = Array.from(uniqueDays.values());
                    modified = true;
                }
            }

            if (modified) {
                fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
                console.log(`  - Saved updates to ${file}`);
            } else {
                console.log(`  - No duplicates found.`);
            }

        } catch (error) {
            console.error(`Error processing ${file}:`, error);
        }
    }
    console.log('Local Deduplication Complete.');
}

dedupeLocalData().catch(console.error);
