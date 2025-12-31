import express from 'express';
// import { supabase } from '../lib/supabase';

const router = express.Router();

// GET /api/admin/db/*
router.get('/', async (req, res) => {
    // Return empty list or mock response
    res.json({ message: 'DB Admin stubbed for Local Mode' });
});

export const adminDbRouter = router;
