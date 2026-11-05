// App state: loads everything out of IndexedDB once, keeps it in memory, and
// writes through on every change. Views read from `state` and re-render on the
// 'change' event.

import * as store from './store.js';
import { PRESET_CHALLENGES, DEFAULT_SETTINGS } from './config.js';
import { earnedBookmarks, bookmarkCatalog } from './rules.js';
import { quarters, inPeriod, yearPeriod } from './periods.js';

export const state = {
  ready: false,
  books: [],
  settings: { ...DEFAULT_SETTINGS },
  challengeRecords: [], // overrides for presets + custom challenges
  unlocks: [],
  images: new Map(),    // bookmarkId -> { id, dataUrl, updatedAt }
  words: [],            // words of the year, with where you met them
  storageError: null,
};

const bus = new EventTarget();

export function onChange(fn) {
  const handler = () => fn();
  bus.addEventListener('change', handler);
  return () => bus.removeEventListener('change', handler);
}

export function emitChange() {
  bus.dispatchEvent(new Event('change'));
}

export function uid(prefix) {
  const rand = (crypto && crypto.randomUUID)
    ? crypto.randomUUID().split('-')[0] + crypto.randomUUID().split('-')[1]
    : Math.random().toString(36).slice(2, 12);
  return `${prefix}_${Date.now().toString(36)}_${rand}`;
}

export function nowISO() {
  return new Date().toISOString();
}

export async function load() {
  store.onStorageError((err) => {
    state.storageError = err;
    emitChange();
  });

  const [books, settingsRow, challengeRecords, unlocks, images, words] = await Promise.all([
    store.getAll('books'),
    store.get('settings', 'settings'),
    store.getAll('challenges'),
    store.getAll('unlocks'),
    store.getAll('images'),
    store.getAll('words'),
  ]);

  state.books = books.filter((b) => b && b.id && !b.deleted);
  state.settings = { ...DEFAULT_SETTINGS, ...(settingsRow || {}), id: 'settings' };
  state.settings.quarterGoals = {
    ...DEFAULT_SETTINGS.quarterGoals,
    ...((settingsRow && settingsRow.quarterGoals) || {}),
  };
  state.challengeRecords = challengeRecords.filter((c) => c && c.id);
  state.unlocks = unlocks.filter((u) => u && u.id);
  state.images = new Map(images.filter((i) => i && i.id).map((i) => [i.id, i]));
  state.words = words.filter((w) => w && w.id && !w.deleted);
  state.ready = true;

  await syncUnlocks();
  emitChange();
}

/* ---------------------------------------------------------------- books ---- */

export function sortedBooks() {
  return [...state.books].sort((a, b) => {
    const d = (b.dateFinished || '').localeCompare(a.dateFinished || '');
    return d !== 0 ? d : (b.createdAt || '').localeCompare(a.createdAt || '');
  });
}

export function getBook(id) {
  return state.books.find((b) => b.id === id) || null;
}

export function newBook(fields = {}) {
  return {
    id: uid('bk'),
    title: '',
    author: '',
    authors: [],
    pages: null,
    coverUrl: null,
    coverId: null,
    olKey: null,
    firstPublishYear: null,
    subjects: [],
    dateFinished: '',
    dateStarted: null,
    format: '',
    isClassic: false,
    isReread: false,
    isTbr: false,
    series: null,
    tags: [],
    notes: '',
    createdAt: nowISO(),
    updatedAt: nowISO(),
    ...fields,
  };
}

export async function saveBook(book) {
  const record = { ...book, updatedAt: nowISO() };
  if (!record.createdAt) record.createdAt = record.updatedAt;
  await store.put('books', record);
  const i = state.books.findIndex((b) => b.id === record.id);
  if (i >= 0) state.books[i] = record; else state.books.push(record);
  const unlocked = await syncUnlocks();
  emitChange();
  return { book: record, unlocked };
}

export async function deleteBook(id) {
  await store.remove('books', id);
  state.books = state.books.filter((b) => b.id !== id);
  emitChange();
}

/* ---------------------------------------------------------------- words ---- */
//
// A word you kept meeting — "pantomime" for 2026 — and the books you met it
// in. Occurrences are counted per book, because the interesting question is
// not only how many books carried the word but which one was steeped in it.

export function allWords() {
  return [...state.words].sort((a, b) => String(b.period || '').localeCompare(String(a.period || ''))
    || String(a.word || '').localeCompare(String(b.word || '')));
}

