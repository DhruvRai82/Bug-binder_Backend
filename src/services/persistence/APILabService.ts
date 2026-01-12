import { db } from '../../lib/firebase-admin';
import { v4 as uuidv4 } from 'uuid';

export class APILabService {

    // Helper to get collection ref
    private getColsRef(projectId: string) {
        return db.collection('projects').doc(projectId).collection('api_collections');
    }

    // --- Collections ---
    async getCollections(projectId: string) {
        try {
            const snapshot = await this.getColsRef(projectId).get();
            const collections = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                requests: [] as any[] // Lazy load these later
            }));

            // Sort by created_at if available
            collections.sort((a: any, b: any) => {
                const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
                const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
                return ta - tb;
            });

            return collections;
        } catch (error: any) {
            throw new Error(error.message);
        }
    }

    async getCollectionRequests(collectionId: string, projectId: string) {
        if (!projectId) throw new Error("ProjectId required");
        const snapshot = await this.getColsRef(projectId).doc(collectionId).collection('requests').get();
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }

    async createCollection(name: string, projectId: string) {
        const id = uuidv4();
        const newCol = {
            id,
            name,
            project_id: projectId,
            created_at: new Date().toISOString()
        };
        await this.getColsRef(projectId).doc(id).set(newCol);
        return { ...newCol, requests: [] };
    }

    async deleteCollection(id: string, projectId: string) {
        if (!projectId) throw new Error("ProjectId required");
        // Firestore requires deleting subcollections manually or recursive delete.
        // For simple structure, we just delete the document. 
        // Note: Subcollections are NOT automatically deleted by deleting parent in Firestore Client SDK,
        // but 'firebase-admin' might not cascade either.
        // Recursive delete is recommended but for now, we just delete the doc reference.
        // If data gets orphaned, we can run cleanup script later.
        await this.getColsRef(projectId).doc(id).delete();
    }

    // --- Requests ---
    async createRequest(collectionId: string, name: string, method: string, url: string, projectId: string) {
        if (!projectId) throw new Error("ProjectId required");

        const id = uuidv4();
        const newReq = {
            id,
            collection_id: collectionId,
            name,
            method,
            url,
            created_at: new Date().toISOString()
        };

        await this.getColsRef(projectId).doc(collectionId).collection('requests').doc(id).set(newReq);
        return newReq;
    }

    async updateRequest(id: string, updates: any, projectId: string) {
        if (!projectId) throw new Error("ProjectId required");

        // Iterate through all collections in the project to find the request
        const colsSnapshot = await this.getColsRef(projectId).get();

        for (const colDoc of colsSnapshot.docs) {
            const reqRef = colDoc.ref.collection('requests').doc(id);
            const reqSnap = await reqRef.get();

            if (reqSnap.exists) {
                await reqRef.update(updates);
                return { id, ...reqSnap.data(), ...updates };
            }
        }

        throw new Error('Request not found');
    }

    async deleteRequest(id: string, projectId: string) {
        if (!projectId) throw new Error("ProjectId required");

        const colsSnapshot = await this.getColsRef(projectId).get();

        for (const colDoc of colsSnapshot.docs) {
            const reqRef = colDoc.ref.collection('requests').doc(id);
            const reqSnap = await reqRef.get();

            if (reqSnap.exists) {
                await reqRef.delete();
                return;
            }
        }

        throw new Error('Request not found');
    }
}

export const apiLabService = new APILabService();
