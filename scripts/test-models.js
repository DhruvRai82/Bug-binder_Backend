const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function listModels() {
    const apiKey = process.env.GEMINI_API_KEY;
    console.log("Checking API Key:", apiKey ? "Present" : "Missing");

    if (!apiKey) return;

    const genAI = new GoogleGenerativeAI(apiKey);
    // There is no direct listModels on genAI instance in basic SDK usage usually, 
    // but we can try to infer or just test specific ones.
    // Actually, looking at docs, usually it's a specific method or we just test invoke.

    // Let's test a list of candidates
    const candidates = [
        "gemini-1.5-flash",
        "gemini-1.5-flash-latest",
        "gemini-1.5-flash-001",
        "gemini-1.5-pro",
        "gemini-pro",
        "gemini-1.0-pro",
        "gemini-2.0-flash-exp"
    ];

    console.log("\nTesting Models...");

    for (const modelName of candidates) {
        console.log(`\nTesting: ${modelName}`);
        try {
            const model = genAI.getGenerativeModel({ model: modelName });
            const result = await model.generateContent("Hello check");
            const response = await result.response;
            console.log(`✅ SUCCESS: ${modelName}`);
        } catch (error) {
            console.log(`❌ FAILED: ${modelName} - ${error.message.split('\n')[0]}`);
        }
    }
}

listModels();
