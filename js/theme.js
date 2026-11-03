// The design system.
//
// CSS owns the DEFAULTS (the :root token layer in css/styles.css). This module
// owns the OVERRIDES: a flat { '--token': 'value' } map plus the editable
// content strings, persisted and applied as inline custom properties on
// <html>. Resetting is simply removing the overrides — the CSS defaults are
// never copied, so the two can't drift apart.

import * as store from './store.js';

const LS_KEY = 'lit-picks-theme';
const META_ID = 'theme';

/* ----------------------------------------------------------- content ----- */

export const CONTENT_DEFAULTS = {
  siteName:        "Diana's Lit Picks",
  navHome:         'Journal',
  navChallenges:   'Reading Challenges',
  navChallengesShort: 'Challenges',
  navBooks:        'My Books',
  navBookmarks:    'Archive',
  navSettings:     'Settings',
  bannerEyebrow:   '{year} / The Reading Journal',
  bannerTitle:     'A Year in Books',
  bannerSubtitle:  'A collection of little reading adventures',
  addBookLabel:    'Add a book',
  homeHeading:     'The Year So Far',
  homeSub:         'Everything finished, counted and kept.',
  periodHeading:   'This Period',
  challengesHeading: 'Reading Challenges',
  challengesSub:   'Little projects to read against, all year long.',
  archiveHeading:  'The Bookmark Archive',
  archiveSub:      'Earned one at a time, kept for good.',
  booksHeading:    'My Books',
};

export const CONTENT_SCHEMA = [
  { key: 'siteName', label: 'Site name (wordmark)' },
  { key: 'bannerEyebrow', label: 'Banner eyebrow', hint: 'Use {year} to insert the challenge year.' },
  { key: 'bannerTitle', label: 'Banner title' },
  { key: 'bannerSubtitle', label: 'Banner subtitle' },
  { key: 'navHome', label: 'Nav — journal' },
  { key: 'navChallenges', label: 'Nav — challenges' },
  { key: 'navChallengesShort', label: 'Nav — challenges (tab bar)' },
  { key: 'navBooks', label: 'Nav — books' },
  { key: 'navBookmarks', label: 'Nav — bookmarks' },
  { key: 'navSettings', label: 'Nav — settings' },
  { key: 'addBookLabel', label: 'Add-book button' },
  { key: 'homeHeading', label: 'Journal heading' },
  { key: 'homeSub', label: 'Journal subtitle' },
  { key: 'periodHeading', label: '“This period” heading' },
  { key: 'challengesHeading', label: 'Challenges heading' },
  { key: 'challengesSub', label: 'Challenges subtitle' },
  { key: 'archiveHeading', label: 'Archive heading' },
  { key: 'archiveSub', label: 'Archive subtitle' },
  { key: 'booksHeading', label: 'Books heading' },
];

/* -------------------------------------------------------- font stacks ---- */

