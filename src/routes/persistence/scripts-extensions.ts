// import { Router } from 'express';
// import { readDataFile, writeDataFile } from '../../utils/fileUtils';

// const router = Router();

// // Initialize Gemini AI
// const genAI = new (require('@google/generative-ai').GoogleGenerativeAI)(
//   process.env.GEMINI_API_KEY || 'demo-key'
// );

// // Run test script
// router.post('/:projectId/scripts/:scriptId/run', async (req, res) => {
//   try {
//     const { projectId, scriptId } = req.params;

//     const data = await readDataFile(`project-${projectId}-data.json`);
//     const scripts = data.scripts || [];

//     const script = scripts.find((s: any) => s.id === scriptId);
//     if (!script) {
//       return res.status(404).json({ error: 'Script not found' });
//     }

//     // Simulated test execution
//     // In production, this would use Selenium WebDriver
//     const logs: string[] = [];
//     let status = 'pass';

//     try {
//       logs.push(`[INFO] Starting test: ${script.name}`);
//       logs.push(`[INFO] Base URL: ${script.script.baseUrl || 'Not specified'}`);

//       if (script.script.steps && Array.isArray(script.script.steps)) {
//         for (let i = 0; i < script.script.steps.length; i++) {
//           const step = script.script.steps[i];
//           logs.push(`[STEP ${i + 1}] ${step.action || 'Unknown action'}`);

//           // Simulate step execution
//           await new Promise(resolve => setTimeout(resolve, 100));

//           // Random failure for demo (10% chance)
//           if (Math.random() < 0.1) {
//             status = 'fail';
//             logs.push(`[ERROR] Step ${i + 1} failed: Element not found`);
//             break;
//           }

//           logs.push(`[SUCCESS] Step ${i + 1} completed`);
//         }
//       } else {
//         logs.push('[WARNING] No steps defined in script');
//       }

//       if (status === 'pass') {
//         logs.push(`[INFO] Test completed successfully`);
//       }
//     } catch (error: any) {
//       status = 'error';
//       logs.push(`[ERROR] Test execution failed: ${error.message}`);
//     }

//     const logsString = logs.join('\n');

//     // Update script with last run info
//     const scriptIndex = scripts.findIndex((s: any) => s.id === scriptId);
//     scripts[scriptIndex] = {
//       ...scripts[scriptIndex],
//       lastRun: {
//         status,
//         timestamp: new Date().toISOString(),
//         logs: logsString,
//       },
//       updatedAt: new Date().toISOString(),
//     };

//     await writeDataFile(`project-${projectId}-data.json`, { ...data, scripts });

//     res.json({
//       status,
//       logs: logsString,
//       timestamp: new Date().toISOString(),
//     });
//   } catch (error) {
//     console.error('Error running script:', error);
//     res.status(500).json({ error: 'Failed to run script' });
//   }
// });

// // Generate test script with AI
// router.post('/:projectId/scripts/generate', async (req, res) => {
//   try {
//     const { projectId } = req.params;
//     const { prompt } = req.body;

//     if (!prompt) {
//       return res.status(400).json({ error: 'Prompt is required' });
//     }

//     // Use Gemini to generate test script
//     const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

//     const systemPrompt = `You are a test automation expert. Generate a test automation script in JSON format based on the user's request.

// The JSON format should be:
// {
//   "baseUrl": "https://example.com",
//   "steps": [
//     {
//       "action": "navigate",
//       "url": "/login",
//       "description": "Navigate to login page"
//     },
//     {
//       "action": "type",
//       "selector": "#username",
//       "value": "user@example.com",
//       "description": "Enter username"
//     },
//     {
//       "action": "type",
//       "selector": "#password",
//       "value": "password123",
//       "description": "Enter password"
//     },
//     {
//       "action": "click",
//       "selector": "#login-button",
//       "description": "Click login button"
//     },
//     {
//       "action": "waitFor",
//       "selector": ".dashboard",
//       "description": "Wait for dashboard to load"
//     },
//     {
//       "action": "assert",
//       "selector": ".welcome-message",
//       "expected": "Welcome",
//       "description": "Verify welcome message"
//     }
//   ]
// }

// Available actions: navigate, type, click, waitFor, assert, screenshot
// Return ONLY valid JSON, no markdown or explanation.`;

//     const result = await model.generateContent([systemPrompt, prompt]);
//     const response = result.response;
//     let generatedText = response.text();

//     // Clean up markdown if present
//     generatedText = generatedText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

//     let script;
//     try {
//       script = JSON.parse(generatedText);
//     } catch (parseError) {
//       return res.status(400).json({ 
//         error: 'Failed to generate valid JSON script',
//         raw: generatedText 
//       });
//     }

//     res.json({ script });
//   } catch (error: any) {
//     console.error('Error generating script:', error);
//     res.status(500).json({ 
//       error: error.message || 'Failed to generate script with AI' 
//     });
//   }
// });

// // Analyze test failure with AI
// router.post('/:projectId/scripts/analyze-failure', async (req, res) => {
//   try {
//     const { script, logs } = req.body;

//     if (!script || !logs) {
//       return res.status(400).json({ error: 'Script and logs are required' });
//     }

//     const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

//     const prompt = `You are a test automation expert. Analyze this test failure:

// Test Script:
// ${JSON.stringify(script, null, 2)}

// Failure Logs:
// ${logs}

// Provide a concise analysis of:
// 1. What likely caused the failure
// 2. Suggested fixes
// 3. Potential improvements

// Keep the response under 200 words and practical.`;

//     const result = await model.generateContent(prompt);
//     const analysis = result.response.text();

