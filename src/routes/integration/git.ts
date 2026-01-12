import express from 'express';
import simpleGit, { SimpleGit } from 'simple-git';
import path from 'path';

export const gitRoutes = express.Router();

// Initialize git instance at project root
const getGit = (): SimpleGit => {
  // Backend runs from /backend dir, so go up one level to project root
  const gitWorkingDir = path.join(process.cwd(), '..');

  // Check if .git exists to avoid crashing
  // In Docker without volume mount, this might be missing.
  // We check for .git or config file to be sure.
  /* 
     Actually, simple-git doesn't throw on init, but on command execution.
     We will handle the error in the route.
  */
  // console.log('[Git] Working directory:', gitWorkingDir);
  return simpleGit(gitWorkingDir);
};

// GET /api/git/status - Check Git status
gitRoutes.get('/status', async (req, res) => {
  try {
    const git = getGit();

    // Check if it's a repo first
    const isRepo = await git.checkIsRepo();
    if (!isRepo) {
      return res.json({
        status: 'NO_GIT',
        message: 'Not a git repository',
        details: 'Git features disabled in this environment'
      });
    }

    const status = await git.status();

    // Check if there are any changes
    if (status.files.length === 0) {
      // Check if remote is ahead
      if (status.behind > 0) {
        return res.json({
          status: 'BEHIND',
          message: 'Remote has new changes',
          details: `${status.behind} commit(s) behind origin`
        });
      }

      return res.json({
        status: 'CLEAN',
        message: 'No changes to commit',
        details: 'Working directory is clean'
      });
    }

    return res.json({
      status: 'MODIFIED',
      message: 'Uncommitted changes detected',
      details: `${status.files.length} file(s) modified`,
      files: status.files.map(f => f.path)
    });
  } catch (error: any) {
    // console.error('[Git] Status check error:', error); // Suppress log spam
    res.status(200).json({ // Return 200 with error status to handle gracefully on frontend
      status: 'ERROR',
      message: 'Git status check failed',
      details: error.message
    });
  }
});

// POST /api/git/pull - Pull changes from remote
gitRoutes.post('/pull', async (req, res) => {
  try {
    const git = getGit();

    // Fetch first to check remote status
    await git.fetch();

    // Pull with merge strategy
    const result = await git.pull('origin', 'main', { '--no-rebase': null });

    if (result.summary.changes > 0 || result.summary.insertions > 0 || result.summary.deletions > 0) {
      return res.json({
        success: true,
        message: 'Pulled latest changes successfully',
        details: `${result.summary.changes} file(s) updated`
      });
    }

    res.json({
      success: true,
      message: 'Already up to date',
      details: 'No new changes from remote'
    });
  } catch (error: any) {
    console.error('[Git] Pull error:', error);

    // Check for merge conflicts
    if (error.message.includes('CONFLICT') || error.message.includes('conflict')) {
      return res.status(409).json({
        success: false,
        message: 'Merge conflict detected',
        details: 'Please resolve conflicts manually before continuing',
        error: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to pull changes',
      details: error.message
    });
  }
});

// POST /api/git/commit_push - Commit and push changes
gitRoutes.post('/commit_push', async (req, res) => {
  try {
    const { commitMessage } = req.body;

    if (!commitMessage || commitMessage.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Commit message is required',
        details: 'Please provide a valid commit message'
      });
    }

    const git = getGit();

    // Check status first
    const status = await git.status();

    if (status.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No changes to commit',
        details: 'Working directory is clean'
      });
    }

    // Add all files
    await git.add('.');

    // Commit
    const commitResult = await git.commit(commitMessage.trim());
    console.log('[Git] Commit result:', commitResult);

    // Push to remote
    try {
      const pushResult = await git.push('origin', 'main');
      console.log('[Git] Push result:', pushResult);

      res.json({
        success: true,
        message: 'Commit and push successful',
        details: `Committed: "${commitMessage.trim()}"`,
        commit: commitResult.commit
      });
    } catch (pushError: any) {
      // Check if push was rejected (remote has new commits)
      if (pushError.message.includes('rejected') || pushError.message.includes('non-fast-forward')) {
        return res.status(409).json({
          success: false,
          message: 'Push rejected - Remote has new changes',
          details: 'Please Pull & Sync first, then try again',
          error: 'Remote branch is ahead of local branch'
        });
      }

      // Check for authentication failure
      if (pushError.message.includes('Authentication') || pushError.message.includes('permission')) {
        return res.status(401).json({
          success: false,
          message: 'Authentication failed',
          details: 'Git credentials not configured or invalid'
        });
      }

      throw pushError;
    }
  } catch (error: any) {
    console.error('[Git] Commit/Push error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to commit and push',
      details: error.message
    });
  }
});
