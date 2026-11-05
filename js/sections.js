// Editorial section types.
//
// A page is an ordered list of section descriptors. Each type knows how to
// draw itself and what fields it exposes to the layout editor, so new
// compositions are data, not code. Dynamic sections (progress, challenges,
// bookmarks, this period) read live app state — they are real features wearing
// editorial clothes, not decoration.

import { esc, attr, progressBar, progressLine, markVisual, checkBadge, checkGlyph, coverImg } from './ui.js';
import { figure, backdrop, media, hasAsset } from './media.js';
import { src as assetSrc, get as getAsset } from './assets.js';
import {
  state, annualProgress, quarterProgress, nonfictionProgress,
  bookmarkStats, allChallenges, getChallenge, sortedBooks, unlockMap,
} from './state.js';
import { evaluate, describeFilter, describeWindow, bookmarkLabels } from './rules.js';
import { focusQuarter, focusBimonth, daysLeftLabel, formatDate, yearPeriod, inPeriod } from './periods.js';
import { t, FONT_STACKS } from './theme.js';

// Per-section overrides, written as the very tokens the whole design reads.
// Setting one on a <section> re-points everything inside it; leaving it empty
// lets the Design Studio's value cascade down untouched.
const SECTION_VARS = [
  ['fontDisplay', '--f-display'],
  ['fontBody', '--f-body'],
  ['fontUi', '--f-ui'],
  ['fontScript', '--f-script'],
  // Each ink sets a role variable the type rules read first, plus the plain
  // palette token so anything inside the section that isn't a heading, label
  // or body line follows along. The role variable is what makes a colour stick
  // over a photograph or a deep tone, where a different family normally wins.
  ['inkDisplay', '--c-title-ink'], ['inkDisplay', '--c-ink'],
  ['inkBody', '--c-body-ink'], ['inkBody', '--c-ink-soft'],
  ['inkUi', '--c-label-ink'], ['inkUi', '--c-ink-faint'],
  ['inkScript', '--c-script-ink'],
];

// One period's line in a recurring challenge's record.
function periodTick(p, have) {
  const unlocked = !!(p.bookmarkId && have.has(p.bookmarkId));
  const books = p.books.length
    ? `<span style="display:block;margin-top:.3rem">${p.books.map((b) => `
        <a class="row small" href="#/book/${encodeURIComponent(b.id)}" style="color:inherit;text-decoration:none;padding:.1rem 0">
          <span class="grow truncate">${esc(b.title)}</span>
          <span class="muted tiny nowrap">${esc(formatDate(b.dateFinished))}</span>
        </a>`).join('')}</span>`
    : '<span class="tick-note">Nothing logged yet.</span>';

  return `<div class="tick${p.complete ? ' done' : ''}">
    <span class="tick-mark" aria-hidden="true">${checkGlyph()}</span>
    <span class="tick-body">
      <span class="row-between">
        <span class="tick-title">${esc(p.label)}</span>
        <span class="tag tag-plain nowrap">${p.count} of ${p.target == null ? '—' : p.target}</span>
      </span>
      ${books}
      ${p.bookmarkId ? `<span class="tick-note">${unlocked ? 'Bookmark collected' : 'Bookmark still locked'}</span>` : ''}
    </span>
  </div>`;
}

const SHELF_FLAGS = [
  { key: 'classic', label: 'Classic', field: 'isClassic' },
  { key: 'reread', label: 'Re-read', field: 'isReread' },
  { key: 'tbr', label: 'Physical TBR', field: 'isTbr' },
];
export { SHELF_FLAGS };

// One book's row on the shelf.
function bookRow(book) {
  const bits = [];
  if (book.author) bits.push(book.author);
  if (book.pages) bits.push(`${book.pages} pp`);
  if (book.series) bits.push(book.series);

  // One palette colour per flag, so the shelf reads at a glance.
  const tags = [];
  tags.push(book.format === 'nonfiction'
    ? '<span class="tag tag-sage">Nonfiction</span>'
    : '<span class="tag tag-accent">Fiction</span>');
  if (book.isClassic) tags.push('<span class="tag tag-rose">Classic</span>');
  if (book.isReread) tags.push('<span class="tag tag-blue">Re-read</span>');
  if (book.isTbr) tags.push('<span class="tag tag-gold">Physical TBR</span>');
  (book.tags || []).forEach((x) => tags.push(`<span class="tag tag-plain">${esc(x)}</span>`));

  return `<article class="list-row">
    <a class="list-row-link" href="#/book/${encodeURIComponent(book.id)}">
      ${coverImg(book)}
      <span class="grow">
        <span class="entry-title">${esc(book.title)}</span>
        <span class="entry-meta">${esc(bits.join(' · '))}</span>
        <span class="entry-meta">Finished ${esc(formatDate(book.dateFinished))}</span>
        <span class="tags">${tags.join('')}</span>
      </span>
    </a>
    <button class="btn btn-quiet btn-sm" type="button" data-del="${attr(book.id)}"
            aria-label="Delete ${attr(book.title)}">Remove</button>
  </article>`;
}

