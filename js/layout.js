// Page layouts.
//
// A page is an ordered list of section descriptors, stored per page id. The
// defaults below are only a starting arrangement — every page can be
// rebuilt in the Design Studio without touching code.
//
//   'home'                  the journal's opening
//   'directory'             the challenge index
//   'challenge'             the shared challenge spread
//   'challenge:<id>'        an override for one particular challenge

import * as store from './store.js';
import { createSection, SECTION_TYPES } from './sections.js';
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
        kicker: 'In progress',
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

  if (base === 'challenge') {
    // The challenge spread. The detail view injects its own live blocks
    // between these, so this is the editorial frame around them.
    return [
      build('hero', {
        eyebrow: '', title: '', subtitle: '',
        height: 'short', scrim: 40, script: false,
      }),
      build('interlude', { mode: 'ornament', spacing: 'tight' }),
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
  return cache.size;
}

export function isLoaded() { return loaded; }

function defaultsFor(pageId) {
  if (!defaults.has(pageId)) defaults.set(pageId, defaultLayout(pageId));
  return defaults.get(pageId);
}

/** Sections for a page, falling back to the shared layout then the default. */
export function get(pageId) {
  const row = cache.get(pageId);
  if (row && Array.isArray(row.sections)) return row.sections;

  // 'challenge:abc' falls back to the shared 'challenge' layout.
  if (pageId.includes(':')) {
    const shared = cache.get(pageId.split(':')[0]);
    if (shared && Array.isArray(shared.sections)) return shared.sections;
  }
  return defaultsFor(pageId);
}

export function isCustomised(pageId) {
  return cache.has(pageId);
}

export async function save(pageId, sections) {
  const record = { id: pageId, sections, updatedAt: new Date().toISOString() };
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
