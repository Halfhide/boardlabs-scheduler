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
const requestFaults = new WeakMap();
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
  p.setDefaultTimeout(30000);
  p.on('console', m => { if (m.text().startsWith('Local ') || m.text().includes('Firestore')) console.log(m.text()); });
  await p.setRequestInterception(true);
  p.on('request', r => {
    if (requestFaults.get(p)?.(r)) return r.abort();
    const url = new URL(r.url());
    const googleLibrary = r.resourceType() === 'script' && url.origin === 'https://apis.google.com'
      && (url.pathname === '/js/api.js' || url.pathname.startsWith('/_/scs/'));
    if (['127.0.0.1', 'localhost'].includes(url.hostname) || ['data:', 'blob:'].includes(url.protocol) || googleLibrary) r.continue();
    else { console.log('BLOCKED:', url.origin, url.pathname); r.abort(); }
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
async function googlePopup(page) {
  console.log('STEP: opening Google sign-in');
  await clickText(page, 'Sign in');
  const next = page.browserContext().waitForTarget(t => t.type() === 'page' && t.opener() === page.target(), { timeout: 20000 });
  await clickText(page, 'Continue with Google');
  const popup = await (await next).page();
  console.log('STEP: Google popup opened');
  popup.setDefaultTimeout(20000);
  await popup.setRequestInterception(true);
  popup.on('request', r => ['127.0.0.1', 'localhost'].includes(new URL(r.url()).hostname) ? r.continue() : r.abort());
  await popup.waitForSelector('#add-account-button');
  await popup.waitForFunction(() => document.readyState === 'complete' && typeof finishWithUser === 'function');
  assert.equal(new URL(popup.url()).hostname, '127.0.0.1');
  return popup;
}
try {
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(base)).ok) break; } catch { /* starting */ }
    await new Promise(r => setTimeout(r, 100));
  }
  browser = await puppeteer.launch({ executablePath: process.env.CHROME_EXECUTABLE || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true,
    args: ['--disable-background-networking', '--no-first-run'] });
  await mkdir('tests/results/browser', { recursive: true });
  const identity = page => page.evaluate(async () => {
    const { auth, pendingAuth } = await import('/src/firebase.js');
    await Promise.all([auth.authStateReady(), pendingAuth.authStateReady()]);
    return { uid: auth.currentUser?.uid, guest: auth.currentUser?.isAnonymous, pending: pendingAuth.currentUser?.uid };
  });
  const owner = async id => (await adminDb.doc(`pollsV2/${id}`).get()).data().ownerUid;
  const addActivity = (page, id, name) => page.evaluate(async ({ id, name }) => {
    const { trustedWrite } = await import('/src/utils/trustedClient.js');
    await trustedWrite(id, 'vote', { dateId: 'date0', name, response: 'yes', guests: 2 });
    await trustedWrite(id, 'comment', { dateId: 'date0', name, text: 'Google transfer comment' });
    await trustedWrite(id, 'game', { name, title: 'Synthetic Google game' });
  }, { id, name });
  const page = await newPage();
  const id = await createPoll(page, 'Synthetic v2 Google new account');
  const source = await owner(id);
  await addActivity(page, id, 'New guest');
  let popup = await googlePopup(page);
  await popup.close();
  await page.waitForFunction(() => [...document.querySelectorAll('button')].some(b => b.textContent.includes('Continue with Google') && !b.disabled));
  await page.reload();
  await page.waitForFunction(() => document.body.innerText.includes('Close voting'));
  assert.equal((await identity(page)).uid, source);
  assert.equal((await identity(page)).pending, undefined);
  assert.equal(await owner(id), source);
  pass('Closing the v2 Google popup retains guest identity and owner controls after reload');

  popup = await googlePopup(page);
  await popup.$eval('#add-account-button', el => el.click());
  await popup.waitForSelector('#email-input', { visible: true });
  await popup.type('#email-input', 'trusted-google@example.test');
  await popup.type('#display-name-input', 'Synthetic Google Player');
  await popup.click('#sign-in');
  await page.waitForSelector('[data-testid="transfer-panel"]');
  const target = await adminAuth.getUserByEmail('trusted-google@example.test');
  assert.notEqual(target.uid, source);
  assert.deepEqual(await identity(page), { uid: source, guest: true, pending: target.uid });
  assert.equal(await owner(id), source);
  assert.equal((await adminDb.doc(`_identityMigrations/${source}`).get()).exists, false);
  pass('New Google account waits for consent without replacing guest credentials or changing ownership');
  await page.$eval('[data-testid="transfer-cancel"]', el => el.click());
  await page.waitForSelector('[data-testid="transfer-panel"]', { hidden: true });
  await page.reload();
  await page.waitForFunction(() => document.body.innerText.includes('Close voting'));
  assert.deepEqual(await identity(page), { uid: source, guest: true });
  assert.equal(await owner(id), source);
  pass('Cancelling consent clears only the pending Google session and preserves the guest poll');

  popup = await googlePopup(page);
  await popup.waitForSelector('.js-reuse-account');
  await popup.click('.js-reuse-account');
  await page.waitForSelector('[data-testid="transfer-panel"]');
  await page.reload();
  await page.waitForSelector('[data-testid="transfer-panel"]');
  assert.deepEqual(await identity(page), { uid: source, guest: true, pending: target.uid });
  await clickText(page, 'Move my polls and sign in');
  await page.waitForSelector('[aria-label="Account menu"]');
  await page.waitForFunction(() => !localStorage.getItem('meppletime-pending-transfer'));
  assert.equal((await identity(page)).uid, target.uid);
  assert.equal((await identity(page)).pending, undefined);
  assert.equal(await owner(id), target.uid);
  pass('Reload retains both sessions and confirmed Google handover completes with secondary-session cleanup');

  const returning = await newPage();
  const ids = [];
  for (let n = 0; n < 3; n++) ids.push(await createPoll(returning, `Synthetic v2 Google returning ${n}`));
  const returningSource = await owner(ids[0]);
  await addActivity(returning, ids[0], 'Returning guest');
  popup = await googlePopup(returning);
  await popup.waitForSelector('.js-reuse-account');
  await popup.click('.js-reuse-account');
  await returning.waitForSelector('[data-testid="transfer-panel"]');
  assert.deepEqual(await identity(returning), { uid: returningSource, guest: true, pending: target.uid });
  let batches = 0;
  requestFaults.set(returning, r => r.url().includes('/api/trusted-migrate') && ++batches > 1);
  await clickText(returning, 'Move my polls and sign in');
  await returning.waitForSelector('[data-testid="transfer-panel"] [role="alert"]');
  assert.equal((await adminDb.collection(`_identityMigrations/${returningSource}/polls`).get()).size, 2);
  assert.deepEqual(await identity(returning), { uid: returningSource, guest: true, pending: target.uid });
  assert.equal(await returning.$eval('[data-testid="transfer-cancel"]', el => el.disabled), true);
  pass('Interrupted existing-Google transfer commits two polls and retains both credentials for retry');
  requestFaults.delete(returning);
  await returning.reload();
  await returning.waitForSelector('[data-testid="transfer-panel"]');
  assert.equal(await returning.$eval('[data-testid="transfer-cancel"]', el => el.disabled), true);
  await clickText(returning, 'Move my polls and sign in');
  await returning.waitForSelector('[aria-label="Account menu"]');
  await returning.waitForFunction(() => !localStorage.getItem('meppletime-pending-transfer'));
  assert.equal((await identity(returning)).uid, target.uid);
  assert.equal((await identity(returning)).pending, undefined);
  for (const pollId of [id, ...ids]) assert.equal(await owner(pollId), target.uid);
  for (const pollId of [id, ids[0]]) {
    const poll = (await adminDb.doc(`pollsV2/${pollId}`).get()).data();
    assert.equal(poll.dates[0].votes.length, 1);
    assert.equal(poll.dates[0].votes[0].uid, target.uid);
    assert.equal(poll.dates[0].votes[0].guests, 2);
    assert.equal(poll.dates[0].comments.length, 1);
    assert.equal(poll.dates[0].comments[0].uid, target.uid);
    assert.equal(poll.games.length, 1);
    assert.equal(poll.games[0].suggestedByUid, target.uid);
  }
  pass('Google retry preserves prior account polls and migrates guest votes, comments and game authorship exactly once');
  assert.equal((await adminDb.collection(`usersV2/${target.uid}/history`).get()).size, 4);
  await returning.goto(`${base}/?lang=en`);
  await returning.waitForFunction(() => document.body.innerText.includes('Synthetic v2 Google new account') && document.body.innerText.includes('Synthetic v2 Google returning 2'));
  pass('Existing Google account shows combined server-owned history after retry');
  await returning.goto(`${base}/poll/${ids[0]}?lang=en`);
  await clickText(returning, 'Close voting');
  await returning.waitForFunction(() => document.body.innerText.includes('Reopen voting'));
  assert.equal((await adminDb.doc(`pollsV2/${ids[0]}`).get()).data().closed, true);
  pass('Transferred Google owner can perform trusted owner commands');
  await writeFile('tests/results/trusted-google-result.json', JSON.stringify({ testedAt: new Date().toISOString(), checks,
    limitations: ['Integrated repository code with local emulators; real OAuth, email delivery and production configuration require separate verification'] }, null, 2) + '\n');
} catch (error) {
  if (currentPage) {
    await currentPage.screenshot({ path: 'tests/results/browser/failure.png', fullPage: true }).catch(() => {});
    console.error((await currentPage.evaluate(() => document.body.innerText).catch(() => '')).slice(0,4000));
  }
  throw error;
} finally {
  await closeTestBrowser(browser);
  for (const child of children) child.kill('SIGTERM');
  await closeService();
  for (const url of [
    'http://127.0.0.1:18080/emulator/v1/projects/demo-meppletime-local/databases/(default)/documents',
    'http://127.0.0.1:19099/emulator/v1/projects/demo-meppletime-local/accounts',
  ]) { const res = await fetch(url, { method: 'DELETE' }); assert.ok(res.ok); }
  console.log('Practice browser closed, local servers stopped, synthetic data cleared.');
}
