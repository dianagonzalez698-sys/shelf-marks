// Editorial section types.
//
// A page is an ordered list of section descriptors. Each type knows how to
// draw itself and what fields it exposes to the layout editor, so new
// compositions are data, not code. Dynamic sections (progress, challenges,
// bookmarks, this period) read live app state — they are real features wearing
// editorial clothes, not decoration.

import { esc, attr, progressBar, progressLine, markVisual, checkGlyph, coverImg } from './ui.js';
import { figure, backdrop, media, hasAsset } from './media.js';
import {
  state, annualProgress, quarterProgress, nonfictionProgress,
  bookmarkStats, allChallenges, getChallenge, sortedBooks, unlockMap,
} from './state.js';
import { evaluate, describeFilter, describeWindow, bookmarkLabels } from './rules.js';
import { focusQuarter, focusBimonth, daysLeftLabel, formatDate, yearPeriod, inPeriod } from './periods.js';
import { t } from './theme.js';

const uid = (p) => `${p}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

/* ------------------------------------------------------------ helpers ---- */

function sectionShell(sec, inner, extraClass = '') {
  const tone = sec.tone && sec.tone !== 'none' ? ` tone-${sec.tone}` : '';
  const pad = sec.spacing ? ` sp-${sec.spacing}` : '';
  return `<section class="ed ed-${sec.type}${tone}${pad} ${extraClass}" data-sec="${attr(sec.id)}">${inner}</section>`;
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
const COMMON_FIELDS = [
  { key: 'tone', label: 'Background', type: 'select', options: TONES },
  { key: 'spacing', label: 'Vertical space', type: 'select', options: SPACING },
];

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
      { key: 'backdrop', label: 'Background image', type: 'media' },
      { key: 'showInset', label: 'Show floating photo', type: 'bool' },
      { key: 'inset', label: 'Floating photo', type: 'media' },
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
      { key: 'picture', label: 'Picture', type: 'media' },
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
      { key: 'items', label: 'Pictures', type: 'medialist' },
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
      { key: 'items', label: 'Pictures', type: 'medialist' },
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
      { key: 'mode', label: 'Kind', type: 'select', options: [['ornament', 'Ornament rule'], ['strip', 'Image strip'], ['rule', 'Plain rule']] },
      { key: 'note', label: 'Handwritten note', type: 'text' },
      { key: 'strip', label: 'Strip image', type: 'media' },
      ...COMMON_FIELDS,
    ],
    render(sec) {
      const mode = sec.mode || 'ornament';
      const body = mode === 'strip'
        ? `<div class="interlude-strip">${figure(sec.strip, { seed: sec.id })}</div>`
        : mode === 'rule'
          ? '<hr class="interlude-rule">'
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

export function renderSection(sec) {
  if (!sec || sec.visible === false) return '';
  const type = SECTION_TYPES[sec.type];
  if (!type) return '';
  try {
    return type.render(sec) || '';
  } catch (err) {
    console.error('[lit-picks] section failed to render', sec.type, err);
    return '';
  }
}

export function renderSections(sections) {
  return (sections || []).map(renderSection).join('');
}

export function createSection(type) {
  const def = SECTION_TYPES[type];
  if (!def) return null;
  return { id: uid('sec'), type, visible: true, tone: 'none', spacing: '', ...def.create() };
}

export function typeList() {
  return Object.entries(SECTION_TYPES).map(([value, def]) => ({ value, label: def.label, blurb: def.blurb }));
}
