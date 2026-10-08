import { closeTestBrowser } from './close-test-browser.mjs';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { Timestamp } from 'firebase-admin/firestore';
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
const out = 'tests/results/quality';
const shots = [];
const issues = [];
function monitor(page, label) {
  page.on('console', m => { if (m.type() === 'error') issues.push({ label, kind: 'console', text: m.text() }); });
  page.on('pageerror', e => issues.push({ label, kind: 'pageerror', text: e.message }));
  page.on('requestfailed', r => issues.push({ label, kind: 'requestfailed', url: r.url(), text: r.failure()?.errorText }));
  page.on('response', r => { if (r.status() >= 400) issues.push({ label, kind: 'http', url: r.url(), status: r.status() }); });
}
async function shot(page, label) {
  await page.waitForSelector('#splash', { hidden: true });
  await page.evaluate(() => document.fonts.ready);
  for (const width of [1440, 390]) {
    await page.setViewport({ width, height: width === 1440 ? 900 : 844 });
    const metrics = await page.evaluate(() => ({
      language: document.documentElement.lang,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      bodyFont: getComputedStyle(document.body).fontFamily,
      background: getComputedStyle(document.body).backgroundColor,
      headings: [...document.querySelectorAll('h1,h2')].map(e => ({ text: e.textContent, font: getComputedStyle(e).fontFamily })),
      loadedFonts: [...document.fonts].filter(f => f.status === 'loaded').map(f => f.family),
      clipped: [...document.querySelectorAll('button,input,h1,h2,p')].filter(e => {
        const s = getComputedStyle(e);
        return s.overflowX === 'hidden' && e.scrollWidth > e.clientWidth + 1;
      }).map(e => e.textContent || e.value),
    }));
    assert.equal(metrics.language, label.endsWith('-pl') ? 'pl' : 'en');
    const file = `${out}/${label}-${width}.png`;
    await page.screenshot({ path: file, fullPage: true });
    const panel = label.startsWith('recovery-') ? await page.$('[data-testid="transfer-panel"]') : null;
    const detailFile = panel ? `${out}/panel-${label}-${width}.png` : undefined;
    if (panel) await panel.screenshot({ path: detailFile });
    shots.push({ label, width, file, detailFile, ...metrics });
    console.log(`SCREEN: ${label} ${width}, overflow ${metrics.overflow}`);
  }
}
try {
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(base)).ok) break; } catch { /* starting */ }
    await new Promise(r => setTimeout(r, 100));
  }
  browser = await puppeteer.launch({ executablePath: process.env.CHROME_EXECUTABLE || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true,
    args: ['--disable-background-networking', '--no-first-run'] });
  await mkdir(out, { recursive: true });
  // Read-only reference. Fresh context, no signed-in account and no poll writes.
  const refCtx = await browser.createBrowserContext();
  const reference = await refCtx.newPage();
  reference.setDefaultTimeout(30000);
  monitor(reference, 'reference');
  for (const lang of ['en', 'pl']) {
    await reference.goto(`https://app.meppletime.today/?lang=${lang}`);
    await reference.waitForSelector('#title');
    await shot(reference, `reference-home-${lang}`);
    await reference.goto(`https://app.meppletime.today/privacy?lang=${lang}`);
    await reference.waitForSelector('h1');
    await shot(reference, `reference-privacy-${lang}`);
  }
  await refCtx.close();
  for (const lang of ['en', 'pl']) {
    const page = await newPage();
    monitor(page, `local-${lang}`);
    await page.goto(`${base}/?lang=${lang}`);
    await page.waitForSelector('#title');
    await shot(page, `home-${lang}`);
    await clickText(page, lang === 'en' ? 'Sign in' : 'Zaloguj się');
    await page.waitForSelector('#signin-email');
    await shot(page, `signin-${lang}`);
    await page.goto(`${base}/privacy?lang=${lang}`);
    await page.waitForSelector('h1');
    await shot(page, `privacy-${lang}`);
    const id = await createPoll(page, lang === 'en' ? 'Friday games at Marta’s' : 'Piątkowe planszówki u Marty');
    await page.goto(`${base}/poll/${id}?lang=${lang}`);
    await page.waitForFunction(() => document.querySelector('h1'));
    await shot(page, `poll-empty-${lang}`);
    await page.evaluate(async ({ id, title }) => {
      const { trustedWrite } = await import('/src/utils/trustedClient.js');
      await trustedWrite(id, 'rename', { title });
      await trustedWrite(id, 'vote', { dateId: 'date0', name: 'Marta', response: 'yes', guests: 2 });
      await trustedWrite(id, 'comment', { dateId: 'date0', name: 'Marta', text: 'Wingspan, Azul, Catan' });
      await trustedWrite(id, 'game', { name: 'Marta', title: 'Wingspan' });
      for (let day = 22; day <= 29; day++) await trustedWrite(id, 'addDate', { date: `2026-10-${day}` });
    }, { id, title: lang === 'en' ? 'Friday evening with friends: Wingspan, Azul and a longer game if everyone can stay' : 'Piątkowy wieczór z przyjaciółmi: Na skrzydłach, Azul i dłuższa gra, jeśli wszyscy mogą zostać' });
    await page.waitForFunction(() => document.body.innerText.includes('Wingspan'));
    await fill(page, lang === 'en' ? 'input[placeholder="Enter your name (e.g., John Smith)"]' : 'input[placeholder="Wpisz swoje imię (np. Jan Kowalski)"]', 'Marta');
    await clickText(page, lang === 'en' ? 'Continue' : 'Dalej');
    const cell = lang === 'en' ? 'button[aria-label*="your vote"]' : 'button[aria-label*="twój głos"]';
    await page.waitForSelector(cell);
    await page.click(cell);
    await page.waitForFunction(selector => document.querySelector(selector)?.getAttribute('aria-label').includes(document.documentElement.lang === 'en' ? 'maybe' : 'może'), {}, cell);
    await shot(page, `poll-long-${lang}`);
    await page.goto(`${base}/poll/${id}?lang=en`);
    await emailSignIn(page, `marta.${lang}.planszowki.w.piatkowy.wieczor@przyjaciele.example.test`);
    await page.waitForSelector('[data-testid="transfer-panel"]');
    await page.goto(`${base}/poll/${id}?lang=${lang}`);
    await page.waitForSelector('[data-testid="transfer-panel"]');
    await shot(page, `transfer-${lang}`);
    // Real UI failure with a locally rejected fetch, not a failed remote request.
    await page.evaluate(() => {
      const original = window.fetch;
      window.fetch = (...args) => args[0] === '/api/trusted-migrate'
        ? Promise.reject(new Error('Review failure injection')) : original(...args);
    });
    await clickText(page, lang === 'en' ? 'Move my polls and sign in' : 'Przenieś moje ankiety i zaloguj');
    await page.waitForSelector('[data-testid="transfer-panel"] [role="alert"]');
    await shot(page, `transfer-error-${lang}`);
    await page.click('[data-testid="transfer-recovery"] summary');
    await page.waitForFunction(() => document.querySelector('[data-testid="transfer-recovery"]').open);
    await shot(page, `recovery-empty-${lang}`);
    await fill(page, '#recovery-email', `marta.${lang}.planszowki.w.piatkowy.wieczor@przyjaciele.example.test`);
    await clickText(page, lang === 'en' ? 'Send sign-in link' : 'Wyślij link do logowania');
    await page.waitForSelector('[data-testid="transfer-recovery"] [role="status"]');
    await shot(page, `recovery-sent-${lang}`);
    // Exercise the wrong-account message, then restore the original account.
    const targetUid = await page.evaluate(async () => (await import('/src/firebase.js')).pendingAuth.currentUser.uid);
    const emailInput = `marta.${lang}.planszowki.w.piatkowy.wieczor@przyjaciele.example.test`;
    for (const [email, accepted] of [[`inna.${lang}@przyjaciele.example.test`, false], [emailInput, true]]) {
      await fill(page, '#recovery-email', email);
      await clickText(page, lang === 'en' ? 'Send sign-in link' : 'Wyślij link do logowania');
      await page.waitForFunction(() => !document.querySelector('#recovery-email').disabled);
      const codes = await (await fetch('http://127.0.0.1:19099/emulator/v1/projects/demo-meppletime-local/oobCodes')).json();
      const entry = codes.oobCodes.filter(c => c.email === email).at(-1);
      await page.goto(`${base}/poll/${id}?${new URL(entry.oobLink).searchParams}`);
      await page.waitForFunction(() => !location.search.includes('oobCode'));
      await page.waitForSelector('#splash', { hidden: true });
      if (!accepted) {
        await page.waitForSelector('[data-testid="transfer-recovery"] [role="alert"]');
        await shot(page, `recovery-rejected-${lang}`);
        await page.waitForFunction(() => document.querySelector('[data-testid="transfer-recovery"]').open);
      } else {
        await page.waitForFunction(async uid => (await import('/src/firebase.js')).pendingAuth.currentUser?.uid === uid, {}, targetUid);
        await shot(page, `recovery-restored-${lang}`);
      }
    }

    await page.reload();
    await clickText(page, lang === 'en' ? 'Move my polls and sign in' : 'Przenieś moje ankiety i zaloguj');
    await page.waitForSelector('[data-testid="transfer-panel"]', { hidden: true });
    await shot(page, `signed-in-${lang}`);
    const legacyId = lang === 'en' ? 'v2_legacy1' : 'v2_legacy2';
    await adminDb.doc(`polls/${legacyId}`).set({ id: legacyId, title: lang === 'en' ? 'Earlier game night' : 'Wcześniejszy wieczór z grami',
      createdAt: Timestamp.now(), closed: false, creatorToken: 'public-legacy-token', games: [],
      dates: [{ id: 'legacy-date', date: '2026-10-25', votes: [], comments: [] }] });
    await page.goto(`${base}/poll/${legacyId}?lang=${lang}`);
    await page.waitForFunction(() => document.body.innerText.includes(document.documentElement.lang === 'en' ? 'no verified owner' : 'nie ma potwierdzonego właściciela'));
    await shot(page, `legacy-unclaimed-${lang}`);
    await adminDb.doc(`polls/${legacyId}`).update({ ownerUid: targetUid });
    await page.waitForFunction(() => document.body.innerText.includes(document.documentElement.lang === 'en' ? 'Close voting' : 'Zamknij głosowanie'));
    await shot(page, `legacy-owned-${lang}`);
    await page.goto(`${base}/?lang=${lang}`);
    await page.waitForFunction(() => [...document.querySelectorAll('a')].some(a => a.href.includes('/poll/v2_')));
    await shot(page, `history-${lang}`);
    await page.evaluate(() => {
      const original = window.fetch;
      window.fetch = (...args) => args[0] === '/api/trusted-read' && JSON.parse(args[1]?.body || '{}').action === 'history'
        ? Promise.reject(new Error('Review history failure')) : original(...args);
      window.dispatchEvent(new Event('trusted-change'));
    });
    await page.waitForFunction(() => document.body.innerText.includes(document.documentElement.lang === 'en' ? 'Could not refresh your saved polls' : 'Nie udało się odświeżyć zapisanych ankiet'));
    await shot(page, `history-error-${lang}`);
    await page.browserContext().close();
    currentPage = null;
  }
  await writeFile(`${out}/screen-check.json`, JSON.stringify({ testedAt: new Date().toISOString(), shots, issues }, null, 2)+'\n');
  console.log(`Captured ${shots.length} screens; ${issues.length} console/network observations.`);
} catch (error) {
  await writeFile(`${out}/screen-check-partial.json`, JSON.stringify({ shots, issues, error: String(error) }, null, 2)+'\n');
  throw error;
} finally {
  await closeTestBrowser(browser);
  for (const child of children) child.kill('SIGTERM');
  await closeService();
  for (const url of ['http://127.0.0.1:18080/emulator/v1/projects/demo-meppletime-local/databases/(default)/documents', 'http://127.0.0.1:19099/emulator/v1/projects/demo-meppletime-local/accounts']) {
    assert.ok((await fetch(url, { method: 'DELETE' })).ok);
  }
  console.log('Local review data cleared; services stopped.');
}
