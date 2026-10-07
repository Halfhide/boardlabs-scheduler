// Read-only deployment gate. A failed build leaves the previous release live.
// Never provision providers, change rules or print environment variable values.
if (process.env.VERCEL_ENV === 'production') {
  const required = ['FIREBASE_SERVICE_ACCOUNT', 'VITE_FIREBASE_PROJECT_ID', 'VITE_FIREBASE_API_KEY',
    'VITE_FIREBASE_AUTH_DOMAIN', 'VITE_FIREBASE_APP_ID', 'VITE_RECAPTCHA_SITE_KEY'];
  const missing = required.filter(key => !process.env[key]);
  if (missing.length) throw new Error(`Missing production configuration: ${missing.join(', ')}`);
  if (process.env.VITE_MEPPLE_EMULATORS === 'true' || process.env.MEPPLE_EMULATORS || process.env.VITE_APP_CHECK_DEBUG_TOKEN)
    throw new Error('Unsafe production emulator/debug configuration');
  let account;
  try { account = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT); }
  catch { throw new Error('Invalid server credential JSON'); }
  const projectId = process.env.VITE_FIREBASE_PROJECT_ID;
  if (account.project_id !== projectId) throw new Error('Client/server Firebase project mismatch');
  const { adminApp, adminAuth, adminDb } = await import('../server/admin.mjs');
  const { access_token: token } = await adminApp().options.credential.getAccessToken();
  const response = await fetch(`https://identitytoolkit.googleapis.com/admin/v2/projects/${encodeURIComponent(projectId)}/config`, {
    headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`Cannot verify Firebase Auth configuration (${response.status})`);
  const config = await response.json();
  if (!config.signIn?.anonymous?.enabled) throw new Error('Firebase Anonymous Auth must be enabled before this release');
  if (!config.signIn?.email?.enabled || config.signIn.email.passwordRequired) throw new Error('Firebase email-link sign-in must be enabled');
  if (!config.authorizedDomains?.includes('app.meppletime.today')) throw new Error('Production auth domain is not authorized');
  const google = await fetch(`https://identitytoolkit.googleapis.com/admin/v2/projects/${encodeURIComponent(projectId)}/defaultSupportedIdpConfigs/google.com`, {
    headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15000),
  });
  if (!google.ok || !(await google.json()).enabled) throw new Error('Google sign-in must be enabled');
  await adminAuth.listUsers(1);
  await adminDb.doc('_releaseChecks/read-only').get();
  await adminDb.terminate();
  console.log('Production configuration checks passed (read-only).');
}