export const FONT_STACKS = [
  { label: 'Cormorant Garamond', value: "'Cormorant Garamond', 'Iowan Old Style', Palatino, Georgia, serif" },
  { label: 'EB Garamond', value: "'EB Garamond', 'Iowan Old Style', Palatino, Georgia, serif" },
  { label: 'Bodoni Moda', value: "'Bodoni Moda', 'Didot', 'Times New Roman', serif" },
  { label: 'Pinyon Script', value: "'Pinyon Script', 'Snell Roundhand', 'Apple Chancery', cursive" },
  { label: 'Jost (sans)', value: "'Jost', -apple-system, 'Helvetica Neue', Arial, sans-serif" },
  { label: 'System serif', value: "'Iowan Old Style', Palatino, Georgia, 'Times New Roman', serif" },
  { label: 'System sans', value: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif" },
];

/* ------------------------------------------------------ token schema ----- */
// type: color | font | length | number | select | ratio
// `fluid: true` marks a token whose default is a responsive clamp(); touching
// its slider swaps in a fixed value, which is why it also gets a text field.

export const THEME_SCHEMA = [
  {
    id: 'palette',
    label: 'Palette',
    note: 'The whole design is drawn from these. Change the ground and the ink and everything follows.',
    tokens: [
      { var: '--c-bg', label: 'Page background', type: 'color' },
      { var: '--c-bg-raised', label: 'Panel background', type: 'color' },
      { var: '--c-bg-sunk', label: 'Recessed background', type: 'color' },
      { var: '--c-ink', label: 'Primary text', type: 'color' },
      { var: '--c-ink-soft', label: 'Secondary text', type: 'color' },
      { var: '--c-ink-faint', label: 'Captions & metadata', type: 'color' },
      { var: '--c-rule', label: 'Hairline rules', type: 'color' },
      { var: '--c-rule-strong', label: 'Strong rules & inputs', type: 'color' },
      { var: '--c-accent', label: 'Accent (progress, selected)', type: 'color' },
      { var: '--c-accent-ink', label: 'Text on accent', type: 'color' },
      { var: '--c-accent-deep', label: 'Accent — pressed', type: 'color' },
      { var: '--c-accent-soft', label: 'Accent tint', type: 'color' },
      { var: '--c-sage', label: 'Success / complete', type: 'color' },
      { var: '--c-rose-ink', label: 'Rose text', type: 'color' },
      { var: '--c-blue-ink', label: 'Blue text', type: 'color' },
      { var: '--c-gold-ink', label: 'Gold text', type: 'color' },
    ],
  },
  {
    id: 'banner',
    label: 'Editorial banner',
    tokens: [
      { var: '--c-banner-bg', label: 'Banner background', type: 'color' },
      { var: '--c-banner-ink', label: 'Banner text', type: 'color' },
      { var: '--c-banner-ink-dim', label: 'Banner secondary text', type: 'color' },
      { var: '--c-banner-accent', label: 'Banner title colour', type: 'color' },
      { var: '--banner-swash-display', label: 'Script initial', type: 'select', options: [['inline-block', 'Show'], ['none', 'Hide']] },
      { var: '--banner-swash-scale', label: 'Script initial size', type: 'number', min: 1, max: 3.2, step: .05 },
      { var: '--h-banner', label: 'Banner height', type: 'length', min: 100, max: 520, step: 5, unit: 'px', fluid: true, approx: 240 },
      { var: '--fs-banner-title', label: 'Banner title size', type: 'length', min: 1.6, max: 8, step: .1, unit: 'rem', fluid: true, approx: 4.4 },
      { var: '--fs-banner-eyebrow', label: 'Eyebrow size', type: 'length', min: .5, max: 1.2, step: .01, unit: 'rem' },
      { var: '--ls-eyebrow', label: 'Eyebrow letterspacing', type: 'length', min: 0, max: .6, step: .01, unit: 'em' },
      { var: '--paper-texture-opacity', label: 'Paper texture', type: 'number', min: 0, max: 1, step: .05 },
    ],
  },
  {
    id: 'typography',
    label: 'Typography',
    tokens: [
      { var: '--f-script', label: 'Wordmark script', type: 'font' },
      { var: '--f-display', label: 'Display serif (headings)', type: 'font' },
      { var: '--f-body', label: 'Body text', type: 'font' },
      { var: '--f-ui', label: 'Labels & navigation', type: 'font' },
      { var: '--fs-wordmark', label: 'Wordmark size', type: 'length', min: 1, max: 3.2, step: .05, unit: 'rem', fluid: true, approx: 1.85 },
      { var: '--fs-display', label: 'Section headline size', type: 'length', min: 1.4, max: 5, step: .05, unit: 'rem', fluid: true, approx: 2.9 },
      { var: '--fs-body', label: 'Body size', type: 'length', min: .85, max: 1.4, step: .01, unit: 'rem' },
      { var: '--fs-label', label: 'Label size', type: 'length', min: .55, max: 1, step: .01, unit: 'rem' },
      { var: '--fs-nav', label: 'Navigation size', type: 'length', min: .55, max: 1.1, step: .01, unit: 'rem' },
      { var: '--fw-display', label: 'Display weight', type: 'select', options: [['300', 'Light'], ['400', 'Regular'], ['500', 'Medium'], ['600', 'Semibold'], ['700', 'Bold']] },
      { var: '--fw-heading', label: 'Heading weight', type: 'select', options: [['400', 'Regular'], ['500', 'Medium'], ['600', 'Semibold'], ['700', 'Bold']] },
      { var: '--ls-nav', label: 'Nav letterspacing', type: 'length', min: 0, max: .4, step: .01, unit: 'em' },
      { var: '--ls-label', label: 'Label letterspacing', type: 'length', min: 0, max: .4, step: .01, unit: 'em' },
      { var: '--lh-body', label: 'Body line height', type: 'number', min: 1.2, max: 2.1, step: .02 },
      { var: '--lh-display', label: 'Display line height', type: 'number', min: .9, max: 1.5, step: .02 },
      { var: '--tt-label', label: 'Label case', type: 'select', options: [['uppercase', 'Small caps'], ['none', 'Sentence case']] },
      { var: '--tt-display', label: 'Headline case', type: 'select', options: [['uppercase', 'All caps'], ['none', 'Mixed case']] },
      { var: '--ls-display', label: 'Headline letterspacing', type: 'length', min: 0, max: .25, step: .005, unit: 'em' },
    ],
  },
  {
    id: 'layout',
    label: 'Layout & spacing',
    tokens: [
      { var: '--w-content', label: 'Content width', type: 'length', min: 720, max: 1600, step: 20, unit: 'px' },
      { var: '--w-prose', label: 'Form / prose width', type: 'length', min: 480, max: 1100, step: 20, unit: 'px' },
      { var: '--sp-page-x', label: 'Page side margin', type: 'length', min: .5, max: 6, step: .05, unit: 'rem', fluid: true, approx: 2 },
      { var: '--sp-section', label: 'Section spacing', type: 'length', min: 1, max: 7, step: .1, unit: 'rem', fluid: true, approx: 3 },
      { var: '--sp-block', label: 'Block spacing', type: 'length', min: .4, max: 3.5, step: .05, unit: 'rem' },
      { var: '--h-masthead', label: 'Header height', type: 'length', min: 48, max: 130, step: 2, unit: 'px', fluid: true, approx: 74 },
      { var: '--h-tabbar', label: 'Mobile tab bar height', type: 'length', min: 48, max: 90, step: 2, unit: 'px' },
      { var: '--r-sm', label: 'Corner radius', type: 'length', min: 0, max: 20, step: 1, unit: 'px' },
      { var: '--rule-w', label: 'Hairline weight', type: 'length', min: 0.5, max: 3, step: .5, unit: 'px' },
      { var: '--bar-h', label: 'Progress bar height', type: 'length', min: 1, max: 20, step: 1, unit: 'px' },
      { var: '--bar-radius', label: 'Progress bar radius', type: 'length', min: 0, max: 999, step: 1, unit: 'px' },
    ],
  },
  {
    id: 'bookmarks',
    label: 'Bookmarks',
    note: 'Width drives how many fit on a row; the grid re-flows on its own.',
    tokens: [
      { var: '--bm-w', label: 'Bookmark width', type: 'length', min: 48, max: 220, step: 2, unit: 'px' },
      { var: '--bm-ratio', label: 'Height ratio (1 : n)', type: 'ratio', min: 1.5, max: 6, step: .1 },
      { var: '--bm-gap-x', label: 'Column gap', type: 'length', min: 0, max: 4, step: .05, unit: 'rem', fluid: true, approx: 1.1 },
      { var: '--bm-gap-y', label: 'Row gap', type: 'length', min: .5, max: 5, step: .05, unit: 'rem' },
      { var: '--bm-row-max', label: 'Max row width', type: 'length', min: 300, max: 1600, step: 20, unit: 'px', fluid: true, approx: 1180 },
      { var: '--bm-radius', label: 'Bookmark corner radius', type: 'length', min: 0, max: 20, step: 1, unit: 'px' },
      { var: '--bm-border-w', label: 'Outline weight', type: 'length', min: .5, max: 4, step: .5, unit: 'px' },
      { var: '--bm-cord-show', label: 'Hanging cord', type: 'select', options: [['block', 'Show'], ['none', 'Hide']] },
      { var: '--bm-empty-dash', label: 'Uncollected outline', type: 'select', options: [['0', 'Solid'], ['5', 'Dashed'], ['2', 'Dotted']] },
      { var: '--bm-check-size', label: 'Completed check size', type: 'length', min: 0, max: 36, step: 1, unit: 'px' },
      { var: '--c-bm-empty-bg', label: 'Uncollected ground', type: 'color' },
      { var: '--c-bm-empty-rule', label: 'Uncollected outline colour', type: 'color' },
      { var: '--c-bm-cord', label: 'Cord colour', type: 'color' },
    ],
  },
  {
    id: 'bookmark-colours',
    label: 'Bookmark colourways',
    note: 'Each collected bookmark picks one of these six, consistently, from its id.',
    tokens: [
      { var: '--c-bm1-bg', label: 'One — ground', type: 'color' },
      { var: '--c-bm1-ink', label: 'One — pattern', type: 'color' },
      { var: '--c-bm2-bg', label: 'Two — ground', type: 'color' },
      { var: '--c-bm2-ink', label: 'Two — pattern', type: 'color' },
      { var: '--c-bm3-bg', label: 'Three — ground', type: 'color' },
      { var: '--c-bm3-ink', label: 'Three — pattern', type: 'color' },
      { var: '--c-bm4-bg', label: 'Four — ground', type: 'color' },
      { var: '--c-bm4-ink', label: 'Four — pattern', type: 'color' },
      { var: '--c-bm5-bg', label: 'Five — ground', type: 'color' },
      { var: '--c-bm5-ink', label: 'Five — pattern', type: 'color' },
      { var: '--c-bm6-bg', label: 'Six — ground', type: 'color' },
      { var: '--c-bm6-ink', label: 'Six — pattern', type: 'color' },
    ],
  },
];

export const ALL_TOKENS = THEME_SCHEMA.flatMap((g) => g.tokens);

/* --------------------------------------------------------- presets ------- */

export const PRESETS = {
  'reading-room': {
    label: 'A Reading Room',
    note: 'The house style — Porcelain, Olive Velvet and Burnt Apricot.',
    tokens: {},
  },
  'velvet-library': {
    label: 'Velvet Library',
    note: 'Mahogany banner, olive accent. The same palette, inverted.',
    tokens: {
      '--c-banner-bg': '#4b2828',
      '--c-banner-ink': '#f8f0e4',
      '--c-banner-ink-dim': '#e0b35a',
      '--c-accent': '#536e50',
      '--c-accent-deep': '#3e5440',
      '--c-accent-soft': '#e2e9dd',
      '--c-bm-cord': '#536e50',
    },
  },
  'powder-and-rose': {
    label: 'Powder & Rose',
    note: 'Cooler: Powder Blue above, Faded Rose beneath.',
    tokens: {
      '--c-banner-bg': '#4e6fa0',
      '--c-banner-ink-dim': '#d8e3f2',
      '--c-accent': '#a8505a',
      '--c-accent-deep': '#8a3b45',
      '--c-accent-soft': '#f3dfe1',
      '--c-bm1-bg': '#7d9fcf', '--c-bm1-ink': '#f8f0e4',
      '--c-bm2-bg': '#c9787e', '--c-bm2-ink': '#f8f0e4',
      '--c-bm-cord': '#a8505a',
    },
  },
  'sage-parchment': {
    label: 'Sage & Parchment',
    note: 'The journal’s first look, before the Reading Room palette.',
    tokens: {
      '--c-bg': '#f6f1e6', '--c-bg-sunk': '#efe8d9', '--c-bg-raised': '#fdfaf3',
      '--c-bg-field': '#fdfaf3',
      '--c-ink': '#342a21', '--c-ink-soft': '#5e5042', '--c-ink-faint': '#8d7f6e',
      '--c-rule': '#ddd3c1', '--c-rule-strong': '#c6b9a3',
      '--c-banner-bg': '#8b9a7b', '--c-banner-ink': '#fbf8f0', '--c-banner-ink-dim': '#e6e9db',
      '--c-accent': '#7b2b2b', '--c-accent-deep': '#5e1f1f', '--c-accent-soft': '#f0e2de',
      '--c-sage': '#7d8f6e', '--c-bm-cord': '#7b2b2b',
      '--c-bm1-bg': '#8b9a7b', '--c-bm1-ink': '#f2efe2',
      '--c-bm2-bg': '#7b2b2b', '--c-bm2-ink': '#d8ae72',
      '--c-bm3-bg': '#c0714a', '--c-bm3-ink': '#f6e7d5',
      '--c-bm4-bg': '#8097ab', '--c-bm4-ink': '#f1f0e6',
      '--c-bm5-bg': '#c08a7e', '--c-bm5-ink': '#f8ece6',
      '--c-bm6-bg': '#a98545', '--c-bm6-ink': '#f7f0dd',
    },
  },
  'ink-and-ivory': {
    label: 'Ink & Ivory',
    note: 'Almost monochrome. Lets the typography carry it.',
    tokens: {
      '--c-bg': '#f7f5f0', '--c-bg-raised': '#fdfcf9', '--c-bg-sunk': '#eeebe3',
      '--c-ink': '#201d19', '--c-ink-soft': '#4e4942', '--c-banner-bg': '#2f2d28',
      '--c-accent': '#6a2f2f', '--c-rule': '#e0ddd4', '--c-rule-strong': '#c3bfb3',
      '--c-bm1-bg': '#2f2d28', '--c-bm2-bg': '#6a2f2f', '--c-bm3-bg': '#8a8578',
      '--c-bm4-bg': '#545c63', '--c-bm5-bg': '#a89a88', '--c-bm6-bg': '#3f4a44',
      '--c-bm6-ink': '#f1f0e6',
    },
  },
  'bodoni-fashion': {
    label: 'Bodoni Editorial',
    note: 'Type only — keeps whatever colours you are on.',
    tokens: {
      '--f-display': "'Bodoni Moda', 'Didot', 'Times New Roman', serif",
      '--f-ui': "'Jost', -apple-system, 'Helvetica Neue', Arial, sans-serif",
      '--fw-display': '400',
      '--ls-nav': '0.24em',
    },
  },
};

/* ------------------------------------------------------ state + apply ---- */

// 'light' is the default on purpose: Porcelain is the house ground, and the
// dark palette is opt-in rather than something the operating system imposes.
export const MODES = [
  ['light', 'Always light'],
  ['dark', 'Always dark'],
  ['system', 'Follow my device'],
];
export const DEFAULT_MODE = 'light';

const state = {
  tokens: {},
  content: { ...CONTENT_DEFAULTS },
  mode: DEFAULT_MODE,
  loaded: false,
};

const listeners = new Set();

export function onThemeChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notify() {
  listeners.forEach((fn) => {
    try { fn(); } catch (_) { /* a broken listener must not break theming */ }
  });
}

export function getTokens() { return { ...state.tokens }; }
export function getContent() { return { ...state.content }; }
export function getMode() { return state.mode; }

/** The palette actually in force once 'system' is resolved. */
export function resolvedMode() {
  if (state.mode === 'dark') return 'dark';
  if (state.mode === 'system') {
    try {
      return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    } catch (_) { return 'light'; }
  }
  return 'light';
}

function applyMode() {
  document.documentElement.dataset.theme = resolvedMode();
}

// Only react to the device while the viewer has actually asked us to.
try {
  const mq = matchMedia('(prefers-color-scheme: dark)');
  const onSystemChange = () => { if (state.mode === 'system') { applyMode(); notify(); } };
  if (mq.addEventListener) mq.addEventListener('change', onSystemChange);
  else if (mq.addListener) mq.addListener(onSystemChange);
} catch (_) { /* no matchMedia — light stands */ }

export async function setMode(mode) {
  state.mode = MODES.some(([v]) => v === mode) ? mode : DEFAULT_MODE;
  applyMode();
  notify();
  await persist();
  return state.mode;
}

/** One content string, with {year} substituted. Views use this for headings. */
export function t(key, year) {
  const raw = state.content[key];
  if (typeof raw !== 'string') return '';
  return raw.replace(/\{year\}/g, year || new Date().getFullYear());
}

export function getToken(name) {
  if (state.tokens[name]) return state.tokens[name];
  // Fall through to the CSS default.
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

export function isOverridden(name) {
  return Object.prototype.hasOwnProperty.call(state.tokens, name);
}

function applyTokensOnly() {
  const root = document.documentElement;
  // Clear everything we might have set, then re-apply — so removing an
  // override really does fall back to the stylesheet.
  ALL_TOKENS.forEach((t) => root.style.removeProperty(t.var));
  Object.entries(state.tokens).forEach(([k, v]) => {
    if (typeof v === 'string' && v.trim()) root.style.setProperty(k, v);
  });
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/**
 * The banner title's first letter is set in the script face, as in the
 * reference where the swash C *is* the C. It stays inline and is not
 * duplicated, so the title still reads and copies as plain text.
 */
function renderBannerTitle(node, text) {
  const first = text.trim().charAt(0);
  const swashOn = getComputedStyle(document.documentElement)
    .getPropertyValue('--banner-swash-display').trim() !== 'none';

  if (!first || !swashOn || !/[a-z]/i.test(first)) {
    node.classList.remove('has-swash');
    node.textContent = text;
    return;
  }
  node.classList.add('has-swash');
  node.innerHTML =
    `<span class="banner-swash">${escapeHtml(first)}</span>`
    + `<span class="banner-title-rest">${escapeHtml(text.trim().slice(1))}</span>`;
}

/** Fill every [data-content] node, substituting {year}. */
export function applyContent(year) {
  const y = year || new Date().getFullYear();
  document.querySelectorAll('[data-content]').forEach((node) => {
    const key = node.dataset.content;
    const value = state.content[key];
    if (typeof value !== 'string') return;
    const text = value.replace(/\{year\}/g, y);
    if (key === 'bannerTitle') renderBannerTitle(node, text);
    else node.textContent = text;
  });
  const name = state.content.siteName || CONTENT_DEFAULTS.siteName;
  document.documentElement.dataset.siteName = name;
}

function applyTokens() {
  applyTokensOnly();
  applyMode();
}

export function apply(year) {
  applyTokens();
  applyContent(year);
}

/* ------------------------------------------------------- persistence ----- */

function readLocal() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (_) { return null; }
}

function writeLocal() {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({
      tokens: state.tokens, content: state.content, mode: state.mode,
      updatedAt: new Date().toISOString(),
    }));
  } catch (_) { /* Private Browsing — IndexedDB is still the real store */ }
}

