import { Request } from 'express';

// Define the User interface based on usage in authMiddleware
export interface User {
    uid: string;
    email?: string;
    [key: string]: any; // Allow for other claims from Firebase token
}

declare global {
    namespace Express {
        interface Request {
            user?: User;
        }
    }
}
