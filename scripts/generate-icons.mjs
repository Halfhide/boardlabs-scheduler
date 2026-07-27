// Regenerates the PWA icons in the Organic design system colors:
// a terracotta rounded die with cream pips. Dependency-free PNG
// encoding (zlib is built into Node). Run: node scripts/generate-icons.mjs
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';

// Organic tokens (keep in step with src/index.css)
const TERRA = [0xc6, 0x71, 0x39];
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

// Signed distance to a rounded square centered at (cx, cy)
function roundedRectSdf(x, y, cx, cy, half, radius) {
  const dx = Math.abs(x - cx) - (half - radius);
  const dy = Math.abs(y - cy) - (half - radius);
  const ax = Math.max(dx, 0);
  const ay = Math.max(dy, 0);
  return Math.hypot(ax, ay) + Math.min(Math.max(dx, dy), 0) - radius;
}

/**
 * Render one icon at `size` px, supersampled 4x.
 * background: null (transparent) or an [r,g,b] fill covering the canvas
 * dieScale: die width as a fraction of the canvas
 */
function renderIcon(size, { background = null, dieScale = 0.86 } = {}) {
  const SS = 4;
  const big = size * SS;
  const px = new Float64Array(big * big * 4);

  const cx = big / 2;
  const cy = big / 2;
  const half = (big * dieScale) / 2;
  const corner = half * 0.42;
  const pipR = half * 0.21;
  const off = half * 0.5;
  // Classic five: center + four corners
  const pips = [
    [cx, cy],
    [cx - off, cy - off],
    [cx + off, cy - off],
    [cx - off, cy + off],
    [cx + off, cy + off]
  ];

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

      const d = roundedRectSdf(x + 0.5, y + 0.5, cx, cy, half, corner);
      if (d < 0) {
        // Inside the die: subtle vertical shade from terra to darker
        const t = (y - (cy - half)) / (2 * half);
        r = TERRA[0] + (TERRA_DARK[0] - TERRA[0]) * t * 0.35;
        g = TERRA[1] + (TERRA_DARK[1] - TERRA[1]) * t * 0.35;
        b = TERRA[2] + (TERRA_DARK[2] - TERRA[2]) * t * 0.35;
        a = 255;
        for (const [pxx, pyy] of pips) {
          if (Math.hypot(x + 0.5 - pxx, y + 0.5 - pyy) < pipR) {
            [r, g, b] = CREAM;
            break;
          }
        }
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
// Maskable: full-bleed cream ground, die inside the 80% safe zone
writeFileSync('public/icon-maskable-512.png', renderIcon(512, { background: CREAM, dieScale: 0.62 }));
// Apple touch icons must be opaque
writeFileSync('public/apple-touch-icon.png', renderIcon(180, { background: CREAM, dieScale: 0.78 }));
console.log('icons written: icon-192, icon-512, icon-maskable-512, apple-touch-icon');
