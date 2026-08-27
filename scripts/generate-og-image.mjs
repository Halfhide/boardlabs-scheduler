// Generates the 1200x630 social share card (Open Graph / Twitter)
// into landing/assets/og-card.png from the brand assets (feature 19).
// Same headless-Chrome approach as generate-icons.mjs.
// Run: node scripts/generate-og-image.mjs
import puppeteer from 'puppeteer-core';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

mkdirSync('landing/assets', { recursive: true });

const markSvg = readFileSync('landing/assets/mepple-mark.svg', 'utf8');
const markDataUri = `data:image/svg+xml;base64,${Buffer.from(markSvg).toString('base64')}`;

const html = `<!doctype html>
<html><head>
<meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Caprasimo&family=Figtree:wght@600&display=swap" rel="stylesheet">
<style>
  * { margin: 0; }
  body {
    width: 1200px; height: 630px; overflow: hidden;
    background: #f5ead8;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center; gap: 26px;
    font-family: 'Figtree', system-ui, sans-serif;
  }
  img.mark { width: 230px; height: auto; }
  .word { font-family: 'Caprasimo', serif; font-size: 88px; line-height: 1; }
  .word .m { color: #5c6b47; }
  .word .t { color: #b25f34; }
  .tag { font-size: 34px; font-weight: 600; color: #55503f; }
  .site { font-size: 24px; font-weight: 600; color: #8a8271; letter-spacing: 0.04em; }
</style></head>
<body>
  <img class="mark" src="${markDataUri}" alt="">
  <div class="word"><span class="m">Mepple</span><span class="t">Time</span></div>
  <div class="tag">Game night, finally scheduled.</div>
  <div class="site">meppletime.today</div>
</body></html>`;

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new',
  args: ['--hide-scrollbars']
});
const page = await browser.newPage();
await page.setViewport({ width: 1200, height: 630, deviceScaleFactor: 1 });
await page.setContent(html, { waitUntil: 'networkidle0' });
await page.evaluate(() => document.fonts.ready);
const buf = await page.screenshot({ type: 'png' });
writeFileSync('landing/assets/og-card.png', buf);
console.log('landing/assets/og-card.png', buf.length, 'bytes');
await browser.close();
