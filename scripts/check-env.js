const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

console.log('Checking .env loading...');
const key = process.env.GEMINI_API_KEY;
if (key && key.length > 10) {
    console.log('SUCCESS: GEMINI_API_KEY found (starts with ' + key.substring(0, 5) + ')');
} else {
    console.error('FAILURE: GEMINI_API_KEY not found or empty');
}
