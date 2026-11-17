// Builds landing/favicon.ico (16, 32 and 48 px) from the landing mark,
// for crawlers and tools that request /favicon.ico directly instead of
// reading <link rel="icon"> (feature 24). The ICO stores PNG images,
// which every current browser and search engine reads.
// Run: node scripts/generate-favicon-ico.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import puppeteer from 'puppeteer-core';

const SIZES = [16, 32, 48];
const svg = readFileSync('landing/assets/mepple-mark.svg', 'utf8');

const browser = await puppeteer.launch({
  executablePath:
    process.env.CHROME_PATH ||
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new'
});
const page = await browser.newPage();
const pngs = [];
for (const size of SIZES) {
  await page.setViewport({ width: size, height: size, deviceScaleFactor: 1 });
  const dataUrl = 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64');
  await page.setContent(`<html><body style="margin:0;background:transparent">
    <img src="${dataUrl}" style="display:block;width:${size}px;height:${size}px;object-fit:contain" />
  </body></html>`);
  await page.waitForFunction(() => document.querySelector('img').complete);
  pngs.push(await page.screenshot({ type: 'png', omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } }));
}
await browser.close();

// ICO container: 6-byte header, one 16-byte entry per image, then data
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(SIZES.length, 4);
let offset = 6 + 16 * SIZES.length;
const entries = SIZES.map((size, i) => {
  const entry = Buffer.alloc(16);
  entry.writeUInt8(size, 0);
  entry.writeUInt8(size, 1);
  entry.writeUInt8(0, 2);
  entry.writeUInt8(0, 3);
  entry.writeUInt16LE(1, 4);
  entry.writeUInt16LE(32, 6);
  entry.writeUInt32LE(pngs[i].length, 8);
  entry.writeUInt32LE(offset, 12);
  offset += pngs[i].length;
  return entry;
});
const ico = Buffer.concat([header, ...entries, ...pngs]);
writeFileSync('landing/favicon.ico', ico);
console.log('landing/favicon.ico', ico.length, 'bytes');
