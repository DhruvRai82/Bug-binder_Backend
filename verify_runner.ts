
import { codeExecutorService } from './src/services/execution/CodeExecutorService';
import fs from 'fs';
import path from 'path';

async function verifyExecution() {
    // Correct path relative to backend root: ../your_test_script.py (since we are in backend/)
    const scriptPath = path.join(process.cwd(), '../your_test_script.py');

    // Check if script exists
    if (!fs.existsSync(scriptPath)) {
        console.error("Test script not found at:", scriptPath);
        return;
    }

    const content = fs.readFileSync(scriptPath, 'utf-8');

    console.log("Triggering Python Execution from Backend...");
    const result = await codeExecutorService.executeCode(content, 'python');

    console.log("Execution Result:", result);
}

verifyExecution().catch(console.error);
