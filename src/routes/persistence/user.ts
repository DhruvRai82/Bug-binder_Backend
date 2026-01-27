import { Router } from 'express';
import { userService } from '../../services/persistence/UserService';

const router = Router();

// Get current user profile
router.get('/profile', async (req, res) => {
    try {
        const uid = (req as any).user?.uid;
        if (!uid) return res.status(401).json({ error: 'User not authenticated' });

        const user = await userService.getUser(uid);
        if (!user) return res.status(404).json({ error: 'User not found' });

        res.json(user);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch profile' });
    }
});

// Update user settings/profile
router.put('/profile', async (req, res) => {
    try {
        const uid = (req as any).user?.uid;
        if (!uid) return res.status(401).json({ error: 'User not authenticated' });

        const { displayName, bio, photoURL, settings } = req.body;
        const updatedUser = await userService.updateProfile(uid, { displayName, bio, photoURL, settings });

        if (!updatedUser) return res.status(404).json({ error: 'User not found' });

        res.json(updatedUser);
    } catch (error) {
        console.error("Profile update failed:", error);
        res.status(500).json({ error: 'Failed to update profile' });
    }
});

// Delete Account
router.delete('/account', async (req, res) => {
    try {
        const uid = (req as any).user?.uid;
        if (!uid) return res.status(401).json({ error: 'User not authenticated' });

        const success = await userService.deleteAccount(uid);
        if (!success) return res.status(404).json({ error: 'User not found' });

        res.json({ status: 'deleted' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete account' });
    }
});

// Export Data (Full ZIP Backup)
router.get('/export', async (req, res) => {
    try {
        const uid = (req as any).user?.uid;
        if (!uid) return res.status(401).json({ error: 'User not authenticated' });

        // Ensure user exists before giving data
        const user = await userService.getUser(uid);
        if (!user) return res.status(404).json({ error: 'User not found' });

        const archiver = require('archiver');
        const path = require('path');

        // Path to the data directory (relative to this file: ../../../data)
        const dataDir = path.join(__dirname, '../../../data');

        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename=bugbinder_backup_${new Date().toISOString().split('T')[0]}.zip`);

        const archive = archiver('zip', {
            zlib: { level: 9 } // Sets the compression level.
        });

        // Good practice to catch warnings (ie stat failures and other non-blocking errors)
        archive.on('warning', function (err: any) {
            if (err.code === 'ENOENT') {
                console.warn('[Export] File not found warning:', err);
            } else {
                throw err;
            }
        });

        // good practice to catch this error explicitly
        archive.on('error', function (err: any) {
            console.error('[Export] Archive error:', err);
            if (!res.headersSent) {
                res.status(500).send({ error: err.message });
            }
        });

        // pipe archive data to the file
        archive.pipe(res);

        // append files from a sub-directory, putting its contents at the root of archive
        archive.directory(dataDir, false);

        // finalize the archive (ie we are done appending files but streams have to finish yet)
        // 'close', 'end' or 'finish' may be fired right after this of after a little while
        await archive.finalize();

    } catch (error) {
        console.error('[Export] Fatal error:', error);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Failed to export data' });
        }
    }
});

export { router as userRoutes };
