// JSON export / import. This is the whole sync story between iPhone and iPad:
// export on one device, open the file on the other, merge by item id with the
// newer updatedAt winning.

import * as store from './store.js';
import { state, saveSettings, syncUnlocks, emitChange, nowISO } from './state.js';
import { todayISO } from './periods.js';
import * as theme from './theme.js';
import * as assets from './assets.js';
import * as layout from './layout.js';
import * as canvas from './canvas.js';
import * as notebook from './notebook.js';

export const SCHEMA = 1;

export function buildBackup() {
  return {
    app: 'shelf-marks',
    schema: SCHEMA,
    exportedAt: nowISO(),
    year: state.settings.year,
    settings: { ...state.settings },
    books: state.books.map((b) => ({ ...b })),
    challenges: state.challengeRecords.map((c) => ({ ...c })),
    unlocks: state.unlocks.map((u) => ({ ...u })),
    // Bookmark photos travel as data URLs so the backup stays one plain file.
    images: [...state.images.values()].map((i) => ({ ...i })),
    // The design settings ride along, so a restored device looks right too.
    theme: theme.snapshot(),
    // …as do your pictures and the way your pages are arranged.
    assets: assets.snapshot(),
    layouts: layout.snapshot(),
    canvas: canvas.snapshot(),
    notebook: notebook.snapshot(),
    words: state.words.map((w) => ({ ...w })),
  };
}

export async function exportBackup() {
  const payload = buildBackup();
  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `shelf-marks-${todayISO()}.json`;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);

  await saveSettings({ lastExportedAt: payload.exportedAt });
  return { filename: a.download, bytes: blob.size, counts: countsOf(payload) };
}

function countsOf(payload) {
  return {
    books: (payload.books || []).length,
    challenges: (payload.challenges || []).length,
    unlocks: (payload.unlocks || []).length,
    images: (payload.images || []).length,
    assets: (payload.assets || []).length,
    layouts: (payload.layouts || []).length,
    canvas: (payload.canvas || []).length,
    notebook: (payload.notebook || []).length,
    words: (payload.words || []).length,
  };
}

function newer(incoming, current) {
  const a = incoming && incoming.updatedAt ? String(incoming.updatedAt) : '';
  const b = current && current.updatedAt ? String(current.updatedAt) : '';
  if (!b) return true;
  if (!a) return false;
  return a > b;
}

function mergeCollection(incoming, currentList, storeName) {
  const byId = new Map(currentList.map((x) => [x.id, x]));
  const writes = [];
  let added = 0;
  let updated = 0;
  let skipped = 0;

  for (const raw of incoming || []) {
    if (!raw || !raw.id) { skipped += 1; continue; }
    const current = byId.get(raw.id);
    if (!current) {
      const record = { ...raw };
      if (!record.updatedAt) record.updatedAt = nowISO();
      byId.set(record.id, record);
      writes.push(record);
      added += 1;
    } else if (newer(raw, current)) {
      const record = { ...current, ...raw };
      byId.set(record.id, record);
      writes.push(record);
      updated += 1;
    } else {
      skipped += 1;
    }
  }

  return { writes, added, updated, skipped, storeName, merged: [...byId.values()] };
}

export function parseBackup(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch (err) {
    throw new Error('That file is not valid JSON.');
  }
  if (!data || typeof data !== 'object') {
    throw new Error('That file does not look like a Shelf Marks backup.');
  }
  if (data.app && data.app !== 'shelf-marks') {
    throw new Error(`That backup is from “${data.app}”, not Shelf Marks.`);
  }
  if (!Array.isArray(data.books)) {
    throw new Error('That backup has no books list — it may be truncated.');
  }
  if (data.schema && Number(data.schema) > SCHEMA) {
    throw new Error('That backup was made by a newer version of Shelf Marks. Update this device first.');
  }
  return data;
}

export async function importBackup(text) {
  const data = parseBackup(text);

  const assetRows = mergeCollection(data.assets, assets.snapshot(), 'assets');
  const layoutRows = mergeCollection(data.layouts, layout.snapshot(), 'layouts');
  const canvasRows = mergeCollection(data.canvas, canvas.snapshot(), 'canvas');
  const notebookRows = mergeCollection(data.notebook, notebook.snapshot(), 'notebook');
  const words = mergeCollection(data.words, state.words, 'words');
  const books = mergeCollection(data.books, state.books, 'books');
  const challenges = mergeCollection(data.challenges, state.challengeRecords, 'challenges');
  const unlocks = mergeCollection(data.unlocks, state.unlocks, 'unlocks');
  const images = mergeCollection(data.images, [...state.images.values()], 'images');

  for (const group of [books, challenges, unlocks, images, assetRows, layoutRows, canvasRows, notebookRows, words]) {
    if (group.writes.length) await store.putMany(group.storeName, group.writes);
  }
  assets.adoptMany(assetRows.merged);
  layout.adoptMany(layoutRows.merged);
  canvas.adoptMany(canvasRows.merged);
  notebook.adoptMany(notebookRows.merged);

  state.books = books.merged.filter((b) => !b.deleted);
  state.challengeRecords = challenges.merged;
  state.unlocks = unlocks.merged;
  state.images = new Map(images.merged.map((i) => [i.id, i]));
  state.words = words.merged.filter((w) => !w.deleted);

  // Settings is a single row, so it follows the same newer-wins rule.
  let settingsChanged = false;
  if (data.settings && typeof data.settings === 'object') {
    if (newer(data.settings, state.settings)) {
      await saveSettings({ ...data.settings, id: 'settings' });
      settingsChanged = true;
    }
  }

  // The design travels with the backup; newer wins, like everything else.
  let themeChanged = false;
  if (data.theme && typeof data.theme === 'object') {
    const current = await store.get('meta', 'theme');
    if (newer(data.theme, current || {})) {
      await store.put('meta', { ...data.theme, id: 'theme' });
      await theme.adoptFromBackup(data.theme, state.settings.year);
      themeChanged = true;
    }
  }

  const unlockedNow = await syncUnlocks();
  emitChange();

  return {
    books: pick(books),
    challenges: pick(challenges),
    unlocks: pick(unlocks),
    images: pick(images),
    assets: pick(assetRows),
    layouts: pick(layoutRows),
    canvas: pick(canvasRows),
    notebook: pick(notebookRows),
    settingsChanged,
    themeChanged,
    newlyUnlocked: unlockedNow.length,
    exportedAt: data.exportedAt || null,
  };
}

function pick(g) {
  return { added: g.added, updated: g.updated, skipped: g.skipped };
}

export function readFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Could not read that file.'));
    reader.readAsText(file);
  });
}

// Bookmark photo → data URL, downscaled so backups stay a sane size.
export function fileToDataUrl(file, maxEdge = 1200) {
  return new Promise((resolve, reject) => {
    if (!file || !/^image\//.test(file.type)) {
      reject(new Error('Pick an image file.'));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read that image.'));
    reader.onload = () => {
      const src = String(reader.result || '');
      const img = new Image();
      img.onerror = () => resolve(src); // can't decode it here — keep the original
      img.onload = () => {
        try {
          const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
          if (scale >= 1 && src.length < 400000) { resolve(src); return; }
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(img.width * scale));
          canvas.height = Math.max(1, Math.round(img.height * scale));
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', 0.82));
        } catch (_) {
          resolve(src);
        }
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  });
}
