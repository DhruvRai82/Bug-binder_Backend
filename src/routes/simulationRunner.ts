import { Router } from 'express';
import { spawn, spawnSync } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';
import { readDataFile } from '../utils/fileUtils';

const router = Router();

// Detect available Python command (python3 or python)
const detectPythonCommand = (): string | null => {
  const candidates = ['python3', 'python'];
  
  for (const cmd of candidates) {
    try {
      const result = spawnSync(cmd, ['--version'], { 
        encoding: 'utf-8',
        windowsHide: true 
      });
      if (result.status === 0) {
        console.log(`[Simulation Runner] Detected Python command: ${cmd} (${result.stdout.trim()})`);
        return cmd;
      }
    } catch (error) {
      // Command not found, try next
    }
  }
  
  console.error('[Simulation Runner] No Python command found on PATH');
  return null;
};

// Run Python Selenium test in visible browser with dynamic script selection
router.post('/run-simulation', async (req, res) => {
  let tempFilePath: string | null = null;
  
  try {
    const { scriptName, projectId } = req.body;

    if (!scriptName) {
      return res.status(400).json({ 
        status: 'fail',
        error: 'Script name is required',
        message: 'Please provide a scriptName in the request body'
      });
    }

    if (!projectId) {
      return res.status(400).json({ 
        status: 'fail',
        error: 'Project ID is required',
        message: 'Please provide a projectId in the request body'
      });
    }

    console.log(`[Simulation Runner] Starting execution of: ${scriptName} for project: ${projectId}`);

    // Detect Python command first
    const pythonCmd = detectPythonCommand();
    if (!pythonCmd) {
      return res.status(500).json({ 
        status: 'fail',
        error: 'Python not found',
        message: 'Python is not installed or not available on PATH. Please install Python 3 and try again.',
        details: 'Tried: python3, python'
      });
    }

    // Load script data from JSON file
    const projectData = await readDataFile(`project-${projectId}-data.json`);
    
    if (!projectData.scripts || !Array.isArray(projectData.scripts)) {
      return res.status(404).json({ 
        status: 'fail',
        error: 'No scripts found',
        message: `No scripts found for project ${projectId}`
      });
    }

    console.log(`[Simulation Runner] Loaded ${projectData.scripts.length} scripts from data file`);

    // Find the script by name (handle both original and safe names)
    const sanitize = (name: string) => name.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/_+/g, '_');
    const script = projectData.scripts.find((s: any) => {
      const matches = 
        s.name === scriptName || 
        (s.safeName && s.safeName === scriptName) ||
        sanitize(s.name) === sanitize(scriptName);
      return matches;
    });

    if (!script) {
      const availableScripts = projectData.scripts.slice(0, 5).map((s: any) => s.name);
      return res.status(404).json({ 
        status: 'fail',
        error: 'Script not found',
        message: `Script "${scriptName}" not found in project data`,
        availableScripts: availableScripts,
        hint: `Available scripts (showing first 5): ${availableScripts.join(', ')}`
      });
    }

    if (!script.code) {
      return res.status(400).json({ 
        status: 'fail',
        error: 'Script has no code',
        message: `Script "${scriptName}" exists but has no code property`
      });
    }

    // Create temporary file with the script code
    const tempDir = os.tmpdir();
    const timestamp = Date.now();
    const safeScriptName = scriptName.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/_+/g, '_');
    const baseName = safeScriptName.endsWith('.py') ? safeScriptName : `${safeScriptName}.py`;
    tempFilePath = path.join(tempDir, `lovable_test_${timestamp}_${baseName}`);
    
    console.log(`[Simulation Runner] Writing script to temp file: ${tempFilePath}`);
    await fs.writeFile(tempFilePath, script.code, 'utf-8');

    console.log(`[Simulation Runner] Temp file created: ${tempFilePath}`);
    console.log(`[Simulation Runner] Using Python command: ${pythonCmd}`);
    
    let outputBuffer = '';
    let errorBuffer = '';

    // Spawn Python process with visible browser settings
    // Use args array to avoid quoting issues with paths containing spaces
    const pythonProcess = spawn(pythonCmd, [tempFilePath], {
      shell: false, // No shell needed, we pass args directly
      windowsHide: false, // Ensure browser window is visible
      env: {
        ...process.env,
        PYTHONUNBUFFERED: '1', // Disable Python output buffering
      }
    });

    // Capture stdout
    pythonProcess.stdout?.on('data', (data) => {
      const output = data.toString();
      outputBuffer += output;
      console.log(`[Simulation Runner] ${output}`);
    });

    // Capture stderr
    pythonProcess.stderr?.on('data', (data) => {
      const error = data.toString();
      errorBuffer += error;
      console.error(`[Simulation Runner] Error: ${error}`);
    });

    let exitCode: number | null = null;
    let responded = false;

    // Handle process completion
    pythonProcess.on('close', (code) => {
      exitCode = code;
      console.log(`[Simulation Runner] Python process exited with code ${code}`);

      if (!responded) {
        responded = true;
        if (code === 0) {
          res.json({ 
            status: 'pass',
            message: 'Test completed successfully',
            exitCode: code,
            output: outputBuffer || 'Test passed with no output'
          });
        } else {
          res.json({ 
            status: 'fail',
            message: 'Test failed with errors',
            exitCode: code,
            output: errorBuffer || outputBuffer || 'Test failed'
          });
        }
      }
    });

    // Handle process errors
    pythonProcess.on('error', (error) => {
      console.error('[Simulation Runner] Error executing Python script:', error);
      
      if (!responded) {
        responded = true;
        res.status(500).json({ 
          status: 'fail',
          error: 'Failed to execute Python script',
          message: error.message,
          details: 'Make sure Python 3 and Selenium are installed, and the script file exists',
          output: errorBuffer
        });
      }
    });

    // Timeout after 5 minutes
    setTimeout(() => {
      if (!responded && pythonProcess.exitCode === null) {
        responded = true;
        pythonProcess.kill();
        res.status(408).json({
          status: 'fail',
          error: 'Test execution timeout',
          message: 'Test took longer than 5 minutes to complete',
          output: outputBuffer || errorBuffer
        });
      }
    }, 5 * 60 * 1000);

  } catch (error: any) {
    console.error('[Simulation Runner] Unexpected error:', error);
    res.status(500).json({ 
      status: 'fail',
      error: 'Internal server error',
      message: error.message
    });
  } finally {
    // Clean up temporary file
    if (tempFilePath) {
      try {
        await fs.unlink(tempFilePath);
        console.log(`[Simulation Runner] Cleaned up temp file: ${tempFilePath}`);
      } catch (cleanupError) {
        console.error(`[Simulation Runner] Failed to clean up temp file: ${tempFilePath}`, cleanupError);
      }
    }
  }
});

export { router as simulationRunnerRoutes };