const uid = (p) => `${p}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

/* ------------------------------------------------------------ helpers ---- */

function sectionShell(sec, inner, extraClass = '') {
  const tone = sec.tone && sec.tone !== 'none' ? ` tone-${sec.tone}` : '';
  const pad = sec.spacing ? ` sp-${sec.spacing}` : '';
  const photo = hasAsset(sec.bgImage);
  const ink = sec.bgInk || 'light';

  // Type has to flip to the light palette over a dark ground, whether that
  // ground is a deep tone or a photograph.
  const onDark = (photo && ink === 'light')
    || sec.tone === 'olive' || sec.tone === 'ink';

  const bg = photo
    ? backdrop(sec.bgImage, { seed: sec.id })
      + `<span class="ed-scrim" style="--scrim:${Number(sec.bgScrim == null ? 45 : sec.bgScrim) / 100}"></span>`
    : '';

  // One edge setting, two outcomes: a preset shape cuts the section, and
  // "artwork" lays your picture across the seam instead.
  const hasGround = photo || (sec.tone && sec.tone !== 'none') || sec.type === 'hero';
  const want = sec.edge && sec.edge !== 'none' ? sec.edge : '';
  const isArt = want === 'artwork';
  const cut = (want && !isArt && hasGround) ? want : '';

  const styles = [];

  // Typefaces and ink are set as the same tokens the whole design uses, scoped
  // to this one <section>. Everything inside it — headings, body, labels, the
  // swash initial — already reads those tokens, so nothing else has to know.
  // Being inline on the section, an explicit colour also outranks the
  // light-on-dark flip below, which is the right way round: you asked for it.
  for (const [key, cssVar] of SECTION_VARS) {
    if (sec[key]) styles.push(`${cssVar}:${sec[key]}`);
  }

  // Running text mostly inherits rather than naming a token, and inheritance
  // carries the parent's *resolved* font and colour — so re-pointing the token
  // alone would leave ordinary paragraphs behind. Set both outright; headings
  // and labels name their own tokens, so they still win where they apply.
  if (sec.fontBody) styles.push(`font-family:${sec.fontBody}`);
  if (sec.inkBody) styles.push(`color:${sec.inkBody}`);

  if (cut && Number(sec.edgeSize) > 0) styles.push(`--edge-h:${Number(sec.edgeSize)}px`);

  let band = '';
  let bandBottom = false;
  let bandTop = false;
  if (isArt) {
    const url = assetSrc((sec.edgeArt || {}).assetId);
    if (url) {
      const where = sec.edgeWhere || 'bottom';
      // A band always hangs clear of the edge it is placed on: its top sits
      // exactly on the section's bottom, or its bottom on the section's top.
      // There is no partial setting — "somewhere near the edge" was the whole
      // problem, and an offset nobody can see the effect of is not a control.
      const size = Number(sec.edgeSize) || 140;
      styles.push(`--trim-h:${size}px`);
      const bs = `--trim-img:url('${attr(url)}')`;
      if (where === 'bottom' || where === 'both') {
        band += `<span class="ed-trim ed-trim-bottom" style="${bs}" aria-hidden="true"></span>`;
        bandBottom = true;
      }
      if (where === 'top' || where === 'both') {
        band += `<span class="ed-trim ed-trim-top" style="${bs}" aria-hidden="true"></span>`;
        bandTop = true;
      }
    }
  }

  const style = styles.length ? ` style="${styles.join(';')}"` : '';

  return `<section class="ed ed-${sec.type}${tone}${pad}`
    + `${photo ? ' has-bg' : ''}${onDark ? ' ed-dark' : ''}`
    + `${cut ? ` has-edge edge-${cut}` : ''}`
    + `${band ? ' has-trim' : ''}${bandBottom ? ' has-trim-bottom' : ''}`
    + `${bandTop ? ' has-trim-top' : ''} ${extraClass}"`
    + ` data-sec="${attr(sec.id)}"${style}>${bg}${band}${inner}</section>`;
}

function kicker(text) {
  return text ? `<p class="ed-kicker">${esc(text)}</p>` : '';
}

/** Headline with an optional script-set first word, as on the banner. */
function headline(text, { script = false, tag = 'h2', cls = 'ed-title' } = {}) {
  if (!text) return '';
  if (!script) return `<${tag} class="${cls}">${esc(text)}</${tag}>`;
  const words = String(text).trim().split(/\s+/);
  const first = words.shift();
  return `<${tag} class="${cls} has-script"><span class="ed-script">${esc(first)}</span>${
    words.length ? ` ${esc(words.join(' '))}` : ''}</${tag}>`;
}

const TONES = [
  ['none', 'Paper (default)'], ['sage', 'Sage'], ['olive', 'Olive velvet'],
  ['rose', 'Faded rose'], ['blue', 'Powder blue'], ['apricot', 'Burnt apricot'],
  ['gold', 'Honey ochre'], ['ink', 'Mahogany'],
];
const SPACING = [['', 'Normal'], ['tight', 'Tight'], ['loose', 'Loose'], ['flush', 'Flush (no gap)']];
const EDGES = [
  ['none', 'None'],
  ['torn', 'Torn paper'],
  ['scallop', 'Scalloped'],
  ['lace', 'Lace'],
  ['wave', 'Soft wave'],
  ['fade', 'Dissolve'],
  ['artwork', 'My own artwork…'],
];
const EDGE_WHERE = [
  ['bottom', 'Along the bottom'],
  ['top', 'Along the top'],
  ['both', 'Both edges'],
];

/**
 * Older sections carried two separate edge features — a mask and an overlay
 * band — with ten controls between them, and nothing stopped both being on at
 * once. They collapse into one `edge` setting here, so saved layouts keep
 * working and the editor only ever shows one.
 */
export function migrateSection(sec) {
  if (!sec) return sec;

  // Already on the new edge model; drop any stored hang, which no longer exists.
  if (sec.edgeArt !== undefined) {
    if (sec.edgeV === 3) return sec;
    const next = { ...sec, edgeV: 3 };
    delete next.edgeHang;
    return next;
  }

  const next = { ...sec, edgeV: 3 };

  if (sec.trim && sec.trim !== 'none' && sec.trimImage && sec.trimImage.assetId) {
    next.edge = 'artwork';
    next.edgeArt = sec.trimImage;
    next.edgeWhere = sec.trim;
    next.edgeSize = Number(sec.trimHeight) || 140;
  } else if (sec.edge === 'custom' && sec.edgeImage && sec.edgeImage.assetId) {
    // A custom cut becomes shown artwork, which is what it was nearly always for.
    next.edge = 'artwork';
    next.edgeArt = sec.edgeImage;
    next.edgeWhere = 'bottom';
    next.edgeSize = Number(sec.edgeHeight) || 140;
  } else {
    next.edge = (sec.edge === 'custom') ? 'none' : (sec.edge || 'none');
    next.edgeArt = media({ assetId: null, ratio: 'auto', frame: 'none', shadow: false });
    next.edgeWhere = 'bottom';
    next.edgeSize = Number(sec.edgeHeight) || 0;
  }
  return next;
}

/* ---------------------------------------------------------------- type --- */
// Per-section typefaces. Empty means "match the site", so a section only
// departs from the Design Studio where you deliberately send it elsewhere —
// and setting one back to "match the site" hands it straight back.
export const FONT_CHOICES = [
  { group: '', label: 'Match the site', value: '' },
  ...FONT_STACKS,
];

const TYPE_FIELDS = [
  { key: 'fontDisplay', label: 'Headings', type: 'font' },
  { key: 'inkDisplay', label: 'Heading colour', type: 'ink' },
  { key: 'fontBody', label: 'Body text', type: 'font' },
  { key: 'inkBody', label: 'Body colour', type: 'ink' },
  { key: 'fontUi', label: 'Small labels', type: 'font' },
  { key: 'inkUi', label: 'Label colour', type: 'ink' },
  { key: 'fontScript', label: 'Script initial', type: 'font' },
  { key: 'inkScript', label: 'Script colour', type: 'ink' },
];

