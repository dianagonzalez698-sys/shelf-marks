// Page layouts.
//
// A page is an ordered list of section descriptors, stored per page id. The
// defaults below are only a starting arrangement — every page can be
// rebuilt in the Design Studio without touching code.
//
//   'home'                  the journal's opening
//   'directory'             the challenge index
//   'books'                 the shelf
//   'bookmarks'             the bookmark archive
//   'word' / 'word:<id>'    a word of the year and its tally
//   'challenge'             the shared challenge spread
//   'challenge:<id>'        an override for one particular challenge

import * as store from './store.js';
import { createSection, SECTION_TYPES, migrateSection } from './sections.js';
import { media } from './media.js';

const cache = new Map();
// Default layouts mint fresh section ids each time they are built, so they are
// memoised per page: without this, every get() would hand back a different set
// of ids and the editor's buttons would reference sections that no longer
// exist by the time the handler ran.
const defaults = new Map();
let loaded = false;

function build(type, overrides = {}) {
  const sec = createSection(type);
  return sec ? { ...sec, ...overrides } : null;
}

/* --------------------------------------------------------- defaults ----- */

export function defaultLayout(pageId) {
  const base = String(pageId || '').split(':')[0];

  if (base === 'home') {
    return [
      build('hero', {
        eyebrow: '{year} / The Reading Journal',
        title: 'A Year in Books',
        subtitle: 'A collection of little reading adventures',
        height: 'tall', scrim: 45, align: 'center',
      }),
      build('progress', { title: 'The Year So Far', subtitle: 'Everything finished, counted and kept.' }),
      build('interlude', { mode: 'ornament' }),
      build('period', { title: 'This Period' }),
      build('challenges', {
        kicker: '',
        title: 'Reading Challenges',
        subtitle: 'Little projects to read against, all year long.',
        layout: 'editorial', limit: 3,
      }),
      build('statement', {
        text: 'A life built on instinct, curiosity and the courage to keep reading.',
        size: 'large', style: 'quote', tone: 'olive',
      }),
      build('bookmarks', {
        kicker: 'Collected',
        title: 'The Bookmark Archive',
        subtitle: 'Earned one at a time, kept for good.',
        mode: 'recent', limit: 10,
      }),
      build('books', { kicker: 'Lately', title: 'Recently Finished', limit: 5 }),
    ].filter(Boolean);
  }

  if (base === 'directory') {
    return [
      build('hero', {
        eyebrow: 'The Index',
        title: 'Reading Challenges',
        subtitle: 'Each one its own small publication',
        height: 'short', scrim: 45,
      }),
      build('challenges', { title: '', subtitle: '', layout: 'editorial', limit: 0, spacing: 'tight' }),
      build('note', { text: 'begin anywhere — they all end in a bookmark', rotate: -2 }),
    ].filter(Boolean);
  }

  if (base === 'word') {
    // The word's own page: the word set large, then every book it turned up in.
    return [
      build('word', { showCount: false, align: 'center', spacing: 'loose' }),
      build('wordShelf', { kicker: 'The record', title: 'Where you met it' }),
    ].filter(Boolean);
  }

  if (base === 'books') {
    return [
      build('shelf', { kicker: 'The shelf', title: 'My Books' }),
    ].filter(Boolean);
  }

  if (base === 'bookmarks') {
    return [
      build('archive', { kicker: 'The collection', title: 'Bookmarks' }),
    ].filter(Boolean);
  }

  if (base === 'challenge') {
    // The whole spread, in order. These used to be hard-coded in the view,
    // which is why the editor listed only what you had added on top of them.
    return [
      build('challengeHero', { height: 'short', align: 'left', scrim: 50 }),
      build('interlude', { mode: 'ornament', spacing: 'tight' }),
      build('challengeMarks', { kicker: 'The collection', title: 'Bookmarks' }),
      build('challengeRecord', { kicker: 'The record', title: '', tone: 'sage' }),
      build('challengeEligible', { kicker: 'What counts', title: 'Eligible books' }),
    ].filter(Boolean);
  }

  return [];
}

/* -------------------------------------------------------- persistence --- */

export async function load() {
  const rows = await store.getAll('layouts');
  cache.clear();
  rows.filter((r) => r && r.id).forEach((r) => cache.set(r.id, r));
  loaded = true;
  try { await adoptChallengeBlocks(); } catch (_) { /* a stale layout still renders */ }
  return cache.size;
}

