import express from 'express';
import { db } from '../lib/firebase-admin';
import { unifiedProjectService } from '../services/UnifiedProjectService';

const router = express.Router();

// Sync User from Frontend (called after Google Login)
router.post('/sync', async (req, res) => {
    try {
        const { uid, email, displayName, photoURL } = req.body;

        if (!uid || !email) {
            res.status(400).json({ error: 'Missing uid or email' });
            return;
        }

        const userRef = db.collection('users').doc(uid);
        const doc = await userRef.get();

        const now = new Date().toISOString();
        const userData = {
            id: uid,
            email,
            user_metadata: {
                full_name: displayName,
                avatar_url: photoURL
            },
            last_seen: now
        };

        if (doc.exists) {
            // Update
            await userRef.update(userData);
        } else {
            // Create
            await userRef.set({
                ...userData,
                created_at: now
            });
        }

        console.log(`[Auth] Synced User to Firestore: ${email} (${uid})`);

        // Trigger Auto-Sync of Local Projects to Firestore
        // This ensures if data is missing in cloud but exists locally, it gets pushed.
        await unifiedProjectService.syncUserProjects(uid);

        res.json({ status: 'synced', user: userData });
    } catch (error: any) {
        console.error('[Auth] Sync Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Mock Login for compatibility (if needed)
router.post('/login', (req, res) => {
    res.json({ token: 'mock-token' });
});

export const authRouter = router;
