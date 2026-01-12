import { Router } from 'express';
import { spawn } from 'child_process';
import path from 'path';

const router = Router();

// Run Python Selenium test in visible browser
router.post('/run-test', async (req, res) => {
  try {
    console.log('[Test Runner] Starting Python Selenium test execution...');

    // Path to the Python test script
    const scriptPath = path.join(process.cwd(), 'your_test_script.py');
    
    // Spawn Python process with visible browser settings
    const pythonProcess = spawn('python3', [scriptPath], {
      stdio: 'inherit', // Show output in console
      windowsHide: false, // Ensure browser window is visible
      env: {
        ...process.env,
        PYTHONUNBUFFERED: '1', // Disable Python output buffering
      }
    });

    let exitCode: number | null = null;

    // Handle process completion
    pythonProcess.on('close', (code) => {
      exitCode = code;
      console.log(`[Test Runner] Python process exited with code ${code}`);

      if (code === 0) {
        res.json({ 
          status: 'pass',
          message: 'Test completed successfully',
          exitCode: code
        });
      } else {
        res.json({ 
          status: 'fail',
          message: 'Test failed with errors',
          exitCode: code
        });
      }
    });

    // Handle process errors
    pythonProcess.on('error', (error) => {
      console.error('[Test Runner] Error executing Python script:', error);
      
      if (exitCode === null) {
        res.status(500).json({ 
          status: 'fail',
          error: 'Failed to execute Python script',
          message: error.message,
          details: 'Make sure Python 3 and Selenium are installed'
        });
      }
    });

  } catch (error: any) {
    console.error('[Test Runner] Unexpected error:', error);
    res.status(500).json({ 
      status: 'fail',
      error: 'Internal server error',
      message: error.message
    });
  }
});

export { router as testRunnerRoutes };
