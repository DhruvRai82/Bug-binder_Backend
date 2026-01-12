import { db } from '../../lib/firebase-admin';
import { v4 as uuidv4 } from 'uuid';

export interface TestSuite {
    id: string;
    project_id: string;
    name: string;
    description?: string;
    fileIds: string[];
    config?: any;
    created_at: string;
    updated_at: string;
}

export class SuiteService {

    private getSuitesRef(projectId: string) {
        return db.collection('projects').doc(projectId).collection('test_suites');
    }

    async getSuites(projectId: string): Promise<TestSuite[]> {
        if (!projectId) throw new Error("Project ID required");

        const snapshot = await this.getSuitesRef(projectId).orderBy('created_at', 'desc').get();
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as TestSuite));
    }

    async getSuite(projectId: string, suiteId: string): Promise<TestSuite | null> {
        if (!projectId || !suiteId) throw new Error("Project ID and Suite ID required");

        const doc = await this.getSuitesRef(projectId).doc(suiteId).get();
        if (!doc.exists) return null;

        return { id: doc.id, ...doc.data() } as TestSuite;
    }

    async createSuite(projectId: string, name: string, fileIds: string[], description?: string): Promise<TestSuite> {
        if (!projectId) throw new Error("Project ID required");
        if (!name) throw new Error("Suite name required");

        const id = uuidv4();
        const now = new Date().toISOString();

        const newSuite: TestSuite = {
            id,
            project_id: projectId,
            name,
            description: description || "",
            fileIds: fileIds || [],
            created_at: now,
            updated_at: now
        };

        await this.getSuitesRef(projectId).doc(id).set(newSuite);
        return newSuite;
    }

    async updateSuite(projectId: string, suiteId: string, updates: Partial<TestSuite>): Promise<TestSuite> {
        if (!projectId || !suiteId) throw new Error("Project ID and Suite ID required");

        const ref = this.getSuitesRef(projectId).doc(suiteId);
        const doc = await ref.get();
        if (!doc.exists) throw new Error("Suite not found");

        const updatedData = {
            ...updates,
            updated_at: new Date().toISOString()
        };

        // Prevent changing immutable IDs via update
        delete (updatedData as any).id;
        delete (updatedData as any).project_id;
        delete (updatedData as any).created_at;

        await ref.update(updatedData);
        return { ...(doc.data() as TestSuite), ...updatedData, id: suiteId };
    }

    async deleteSuite(projectId: string, suiteId: string): Promise<void> {
        if (!projectId || !suiteId) throw new Error("Project ID and Suite ID required");
        await this.getSuitesRef(projectId).doc(suiteId).delete();
    }
}

export const suiteService = new SuiteService();
