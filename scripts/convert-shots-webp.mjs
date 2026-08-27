// Converts the landing screenshot PNGs to WebP via headless Chrome's
// canvas encoder (feature 21). Run: node scripts/convert-shots-webp.mjs
import puppeteer from 'puppeteer-core';
import { readFileSync, writeFileSync } from 'node:fs';

const SHOTS = ['shot-heatmap', 'shot-matrix', 'shot-games'];

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new'
});
const page = await browser.newPage();

for (const name of SHOTS) {
  const png = readFileSync(`landing/assets/${name}.png`).toString('base64');
  const dataUrl = await page.evaluate(async (b64) => {
    const img = new Image();
    img.src = 'data:image/png;base64,' + b64;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    c.getContext('2d').drawImage(img, 0, 0);
    return c.toDataURL('image/webp', 0.82);
  }, png);
  const out = Buffer.from(dataUrl.split(',')[1], 'base64');
  writeFileSync(`landing/assets/${name}.webp`, out);
  console.log(`${name}.webp ${out.length}B (png was ${Buffer.from(png, 'base64').length}B)`);
}
await browser.close();
