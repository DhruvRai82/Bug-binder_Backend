
import fs from 'fs/promises';
import path from 'path';

const DATA_DIR = path.join(__dirname, '../../../data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

export interface User {
    uid: string;
    email: string;
    role: 'admin' | 'user' | 'viewer';
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
        console.log(`[UserService] Reading from: ${USERS_FILE}`);
        try {
            const data = await fs.readFile(USERS_FILE, 'utf-8');
            return JSON.parse(data);
        } catch (error) {
            console.warn(`[UserService] Read Failed or File Missing: ${error}`);
            if ((error as any).code === 'ENOENT') {
                return { users: [] };
            }
            throw error;
        }
    }

    private async writeUsersFile(data: UsersData): Promise<void> {
        console.log(`[UserService] Writing to: ${USERS_FILE} | Users Count: ${data.users.length}`);
        await this.ensureDataDir();
        try {
            await fs.writeFile(USERS_FILE, JSON.stringify(data, null, 2));
            console.log(`[UserService] Write Successful.`);
        } catch (err) {
            console.error(`[UserService] Write Failed:`, err);
            throw err;
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
                updatedAt: new Date().toISOString()
            };
            data.users.push(user);
            await this.writeUsersFile(data);
            console.log(`[UserService] Created new user: ${email} (${user.role})`);
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
}

export const userService = new UserService();
