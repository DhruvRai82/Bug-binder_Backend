import { Router } from 'express';

const router = Router();

// Get current user profile
router.get('/profile', (req, res) => {
    // Mock user for now or use middleware user
    const user = (req as any).user || { name: 'Guest', role: 'Viewer' };
    res.json(user);
});

// Get user role
router.get('/role', (req, res) => {
    // Mock role for now
    res.json({ role: 'admin' });
});

// Update user settings
router.put('/settings', (req, res) => {
    res.json({ status: 'updated' });
});

export { router as userRoutes };