export function getWord(id) {
  return state.words.find((w) => w.id === id) || null;
}

export function newWord(fields = {}) {
  return {
    id: uid('word'),
    word: '',
    label: 'Word of the Year',
    period: String(state.settings.year),
    note: '',
    image: null,
    entries: [],          // [{ bookId, count }]
    createdAt: nowISO(),
    updatedAt: nowISO(),
    ...fields,
  };
}

export async function saveWord(word) {
  const record = { ...word, updatedAt: nowISO() };
  if (!record.createdAt) record.createdAt = record.updatedAt;
  record.entries = (record.entries || [])
    .filter((e) => e && e.bookId)
    .map((e) => ({ bookId: e.bookId, count: Math.max(0, Number(e.count) || 0) }))
    .filter((e) => e.count > 0);
  await store.put('words', record);
  const i = state.words.findIndex((w) => w.id === record.id);
  if (i >= 0) state.words[i] = record; else state.words.push(record);
  emitChange();
  return record;
}

export async function deleteWord(id) {
  await store.remove('words', id);
  state.words = state.words.filter((w) => w.id !== id);
  emitChange();
}

/**
 * What the word did across the year.
 *
 * Entries point at books by id, and a book can be deleted after the fact, so
 * every reader of this resolves the book and drops what no longer exists
 * rather than rendering a blank row.
 */
export function wordStats(word) {
  const rows = ((word && word.entries) || [])
    .map((e) => ({ ...e, book: getBook(e.bookId) }))
    .filter((r) => r.book)
    .sort((a, b) => b.count - a.count
      || String(a.book.title || '').localeCompare(String(b.book.title || '')));

  const total = rows.reduce((n, r) => n + r.count, 0);
  const top = rows[0] || null;
  const thisYear = rows.filter((r) => inPeriod(r.book.dateFinished, yearPeriod(state.settings.year)));
  return {
    rows,
    books: rows.length,
    total,
    top,
    mostIn: top ? top.book : null,
    mostCount: top ? top.count : 0,
    average: rows.length ? Math.round((total / rows.length) * 10) / 10 : 0,
    booksThisYear: thisYear.length,
    share: state.books.length ? Math.round((rows.length / state.books.length) * 100) : 0,
  };
}

/* ------------------------------------------------------------- settings ---- */

export async function saveSettings(patch) {
  const next = { ...state.settings, ...patch, id: 'settings', updatedAt: nowISO() };
  next.quarterGoals = { ...state.settings.quarterGoals, ...(patch.quarterGoals || {}) };
  await store.put('settings', next);
  state.settings = next;
  emitChange();
  return next;
}

/* ----------------------------------------------------------- challenges ---- */

function mergeChallenge(preset, override) {
  const merged = { ...preset, ...override };
  merged.filter = override.filter ? { ...override.filter } : { ...preset.filter };
  merged.window = override.window ? { ...override.window } : { ...preset.window };
  if (preset.bookmarks && !override.bookmarks) merged.bookmarks = preset.bookmarks;
  merged.preset = true;
  return merged;
}

export function allChallenges() {
  const overrides = new Map(state.challengeRecords.map((r) => [r.id, r]));
  const out = [];
  for (const preset of PRESET_CHALLENGES) {
    const o = overrides.get(preset.id);
    if (o && o.archived) continue;
    out.push(o ? mergeChallenge(preset, o) : { ...preset });
  }
  for (const rec of state.challengeRecords) {
    if (rec.custom && !rec.archived) out.push({ ...rec });
  }
  return out;
}

export function getChallenge(id) {
  return allChallenges().find((c) => c.id === id) || null;
}

// Persist an override for a preset, or a whole custom challenge.
export async function saveChallenge(partial) {
  const existing = state.challengeRecords.find((r) => r.id === partial.id);
  const record = { ...(existing || {}), ...partial, updatedAt: nowISO() };
  await store.put('challenges', record);
  const i = state.challengeRecords.findIndex((r) => r.id === record.id);
  if (i >= 0) state.challengeRecords[i] = record; else state.challengeRecords.push(record);
  const unlocked = await syncUnlocks();
  emitChange();
  return { challenge: getChallenge(record.id), unlocked };
}

export async function archiveChallenge(id) {
  return saveChallenge({ id, archived: true });
}

/* -------------------------------------------------------------- unlocks ---- */

export function unlockMap() {
  return new Map(state.unlocks.map((u) => [u.id, u]));
}

