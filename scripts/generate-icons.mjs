// Builds all brand assets from the illustrated MeppleTime logotype
// Adam delivered on 3 Aug 2026 (design-assets/good-logotype.svg).
// The source SVG contains the full lockup; its wordmark is live text
// in Bogart Extrabold (a commercial font browsers do not have), so
// this script strips the <text> element and works with the mark only
// (the illustrated split calendar with the meeple).
//
// Outputs:
// - src/assets/mepple-mark.svg      app header mark
// - public/favicon.svg              app favicon
// - landing/assets/mepple-mark.svg  landing nav/hero/footer mark
// - public/icon-192.png, icon-512.png            transparent PWA icons
// - public/icon-maskable-512.png                 cream bg, safe zone
// - public/apple-touch-icon.png (180)            cream bg
//
// Rendering happens in headless Chrome via puppeteer-core, same as
// scripts/capture-landing-shots.mjs. Run: node scripts/generate-icons.mjs

import { readFileSync, writeFileSync } from 'node:fs';
import puppeteer from 'puppeteer-core';

const CREAM = '#f5ead8';
const SOURCE = 'design-assets/good-logotype.svg';

let svg = readFileSync(SOURCE, 'utf8');
svg = svg.replace(/<text[\s\S]*?<\/text>/, '');

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
});
const page = await browser.newPage();

// Tight bounds of the artwork without the wordmark
await page.setContent(`<body style="margin:0">${svg}</body>`);
const box = await page.evaluate(() => {
  const b = document.querySelector('svg > g').getBBox();
  return { x: b.x, y: b.y, w: b.width, h: b.height };
});
const pad = Math.max(box.w, box.h) * 0.01;
const vb = [box.x - pad, box.y - pad, box.w + 2 * pad, box.h + 2 * pad]
  .map((n) => n.toFixed(2))
  .join(' ');
const mark = svg.replace(/viewBox="[^"]*"/, `viewBox="${vb}"`);
const aspect = (box.w + 2 * pad) / (box.h + 2 * pad);

for (const path of [
  'src/assets/mepple-mark.svg',
  'public/favicon.svg',
  'landing/assets/mepple-mark.svg',
]) {
  writeFileSync(path, mark);
}

// Raster icons: mark centered on a square canvas, contain-fit at
// `fill` of the canvas (maskable stays inside the ~80% safe zone)
async function renderIcon(file, size, { fill, background }) {
  const content = Math.round(size * fill);
  const w = aspect >= 1 ? content : Math.round(content * aspect);
  const h = aspect >= 1 ? Math.round(content / aspect) : content;
  const sized = mark.replace(
    '<svg ',
    `<svg width="${w}" height="${h}" style="position:absolute;left:${(size - w) / 2}px;top:${(size - h) / 2}px" `
  );
  await page.setViewport({ width: size, height: size });
  await page.setContent(
    `<body style="margin:0;width:${size}px;height:${size}px;position:relative;${
      background ? `background:${background}` : ''
    }">${sized}</body>`
  );
  writeFileSync(
    file,
    await page.screenshot({ type: 'png', omitBackground: !background })
  );
  console.log(`${file} (${size}x${size})`);
}

await renderIcon('public/icon-192.png', 192, { fill: 0.96 });
await renderIcon('public/icon-512.png', 512, { fill: 0.96 });
await renderIcon('public/icon-maskable-512.png', 512, { fill: 0.68, background: CREAM });
await renderIcon('public/apple-touch-icon.png', 180, { fill: 0.8, background: CREAM });

await browser.close();
console.log(`mark viewBox: ${vb} (aspect ${aspect.toFixed(3)})`);