// A challenge spread's opening, bookmarks and record used to be hard-coded in
// the view and so were absent from any saved arrangement. Put them back at the
// front of layouts saved before they became sections — otherwise upgrading
// would silently empty the page of everything except what you had added.
// Marked once, so deleting a block afterwards sticks.
const CHALLENGE_BLOCKS = ['challengeHero', 'challengeMarks', 'challengeRecord', 'challengeEligible'];

async function adoptChallengeBlocks() {
  for (const [id, row] of [...cache]) {
    if (!id.startsWith('challenge')) continue;
    if (row.specV >= 2 || !Array.isArray(row.sections)) continue;
    const present = new Set(row.sections.map((x) => x && x.type));
    const missing = CHALLENGE_BLOCKS
      .filter((type) => !present.has(type))
      .map((type) => build(type, type === 'challengeRecord' ? { tone: 'sage' } : {}))
      .filter(Boolean);
    // The eligible list reads as a footnote to the record, so it goes last;
    // the opening blocks belong at the front.
    const tail = missing.filter((x) => x.type === 'challengeEligible');
    const head = missing.filter((x) => x.type !== 'challengeEligible');
    const record = {
      ...row,
      sections: [...head, ...row.sections, ...tail],
      specV: 2,
      updatedAt: new Date().toISOString(),
    };
    await store.put('layouts', record);
    cache.set(id, record);
  }
}

export function isLoaded() { return loaded; }

function defaultsFor(pageId) {
  if (!defaults.has(pageId)) defaults.set(pageId, defaultLayout(pageId));
  return defaults.get(pageId);
}

/** Sections for a page, falling back to the shared layout then the default. */
export function get(pageId) {
  const row = cache.get(pageId);
  if (row && Array.isArray(row.sections)) return row.sections.map(migrateSection);

  // 'challenge:abc' falls back to the shared 'challenge' layout.
  if (pageId.includes(':')) {
    const shared = cache.get(pageId.split(':')[0]);
    if (shared && Array.isArray(shared.sections)) return shared.sections;
  }
  return defaultsFor(pageId).map(migrateSection);
}

export function isCustomised(pageId) {
  return cache.has(pageId);
}

export async function save(pageId, sections) {
  // specV marks the layout as current, so the one-time block adoption above
  // never runs again — deleting a block you don't want has to stick.
  const record = { id: pageId, sections, specV: 2, updatedAt: new Date().toISOString() };
  await store.put('layouts', record);
  cache.set(pageId, record);
  return record;
}

export async function reset(pageId) {
  await store.remove('layouts', pageId);
  cache.delete(pageId);
}

/* ------------------------------------------------------------ editing --- */

export async function addSection(pageId, type, atIndex = -1) {
  const sections = [...get(pageId)];
  const sec = createSection(type);
  if (!sec) return null;
  if (atIndex < 0 || atIndex >= sections.length) sections.push(sec);
  else sections.splice(atIndex, 0, sec);
  await save(pageId, sections);
  return sec;
}

export async function removeSection(pageId, sectionId) {
  const sections = get(pageId).filter((s) => s.id !== sectionId);
  await save(pageId, sections);
}

export async function moveSection(pageId, sectionId, delta) {
  const sections = [...get(pageId)];
  const i = sections.findIndex((s) => s.id === sectionId);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= sections.length) return false;
  [sections[i], sections[j]] = [sections[j], sections[i]];
  await save(pageId, sections);
  return true;
}

export async function updateSection(pageId, sectionId, patch) {
  const sections = get(pageId).map((s) => (s.id === sectionId ? { ...s, ...patch } : s));
  await save(pageId, sections);
  return sections.find((s) => s.id === sectionId) || null;
}

export function getSection(pageId, sectionId) {
  return get(pageId).find((s) => s.id === sectionId) || null;
}

/** Page ids that currently have a saved arrangement. */
export function customisedPages() {
  return [...cache.keys()];
}

/* -------------------------------------------------- backup integration -- */

export function snapshot() {
  return [...cache.values()].map((r) => ({ ...r }));
}

export function adoptMany(rows) {
  (rows || []).forEach((r) => { if (r && r.id) cache.set(r.id, r); });
}

export { SECTION_TYPES, media };