/**
 * Grant an unlock record for every bookmark the current books have earned.
 * Unlocks are append-only history, so deleting a book never silently takes a
 * bookmark away — Settings has a "Re-check unlocks" action for that.
 * Returns the bookmark ids newly unlocked by this call.
 */
export async function syncUnlocks() {
  const challenges = allChallenges();
  const earned = earnedBookmarks(challenges, state.books);
  const have = unlockMap();
  const fresh = [];

  earned.forEach((info, id) => {
    if (have.has(id)) return;
    fresh.push({
      id,
      challengeId: info.challengeId,
      periodKey: info.periodKey || null,
      unlockedAt: nowISO(),
      updatedAt: nowISO(),
    });
  });

  if (fresh.length) {
    await store.putMany('unlocks', fresh);
    state.unlocks.push(...fresh);
  }
  return fresh.map((f) => f.id);
}

// Drop unlock records that the current books no longer justify.
export async function pruneUnlocks() {
  const earned = earnedBookmarks(allChallenges(), state.books);
  const stale = state.unlocks.filter((u) => !earned.has(u.id));
  for (const u of stale) {
    await store.remove('unlocks', u.id);
  }
  state.unlocks = state.unlocks.filter((u) => earned.has(u.id));
  emitChange();
  return stale.length;
}

/* --------------------------------------------------------------- images ---- */

export async function saveBookmarkImage(bookmarkId, dataUrl) {
  const record = { id: bookmarkId, dataUrl, updatedAt: nowISO() };
  await store.put('images', record);
  state.images.set(bookmarkId, record);
  emitChange();
  return record;
}

export async function deleteBookmarkImage(bookmarkId) {
  await store.remove('images', bookmarkId);
  state.images.delete(bookmarkId);
  emitChange();
}

/* --------------------------------------------------------- derived data ---- */

export function booksInPeriod(p) {
  return state.books.filter((b) => inPeriod(b.dateFinished, p));
}

export function annualProgress() {
  const year = state.settings.year;
  const p = yearPeriod(year);
  const read = booksInPeriod(p).length;
  const goal = Math.max(0, Number(state.settings.annualGoal) || 0);
  return {
    period: p,
    read,
    goal,
    pct: goal ? Math.round((read / goal) * 100) : 0,
    remaining: Math.max(0, goal - read),
  };
}

export function quarterProgress(q) {
  const read = booksInPeriod(q).length;
  const goal = Math.max(0, Number(state.settings.quarterGoals[q.key]) || 0);
  return {
    period: q,
    read,
    goal,
    pct: goal ? Math.round((read / goal) * 100) : 0,
    remaining: Math.max(0, goal - read),
  };
}

export function allQuarterProgress() {
  return quarters(state.settings.year).map(quarterProgress);
}

export function nonfictionProgress() {
  const books = booksInPeriod(yearPeriod(state.settings.year));
  const total = books.length;
  const nonfiction = books.filter((b) => b.format === 'nonfiction').length;
  const targetPct = Math.min(100, Math.max(0, Number(state.settings.nonfictionTargetPct) || 0));
  const actualPct = total ? Math.round((nonfiction / total) * 100) : 0;
  const t = targetPct / 100;
  // How many more nonfiction books would bring the share up to target.
  let needed = 0;
  if (t > 0 && t < 1) needed = Math.max(0, Math.ceil((t * total - nonfiction) / (1 - t)));
  else if (t >= 1) needed = Math.max(0, total - nonfiction);
  return {
    total,
    nonfiction,
    fiction: total - nonfiction,
    targetPct,
    actualPct,
    pct: targetPct ? Math.round((actualPct / targetPct) * 100) : 0,
    needed,
    onTrack: actualPct >= targetPct,
  };
}

export function bookmarkStats() {
  const catalog = bookmarkCatalog(allChallenges());
  const have = unlockMap();
  let collected = 0;
  catalog.forEach((_, id) => { if (have.has(id)) collected += 1; });
  return { collected, total: catalog.size, catalog, have };
}

export function knownSeries() {
  const set = new Set();
  state.books.forEach((b) => { if (b.series) set.add(b.series); });
  return [...set].sort((a, b) => a.localeCompare(b));
}

export function knownTags() {
  const set = new Set();
  state.books.forEach((b) => (b.tags || []).forEach((t) => set.add(t)));
  return [...set].sort((a, b) => a.localeCompare(b));
}
