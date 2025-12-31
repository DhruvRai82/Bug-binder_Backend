const fs = require('fs');
const path = require('path');

const API_URL = 'http://localhost:5000/api/visual';
const TEST_IMAGE_PATH = path.join(__dirname, 'test-image.png');

// Create a dummy red pixel image for testing if not exists
if (!fs.existsSync(TEST_IMAGE_PATH)) {
    // 1x1 red pixel png
    const buffer = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
    fs.writeFileSync(TEST_IMAGE_PATH, buffer);
}

async function test() {
    console.log('Testing Visual Test API...');

    try {
        // 1. Create Test
        console.log('1. Creating Test...');
        const createRes = await fetch(`${API_URL}/tests`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: 'Automated Verify Test' })
        });
        if (!createRes.ok) throw new Error(`Create failed: ${createRes.status}`);
        const createData = await createRes.json();
        const testId = createData.id;
        console.log('   Created Test ID:', testId);

        // 2. Upload Baseline
        console.log('2. Uploading Baseline...');
        const imageBuffer = fs.readFileSync(TEST_IMAGE_PATH);
        const baselineRes = await fetch(`${API_URL}/upload/${testId}/baseline`, {
            method: 'POST',
            headers: { 'Content-Type': 'image/png' },
            body: imageBuffer
        });
        if (!baselineRes.ok) throw new Error(`Baseline upload failed: ${baselineRes.status}`);
        console.log('   Baseline Uploaded');

        // 3. Upload Latest
        console.log('3. Uploading Latest...');
        const latestRes = await fetch(`${API_URL}/upload/${testId}/latest`, {
            method: 'POST',
            headers: { 'Content-Type': 'image/png' },
            body: imageBuffer
        });
        if (!latestRes.ok) throw new Error(`Latest upload failed: ${latestRes.status}`);
        console.log('   Latest Uploaded');

        // 4. Verify Images Served
        console.log('4. Verifying Image Serving...');
        const listRes = await fetch(`${API_URL}/tests`);
        const listData = await listRes.json();
        const testObj = listData.find(t => t.id === testId);

        if (testObj.baselineImage) {
            const imgRes = await fetch(`${API_URL}/images/${testObj.baselineImage}`);
            if (!imgRes.ok) throw new Error(`Image serve failed: ${imgRes.status}`);
            console.log('   Baseline Image Served OK');
        } else {
            throw new Error('Baseline image not found in test object');
        }

        console.log('\nVisual API Verified Successfully!');
    } catch (error) {
        console.error('Test Failed:', error.message);
    }
}

test();
