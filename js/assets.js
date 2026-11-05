// The asset library: your own photographs, paintings, cutouts and textures.
//
// Everything is held in IndexedDB as a data URL, which keeps the app a pure
// static site (no uploads, no server) and lets images ride along inside the
// ordinary device backup. Large originals are downscaled on the way in — a
// reading journal does not need 4000px scans, and the backup file would
// become unusable.

import * as store from './store.js';

export const KINDS = [
  ['artwork', 'Artwork / painting'],
  ['photo', 'Photograph'],
  ['cutout', 'Cutout (transparent PNG)'],
  ['texture', 'Texture / paper'],
  ['ornament', 'Small ornament or sticker'],
];

// Bigger than any slot the design actually uses, small enough to keep backups sane.
const MAX_EDGE = { artwork: 1800, photo: 1600, cutout: 1800, texture: 1200, ornament: 700 };
const JPEG_QUALITY = 0.84;
export const SOFT_TOTAL_WARN = 18 * 1024 * 1024;   // nag past ~18MB of assets

const cache = new Map();   // id -> asset record
let loaded = false;

function uid() {
  const rand = (crypto && crypto.randomUUID)
    ? crypto.randomUUID().replace(/-/g, '').slice(0, 12)
    : Math.random().toString(36).slice(2, 14);
  return `as_${Date.now().toString(36)}_${rand}`;
}

export async function load() {
  const rows = await store.getAll('assets');
  cache.clear();
  rows.filter((r) => r && r.id).forEach((r) => cache.set(r.id, r));
  loaded = true;
  return list();
}

export function list({ kind = null } = {}) {
  const all = [...cache.values()].sort((a, b) =>
    String(b.addedAt || '').localeCompare(String(a.addedAt || '')));
  return kind ? all.filter((a) => a.kind === kind) : all;
}

export function get(id) {
  return id ? cache.get(id) || null : null;
}

/** The data URL for an asset, or null — every renderer goes through this. */
export function src(id) {
  const a = get(id);
  return a ? a.dataUrl : null;
}

export function isLoaded() { return loaded; }

/**
 * Bring older pictures up to date: record whether they carry transparency, and
 * trim the empty margins off cut-outs added before trimming existed.
 */
export async function backfillAlpha() {
  const pending = [...cache.values()]
    .filter((a) => a.hasAlpha === undefined || a.trimmed === undefined
      || a.frameSlice === undefined
      // measured before the valance's true depth was recorded
      || (a.frameSlice && a.frameSlice.archMax === undefined));
  if (!pending.length) return 0;

  for (const a of pending) {
    const next = { ...a };
    if ((a.kind === 'cutout' || a.kind === 'ornament') && a.trimmed === undefined) {
      const tight = await trimTransparent(a.dataUrl);
      if (tight) {
        next.dataUrl = tight.dataUrl;
        next.w = tight.w;
        next.h = tight.h;
        next.bytes = Math.round(tight.dataUrl.length * 0.75);
      }
    }
    next.trimmed = true;
    if (next.frameSlice === undefined
      || (next.frameSlice && next.frameSlice.archMax === undefined)) {
      next.frameSlice = await detectFrameSlice(next.dataUrl);
    }
    if (next.hasAlpha === undefined) next.hasAlpha = await detectAlpha(next.dataUrl);
    cache.set(a.id, next);
    try { await store.put('assets', next); } catch (_) { /* cache still right */ }
  }
  return pending.length;
}

export function totalBytes() {
  let n = 0;
  cache.forEach((a) => { n += (a.bytes || (a.dataUrl ? a.dataUrl.length * 0.75 : 0)); });
  return n;
}

