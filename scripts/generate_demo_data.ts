import fetch from 'node-fetch';
import FormData from 'form-data';

const API_base = 'http://localhost:8080/api';
// Using the mock user ID we hardcoded or one that works with our middleware
// Middleware fallback was 'test-user-id' if token present.
const headers = {
    'Authorization': 'Bearer demo-token-123',
    'x-user-id': 'demo-user-id',
    'Content-Type': 'application/json'
};

async function generateData() {
    console.log('🚀 Starting Demo Data Generation...');

    // 1. Create Project
    console.log('\n📦 Creating Project: "E-Commerce Alpha"...');
    const projectRes = await fetch(`${API_base}/projects`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
            name: "E-Commerce Alpha",
            description: "Main web store automated testing suite"
        })
    });

    if (!projectRes.ok) throw new Error(`Failed to create project: ${projectRes.statusText}`);
    const project = await projectRes.json() as any;
    console.log(`✅ Project Created! ID: ${project.id}`);

    // 2. Upload Test Data (Multipart)
    console.log('\n📄 Uploading Test Data: "users.csv"...');
    // Using FormData for file upload
    const form = new FormData();
    const csvContent = "username,password,role\nadmin,pass123,admin\nuser1,pass123,customer\nuser2,pass123,customer";
    form.append('file', Buffer.from(csvContent), { filename: 'users.csv', contentType: 'text/csv' });

    const uploadRes = await fetch(`${API_base}/test-data/upload`, {
        method: 'POST',
        headers: {
            'Authorization': 'Bearer demo-token-123',
            'x-user-id': 'demo-user-id',
            // let form-data handle content-type boundary
            ...form.getHeaders()
        },
        body: form
    });

    if (!uploadRes.ok) throw new Error(`Failed to upload data: ${uploadRes.statusText}`);
    const dataset = await uploadRes.json() as any;
    console.log(`✅ Dataset Uploaded! ID: ${dataset.id}`);


    // 3. Create a Dummy Script (Need a script to schedule)
    // We'll create it via direct DB insertion or API if available.
    // 'scriptRoutes' handles /api/tests. Assuming POST /api/tests/:projectId/scripts
    console.log('\n📜 Creating Test Script: "Checkout Flow"...');
    const scriptRes = await fetch(`${API_base}/tests/${project.id}/scripts`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
            name: "Checkout Flow",
            script: {
                baseUrl: "https://example-store.com",
                steps: [
                    { action: "navigate", url: "/" },
                    { action: "click", selector: ".cart-btn" },
                    { action: "type", selector: "#email", value: "test@example.com" },
                    { action: "click", selector: "#checkout" }
                ]
            }
        })
    });

    // Note: If this route fails (maybe not fully implemented in scripts.ts), we might skip scheduling
    let scriptId = null;
    if (scriptRes.ok) {
        const script = await scriptRes.json() as any;
        scriptId = script.id;
        console.log(`✅ Script Created! ID: ${script.id}`);
    } else {
        console.warn(`⚠️ Could not create script (Status: ${scriptRes.status}). Skipping schedule.`);
    }

    // 4. Create Schedule (if script created)
    if (scriptId) {
        console.log('\n⏰ Scheduling Nightly Run...');
        const scheduleRes = await fetch(`${API_base}/schedules`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                scriptId: scriptId,
                cronExpression: "0 0 * * *" // Midnight
            })
        });

        if (scheduleRes.ok) {
            const schedule = await scheduleRes.json() as any;
            console.log(`✅ Schedule Created! ID: ${schedule.id}`);
        } else {
            console.error('❌ Failed to schedule.');
        }
    }

    // 5. Simulate Visual Test Run (Status Check)
    // Just hitting the endpoint to verify it's up
    console.log('\n👁️ Checking Visual Test Service...');
    const vizRes = await fetch(`${API_base}/visual-tests/dummy-id/status`, { headers });
    console.log(`✅ Visual Test Service Responded: ${vizRes.status}`);

    console.log('\n✨ Data Generation Complete! Refresh your Dashboard.');
}

generateData().catch(console.error);
