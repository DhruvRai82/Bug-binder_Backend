// import { Router } from 'express';
// import { readDataFile, writeDataFile } from '../utils/fileUtils';
// import { v4 as uuidv4 } from 'uuid';
// import { GoogleGenerativeAI } from '@google/generative-ai';

// const router = Router();

// // Get all scripts for a project
// router.get('/:projectId/scripts', async (req, res) => {
//   try {
//     const { projectId } = req.params;
//     const data = await readDataFile(`project-${projectId}-data.json`);
//     res.json(data.scripts || []);
//   } catch (error) {
//     console.error('Error loading scripts:', error);
//     res.json([]);
//   }
// });

// // Create new script
// router.post('/:projectId/scripts', async (req, res) => {
//   try {
//     const { projectId } = req.params;
//     const scriptData = req.body;

//     const data = await readDataFile(`project-${projectId}-data.json`);
//     const scripts = data.scripts || [];

//     const newScript = {
//       ...scriptData,
//       id: uuidv4(),
//       createdAt: new Date().toISOString(),
//       updatedAt: new Date().toISOString()
//     };

//     scripts.push(newScript);
//     await writeDataFile(`project-${projectId}-data.json`, { ...data, scripts });

//     res.status(201).json(newScript);
//   } catch (error) {
//     console.error('Error creating script:', error);
//     res.status(500).json({ error: 'Failed to create script' });
//   }
// });

// // Update script
// router.put('/:projectId/scripts/:scriptId', async (req, res) => {
//   try {
//     const { projectId, scriptId } = req.params;
//     const updates = req.body;

//     const data = await readDataFile(`project-${projectId}-data.json`);
//     const scripts = data.scripts || [];

//     const scriptIndex = scripts.findIndex((s: any) => s.id === scriptId);
//     if (scriptIndex === -1) {
//       return res.status(404).json({ error: 'Script not found' });
//     }

//     scripts[scriptIndex] = {
//       ...scripts[scriptIndex],
//       ...updates,
//       updatedAt: new Date().toISOString()
//     };

//     await writeDataFile(`project-${projectId}-data.json`, { ...data, scripts });
//     res.json(scripts[scriptIndex]);
//   } catch (error) {
//     console.error('Error updating script:', error);
//     res.status(500).json({ error: 'Failed to update script' });
//   }
// });

// // Delete script
// router.delete('/:projectId/scripts/:scriptId', async (req, res) => {
//   try {
//     const { projectId, scriptId } = req.params;

//     const data = await readDataFile(`project-${projectId}-data.json`);
//     const scripts = data.scripts || [];

//     const scriptIndex = scripts.findIndex((s: any) => s.id === scriptId);
//     if (scriptIndex === -1) {
//       return res.status(404).json({ error: 'Script not found' });
//     }

//     scripts.splice(scriptIndex, 1);
//     await writeDataFile(`project-${projectId}-data.json`, { ...data, scripts });

//     res.json({ message: 'Script deleted successfully' });
//   } catch (error) {
//     console.error('Error deleting script:', error);
//     res.status(500).json({ error: 'Failed to delete script' });
//   }
// });

// // Get specific script
// router.get('/:projectId/scripts/:scriptId', async (req, res) => {
//   try {
//     const { projectId, scriptId } = req.params;
//     const data = await readDataFile(`project-${projectId}-data.json`);
//     const scripts = data.scripts || [];

//     const script = scripts.find((s: any) => s.id === scriptId);
//     if (!script) {
//       return res.status(404).json({ error: 'Script not found' });
//     }

//     res.json(script);
//   } catch (error) {
//     console.error('Error loading script:', error);
//     res.status(500).json({ error: 'Failed to load script' });
// });

// export { router as scriptRoutes };
//============================================================================================
// The above code is commented out to prevent errors due to missing dependencies.
import { Router } from 'express';
// import { readDataFile, writeDataFile } from '../utils/fileUtils'; // Deprecated
import { v4 as uuidv4 } from 'uuid';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { unifiedProjectService as projectService } from '../services/UnifiedProjectService';

const router = Router();

