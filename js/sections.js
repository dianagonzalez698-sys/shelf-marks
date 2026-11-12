// Editorial section types.
//
// A page is an ordered list of section descriptors. Each type knows how to
// draw itself and what fields it exposes to the layout editor, so new
// compositions are data, not code. Dynamic sections (progress, challenges,
// bookmarks, this period) read live app state — they are real features wearing
// editorial clothes, not decoration.

import * as layout from './layout.js';
import { esc, attr, rich, progressBar, progressLine, markVisual, checkBadge, checkGlyph, coverImg } from './ui.js';
import { figure, backdrop, media, hasAsset } from './media.js';
import { src as assetSrc, get as getAsset } from './assets.js';
import {
  state, annualProgress, quarterProgress, nonfictionProgress,
  bookmarkStats, allChallenges, getChallenge, sortedBooks, unlockMap,
  allWords, getWord, wordStats,
} from './state.js';
import { evaluate, describeFilter, describeWindow, bookmarkLabels, eligibility } from './rules.js?v=121';
import { focusQuarter, focusBimonth, daysLeftLabel, formatDate, yearPeriod, inPeriod } from './periods.js';
import { t, FONT_STACKS } from './theme.js';
import * as notebook from './notebook.js';

// Per-section overrides, written as the very tokens the whole design reads.
// Setting one on a <section> re-points everything inside it; leaving it empty
// lets the Design Studio's value cascade down untouched.
export const SECTION_VARS = [
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

  // Weight and italic are separate variables on purpose: changing one must
  // never reset the other, and a bold italic is simply both set at once.
  ['wtDisplay', '--fw-display'], ['wtDisplay', '--fw-heading'],
  ['wtBody', '--fw-body'],
  ['wtUi', '--fw-label'],
  ['wtScript', '--fw-script'],
  ['itDisplay', '--fi-display'],
  ['itBody', '--fi-body'],
  ['itUi', '--fi-ui'],
  ['itScript', '--fi-script'],
  ['szDisplay', '--fz-display'],
  ['szBody', '--fz-body'],
  ['szUi', '--fz-ui'],
  ['szScript', '--fz-script'],
  ['lsDisplay', '--ls-display'],
  ['lsBody', '--ls-body'],
  ['lsUi', '--ls-label'], ['lsUi', '--ls-eyebrow'],
  ['ttDisplay', '--tt-display'],
  ['ttUi', '--tt-label'],
];

/**
 * Put a section's own style overrides onto its element.
 *
 * Editing on the page changes the stored section, but the page is not
 * re-rendered for every keystroke — that would take the cursor with it. The
 * same variables sectionShell would have written are set directly instead, so
 * what you see updates as you choose.
 */
export function applySectionVars(el, sec) {
  if (!el || !sec) return;
  for (const [key, cssVar] of SECTION_VARS) {
    const v = sec[key];
    if (v) el.style.setProperty(cssVar, v);
    else el.style.removeProperty(cssVar);
  }
  if (sec.fontBody) el.style.fontFamily = sec.fontBody;
  else el.style.removeProperty('font-family');
  if (sec.inkBody) el.style.color = sec.inkBody;
  else el.style.removeProperty('color');
}

/** Which type role a given text field is drawn in. */
const ROLE_FOR_KEY = {
  eyebrow: 'Ui', kicker: 'Ui',
  title: 'Display',
  subtitle: 'Body', body: 'Body', text: 'Body',
  note: 'Body', caption: 'Body', quote: 'Body',
};

export function roleForKey(key, sectionType = '') {
  const name = key === 'text' && sectionType === 'statement' ? 'Display'
    : key === 'text' && sectionType === 'note' ? 'Script'
    : ROLE_FOR_KEY[key];
  return name ? TYPE_ROLES.find((r) => r.role === name) || null : null;
}

