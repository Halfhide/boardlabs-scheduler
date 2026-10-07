import { closeTestBrowser } from './close-test-browser.mjs';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { adminDb, adminAuth, closeService } from './admin.mjs';
const require = createRequire(new URL('../../package.json', import.meta.url));
const puppeteer = require('puppeteer-core');
const checks = [];
const pass = s => { checks.push(s); console.log(`PASS: ${s}`); };
const children = [
  spawn(process.execPath, ['node_modules/vite/bin/vite.js'], { cwd: process.cwd(), stdio: 'ignore', env: { ...process.env, VITE_TRUSTED_MODE: 'true' } }),
  spawn(process.execPath, ['tests/security/http.mjs'], { stdio: 'ignore' }),
];
const base = 'http://127.0.0.1:15173';
let browser;
let currentPage;
async function clickText(page, text) {
  await page.waitForFunction(text => [...document.querySelectorAll('button')].some(b => b.textContent.trim() === text && !b.disabled), {}, text);
  await page.waitForSelector('#splash', { hidden: true });
  const handle = await page.evaluateHandle(text => [...document.querySelectorAll('button')].find(b => b.textContent.trim() === text), text);
  await handle.asElement().click();
  await handle.dispose();
}
async function fill(page, selector, value) {
  await page.$eval(selector, (el, value) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }, value);
}
async function newPage() {
  const ctx = await browser.createBrowserContext();
  const p = await ctx.newPage(); currentPage = p;
  p.setDefaultTimeout(15000);
  p.on('console', m => { if (m.text().startsWith('Local ')) console.log(m.text()); });
  await p.setRequestInterception(true);
  p.on('request', r => {
    const url = new URL(r.url());
    if (['127.0.0.1', 'localhost'].includes(url.hostname) || ['data:', 'blob:'].includes(url.protocol)) r.continue();
    else r.abort();
  });
  return p;
}
async function createPoll(page, title) {
  await page.goto(`${base}/?lang=en`);
  await page.waitForSelector('#title');
  await fill(page, '#title', title);
  await fill(page, '#startDate', '2026-09-20');
  await fill(page, '#endDate', '2026-09-21');
  await clickText(page, 'Create poll');
  await page.waitForFunction(() => location.pathname.startsWith('/poll/'));
  await page.waitForFunction(() => document.body.innerText.includes('Close voting'));
  return page.url().split('/poll/')[1].split('?')[0];
}
async function emailSignIn(page, email) {
  await clickText(page, 'Sign in');
  await page.waitForSelector('#signin-email');
  await fill(page, '#signin-email', email);
  await clickText(page, 'Send sign-in link');
  await page.waitForFunction(() => document.body.innerText.includes('Check your inbox'));
  const res = await fetch('http://127.0.0.1:19099/emulator/v1/projects/demo-meppletime-local/oobCodes');
  const entry = (await res.json()).oobCodes.filter(c => c.email === email).at(-1);
  const query = new URL(entry.oobLink).searchParams;
  await page.goto(`${base}${new URL(page.url()).pathname}?${query}`);
  await page.waitForFunction(() => !location.search.includes('oobCode') && !document.querySelector('.fixed.inset-0'));
  await page.waitForSelector('#splash', { hidden: true });
}
async function readState(page) {
  return page.evaluate(async () => {
    const { auth, pendingAuth } = await import('/src/firebase.js');
    await Promise.all([auth.authStateReady(), pendingAuth.authStateReady()]);
    const raw = localStorage.getItem('meppletime-pending-transfer');
    return { uid: auth.currentUser?.uid, pending: pendingAuth.currentUser?.uid,
      marker: raw ? JSON.parse(raw) : null, hits: window.injectedFaultHits || 0 };
  });
}
async function sdk(page, action, value) {
  return page.evaluate(async ({ action, value }) => {
    const source = await (await fetch('/src/firebase.js')).text();
    const path = source.match(/from\s+["']([^"']*firebase_auth[^"']*)["']/)[1];
    const api = await import(path);
    const { auth, pendingAuth } = await import('/src/firebase.js');
    if (action === 'capture') {
      window.savedGuest = auth.currentUser;
      window.savedTarget = pendingAuth.currentUser;
    } else if (action === 'replace') {
      await api.signInWithEmailAndPassword(value.primary ? auth : pendingAuth, value.email, 'Synthetic-password-123!');
    } else if (action === 'restore') {
      await api.updateCurrentUser(auth, window.savedGuest);
      await api.updateCurrentUser(pendingAuth, window.savedTarget);
    } else if (action === 'proof') {
      return { guestToken: await auth.currentUser.getIdToken(true), accountToken: await pendingAuth.currentUser.getIdToken(true) };
    }
  }, { action, value });
}
async function fixture(label, count = 1) {
  const page = await newPage();
  const ids = [];
  for (let n = 0; n < count; n++) ids.push(await createPoll(page, `Synthetic identity ${label} ${n}`));
  const source = (await adminDb.doc(`pollsV2/${ids[0]}`).get()).data().ownerUid;
  await page.evaluate(async id => {
    const { trustedWrite } = await import('/src/utils/trustedClient.js');
    await trustedWrite(id, 'vote', { dateId: 'date0', name: 'Guest', response: 'yes' });
    await trustedWrite(id, 'comment', { dateId: 'date0', name: 'Guest', text: 'Preserve identity comment' });
  }, ids[0]);
  const email = `identity-${label}@example.test`;
  await emailSignIn(page, email);
  await page.waitForSelector('[data-testid="transfer-panel"]');
  const target = await adminAuth.getUserByEmail(email);
  return { page, ids, source, target };
}
async function finish(f) {
  await clickText(f.page, 'Move my polls and sign in');
  await f.page.waitForSelector('[aria-label="Account menu"]');
  await f.page.waitForSelector('[data-testid="transfer-panel"]', { hidden: true });
  assert.equal((await readState(f.page)).uid, f.target.uid);
  for (const id of f.ids) assert.equal((await adminDb.doc(`pollsV2/${id}`).get()).data().ownerUid, f.target.uid);
  const poll = (await adminDb.doc(`pollsV2/${f.ids[0]}`).get()).data();
  assert.equal(poll.dates[0].votes.length, 1);
  assert.equal(poll.dates[0].votes[0].uid, f.target.uid);
  assert.equal(poll.dates[0].comments.length, 1);
  assert.equal(poll.dates[0].comments[0].uid, f.target.uid);
}
try {
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(base)).ok) break; } catch { /* starting */ }
    await new Promise(r => setTimeout(r, 100));
  }
  browser = await puppeteer.launch({ executablePath: process.env.CHROME_EXECUTABLE || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true,
    args: ['--disable-background-networking', '--no-first-run'] });
  await mkdir('tests/results/browser', { recursive: true });
  for (const primary of [false, true]) {
    console.log(`STEP: in-flight ${primary ? 'primary' : 'pending'} account change`);
    const f = await fixture(primary ? 'primary' : 'pending');
    const other = await adminAuth.createUser({ email: `other-${primary}@example.test`, password: 'Synthetic-password-123!' });
    await sdk(f.page, 'capture');
    await f.page.evaluate(() => {
      const original = window.fetch;
      window.fetch = async (...args) => {
        const response = await original(...args);
        if (args[0] === '/api/trusted-migrate') {
          window.migrationResponseHeld = true;
          await new Promise(resolve => { window.releaseMigration = resolve; });
        }
        return response;
      };
    });
    await clickText(f.page, 'Move my polls and sign in');
    await f.page.waitForFunction(() => window.migrationResponseHeld);
    await sdk(f.page, 'replace', { primary, email: other.email });
    await f.page.evaluate(() => window.releaseMigration());
    await f.page.waitForSelector('[data-testid="transfer-panel"] [role="alert"]');
    const state = await readState(f.page);
    assert.equal(state.uid, primary ? other.uid : f.source);
    assert.equal(state.pending, primary ? f.target.uid : other.uid);
    assert.equal(state.marker.targetUid, f.target.uid);
    assert.equal((await adminDb.doc(`pollsV2/${f.ids[0]}`).get()).data().ownerUid, f.target.uid);
    assert.equal((await adminDb.collection(`usersV2/${other.uid}/history`).get()).size, 0);
    // Restore credentials only through the SDK to verify safe retry. This is
    // a harness operation, not a claim that recovery UI is implemented.
    await sdk(f.page, 'restore');
    await f.page.reload();
    await f.page.waitForSelector('[data-testid="transfer-panel"]');
    await finish(f);
    pass(`In-flight ${primary ? 'primary' : 'pending'} account replacement is not overwritten or signed out; original transfer remains retryable`);
    await f.page.browserContext().close();
    currentPage = null;
  }
  // Invalid proofs must not create a migration or change any poll.
  for (const kind of ['expired', 'revoked', 'disabled']) {
    console.log(`STEP: ${kind} account proof`);
    const f = await fixture(kind);
    const proof = await sdk(f.page, 'proof');
    if (kind === 'expired') {
      const parts = proof.accountToken.split('.');
      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
      payload.exp = Math.floor(Date.now() / 1000) - 3600;
      parts[1] = Buffer.from(JSON.stringify(payload)).toString('base64url');
      proof.accountToken = parts.join('.');
    } else if (kind === 'revoked') {
      // Auth timestamps have second precision. Ensure revocation is later.
      await new Promise(resolve => setTimeout(resolve, 1200));
      await adminAuth.revokeRefreshTokens(f.target.uid);
    } else await adminAuth.updateUser(f.target.uid, { disabled: true });
    const response = await fetch('http://127.0.0.1:15175/api/trusted-migrate', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Origin: base, Authorization: `Bearer ${proof.guestToken}` },
      body: JSON.stringify({ accountToken: proof.accountToken }),
    });
    assert.equal(response.status, 400);
    assert.equal((await adminDb.doc(`_identityMigrations/${f.source}`).get()).exists, false);
    assert.equal((await adminDb.doc(`pollsV2/${f.ids[0]}`).get()).data().ownerUid, f.source);
    pass(`${kind} destination proof is rejected before any migration writes`);
    await f.page.browserContext().close();
    currentPage = null;
  }
  // Delete only the application's marker while Auth credentials survive.
  const f = await fixture('lost-marker', 3);
  await f.page.evaluate(() => {
    const original = window.fetch;
    let calls = 0;
    window.fetch = (...args) => args[0] === '/api/trusted-migrate' && ++calls > 1
      ? Promise.reject(new Error('Injected interruption')) : original(...args);
  });
  await clickText(f.page, 'Move my polls and sign in');
  await f.page.waitForSelector('[data-testid="transfer-panel"] [role="alert"]');
  assert.equal((await adminDb.collection(`_identityMigrations/${f.source}/polls`).get()).size, 2);
  await f.page.evaluate(() => localStorage.removeItem('meppletime-pending-transfer'));
  await f.page.reload();
  await f.page.waitForSelector('[data-testid="transfer-panel"]');
  // Cancellation must consult durable server progress, not the lost marker.
  await f.page.waitForFunction(() => {
    const marker = JSON.parse(localStorage.getItem('meppletime-pending-transfer') || 'null');
    return marker?.targetUid && document.querySelector('[data-testid="transfer-cancel"]')?.disabled
      && !document.querySelector('[data-testid="transfer-confirm"]')?.disabled;
  });
  assert.equal((await readState(f.page)).marker.targetUid, f.target.uid);
  await finish(f);
  pass('Lost browser marker is restored from the authenticated guest migration, blocks cancellation and resumes remaining polls');
  await f.page.browserContext().close();
  currentPage = null;

  // A fresh isolated context represents complete loss of browser credentials.
  const lost = await fixture('lost-all');
  const fresh = await newPage();
  await fresh.goto(`${base}/poll/${lost.ids[0]}?lang=en`);
  await fresh.waitForSelector('#splash', { hidden: true });
  assert.equal((await readState(fresh)).uid, undefined);
  assert.equal(await fresh.evaluate(() => document.body.innerText.includes('Close voting')), false);
  await emailSignIn(fresh, lost.target.email);
  await fresh.waitForSelector('[aria-label="Account menu"]');
  assert.equal((await adminDb.doc(`pollsV2/${lost.ids[0]}`).get()).data().ownerUid, lost.source);
  assert.equal(await fresh.evaluate(() => document.body.innerText.includes('Close voting')), false);
  pass('Without original guest credentials, signing into an account cannot claim an untransferred guest poll');
  await writeFile('tests/results/trusted-identity-result.json', JSON.stringify({ testedAt: new Date().toISOString(), checks,
    limitations: ['Integrated repository code with local emulators; real OAuth, email delivery and production configuration require separate verification'] }, null, 2)+'\n');
} catch (error) {
  if (currentPage) console.error(await currentPage.evaluate(() => ({ text: document.body.innerText, marker: localStorage.getItem('meppletime-pending-transfer') })));
  throw error;
} finally {
  await closeTestBrowser(browser);
  for (const child of children) child.kill('SIGTERM');
  await closeService();
  for (const url of ['http://127.0.0.1:18080/emulator/v1/projects/demo-meppletime-local/databases/(default)/documents', 'http://127.0.0.1:19099/emulator/v1/projects/demo-meppletime-local/accounts']) {
    assert.ok((await fetch(url, { method: 'DELETE' })).ok);
  }
  console.log('Browser closed, local services stopped, synthetic data cleared.');
}
