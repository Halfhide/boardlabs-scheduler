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
  await page.bringToFront();
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
async function newPage(ctx = null) {
  ctx ||= await browser.createBrowserContext();
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
async function identity(page) {
  return page.evaluate(async () => {
    const { auth, pendingAuth } = await import('/src/firebase.js');
    await Promise.all([auth.authStateReady(), pendingAuth.authStateReady()]);
    return { uid: auth.currentUser?.uid, pending: pendingAuth.currentUser?.uid };
  });
}
async function activity(page, pollId, name) {
  await page.evaluate(async ({ pollId, name }) => {
    const { trustedWrite } = await import('/src/utils/trustedClient.js');
    await trustedWrite(pollId, 'vote', { dateId: 'date0', name, response: 'yes', guests: 1 });
    await trustedWrite(pollId, 'comment', { dateId: 'date0', name, text: `Comment from ${name}` });
    await trustedWrite(pollId, 'game', { name, title: `Game from ${name}` });
  }, { pollId, name });
}
async function assertActivity(pollId, identities) {
  const poll = (await adminDb.doc(`pollsV2/${pollId}`).get()).data();
  for (const [name, uid] of Object.entries(identities)) {
    const votes = poll.dates[0].votes.filter(v => v.voterName === name);
    assert.equal(votes.length, 1);
    assert.equal(votes[0].uid, uid);
    assert.equal(votes[0].guests, 1);
    const comments = poll.dates[0].comments.filter(c => c.text === `Comment from ${name}`);
    assert.equal(comments.length, 1);
    assert.equal(comments[0].uid, uid);
    const games = poll.games.filter(g => g.title === `Game from ${name}`);
    assert.equal(games.length, 1);
    assert.equal(games[0].suggestedByUid, uid);
  }
}
try {
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(base)).ok) break; } catch { /* starting */ }
    await new Promise(r => setTimeout(r, 100));
  }
  browser = await puppeteer.launch({ executablePath: process.env.CHROME_EXECUTABLE || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true,
    args: ['--disable-background-networking', '--no-first-run'] });
  await mkdir('tests/results/browser', { recursive: true });

  const sender = await newPage();
  const originalPoll = await createPoll(sender, 'Synthetic source-device poll');
  const sourceOwner = (await adminDb.doc(`pollsV2/${originalPoll}`).get()).data().ownerUid;
  await activity(sender, originalPoll, 'Source guest');
  const email = 'cross-device@example.test';
  await clickText(sender, 'Sign in');
  await fill(sender, '#signin-email', email);
  await clickText(sender, 'Send sign-in link');
  await sender.waitForFunction(() => document.body.innerText.includes('Check your inbox'));
  const codes = await (await fetch('http://127.0.0.1:19099/emulator/v1/projects/demo-meppletime-local/oobCodes')).json();
  const entry = codes.oobCodes.filter(c => c.email === email).at(-1);
  const recipient = await newPage();
  const recipientPoll = await createPoll(recipient, 'Synthetic receiving-device poll');
  const recipientOwner = (await adminDb.doc(`pollsV2/${recipientPoll}`).get()).data().ownerUid;
  await activity(recipient, recipientPoll, 'Receiving guest');
  await activity(recipient, originalPoll, 'Receiving guest');
  await recipient.goto(`${base}/poll/${originalPoll}?${new URL(entry.oobLink).searchParams}`);
  await recipient.waitForSelector('#signin-email');
  await fill(recipient, '#signin-email', email);
  await recipient.$eval('#signin-email', el => el.form.requestSubmit());
  await recipient.waitForSelector('[data-testid="transfer-panel"]');
  assert.equal((await adminDb.doc(`pollsV2/${originalPoll}`).get()).data().ownerUid, sourceOwner);
  assert.equal((await adminDb.doc(`pollsV2/${recipientPoll}`).get()).data().ownerUid, recipientOwner);
  assert.deepEqual(await identity(sender), { uid: sourceOwner });
  assert.equal((await identity(recipient)).uid, recipientOwner);
  pass('Opening a sign-in link on another device asks for email and preserves both guest owners before consent');
  await clickText(recipient, 'Move my polls and sign in');
  await recipient.waitForSelector('[aria-label="Account menu"]');
  const account = await adminAuth.getUserByEmail(email);
  assert.equal((await adminDb.doc(`pollsV2/${recipientPoll}`).get()).data().ownerUid, account.uid);
  assert.equal((await adminDb.doc(`pollsV2/${originalPoll}`).get()).data().ownerUid, sourceOwner);
  await recipient.waitForFunction(() => !localStorage.getItem('meppletime-pending-transfer'));
  assert.deepEqual(await identity(recipient), { uid: account.uid });
  assert.deepEqual(await identity(sender), { uid: sourceOwner });
  await assertActivity(originalPoll, { 'Source guest': sourceOwner, 'Receiving guest': account.uid });
  await assertActivity(recipientPoll, { 'Receiving guest': account.uid });
  assert.equal((await adminDb.doc(`_identityMigrations/${sourceOwner}`).get()).exists, false);
  assert.equal((await adminDb.doc(`usersV2/${account.uid}/history/${originalPoll}`).get()).data().createdByMe, false);
  assert.equal((await adminDb.doc(`usersV2/${account.uid}/history/${recipientPoll}`).get()).data().createdByMe, true);
  pass('Cross-device consent transfers only polls owned by the receiving browser, never the source-device poll');
  await sender.reload();
  await sender.waitForFunction(() => document.body.innerText.includes('Close voting'));
  await sender.evaluate(async id => {
    const { trustedWrite } = await import('/src/utils/trustedClient.js');
    await trustedWrite(id, 'vote', { dateId: 'date1', name: 'Source guest', response: 'maybe' });
  }, originalPoll);
  pass('Receiving-device transfer moves its activity and history while the original guest remains able to vote');
  await emailSignIn(sender, email);
  await sender.waitForSelector('[data-testid="transfer-panel"]');
  await clickText(sender, 'Move my polls and sign in');
  await sender.waitForSelector('[aria-label="Account menu"]');
  assert.equal((await adminDb.doc(`pollsV2/${originalPoll}`).get()).data().ownerUid, account.uid);
  await sender.waitForFunction(() => !localStorage.getItem('meppletime-pending-transfer'));
  const combined = (await adminDb.doc(`pollsV2/${originalPoll}`).get()).data();
  assert.equal(combined.dates[0].votes.length, 1);
  assert.equal(combined.dates[0].votes[0].uid, account.uid);
  assert.equal(combined.dates[1].votes[0].uid, account.uid);
  assert.equal(combined.dates[0].comments.length, 2);
  assert.ok(combined.dates[0].comments.every(c => c.uid === account.uid));
  assert.equal(combined.games.length, 2);
  assert.ok(combined.games.every(g => g.suggestedByUid === account.uid));
  assert.equal((await adminDb.collection(`usersV2/${account.uid}/history`).get()).size, 2);
  assert.equal((await adminDb.doc(`usersV2/${account.uid}/history/${originalPoll}`).get()).data().createdByMe, true);
  pass('A fresh sign-in link in the original browser safely transfers its remaining poll');
  await sender.browserContext().close();
  await recipient.browserContext().close();

  const owner = await newPage();
  console.log('STEP: create two-tab fixture');
  const poll = await createPoll(owner, 'Synthetic two-tab poll');
  await activity(owner, poll, 'Two-tab guest');
  const guest = (await adminDb.doc(`pollsV2/${poll}`).get()).data().ownerUid;
  const sibling = await newPage(owner.browserContext());
  console.log('STEP: open sibling tab');
  await sibling.goto(`${base}/?lang=en`);
  await sibling.waitForSelector('#title');
  console.log('STEP: sign in on owner tab');
  await emailSignIn(owner, 'two-tabs@example.test');
  await owner.waitForSelector('[data-testid="transfer-panel"]');
  await sibling.waitForSelector('[data-testid="transfer-panel"]');
  requestFaults.set(owner, r => r.url().includes('/api/trusted-migrate'));
  await clickText(owner, 'Move my polls and sign in');
  await owner.waitForSelector('[data-testid="transfer-panel"] [role="alert"]');
  await sibling.waitForFunction(() => document.querySelector('[data-testid="transfer-cancel"]')?.disabled);
  assert.equal(await sibling.$eval('button[type="submit"]', b => b.disabled), true);
  pass('Starting a handover in one tab immediately blocks cancellation and creation in the other tab');
  assert.equal((await adminDb.doc(`pollsV2/${poll}`).get()).data().ownerUid, guest);
  await owner.close();
  currentPage = sibling;
  await clickText(sibling, 'Move my polls and sign in');
  await sibling.waitForSelector('[aria-label="Account menu"]');
  const target = await adminAuth.getUserByEmail('two-tabs@example.test');
  assert.equal((await adminDb.doc(`pollsV2/${poll}`).get()).data().ownerUid, target.uid);
  await sibling.waitForFunction(() => !document.querySelector('button[type="submit"]').disabled);
  assert.equal(await sibling.evaluate(() => localStorage.getItem('meppletime-pending-transfer')), null);
  await assertActivity(poll, { 'Two-tab guest': target.uid });
  assert.deepEqual(await identity(sibling), { uid: target.uid });
  assert.equal((await adminDb.collection(`_identityMigrations/${guest}/polls`).get()).size, 1);
  pass('The second tab can finish handover after the initiating tab is closed');
  await sibling.browserContext().close();

  const concurrent = await newPage();
  const concurrentPoll = await createPoll(concurrent, 'Synthetic concurrent confirmation poll');
  await activity(concurrent, concurrentPoll, 'Concurrent guest');
  const concurrentSource = (await identity(concurrent)).uid;
  await emailSignIn(concurrent, 'concurrent-tabs@example.test');
  await concurrent.waitForSelector('[data-testid="transfer-panel"]');
  const other = await newPage(concurrent.browserContext());
  await other.goto(`${base}/poll/${concurrentPoll}?lang=en`);
  await other.waitForSelector('[data-testid="transfer-panel"]');
  // Hold each first migration request until both tabs have issued one, so
  // the scenario proves overlapping backend work rather than fast serial clicks.
  let arrivals = 0;
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  for (const p of [concurrent, other]) {
    p.removeAllListeners('request');
    let first = true;
    p.on('request', async r => {
      if (r.url().includes('/api/trusted-migrate') && first) {
        first = false;
        arrivals++;
        if (arrivals === 2) release();
        await gate;
      }
      const url = new URL(r.url());
      if (['127.0.0.1', 'localhost'].includes(url.hostname) || ['data:', 'blob:'].includes(url.protocol)) r.continue();
      else r.abort();
    });
  }
  // Wait until each tab has finished checking server-side recovery state.
  for (const p of [concurrent, other]) {
    await p.waitForFunction(() => !document.querySelector('[data-testid="transfer-confirm"]')?.disabled);
  }
  // Trigger both UI handlers together, without serial foreground switching.
  await Promise.all([concurrent, other].map(p => p.$eval('[data-testid="transfer-confirm"]', b => b.click())));
  for (const p of [concurrent, other]) {
    await p.waitForSelector('[aria-label="Account menu"]');
    await p.waitForSelector('[data-testid="transfer-panel"]', { hidden: true });
    await p.waitForFunction(() => !localStorage.getItem('meppletime-pending-transfer'));
    await p.waitForFunction(() => document.body.innerText.includes('Close voting'));
  }
  const concurrentAccount = await adminAuth.getUserByEmail('concurrent-tabs@example.test');
  assert.equal((await adminDb.doc(`pollsV2/${concurrentPoll}`).get()).data().ownerUid, concurrentAccount.uid);
  assert.equal(arrivals, 2);
  await assertActivity(concurrentPoll, { 'Concurrent guest': concurrentAccount.uid });
  for (const p of [concurrent, other]) assert.deepEqual(await identity(p), { uid: concurrentAccount.uid });
  const receipts = await adminDb.collection(`_identityMigrations/${concurrentSource}/polls`).get();
  assert.equal(receipts.size, 1);
  pass('Simultaneous confirmations in two tabs finish with one ownership receipt, cleared recovery state and creator access in both tabs');
  await writeFile('tests/results/trusted-device-tabs-result.json', JSON.stringify({ testedAt: new Date().toISOString(), checks,
    limitations: ['Integrated repository code with local emulators; real OAuth, email delivery and production configuration require separate verification'] }, null, 2)+'\n');

} catch (error) {
  if (currentPage) {
    await currentPage.screenshot({ path: 'tests/results/browser/trusted-device-tabs-failure.png', fullPage: true }).catch(() => {});
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