// =========================================================================
// CRITICAL FIX: Initialize AI Client with ENV Variable Check
// =========================================================================

// Retrieve key and log a partial view for verification (Check your console!)
const apiKey = process.env.GEMINI_API_KEY || 'demo-key';
console.log(`[AI Init] API Key status: ${apiKey.startsWith('AIza') ? 'Found' : 'NOT FOUND (using fallback)'}`);
if (apiKey.length > 5 && apiKey !== 'demo-key') {
  console.log(`[AI Init] Key prefix: ${apiKey.substring(0, 5)}...`);
}

// Initialize Gemini AI using the imported class
const genAI = new GoogleGenerativeAI(apiKey);

// =========================================================================
// CRUD Routes (Migrated to Firestore via ProjectService)
// =========================================================================

// Get all scripts for a project
router.get('/:projectId/scripts', async (req, res) => {
  try {
    const { projectId } = req.params;
    // @ts-ignore
    const userId = String(req.user?.uid || req.headers['x-user-id'] || 'user-id');
    // Fallback to 'user-id' only if auth missing, but try header too.

    const scripts = await projectService.getScripts(projectId, userId);
    res.json(scripts || []);
  } catch (error) {
    console.error('Error loading scripts:', error);
    res.json([]);
  }
});

// Create new script
router.post('/:projectId/scripts', async (req, res) => {
  try {
    const { projectId } = req.params;
    // @ts-ignore
    // @ts-ignore
    const userId = String(req.user?.uid || req.headers['x-user-id'] || 'user-id');
    const scriptData = req.body;

    const newScript = await projectService.createScript(projectId, scriptData, userId);
    res.status(201).json(newScript);
  } catch (error) {
    console.error('Error creating script:', error);
    res.status(500).json({ error: 'Failed to create script' });
  }
});

// Get specific script
router.get('/:projectId/scripts/:scriptId', async (req, res) => {
  try {
    const { projectId, scriptId } = req.params;
    // @ts-ignore
    // @ts-ignore
    const userId = String(req.user?.uid || req.headers['x-user-id'] || 'user-id');
    const scripts = await projectService.getScripts(projectId, userId); // Optimization: Add single getScript to service?
    // ProjectService had getScripts (collection scan). 
    // Let's rely on finding it in the array for now or improve service later.
    const script = scripts.find(s => s.id === scriptId);

    if (!script) {
      return res.status(404).json({ error: 'Script not found' });
    }
    res.json(script);
  } catch (error) {
    console.error('Error loading script:', error);
    res.status(500).json({ error: 'Failed to load script' });
  }
});

// Update script
router.put('/:projectId/scripts/:scriptId', async (req, res) => {
  try {
    const { projectId, scriptId } = req.params;
    const updates = req.body;

    // @ts-ignore
    // @ts-ignore
    const userId = String(req.user?.uid || req.headers['x-user-id'] || 'user-id');
    const updatedScript = await projectService.updateScript(projectId, scriptId, updates, userId);
    res.json(updatedScript);
  } catch (error) {
    console.error('Error updating script:', error);
    res.status(500).json({ error: 'Failed to update script' });
  }
});

// Delete script
router.delete('/:projectId/scripts/:scriptId', async (req, res) => {
  try {
    const { projectId, scriptId } = req.params;
    // @ts-ignore
    // @ts-ignore
    const userId = String(req.user?.uid || req.headers['x-user-id'] || 'user-id');
    await projectService.deleteScript(projectId, scriptId, userId);
    res.json({ message: 'Script deleted successfully' });
  } catch (error) {
    console.error('Error deleting script:', error);
    res.status(500).json({ error: 'Failed to delete script' });
  }
});


// =========================================================================
// Execution & AI Routes
// =========================================================================