const COMMON_FIELDS = [
  { key: 'tone', label: 'Background colour', type: 'select', options: TONES },
  { key: 'bgImage', label: 'Background photograph', type: 'media', role: 'backdrop', size: '1800 × 1100 px' },
  { key: 'bgScrim', label: 'Darken the photograph', type: 'range', min: 0, max: 90, step: 5, when: (s) => !!(s.bgImage && s.bgImage.assetId) },
  { key: 'bgInk', label: 'Type over the photograph', type: 'select', options: [['light', 'Light'], ['dark', 'Dark']], when: (s) => !!(s.bgImage && s.bgImage.assetId) },

  { key: 'edge', label: 'Edge treatment', type: 'select', options: EDGES, controls: true },
  { key: 'edgeArt', label: 'Artwork', type: 'media', role: 'trim', size: '1800 × 200 px, transparent PNG', when: (s) => s.edge === 'artwork' },
  { key: 'edgeWhere', label: 'Where it goes', type: 'select', options: EDGE_WHERE, when: (s) => s.edge === 'artwork' },
  { key: 'edgeSize', label: 'Size', type: 'range', min: 16, max: 280, step: 4, when: (s) => s.edge && s.edge !== 'none' },

  { key: 'spacing', label: 'Vertical space', type: 'select', options: SPACING },

  ...TYPE_FIELDS,
];

// Defaults every section carries, whatever its type.
export const SECTION_BASE = {
  visible: true,
  tone: 'none',
  spacing: '',
  bgImage: media({ assetId: null, ratio: 'auto', frame: 'none', shadow: false }),
  bgScrim: 45,
  bgInk: 'light',
  edge: 'none',
  edgeImage: media({ assetId: null, ratio: 'auto', frame: 'none', shadow: false }),
  edgeHeight: 0,
  edgeArt: media({ assetId: null, ratio: 'auto', frame: 'none', shadow: false }),
  edgeWhere: 'bottom',
  edgeSize: 0,
  edgeV: 3,
  fontDisplay: '',
  fontBody: '',
  fontUi: '',
  fontScript: '',
  inkDisplay: '',
  inkBody: '',
  inkUi: '',
  inkScript: '',
};

/* -------------------------------------------------------------- types ---- */

