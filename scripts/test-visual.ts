import fs from 'fs';
import path from 'path';

const API_URL = 'http://localhost:5000/api/visual';
const TEST_IMAGE_PATH = path.join(__dirname, 'test-image.png');

// Create a dummy red pixel image for testing if not exists
if (!fs.existsSync(TEST_IMAGE_PATH)) {
    // 1x1 red pixel png
    const buffer = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
    fs.writeFileSync(TEST_IMAGE_PATH, buffer);
}

async function verifyResponse(res: Response, context: string) {
    if (!res.ok) {
        let body = '';
        try { body = await res.text(); } catch (e) { }
        throw new Error(`${context} failed: ${res.status} ${res.statusText} - ${body}`);
    }
    return res;
}

async function test() {
    console.log('Testing Visual Test API (using fetch)...');

    try {
        // 1. Create Test
        console.log('1. Creating Test...');
        let res = await fetch(`${API_URL}/tests`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: 'Automated Verify Test' })
        });
        await verifyResponse(res, 'Create Test');
        const data = await res.json();
        const testId = data.id;
        console.log('   Created Test ID:', testId);

        // 2. Upload Baseline
        console.log('2. Uploading Baseline...');
        const imageBuffer = fs.readFileSync(TEST_IMAGE_PATH);
        res = await fetch(`${API_URL}/upload/${testId}/baseline`, {
            method: 'POST',
            headers: { 'Content-Type': 'image/png' },
            body: imageBuffer // fetch accepts Buffer in Node 18+
        });
        await verifyResponse(res, 'Upload Baseline');
        console.log('   Baseline Uploaded');

        // 3. Upload Latest
        console.log('3. Uploading Latest...');
        res = await fetch(`${API_URL}/upload/${testId}/latest`, {
            method: 'POST',
            headers: { 'Content-Type': 'image/png' },
            body: imageBuffer
        });
        await verifyResponse(res, 'Upload Latest');
        console.log('   Latest Uploaded');

        // 4. Verify Images Served
        console.log('4. Verifying Image Serving...');
        res = await fetch(`${API_URL}/tests`);
        await verifyResponse(res, 'List Tests');
        const tests = await res.json();
        const testObj = tests.find((t: any) => t.id === testId);

        if (testObj && testObj.baselineImage) {
            res = await fetch(`${API_URL}/images/${testObj.baselineImage}`);
            await verifyResponse(res, 'Get Baseline Image');
            console.log('   Baseline Image Served OK');
        } else {
            throw new Error('Baseline image not found in test object');
        }

        console.log('\nVisual API Verified Successfully!');
    } catch (error) {
        console.error('Test Failed:', (error as Error).message);
    }
}

test();
