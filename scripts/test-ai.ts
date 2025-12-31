const GenAIService = require('../src/services/GenAIService').GenAIService;
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load env
dotenv.config({ path: path.join(__dirname, '../.env') });

const service = new GenAIService();

async function test() {
    const logFile = path.join(__dirname, '../ai-error.log');
    const log = (msg: string) => fs.appendFileSync(logFile, msg + '\n');

    fs.writeFileSync(logFile, 'Starting AI Test...\n');

    if (!process.env.GEMINI_API_KEY) {
        log('SKIPPING TEST: GEMINI_API_KEY not found in .env');
        return;
    }

    try {
        log('1. Generating Test Cases...');
        const tests = await service.generateTestCases('Login page with email and password');
        log('Result length: ' + tests.length);

        log('\n2. Summarizing Bug...');
        const bug = await service.summarizeBug('The application crashes when I click submit.');
        log('Result: ' + JSON.stringify(bug));

        log('\nAI Service Verified Successfully!');
    } catch (error) {
        const msg = (error as Error).message;
        log('Test Failed: ' + msg);
        log('Stack: ' + (error as Error).stack);
        fs.writeFileSync(path.join(__dirname, '../error.txt'), msg);
    }
}

test();