/** The four type roles a section can restyle, and the keys each one owns. */
export const TYPE_ROLES = [
  { role: 'Display', label: 'Headings', font: 'fontDisplay', ink: 'inkDisplay',
    weight: 'wtDisplay', italic: 'itDisplay', size: 'szDisplay',
    track: 'lsDisplay', transform: 'ttDisplay' },
  { role: 'Body', label: 'Body text', font: 'fontBody', ink: 'inkBody',
    weight: 'wtBody', italic: 'itBody', size: 'szBody', track: 'lsBody' },
  { role: 'Ui', label: 'Small labels', font: 'fontUi', ink: 'inkUi',
    weight: 'wtUi', italic: 'itUi', size: 'szUi', track: 'lsUi',
    transform: 'ttUi' },
  { role: 'Script', label: 'Script initial', font: 'fontScript', ink: 'inkScript',
    weight: 'wtScript', italic: 'itScript', size: 'szScript' },
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
  const isCurtain = want === 'curtain';
  const curtainAtBottom = isCurtain && sec.curtainWhere === 'bottom';
  const cut = (want && !isArt && !isCurtain && hasGround) ? want : '';

  const styles = [];
  const customBackground = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(sec.toneHex || '') ? sec.toneHex : '';
  if (customBackground && sec.type !== 'archFeature') {
    styles.push(`background-color:${customBackground}`, `background:${customBackground}`);
    const full = customBackground.length === 4
      ? customBackground.slice(1).split('').map((c) => c + c).join('') : customBackground.slice(1);
    const rgb = [0, 2, 4].map((n) => parseInt(full.slice(n, n + 2), 16) / 255);
    const luminance = rgb.map((v) => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
    const ink = (.2126*luminance[0]+.7152*luminance[1]+.0722*luminance[2]) < .22 ? '#fff8ed' : '#342c2b';
    styles.push(`color:${ink}`, `--c-title-ink:${ink}`, `--c-body-ink:${ink}`, `--c-label-ink:${ink}`);
  }

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

  // The curtain is drawn as one whole picture, not as a nine-slice frame. A
  // nine-slice's opening is a rectangle by construction — straight inner
  // edges, square corners — so an arched curtain came out as a box with the
  // arch only visible along the top. Drawn whole, the silhouette is exactly
  // as painted: scalloped valance, tapering drapes, the arch between them.
  //
  // It hangs from the top of the section and the page shows through wherever
  // the picture is transparent. The proportions measured from the file say how
  // far in the drapes reach and how low the arch dips — which is all the
  // content needs in order to clear it.
  let curtain = '';
  if (isCurtain) {
    const art = sec.curtainArt || {};
    const url = assetSrc(art.assetId);
    const asset = art.assetId ? getAsset(art.assetId) : null;
    const sl = (asset && asset.frameSlice) || null;
    if (url && sl) {
      const drop = Math.max(6, Math.min(70, Number(sec.curtainDrop) || 30));
      const iw = Math.max(1, Number(sl.w) || 1);
      const ih = Math.max(1, Number(sl.h) || 1);
      const sideFrac = Math.max(0, Math.min(0.45, (Number(sl.left) || 0) / iw));
      // Where the cloth visually stops over the text column — not the lowest
      // stray tassel, which would reserve a field of empty page beneath it.
      const archPx = Number(sl.archText) || Number(sl.archMax) || Number(sl.top) || 0;
      const archFrac = Math.max(0, Math.min(1, archPx / ih));
      styles.push(
        `--cur-img:url('${attr(url)}')`,
        `--cur-h:${drop}vw`,
        `--cur-lift-user:${Math.max(0, Math.min(140, Number(sec.curtainLift ?? 72)))}px`,
        `--cur-offset:${Math.max(-200, Math.min(400, Number(sec.curtainOffset ?? 0)))}px`,
        `--cur-side:${(sideFrac * 100).toFixed(2)}%`,
        // Your own adjustment to the reserved space. The measurement below
        // reads the hem from the picture, but how close text should sit to
        // painted cloth is a judgement the picture cannot make.
        `--cur-gap:${Math.max(-240, Math.min(160, Number(sec.curtainGap) || 0))}px`,
        `--cur-arch:calc(${drop}vw * ${archFrac.toFixed(4)})`,
      );
      curtain = '<span class="ed-curtain" aria-hidden="true"></span>';
    } else if (url) {
      // Cloud bands and other transparent wide artwork are valid decorations
      // even without a detected curtain opening. Draw the original image
      // intact rather than silently omitting it from preview and publication.
      const iw = Math.max(1, Number(asset?.w) || 2400);
      const ih = Math.max(1, Number(asset?.h) || 700);
      styles.push(
        `--cur-img:url('${attr(url)}')`,
        `--cur-h:clamp(80px, ${Math.min(65, ih / iw * 100).toFixed(3)}vw, 900px)`,
        '--cur-side:0%',
        '--cur-arch:0px',
        '--cur-over:1',
        `--cur-offset:${Math.max(-200, Math.min(400, Number(sec.curtainOffset ?? 0)))}px`,
      );
      curtain = '<span class="ed-curtain ed-curtain-decor" aria-hidden="true"></span>';
    }
  }

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
      // How far the band sits below the seam. Positive carries it down over
      // the section beneath, which is what makes cloth or cloud read as
      // lying on that section rather than stopping short of it; the section
      // below is pulled up by the same amount so no gap opens above.
      const shift = Math.max(-200, Math.min(300, Number(sec.edgeShift) || 0));
      styles.push(`--trim-h:${size}px`, `--trim-shift:${shift}px`);
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
    + `${cut ? ` has-edge edge-${cut}` : ''}${curtain ? ` has-curtain${curtainAtBottom ? ' curtain-bottom' : ' curtain-top'}` : ''}`
    + `${band ? ' has-trim' : ''}${bandBottom ? ' has-trim-bottom' : ''}`
    + `${bandTop ? ' has-trim-top' : ''}${sec.shape === 'arch' ? ' shape-arch' : ''} ${extraClass}"`
    + ` data-sec="${attr(sec.id)}"${style}>${bg}${curtain}${band}${inner}</section>`;
}

function kicker(text, key = 'kicker') {
  return text ? `<p class="ed-kicker" data-edit="${attr(key)}">${rich(text)}</p>` : '';
}

/** Headline with an optional script-set first word, as on the banner. */
function headline(text, { script = false, tag = 'h2', cls = 'ed-title', key = 'title' } = {}) {
  if (!text) return '';
  const ed = ` data-edit="${attr(key)}"`;
  if (!script) return `<${tag} class="${cls}"${ed}>${rich(text)}</${tag}>`;
  // The swash initial takes the first word. Emphasis inside the heading has to
  // survive that split, so the rest is cleaned as rich text and only the first
  // word — which the script face draws — is taken as plain.
  const plain = String(text).replace(/<[^>]*>/g, ' ').trim();
  const first = plain.split(/\s+/)[0] || '';
  const restRaw = String(text).trim();
  const cut = restRaw.replace(/^(\s*<[^>]*>\s*)*/, '');
  const rest = cut.slice(first.length);
  return `<${tag} class="${cls} has-script"${ed}><span class="ed-script">${esc(first)}</span>${
    rest.trim() ? ` ${rich(rest)}` : ''}</${tag}>`;
}

const TONES = [
  ['none', 'Paper (default)'], ['sage', 'Sage'], ['olive', 'Olive velvet'],
  ['rose', 'Faded rose'], ['blue', 'Powder blue'], ['apricot', 'Burnt apricot'],
  ['gold', 'Honey ochre'], ['ink', 'Mahogany'],
];
export const TONE_SWATCHES = [
  ['none', 'Paper (default)', '#f8f5ed'],
  ['sage', 'Sage', '#e7ece3'],
  ['olive', 'Olive velvet', '#536e50'],
  ['rose', 'Faded rose', '#f5e4e2'],
  ['blue', 'Powder blue', '#e3eaf4'],
  ['apricot', 'Burnt apricot', '#f7e6d8'],
  ['gold', 'Honey ochre', '#f8edd5'],
  ['ink', 'Mahogany', '#4b2828'],
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
  ['curtain', 'Curtain / full frame…'],
];
const EDGE_WHERE = [
  ['bottom', 'Along the bottom'],
  ['top', 'Along the top'],
  ['both', 'Both edges'],
];
const CURTAIN_WHERE = [['top', 'Top of this section'], ['bottom', 'Bottom of this section (flipped)']];

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

// One row per role — the face and its colour together, since nobody thinks
// about them separately. Eight stacked controls read as a wall; four rows of
// two read as a list of four decisions.
const TYPE_FIELDS = TYPE_ROLES.map((r) => ({
  key: r.font, inkKey: r.ink, label: r.label, type: 'typeface', role: r,
}));

const COMMON_FIELDS = [
  { key: 'shape', label: 'Section shape', type: 'select', options: [['', 'Original shape'], ['arch', 'Tall arch']], controls: true },
  { key: 'tone', label: 'Background colour', type: 'tonePicker', options: TONES },
  { key: 'bgImage', label: 'Background photograph', type: 'media', role: 'backdrop', size: '1800 × 1100 px' },
  { key: 'bgScrim', label: 'Darken the photograph', type: 'range', min: 0, max: 90, step: 5, when: (s) => !!(s.bgImage && s.bgImage.assetId) },
  { key: 'bgInk', label: 'Type over the photograph', type: 'select', options: [['light', 'Light'], ['dark', 'Dark']], when: (s) => !!(s.bgImage && s.bgImage.assetId) },

  { key: 'edge', label: 'Decoration type', type: 'select', options: EDGES, controls: true },
  { key: 'edgeArt', label: 'Artwork', type: 'media', role: 'trim', size: '1800 × 200 px, transparent PNG', when: (s) => s.edge === 'artwork' },
  { key: 'edgeWhere', label: 'Artwork placement — top or bottom', type: 'select', options: EDGE_WHERE, when: (s) => s.edge === 'artwork' },
  { key: 'edgeSize', label: 'Size', type: 'range', min: 16, max: 280, step: 4, when: (s) => s.edge && s.edge !== 'none' && s.edge !== 'curtain' },
  { key: 'edgeShift', label: 'How far it sits below the seam', type: 'range', min: -120, max: 220, step: 4, when: (s) => s.edge === 'artwork' },
  { key: 'curtainArt', label: 'Curtain picture', type: 'media', role: 'curtain', size: '2400 × 1000 px, transparent PNG', when: (s) => s.edge === 'curtain' },
  { key: 'curtainWhere', label: 'Curtain placement', type: 'select', options: CURTAIN_WHERE, when: (s) => s.edge === 'curtain' },
  { key: 'curtainDrop', label: 'How far the curtain hangs', type: 'range', min: 8, max: 60, step: 1, when: (s) => s.edge === 'curtain' },
  { key: 'curtainLift', label: 'Overlap above (px)', type: 'range', min: 0, max: 140, step: 2, when: (s) => s.edge === 'curtain' },
  { key: 'curtainOffset', label: 'Move curtain up / down (px)', type: 'range', min: -200, max: 400, step: 2, when: (s) => s.edge === 'curtain' },
  { key: 'curtainGap', label: 'Space between curtain and text', type: 'range', min: -180, max: 120, step: 4, when: (s) => s.edge === 'curtain' },

  { key: 'spacing', label: 'Vertical space', type: 'select', options: SPACING },

  ...TYPE_FIELDS,
];

// Defaults every section carries, whatever its type.
export const SECTION_BASE = {
  visible: true,
  shape: '',
  toneHex: '',
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
  edgeShift: 0,
  curtainArt: media({ assetId: null, ratio: 'auto', frame: 'none', shadow: false }),
  curtainWhere: 'top',
  curtainDrop: 30,
  curtainLift: 72,
  curtainOffset: 0,
  curtainGap: 0,
  edgeV: 3,
  fontDisplay: '',
  fontBody: '',
  fontUi: '',
  fontScript: '',
  inkDisplay: '',
  inkBody: '',
  inkUi: '',
  inkScript: '',
  wtDisplay: '', wtBody: '', wtUi: '', wtScript: '',
  itDisplay: '', itBody: '', itUi: '', itScript: '',
  szDisplay: '', szBody: '', szUi: '', szScript: '',
  lsDisplay: '', lsBody: '', lsUi: '',
  ttDisplay: '', ttUi: '',
};

/* -------------------------------------------------------------- types ---- */

export const SECTION_TYPES = {

  archFeature: {
    label: 'Arched editorial feature',
    blurb: 'A complete arched panel with editable text, color, and optional full-bleed artwork.',
    create: () => ({
      kicker: 'An illustrated aside',
      title: 'Between the pages',
      body: 'A small place for something lovely, unexpected, or worth remembering.',
      picture: media({ ratio: 'auto', frame: 'none', shadow: false }),
      flip: false,
      tone: 'sage',
    }),
    fields: [
      { key: 'kicker', label: 'Small label', type: 'rich', styleRole: 'Ui' },
      { key: 'title', label: 'Heading', type: 'rich', styleRole: 'Display' },
      { key: 'body', label: 'Description', type: 'rich', multiline: true, styleRole: 'Body' },
      { key: 'picture', label: 'Optional background artwork (fills the arch)', type: 'media', size: '1600 × 1200 px' },
      { key: 'flip', label: 'Align writing to the right', type: 'bool' },
      ...COMMON_FIELDS,
    ],
    render(sec) {
      const image = assetSrc((sec.picture || {}).assetId);
      const panelTone = ['sage', 'olive', 'rose', 'blue', 'apricot', 'gold', 'ink'].includes(sec.tone) ? sec.tone : 'sage';
      const hex = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(sec.toneHex || '') ? sec.toneHex : '';
      const digits = hex && (hex.length === 4 ? hex.slice(1).split('').map((c) => c + c).join('') : hex.slice(1));
      const brightness = digits ? [0, 2, 4].map((n) => parseInt(digits.slice(n, n + 2), 16)) : null;
      const hexInk = brightness && (.2126*brightness[0]+.7152*brightness[1]+.0722*brightness[2]) < 125 ? '#fff8ed' : '#342c2b';
      return sectionShell({ ...sec, tone: 'none', toneHex: '' }, `<div class="lit-arch-panel lit-arch-tone-${panelTone}${sec.flip ? ' lit-arch-flip' : ''}${image ? ' lit-arch-has-art' : ''}"${image || hex ? ` style="${image ? `--lit-arch-art:url('${attr(image)}');` : ''}${hex ? `background-color:${hex};color:${image ? '#fff8ed' : hexInk};` : ''}"` : ''}>
        <div class="lit-arch-copy">${kicker(sec.kicker)}${headline(sec.title)}
          ${sec.body ? `<p class="lit-arch-body" data-edit="body">${rich(sec.body)}</p>` : ''}
          <span class="lit-arch-flourish" aria-hidden="true">❧</span>
        </div>
      </div>`);
    },
  },

  /* Optional literary writing feature, never forced onto the homepage. */
  notebookFeature: {
    label: 'The writing desk',
    blurb: 'Feature your latest literary reflections, essays, reviews or quotations.',
    create: () => ({ kicker: 'Collected thoughts', title: 'The Notebook',
      subtitle: 'For everything worth keeping after the final page.', limit: 2, tone: 'paper' }),
    fields: [
      { key: 'kicker', label: 'Small label', type: 'rich', styleRole: 'Ui' },
      { key: 'title', label: 'Heading', type: 'rich', styleRole: 'Display' },
      { key: 'subtitle', label: 'Introduction', type: 'rich', multiline: true, styleRole: 'Body' },
      { key: 'limit', label: 'Entries to show', type: 'range', min: 1, max: 6, step: 1 },
      ...COMMON_FIELDS,
    ],
    render(sec) {
      const entries = notebook.list().slice(0, Number(sec.limit) || 2);
      return sectionShell(sec, `<div class="lit-optional-notebook">
        <div class="lit-optional-intro">${kicker(sec.kicker)}${headline(sec.title)}
          <p data-edit="subtitle">${rich(sec.subtitle || '')}</p><a href="#/notebook/new">Write something new ↗</a></div>
        <div class="lit-optional-entries">${entries.length ? entries.map(e => `<a href="#/notebook/${encodeURIComponent(e.id)}" class="lit-optional-entry"><span>${esc(e.kind.toUpperCase())}</span><h3>${esc(e.title || 'Untitled entry')}</h3><p>${esc(String(e.body || '').replace(/\s+/g,' ').slice(0,180))}</p><small>READ ENTRY ↗</small></a>`).join('') : `<div class="lit-optional-empty"><span>❧</span><h3>Your first page awaits.</h3><p>Start with a passage, a review, or a passing thought.</p><a href="#/notebook/new">OPEN THE NOTEBOOK ↗</a></div>`}</div>
      </div>`);
    },
  },

  readingNote: {
    label: 'A note on the year',
    blurb: 'An understated editorial reading-goal feature with a progress rule.',
    create: () => ({ kicker: 'The year so far', title: 'A note on the year' }),
    fields: [
      { key: 'kicker', label: 'Small label', type: 'rich', styleRole: 'Ui' },
      { key: 'title', label: 'Heading', type: 'rich', styleRole: 'Display' },
      ...COMMON_FIELDS,
    ],
    render(sec) {
      const p = annualProgress();
      return sectionShell(sec, `<div class="lit-optional-progress">
        <div>${kicker(sec.kicker)}${headline(sec.title)}</div>
        <div class="lit-optional-progress-number"><strong>${p.read}</strong><em>of</em><strong>${p.goal}</strong><span>BOOKS READ IN ${state.settings.year}</span></div>
        <div class="lit-optional-progress-bar"><span style="width:${Math.min(100,p.pct)}%"></span></div>
        <a href="#/challenges">READING CHALLENGES ↗</a>
      </div>`);
    },
  },

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
      { key: 'eyebrow', label: 'Eyebrow', type: 'rich', styleRole: 'Ui' },
      { key: 'title', label: 'Title', type: 'rich', styleRole: 'Display' },
      { key: 'subtitle', label: 'Subtitle', type: 'rich', styleRole: 'Body' },
      { key: 'script', label: 'Script first word', type: 'bool' },
      { key: 'height', label: 'Height', type: 'select', options: [['short', 'Short'], ['tall', 'Tall'], ['full', 'Full screen']] },
      { key: 'align', label: 'Type alignment', type: 'select', options: [['center', 'Centred'], ['left', 'Left'], ['right', 'Right']] },
      { key: 'scrim', label: 'Darkening over image', type: 'range', min: 0, max: 90, step: 5 },
      { key: 'backdrop', label: 'Background photograph', type: 'media', role: 'backdrop', size: '1800 × 1100 px' },
      { key: 'edge', label: 'Edge treatment', type: 'select', options: EDGES, controls: true },
      { key: 'edgeArt', label: 'Artwork', type: 'media', role: 'trim', size: '1800 × 200 px, transparent PNG', when: (s) => s.edge === 'artwork' },
      { key: 'edgeWhere', label: 'Artwork placement — top or bottom', type: 'select', options: EDGE_WHERE, when: (s) => s.edge === 'artwork' },
      { key: 'edgeSize', label: 'Size', type: 'range', min: 16, max: 280, step: 4, when: (s) => s.edge && s.edge !== 'none' && s.edge !== 'curtain' },
      { key: 'edgeShift', label: 'How far it sits below the seam', type: 'range', min: -120, max: 220, step: 4, when: (s) => s.edge === 'artwork' },
      { key: 'curtainArt', label: 'Curtain picture', type: 'media', role: 'curtain', size: '2400 × 1000 px, transparent PNG', when: (s) => s.edge === 'curtain' },
      { key: 'curtainWhere', label: 'Curtain placement', type: 'select', options: CURTAIN_WHERE, when: (s) => s.edge === 'curtain' },
      { key: 'curtainDrop', label: 'How far the curtain hangs', type: 'range', min: 8, max: 60, step: 1, when: (s) => s.edge === 'curtain' },
  { key: 'curtainLift', label: 'Overlap above (px)', type: 'range', min: 0, max: 140, step: 2, when: (s) => s.edge === 'curtain' },
  { key: 'curtainOffset', label: 'Move curtain up / down (px)', type: 'range', min: -200, max: 400, step: 2, when: (s) => s.edge === 'curtain' },
      { key: 'curtainGap', label: 'Space between curtain and text', type: 'range', min: -180, max: 120, step: 4, when: (s) => s.edge === 'curtain' },
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
            <p class="hero-sub" data-edit="subtitle">${sec.subtitle ? rich(sub(sec.subtitle)) : (sec.title === 'A Year in Books' ? 'Reading however the f*ck I want…all year long' : '')}</p>
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
      { key: 'kicker', label: 'Small label', type: 'rich', styleRole: 'Ui' },
      { key: 'title', label: 'Heading', type: 'rich', styleRole: 'Display' },
      { key: 'body', label: 'Text', type: 'rich', multiline: true, styleRole: 'Body' },
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
              rich(sec.body).split(/\n{2,}/).map((p) => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('')
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
      { key: 'kicker', label: 'Small label', type: 'rich', styleRole: 'Ui' },
      { key: 'title', label: 'Heading', type: 'rich', styleRole: 'Display' },
      { key: 'note', label: 'Handwritten note', type: 'rich', styleRole: 'Body' },
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
          ${sec.note ? `<p class="marginalia" data-edit="note">${rich(sec.note)}</p>` : ''}
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
      { key: 'kicker', label: 'Small label', type: 'rich', styleRole: 'Ui' },
      { key: 'title', label: 'Heading', type: 'rich', styleRole: 'Display' },
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
      { key: 'text', label: 'Text', type: 'rich', multiline: true, styleRole: 'Body' },
      { key: 'attribution', label: 'Attribution', type: 'text' },
      { key: 'size', label: 'Size', type: 'select', options: [['medium', 'Medium'], ['large', 'Large'], ['huge', 'Huge']] },
      { key: 'style', label: 'Treatment', type: 'select', options: [['quote', 'Pull quote'], ['caps', 'Letterspaced caps'], ['script', 'Script']] },
      ...COMMON_FIELDS,
    ],
    render(sec) {
      return sectionShell(sec, `
        <blockquote class="statement st-${sec.size || 'large'} st-${sec.style || 'quote'}">
          <p data-edit="text"${Number(sec.textBoxWidth) > 0 ? ` style="width:${Math.max(20, Math.min(100, Number(sec.textBoxWidth)))}%;max-width:100%"` : ''}>${rich(sec.text || '')}</p>
          ${sec.attribution ? `<cite>${esc(sec.attribution)}</cite>` : ''}
        </blockquote>`);
    },
  },

  /* 6. Decorative interlude ------------------------------------------------ */
  interlude: {
    label: 'Decorative interlude',
    blurb: 'A decorative picture or divider between sections.',
    create: () => ({
      mode: 'ornament',
      note: '',
      strip: media({ ratio: '21/9', frame: 'none', shadow: false }),
    }),
    fields: [
      { key: 'mode', label: 'Show', type: 'select', options: [['ornament', 'Decorative flourish'], ['lace', 'Lace decoration'], ['vine', 'Leaf decoration'], ['strip', 'My picture'], ['rule', 'Simple line']] },
      { key: 'note', label: 'Handwritten note', type: 'rich', styleRole: 'Body' },
      { key: 'strip', label: 'Main picture', type: 'media', size: '1800 × 260 px' },
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
      return sectionShell(sec, `${body}${sec.note ? `<p class="marginalia center" data-edit="note">${rich(sec.note)}</p>` : ''}`);
    },
  },

  /* 7. Handwritten note ---------------------------------------------------- */
  note: {
    label: 'Handwritten note',
    blurb: 'A short line in the script face, set at an angle.',
    create: () => ({ text: 'reading is the only souvenir I keep', align: 'center', rotate: -2 }),
    fields: [
      { key: 'text', label: 'Text', type: 'rich', styleRole: 'Body' },
      { key: 'align', label: 'Alignment', type: 'select', options: [['left', 'Left'], ['center', 'Centred'], ['right', 'Right']] },
      { key: 'rotate', label: 'Tilt', type: 'range', min: -8, max: 8, step: 1 },
      ...COMMON_FIELDS,
    ],
    render(sec) {
      return sectionShell(sec, `<p class="marginalia big" style="text-align:${sec.align || 'center'};--m-rot:${Number(sec.rotate) || 0}deg" data-edit="text">${rich(sec.text || '')}</p>`);
    },
  },

  /* 8. Reading progress (live) --------------------------------------------- */
  progress: {
    label: 'Reading progress',
    blurb: 'The year, the quarter and the nonfiction share. Live data.',
    create: () => ({ kicker: '', title: 'The Year So Far', subtitle: 'Everything finished, counted and kept.', showPeriod: true }),
    fields: [
      { key: 'kicker', label: 'Small label', type: 'rich', styleRole: 'Ui' },
      { key: 'title', label: 'Heading', type: 'rich', styleRole: 'Display' },
      { key: 'subtitle', label: 'Subtitle', type: 'rich', styleRole: 'Body' },
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
            ${sec.subtitle ? `<p class="ed-sub" data-edit="subtitle">${rich(sec.subtitle)}</p>` : ''}</div>
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
      { key: 'kicker', label: 'Small label', type: 'rich', styleRole: 'Ui' },
      { key: 'title', label: 'Heading', type: 'rich', styleRole: 'Display' },
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
        const checkId = `${spec.id}:${spec.period.key}`;
        const manuallyChecked = !!state.settings.manualPeriodChecks?.[checkId];
        const checked = p.complete || manuallyChecked;
        const note = p.complete
          ? `${p.books[0].title} · finished ${formatDate(p.books[0].dateFinished)}`
          : manuallyChecked ? 'Checked off by you · log a book to count it toward rewards'
          : `${p.label} · nothing logged yet`;
        rows.push(`<div class="tick period-tick${checked ? ' done' : ''}">
          <button type="button" class="period-check tick-mark" data-period-check="${attr(checkId)}" aria-label="${checked ? 'Uncheck' : 'Check off'} ${attr(spec.label)}" aria-pressed="${checked}" ${p.complete ? 'disabled title="Completed automatically from your book log"' : ''}>${checkGlyph()}</button>
          <span class="tick-body">
            <span class="tick-title">${esc(spec.label)} — ${esc(p.label.replace(/^Q\d · /, ''))}</span>
            <span class="tick-note">${esc(note)}</span>
          </span><a class="period-detail" href="#/challenge/${encodeURIComponent(challenge.id)}" aria-label="View ${attr(spec.label)} challenge details">Details <span aria-hidden="true">↗</span></a></div>`);
      }
      if (!rows.length) return '';
      return sectionShell(sec, `
        <div class="ed-head">${kicker(sec.kicker)}${headline(sec.title)}</div>
        <div class="ticks">${rows.join('')}</div>
        <div class="period-action">
          <p>Check off your list here. Finished books logged in the Library also update challenge progress and earn bookmarks.</p>
        </div>`);
    },
  },

  /* 10. Challenge collection preview (live) -------------------------------- */
  challenges: {
    label: 'Challenge collection',
    blurb: 'Your challenges, each as its own small publication.',
    create: () => ({ kicker: '', title: 'Reading Challenges', subtitle: 'Little projects to read against, all year long.', limit: 5, challengeIds: [], layout: 'editorial', descriptionSize: 20 }),
    fields: [
      { key: 'kicker', label: 'Small label', type: 'rich', styleRole: 'Ui' },
      { key: 'title', label: 'Heading', type: 'rich', styleRole: 'Display' },
      { key: 'subtitle', label: 'Subtitle', type: 'rich', styleRole: 'Body' },
      { key: 'layout', label: 'Arrangement', type: 'select', options: [['editorial', 'Alternating spreads'], ['list', 'Compact list']] },
      { key: 'descriptionSize', label: 'Challenge description size (px)', type: 'range', min: 14, max: 30, step: 1 },
      { key: 'challengeIds', label: 'Choose challenges for this section', type: 'challengeSelect' },
      { key: 'limit', label: 'How many (0 = all)', type: 'range', min: 0, max: 12, step: 1 },
      ...COMMON_FIELDS,
    ],
    render(sec) {
      const all = allChallenges();
      const isHomeCollection = sec.pageContext === 'home' || document.querySelector('#app')?.dataset?.page === 'home';
      // The full Challenges directory remains unfiltered. On the homepage,
      // each collection is independent, with at most five specific challenges.
      // Older saved sections have no challengeIds and keep their prior first-N
      // selection, capped at five. Newly added sections start unselected.
      const list = isHomeCollection
        ? (Array.isArray(sec.challengeIds)
            ? sec.challengeIds.slice(0, 5).map(id => all.find(c => String(c.id) === String(id))).filter(Boolean)
            : all.slice(0, Math.min(5, Number(sec.limit) > 0 ? Number(sec.limit) : 5)))
        : (Number(sec.limit) > 0 ? all.slice(0, Number(sec.limit)) : all);
      const emptyPrompt = isHomeCollection && !list.length
        ? '<p class="canvas-panel-hint challenges-empty">Choose up to five challenges in Design Mode → Challenge collection → Text.</p>'
        : '';
      const body = emptyPrompt || ((sec.layout === 'list')
        ? `<div class="ticks">${list.map((c) => {
            const r = evaluate(c, state.books);
            const standing = r.recurring ? `${r.count} of ${r.target} periods`
              : (r.targetUnset ? `${r.count} matching · no target yet` : `${r.count} of ${r.target} books`);
            return `<a class="tick${r.complete ? ' done' : ''}" href="#/challenge/${encodeURIComponent(c.id)}">
              <span class="tick-mark" aria-hidden="true">${checkGlyph()}</span>
              <span class="tick-body"><span class="tick-title">${esc(c.name)}</span>
              <span class="tick-note">${esc(standing)}</span></span></a>`;
          }).join('')}</div>`
        : `<div class="spreads" style="--challenge-description-size:${Math.max(14, Math.min(30, Number(sec.descriptionSize) || 20))}px">${list.map((c, i) => challengeSpread(c, i)).join('')}</div>`);
      // No "all N" link: the masthead already carries Reading Challenges and
      // every card leads to its own, so it was a third way to the same place.
      const head = (sec.kicker || sec.title || sec.subtitle)
        ? `<div class="ed-head">
             <div>${kicker(sec.kicker)}${headline(sec.title)}
               ${sec.subtitle ? `<p class="ed-sub" data-edit="subtitle">${rich(sec.subtitle)}</p>` : ''}</div>
           </div>`
        : '';
      return sectionShell(sec, `${head}${body}`);
    },
  },

  /* 11. Bookmark collection (live) ----------------------------------------- */
  bookmarks: {
    label: 'Bookmark collection',
    blurb: 'The bookmarks you have earned, laid out as a collection.',
    create: () => ({ kicker: '', title: 'The Bookmark Archive', subtitle: 'Earned one at a time, kept for good.', mode: 'recent', limit: 10 }),
    fields: [
      { key: 'kicker', label: 'Small label', type: 'rich', styleRole: 'Ui' },
      { key: 'title', label: 'Heading', type: 'rich', styleRole: 'Display' },
      { key: 'subtitle', label: 'Subtitle', type: 'rich', styleRole: 'Body' },
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
              ${sec.subtitle ? `<p class="ed-sub" data-edit="subtitle">${rich(sec.subtitle)}</p>` : ''}</div>
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
            ${sec.subtitle ? `<p class="ed-sub" data-edit="subtitle">${rich(sec.subtitle)}</p>` : ''}</div>
          <a class="ed-meta" href="#/bookmarks">${collected} of ${total} collected &rarr;</a>
        </div>
        <div class="bm-grid">${tiles}</div>`);
    },
  },

  /* 12. Recent books (live) ------------------------------------------------ */
  journalEntries: {
    label: 'From the reading journal',
    blurb: 'Book reviews, favorite passages, and scrapbook pages from your personal library.',
    create: () => ({ kicker: 'Between the pages', title: 'From My Reading Journal', limit: 3 }),
    fields: [
      { key: 'kicker', label: 'Small label', type: 'rich', styleRole: 'Ui' },
      { key: 'title', label: 'Heading', type: 'rich', styleRole: 'Display' },
      { key: 'limit', label: 'How many', type: 'range', min: 1, max: 8, step: 1 },
      ...COMMON_FIELDS,
    ],
    render(sec) {
      const entries = [...state.books].filter(b => b.review || b.favoriteQuote || b.notes || b.journalArtworkId)
        .sort((a,b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')))
        .slice(0, Number(sec.limit) || 3);
      return sectionShell(sec, `
        <div class="ed-head"><div>${kicker(sec.kicker)}${headline(sec.title)}</div></div>
        ${entries.length ? `<div class="journal-entry-cards">${entries.map(b => {
          const excerpt = String(b.review || b.notes || b.favoriteQuote || '').replace(/\s+/g, ' ').slice(0, 155);
          const artwork = b.journalArtworkId && assetSrc(b.journalArtworkId);
          return `<a href="#/book/${encodeURIComponent(b.id)}" class="journal-entry-card">
            <div class="journal-entry-visual">${artwork ? `<img src="${artwork}" alt="">` : coverImg(b, { big: true })}</div>
            <div class="journal-entry-words"><p class="lit-overline">READING JOURNAL</p><h3>${esc(b.title)}</h3><p>${esc(excerpt || b.journalArtCaption || 'A visual note from this book.')}</p><small>OPEN THE ENTRY →</small></div>
          </a>`;
        }).join('')}</div>` : `<div class="recent-books-empty"><p>Your literary pages will appear here.</p><span>Write about a book in your Library, then return to this section.</span><a href="#/books">Visit your library →</a></div>`}
      `);
    },
  },

  /* 12. Recent books (live) ------------------------------------------------ */
  books: {
    label: 'Recent reading',
    blurb: 'The latest books finished, with their covers.',
    create: () => ({ kicker: 'Lately', title: 'Recently Finished', limit: 5 }),
    fields: [
      { key: 'kicker', label: 'Small label', type: 'rich', styleRole: 'Ui' },
      { key: 'title', label: 'Heading', type: 'rich', styleRole: 'Display' },
      { key: 'limit', label: 'How many', type: 'range', min: 2, max: 12, step: 1 },
      ...COMMON_FIELDS,
    ],
    render(sec) {
      const year = state.settings.year;
      const books = sortedBooks()
        .filter((b) => inPeriod(b.dateFinished, yearPeriod(year)))
        .slice(0, Number(sec.limit) || 5);
      if (!books.length) return sectionShell(sec, `
        <div class="ed-head ed-head-split"><div>${kicker(sec.kicker)}${headline(sec.title)}</div></div>
        <div class="recent-books-empty">
          <p>No finished books on this shelf just yet.</p>
          <span>As you finish books, their covers will appear here in reading order.</span>
          <a href="#/books">Go to your library &rarr;</a>
        </div>`);
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
      { key: 'kicker', label: 'Small label', type: 'rich', styleRole: 'Ui' },
      { key: 'title', label: 'Heading', type: 'rich', styleRole: 'Display' },
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
      { key: 'kicker', label: 'Small label', type: 'rich', styleRole: 'Ui' },
      { key: 'title', label: 'Heading', type: 'rich', styleRole: 'Display' },
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
      return sectionShell(sec, `${head}<div class="arc-collection-grid">${groups}</div>`);
    },
  },


  /* 18. Word of the year --------------------------------------------------- */
  // One word, set enormous: the thing you kept meeting all year. The subtitle
  // leads to its own page, where every book you met it in is counted up.
  word: {
    label: 'Word of the year',
    blurb: 'A single word, set large, with a picture and a link to its tally.',
    create: () => ({
      wordId: '',
      showLabel: true,
      showNote: true,
      showCount: true,
      align: 'center',
      picture: media({ ratio: '4/5', frame: 'plate' }),
      flip: false,
    }),
    fields: [
      { key: 'wordId', label: 'Which word', type: 'word' },
      { key: 'align', label: 'Type alignment', type: 'select', options: [['center', 'Centred'], ['left', 'Left'], ['right', 'Right']] },
      { key: 'picture', label: 'Picture beside it', type: 'media', size: '900 × 1125 px' },
      { key: 'flip', label: 'Picture on the other side', type: 'bool' },
      { key: 'showLabel', label: 'Show the small label', type: 'bool' },
      { key: 'showNote', label: 'Show the note underneath', type: 'bool' },
      { key: 'showCount', label: 'Show the tally', type: 'bool' },
      ...COMMON_FIELDS,
    ],
    render(sec, ctx) {
      // On a word's own page the page says which word; elsewhere the section
      // does. Falling back to the newest word means a freshly added section
      // shows something rather than nothing.
      const w = (ctx && ctx.word)
        || (sec.wordId ? getWord(sec.wordId) : null)
        || allWords()[0]
        || null;
      // Drawing nothing when there is no word to draw reads as the section
      // being broken. Say what is missing and where to fix it.
      if (!w || !w.word) {
        return sectionShell(sec, `<div class="empty">
          <h3>No word chosen yet</h3>
          <p>A word of the year is one you kept meeting — add it, then record the books you met it in.</p>
          <a class="btn btn-primary" href="#/words">Add a word</a>
        </div>`);
      }
      const st = wordStats(w);
      const href = `#/word/${encodeURIComponent(w.id)}`;
      const tally = st.books
        ? `${st.books} book${st.books === 1 ? '' : 's'} · ${st.total} time${st.total === 1 ? '' : 's'}`
        : 'Nothing logged against it yet';
      const hasPic = hasAsset(sec.picture);

      const type = `<div class="word-type">
        ${sec.showLabel !== false ? kicker(`${w.label || 'Word of the Year'}${w.period ? ` · ${w.period}` : ''}`) : ''}
        <p class="word-word">${esc(w.word)}</p>
        ${sec.showNote !== false && w.note ? `<p class="word-note">${rich(w.note)}</p>` : ''}
        ${sec.showCount !== false ? `<p class="word-tally"><a class="word-link" href="${href}">${esc(tally)} &rarr;</a></p>` : ''}
      </div>`;

      return sectionShell(sec, hasPic
        ? `<div class="word-split${sec.flip ? ' is-flipped' : ''}">
             <div class="word-pic">${figure(sec.picture, { seed: `${sec.id}w` })}</div>
             ${type}
           </div>`
        : `<div class="word-solo word-${sec.align || 'center'}">${type}</div>`);
    },
  },

  /* 19. Word — the books it turned up in ----------------------------------- */
  wordShelf: {
    label: 'Word — where you met it',
    blurb: 'Every book the word turned up in, counted, with the tallies.',
    needs: 'word',
    create: () => ({ kicker: 'The record', title: 'Where you met it', showStats: true }),
    fields: [
      { key: 'kicker', label: 'Small label', type: 'rich', styleRole: 'Ui' },
      { key: 'title', label: 'Heading', type: 'rich', styleRole: 'Display' },
      { key: 'showStats', label: 'Show the summary figures', type: 'bool' },
      ...COMMON_FIELDS,
    ],
    render(sec, ctx) {
      const { word: w, stats: st } = ctx;
      const stat = (n, l) => `<div class="wstat"><span class="wstat-n">${esc(n)}</span>
        <span class="wstat-l">${esc(l)}</span></div>`;

      const figures = sec.showStats === false ? '' : `<div class="wstats">
        ${stat(st.books, st.books === 1 ? 'book' : 'books')}
        ${stat(st.total, 'times in all')}
        ${stat(st.average, 'average a book')}
        ${stat(`${st.share}%`, 'of everything read')}
      </div>
      ${st.mostIn ? `<p class="marginalia center">Thickest in
        <a href="#/book/${encodeURIComponent(st.mostIn.id)}">${esc(st.mostIn.title)}</a>
        — ${st.mostCount} time${st.mostCount === 1 ? '' : 's'}.</p>` : ''}`;

      const list = st.rows.length
        ? `<div class="list">${st.rows.map((r) => `
            <article class="list-row">
              <a class="list-row-link" href="#/book/${encodeURIComponent(r.book.id)}">
                ${coverImg(r.book)}
                <span class="grow">
                  <span class="entry-title">${esc(r.book.title)}</span>
                  <span class="entry-meta">${esc(r.book.author || '')}</span>
                  <span class="entry-meta">Finished ${esc(formatDate(r.book.dateFinished))}</span>
                </span>
              </a>
              <span class="word-count" title="times the word appears">${r.count}&times;</span>
            </article>`).join('')}</div>`
        : `<div class="empty"><h3>Nothing logged against this word yet</h3>
             <p>Open <b>Edit</b> above and add the books you met it in.</p></div>`;

      return sectionShell(sec, `
        <div class="ed-head"><div>${kicker(sec.kicker)}${headline(sec.title)}</div></div>
        ${figures}
        ${list}`);
    },
  },


  /* 20. Challenge — the books that qualify -------------------------------- */
  challengeEligible: {
    label: 'Challenge — eligible books',
    blurb: 'Which of your books count toward this challenge, and why.',
    needs: 'challenge',
    create: () => ({
      kicker: 'What counts',
      title: 'Eligible books',
      showWhy: true,
      showOutside: true,
      tone: 'none',
    }),
    fields: [
      { key: 'kicker', label: 'Small label', type: 'rich', styleRole: 'Ui' },
      { key: 'title', label: 'Heading', type: 'rich', styleRole: 'Display' },
      { key: 'showWhy', label: 'Show why each one counts', type: 'bool' },
      { key: 'showOutside', label: 'Include ones outside the dates', type: 'bool' },
      ...COMMON_FIELDS,
    ],
    render(sec, ctx) {
      const { challenge: c, result: r } = ctx;
      const period = yearPeriod(state.settings.year);
      const inWindow = new Set(r.periods.flatMap((p) => p.books.map((b) => b.id)));

      const rows = r.books
        .filter((b) => sec.showOutside !== false || inWindow.has(b.id))
        .sort((a, b) => String(b.dateFinished || '').localeCompare(String(a.dateFinished || '')));

      const why = (b) => {
        const e = eligibility(b, c);
        if (e === 'picked') return '<span class="tag tag-gold">Chosen by hand</span>';
        return '<span class="tag tag-sage">Matches the rule</span>';
      };

      return sectionShell(sec, `
        <div class="ed-head ed-head-split">
          <div>${kicker(sec.kicker)}${headline(sec.title)}</div>
          <button class="btn btn-sm" type="button" id="pick-eligible">Choose books</button>
        </div>
        <p class="hint" style="margin-top:0">${esc(describeFilter(c.filter))} — ${esc(describeWindow(c.window))}.
          Anything else you want to count, add it by hand.</p>
        ${rows.length
          ? `<div class="list">${rows.map((b) => `
              <article class="list-row">
                <a class="list-row-link" href="#/book/${encodeURIComponent(b.id)}">
                  ${coverImg(b)}
                  <span class="grow">
                    <span class="entry-title">${esc(b.title)}</span>
                    <span class="entry-meta">${esc(b.author || '')}</span>
                    <span class="entry-meta">Finished ${esc(formatDate(b.dateFinished))}</span>
                    <span class="tags">
                      ${sec.showWhy !== false ? why(b) : ''}
                      ${inWindow.has(b.id)
                        ? ''
                        : `<span class="tag tag-plain">Outside ${esc(describeWindow(c.window))}</span>`}
                    </span>
                  </span>
                </a>
              </article>`).join('')}</div>`
          : `<div class="empty"><h3>Nothing qualifies yet</h3>
               <p>No book matches this challenge's rule. Use <b>Choose books</b> to name
                  the ones that should count anyway.</p></div>`}`);
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
      { key: 'eyebrowText', label: 'Small banner line (optional)', type: 'text', hint: 'Blank uses the challenge window' },
      { key: 'titleText', label: 'Banner title (optional)', type: 'text', hint: 'Blank uses the challenge name' },
      { key: 'subtitleText', label: 'Banner subtitle (optional)', type: 'text', hint: 'Blank uses the challenge description' },
      { key: 'backdrop', label: 'Banner background image', type: 'media', role: 'backdrop', size: '1800 × 1100 px' },
      { key: 'edge', label: 'Edge treatment', type: 'select', options: EDGES, controls: true },
      { key: 'edgeArt', label: 'Artwork', type: 'media', role: 'trim', size: '1800 × 200 px, transparent PNG', when: (s) => s.edge === 'artwork' },
      { key: 'edgeWhere', label: 'Artwork placement — top or bottom', type: 'select', options: EDGE_WHERE, when: (s) => s.edge === 'artwork' },
      { key: 'edgeSize', label: 'Size', type: 'range', min: 16, max: 280, step: 4, when: (s) => s.edge && s.edge !== 'none' && s.edge !== 'curtain' },
      { key: 'edgeShift', label: 'How far it sits below the seam', type: 'range', min: -120, max: 220, step: 4, when: (s) => s.edge === 'artwork' },
      { key: 'curtainArt', label: 'Curtain picture', type: 'media', role: 'curtain', size: '2400 × 1000 px, transparent PNG', when: (s) => s.edge === 'curtain' },
      { key: 'curtainWhere', label: 'Curtain placement', type: 'select', options: CURTAIN_WHERE, when: (s) => s.edge === 'curtain' },
      { key: 'curtainDrop', label: 'How far the curtain hangs', type: 'range', min: 8, max: 60, step: 1, when: (s) => s.edge === 'curtain' },
  { key: 'curtainLift', label: 'Overlap above (px)', type: 'range', min: 0, max: 140, step: 2, when: (s) => s.edge === 'curtain' },
  { key: 'curtainOffset', label: 'Move curtain up / down (px)', type: 'range', min: -200, max: 400, step: 2, when: (s) => s.edge === 'curtain' },
      { key: 'curtainGap', label: 'Space between curtain and text', type: 'range', min: -180, max: 120, step: 4, when: (s) => s.edge === 'curtain' },
      ...TYPE_FIELDS,
    ],
    render(sec, ctx) {
      const c = ctx.challenge;
      const cover = sec.backdrop?.assetId ? sec.backdrop : (c.cover || media({ ratio: 'auto', frame: 'none', shadow: false }));
      return sectionShell(sec, `
        <div class="hero hero-${sec.height || 'short'} hero-${sec.align || 'left'}">
          ${backdrop(cover, { seed: c.id })}
          <span class="hero-scrim" style="--scrim:${Number(sec.scrim == null ? 50 : sec.scrim) / 100}"></span>
          <div class="hero-type">
            ${sec.showWindow !== false ? kicker(sec.eyebrowText || describeWindow(c.window), 'eyebrowText') : ''}
            <h1 class="hero-title" data-edit="titleText">${esc(sec.titleText || c.name)}</h1>
            ${sec.showBlurb !== false && (sec.subtitleText || c.blurb) ? `<p class="hero-sub" data-edit="subtitleText">${esc(sec.subtitleText || c.blurb)}</p>` : ''}
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
      { key: 'kicker', label: 'Small label', type: 'rich', styleRole: 'Ui' },
      { key: 'title', label: 'Heading', type: 'rich', styleRole: 'Display' },
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
      { key: 'kicker', label: 'Small label', type: 'rich', styleRole: 'Ui' },
      { key: 'title', label: 'Heading', type: 'rich', styleRole: 'Display', hint: 'Left empty, it names itself to suit the challenge.' },
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
  // Match the individual challenge's saved hero photograph as well as its
  // heading. Design Mode can override the hero image without updating c.cover;
  // the homepage preview must read that same saved section first.
  const detailHero = layout.get(`challenge:${c.id}`).find((section) =>
    section.type === 'challengeHero' && section.visible !== false);
  const savedHeroPicture = detailHero?.backdrop?.assetId ? detailHero.backdrop : null;
  const coverPicture = savedHeroPicture || c.cover;
  const picture = coverPicture?.assetId
    ? media({ ...coverPicture, ratio: '4/5', frame: 'plate', shadow: true, width: 100, rotate: 0 })
    : media({ ratio: '4/5', frame: 'plate' });
  const displayWindow = detailHero?.showWindow === false
    ? '' : (detailHero?.eyebrowText || describeWindow(c.window));
  const displayTitle = detailHero?.titleText || c.name;
  const displayBlurb = detailHero?.showBlurb === false
    ? '' : (detailHero?.subtitleText || c.blurb || '');

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
      ${displayWindow ? `<p class="ed-kicker">${esc(displayWindow)}</p>` : ''}
      <h3 class="spread-title">${esc(displayTitle)}</h3>
      ${displayBlurb ? `<p class="ed-sub">${esc(displayBlurb)}</p>` : ''}
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
