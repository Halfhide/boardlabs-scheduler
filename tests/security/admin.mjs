import { deleteApp } from 'firebase-admin/app';
import { adminApp, adminDb, adminAuth } from '../../server/admin.mjs';
export { adminDb, adminAuth };
export async function closeService() { await adminDb.terminate(); await deleteApp(adminApp()); }
