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
    else if (r.resourceType() === 'script' && url.origin === 'https://apis.google.com') r.continue();
    else r.abort();
  });
  return p;
}
async function createPoll(page, title) {
  await page.goto(`${base}/?lang=en`);
  await page.waitForSelector('#title');
  await fill(page, '#title', title);
  await fill(page, '#startDate', '2026-10-20');
  await fill(page, '#endDate', '2026-10-21');
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
async function interrupt(f) {
  await f.page.evaluate(() => {
    const original = window.fetch; let calls = 0;
    window.fetch = (...args) => args[0] === '/api/trusted-migrate' && ++calls > 1
      ? Promise.reject(new Error('Injected interruption')) : original(...args);
  });
  await clickText(f.page, 'Move my polls and sign in');
  await f.page.waitForSelector('[data-testid="transfer-panel"] [role="alert"]');
  assert.equal((await adminDb.collection(`_identityMigrations/${f.source}/polls`).get()).size, 2);
  await f.page.reload();
  await f.page.waitForFunction(() => !document.querySelector('[data-testid="transfer-confirm"]')?.disabled);
}
async function openRecovery(page) {
  await page.waitForSelector('#splash', { hidden: true });
  await page.waitForSelector('[data-testid="transfer-recovery"]');
  if (!await page.$eval('[data-testid="transfer-recovery"]', el => el.open)) await page.click('[data-testid="transfer-recovery"] summary');
  await page.waitForFunction(() => document.querySelector('[data-testid="transfer-recovery"]').open);
}
async function recoveryLink(page, email) {
  await openRecovery(page);
  await fill(page, '#recovery-email', email);
  await clickText(page, 'Send sign-in link');
  await page.waitForSelector('[data-testid="transfer-recovery"] [role="status"]');
  const response = await fetch('http://127.0.0.1:19099/emulator/v1/projects/demo-meppletime-local/oobCodes');
  const entry = (await response.json()).oobCodes.filter(c => c.email === email).at(-1);
  return `${base}${new URL(page.url()).pathname}?${new URL(entry.oobLink).searchParams}`;
}
async function noCandidate(page) {
  assert.equal(await page.evaluate(async () => {
    const { recoveryAuth } = await import('/src/firebase.js');
    await recoveryAuth.authStateReady(); return recoveryAuth.currentUser?.uid;
  }), undefined);
}
async function popupRecovery(page) {
  await openRecovery(page);
  const next = page.browserContext().waitForTarget(t => t.type() === 'page' && t.opener() === page.target());
  await page.click('[data-testid="recovery-google"]');
  const popup = await (await next).page();
  await popup.waitForSelector('#add-account-button');
  await popup.waitForFunction(() => document.readyState === 'complete' && typeof finishWithUser === 'function');
  return popup;
}
async function chooseGoogle(popup, email) {
  await popup.$eval('#add-account-button', el => el.click());
  await popup.waitForSelector('#email-input', { visible:true });
  await popup.type('#email-input', email);
  await popup.type('#display-name-input', 'Marta');
  await popup.click('#sign-in');
}
try {
  for (let i=0;i<100;i++) { try { if((await fetch(base)).ok) break; } catch {} await new Promise(r=>setTimeout(r,100)); }
  browser = await puppeteer.launch({ executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless:true });
  const f = await fixture('recovery-email',3);
  await interrupt(f);
  const before = await readState(f.page);
  const wrongLink = await recoveryLink(f.page, 'wrong-recovery@example.test');
  await f.page.goto(wrongLink);
  await f.page.waitForFunction(() => document.body.innerText.includes('This is not the account selected'));
  assert.deepEqual(await readState(f.page), before);
  await noCandidate(f.page);
  pass('Wrong email link is rejected without changing guest, pending destination or durable marker');
  const emailFallbackPopup = await popupRecovery(f.page);
  await chooseGoogle(emailFallbackPopup, f.target.email);
  await f.page.waitForFunction(() => document.body.innerText.includes('You are signed in to the original account again'));
  assert.equal(await f.page.$('[data-testid="transfer-recovery"] [role="alert"]'), null);
  assert.equal((await readState(f.page)).uid, f.source);
  await noCandidate(f.page);
  pass('Google recovery after a rejected email link clears the stale error and keeps the guest session');
  await f.page.reload();
  // Simulate revoked credentials and lost pending session, retaining the guest.
  await adminAuth.revokeRefreshTokens(f.target.uid);
  await f.page.evaluate(async () => {
    const source = await (await fetch('/src/firebase.js')).text();
    const api = await import(source.match(/from\s+["']([^"']*firebase_auth[^"']*)["']/)[1]);
    const { pendingAuth } = await import('/src/firebase.js'); await api.signOut(pendingAuth);
  });
  const correctLink = await recoveryLink(f.page, f.target.email);
  await f.page.goto(correctLink);
  await f.page.waitForFunction(() => !location.search.includes('oobCode'));
  await f.page.waitForFunction(async uid => (await import('/src/firebase.js')).pendingAuth.currentUser?.uid === uid, {}, f.target.uid);
  assert.equal((await readState(f.page)).uid, f.source);
  assert.equal((await readState(f.page)).marker.targetUid, f.target.uid);
  await noCandidate(f.page);
  await finish(f);
  pass('Fresh email link restores missing/revoked pending credentials and completes partial migration with intact activity');
  await f.page.browserContext().close();

  const g = await fixture('recovery-google',3);
  await interrupt(g);
  const original = await readState(g.page);
  let popup = await popupRecovery(g.page); await popup.close();
  await g.page.waitForFunction(() => !document.querySelector('[data-testid="recovery-google"]').disabled);
  assert.deepEqual(await readState(g.page),original); await noCandidate(g.page);
  pass('Cancelled recovery popup preserves both sessions and the migration');
  popup = await popupRecovery(g.page); await chooseGoogle(popup,'wrong-google-recovery@example.test');
  await g.page.waitForFunction(() => document.body.innerText.includes('This is not the account selected'));
  assert.deepEqual(await readState(g.page),original); await noCandidate(g.page);
  pass('Wrong Google account never replaces either durable session');
  popup = await popupRecovery(g.page); await chooseGoogle(popup,g.target.email);
  await g.page.waitForFunction(() => document.body.innerText.includes('You are signed in to the original account again'));
  assert.equal((await readState(g.page)).uid,g.source); await noCandidate(g.page);
  await finish(g);
  pass('Original Google account restores destination access; explicit retry finishes with one copy of activity');
  await g.page.browserContext().close();

  const h = await fixture('recovery-source-race',3);
  await interrupt(h);
  const other = await adminAuth.createUser({email:'recovery-other-main@example.test', password:'Synthetic-password-123!'});
  popup = await popupRecovery(h.page);
  await sdk(h.page,'replace',{primary:true,email:other.email});
  await chooseGoogle(popup,h.target.email);
  await h.page.waitForFunction(() => document.body.innerText.includes('Return to the browser session'));
  await h.page.waitForFunction(async () => !(await import('/src/firebase.js')).recoveryAuth.currentUser);
  assert.equal((await readState(h.page)).uid,other.uid);
  assert.equal((await readState(h.page)).marker.targetUid,h.target.uid);
  assert.equal((await adminDb.collection(`_identityMigrations/${h.source}/polls`).get()).size,2);
  pass('Primary account change during recovery blocks candidate installation and leaves the migration locked');
  await writeFile('tests/results/trusted-recovery-result.json',JSON.stringify({testedAt:new Date().toISOString(),checks,limitations: ['Integrated repository code with local emulators; real OAuth, email delivery and production configuration require separate verification']},null,2)+'\n');
} catch(error) {
  if(currentPage && !currentPage.isClosed()) console.error(await currentPage.evaluate(()=>document.body.innerText));
  throw error;
} finally {
  await closeTestBrowser(browser);
  for(const child of children) child.kill('SIGTERM');
  await closeService();
  for(const url of ['http://127.0.0.1:18080/emulator/v1/projects/demo-meppletime-local/databases/(default)/documents','http://127.0.0.1:19099/emulator/v1/projects/demo-meppletime-local/accounts']) assert.ok((await fetch(url,{method:'DELETE'})).ok);
  console.log('Browser closed, local services stopped, synthetic data cleared.');
}
