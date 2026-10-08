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
async function injectFault(page, kind) {
  await page.evaluate(async kind => {
    window.injectedFaultHits = 0;
    if (kind === 'switch' || kind === 'signout') {
      // Use the SDK's real auth middleware failure path. No completion marker
      // or finished migration is seeded by the test.
      const source = await (await fetch('/src/firebase.js')).text();
      const modulePath = source.match(/from\s+["']([^"']*firebase_auth[^"']*)["']/)[1];
      const { beforeAuthStateChanged } = await import(modulePath);
      const { auth, pendingAuth } = await import('/src/firebase.js');
      beforeAuthStateChanged(kind === 'switch' ? auth : pendingAuth, user => {
        if ((kind === 'switch' ? user && !user.isAnonymous : !user) && !window.injectedFaultHits) {
          window.injectedFaultHits++;
          throw new Error(`Injected ${kind} failure`);
        }
      });
      return;
    }
    const key = 'meppletime-pending-transfer';
    const method = kind === 'remove' ? 'removeItem' : kind === 'read' ? 'getItem' : 'setItem';
    const original = Storage.prototype[method];
    Storage.prototype[method] = function (name, value) {
      const matches = name === key && (kind !== 'ready' || JSON.parse(value).phase === 'ready');
      if (matches && !window.injectedFaultHits) {
        window.injectedFaultHits++;
        throw new DOMException(`Injected ${kind} storage failure`, 'QuotaExceededError');
      }
      return original.apply(this, arguments);
    };
  }, kind);
}
try {
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(base)).ok) break; } catch { /* starting */ }
    await new Promise(r => setTimeout(r, 100));
  }
  browser = await puppeteer.launch({ executablePath: process.env.CHROME_EXECUTABLE || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true,
    args: ['--disable-background-networking', '--no-first-run'] });
  await mkdir('tests/results/browser', { recursive: true });
  for (const kind of ['read', 'initial', 'ready', 'switch', 'signout', 'remove']) {
    console.log(`STEP: injecting ${kind} failure`);
    const page = await newPage();
    const id = await createPoll(page, `Synthetic failure ${kind}`);
    const source = (await adminDb.doc(`pollsV2/${id}`).get()).data().ownerUid;
    await page.evaluate(async id => {
      const { trustedWrite } = await import('/src/utils/trustedClient.js');
      await trustedWrite(id, 'vote', { dateId: 'date0', name: 'Guest', response: 'yes', guests: 2 });
      await trustedWrite(id, 'comment', { dateId: 'date0', name: 'Guest', text: 'Preserve once' });
      await trustedWrite(id, 'game', { name: 'Guest', title: 'Synthetic failure game' });
    }, id);
    const email = `failure-${kind}@example.test`;
    await emailSignIn(page, email);
    await page.waitForSelector('[data-testid="transfer-panel"]');
    const target = await adminAuth.getUserByEmail(email);
    await injectFault(page, kind);
    await clickText(page, 'Move my polls and sign in');
    await page.waitForSelector('[data-testid="transfer-panel"] [role="alert"]');
    const state = await readState(page);
    assert.equal(state.hits, 1);
    const beforeStart = ['read', 'initial'].includes(kind);
    const switched = ['signout', 'remove'].includes(kind);
    assert.equal(state.uid, switched ? target.uid : source);
    assert.equal(state.pending, kind === 'remove' ? undefined : target.uid);
    assert.equal((await adminDb.doc(`pollsV2/${id}`).get()).data().ownerUid, beforeStart ? source : target.uid);
    const jobRef = adminDb.doc(`_identityMigrations/${source}`);
    assert.equal((await jobRef.get()).exists, !beforeStart);
    let receipt;
    if (beforeStart) assert.equal(state.marker, null);
    else {
      assert.equal((await jobRef.get()).data().state, 'complete');
      assert.equal(state.marker.sourceUid, source);
      assert.equal(state.marker.targetUid, target.uid);
      assert.equal(state.marker.phase, kind === 'ready' ? undefined : 'ready');
      assert.equal(await page.$eval('[data-testid="transfer-cancel"]', el => el.disabled), true);
      receipt = (await jobRef.collection('polls').doc(id).get()).data().completedAt.toMillis();
    }
    // Reload removes fault injection but must recover from real durable state.
    await page.reload();
    await page.waitForSelector('[data-testid="transfer-panel"]');
    await clickText(page, 'Move my polls and sign in');
    await page.waitForSelector('[aria-label="Account menu"]');
    await page.waitForFunction(() => !localStorage.getItem('meppletime-pending-transfer'));
    await page.waitForSelector('[data-testid="transfer-panel"]', { hidden: true });
    const final = await readState(page);
    assert.equal(final.uid, target.uid);
    assert.equal(final.pending, undefined);
    const poll = (await adminDb.doc(`pollsV2/${id}`).get()).data();
    assert.equal(poll.ownerUid, target.uid);
    assert.equal(poll.dates[0].votes.length, 1);
    assert.equal(poll.dates[0].votes[0].uid, target.uid);
    assert.equal(poll.dates[0].votes[0].guests, 2);
    assert.equal(poll.dates[0].comments.length, 1);
    assert.equal(poll.dates[0].comments[0].uid, target.uid);
    assert.equal(poll.games.length, 1);
    assert.equal(poll.games[0].suggestedByUid, target.uid);
    assert.equal(poll.games[0].votes.length, 1);
    assert.equal(poll.games[0].votes[0].uid, target.uid);
    assert.equal((await adminDb.collection(`usersV2/${target.uid}/history`).get()).size, 1);
    assert.equal((await jobRef.collection('polls').get()).size, 1);
    if (receipt) assert.equal((await jobRef.collection('polls').doc(id).get()).data().completedAt.toMillis(), receipt);
    await page.waitForFunction(() => document.body.innerText.includes('Close voting'));
    await clickText(page, 'Close voting');
    await page.waitForFunction(() => document.body.innerText.includes('Reopen voting'));
    pass(`${kind} failure is surfaced and reload/retry completes without duplicated activity or lost owner access`);
    await page.browserContext().close();
    currentPage = null;
  }
  await writeFile('tests/results/trusted-failures-result.json', JSON.stringify({ testedAt: new Date().toISOString(), checks,
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
