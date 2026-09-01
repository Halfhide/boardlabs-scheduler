import { initializeApp } from 'firebase/app';
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// App Check (reCAPTCHA v3): proves requests come from the real app.
// Dormant until VITE_RECAPTCHA_SITE_KEY is set, so dev and any build
// without the key behave exactly as before. The client mints tokens
// as soon as the key exists; Firestore only REQUIRES them once
// enforcement is turned on in the console (deliberately last, so we
// never lock users out before tokens are confirmed flowing).
const recaptchaSiteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY;
if (recaptchaSiteKey) {
  // Debug tokens let builds on hostnames reCAPTCHA does not know
  // reach Firestore under App Check enforcement. Local dev prints a
  // per-browser token to register in the console's debug list. Vercel
  // preview deployments instead carry a fixed token via
  // VITE_APP_CHECK_DEBUG_TOKEN, which must be scoped to the Preview
  // environment ONLY (in Production it would weaken App Check to the
  // secrecy of that token) and registered once in the Firebase
  // console. Unregistered tokens are rejected, so this path grants
  // nothing by itself.
  const debugToken = import.meta.env.VITE_APP_CHECK_DEBUG_TOKEN;
  if (import.meta.env.DEV || debugToken) {
    self.FIREBASE_APPCHECK_DEBUG_TOKEN = debugToken || true;
  }
  initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider(recaptchaSiteKey),
    isTokenAutoRefreshEnabled: true
  });
}

// Initialize Firestore
export const db = getFirestore(app);

// Initialize Auth (sign-in is optional app-wide; see src/auth/)
export const auth = getAuth(app);
