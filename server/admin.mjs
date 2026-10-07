import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getAppCheck } from 'firebase-admin/app-check';

export const emulatorMode = process.env.MEPPLE_EMULATORS === 'true';
function config() {
  if (emulatorMode) {
    if (process.env.VERCEL || process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:18080'
      || process.env.FIREBASE_AUTH_EMULATOR_HOST !== '127.0.0.1:19099') throw new Error('Invalid emulator environment');
    return { projectId: 'demo-meppletime-local' };
  }
  if (process.env.FIRESTORE_EMULATOR_HOST || process.env.FIREBASE_AUTH_EMULATOR_HOST) throw new Error('Unexpected emulator configuration');
  if (!process.env.FIREBASE_SERVICE_ACCOUNT) throw new Error('Missing server credentials');
  return { credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) };
}
// Lazy initialization lets CI build the client without access to server secrets.
export function adminApp() {
  return getApps().find(app => app.name === 'meppletime-server') || initializeApp(config(), 'meppletime-server');
}
const lazy = factory => new Proxy({}, { get(_target, key) {
  const instance = factory(adminApp());
  return typeof instance[key] === 'function' ? instance[key].bind(instance) : instance[key];
} });
export const adminDb = lazy(getFirestore);
export const adminAuth = lazy(getAuth);
export const adminCheck = lazy(getAppCheck);