/** Decode a File, downscale to the kind's limit, and return a data URL. */
function toDataUrl(file, kind) {
  return new Promise((resolve, reject) => {
    if (!file || !/^image\//.test(file.type)) {
      reject(new Error('That is not an image file.'));
      return;
    }
    // Only the kinds that are *meant* to be transparent stay PNG. Artwork,
    // photographs and papers are opaque by definition, so a PNG scan of a
    // painting becomes a JPEG — otherwise one upload can be several megabytes
    // and the backup file becomes painful to move between devices.
    const keepAlpha = kind === 'cutout' || kind === 'ornament';
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read that image.'));
    reader.onload = () => {
      const original = String(reader.result || '');
      if (/^data:image\/svg/.test(original)) { resolve({ dataUrl: original, w: 0, h: 0 }); return; }
      const img = new Image();
      img.onerror = () => reject(new Error('That image could not be decoded.'));
      img.onload = () => {
        try {
          const max = MAX_EDGE[kind] || 1600;
          const scale = Math.min(1, max / Math.max(img.width, img.height));
          const w = Math.max(1, Math.round(img.width * scale));
          const h = Math.max(1, Math.round(img.height * scale));
          if (scale >= 1 && original.length < 700000) {
            resolve({ dataUrl: original, w: img.width, h: img.height });
            return;
          }
          const canvas = document.createElement('canvas');
          canvas.width = w; canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, w, h);
          resolve({
            dataUrl: keepAlpha ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', JPEG_QUALITY),
            w, h,
          });
        } catch (err) {
          reject(new Error('That image could not be processed.'));
        }
      };
      img.src = original;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Does this image actually have transparent pixels? A PNG with a solid black
 * background is opaque, and using it as an alpha mask cuts nothing — which
 * looks exactly like the feature being broken.
 */
export function detectAlpha(dataUrl) {
  return new Promise((resolve) => {
    if (!dataUrl || !/^data:image\/(png|webp|gif|svg)/.test(dataUrl)) { resolve(false); return; }
    const img = new Image();
    img.onerror = () => resolve(false);
    img.onload = () => {
      try {
        const w = Math.min(120, img.width || 120);
        const h = Math.max(1, Math.round((img.height / img.width) * w)) || 1;
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        const ctx = c.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(img, 0, 0, w, h);
        const { data } = ctx.getImageData(0, 0, w, h);
        for (let i = 3; i < data.length; i += 4) {
          if (data[i] < 240) { resolve(true); return; }
        }
        resolve(false);
      } catch (_) { resolve(false); }
    };
    img.src = dataUrl;
  });
}

/**
 * Crop fully transparent margins off a cut-out.
 *
 * Decorative PNGs are usually drawn inside a larger canvas with empty space
 * around them. Laid across a section edge that empty space is still part of
 * the image, so the artwork floats in the middle of its band instead of
 * filling it — which reads as the band being positioned wrongly.
 *
 * Returns null when there is nothing to trim.
 */
export function trimTransparent(dataUrl) {
  return new Promise((resolve) => {
    if (!dataUrl || !/^data:image\/(png|webp|gif)/.test(dataUrl)) { resolve(null); return; }
    const img = new Image();
    img.onerror = () => resolve(null);
    img.onload = () => {
      try {
        const w = img.width;
        const h = img.height;
        if (!w || !h) { resolve(null); return; }
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        const ctx = c.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(img, 0, 0);
        const { data } = ctx.getImageData(0, 0, w, h);

        let top = h; let left = w; let right = -1; let bottom = -1;
        for (let y = 0; y < h; y += 1) {
          for (let x = 0; x < w; x += 1) {
            if (data[(y * w + x) * 4 + 3] > 8) {
              if (y < top) top = y;
              if (y > bottom) bottom = y;
              if (x < left) left = x;
              if (x > right) right = x;
            }
          }
        }
        if (right < 0) { resolve(null); return; }               // nothing drawn
        const nw = right - left + 1;
        const nh = bottom - top + 1;
        if (nw === w && nh === h) { resolve(null); return; }    // already tight
        const out = document.createElement('canvas');
        out.width = nw; out.height = nh;
        out.getContext('2d').drawImage(c, left, top, nw, nh, 0, 0, nw, nh);
        resolve({ dataUrl: out.toDataURL('image/png'), w: nw, h: nh });
      } catch (_) { resolve(null); }
    };
    img.src = dataUrl;
  });
}

/**
 * Where the opening sits inside a frame picture, in source pixels.
 *
 * A proscenium — a valance with drapes down each side — only scales right as a
 * nine-slice: the top keeps its height, the sides stretch, the corners stay
 * put. That needs to know how thick each side is, which is a property of the
 * picture, not something anyone should be asked to measure. So we read it:
 * walk in from the middle of each edge until the picture goes transparent,
 * and that distance is the slice.
 */
export function detectFrameSlice(dataUrl) {
  return new Promise((resolve) => {
    if (!dataUrl) { resolve(null); return; }
    const img = new Image();
    img.onerror = () => resolve(null);
    img.onload = () => {
      try {
        const w = img.width;
        const h = img.height;
        if (!w || !h) { resolve(null); return; }
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        const ctx = c.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(img, 0, 0);
        const { data } = ctx.getImageData(0, 0, w, h);
        const solid = (x, y) => data[((y * w + x) * 4) + 3] > 24;

        const midX = Math.floor(w / 2);
        const midY = Math.floor(h / 2);
        let top = 0;
        while (top < h - 1 && solid(midX, top)) top += 1;
        let bottom = 0;
        while (bottom < h - 1 && solid(midX, h - 1 - bottom)) bottom += 1;
        let left = 0;
        while (left < w - 1 && solid(left, midY)) left += 1;
        let right = 0;
        while (right < w - 1 && solid(w - 1 - right, midY)) right += 1;

        // No hole in the middle — not a frame. Caller falls back.
        if (top + bottom >= h - 2 || left + right >= w - 2) { resolve(null); return; }

        // How far the valance actually reaches down, across the whole opening.
        //
        // `top` above is sampled from one column — the middle — which is only
        // the lowest point if the picture happens to dip there. A scalloped
        // pelmet usually does the opposite: the centre is a high point between
        // two swags, so a centre sample reads far too shallow and anything
        // placed below it ends up under the cloth. Walk every column between
        // the drapes and keep the deepest.
        let archMax = 0;
        for (let x = left; x < w - right; x += 1) {
          let d = 0;
          while (d < h - 1 && solid(x, d)) d += 1;
          if (d > archMax) archMax = d;
          // A column that is opaque all the way down is part of a drape, not
          // the valance; ignore it rather than let it claim the whole height.
          if (archMax >= h - 1) { archMax = top; break; }
        }
        if (archMax < top) archMax = top;

        // Keep a sliver of the opening in each slice so the stretched edges
        // never sample the hard cut line.
        const pad = 2;
        resolve({
          top: Math.min(h - 1, top + pad),
          right: Math.min(w - 1, right + pad),
          bottom: Math.min(h - 1, bottom + pad),
          left: Math.min(w - 1, left + pad),
          archMax: Math.min(h - 1, archMax + pad),
          w,
          h,
        });
      } catch (_) { resolve(null); }
    };
    img.src = dataUrl;
  });
}

export async function add(file, { kind = 'photo', name = '', alt = '' } = {}) {
  let { dataUrl, w, h } = await toDataUrl(file, kind);
  // Cut-outs are trimmed to their drawing so they sit where they are placed.
  if (kind === 'cutout' || kind === 'ornament') {
    const tight = await trimTransparent(dataUrl);
    if (tight) { dataUrl = tight.dataUrl; w = tight.w; h = tight.h; }
  }
  const record = {
    id: uid(),
    name: (name || file.name || 'Untitled').replace(/\.[a-z0-9]+$/i, '').slice(0, 80),
    alt: alt || '',
    kind,
    dataUrl,
    w, h,
    bytes: Math.round(dataUrl.length * 0.75),
    hasAlpha: await detectAlpha(dataUrl),
    frameSlice: await detectFrameSlice(dataUrl),
    trimmed: true,
    addedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await store.put('assets', record);
  cache.set(record.id, record);
  return record;
}

export async function update(id, patch) {
  const current = get(id);
  if (!current) return null;
  const record = { ...current, ...patch, id, updatedAt: new Date().toISOString() };
  await store.put('assets', record);
  cache.set(id, record);
  return record;
}

export async function remove(id) {
  await store.remove('assets', id);
  cache.delete(id);
}

/* ------------------------------------------------- backup integration ---- */

export function snapshot() {
  return [...cache.values()].map((a) => ({ ...a }));
}

export function adoptMany(rows) {
  (rows || []).forEach((r) => { if (r && r.id) cache.set(r.id, r); });
}