function adopt(payload) {
  if (!payload || typeof payload !== 'object') return false;
  state.tokens = (payload.tokens && typeof payload.tokens === 'object') ? { ...payload.tokens } : {};
  state.content = { ...CONTENT_DEFAULTS, ...(payload.content || {}) };
  state.mode = MODES.some(([v]) => v === payload.mode) ? payload.mode : DEFAULT_MODE;
  return true;
}

/** Called once at boot, before the first render. */
export async function load(year) {
  // localStorage first: it is synchronous and already replayed by the inline
  // script in index.html, so the page never flashes default styling.
  adopt(readLocal());

  try {
    const row = await store.get('meta', META_ID);
    if (row && row.updatedAt) {
      const local = readLocal();
      // Whichever copy is newer wins, same rule as the book backups.
      if (!local || !local.updatedAt || String(row.updatedAt) > String(local.updatedAt)) {
        adopt(row);
        writeLocal();
      }
    }
  } catch (_) { /* storage banner already covers this */ }

  state.loaded = true;
  apply(year);
  return { tokens: getTokens(), content: getContent() };
}

let persistTimer = null;

// Dragging a slider fires continuously, so the write is coalesced. The
// localStorage mirror is cheap and stays synchronous, which is what the
// pre-paint script in index.html reads.
function persist() {
  writeLocal();
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(async () => {
    persistTimer = null;
    try {
      await store.put('meta', {
        id: META_ID,
        tokens: state.tokens,
        content: state.content,
        mode: state.mode,
        updatedAt: new Date().toISOString(),
      });
    } catch (_) { /* local copy still holds */ }
  }, 300);
  return Promise.resolve();
}

