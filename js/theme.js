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
  // Each family records the weights and italics it actually ships, so the
  // styling controls can offer what exists and say plainly what does not.
  // Synthetic bolding and machine-slanted calligraphy are the thing this
  // metadata exists to prevent.

  /* ------- licensed Paper Cake webfonts ------- */
  { group: 'Paper Cake collection', label: 'Paper Cake Script', weights: [300, 400], italic: true,
    value: "'Paper Cake', 'Snell Roundhand', cursive" },
  { group: 'Paper Cake collection', label: 'Paper Cake Wide Script', weights: [300, 400], italic: true,
    value: "'Paper Cake Wide', 'Snell Roundhand', cursive" },
  { group: 'Paper Cake collection', label: 'Paper Cake Caps', weights: [400, 700], italic: false,
    value: "'Paper Cake Caps', 'Bodoni Moda', serif" },
  { group: 'Paper Cake collection', label: 'Paper Cake Caps Upright', weights: [400, 700], italic: false,
    value: "'Paper Cake Caps Upright', 'Bodoni Moda', serif" },

  /* ------- ornamental display script ------- */
  { group: 'Ornamental script', label: 'Monsieur La Doulaise', weights: [400], italic: false,
    value: "'Monsieur La Doulaise', 'Snell Roundhand', 'Apple Chancery', cursive" },
  { group: 'Ornamental script', label: 'Mrs Saint Delafield', weights: [400], italic: false,
    value: "'Mrs Saint Delafield', 'Snell Roundhand', 'Apple Chancery', cursive" },
  { group: 'Ornamental script', label: 'Herr Von Muellerhoff', weights: [400], italic: false,
    value: "'Herr Von Muellerhoff', 'Snell Roundhand', 'Apple Chancery', cursive" },
  { group: 'Ornamental script', label: 'Imperial Script', weights: [400], italic: false,
    value: "'Imperial Script', 'Snell Roundhand', 'Apple Chancery', cursive" },
  { group: 'Ornamental script', label: 'Corinthia', weights: [400, 700], italic: false,
    value: "'Corinthia', 'Snell Roundhand', 'Apple Chancery', cursive" },
  { group: 'Ornamental script', label: 'Italianno', weights: [400], italic: false,
    value: "'Italianno', 'Snell Roundhand', 'Apple Chancery', cursive" },
  { group: 'Ornamental script', label: 'Pinyon Script', weights: [400], italic: false,
    value: "'Pinyon Script', 'Snell Roundhand', 'Apple Chancery', cursive" },
  { group: 'Ornamental script', label: 'Tangerine', weights: [400, 700], italic: false,
    value: "'Tangerine', 'Snell Roundhand', 'Apple Chancery', cursive" },

  /* ------- formal script ------- */
  { group: 'Formal script', label: 'Petit Formal Script', weights: [400], italic: false,
    value: "'Petit Formal Script', 'Snell Roundhand', cursive" },
  { group: 'Formal script', label: 'Parisienne', weights: [400], italic: false,
    value: "'Parisienne', 'Snell Roundhand', cursive" },
  { group: 'Formal script', label: 'Great Vibes', weights: [400], italic: false,
    value: "'Great Vibes', 'Snell Roundhand', cursive" },

  /* ------- high-contrast editorial serif ------- */
  { group: 'Editorial serif', label: 'Playfair Display', weights: [400, 500, 600, 700, 800, 900], italic: true,
    value: "'Playfair Display', 'Didot', Georgia, serif" },
  { group: 'Editorial serif', label: 'Bodoni Moda', weights: [400, 500, 600, 700, 800, 900], italic: true,
    value: "'Bodoni Moda', 'Didot', 'Times New Roman', serif" },
  { group: 'Editorial serif', label: 'Noto Serif Display', weights: [400, 500, 600, 700, 800, 900], italic: true,
    value: "'Noto Serif Display', 'Didot', Georgia, serif" },
  { group: 'Editorial serif', label: 'DM Serif Display', weights: [400], italic: true,
    value: "'DM Serif Display', Didot, Georgia, serif" },
  { group: 'Editorial serif', label: 'Prata', weights: [400], italic: false,
    value: "'Prata', Didot, Georgia, serif" },
  { group: 'Editorial serif', label: 'Gilda Display', weights: [400], italic: false,
    value: "'Gilda Display', Didot, Georgia, serif" },
  { group: 'Editorial serif', label: 'Antic Didone', weights: [400], italic: false,
    value: "'Antic Didone', Didot, Georgia, serif" },
  { group: 'Editorial serif', label: 'Marcellus', weights: [400], italic: false,
    value: "'Marcellus', 'Trajan Pro', Palatino, serif" },
  { group: 'Editorial serif', label: 'Italiana', weights: [400], italic: false,
    value: "'Italiana', Didot, Palatino, serif" },

  /* ------- classical book serif ------- */
  { group: 'Book serif', label: 'Cormorant Garamond', weights: [300, 400, 500, 600, 700], italic: true,
    value: "'Cormorant Garamond', 'Iowan Old Style', Palatino, Georgia, serif" },
  { group: 'Book serif', label: 'EB Garamond', weights: [400, 500, 600, 700, 800], italic: true,
    value: "'EB Garamond', 'Iowan Old Style', Palatino, Georgia, serif" },
  { group: 'Book serif', label: 'Crimson Pro', weights: [300, 400, 500, 600, 700, 800], italic: true,
    value: "'Crimson Pro', 'Iowan Old Style', Palatino, Georgia, serif" },
  { group: 'Book serif', label: 'Lora', weights: [400, 500, 600, 700], italic: true,
    value: "'Lora', 'Iowan Old Style', Palatino, Georgia, serif" },
  { group: 'Book serif', label: 'Libre Baskerville', weights: [400, 700], italic: true,
    value: "'Libre Baskerville', Baskerville, Georgia, serif" },
  { group: 'Book serif', label: 'Spectral', weights: [300, 400, 500, 600, 700, 800], italic: true,
    value: "'Spectral', 'Iowan Old Style', Palatino, Georgia, serif" },
  { group: 'Book serif', label: 'System serif', weights: [400, 700], italic: true,
    value: "'Iowan Old Style', Palatino, Georgia, 'Times New Roman', serif" },

  /* ------- supporting sans ------- */
  { group: 'Supporting sans', label: 'Jost', weights: [300, 400, 500, 600, 700], italic: true,
    value: "'Jost', 'Futura', -apple-system, 'Helvetica Neue', Arial, sans-serif" },
  { group: 'Supporting sans', label: 'Karla', weights: [300, 400, 500, 600, 700, 800], italic: true,
    value: "'Karla', -apple-system, 'Helvetica Neue', Arial, sans-serif" },
  { group: 'Supporting sans', label: 'Work Sans', weights: [300, 400, 500, 600, 700, 800], italic: true,
    value: "'Work Sans', -apple-system, 'Helvetica Neue', Arial, sans-serif" },
  { group: 'Supporting sans', label: 'Josefin Sans', weights: [300, 400, 500, 600, 700], italic: true,
    value: "'Josefin Sans', 'Futura', -apple-system, Arial, sans-serif" },
  { group: 'Supporting sans', label: 'Figtree', weights: [300, 400, 500, 600, 700, 800], italic: true,
    value: "'Figtree', -apple-system, 'Helvetica Neue', Arial, sans-serif" },
  { group: 'Supporting sans', label: 'System sans', weights: [400, 600, 700], italic: true,
    value: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif" },

  /* ------- typewriter ------- */
  { group: 'Typewriter', label: 'Special Elite', weights: [400], italic: false,
    value: "'Special Elite', 'Courier New', monospace" },
  { group: 'Typewriter', label: 'Courier Prime', weights: [400, 700], italic: true,
    value: "'Courier Prime', 'Courier New', monospace" },
];

