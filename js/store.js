// IndexedDB wrapper. Every call resolves or rejects — nothing throws
// synchronously — and every failure is reported through onStorageError so the
// UI can show a banner instead of silently losing a book.

const DB_NAME = 'shelf-marks';
const DB_VERSION = 2;   // 2 added: assets, layouts
// The upgrade handler creates any store missing from this list, so adding a
// name here plus bumping DB_VERSION is a safe, data-preserving migration.
export const STORES = [
  'books', 'settings', 'challenges', 'unlocks', 'images', 'meta',
  'assets',   // your uploaded photographs, paintings, textures and cutouts
  'layouts',  // the editorial section arrangement for each page
];

let dbPromise = null;
let lastError = null;
const errorListeners = new Set();

export function onStorageError(fn) {
  errorListeners.add(fn);
  if (lastError) fn(lastError);
  return () => errorListeners.delete(fn);
}

function reportError(message, err) {
  lastError = { message, detail: err ? String(err.message || err) : '' };
  if (err) console.error('[shelf-marks]', message, err);
  errorListeners.forEach((fn) => {
    try { fn(lastError); } catch (_) { /* a broken listener must not break storage */ }
  });
}

function friendly(err) {
  const name = err && err.name;
  if (name === 'QuotaExceededError') {
    return 'The device is out of storage space. Remove a bookmark photo or two and try again.';
  }
  if (name === 'InvalidStateError' || name === 'SecurityError') {
    return 'This browser is blocking local storage. Private Browsing on Safari does this — open Shelf Marks in a normal tab.';
  }
  if (name === 'VersionError') {
    return 'This device has a newer version of the Shelf Marks database. Reload the page.';
  }
  return 'Could not reach local storage on this device.';
}

export function open() {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    let request;
    try {
      if (typeof indexedDB === 'undefined' || !indexedDB) {
        throw Object.assign(new Error('IndexedDB unavailable'), { name: 'InvalidStateError' });
      }
      request = indexedDB.open(DB_NAME, DB_VERSION);
    } catch (err) {
      reportError(friendly(err), err);
      reject(err);
      return;
    }

    request.onupgradeneeded = () => {
      const db = request.result;
      for (const name of STORES) {
        if (!db.objectStoreNames.contains(name)) {
          db.createObjectStore(name, { keyPath: 'id' });
        }
      }
    };
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => db.close();
      resolve(db);
    };
    request.onerror = () => {
      const err = request.error || new Error('open failed');
      reportError(friendly(err), err);
      reject(err);
    };
    request.onblocked = () => {
      reportError('Another Shelf Marks tab is holding the database open. Close it and reload.');
    };
  });

  // A failed open should not poison every later attempt.
  dbPromise.catch(() => { dbPromise = null; });
  return dbPromise;
}

function run(storeName, mode, work) {
  return open().then((db) => new Promise((resolve, reject) => {
    let tx;
    try {
      tx = db.transaction(storeName, mode);
    } catch (err) {
      reportError(friendly(err), err);
      reject(err);
      return;
    }
    let result;
    try {
      result = work(tx.objectStore(storeName));
    } catch (err) {
      reportError(friendly(err), err);
      try { tx.abort(); } catch (_) {}
      reject(err);
      return;
    }
    tx.oncomplete = () => resolve(result && result.__req ? result.__req.result : result);
    tx.onerror = tx.onabort = () => {
      const err = tx.error || new Error('transaction failed');
      reportError(friendly(err), err);
      reject(err);
    };
  }));
}

export async function getAll(storeName) {
  try {
    const req = await run(storeName, 'readonly', (s) => ({ __req: s.getAll() }));
    return Array.isArray(req) ? req : [];
  } catch (_) {
    return [];
  }
}

export async function get(storeName, id) {
  try {
    return await run(storeName, 'readonly', (s) => ({ __req: s.get(id) }));
  } catch (_) {
    return undefined;
  }
}

export async function put(storeName, value) {
  await run(storeName, 'readwrite', (s) => { s.put(value); });
  return value;
}

export async function putMany(storeName, values) {
  if (!values.length) return 0;
  await run(storeName, 'readwrite', (s) => { values.forEach((v) => s.put(v)); });
  return values.length;
}

export async function remove(storeName, id) {
  await run(storeName, 'readwrite', (s) => { s.delete(id); });
}

export async function clear(storeName) {
  await run(storeName, 'readwrite', (s) => { s.clear(); });
}

export async function estimate() {
  try {
    if (navigator.storage && navigator.storage.estimate) {
      const { usage, quota } = await navigator.storage.estimate();
      return { usage, quota };
    }
  } catch (_) { /* not supported — not worth surfacing */ }
  return null;
}
