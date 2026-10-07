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
async function submitComment(page) {
  const selector = '[role="dialog"] form button[type="submit"]';
  await page.$eval(selector, el => el.scrollIntoView({ block: 'center' }));
  await page.waitForFunction(selector => {
    const el = document.querySelector(selector);
    if (!el || el.disabled) return false;
    const r = el.getBoundingClientRect();
    return document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2) === el;
  }, {}, selector);
  const point = await page.$eval(selector, el => {
    const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });
  await page.mouse.click(point.x, point.y);
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
  p.on('request', async r => {
    if (await requestFaults.get(p)?.(r)) return r.abort();
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

  const page = await newPage();
  const pollId = await createPoll(page, 'Synthetic trusted browser poll');
  assert.ok(pollId.startsWith('v2_'));
  const read = async () => (await adminDb.doc(`pollsV2/${pollId}`).get()).data();
  const owner = (await read()).ownerUid;
  assert.equal((await adminDb.doc(`polls/${pollId}`).get()).exists, false);
  pass('Existing create form creates a server-owned v2 poll without a legacy document');
  await fill(page, 'input[placeholder="Enter your name (e.g., John Smith)"]', 'Synthetic Alice');
  await clickText(page, 'Continue');
  await clickText(page, '20');
  await clickText(page, '✓ Yes');
  await page.waitForFunction(() => document.querySelector('[role="dialog"]')?.innerText.includes('Vote saved!'));
  assert.equal((await read()).dates[0].votes[0].uid, owner);
  pass('The existing date modal saves the vote with the server-verified author');
  let lostResponse = false;
  requestFaults.set(page, async r => {
    if (!lostResponse && r.url().endsWith('/api/trusted-activity') && r.method() === 'POST' && JSON.parse(r.postData()).action === 'comment') {
      const response = await fetch('http://127.0.0.1:15175/api/trusted-activity', { method: 'POST', headers: r.headers(), body: r.postData() });
      assert.equal(response.status, 200);
      lostResponse = true;
      return true;
    }
    return false;
  });
  await fill(page, 'input[placeholder="Add a comment..."]', 'Synthetic trusted comment');
  await submitComment(page);
  await page.waitForFunction(() => document.body.innerText.includes('Failed to add comment'));
  assert.equal((await read()).dates[0].comments.length, 1);
  requestFaults.delete(page);
  await page.reload();
  await page.waitForFunction(() => document.body.innerText.includes('Close voting'));
  await clickText(page, '20');
  await fill(page, 'input[placeholder="Add a comment..."]', 'Synthetic trusted comment');
  await submitComment(page);
  await page.waitForFunction(() => document.querySelector('input[placeholder="Add a comment..."]')?.value === '');
  assert.equal((await read()).dates[0].comments.length, 1);
  assert.equal(await page.evaluate(() => Object.keys(localStorage).some(k => k.startsWith('meppletime-v2-request:'))), false);
  pass('A lost response followed by reload and retry preserves the request ID and creates exactly one comment');
  await page.click('[role="dialog"] button[aria-label="Close"]');
  await fill(page, 'input[placeholder="Suggest a game (e.g., Catan)"]', 'Synthetic trusted game');
  await clickText(page, 'Suggest');
  await page.waitForFunction(() => document.body.innerText.includes('Synthetic trusted game') && !document.querySelector('input[placeholder="Suggest a game (e.g., Catan)"]').value);
  assert.equal((await read()).games[0].suggestedByUid, owner);
  pass('Existing comment and game forms save verified authors and show live data');
  await page.reload();
  await page.waitForFunction(() => document.body.innerText.includes('Synthetic trusted game'));
  assert.equal((await read()).ownerUid, owner);
  pass('Guest identity and trusted poll contents survive browser reload');
  const voter = await newPage();
  await voter.goto(`${base}/poll/${pollId}?lang=en`);
  await voter.waitForSelector('input[placeholder="Enter your name (e.g., John Smith)"]');
  await fill(voter, 'input[placeholder="Enter your name (e.g., John Smith)"]', 'Synthetic Alice');
  await clickText(voter, 'Continue');
  await clickText(voter, '20');
  await clickText(voter, '✓ Yes');
  await voter.waitForFunction(() => document.querySelector('[role="dialog"]')?.innerText.includes('Vote saved!'));
  const votes = (await read()).dates[0].votes;
  assert.equal(votes.length, 2);
  assert.equal(new Set(votes.map(v => v.uid)).size, 2);
  pass('A fresh visitor gets an anonymous session and cannot overwrite the same-name owner vote');
  await voter.click('[role="dialog"] button[aria-label="Close"]');
  await voter.click('button[title="Vote for this game"]');
  await voter.waitForSelector('button[title="Remove your vote"]');
  assert.equal((await read()).games[0].votes.length, 2);
  await voter.click('button[title="Remove your vote"]');
  await voter.waitForSelector('button[title="Vote for this game"]');
  assert.equal((await read()).games[0].votes.length, 1);
  pass('Game voting and withdrawal preserve the other participant endorsement');
  await voter.setViewport({ width: 390, height: 844 });
  await clickText(voter, 'PL');
  await clickText(voter, '20');
  assert.equal(await voter.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await voter.screenshot({ path: 'tests/results/browser/trusted-vote-mobile.png', fullPage: true });
  await writeFile('tests/results/trusted-ui-result.json', JSON.stringify({ testedAt: new Date().toISOString(), checks,
    limitations: ['Integrated repository code with local emulators; real OAuth, email delivery and production configuration require separate verification'] }, null, 2)+'\n');

} catch (error) {
  if (currentPage) {
    await currentPage.screenshot({ path: 'tests/results/browser/trusted-ui-failure.png', fullPage: true }).catch(() => {});
    console.error((await currentPage.evaluate(() => document.body.innerText).catch(() => '')).slice(0,4000));
  }
  throw error;
} finally {
  if (browser) await browser.close();
  for (const child of children) child.kill('SIGTERM');
  await closeService();
  for (const url of [
    'http://127.0.0.1:18080/emulator/v1/projects/demo-meppletime-local/databases/(default)/documents',
    'http://127.0.0.1:19099/emulator/v1/projects/demo-meppletime-local/accounts',
  ]) { const res = await fetch(url, { method: 'DELETE' }); assert.ok(res.ok); }
  console.log('Practice browser closed, local servers stopped, synthetic data cleared.');
}
