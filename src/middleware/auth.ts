import { Request, Response, NextFunction } from 'express';
import { auth } from '../firebase';
import { userService } from '../services/persistence/UserService';

export const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const authHeader = req.headers.authorization;

        // 1. Check for Bearer Token
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            // Support token in query param (temporary/download) or skip if public
            // For now, strict check.

            // LOCAL DEV FALLBACK (ONLY IF ENV IS SET)
            if (process.env.NODE_ENV === 'development' && !authHeader) {
                // Check if client sent x-user-id for simulation
                const userIdHeader = req.headers['x-user-id'];
                if (userIdHeader) {
                    // Simulate fetch
                    const user = await userService.ensureUser(userIdHeader as string, 'dev@example.com');
                    (req as any).user = { ...user, uid: user.uid };
                    return next();
                }
            }

            return res.status(401).json({ error: 'Unauthorized: No token provided' });
        }

        const token = authHeader.split('Bearer ')[1];

        // 2. Verify Token with Firebase Admin
        try {
            const decodedToken = await auth.verifyIdToken(token);

            // 3. Sync/Get User from Local DB
            // We use ensureUser to auto-register if new
            const user = await userService.ensureUser(decodedToken.uid, decodedToken.email || 'no-email@example.com');

            // 4. Attach to Request
            (req as any).user = {
                ...decodedToken,
                // Override/Extend with local data
                uid: user.uid, // Explicitly ensure we use the local UID concept if different (it shouldn't be)
                email: user.email,
                role: user.role
            };

            next();
        } catch (verifyError) {
            console.error('[Auth] Token Verification Failed:', verifyError);
            // Fallback for Dev if verification fails? No, failed verification is actionable.
            return res.status(401).json({ error: 'Unauthorized: Invalid token' });
        }

    } catch (error) {
        console.error('Auth Middleware Fatal Error:', error);
        res.status(500).json({ error: 'Internal Server Error during Auth' });
    }
};
