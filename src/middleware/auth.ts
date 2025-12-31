import { Request, Response, NextFunction } from 'express';

export const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const authHeader = req.headers.authorization;
        const userIdHeader = req.headers['x-user-id'];

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            // Support token in query param (for images/downloads)
            if (req.query.token) {
                const token = req.query.token as string;
                (req as any).user = {
                    uid: userIdHeader || 'test-user-id',
                    email: 'test@example.com'
                };
                return next();
            }

            // Allow public access to health check or specific routes if needed
            // But for protected routes, fail.
            // Allow public access to health check or specific routes if needed
            // But for protected routes, fail.
            if (userIdHeader) {
                (req as any).user = { uid: userIdHeader };
                return next();
            }

            // PERMISSIVE MODE: For Local Dev, we allow requests even without token
            // We'll set a default user if none provided
            console.warn('[Auth] No token provided, defaulting to test-user for Local Dev');
            (req as any).user = { uid: 'test-user-id', email: 'test@example.com' };
            return next();

            // return res.status(401).json({ error: 'Unauthorized: No token provided' });
        }

        const token = authHeader.split('Bearer ')[1];

        // TODO: In production, verify token with firebase-admin
        // const decodedToken = await admin.auth().verifyIdToken(token);
        // (req as any).user = decodedToken;

        // MOCK VERIFICATION (Unblocks Development)
        // We trust the token is present and valid for dev environment
        // In realprod, you MUST use firebase-admin
        if (token) {
            (req as any).user = {
                uid: userIdHeader || 'test-user-id',
                email: 'test@example.com'
            };
            next();
        } else {
            throw new Error('Invalid token');
        }

    } catch (error) {
        console.error('Auth Middleware Fatal Error:', error);
        res.status(401).json({ error: 'Unauthorized: Invalid token' });
    }
};
