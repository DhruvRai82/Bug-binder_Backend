const fs = require('fs');
const filePath = 'f:/second/Bug-binder-add1/bug-binder/backend/data/project-eeb908f5-24d8-4d43-87bb-14a1c4a03fea-data.json';

try {
    const rawData = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(rawData);
    data.testRuns = []; // Wipe all runs
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    console.log('Database wiped of recent runs.');
} catch (error) {
    console.error('Error wiping db:', error);
}
