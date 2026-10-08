import { spawnSync } from 'node:child_process';
import process from 'node:process';
import { expect, it } from 'vitest';
const run = env => spawnSync(process.execPath, ['scripts/check-production.mjs'], { env, encoding: 'utf8' });
it('allows local CI builds without accessing production credentials', () => {
  expect(run({}).status).toBe(0);
});
it('refuses a production build missing configuration before any cloud calls', () => {
  const result = run({ VERCEL_ENV: 'production' });
  expect(result.status).not.toBe(0);
  expect(result.stderr).toContain('Missing production configuration');
});
it('refuses production debug or emulator flags before using credentials', () => {
  const result = run({ VERCEL_ENV: 'production', FIREBASE_SERVICE_ACCOUNT: '{}', VITE_FIREBASE_PROJECT_ID: 'test',
    VITE_FIREBASE_API_KEY: 'test', VITE_FIREBASE_AUTH_DOMAIN: 'test', VITE_FIREBASE_APP_ID: 'test',
    VITE_RECAPTCHA_SITE_KEY: 'test', VITE_MEPPLE_EMULATORS: 'true' });
  expect(result.status).not.toBe(0);
  expect(result.stderr).toContain('Unsafe production emulator/debug configuration');
});
