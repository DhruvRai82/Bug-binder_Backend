
import fs from 'fs/promises';
import path from 'path';
import { logger } from '../../lib/logger';

const DATA_DIR = path.join(__dirname, '../../../data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

export interface User {
    uid: string;
    email: string;
    role: 'admin' | 'user' | 'viewer';
    displayName?: string;
    photoURL?: string;
    bio?: string;
    settings?: Record<string, unknown>;
    createdAt: string;
    updatedAt: string;
}

export interface UsersData {
    users: User[];
}

class UserService {
    private async ensureDataDir() {
        try {
            await fs.access(DATA_DIR);
        } catch {
            await fs.mkdir(DATA_DIR, { recursive: true });
        }
    }

    private async readUsersFile(): Promise<UsersData> {
        await this.ensureDataDir();
        logger.debug('Reading users file', { filePath: USERS_FILE });
        try {
            const data = await fs.readFile(USERS_FILE, 'utf-8');
            return JSON.parse(data);
        } catch (error: unknown) {
            if (error instanceof Error && 'code' in error && (error as any).code === 'ENOENT') {
                logger.debug('Users file not found, returning empty', { filePath: USERS_FILE });
                return { users: [] };
            }
            if (error instanceof Error) {
                logger.error('Failed to read users file', error, { filePath: USERS_FILE });
            }
            throw error;
        }
    }

    private async writeUsersFile(data: UsersData): Promise<void> {
        logger.debug('Writing users file', { filePath: USERS_FILE, userCount: data.users.length });
        await this.ensureDataDir();
        try {
            await fs.writeFile(USERS_FILE, JSON.stringify(data, null, 2));
            logger.debug('Users file write successful');
        } catch (error: unknown) {
            if (error instanceof Error) {
                logger.error('Failed to write users file', error, { filePath: USERS_FILE });
            }
            throw error;
        }
    }

    async getUser(uid: string): Promise<User | undefined> {
        const data = await this.readUsersFile();
        return data.users.find(u => u.uid === uid);
    }

    async ensureUser(uid: string, email: string): Promise<User> {
        const data = await this.readUsersFile();
        let user = data.users.find(u => u.uid === uid);

        if (!user) {
            // First user is Admin? Or just 'user'? 
            // Let's make everyone 'user' by default for safety.
            // But if it's the VERY first user in the file, maybe admin?
            const isFirst = data.users.length === 0;

            user = {
                uid,
                email,
                role: isFirst ? 'admin' : 'user',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                settings: {}
            };
            data.users.push(user);
            await this.writeUsersFile(data);
            logger.info('Created new user', { email, role: user.role });
        } else if (user.email !== email) {
            // Update email if changed (optional)
            user.email = email;
            user.updatedAt = new Date().toISOString();
            await this.writeUsersFile(data);
        }

        return user;
    }

    async updateUserRole(uid: string, role: 'admin' | 'user' | 'viewer'): Promise<User | null> {
        const data = await this.readUsersFile();
        const user = data.users.find(u => u.uid === uid);
        if (!user) return null;

        user.role = role;
        user.updatedAt = new Date().toISOString();
        await this.writeUsersFile(data);
        return user;
    }

    async updateProfile(uid: string, updates: Partial<Pick<User, 'displayName' | 'photoURL' | 'bio' | 'settings'>>): Promise<User | null> {
        const data = await this.readUsersFile();
        const user = data.users.find(u => u.uid === uid);
        if (!user) return null;

        // Merge top-level fields
        if (updates.displayName !== undefined) user.displayName = updates.displayName;
        if (updates.photoURL !== undefined) user.photoURL = updates.photoURL;
        if (updates.bio !== undefined) user.bio = updates.bio;

        // Deep merge settings if provided
        if (updates.settings) {
            user.settings = { ...user.settings, ...updates.settings };
        }

        user.updatedAt = new Date().toISOString();

        await this.writeUsersFile(data);
        return user;
    }

    async deleteAccount(uid: string): Promise<boolean> {
        const data = await this.readUsersFile();
        const initialLength = data.users.length;
        data.users = data.users.filter(u => u.uid !== uid);

        if (data.users.length < initialLength) {
            await this.writeUsersFile(data);
            return true;
        }
        return false;
    }
}

export const userService = new UserService();
