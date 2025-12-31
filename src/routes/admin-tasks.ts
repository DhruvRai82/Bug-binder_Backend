import express from 'express';
// import { supabase } from '../lib/supabase';

const router = express.Router();

// GET /api/admin/tasks
router.get('/', async (req, res) => {
    // Return empty list or mock list
    res.json([]);
});

export const adminTasksRouter = router;
