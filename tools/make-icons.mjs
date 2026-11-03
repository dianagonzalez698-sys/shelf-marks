// Generates the app icons as real PNGs (iOS will not use an SVG for a
// home-screen icon). No dependencies — just a tiny PNG encoder over zlib.
//
//   node tools/make-icons.mjs
//
// Edit COLORS or draw() below and re-run to change the mark.

import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'icons');

const COLORS = {
  bg:   [0x2c, 0x38, 0x30],   // deep forest
  mark: [0xf4, 0xed, 0xe1],   // cream bookmark
  band: [0xc2, 0x92, 0x4a],   // gold band
  shelf:[0xa8, 0x80, 0x3c],   // gold shelf line
};

/* ----------------------------------------------------------- PNG writer ---- */

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function encodePng(width, height, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;    // bit depth
  ihdr[9] = 6;    // truecolour + alpha
  ihdr[10] = 0;   // deflate
  ihdr[11] = 0;   // adaptive filtering
  ihdr[12] = 0;   // no interlace

  // One filter byte (0 = none) per scanline.
  const raw = Buffer.alloc(height * (width * 4 + 1));
  for (let y = 0; y < height; y += 1) {
    const rowStart = y * (width * 4 + 1);
    raw[rowStart] = 0;
    rgba.copy(raw, rowStart + 1, y * width * 4, (y + 1) * width * 4);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/* ------------------------------------------------------------- the mark ---- */

// Returns a colour for a point in normalized 0..1 space, or null for "background".
function markAt(x, y) {
  // bookmark ribbon: a rectangle whose bottom edge notches up to a V
  const halfW = 0.165;
  const top = 0.145;
  const dx = Math.abs(x - 0.5);
  if (dx <= halfW && y >= top) {
    const bottom = 0.615 + 0.105 * (dx / halfW);
    if (y <= bottom) {
      if (y >= 0.265 && y <= 0.315) return COLORS.band;
      return COLORS.mark;
    }
  }
  // shelf line under the bookmark, with rounded ends
  const shelfY = 0.815;
  const shelfH = 0.021;
  if (Math.abs(y - shelfY) <= shelfH) {
    const half = 0.30;
    const d = Math.abs(x - 0.5);
    if (d <= half - shelfH) return COLORS.shelf;
    if (d <= half) {
      const t = (d - (half - shelfH)) / shelfH;
      if (Math.hypot(t, (y - shelfY) / shelfH) <= 1) return COLORS.shelf;
    }
  }
  return null;
}

// scale: how much of the canvas the mark occupies (maskable icons need padding)
function draw(size, scale) {
  const rgba = Buffer.alloc(size * size * 4);
  const SS = 3; // 3x3 supersampling for smooth edges
  const inset = (1 - scale) / 2;

  for (let py = 0; py < size; py += 1) {
    for (let px = 0; px < size; px += 1) {
      let r = 0; let g = 0; let b = 0; let hits = 0;
      for (let sy = 0; sy < SS; sy += 1) {
        for (let sx = 0; sx < SS; sx += 1) {
          const nx = (px + (sx + 0.5) / SS) / size;
          const ny = (py + (sy + 0.5) / SS) / size;
          // map canvas space into the mark's (possibly inset) box
          const mx = (nx - inset) / scale;
          const my = (ny - inset) / scale;
          const c = (mx >= 0 && mx <= 1 && my >= 0 && my <= 1) ? markAt(mx, my) : null;
          if (c) { r += c[0]; g += c[1]; b += c[2]; hits += 1; }
        }
      }
      const total = SS * SS;
      const i = (py * size + px) * 4;
      if (hits === 0) {
        rgba[i] = COLORS.bg[0]; rgba[i + 1] = COLORS.bg[1]; rgba[i + 2] = COLORS.bg[2];
      } else {
        const a = hits / total;
        rgba[i]     = Math.round((r / hits) * a + COLORS.bg[0] * (1 - a));
        rgba[i + 1] = Math.round((g / hits) * a + COLORS.bg[1] * (1 - a));
        rgba[i + 2] = Math.round((b / hits) * a + COLORS.bg[2] * (1 - a));
      }
      rgba[i + 3] = 255; // opaque: iOS home-screen icons must not be transparent
    }
  }
  return encodePng(size, size, rgba);
}

mkdirSync(OUT, { recursive: true });
const files = [
  ['icon-180.png', 180, 1],            // apple-touch-icon
  ['icon-192.png', 192, 1],
  ['icon-512.png', 512, 1],
  ['icon-maskable-512.png', 512, 0.72], // padded for Android's mask
  ['favicon-32.png', 32, 1],
];
for (const [name, size, scale] of files) {
  const png = draw(size, scale);
  writeFileSync(join(OUT, name), png);
  console.log(`${name.padEnd(24)} ${size}x${size}  ${(png.length / 1024).toFixed(1)} KB`);
}