// Run test script
router.post('/:projectId/scripts/:scriptId/run', async (req, res) => {
  try {
    const { projectId, scriptId } = req.params;

    // @ts-ignore
    // @ts-ignore
    const userId = String(req.user?.uid || req.headers['x-user-id'] || 'user-id');
    // const data = await readDataFile(`project-${projectId}-data.json`); // Removed legacy file read
    // const scripts = data.scripts || [];

    const script = await projectService.getScript(projectId, scriptId, userId);
    if (!script) {
      return res.status(404).json({ error: 'Script not found' });
    }

    // Simulated test execution (This is OLD mock logic)
    // The REAL execution happens in /runner/execute.
    // This endpoint seems to be "Run and Save Result Mock"?
    // If the frontend calls this, we should update Firestore.

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

    // Update Script in Firestore
    await projectService.updateScript(projectId, scriptId, {
      lastRun: {
        status,
        timestamp: new Date().toISOString(),
        logs: logsString
      }
    }, userId as string);

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

// Generate test script with AI (with improved error handling)
router.post('/:projectId/scripts/generate', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { prompt, language } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    console.log(`[Script Gen] Generating ${language || 'python'} script for project ${projectId}`);

    // Use Gemini to generate test script
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

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
      "selector": "id:username",
      "value": "user@example.com",
      "description": "Enter username"
    },
    {
      "action": "type",
      "selector": "id:password",
      "value": "password123",
      "description": "Enter password"
    },
    {
      "action": "click",
      "selector": "id:login-button",
      "description": "Click login button"
    },
    {
      "action": "waitFor",
      "selector": "css:.dashboard",
      "description": "Wait for dashboard to load"
    },
    {
      "action": "assert",
      "selector": "css:.welcome-message",
      "expected": "Welcome",
      "description": "Verify welcome message"
    }
  ]
}

IMPORTANT: 
- Selector format should be "type:value" where type is one of: id, name, xpath, css, linkText
- Use explicit waits between actions
- Add proper error handling
- Available actions: navigate, type, click, waitFor, assert, screenshot, select

Return ONLY valid JSON, no markdown or explanation.`;

    let retryCount = 0;
    const maxRetries = 3;
    let lastError: any = null;

    // Retry logic for handling 503/rate limit errors
    while (retryCount < maxRetries) {
      try {
        const result = await model.generateContent([systemPrompt, prompt]);
        const response = result.response;
        let generatedText = response.text();

        // Clean up markdown if present
        generatedText = generatedText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

        let script;
        try {
          script = JSON.parse(generatedText);
        } catch (parseError) {
          console.error('[Script Gen] JSON parse error:', parseError);
          return res.status(400).json({
            error: 'Failed to generate valid JSON script',
            raw: generatedText
          });
        }

        console.log(`[Script Gen] Successfully generated script with ${script.steps?.length || 0} steps`);
        return res.json({ script });

      } catch (error: any) {
        lastError = error;

        // Check if it's a rate limit/overload error
        if (error.message?.includes('503') || error.message?.includes('overloaded') || error.message?.includes('RESOURCE_EXHAUSTED')) {
          retryCount++;
          if (retryCount < maxRetries) {
            const waitTime = Math.pow(2, retryCount) * 1000; // Exponential backoff: 2s, 4s, 8s
            console.log(`[Script Gen] AI overloaded, retrying in ${waitTime}ms (attempt ${retryCount + 1}/${maxRetries})`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            continue;
          }
        } else {
          // Non-retryable error, throw immediately
          throw error;
        }
      }
    }

    // Max retries exceeded
    console.error('[Script Gen] Max retries exceeded:', lastError);
    return res.status(503).json({
      error: 'AI model is currently overloaded. Please try again in a few moments.',
      retryable: true
    });

  } catch (error: any) {
    console.error('[Script Gen] Error:', error);
    return res.status(500).json({
      error: error.message || 'Failed to generate script with AI',
      details: error.toString()
    });
  }
});

// Analyze test failure with AI (FIXED MODEL NAME HERE)
router.post('/:projectId/scripts/analyze-failure', async (req, res) => {
  try {
    const { script, logs } = req.body;

    if (!script || !logs) {
      return res.status(400).json({ error: 'Script and logs are required' });
    }

    // Use Gemini to analyze failure - CHANGED MODEL TO 'gemini-2.5-flash'
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

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

export { router as scriptRoutes };
