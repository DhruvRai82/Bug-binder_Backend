
import fetch from 'node-fetch';

async function testSync() {
    const url = 'http://localhost:8081/api/auth/sync';
    const body = {
        uid: 'TEST_USER_MANUAL_123',
        email: 'manual_test@example.com',
        displayName: 'Manual Test User',
        photoURL: 'http://example.com/photo.jpg'
    };

    console.log('Sending Sync Request:', body);
    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        console.log('Response Status:', res.status);
        const json = await res.json();
        console.log('Response Body:', JSON.stringify(json, null, 2));
    } catch (error) {
        console.error('Fetch Error:', error);
    }
}

testSync();
