import admin from 'firebase-admin';
import dotenv from 'dotenv';

dotenv.config();

// Initialize Firebase Admin
// Expects GOOGLE_APPLICATION_CREDENTIALS environment variable to be set
// or service account credentials to be provided via other means.
try {
    admin.initializeApp({
        projectId: process.env.FIREBASE_PROJECT_ID || 'bug-binder'
    });
    console.log('Firebase Admin initialized with projectId:', process.env.FIREBASE_PROJECT_ID || 'bug-binder');
} catch (error) {
    console.error('Firebase Admin initialization failed:', error);
}

export const auth = admin.auth();