export const SECTION_TYPES = {

  /* 1. Full-bleed image hero ---------------------------------------------- */
  hero: {
    label: 'Image hero',
    blurb: 'Full-bleed artwork with oversized type laid over it.',
    create: () => ({
      eyebrow: '{year} / The Reading Journal',
      title: 'A Year in Books',
      subtitle: 'A collection of little reading adventures',
      script: true,
      height: 'tall',
      scrim: 55,
      align: 'center',
      backdrop: media({ ratio: 'auto', frame: 'none', shadow: false }),
      inset: media({ assetId: null, ratio: '3/4', frame: 'polaroid', rotate: -4, width: 100 }),
      showInset: false,
    }),
    fields: [
      { key: 'eyebrow', label: 'Eyebrow', type: 'text' },
      { key: 'title', label: 'Title', type: 'text' },
      { key: 'subtitle', label: 'Subtitle', type: 'text' },
      { key: 'script', label: 'Script first word', type: 'bool' },
      { key: 'height', label: 'Height', type: 'select', options: [['short', 'Short'], ['tall', 'Tall'], ['full', 'Full screen']] },
      { key: 'align', label: 'Type alignment', type: 'select', options: [['center', 'Centred'], ['left', 'Left'], ['right', 'Right']] },
      { key: 'scrim', label: 'Darkening over image', type: 'range', min: 0, max: 90, step: 5 },
      { key: 'backdrop', label: 'Background photograph', type: 'media', role: 'backdrop', size: '1800 × 1100 px' },
      { key: 'edge', label: 'Edge treatment', type: 'select', options: EDGES, controls: true },
      { key: 'edgeArt', label: 'Artwork', type: 'media', role: 'trim', size: '1800 × 200 px, transparent PNG', when: (s) => s.edge === 'artwork' },
      { key: 'edgeWhere', label: 'Where it goes', type: 'select', options: EDGE_WHERE, when: (s) => s.edge === 'artwork' },
      { key: 'edgeSize', label: 'Size', type: 'range', min: 16, max: 280, step: 4, when: (s) => s.edge && s.edge !== 'none' },
      { key: 'showInset', label: 'Show a framed photo on top', type: 'bool' },
      { key: 'inset', label: 'Framed photo', type: 'media', size: '900 × 1125 px' },
      ...TYPE_FIELDS,
    ],
    render(sec) {
      const year = state.settings.year;
      const sub = (v) => String(v || '').replace(/\{year\}/g, year);
      return sectionShell(sec, `
        <div class="hero hero-${sec.height || 'tall'} hero-${sec.align || 'center'}">
          ${backdrop(sec.backdrop, { seed: sec.id })}
          <span class="hero-scrim" style="--scrim:${Number(sec.scrim || 0) / 100}"></span>
          <div class="hero-type">
            ${kicker(sub(sec.eyebrow))}
            ${headline(sub(sec.title), { script: sec.script, tag: 'h1', cls: 'hero-title' })}
            ${sec.subtitle ? `<p class="hero-sub">${esc(sub(sec.subtitle))}</p>` : ''}
          </div>
          ${sec.showInset ? `<div class="hero-inset">${figure(sec.inset, { seed: `${sec.id}i`, eager: true })}</div>` : ''}
        </div>`, 'ed-bleed');
    },
  },

  /* 2. Split image / text -------------------------------------------------- */
  split: {
    label: 'Image & text',
    blurb: 'A picture on one side, an editorial column on the other.',
    create: () => ({
      kicker: 'On the shelf',
      title: 'Reading as a practice',
      body: 'Write anything here — a note on the year, a paragraph about why a '
        + 'particular challenge matters, a passage you keep returning to.',
      flip: false,
      dropcap: true,
      ratio: 'balanced',
      picture: media({ ratio: '4/5', frame: 'plate' }),
    }),
    fields: [
      { key: 'kicker', label: 'Small label', type: 'text' },
      { key: 'title', label: 'Heading', type: 'text' },
      { key: 'body', label: 'Text', type: 'textarea' },
      { key: 'flip', label: 'Picture on the right', type: 'bool' },
      { key: 'dropcap', label: 'Drop capital', type: 'bool' },
      { key: 'ratio', label: 'Proportions', type: 'select', options: [['balanced', 'Even'], ['wide-image', 'Wider picture'], ['wide-text', 'Wider text']] },
      { key: 'picture', label: 'Picture', type: 'media', size: '1200 × 1500 px' },
      ...COMMON_FIELDS,
    ],
    render(sec) {
      return sectionShell(sec, `
        <div class="split split-${sec.ratio || 'balanced'}${sec.flip ? ' split-flip' : ''}">
          <div class="split-media">${figure(sec.picture, { seed: sec.id })}</div>
          <div class="split-body">
            ${kicker(sec.kicker)}
            ${headline(sec.title)}
            ${sec.body ? `<div class="ed-prose${sec.dropcap ? ' has-dropcap' : ''}">${
              esc(sec.body).split(/\n{2,}/).map((p) => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('')
            }</div>` : ''}
          </div>
        </div>`);
    },
  },

  /* 3. Layered collage ----------------------------------------------------- */
  collage: {
    label: 'Layered collage',
    blurb: 'Overlapping pictures, tilted and pinned like a scrapbook page.',
    create: () => ({
      kicker: 'Clippings',
      title: '',
      note: 'a page from the notebook',
      height: 'tall',
      items: [
        media({ ratio: '4/5', frame: 'polaroid', rotate: -6, width: 46, x: -4, y: 4, z: 2 }),
        media({ ratio: '1/1', frame: 'plate', rotate: 4, width: 40, x: 42, y: -8, z: 3, tape: 'top' }),
        media({ ratio: '3/4', frame: 'deckle', rotate: -2, width: 34, x: 18, y: 34, z: 4 }),
      ],
    }),
    fields: [
      { key: 'kicker', label: 'Small label', type: 'text' },
      { key: 'title', label: 'Heading', type: 'text' },
      { key: 'note', label: 'Handwritten note', type: 'text' },
      { key: 'height', label: 'Height', type: 'select', options: [['short', 'Short'], ['tall', 'Tall'], ['taller', 'Taller']] },
      { key: 'items', label: 'Pictures', type: 'medialist', size: '1000 × 1250 px' },
      ...COMMON_FIELDS,
    ],
    render(sec) {
      const items = sec.items && sec.items.length ? sec.items : [];
      return sectionShell(sec, `
        ${sec.kicker || sec.title ? `<div class="ed-head">${kicker(sec.kicker)}${headline(sec.title)}</div>` : ''}
        <div class="collage collage-${sec.height || 'tall'}">
          ${items.map((m, i) => `<div class="collage-item">${figure(m, { seed: `${sec.id}-${i}` })}</div>`).join('')}
          ${sec.note ? `<p class="marginalia">${esc(sec.note)}</p>` : ''}
        </div>`);
    },
  },

  /* 4. Editorial gallery --------------------------------------------------- */
  gallery: {
    label: 'Gallery',
    blurb: 'A measured row or grid of pictures with captions.',
    create: () => ({
      kicker: 'Plates',
      title: '',
      columns: 3,
      stagger: true,
      items: [media({ ratio: '3/4' }), media({ ratio: '3/4' }), media({ ratio: '3/4' })],
    }),
    fields: [
      { key: 'kicker', label: 'Small label', type: 'text' },
      { key: 'title', label: 'Heading', type: 'text' },
      { key: 'columns', label: 'Columns', type: 'range', min: 2, max: 5, step: 1 },
      { key: 'stagger', label: 'Stagger vertically', type: 'bool' },
      { key: 'items', label: 'Pictures', type: 'medialist', size: '800 × 1000 px' },
      ...COMMON_FIELDS,
    ],
    render(sec) {
      const items = sec.items || [];
      return sectionShell(sec, `
        ${sec.kicker || sec.title ? `<div class="ed-head">${kicker(sec.kicker)}${headline(sec.title)}</div>` : ''}
        <div class="gallery${sec.stagger ? ' gallery-stagger' : ''}" style="--cols:${Number(sec.columns) || 3}">
          ${items.map((m, i) => figure(m, { seed: `${sec.id}-${i}` })).join('')}
        </div>`);
    },
  },

  /* 5. Large typographic statement ---------------------------------------- */
  statement: {
    label: 'Typographic statement',
    blurb: 'A pull quote or declaration, set large.',
    create: () => ({
      text: 'A life built on instinct, curiosity and the courage to keep reading.',
      attribution: '',
      size: 'large',
      style: 'quote',
    }),
    fields: [
      { key: 'text', label: 'Text', type: 'textarea' },
      { key: 'attribution', label: 'Attribution', type: 'text' },
      { key: 'size', label: 'Size', type: 'select', options: [['medium', 'Medium'], ['large', 'Large'], ['huge', 'Huge']] },
      { key: 'style', label: 'Treatment', type: 'select', options: [['quote', 'Pull quote'], ['caps', 'Letterspaced caps'], ['script', 'Script']] },
      ...COMMON_FIELDS,
    ],
    render(sec) {
      return sectionShell(sec, `
        <blockquote class="statement st-${sec.size || 'large'} st-${sec.style || 'quote'}">
          <p>${esc(sec.text || '')}</p>
          ${sec.attribution ? `<cite>${esc(sec.attribution)}</cite>` : ''}
        </blockquote>`);
    },
  },

  /* 6. Decorative interlude ------------------------------------------------ */
  interlude: {
    label: 'Decorative interlude',
    blurb: 'A narrow band — a strip of image, or just an ornament.',
    create: () => ({
      mode: 'ornament',
      note: '',
      strip: media({ ratio: '21/9', frame: 'none', shadow: false }),
    }),
    fields: [
      { key: 'mode', label: 'Kind', type: 'select', options: [['ornament', 'Ornament rule'], ['lace', 'Lace band'], ['vine', 'Vine band'], ['strip', 'Image strip'], ['rule', 'Plain rule']] },
      { key: 'note', label: 'Handwritten note', type: 'text' },
      { key: 'strip', label: 'Strip image', type: 'media', size: '1800 × 260 px' },
      ...COMMON_FIELDS,
    ],
    render(sec) {
      const mode = sec.mode || 'ornament';
      const body = mode === 'strip'
        ? `<div class="interlude-strip">${figure(sec.strip, { seed: sec.id })}</div>`
        : mode === 'rule'
          ? '<hr class="interlude-rule">'
          : (mode === 'lace' || mode === 'vine')
            ? `<div class="lacework lacework-${mode}" aria-hidden="true"></div>`
            : `<div class="ornament" aria-hidden="true">
               <span class="ornament-line"></span>
               <svg viewBox="0 0 48 48"><path d="M24 7.5c1.3 9.2 3.1 11 12.3 12.3C27.1 21.1 25.3 22.9 24 32.1c-1.3-9.2-3.1-11-12.3-12.3C20.9 18.5 22.7 16.7 24 7.5z"/></svg>
               <span class="ornament-line"></span>
             </div>`;
      return sectionShell(sec, `${body}${sec.note ? `<p class="marginalia center">${esc(sec.note)}</p>` : ''}`);
    },
  },

  /* 7. Handwritten note ---------------------------------------------------- */
  note: {
    label: 'Handwritten note',
    blurb: 'A short line in the script face, set at an angle.',
    create: () => ({ text: 'reading is the only souvenir I keep', align: 'center', rotate: -2 }),
    fields: [
      { key: 'text', label: 'Text', type: 'text' },
      { key: 'align', label: 'Alignment', type: 'select', options: [['left', 'Left'], ['center', 'Centred'], ['right', 'Right']] },
      { key: 'rotate', label: 'Tilt', type: 'range', min: -8, max: 8, step: 1 },
      ...COMMON_FIELDS,
    ],
    render(sec) {
      return sectionShell(sec, `<p class="marginalia big" style="text-align:${sec.align || 'center'};--m-rot:${Number(sec.rotate) || 0}deg">${esc(sec.text || '')}</p>`);
    },
  },

  /* 8. Reading progress (live) --------------------------------------------- */
  progress: {
    label: 'Reading progress',
    blurb: 'The year, the quarter and the nonfiction share. Live data.',
    create: () => ({ kicker: '', title: 'The Year So Far', subtitle: 'Everything finished, counted and kept.', showPeriod: true }),
    fields: [
      { key: 'kicker', label: 'Small label', type: 'text' },
      { key: 'title', label: 'Heading', type: 'text' },
      { key: 'subtitle', label: 'Subtitle', type: 'text' },
      { key: 'showPeriod', label: 'Show date range', type: 'bool' },
      ...COMMON_FIELDS,
    ],
    render(sec) {
      const year = state.settings.year;
      const annual = annualProgress();
      const q = focusQuarter(year);
      const quarter = quarterProgress(q);
      const nf = nonfictionProgress();
      const row = ({ label, stat, of, pct, left, right, tone, done }) => `
        <div class="measure">
          <div class="measure-head">
            <p class="ed-kicker">${esc(label)}</p>
            <span class="measure-pct${pct > 100 ? ' over' : ''}">${pct}%</span>
          </div>
          <p class="measure-stat"><b>${esc(stat)}</b> <span>${esc(of)}</span></p>
          ${progressBar(pct, { tone, done })}
          <div class="measure-foot"><span>${esc(left)}</span><span>${esc(right)}</span></div>
        </div>`;
      return sectionShell(sec, `
        <div class="ed-head ed-head-split">
          <div>${kicker(sec.kicker)}${headline(sec.title)}
            ${sec.subtitle ? `<p class="ed-sub">${esc(sec.subtitle)}</p>` : ''}</div>
          ${sec.showPeriod ? `<p class="ed-meta">January — December ${year}</p>` : ''}
        </div>
        <div class="measures">
          ${row({ label: `${year} reading challenge`, stat: annual.read, of: `of ${annual.goal} books`,
            pct: annual.pct, left: daysLeftLabel(annual.period),
            right: annual.pct > 100 ? `${annual.read - annual.goal} past goal` : `${annual.remaining} to go`,
            tone: 'apricot', done: annual.pct >= 100 })}
          ${row({ label: q.label, stat: quarter.read, of: `of ${quarter.goal} books`,
            pct: quarter.pct, left: daysLeftLabel(q),
            right: quarter.pct > 100 ? `${quarter.read - quarter.goal} past goal` : `${quarter.remaining} to go`,
            tone: 'blue', done: quarter.pct >= 100 })}
          ${row({ label: 'Nonfiction', stat: `${nf.actualPct}%`, of: `of ${nf.total || 'nothing'} read`,
            pct: nf.pct, left: nf.total ? `${nf.nonfiction} of ${nf.total} books · goal ${nf.targetPct}%` : 'No books logged yet',
            right: nf.total ? (nf.onTrack ? 'on track' : `${nf.needed} more to catch up`) : '',
            tone: 'gold', done: nf.onTrack && nf.total > 0 })}
        </div>`);
    },
  },

  /* 9. This period checklist (live) ---------------------------------------- */
  period: {
    label: 'This period',
    blurb: 'Whether this quarter’s classic, re-read and TBR book are done.',
    create: () => ({ kicker: '', title: 'This Period' }),
    fields: [
      { key: 'kicker', label: 'Small label', type: 'text' },
      { key: 'title', label: 'Heading', type: 'text' },
      ...COMMON_FIELDS,
    ],
    render(sec) {
      const year = state.settings.year;
      const specs = [
        { id: 'classic-every-quarter', period: focusQuarter(year), label: 'A classic' },
        { id: 'reread-every-quarter', period: focusQuarter(year), label: 'A re-read' },
        { id: 'physical-tbr-every-other-month', period: focusBimonth(year), label: 'From the physical pile' },
      ];
      const rows = [];
      for (const spec of specs) {
        const challenge = getChallenge(spec.id);
        if (!challenge) continue;
        const p = evaluate(challenge, state.books).periods.find((x) => x.key === spec.period.key);
        if (!p) continue;
        const note = p.complete
          ? `${p.books[0].title} · finished ${formatDate(p.books[0].dateFinished)}`
          : `${p.label} · nothing logged yet`;
        rows.push(`<a class="tick${p.complete ? ' done' : ''}" href="#/challenge/${encodeURIComponent(challenge.id)}">
          <span class="tick-mark" aria-hidden="true">${checkGlyph()}</span>
          <span class="tick-body">
            <span class="tick-title">${esc(spec.label)} — ${esc(p.label.replace(/^Q\d · /, ''))}</span>
            <span class="tick-note">${esc(note)}</span>
          </span></a>`);
      }
      if (!rows.length) return '';
      return sectionShell(sec, `
        <div class="ed-head">${kicker(sec.kicker)}${headline(sec.title)}</div>
        <div class="ticks">${rows.join('')}</div>`);
    },
  },

  /* 10. Challenge collection preview (live) -------------------------------- */
  challenges: {
    label: 'Challenge collection',
    blurb: 'Your challenges, each as its own small publication.',
    create: () => ({ kicker: '', title: 'Reading Challenges', subtitle: 'Little projects to read against, all year long.', limit: 0, layout: 'editorial' }),
    fields: [
      { key: 'kicker', label: 'Small label', type: 'text' },
      { key: 'title', label: 'Heading', type: 'text' },
      { key: 'subtitle', label: 'Subtitle', type: 'text' },
      { key: 'layout', label: 'Arrangement', type: 'select', options: [['editorial', 'Alternating spreads'], ['list', 'Compact list']] },
      { key: 'limit', label: 'How many (0 = all)', type: 'range', min: 0, max: 12, step: 1 },
      ...COMMON_FIELDS,
    ],
    render(sec) {
      const all = allChallenges();
      const list = Number(sec.limit) > 0 ? all.slice(0, Number(sec.limit)) : all;
      const body = (sec.layout === 'list')
        ? `<div class="ticks">${list.map((c) => {
            const r = evaluate(c, state.books);
            const standing = r.recurring ? `${r.count} of ${r.target} periods`
              : (r.targetUnset ? `${r.count} matching · no target yet` : `${r.count} of ${r.target} books`);
            return `<a class="tick${r.complete ? ' done' : ''}" href="#/challenge/${encodeURIComponent(c.id)}">
              <span class="tick-mark" aria-hidden="true">${checkGlyph()}</span>
              <span class="tick-body"><span class="tick-title">${esc(c.name)}</span>
              <span class="tick-note">${esc(standing)}</span></span></a>`;
          }).join('')}</div>`
        : `<div class="spreads">${list.map((c, i) => challengeSpread(c, i)).join('')}</div>`;
      return sectionShell(sec, `
        <div class="ed-head ed-head-split">
          <div>${kicker(sec.kicker)}${headline(sec.title)}
            ${sec.subtitle ? `<p class="ed-sub">${esc(sec.subtitle)}</p>` : ''}</div>
          <a class="ed-meta" href="#/challenges">All ${all.length} &rarr;</a>
        </div>
        ${body}`);
    },
  },

  /* 11. Bookmark collection (live) ----------------------------------------- */
  bookmarks: {
    label: 'Bookmark collection',
    blurb: 'The bookmarks you have earned, laid out as a collection.',
    create: () => ({ kicker: '', title: 'The Bookmark Archive', subtitle: 'Earned one at a time, kept for good.', mode: 'recent', limit: 10 }),
    fields: [
      { key: 'kicker', label: 'Small label', type: 'text' },
      { key: 'title', label: 'Heading', type: 'text' },
      { key: 'subtitle', label: 'Subtitle', type: 'text' },
      { key: 'mode', label: 'Show', type: 'select', options: [['recent', 'Recently earned'], ['all', 'Everything, by challenge']] },
      { key: 'limit', label: 'How many', type: 'range', min: 4, max: 24, step: 1 },
      ...COMMON_FIELDS,
    ],
    render(sec) {
      const { collected, total, catalog, have } = bookmarkStats();
      if (sec.mode === 'all') {
        const groups = allChallenges().map((c) => {
          const labels = bookmarkLabels(c);
          const ids = [...labels.keys()];
          if (!ids.length) return '';
          const mine = ids.filter((id) => have.has(id)).length;
          return `<div class="bm-group">
            <div class="ed-head-split"><h3 class="ed-subtitle">${esc(c.name)}</h3>
              <span class="ed-meta">${mine} of ${ids.length}</span></div>
            <div class="bm-grid">${ids.map((id) => bookmarkTile(id, labels.get(id), have.has(id))).join('')}</div>
          </div>`;
        }).join('');
        return sectionShell(sec, `
          <div class="ed-head ed-head-split">
            <div>${kicker(sec.kicker)}${headline(sec.title)}
              ${sec.subtitle ? `<p class="ed-sub">${esc(sec.subtitle)}</p>` : ''}</div>
            <p class="ed-meta">${collected} of ${total}</p>
          </div>${groups}`);
      }
      const recent = [...have.values()]
        .sort((a, b) => String(b.unlockedAt || '').localeCompare(String(a.unlockedAt || '')))
        .slice(0, Number(sec.limit) || 10);
      const tiles = recent.length
        ? recent.map((u) => bookmarkTile(u.id, catalog.get(u.id), true)).join('')
        : [...catalog.keys()].slice(0, Number(sec.limit) || 10)
            .map((id) => bookmarkTile(id, catalog.get(id), false)).join('');
      return sectionShell(sec, `
        <div class="ed-head ed-head-split">
          <div>${kicker(sec.kicker)}${headline(sec.title)}
            ${sec.subtitle ? `<p class="ed-sub">${esc(sec.subtitle)}</p>` : ''}</div>
          <a class="ed-meta" href="#/bookmarks">${collected} of ${total} collected &rarr;</a>
        </div>
        <div class="bm-grid">${tiles}</div>`);
    },
  },

  /* 12. Recent books (live) ------------------------------------------------ */
  books: {
    label: 'Recent reading',
    blurb: 'The latest books finished, with their covers.',
    create: () => ({ kicker: 'Lately', title: 'Recently Finished', limit: 5 }),
    fields: [
      { key: 'kicker', label: 'Small label', type: 'text' },
      { key: 'title', label: 'Heading', type: 'text' },
      { key: 'limit', label: 'How many', type: 'range', min: 2, max: 12, step: 1 },
      ...COMMON_FIELDS,
    ],
    render(sec) {
      const year = state.settings.year;
      const books = sortedBooks()
        .filter((b) => inPeriod(b.dateFinished, yearPeriod(year)))
        .slice(0, Number(sec.limit) || 5);
      if (!books.length) return '';
      return sectionShell(sec, `
        <div class="ed-head ed-head-split">
          <div>${kicker(sec.kicker)}${headline(sec.title)}</div>
          <a class="ed-meta" href="#/books">All books &rarr;</a>
        </div>
        <div class="shelf">
          ${books.map((b) => `<a class="shelf-item" href="#/book/${encodeURIComponent(b.id)}">
            ${coverImg(b, { big: true })}
            <span class="shelf-title">${esc(b.title)}</span>
            <span class="shelf-meta">${esc(b.author || '')}</span>
          </a>`).join('')}
        </div>`);
    },
  },


  /* 16. My Books — the shelf itself --------------------------------------- */
  // The filterable shelf that fills the My Books page. Like the challenge
  // blocks, it used to be written straight into the view, so the page had
  // nothing the editor could list.
  shelf: {
    label: 'The shelf',
    blurb: 'Everything finished this year, filterable, newest first.',
    needs: 'books',
    create: () => ({
      kicker: '',
      title: '',
      showFilters: true,
      showCount: true,
    }),
    fields: [
      { key: 'kicker', label: 'Small label', type: 'text' },
      { key: 'title', label: 'Heading', type: 'text' },
      { key: 'showFilters', label: 'Show the filter chips', type: 'bool' },
      { key: 'showCount', label: 'Show the tally', type: 'bool' },
      ...COMMON_FIELDS,
    ],
    render(sec, ctx) {
      const { books, totalThisYear, outside, filtered, year, chips } = ctx;
      const head = (sec.kicker || sec.title)
        ? `<div class="ed-head ed-head-split">
             <div>${kicker(sec.kicker)}${headline(sec.title)}</div>
             ${sec.showCount !== false ? `<p class="ed-meta">${books.length} of ${totalThisYear} shown</p>` : ''}
           </div>`
        : '';
      return sectionShell(sec, `
        ${head}
        ${sec.showFilters !== false ? chips : ''}
        ${sec.showCount !== false ? `<p class="hint" style="margin:.4rem 0 1rem">
          ${filtered ? '<a href="#/books">Clear filters</a>' : `${totalThisYear} book${totalThisYear === 1 ? '' : 's'} logged`}
          ${outside > 0 ? ` · ${outside} logged outside ${year}` : ''}
        </p>` : ''}
        ${books.length
          ? `<div class="list">${books.map(bookRow).join('')}</div>`
          : `<div class="empty">
               <h3>${totalThisYear ? 'Nothing matches those filters' : 'The shelf is empty'}</h3>
               <p>${totalThisYear ? 'Try clearing one.' : `Add the first book you finish in ${year}.`}</p>
               <a class="btn btn-primary" href="${totalThisYear ? '#/books' : '#/add'}">${totalThisYear ? 'Clear filters' : 'Add a book'}</a>
             </div>`}`);
    },
  },

  /* 17. Archive — the bookmarks, by challenge ------------------------------ */
  archive: {
    label: 'The bookmark archive',
    blurb: 'Every bookmark, grouped by the challenge that awards it.',
    needs: 'bookmarks',
    create: () => ({ kicker: '', title: '', showCount: true }),
    fields: [
      { key: 'kicker', label: 'Small label', type: 'text' },
      { key: 'title', label: 'Heading', type: 'text' },
      { key: 'showCount', label: 'Show each tally', type: 'bool' },
      ...COMMON_FIELDS,
    ],
    render(sec, ctx) {
      const { have, challenges, tile } = ctx;
      const head = (sec.kicker || sec.title)
        ? `<div class="ed-head"><div>${kicker(sec.kicker)}${headline(sec.title)}</div></div>`
        : '';
      const groups = challenges.map((c) => {
        const labels = bookmarkLabels(c);
        const ids = [...labels.keys()];
        if (!ids.length) {
          return `<div class="arc-group">
            <div class="ed-head-split"><h3 class="ed-subtitle">${esc(c.name)}</h3></div>
            <p class="hint">No bookmarks yet — <a href="#/challenge/${encodeURIComponent(c.id)}">set this challenge's target</a> first.</p>
          </div>`;
        }
        const mine = ids.filter((id) => have.has(id)).length;
        return `<div class="arc-group">
          <div class="ed-head-split">
            <h3 class="ed-subtitle">${esc(c.name)}</h3>
            ${sec.showCount !== false ? `<span class="ed-meta">${mine} of ${ids.length}</span>` : ''}
          </div>
          <div class="bm-grid">${ids.map((id) => tile(id, labels.get(id), have.has(id))).join('')}</div>
        </div>`;
      }).join('');
      return sectionShell(sec, `${head}${groups}`);
    },
  },

  /* 13. Challenge — the chapter opening ----------------------------------- */
  // The three types below belong to a challenge spread. They were the page's
  // hard-coded blocks: the editor listed only what you had *added*, so most of
  // what you could see was not in the list. As sections they reorder, hide and
  // restyle like everything else.
  challengeHero: {
    label: 'Challenge — opening',
    blurb: "The spread's cover: the challenge's own artwork, name and blurb.",
    needs: 'challenge',
    create: () => ({
      height: 'short',
      align: 'left',
      scrim: 50,
      showWindow: true,
      showBlurb: true,
    }),
    fields: [
      { key: 'height', label: 'Height', type: 'select', options: [['short', 'Short'], ['tall', 'Tall'], ['full', 'Full screen']] },
      { key: 'align', label: 'Type alignment', type: 'select', options: [['left', 'Left'], ['center', 'Centred'], ['right', 'Right']] },
      { key: 'scrim', label: 'Darkening over image', type: 'range', min: 0, max: 90, step: 5 },
      { key: 'showWindow', label: 'Show the time window', type: 'bool' },
      { key: 'showBlurb', label: 'Show the blurb', type: 'bool' },
      { key: 'edge', label: 'Edge treatment', type: 'select', options: EDGES, controls: true },
      { key: 'edgeArt', label: 'Artwork', type: 'media', role: 'trim', size: '1800 × 200 px, transparent PNG', when: (s) => s.edge === 'artwork' },
      { key: 'edgeWhere', label: 'Where it goes', type: 'select', options: EDGE_WHERE, when: (s) => s.edge === 'artwork' },
      { key: 'edgeSize', label: 'Size', type: 'range', min: 16, max: 280, step: 4, when: (s) => s.edge && s.edge !== 'none' },
      ...TYPE_FIELDS,
    ],
    render(sec, ctx) {
      const c = ctx.challenge;
      const cover = c.cover || media({ ratio: 'auto', frame: 'none', shadow: false });
      return sectionShell(sec, `
        <div class="hero hero-${sec.height || 'short'} hero-${sec.align || 'left'}">
          ${backdrop(cover, { seed: c.id })}
          <span class="hero-scrim" style="--scrim:${Number(sec.scrim == null ? 50 : sec.scrim) / 100}"></span>
          <div class="hero-type">
            ${sec.showWindow !== false ? kicker(describeWindow(c.window)) : ''}
            <h1 class="hero-title">${esc(c.name)}</h1>
            ${sec.showBlurb !== false && c.blurb ? `<p class="hero-sub">${esc(c.blurb)}</p>` : ''}
          </div>
        </div>`, 'ed-bleed');
    },
  },

  /* 14. Challenge — the bookmarks it yields -------------------------------- */
  challengeMarks: {
    label: 'Challenge — bookmarks',
    blurb: 'The bookmarks this challenge yields, and how many are collected.',
    needs: 'challenge',
    create: () => ({
      kicker: 'The collection',
      title: 'Bookmarks',
      showFilter: true,
      showBar: true,
      showStanding: true,
    }),
    fields: [
      { key: 'kicker', label: 'Small label', type: 'text' },
      { key: 'title', label: 'Heading', type: 'text' },
      { key: 'showFilter', label: 'Show what counts', type: 'bool' },
      { key: 'showBar', label: 'Show the progress bar', type: 'bool' },
      { key: 'showStanding', label: 'Show the tally underneath', type: 'bool' },
      ...COMMON_FIELDS,
    ],
    render(sec, ctx) {
      const { challenge: c, result: r, have } = ctx;
      const labels = bookmarkLabels(c);
      const ids = r.allBookmarkIds;
      const earned = ids.filter((id) => have.has(id)).length;
      const pct = ids.length ? Math.round((earned / ids.length) * 100) : 0;
      const standing = r.recurring
        ? `${r.count} of ${r.target} periods complete`
        : (r.targetUnset ? `${r.count} books matching` : `${r.count} of ${r.target} books read`);

      if (!ids.length) {
        return sectionShell(sec, `<p class="hint center">${esc(standing)}</p>`);
      }
      return sectionShell(sec, `
        <div class="ed-head ed-head-split">
          <div>
            ${kicker(sec.kicker)}
            ${sec.title ? `<h2 class="ed-title">${esc(sec.title)}</h2>` : ''}
          </div>
          ${sec.showFilter !== false ? `<p class="ed-meta">${esc(describeFilter(c.filter))}</p>` : ''}
        </div>
        ${sec.showBar !== false
          ? progressLine(`${earned} of ${ids.length} collected`, pct, { tone: 'apricot', done: earned === ids.length })
          : ''}
        <div class="bm-grid">
          ${ids.map((id) => {
            const meta = labels.get(id);
            const unlocked = have.has(id);
            const img = state.images.get(id);
            return `<a class="bm${unlocked ? '' : ' locked'}" href="#/bookmarks?focus=${encodeURIComponent(id)}">
              ${markVisual(id, { unlocked, bonus: !!(meta && meta.bonus), dataUrl: img ? img.dataUrl : null })}
              ${unlocked ? checkBadge() : ''}
              <span class="bm-label">${esc(meta ? meta.title : id)}</span>
              ${meta && meta.bonus ? '<span class="bm-sub">bonus</span>' : ''}
            </a>`;
          }).join('')}
        </div>
        ${sec.showStanding !== false ? `<p class="marginalia center">${esc(standing)}</p>` : ''}`);
    },
  },

  /* 15. Challenge — the working record ------------------------------------- */
  challengeRecord: {
    label: 'Challenge — the record',
    blurb: 'Period by period for a recurring challenge, or the books counted.',
    needs: 'challenge',
    create: () => ({
      kicker: 'The record',
      title: '',
      tone: 'sage',
    }),
    fields: [
      { key: 'kicker', label: 'Small label', type: 'text' },
      { key: 'title', label: 'Heading', type: 'text', hint: 'Left empty, it names itself to suit the challenge.' },
      ...COMMON_FIELDS,
    ],
    render(sec, ctx) {
      const { challenge: c, result: r, have } = ctx;
      const auto = r.recurring ? 'Each period' : 'Books counted';
      const head = `<div class="ed-head">${kicker(sec.kicker)}
        <h2 class="ed-title">${esc(sec.title || auto)}</h2></div>`;

      if (r.recurring) {
        return sectionShell(sec, `${head}
          <div class="ticks">
            ${r.periods.map((p) => periodTick(p, have)).join('')}
            ${c.bonusBookmark ? `<div class="tick${r.bonus.complete ? ' done' : ''}">
               <span class="tick-mark" aria-hidden="true">${checkGlyph()}</span>
               <span class="tick-body">
                 <span class="tick-title">Bonus — every period complete</span>
                 <span class="tick-note">${have.has(c.bonusBookmark) ? 'Collected' : 'Locked'}</span>
               </span>
             </div>` : ''}
          </div>`);
      }
      return sectionShell(sec, `${head}
        ${r.books.length
          ? `<div class="shelf">${r.books.map((b) => `
              <a class="shelf-item" href="#/book/${encodeURIComponent(b.id)}">
                ${coverImg(b, { big: true })}
                <span class="shelf-title">${esc(b.title)}</span>
                <span class="shelf-meta">${esc(formatDate(b.dateFinished))}</span>
              </a>`).join('')}</div>`
          : '<p class="muted italic">No books match this challenge yet.</p>'}`);
    },
  },


};

/* -------------------------------------------------- shared sub-renderers -- */

function bookmarkTile(id, meta, unlocked) {
  const img = state.images.get(id);
  return `<a class="bm${unlocked ? '' : ' locked'}" href="#/bookmarks?focus=${encodeURIComponent(id)}">
    ${markVisual(id, { unlocked, bonus: !!(meta && meta.bonus), dataUrl: img ? img.dataUrl : null })}
    <span class="bm-label">${esc(meta ? meta.title : id)}</span>
    <span class="bm-sub">${unlocked ? 'collected' : 'not yet'}</span>
  </a>`;
}

/** One challenge, presented as its own little publication. */
export function challengeSpread(c, index = 0) {
  const r = evaluate(c, state.books);
  const have = unlockMap();
  const labels = bookmarkLabels(c);
  const ids = [...labels.keys()];
  const earned = ids.filter((id) => have.has(id)).length;
  const pct = ids.length ? Math.round((earned / ids.length) * 100) : 0;
  const picture = c.cover || media({ ratio: '4/5', frame: 'plate' });

  return `<a class="spread${index % 2 ? ' spread-flip' : ''}" href="#/challenge/${encodeURIComponent(c.id)}">
    <div class="spread-media">
      ${figure(picture, { seed: c.id })}
      <span class="spread-marks">${ids.slice(0, 5).map((id) => markVisual(id, {
        unlocked: have.has(id),
        bonus: !!(labels.get(id) || {}).bonus,
        dataUrl: (state.images.get(id) || {}).dataUrl || null,
      })).join('')}</span>
    </div>
    <div class="spread-body">
      <p class="ed-kicker">${esc(describeWindow(c.window))}</p>
      <h3 class="spread-title">${esc(c.name)}</h3>
      ${c.blurb ? `<p class="ed-sub">${esc(c.blurb)}</p>` : ''}
      <p class="spread-filter">${esc(describeFilter(c.filter))}</p>
      ${ids.length ? progressLine(`${earned} of ${ids.length} bookmarks`, pct, { tone: 'apricot', done: earned === ids.length })
        : `<p class="hint">${r.targetUnset ? 'No target set yet' : `${r.count} matching`}</p>`}
    </div>
  </a>`;
}

/* ----------------------------------------------------------- rendering --- */

// Some sections belong to one particular thing — a challenge spread's own
// blocks need the challenge they are drawn for. The page passes it in as
// context rather than each section digging it out of the URL, so the same
// section type can be previewed, reordered and restyled like any other.
export function renderSection(raw, ctx = null) {
  const sec = migrateSection(raw);
  if (!sec || sec.visible === false) return '';
  const type = SECTION_TYPES[sec.type];
  if (!type) return '';
  // `needs` names the page a context-bound section belongs to. It gates the
  // add menu; here it only has to know the page handed us its context.
  if (type.needs && !ctx) return '';
  try {
    return type.render(sec, ctx) || '';
  } catch (err) {
    console.error('[lit-picks] section failed to render', sec.type, err);
    return '';
  }
}

export function renderSections(sections, ctx = null) {
  return (sections || []).map((sec) => renderSection(sec, ctx)).join('');
}

export function createSection(type) {
  const def = SECTION_TYPES[type];
  if (!def) return null;
  return { id: uid('sec'), type, ...SECTION_BASE, ...def.create() };
}

/** Section types offered for a page: context-bound blocks only where they fit. */
export function typeList(pageId = '') {
  const base = String(pageId || '').split(':')[0];
  return allTypes().filter((t) => !t.needs || t.needs === base);
}

function allTypes() {
  return Object.entries(SECTION_TYPES)
    .map(([value, def]) => ({ value, label: def.label, blurb: def.blurb, needs: def.needs }));
}