/** The library entry for a stack, so callers can ask what it supports. */
export function fontFace(stack) {
  const v = String(stack || '').trim();
  return FONT_STACKS.find((f) => f.value === v) || null;
}

/** Weights a stack actually ships; a sensible default when it is unknown. */
export function fontWeights(stack) {
  const f = fontFace(stack);
  return f ? f.weights : [400, 500, 600, 700];
}

/** Whether a stack ships a true italic. Scripts generally do not. */
export function fontHasItalic(stack) {
  const f = fontFace(stack);
  return f ? !!f.italic : true;
}

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
      { var: '--fw-script', label: 'Site name boldness', type: 'select', options: [['400', 'Regular'], ['500', 'Medium'], ['600', 'Semibold'], ['700', 'Bold']] },
      { var: '--fi-script', label: 'Site name italic style', type: 'select', options: [['normal', 'Normal'], ['italic', 'Italic']] },
      { var: '--f-button', label: 'Button font', type: 'font' },
      { var: '--fi-button', label: 'Button italic style', type: 'select', options: [['normal', 'Normal'], ['italic', 'Italic']] },
      { var: '--fi-studio-tab', label: 'Studio tab italic style', type: 'select', options: [['normal', 'Normal'], ['italic', 'Italic']] },
      { var: '--fi-studio-heading', label: 'Studio heading italic style', type: 'select', options: [['normal', 'Normal'], ['italic', 'Italic']] },
      { var: '--fi-studio-panel-title', label: 'Panel heading italic style', type: 'select', options: [['normal', 'Normal'], ['italic', 'Italic']] },
      { var: '--fi-studio-picker', label: 'Dropdown label italic style', type: 'select', options: [['normal', 'Normal'], ['italic', 'Italic']] },
      { var: '--fi-studio-instructions', label: 'Instruction italic style', type: 'select', options: [['normal', 'Normal'], ['italic', 'Italic']] },
      { var: '--fi-studio-summary', label: 'Expandable titles italic style', type: 'select', options: [['normal', 'Normal'], ['italic', 'Italic']] },
      { var: '--fi-studio-field', label: 'Setting name italic style', type: 'select', options: [['normal', 'Normal'], ['italic', 'Italic']] },
      { var: '--fi-studio-advanced', label: 'More options italic style', type: 'select', options: [['normal', 'Normal'], ['italic', 'Italic']] },
      { var: '--f-site-label', label: 'Site label font', type: 'font' },
      { var: '--fi-site-label', label: 'Site label italic style', type: 'select', options: [['normal', 'Normal'], ['italic', 'Italic']] },
      { var: '--f-studio-help', label: 'Save message font', type: 'font' },
      { var: '--fi-studio-help', label: 'Save message italic style', type: 'select', options: [['normal', 'Normal'], ['italic', 'Italic']] },
      { var: '--fi-nav', label: 'Navigation italic style', type: 'select', options: [['normal', 'Normal'], ['italic', 'Italic']] },
      { var: '--f-layout-title', label: 'Layouts title font', type: 'font' },
      { var: '--fs-layout-title', label: 'Layouts title size', type: 'length', min: 1.4, max: 5, step: .05, unit: 'rem' },
      { var: '--fw-layout-title', label: 'Layouts title boldness', type: 'select', options: [['400', 'Regular'], ['500', 'Medium'], ['600', 'Semibold'], ['700', 'Bold']] },
      { var: '--fi-layout-title', label: 'Layouts title italic style', type: 'select', options: [['normal', 'Normal'], ['italic', 'Italic']] },
      { var: '--f-layout-description', label: 'Layouts description font', type: 'font' },
      { var: '--fs-layout-description', label: 'Layouts description size', type: 'length', min: 0.75, max: 2.4, step: .05, unit: 'rem' },
      { var: '--fw-layout-description', label: 'Layouts description boldness', type: 'select', options: [['400', 'Regular'], ['500', 'Medium'], ['600', 'Semibold'], ['700', 'Bold']] },
      { var: '--fi-layout-description', label: 'Layouts description italic style', type: 'select', options: [['normal', 'Normal'], ['italic', 'Italic']] },
      { var: '--f-script', label: 'Wordmark script', type: 'font' },
      { var: '--f-display', label: 'Display serif (headings)', type: 'font' },
      { var: '--f-body', label: 'Body text', type: 'font' },
      { var: '--f-ui', label: 'Labels & navigation', type: 'font' },
      { var: '--fs-wordmark', label: 'Site name font size', type: 'length', min: 1, max: 3.2, step: .05, unit: 'rem', fluid: true, approx: 1.85 },
      { var: '--fs-display', label: 'Headline font size', type: 'length', min: 1.4, max: 5, step: .05, unit: 'rem', fluid: true, approx: 2.9 },
      { var: '--fs-body', label: 'Paragraph font size', type: 'length', min: .85, max: 1.8, step: .01, unit: 'rem' },
      { var: '--fs-label', label: 'Site label font size', type: 'length', min: .55, max: 1.2, step: .01, unit: 'rem' },
      { var: '--fs-nav', label: 'Navigation font size', type: 'length', min: .55, max: 1.5, step: .01, unit: 'rem' },
      { var: '--fw-nav', label: 'Navigation boldness', type: 'select', options: [['400', 'Regular'], ['500', 'Medium'], ['600', 'Semibold'], ['700', 'Bold']] },
      { var: '--fs-button', label: 'Button font size', type: 'length', min: .55, max: 1.4, step: .01, unit: 'rem' },
      { var: '--fw-button', label: 'Button boldness', type: 'select', options: [['400', 'Regular'], ['500', 'Medium'], ['600', 'Semibold'], ['700', 'Bold']] },
      { var: '--fs-studio-summary', label: 'Section title font size', type: 'length', min: .55, max: 1.4, step: .01, unit: 'rem' },
      { var: '--fw-studio-summary', label: 'Studio section title boldness', type: 'select', options: [['400', 'Regular'], ['500', 'Medium'], ['600', 'Semibold'], ['700', 'Bold']] },
      { var: '--fs-studio-help', label: 'Save message font size', type: 'length', min: .7, max: 1.6, step: .01, unit: 'rem' },
      { var: '--fw-studio-help', label: 'Save message boldness', type: 'select', options: [['400', 'Regular'], ['500', 'Medium'], ['600', 'Semibold'], ['700', 'Bold']] },
      { var: '--f-studio-tab', label: 'Tab font', type: 'font' },
      { var: '--fs-studio-tab', label: 'Tab font size', type: 'length', min: .55, max: 1.6, step: .01, unit: 'rem' },
      { var: '--fw-studio-tab', label: 'Tab boldness', type: 'select', options: [['400', 'Regular'], ['500', 'Medium'], ['600', 'Semibold'], ['700', 'Bold']] },
      { var: '--ls-studio-tab', label: 'Tab letter spacing', type: 'length', min: 0, max: .5, step: .01, unit: 'em' },
      { var: '--f-studio-summary', label: 'Accordion title font', type: 'font' },
      { var: '--ls-studio-summary', label: 'Accordion letter spacing', type: 'length', min: 0, max: .5, step: .01, unit: 'em' },
      { var: '--f-studio-heading', label: 'Studio heading font', type: 'font' },
      { var: '--fs-studio-heading', label: 'Studio heading font size', type: 'length', min: 1.1, max: 4, step: .05, unit: 'rem', approx: 2.3 },
      { var: '--fw-studio-heading', label: 'Studio heading boldness', type: 'select', options: [['400', 'Regular'], ['500', 'Medium'], ['600', 'Semibold'], ['700', 'Bold']] },
      { var: '--f-studio-panel-title', label: 'Panel heading font', type: 'font' },
      { var: '--fs-studio-panel-title', label: 'Panel heading font size', type: 'length', min: 1, max: 3.4, step: .05, unit: 'rem', approx: 1.8 },
      { var: '--fw-studio-panel-title', label: 'Panel heading boldness', type: 'select', options: [['400', 'Regular'], ['500', 'Medium'], ['600', 'Semibold'], ['700', 'Bold']] },
      { var: '--f-studio-instructions', label: 'Instruction font', type: 'font' },
      { var: '--fs-studio-instructions', label: 'Instruction font size', type: 'length', min: .7, max: 1.8, step: .01, unit: 'rem' },
      { var: '--fw-studio-instructions', label: 'Instruction boldness', type: 'select', options: [['400', 'Regular'], ['500', 'Medium'], ['600', 'Semibold'], ['700', 'Bold']] },
      { var: '--f-studio-picker', label: 'Dropdown label font', type: 'font' },
      { var: '--fs-studio-picker', label: 'Dropdown label font size', type: 'length', min: .6, max: 1.6, step: .01, unit: 'rem' },
      { var: '--fw-studio-picker', label: 'Dropdown label boldness', type: 'select', options: [['400', 'Regular'], ['500', 'Medium'], ['600', 'Semibold'], ['700', 'Bold']] },
      { var: '--f-studio-field', label: 'Setting-name font', type: 'font' },
      { var: '--fs-studio-field', label: 'Setting-name font size', type: 'length', min: .7, max: 1.8, step: .01, unit: 'rem' },
      { var: '--fw-studio-field', label: 'Setting-name boldness', type: 'select', options: [['400', 'Regular'], ['500', 'Medium'], ['600', 'Semibold'], ['700', 'Bold']] },
      { var: '--f-studio-advanced', label: 'More options font', type: 'font' },
      { var: '--fs-studio-advanced', label: 'More options font size', type: 'length', min: .6, max: 1.6, step: .01, unit: 'rem' },
      { var: '--fw-studio-advanced', label: 'More options boldness', type: 'select', options: [['400', 'Regular'], ['500', 'Medium'], ['600', 'Semibold'], ['700', 'Bold']] },
      { var: '--fw-display', label: 'Display weight', type: 'select', options: [['300', 'Light'], ['400', 'Regular'], ['500', 'Medium'], ['600', 'Semibold'], ['700', 'Bold'], ['800', 'Extrabold'], ['900', 'Black']] },
      { var: '--fi-display', label: 'Display style', type: 'select', options: [['normal', 'Normal'], ['italic', 'Italic']] },
      { var: '--fw-body', label: 'Body weight', type: 'select', options: [['300', 'Light'], ['400', 'Regular'], ['500', 'Medium'], ['600', 'Semibold'], ['700', 'Bold']] },
      { var: '--fi-body', label: 'Body style', type: 'select', options: [['normal', 'Normal'], ['italic', 'Italic']] },
      { var: '--fw-label', label: 'Label weight', type: 'select', options: [['400', 'Regular'], ['500', 'Medium'], ['600', 'Semibold'], ['700', 'Bold']] },
      { var: '--fi-ui', label: 'Label style', type: 'select', options: [['normal', 'Normal'], ['italic', 'Italic']] },
      { var: '--fz-display', label: 'Display size', type: 'number', min: .6, max: 1.8, step: .05 },
      { var: '--fz-body', label: 'Body size', type: 'number', min: .7, max: 1.6, step: .05 },
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
    id: 'frames',
    label: 'Picture frames',
    note: 'The gilding on the museum frame. Four tones make the moulding read as leaf rather than paint.',
    tokens: [
      { var: '--c-gilt-light', label: 'Gilt highlight', type: 'color' },
      { var: '--c-gilt-mid', label: 'Gilt mid-tone', type: 'color' },
      { var: '--c-gilt-deep', label: 'Gilt shadow', type: 'color' },
      { var: '--c-gilt-shadow', label: 'Rebate / outline', type: 'color' },
      { var: '--gilt-width', label: 'Gilt moulding width', type: 'length', min: 4, max: 60, step: 1, unit: 'px', fluid: true, approx: 20 },
      { var: '--c-bronze-light', label: 'Bronze highlight', type: 'color' },
      { var: '--c-bronze-mid', label: 'Bronze mid-tone', type: 'color' },
      { var: '--c-bronze-deep', label: 'Bronze recess', type: 'color' },
      { var: '--c-bronze-dark', label: 'Bronze rebate', type: 'color' },
      { var: '--bronze-width', label: 'Bronze moulding width', type: 'length', min: 8, max: 80, step: 1, unit: 'px', fluid: true, approx: 32 },
      { var: '--ornate-width', label: 'Carved frame width', type: 'length', min: 12, max: 90, step: 1, unit: 'px', fluid: true, approx: 40 },
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
  'literary-whimsy': {
    label: 'Literary Whimsy',
    note: 'More expressive type with warm burgundy, a brighter apricot and richer green.',
    tokens: {
      '--f-script': "'Imperial Script', 'Snell Roundhand', 'Apple Chancery', cursive",
      '--f-display': "'Noto Serif Display', 'Didot', Georgia, serif",
      '--f-body': "'Cormorant Garamond', Georgia, serif",
      '--f-ui': "'Jost', -apple-system, 'Helvetica Neue', Arial, sans-serif",
      '--c-ink': '#51262f', '--c-ink-soft': '#72434a', '--c-ink-faint': '#8b5a62',
      '--c-accent': '#a13c35', '--c-accent-deep': '#812923', '--c-accent-soft': '#f5dfd7',
      '--c-banner-bg': '#47674d', '--c-banner-accent': '#f3ce8c',
      '--c-rose': '#d06d83', '--c-blue': '#6c9fc7', '--c-terracotta': '#df7849',
    },
  },
  'burgundy-gallery': {
    label: 'Burgundy Gallery',
    note: 'The original editorial type with a slightly richer, more saturated gallery palette.',
    tokens: {
      '--c-ink': '#47212b', '--c-ink-soft': '#713f48', '--c-ink-faint': '#895461',
      '--c-banner-bg': '#6d283d', '--c-banner-ink': '#fff2e5', '--c-banner-ink-dim': '#f5dddc',
      '--c-accent': '#a44741', '--c-accent-deep': '#82312e', '--c-accent-soft': '#f5dfdc',
      '--c-sage': '#486c53', '--c-rose': '#d16a78', '--c-blue': '#679ac6',
    },
  },
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
export const DEFAULT_MODE = 'system';

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
  // Older versions wrote their *default* editorial font set as explicit
  // overrides. Those inline values mask any future CSS default, making a
  // typography refresh appear to do nothing for existing readers. Retire only
  // exact legacy defaults; leave every deliberately chosen different face.
  const oldDefaultFonts = {
    '--f-script': ["'Mrs Saint Delafield', 'Imperial Script', 'Snell Roundhand', cursive"],
    '--f-display': ["'Bodoni Moda', 'Didot', Georgia, serif", "'Bodoni Moda', 'Didot', 'Playfair Display', Georgia, serif"],
    '--f-body': ["'EB Garamond', 'Cormorant Garamond', Georgia, serif", "'EB Garamond', 'Cormorant Garamond', 'Iowan Old Style', Palatino, Georgia, serif"],
    '--f-ui': ["'Jost', 'Futura', Arial, sans-serif", "'Jost', 'Futura', -apple-system, 'Helvetica Neue', Arial, sans-serif"],
  };
  for (const [key, previous] of Object.entries(oldDefaultFonts)) {
    if (previous.includes(state.tokens[key])) delete state.tokens[key];
  }
  // The earlier porcelain values were sometimes persisted by the design
  // panel as explicit overrides. Let the new cool-ivory house paper show while
  // retaining any genuinely customised palette values.
  const oldPaper = {
    '--c-bg': '#f8f0e4',
    '--c-bg-sunk': '#efe3d2',
    '--c-bg-raised': '#fdf8f0',
    '--c-bg-field': '#fdf8f0',
  };
  for (const [key, value] of Object.entries(oldPaper)) {
    if (state.tokens[key]?.toLowerCase() === value) delete state.tokens[key];
  }
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

// An explicit checkpoint for the Design Studio's Save button. Editing still
// previews and autosaves, but this awaits the durable IndexedDB write.
export async function saveNow() {
  writeLocal();
  if (persistTimer) { clearTimeout(persistTimer); persistTimer = null; }
  await store.put('meta', {
    id: META_ID,
    tokens: state.tokens,
    content: state.content,
    mode: state.mode,
    updatedAt: new Date().toISOString(),
  });
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