/* ----------------------------------------------------------- editing ----- */

export async function setToken(name, value) {
  if (value === null || value === undefined || value === '') delete state.tokens[name];
  else state.tokens[name] = String(value);
  applyTokens();
  notify();
  await persist();
}

export async function setTokens(map) {
  Object.entries(map || {}).forEach(([k, v]) => {
    if (v === null || v === undefined || v === '') delete state.tokens[k];
    else state.tokens[k] = String(v);
  });
  applyTokens();
  notify();
  await persist();
}

export async function setContent(key, value) {
  state.content[key] = String(value == null ? '' : value);
  notify();
  await persist();
}

export async function applyPreset(id, year) {
  const preset = PRESETS[id];
  if (!preset) return false;
  state.tokens = { ...preset.tokens };
  applyTokens();
  applyContent(year);
  notify();
  await persist();
  return true;
}

export async function reset(year) {
  state.tokens = {};
  state.content = { ...CONTENT_DEFAULTS };
  state.mode = DEFAULT_MODE;
  applyTokens();
  applyContent(year);
  notify();
  await persist();
}

/* ------------------------------------------------- export and import ----- */

export function exportJson() {
  return JSON.stringify({
    app: 'lit-picks-theme',
    version: 1,
    exportedAt: new Date().toISOString(),
    tokens: state.tokens,
    content: state.content,
    mode: state.mode,
  }, null, 2);
}

