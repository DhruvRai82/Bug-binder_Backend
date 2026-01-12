import express from 'express';
// import { supabase } from '../lib/supabase';
import { authMiddleware } from '../../middleware/auth';

const router = express.Router();

router.use(authMiddleware);

// GET /api/admin/chats - Fetch all conversations
router.get('/', async (req, res) => {
    try {
        console.log('[Admin API] Fetching chats (Local Mode - Stubbed)...');
        // Return empty list for now as we are local-only
        res.json([]);
    } catch (error) {
        console.error('[Admin API] Fetch Chats Error:', error);
        res.status(500).json({ error: (error as Error).message });
    }
});

export const adminChatsRouter = router;
