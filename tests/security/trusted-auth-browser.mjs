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
try {
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(base)).ok) break; } catch { /* starting */ }
    await new Promise(r => setTimeout(r, 100));
  }
  browser = await puppeteer.launch({ executablePath: process.env.CHROME_EXECUTABLE || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true,
    args: ['--disable-background-networking', '--no-first-run'] });
  await mkdir('tests/results/browser', { recursive: true });
  const page = await newPage();
  const ids = [];
  for (let i = 0; i < 3; i++) ids.push(await createPoll(page, `Synthetic migration ${i}`));
  const source = (await adminDb.doc(`pollsV2/${ids[0]}`).get()).data().ownerUid;
  await page.evaluate(async id => {
    const { trustedWrite } = await import('/src/utils/trustedClient.js');
    await trustedWrite(id, 'vote', { dateId: 'date0', name: 'Guest', response: 'yes', guests: 2 });
    await trustedWrite(id, 'comment', { dateId: 'date0', name: 'Guest', text: 'Keep this comment' });
    await trustedWrite(id, 'game', { name: 'Guest', title: 'Synthetic game' });
  }, ids[0]);
  await emailSignIn(page, 'trusted-account@example.test');
  await page.waitForSelector('[data-testid="transfer-panel"]');
  const target = await adminAuth.getUserByEmail('trusted-account@example.test');
  pass('Email sign-in retains the guest session and asks for migration consent');
  let batches = 0;
  page.removeAllListeners('request');
  page.on('request', r => {
    if (r.url().includes('/api/trusted-migrate') && ++batches > 1) return r.abort();
    if (['127.0.0.1', 'localhost'].includes(new URL(r.url()).hostname)) r.continue(); else r.abort();
  });
  await clickText(page, 'Move my polls and sign in');
  await page.waitForSelector('[data-testid="transfer-panel"] [role="alert"]');
  assert.equal((await adminDb.collection(`_identityMigrations/${source}/polls`).get()).size, 2);
  assert.equal(await page.$eval('[data-testid="transfer-cancel"]', b => b.disabled), true);
  assert.equal(await page.evaluate(async () => (await import('/src/firebase.js')).auth.currentUser.isAnonymous), true);
  pass('Partial migration preserves the source session and blocks cancellation');
  page.removeAllListeners('request');
  page.on('request', r => ['127.0.0.1', 'localhost'].includes(new URL(r.url()).hostname) ? r.continue() : r.abort());
  await page.reload();
  await page.waitForSelector('[data-testid="transfer-confirm"]');
  await clickText(page, 'Move my polls and sign in');
  await page.waitForFunction(() => !localStorage.getItem('meppletime-pending-transfer'));
  await page.waitForSelector('[aria-label="Account menu"]');
  for (const id of ids) assert.equal((await adminDb.doc(`pollsV2/${id}`).get()).data().ownerUid, target.uid);
  const poll = (await adminDb.doc(`pollsV2/${ids[0]}`).get()).data();
  assert.equal(poll.dates[0].votes[0].uid, target.uid);
  assert.equal(poll.dates[0].votes[0].guests, 2);
  assert.equal(poll.dates[0].comments.length, 1);
  assert.equal(poll.dates[0].comments[0].uid, target.uid);
  assert.equal(poll.games[0].suggestedByUid, target.uid);
  pass('Reload and retry finish all polls and retain votes, comments and game authorship');
  await page.goto(`${base}/?lang=en`);
  await page.waitForFunction(() => document.body.innerText.includes('Synthetic migration 0') && document.body.innerText.includes('Synthetic migration 2'));
  assert.equal((await adminDb.collection(`usersV2/${target.uid}/history`).get()).size, 3);
  pass('The signed-in home page displays migrated cloud history');
  // Reproduce the durable ready stage with the primary account already switched.
  await page.evaluate(({ source, target }) => localStorage.setItem('meppletime-pending-transfer', JSON.stringify({ sourceUid: source, targetUid: target, version: 2, phase: 'ready' })), { source, target: target.uid });
  await page.reload();
  await page.waitForSelector('[data-testid="transfer-confirm"]');
  await clickText(page, 'Move my polls and sign in');
  await page.waitForFunction(() => !localStorage.getItem('meppletime-pending-transfer'));
  assert.equal(await page.evaluate(async () => (await import('/src/firebase.js')).auth.currentUser.uid), target.uid);
  pass('Reload after the primary session switch completes cleanup without requiring the old guest');
  await page.goto(`${base}/poll/${ids[0]}?lang=en`);
  await page.waitForFunction(() => document.body.innerText.includes('Close voting'));
  await clickText(page, 'Close voting');
  await page.waitForFunction(() => document.body.innerText.includes('Reopen voting'));
  assert.equal((await adminDb.doc(`pollsV2/${ids[0]}`).get()).data().closed, true);
  pass('The migrated account retains owner controls');
  await writeFile('tests/results/trusted-auth-result.json', JSON.stringify({ testedAt: new Date().toISOString(), checks,
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