export function download() {
  const blob = new Blob([exportJson()], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `lit-picks-design-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 8000);
  return a.download;
}

export async function importJson(text, year) {
  let data;
  try {
    data = JSON.parse(text);
  } catch (_) {
    throw new Error('That file is not valid JSON.');
  }
  if (!data || typeof data !== 'object') throw new Error('That file is not a design export.');
  if (data.app && data.app !== 'lit-picks-theme') {
    throw new Error(`That file is from “${data.app}”, not the design studio.`);
  }
  if (!data.tokens && !data.content) throw new Error('No design settings found in that file.');

  const known = new Set(ALL_TOKENS.map((t) => t.var));
  const tokens = {};
  let skipped = 0;
  Object.entries(data.tokens || {}).forEach(([k, v]) => {
    // Only accept custom properties the schema knows about.
    if (known.has(k) && typeof v === 'string') tokens[k] = v;
    else skipped += 1;
  });

  state.tokens = tokens;
  state.content = { ...CONTENT_DEFAULTS, ...(data.content || {}) };
  state.mode = MODES.some(([v]) => v === data.mode) ? data.mode : DEFAULT_MODE;
  applyTokens();
  applyContent(year);
  notify();
  await persist();
  return { applied: Object.keys(tokens).length, skipped };
}

/* -------------------------------------------- backup integration --------- */

export function snapshot() {
  return {
    id: META_ID, tokens: state.tokens, content: state.content,
    mode: state.mode, updatedAt: new Date().toISOString(),
  };
}

/** Adopt a theme row that arrived in a device backup. */
export async function adoptFromBackup(row, year) {
  if (!adopt(row)) return false;
  applyTokens();
  applyContent(year);
  notify();
  writeLocal();
  return true;
}
