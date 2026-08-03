// One-off capture of washed-screenshot material for the landing page
// (feature 14). Drives the installed Chrome headlessly against the
// demo poll and saves 2x element screenshots into landing/assets/.
// Run: node scripts/capture-landing-shots.mjs <poll-url>
import puppeteer from 'puppeteer-core';
import { mkdirSync } from 'node:fs';

const url = process.argv[2];
if (!url) {
  console.error('usage: node scripts/capture-landing-shots.mjs <poll-url>');
  process.exit(1);
}

mkdirSync('landing/assets', { recursive: true });

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new',
  args: ['--hide-scrollbars']
});

const page = await browser.newPage();
// The heatmap card is captured at a narrow viewport so the calendar
// fills its card instead of hugging the left edge of a wide one
await page.setViewport({ width: 660, height: 1600, deviceScaleFactor: 2 });
// English UI regardless of machine locale
await page.evaluateOnNewDocument(() => {
  window.localStorage.setItem('language', JSON.stringify('en'));
});
// networkidle never fires: Firestore keeps a live channel open
await page.goto(url, { waitUntil: 'load', timeout: 60000 });
await page.waitForFunction(
  () => document.body.innerText.includes('Availability table'),
  { timeout: 30000 }
);
await page.evaluate(() => document.fonts.ready);
await new Promise((r) => setTimeout(r, 1500));

// Switch the calendar to the group availability heatmap
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find(
    (b) => b.textContent.trim() === 'Group availability'
  );
  if (btn) btn.click();
});
await new Promise((r) => setTimeout(r, 500));

async function shootCard(markerText, file) {
  const handle = await page.evaluateHandle((marker) => {
    const cards = [...document.querySelectorAll('div.rounded-lg')];
    return (
      cards
        .filter((d) => d.textContent.includes(marker))
        .sort((a, b) => a.textContent.length - b.textContent.length)[0] ?? null
    );
  }, markerText);
  const el = handle.asElement();
  if (!el) {
    console.error('card not found for marker:', markerText);
    return;
  }
  await el.scrollIntoView();
  await new Promise((r) => setTimeout(r, 400));
  await el.screenshot({ path: file });
  console.log('saved', file);
}

await shootCard('Group availability', 'landing/assets/shot-heatmap.png');

await page.setViewport({ width: 1100, height: 1600, deviceScaleFactor: 2 });
await new Promise((r) => setTimeout(r, 800));
await shootCard('Availability table', 'landing/assets/shot-matrix.png');
await shootCard('What shall we play?', 'landing/assets/shot-games.png');

await browser.close();
