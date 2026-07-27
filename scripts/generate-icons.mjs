// Regenerates the PWA icons with the MeppleTime brand mark (see
// design-assets/MeppleTime Design System.html and
// src/components/shared/Logo.jsx): a split calendar tile, sage left
// and terracotta right, cream meeple on the seam, binder rings on
// top. Dependency-free PNG encoding (zlib is built into Node).
// Run: node scripts/generate-icons.mjs
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';

// Brand colors (keep in step with Logo.jsx)
const SAGE = [0x7a, 0x8a, 0x5e];
const TERRA = [0xc6, 0x71, 0x39];
const SAGE_DARK = [0x56, 0x63, 0x3f];
const TERRA_DARK = [0x8c, 0x49, 0x1a];
const CREAM = [0xf5, 0xea, 0xd8];

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const out = Buffer.alloc(8 + data.length + 4);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, 'ascii'), data])), 8 + data.length);
  return out;
}

function encodePng(size, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

function inRoundedRect(x, y, x0, y0, w, h, r) {
  if (x < x0 || x > x0 + w || y < y0 || y > y0 + h) return false;
  const dx = Math.max(x0 + r - x, x - (x0 + w - r), 0);
  const dy = Math.max(y0 + r - y, y - (y0 + h - r), 0);
  return dx * dx + dy * dy <= r * r;
}

/**
 * Color of the mark at a point in its 84-unit reference space, or
 * null outside it. Geometry ported 1:1 from the design reference.
 */
function markColorAt(x, y) {
  // Cream meeple (drawn over the tile): head, arms, trapezoid body
  const hx = x - 42;
  const hy = y - 35;
  if (hx * hx + hy * hy <= 100) return CREAM;
  if (inRoundedRect(x, y, 18, 47, 48, 10, 5)) return CREAM;
  if (y >= 51 && y <= 75) {
    const t = (y - 51) / 24;
    if (x >= 30 - 13 * t && x <= 54 + 13 * t) return CREAM;
  }
  // Split tile
  if (inRoundedRect(x, y, 0, 8, 84, 76, 20)) return x < 42 ? SAGE : TERRA;
  // Binder rings
  if (inRoundedRect(x, y, 18.5, 0, 9, 13, 4.5)) return SAGE_DARK;
  if (inRoundedRect(x, y, 53.8, 0, 9, 13, 4.5)) return TERRA_DARK;
  return null;
}

/**
 * Render one icon at `size` px, supersampled 4x.
 * background: null (transparent) or [r,g,b] canvas fill
 * markScale: mark width as a fraction of the canvas
 */
function renderIcon(size, { background = null, markScale = 0.9 } = {}) {
  const SS = 4;
  const big = size * SS;
  const px = new Float64Array(big * big * 4);
  const unit = (big * markScale) / 84;
  const ox = (big - 84 * unit) / 2;
  const oy = (big - 84 * unit) / 2;

  for (let y = 0; y < big; y++) {
    for (let x = 0; x < big; x++) {
      const i = (y * big + x) * 4;
      let r, g, b, a;
      if (background) {
        [r, g, b] = background;
        a = 255;
      } else {
        r = g = b = a = 0;
      }
      const c = markColorAt((x + 0.5 - ox) / unit, (y + 0.5 - oy) / unit);
      if (c) {
        [r, g, b] = c;
        a = 255;
      }
      px[i] = r;
      px[i + 1] = g;
      px[i + 2] = b;
      px[i + 3] = a;
    }
  }

  // Box-downsample SS x SS -> 1 px (premultiplied for clean edges)
  const out = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const i = ((y * SS + sy) * big + x * SS + sx) * 4;
          const alpha = px[i + 3] / 255;
          r += px[i] * alpha;
          g += px[i + 1] * alpha;
          b += px[i + 2] * alpha;
          a += px[i + 3];
        }
      }
      const n = SS * SS;
      const alpha = a / n;
      const o = (y * size + x) * 4;
      out[o] = alpha > 0 ? Math.round(r / n / (alpha / 255)) : 0;
      out[o + 1] = alpha > 0 ? Math.round(g / n / (alpha / 255)) : 0;
      out[o + 2] = alpha > 0 ? Math.round(b / n / (alpha / 255)) : 0;
      out[o + 3] = Math.round(alpha);
    }
  }
  return encodePng(size, out);
}

writeFileSync('public/icon-192.png', renderIcon(192));
writeFileSync('public/icon-512.png', renderIcon(512));
// Maskable: full-bleed cream ground, mark inside the 80% safe zone
writeFileSync('public/icon-maskable-512.png', renderIcon(512, { background: CREAM, markScale: 0.64 }));
// Apple touch icons must be opaque
writeFileSync('public/apple-touch-icon.png', renderIcon(180, { background: CREAM, markScale: 0.8 }));
console.log('icons written: icon-192, icon-512, icon-maskable-512, apple-touch-icon');