//     res.json({ analysis });
//   } catch (error: any) {
//     console.error('Error analyzing failure:', error);
//     res.status(500).json({ 
//       error: error.message || 'Failed to analyze failure' 
//     });
//   }
// });

// export { router as scriptExtensionRoutes };
import { Router } from 'express';
import { readDataFile, writeDataFile } from '../../utils/fileUtils';

const router = Router();

// Retrieve key and log a partial view for verification
const apiKey = process.env.GEMINI_API_KEY || 'demo-key';
console.log(`[AI Init] API Key status: ${apiKey.startsWith('AIza') ? 'Found' : 'NOT FOUND (using fallback)'}`);
if (apiKey.length > 5) {
  console.log(`[AI Init] Key prefix: ${apiKey.substring(0, 5)}...`);
}

// Initialize Gemini AI
const genAI = new (require('@google/generative-ai').GoogleGenerativeAI)(apiKey);

// Run test script
router.post('/:projectId/scripts/:scriptId/run', async (req, res) => {
  try {
    const { projectId, scriptId } = req.params;

    const data = await readDataFile(`project-${projectId}-data.json`);
    const scripts = data.scripts || [];

    const script = scripts.find((s: any) => s.id === scriptId);
    if (!script) {
      return res.status(404).json({ error: 'Script not found' });
    }

    // Simulated test execution
    // In production, this would use Selenium WebDriver
    const logs: string[] = [];
    let status = 'pass';

    try {
      logs.push(`[INFO] Starting test: ${script.name}`);
      logs.push(`[INFO] Base URL: ${script.script.baseUrl || 'Not specified'}`);

      if (script.script.steps && Array.isArray(script.script.steps)) {
        for (let i = 0; i < script.script.steps.length; i++) {
          const step = script.script.steps[i];
          logs.push(`[STEP ${i + 1}] ${step.action || 'Unknown action'}`);

          // Simulate step execution
          await new Promise(resolve => setTimeout(resolve, 100));

          // Random failure for demo (10% chance)
          if (Math.random() < 0.1) {
            status = 'fail';
            logs.push(`[ERROR] Step ${i + 1} failed: Element not found`);
            break;
          }

          logs.push(`[SUCCESS] Step ${i + 1} completed`);
        }
      } else {
        logs.push('[WARNING] No steps defined in script');
      }

      if (status === 'pass') {
        logs.push(`[INFO] Test completed successfully`);
      }
    } catch (error: any) {
      status = 'error';
      logs.push(`[ERROR] Test execution failed: ${error.message}`);
    }

    const logsString = logs.join('\n');

    // Update script with last run info
    const scriptIndex = scripts.findIndex((s: any) => s.id === scriptId);
    scripts[scriptIndex] = {
      ...scripts[scriptIndex],
      lastRun: {
        status,
        timestamp: new Date().toISOString(),
        logs: logsString,
      },
      updatedAt: new Date().toISOString(),
    };

    await writeDataFile(`project-${projectId}-data.json`, { ...data, scripts });

    res.json({
      status,
      logs: logsString,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error running script:', error);
    res.status(500).json({ error: 'Failed to run script' });
  }
});

// Generate test script with AI
router.post('/:projectId/scripts/generate', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { prompt } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    // Use Gemini to generate test script
    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

    const systemPrompt = `You are a test automation expert. Generate a test automation script in JSON format based on the user's request.

The JSON format should be:
{
  "baseUrl": "https://example.com",
  "steps": [
    {
      "action": "navigate",
      "url": "/login",
      "description": "Navigate to login page"
    },
    {
      "action": "type",
      "selector": "#username",
      "value": "user@example.com",
      "description": "Enter username"
    },
    {
      "action": "type",
      "selector": "#password",
      "value": "password123",
      "description": "Enter password"
    },
    {
      "action": "click",
      "selector": "#login-button",
      "description": "Click login button"
    },
    {
      "action": "waitFor",
      "selector": ".dashboard",
      "description": "Wait for dashboard to load"
    },
    {
      "action": "assert",
      "selector": ".welcome-message",
      "expected": "Welcome",
      "description": "Verify welcome message"
    }
  ]
}

Available actions: navigate, type, click, waitFor, assert, screenshot
Return ONLY valid JSON, no markdown or explanation.`;

    const result = await model.generateContent([systemPrompt, prompt]);
    const response = result.response;
    let generatedText = response.text();

    // Clean up markdown if present
    generatedText = generatedText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    let script;
    try {
      script = JSON.parse(generatedText);
    } catch (parseError) {
      return res.status(400).json({
        error: 'Failed to generate valid JSON script',
        raw: generatedText
      });
    }

    res.json({ script });
  } catch (error: any) {
    console.error('Error generating script:', error);
    res.status(500).json({
      error: error.message || 'Failed to generate script with AI'
    });
  }
});

// Analyze test failure with AI
router.post('/:projectId/scripts/analyze-failure', async (req, res) => {
  try {
    const { script, logs } = req.body;

    if (!script || !logs) {
      return res.status(400).json({ error: 'Script and logs are required' });
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

    const prompt = `You are a test automation expert. Analyze this test failure:

Test Script:
${JSON.stringify(script, null, 2)}

Failure Logs:
${logs}

Provide a concise analysis of:
1. What likely caused the failure
2. Suggested fixes
3. Potential improvements

Keep the response under 200 words and practical.`;

    const result = await model.generateContent(prompt);
    const analysis = result.response.text();

    res.json({ analysis });
  } catch (error: any) {
    console.error('Error analyzing failure:', error);
    res.status(500).json({
      error: error.message || 'Failed to analyze failure'
    });
  }
});

export { router as scriptExtensionRoutes };
