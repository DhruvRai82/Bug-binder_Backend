// Re-export from the single source of truth
import { auth, admin, db } from './lib/firebase-admin';

export { auth, admin, db };
export default admin;
