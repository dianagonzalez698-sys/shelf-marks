// The layout editor: add, reorder, hide and configure the editorial sections
// that make up each page — and place a picture into any slot.

import * as layout from './layout.js';
import { SECTION_TYPES, typeList, FONT_CHOICES, TYPE_ROLES, TONE_SWATCHES } from './sections.js';
import { media, FRAMES, RATIOS, TAPES, MEDIA_DEFAULTS } from './media.js';
import * as assets from './assets.js';
import { allChallenges, state, allWords } from './state.js';
import { fontWeights, fontHasItalic } from './theme.js';
import { esc, attr, toast, openSheet, confirmSheet, navigate, render, rich, richValue } from './ui.js';
import { studioNav } from './studio-nav.js';

/* ------------------------------------------------------------- pages ---- */

function pageOptions() {
  const pages = [
    ['home', 'The journal (home)'],
    ['directory', 'Challenge index'],
    ['books', 'My Books'],
    ['bookmarks', 'The bookmark archive'],
  ];
  allWords().forEach((w) => pages.push([`word:${w.id}`, `Word — ${w.word}`]));
  allChallenges().forEach((c) => pages.push([`challenge:${c.id}`, `Challenge — ${c.name}`]));
  return pages;
}

function pageLabel(id) {
  const found = pageOptions().find(([v]) => v === id);
  return found ? found[1] : id;
}

/* ------------------------------------------------------------- view ----- */

export function layoutView(params = {}) {
  const pageId = (params.query && params.query.page) || 'home';
  const sections = layout.get(pageId);
  const custom = layout.isCustomised(pageId);
  const isChallenge = pageId.startsWith('challenge:');

  const rows = sections.map((sec, i) => {
    const def = SECTION_TYPES[sec.type] || { label: sec.type, blurb: '' };
    const summary = sec.title || sec.text || sec.kicker || def.blurb;
    const hidden = sec.visible === false;
    return `<li class="lay-row${hidden ? ' is-hidden' : ''}" data-sec="${attr(sec.id)}"
      draggable="true" aria-grabbed="false">
      <span class="lay-order">
        <span class="lay-grip" aria-hidden="true" title="Drag to reorder">⠿</span>
        <button class="icon-btn lay-nudge" type="button" data-move="-1" ${i === 0 ? 'disabled' : ''} aria-label="Move up">↑</button>
        <button class="icon-btn lay-nudge" type="button" data-move="1" ${i === sections.length - 1 ? 'disabled' : ''} aria-label="Move down">↓</button>
      </span>
      <span class="lay-body">
        <span class="lay-type">${esc(def.label)}${hidden ? '<em class="lay-flag">hidden</em>' : ''}</span>
        <span class="lay-summary">${esc(String(summary || '').slice(0, 72))}</span>
      </span>
      <span class="lay-acts">
        <label class="vis-switch" title="${hidden ? 'Hidden — not shown on the page' : 'Shown on the page'}">
          <input type="checkbox" data-act="vis" ${hidden ? '' : 'checked'}>
          <span>${hidden ? 'Hidden' : 'Shown'}</span>
        </label>
        <button class="btn btn-sm" type="button" data-act="edit">Edit</button>
        <button class="icon-btn" type="button" data-act="del" aria-label="Remove section">×</button>
      </span>
    </li>`;
  }).join('');

  return {
    title: 'Layouts',
    tab: 'settings',
    back: true,
    live: false,
    html: `
      <div class="ed sp-tight form-wrap">
        ${studioNav('layout')}
        <div class="ed-head" style="margin-bottom:1.2rem">
          <p class="ed-kicker">Composition</p>
          <h2 class="ed-title">Layouts</h2>
          <p class="ed-sub">Each page is a stack of editorial sections. Rearrange them,
            hide the ones you don't want, and drop your own pictures into any slot.</p>
        </div>

        <div class="field">
          <label for="lay-page">Page</label>
          <select id="lay-page">
            ${pageOptions().map(([v, l]) =>
              `<option value="${attr(v)}" ${v === pageId ? 'selected' : ''}>${esc(l)}</option>`).join('')}
          </select>
          <p class="hint">
            ${custom
              ? 'This page has its own saved arrangement.'
              : isChallenge
                ? 'Using the shared challenge spread. Any change here creates an arrangement just for this challenge.'
                : 'Using the default arrangement. Any change saves your own version.'}
          </p>
        </div>

        <div class="btn-row" style="margin-bottom:1.2rem">
          <button class="btn btn-primary" type="button" id="lay-add">Add a section</button>
          <a class="btn" href="#/${pageId === 'directory' ? 'challenges' : pageId.startsWith('challenge:') ? `challenge/${encodeURIComponent(pageId.slice(10))}` : ''}">View page</a>
          ${custom ? '<button class="btn btn-danger" type="button" id="lay-reset">Reset page</button>' : ''}
        </div>

        ${sections.some((x) => x.visible === false)
          ? `<p class="notice" style="margin-bottom:1rem"><strong>Some sections are hidden.</strong>
              Anything inside a hidden section — pictures included — won't appear on the page.
              Switch it back to <b>Shown</b> to bring it back.</p>`
          : ''}

        ${sections.length
          ? `<ol class="lay-list">${rows}</ol>`
          : `<div class="empty"><h3>Nothing on this page yet</h3>
              <p>Add a section to begin composing it.</p></div>`}

        <p class="hint" style="margin-top:1.4rem">
          Section types live in <code>js/sections.js</code>; the default arrangements are in
          <code>js/layout.js</code>.
        </p>
      </div>
    `,

    onMount(root) {
      root.querySelector('#lay-page').onchange = (e) => {
        navigate(`/layout?page=${encodeURIComponent(e.target.value)}`);
      };

      root.querySelector('#lay-add').onclick = () => openTypePicker(pageId);

      const resetBtn = root.querySelector('#lay-reset');
      if (resetBtn) {
        resetBtn.onclick = async () => {
          const yes = await confirmSheet({
            title: `Reset “${pageLabel(pageId)}”?`,
            body: 'The page returns to its default arrangement. Your pictures stay in the library.',
            confirm: 'Reset',
            danger: true,
          });
          if (!yes) return;
          await layout.reset(pageId);
          toast('Page reset.');
          render();
        };
      }

      // Drag to reorder. The keyboard arrows stay — dragging is not reachable
      // without a pointer, and they are also simply quicker for one step.
      const list = root.querySelector('.lay-list') || root.querySelector('ul');
      if (list) {
        let dragId = null;
        list.addEventListener('dragstart', (e) => {
          const row = e.target.closest('.lay-row');
          if (!row) return;
          dragId = row.dataset.sec;
          row.classList.add('is-dragging');
          e.dataTransfer.effectAllowed = 'move';
          // Firefox needs something in the payload or no drag begins.
          try { e.dataTransfer.setData('text/plain', dragId); } catch (_) { /* ignore */ }
        });
        list.addEventListener('dragend', () => {
          dragId = null;
          list.querySelectorAll('.lay-row').forEach((r) => {
            r.classList.remove('is-dragging', 'is-over');
          });
        });
        list.addEventListener('dragover', (e) => {
          if (!dragId) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          const row = e.target.closest('.lay-row');
          list.querySelectorAll('.lay-row').forEach((r) => r.classList.toggle('is-over', r === row));
        });
        list.addEventListener('drop', async (e) => {
          if (!dragId) return;
          e.preventDefault();
          const row = e.target.closest('.lay-row');
          if (!row || row.dataset.sec === dragId) return;
          const order = [...list.querySelectorAll('.lay-row')].map((r) => r.dataset.sec);
          await layout.reorderSection(pageId, dragId, order.indexOf(row.dataset.sec));
          dragId = null;
          render();
        });
      }

      root.querySelectorAll('.lay-row').forEach((row) => {
        const id = row.dataset.sec;
        row.querySelectorAll('[data-move]').forEach((btn) => {
          btn.onclick = async () => {
            await layout.moveSection(pageId, id, Number(btn.dataset.move));
            render();
          };
        });
        // The checkbox carries the state directly, so there is no toggle to
        // get out of step with what the row is showing.
        row.querySelector('[data-act="vis"]').onchange = async (e) => {
          await layout.updateSection(pageId, id, { visible: e.target.checked });
          render();
        };
        row.querySelector('[data-act="edit"]').onclick = () => openSectionEditor(pageId, id);
        row.querySelector('[data-act="del"]').onclick = async () => {
          const yes = await confirmSheet({
            title: 'Remove this section?',
            body: 'It disappears from the page. Pictures stay in the library.',
            confirm: 'Remove',
            danger: true,
          });
          if (!yes) return;
          await layout.removeSection(pageId, id);
          toast('Section removed.');
          render();
        };
      });
    },
  };
}

/* -------------------------------------------------- typeface pickers ---- */
// Both pickers expand inside the row rather than opening a sheet: the editor
// is itself a sheet, and there is only one sheet slot — opening a second one
// tore the panel out from under you. Inline is also one less layer to get out
// of.

// A specimen sheet: every face drawn in itself. A native <select> renders its
// options in the UI font on macOS and iOS, so the list had to stop being one.
function facePickerHtml(current) {
  let group = null;
  let rows = '';
  for (const f of FONT_CHOICES) {
    const g = f.group || '';
    if (g && g !== group) rows += `<p class="face-group">${esc(g)}</p>`;
    group = g;
    rows += `<button type="button" class="face-opt${f.value === current ? ' is-on' : ''}"
      data-val="${attr(f.value)}" style="font-family:${attr(f.value || 'inherit')}">
      <span class="face-specimen">${esc(f.label)}</span>
      <span class="face-sample">Aa Bb · 123</span>
    </button>`;
  }
  return `<div class="face-list">${rows}</div>`;
}

/** One role's face + colour, shown with the field it styles. */
function roleControlHtml(r, secId, fieldLabel) {
  const cur = (k) => (k ? String(sec_ink(secId, k) || '') : '');
  const face = cur(r.font);
  const ink = cur(r.ink);
  const weight = cur(r.weight);
  const italic = cur(r.italic) === 'italic';
  const name = (FONT_CHOICES.find((x) => x.value === face) || {}).label || 'Match the site';
  const hidden = [r.font, r.ink, r.weight, r.italic, r.size, r.track, r.transform]
    .filter(Boolean)
    .map((k) => `<input type="hidden" data-field="${attr(k)}" value="${attr(cur(k))}">`)
    .join('');
  return `<div class="type-row is-inline" data-rolekey="${attr(r.role)}">
    <div class="type-row-ctl">
      <button type="button" class="face-btn" data-face="${attr(r.font)}"
        style="font-family:${attr(face || 'inherit')};font-weight:${attr(weight || 'inherit')};font-style:${italic ? 'italic' : 'normal'}"
        >${esc(name)}</button>
      <button type="button" class="ink-dot${ink ? '' : ' is-auto'}" data-inkopen="${attr(r.ink)}"
        style="--sw:${attr(ink || 'transparent')}" title="Colour"
        aria-label="${esc(fieldLabel)} colour"></button>
    </div>
    ${hidden}
    <div class="type-pop" data-pop="face" hidden>${stylePanelHtml(face, r, secId, cur)}</div>
    <div class="type-pop" data-pop="ink" hidden>${inkPickerHtml(ink, `hex-${secId}-${r.ink}`)}</div>
  </div>`;
}

const WEIGHT_NAMES = {
  300: 'Light', 400: 'Regular', 500: 'Medium', 600: 'Semibold',
  700: 'Bold', 800: 'Extrabold', 900: 'Black',
};

/**
 * Everything about one type role: the face, then how it is set.
 *
 * Weight and italic are offered from what the chosen family actually ships,
 * so the panel never promises a bold that would be faked by the browser or an
 * italic that would be a machine slant of a copperplate.
 */
function stylePanelHtml(face, r, secId, cur) {
  const weights = fontWeights(face);
  const canItalic = fontHasItalic(face);
  const w = cur(r.weight);
  const ital = cur(r.italic) === 'italic';

  const chip = (key, val, label, on, disabled = false) => `<button type="button"
    class="sty-chip${on ? ' is-on' : ''}" data-sty="${attr(key)}" data-val="${attr(val)}"
    ${disabled ? 'disabled' : ''}>${esc(label)}</button>`;

  const slider = (key, label, min, max, step, val, unit) => (key ? `<div class="sty-slider">
      <label>${esc(label)} <span data-styout="${attr(key)}">${esc(val === '' ? 'auto' : val + unit)}</span></label>
      <input type="range" data-sty="${attr(key)}" data-unit="${attr(unit)}"
        min="${min}" max="${max}" step="${step}" value="${attr(val === '' ? '' : val)}">
    </div>` : '');

  return `<div class="face-list">${facePickerHtml(face)}</div>
    <div class="sty-block">
      <p class="sty-head">Weight</p>
      <div class="sty-chips">
        ${chip(r.weight, '', 'Default', w === '')}
        ${weights.map((n) => chip(r.weight, String(n), WEIGHT_NAMES[n] || String(n), w === String(n))).join('')}
      </div>

      <p class="sty-head">Style</p>
      <div class="sty-chips">
        ${chip(r.italic, '', 'Normal', !ital)}
        ${chip(r.italic, 'italic', 'Italic', ital, !canItalic)}
      </div>
      ${canItalic ? '' : '<p class="hint">This family has no true italic, so the option is off rather than faked by slanting it.</p>'}

      ${slider(r.size, 'Size', 60, 180, 5, cur(r.size) ? Math.round(Number(cur(r.size)) * 100) : '', '%')}
      ${slider(r.track, 'Letter spacing', -4, 40, 1, cur(r.track) ? Math.round(parseFloat(cur(r.track)) * 100) : '', '')}

      ${r.transform ? `<p class="sty-head">Case</p>
        <div class="sty-chips">
          ${chip(r.transform, '', 'Default', cur(r.transform) === '')}
          ${chip(r.transform, 'none', 'As typed', cur(r.transform) === 'none')}
          ${chip(r.transform, 'uppercase', 'UPPER', cur(r.transform) === 'uppercase')}
          ${chip(r.transform, 'lowercase', 'lower', cur(r.transform) === 'lowercase')}
          ${chip(r.transform, 'capitalize', 'Title', cur(r.transform) === 'capitalize')}
        </div>` : ''}

      <div class="btn-row" style="margin-top:.9rem">
        <button class="btn btn-sm btn-block" type="button" data-styreset>Reset this role</button>
      </div>
    </div>`;
}

// Palette first, then a wheel and a hex box for anything else.
function inkPickerHtml(current, id) {
  const cur = String(current || '');
  const sw = (v, l, cls = '') => `<button type="button" class="ink-sw ${cls}${v === cur ? ' is-on' : ''}"
    data-val="${attr(v)}" style="--sw:${attr(v || 'transparent')}" title="${attr(l)}"
    aria-label="${attr(l)}"></button>`;
  return `<div class="ink-pick">
      ${sw('', 'Match the site', 'ink-auto')}
      ${INK_SWATCHES.map(([v, l]) => sw(v, l)).join('')}
    </div>
    <div class="ink-custom-row">
      <label class="ink-wheel" title="Colour wheel">
        <input type="color" data-wheel value="${attr(cur || '#4B2828')}">
      </label>
      <div class="field" style="margin:0;flex:1">
        <label for="${attr(id)}">Hex</label>
        <input type="text" id="${attr(id)}" data-hex spellcheck="false"
          placeholder="#C9787E" value="${attr(cur)}">
      </div>
    </div>`;
}

/* ------------------------------------------------------ type picker ----- */

function openTypePicker(pageId) {
  openSheet(`
    <h2>Add a section</h2>
    <p class="small muted">Each one is a different kind of editorial composition.</p>
    <div class="type-list">
      ${typeList(pageId).map((t) => `<button class="type-opt" type="button" data-type="${attr(t.value)}">
        <span class="type-name">${esc(t.label)}</span>
        <span class="type-blurb">${esc(t.blurb)}</span>
      </button>`).join('')}
    </div>
    <div class="btn-row" style="margin-top:.8rem">
      <button class="btn btn-block" type="button" data-close>Cancel</button>
    </div>
  `, {
    onMount(sheet, close) {
      sheet.querySelectorAll('[data-type]').forEach((btn) => {
        btn.onclick = async () => {
          await layout.addSection(pageId, btn.dataset.type);
          close();
          toast('Section added.', 'good');
          render();
        };
      });
    },
  });
}

/* --------------------------------------------------- section editor ----- */

/**
 * Settings that cannot take effect as configured. Every one of these used to
 * fail silently — the control moved, nothing changed on the page, and there
 * was no way to tell why.
 */
function sectionWarnings(sec) {
  const out = [];
  const hasGround = !!(sec.bgImage && sec.bgImage.assetId)
    || (sec.tone && sec.tone !== 'none')
    || sec.type === 'hero';
  const edge = sec.edge && sec.edge !== 'none' ? sec.edge : '';

  if (sec.type === 'word' && !allWords().length) {
    out.push('There are no words yet, so this section has nothing to show. '
      + '<a href="#/words">Add a word</a> first.');
  }

  if (edge === 'curtain' && !(sec.curtainArt && sec.curtainArt.assetId)) {
    out.push('Choose the curtain picture below, or nothing is drawn.');
  }
  if (edge === 'curtain' && sec.curtainArt && sec.curtainArt.assetId) {
    const a = assets.get(sec.curtainArt.assetId);
    if (a && !a.frameSlice) {
      // Two different faults look identical on screen, and the fix differs.
      const flattened = a.hasAlpha === false && !/^data:image\/png/.test(a.dataUrl || '');
      out.push(flattened
        ? `“${esc(a.name)}” has no transparency left: it was stored as a `
          + 'photograph, which flattens a transparent centre to solid colour. '
          + 'That happened on upload and cannot be undone here — <b>add the '
          + 'original PNG again</b> and it will keep its see-through middle.'
        : `“${esc(a.name)}” has no see-through opening in the middle, so there is `
          + 'nothing for the section to show through. A curtain needs the whole '
          + 'cloth in one picture with the <b>centre cut out</b>.');
    }
  }

  if (edge && edge !== 'artwork' && edge !== 'curtain' && !hasGround) {
    out.push('This section sits on plain paper, so a shaped edge has nothing to '
      + 'cut into. Give it a background colour or photograph — or choose '
      + '<b>My own artwork</b>, which works on any section.');
  }
  if (edge === 'artwork' && !(sec.edgeArt && sec.edgeArt.assetId)) {
    out.push('Choose the artwork for the edge below, or nothing is drawn.');
  }
  if (edge === 'artwork' && sec.edgeArt && sec.edgeArt.assetId) {
    const a = assets.get(sec.edgeArt.assetId);
    if (a && a.hasAlpha === false) {
      out.push(`“${esc(a.name)}” has no transparent areas, so it will draw as a `
        + 'solid block rather than sitting over the page. Use a cut-out PNG and '
        + 'add it to the library as a <b>Cutout</b>.');
    }
  }
  return out;
}

function warningsHtml(sec) {
  const list = sectionWarnings(sec);
  if (!list.length) return '';
  // Warning copy is authored here, not user input, so the <b> tags are ours.
  return list.map((w) => `<p class="notice">${w}</p>`).join('');
}

// The palette tokens worth setting type in. Resolved against the live theme so
// the swatches are this design's colours, not a generic picker's.
const INK_TOKENS = [
  ['--c-ink', 'Primary text'], ['--c-ink-soft', 'Secondary text'],
  ['--c-ink-faint', 'Captions'], ['--c-accent', 'Accent'],
  ['--c-sage', 'Sage'], ['--c-rose-ink', 'Rose'], ['--c-blue-ink', 'Blue'],
  ['--c-gold-ink', 'Gold'], ['--c-bg', 'Page ground'],
];

let INK_SWATCHES = [];
function refreshInkSwatches() {
  const cs = getComputedStyle(document.documentElement);
  const seen = new Set();
  INK_SWATCHES = INK_TOKENS
    .map(([v, l]) => [cs.getPropertyValue(v).trim(), l])
    .filter(([v]) => v && !seen.has(v) && seen.add(v));
}

// The section currently being edited, so a combined row can read its partner
// value without the caller threading it through.
let EDITING = null;
function sec_ink(secId, key) {
  return EDITING && EDITING.id === secId ? EDITING[key] : '';
}

function fieldControl(f, value, secId, { inlineStyle = true } = {}) {
  const id = `f-${secId}-${f.key}`;
  switch (f.type) {
    case 'textarea':
      return `<div class="field"><label for="${id}">${esc(f.label)}</label>
        <textarea id="${id}" data-field="${attr(f.key)}" rows="5">${esc(value || '')}</textarea></div>`;
    case 'bool':
      return `<label class="switch-row"><input type="checkbox" id="${id}" data-field="${attr(f.key)}" ${value ? 'checked' : ''}>
        <span class="switch-text">${esc(f.label)}</span></label>`;
    case 'rich': {
      // The field carries the styling for the role it is drawn in, so you
      // choose a face while looking at the words it will set — rather than
      // deciding for "headings" in the abstract at the foot of the panel.
      const r = TYPE_ROLES.find((x) => x.role === f.styleRole) || null;
      return `<div class="field">
        <label for="${id}">${esc(f.label)}</label>
        <div class="rich-bar" role="group" aria-label="Formatting">
          <button type="button" class="rich-btn" data-rich="bold" title="Bold (⌘B)"><b>B</b></button>
          <button type="button" class="rich-btn" data-rich="italic" title="Italic (⌘I)"><i>I</i></button>
          <button type="button" class="rich-btn rich-clear" data-rich="clear" title="Plain">⦸</button>
        </div>
        <div class="rich-input" id="${id}" data-rich-field="${attr(f.key)}"
             contenteditable="true" role="textbox" aria-multiline="${f.multiline ? 'true' : 'false'}"
             >${rich(value)}</div>
        ${r && inlineStyle ? roleControlHtml(r, secId, f.label) : ''}
        <p class="hint">Select a word and press <b>⌘B</b> or <b>⌘I</b> to emphasise just that part.</p>
      </div>`;
    }
    case 'typeface': {
      // Face and colour on one line; everything else about this role lives in
      // the panel the face button opens, so four roles stay four rows.
      const r = f.role || {};
      const face = String(value || '');
      const ink = String(sec_ink(secId, f.inkKey) || '');
      const name = (FONT_CHOICES.find((x) => x.value === face) || {}).label || 'Site default';
      const cur = (k) => (k ? String(sec_ink(secId, k) || '') : '');
      const weight = cur(r.weight);
      const italic = cur(r.italic) === 'italic';
      const extra = ['weight', 'italic', 'size', 'track', 'transform']
        .filter((k) => r[k])
        .map((k) => `<input type="hidden" data-field="${attr(r[k])}" value="${attr(cur(r[k]))}">`)
        .join('');
      return `<div class="type-row">
        <span class="type-row-label">${esc(f.label)}</span>
        <div class="type-row-ctl">
          <button type="button" class="face-btn" data-face="${attr(f.key)}" title="Change ${esc(f.label.toLowerCase())} font"
            style="font-family:${attr(face || 'inherit')};font-weight:${attr(weight || 'inherit')};font-style:${italic ? 'italic' : 'normal'}"
            >${esc(name)}</button>
          <button type="button" class="ink-dot${ink ? '' : ' is-auto'}" data-inkopen="${attr(f.inkKey)}"
            style="--sw:${attr(ink || 'transparent')}" title="Change text color"
            aria-label="Change ${esc(f.label.toLowerCase())} text color">Color</button>
        </div>
        <input type="hidden" data-field="${attr(f.key)}" value="${attr(face)}">
        <input type="hidden" data-field="${attr(f.inkKey)}" value="${attr(ink)}">
        ${extra}
        <div class="type-pop" data-pop="face" hidden>${stylePanelHtml(face, r, secId, cur)}</div>
        <div class="type-pop" data-pop="ink" hidden>${inkPickerHtml(ink, `hex-${secId}-${f.inkKey}`)}</div>
      </div>`;
    }
    case 'select':
      return `<div class="field"><label for="${id}">${esc(f.label)}</label>
        <select id="${id}" data-field="${attr(f.key)}">
          ${f.options.map(([v, l]) => `<option value="${attr(v)}" ${String(v) === String(value || '') ? 'selected' : ''}>${esc(l)}</option>`).join('')}
        </select></div>`;
    case 'tonePicker': {
      const chosen = String(value || 'none');
      const custom = String(sec_ink(secId, 'toneHex') || '');
      return `<div class="field tone-picker"><span class="field-label">${esc(f.label)}</span>
        <input type="hidden" data-field="${attr(f.key)}" value="${attr(chosen)}">
        <div class="tone-choice-list" role="group" aria-label="Preset background colors">
          ${TONE_SWATCHES.map(([key, label, hex]) => `<button type="button" class="tone-choice${chosen === key && !custom ? ' is-selected' : ''}" data-tone-preset="${attr(key)}" aria-pressed="${chosen === key && !custom}">
            <span class="tone-choice-swatch" style="background:${hex}"></span><span class="tone-choice-name">${esc(label)}</span><code>${hex.toUpperCase()}</code>
          </button>`).join('')}
        </div>
        <label class="tone-hex-label" for="f-${attr(secId)}-toneHex">Custom hex color</label>
        <div class="tone-hex-row"><input type="color" data-tone-wheel value="${attr(/^#[a-f0-9]{6}$/i.test(custom) ? custom : '#e7ece3')}">
          <input type="text" id="f-${attr(secId)}-toneHex" data-field="toneHex" value="${attr(custom)}" placeholder="#A7B49C" maxlength="7" spellcheck="false" aria-label="Custom background hex color">
        </div>
        <p class="hint">Choose a preset or enter your own hex code.</p>
      </div>`;
    }
    case 'range':
      return `<div class="field"><label for="${id}">${esc(f.label)} <span class="token-value" data-readout>${esc(value)}</span></label>
        <input type="range" id="${id}" data-field="${attr(f.key)}" min="${f.min}" max="${f.max}" step="${f.step}" value="${attr(value)}"></div>`;
    case 'media':
      return `<div class="field"><span class="field-label">${esc(f.label)}</span>
        ${mediaButton(f.key, value, false, f.role)}
        ${f.size ? `<p class="hint">Best at <b>${esc(f.size)}</b>. Anything larger is scaled down on upload.</p>` : ''}
        ${f.role === 'curtain'
          ? '<p class="hint">The whole curtain in one picture — valance across the top, drapes down both sides, and the middle cut out so the section shows through. The drapes stretch to the section\u2019s height; the valance and the corners keep their shape.</p>'
          : f.role === 'trim'
          ? '<p class="hint">Shown as it is, laid across the edge. Use a transparent PNG so the page shows through around the artwork.</p>'
          : f.role === 'backdrop'
            ? '<p class="hint">Fills the whole section, edge to edge. Frames and tilts don’t apply to a background — put those on a picture inside the section.</p>'
            : ''}</div>`;
    case 'medialist':
      return `<div class="field"><span class="field-label">${esc(f.label)}</span>
        <div class="media-list" data-medialist="${attr(f.key)}">
          ${(value || []).map((m, i) => mediaButton(`${f.key}:${i}`, m, true)).join('')}
        </div>
        <button class="btn btn-sm" type="button" data-addmedia="${attr(f.key)}">Add a picture</button>
        ${f.size ? `<p class="hint">Best at <b>${esc(f.size)}</b> each.</p>` : ''}</div>`;
    default:
      return `<div class="field"><label for="${id}">${esc(f.label)}</label>
        <input type="text" id="${id}" data-field="${attr(f.key)}" value="${attr(value || '')}"></div>`;
  }
}

/** Fields that apply to this section as currently configured. */
function visibleFields(def, sec) {
  const shown = def.fields.filter((f) => typeof f.when !== 'function' || f.when(sec));
  // A role already shown beside its own text field does not need repeating in
  // the block at the foot of the panel — that grouping is what made choosing a
  // face feel like a decision about nothing in particular.
  const claimed = new Set(shown.filter((f) => f.styleRole).map((f) => f.styleRole));
  return shown.filter((f) => f.type !== 'typeface' || !claimed.has((f.role || {}).role));
}

// Settings that describe the section's *craft* rather than its content. They
// are the ones that need you to know what a bite or a drop is, and they are
// the reason the panel reads as a console. Kept in full, put out of the way.
const FINE_KEYS = new Set([
  'shape', 'tone', 'toneHex', 'bgImage', 'bgScrim', 'bgInk',
  'edge', 'edgeArt', 'edgeWhere', 'edgeSize', 'edgeShift',
  'curtainArt', 'curtainWhere', 'curtainDrop', 'curtainGap',
  'spacing', 'scrim', 'rotate', 'flip', 'ratio', 'dropcap', 'stagger',
  'showLabel', 'showNote', 'showCount', 'showWhy', 'showOutside',
  'showStats', 'showFilter', 'showBar', 'showStanding', 'showFilters',
  'showInset', 'inset',
]);

function isFine(f) {
  return FINE_KEYS.has(f.key) || f.type === 'typeface';
}

const STYLE_KEYS = new Set([
  'shape', 'tone', 'toneHex', 'bgScrim', 'bgInk', 'scrim', 'ink', 'color', 'background',
]);
const ARTWORK_KEYS = new Set([
  'edge', 'edgeArt', 'edgeWhere', 'edgeSize', 'edgeShift',
  'curtainArt', 'curtainDrop', 'curtainGap',
]);

function fieldsHtml(def, sec, mode = 'all') {
  EDITING = sec;
  refreshInkSwatches();
  if (mode !== 'all') {
    const all = def.fields.filter((f) => typeof f.when !== 'function' || f.when(sec));
    const content = (f) => ['rich', 'textarea', 'text'].includes(f.type)
      || (!f.type && /title|heading|subtitle|body|text|kicker|label|intro|caption|note|eyebrow|description/i.test(f.key));
    // The section editor is for the handful of decisions made repeatedly.
    // Existing values for all other fields remain in the saved data; they are
    // simply no longer surfaced as an intimidating grid of switches.
    const contentEssentials = new Set(['limit', 'layout', 'mode', 'columns']);
    const styleEssentials = new Set(['shape', 'tone', 'fontDisplay', 'fontBody']);
    const artworkEssentials = new Set([
      'bgImage', 'backdrop', 'picture', 'inset', 'items', 'strip',
      'edge', 'edgeArt', 'edgeWhere', 'edgeSize',
      'curtainArt', 'curtainWhere', 'curtainDrop',
    ]);
    const chosen = all.filter((f) => mode === 'content'
      ? content(f) || contentEssentials.has(f.key)
      : mode === 'style' ? styleEssentials.has(f.key)
      : mode === 'artwork' ? artworkEssentials.has(f.key)
      : false);
    if (!chosen.length && mode !== 'artwork') return `<p class="canvas-panel-hint">${mode === 'content' ? 'This section draws its words from your reading records, so there is no text to rewrite here.' : mode === 'style' ? 'This section uses the journal’s shared visual style.' : 'No additional options for this section.'}</p>`;
    const draw = (f) => fieldControl(f, sec[f.key], sec.id, { inlineStyle: false });
    if (mode === 'style') {
      const appearance = chosen.filter((f) => f.type !== 'typeface');
      const typography = chosen.filter((f) => f.type === 'typeface');
      return `${appearance.length ? '<p class="canvas-field-group">Background</p>' + appearance.map(draw).join('') : ''}
        ${typography.length ? '<p class="canvas-field-group">Fonts & text colors</p>' + typography.map(draw).join('') : ''}`;
    }
    if (mode === 'artwork') return `${sec.edge && sec.edge !== 'none' ? `<p class="canvas-panel-hint canvas-edge-help">${sec.edge === 'curtain' ? 'Place the curtain at the top or bottom.' : sec.edge === 'artwork' ? 'Choose which edge gets your artwork.' : 'This shapes the bottom edge.'}</p>` : ''}
      ${chosen.length ? chosen.map(draw).join('') : '<p class="canvas-panel-hint">No built-in picture slots in this section.</p>'}
      <div class="canvas-artwork-cta"><p>Add freeform artwork—curtains, cloud borders, illustrations or decorative cutouts—and position it anywhere in this section.</p>
      <button type="button" data-canvas="image">＋ Place artwork here</button></div>`;
    return chosen.map(draw).join('');
  }
  const all = visibleFields(def, sec);
  const plain = all.filter((f) => !isFine(f));
  const fine = all.filter(isFine);
  const draw = (f) => fieldControl(f, sec[f.key], sec.id);

  return plain.map(draw).join('')
    + (fine.length ? `<details class="fine">
        <summary>Fine-tune — background, edges, spacing and type</summary>
        <div class="fine-body">${fine.map(draw).join('')}</div>
      </details>` : '');
}

function mediaButton(key, m, removable = false, role = '') {
  const descriptor = media(m || {});
  const url = assets.src(descriptor.assetId);
  const a = assets.get(descriptor.assetId);
  const meta = role === 'trim'
    ? 'laid across the edge'
    : role === 'backdrop'
      ? `fills the section · ${Math.round(Number(descriptor.opacity) * 100)}%`
      : `${descriptor.frame} · ${descriptor.ratio}`;
  return `<span class="media-slot">
    <button class="media-pick" type="button" data-media="${attr(key)}">
      <span class="media-thumb">${url
        ? `<img src="${attr(url)}" alt="">`
        : '<span class="media-thumb-empty">empty</span>'}</span>
      <span class="media-label">${esc(a ? a.name : 'Choose a picture')}</span>
      <span class="media-meta">${esc(meta)}</span>
    </button>
    ${removable ? `<button class="icon-btn" type="button" data-rmmedia="${attr(key)}" aria-label="Remove picture">×</button>` : ''}
  </span>`;
}

export function openSectionEditor(pageId, sectionId, { mountIn = null } = {}) {
  const sec = layout.getSection(pageId, sectionId);
  if (!sec) return;
  const original = SECTION_TYPES[sec.type];
  if (!original) return;
  // Shape is a section-wide option, including specialized blocks whose own
  // field lists don't use COMMON_FIELDS (such as the cover hero).
  const def = original.fields.some((field) => field.key === 'shape')
    ? original
    : { ...original, fields: [{ key: 'shape', label: 'Section shape', type: 'select', options: [['', 'Original shape'], ['arch', 'Tall arch']], controls: true }, ...original.fields] };
  if (!def.fields.some((field) => field.key === 'tone')) {
    def.fields = [...def.fields, { key: 'tone', label: 'Background colour', type: 'tonePicker' }];
  }
  let editingTab = mountIn ? 'content' : 'all';

  // Rebuilt rather than snapshotted, so returning from the picture editor
  // shows the picture you just chose.
  const build = () => {
    const fresh = layout.getSection(pageId, sectionId) || sec;
    return `
    <h2>${esc(def.label)}</h2>
    <p class="small muted">${esc(def.blurb)}</p>
    <div id="sec-warnings">${warningsHtml(fresh)}</div>
    ${mountIn ? `<div class="canvas-inspector-tabs" role="group" aria-label="Section settings">
      <button type="button" data-inspector-tab="content" class="${editingTab === 'content' ? 'active' : ''}">Content</button>
      <button type="button" data-inspector-tab="style" class="${editingTab === 'style' ? 'active' : ''}">Style</button>
      <button type="button" data-inspector-tab="artwork" class="${editingTab === 'artwork' ? 'active' : ''}">Artwork</button>
    </div>` : ''}
    <div id="sec-fields" style="margin-top:1rem">${fieldsHtml(def, fresh, editingTab)}</div>
    <div class="btn-row" style="margin-top:1rem">
      <button class="btn btn-block" type="button" data-close>Done</button>
    </div>`;
  };

  const editor = {
    reopen: build,
    onMount(sheet) {
      const warnBox = sheet.querySelector('#sec-warnings');
      const fieldBox = sheet.querySelector('#sec-fields');

      sheet.querySelectorAll('[data-inspector-tab]').forEach((button) => {
        button.onclick = () => {
          editingTab = button.dataset.inspectorTab;
          sheet.querySelectorAll('[data-inspector-tab]').forEach((tab) => tab.classList.toggle('active', tab === button));
          fieldBox.innerHTML = fieldsHtml(def, layout.getSection(pageId, sectionId), editingTab);
          bind();
        };
      });

      const refreshPanel = () => {
        const fresh = layout.getSection(pageId, sectionId);
        if (warnBox) warnBox.innerHTML = warningsHtml(fresh);
        if (fieldBox) {
          fieldBox.innerHTML = fieldsHtml(def, fresh, editingTab);
          bind();
        }
      };

      const commit = async (patch, { rebuild = false } = {}) => {
        await layout.updateSection(pageId, sectionId, patch);
        const fresh = layout.getSection(pageId, sectionId);
        if (warnBox) warnBox.innerHTML = warningsHtml(fresh);
        // A control that decides which other controls apply redraws the panel,
        // so the sheet never shows settings that cannot do anything.
        if (rebuild && fieldBox) {
          fieldBox.innerHTML = fieldsHtml(def, fresh, editingTab);
          bind();
        }
      };

      function bind() {
        const previewBackground = (hex) => {
          const node = [...document.querySelectorAll('#app [data-sec]')].find((x) => x.dataset.sec === sectionId);
          if (!node) return;
          const archPanel = node.querySelector('.lit-arch-panel');
          const target = archPanel || node;
          if (hex) {
            target.style.backgroundColor = hex;
            const digits = hex.length === 4 ? hex.slice(1).split('').map((c) => c + c).join('') : hex.slice(1);
            const rgb = [0, 2, 4].map((n) => parseInt(digits.slice(n, n + 2), 16));
            const ink = (.2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2]) < 125 ? '#fff8ed' : '#342c2b';
            target.style.color = ink;
            target.style.setProperty('--c-title-ink', ink);
            target.style.setProperty('--c-body-ink', ink);
            target.style.setProperty('--c-label-ink', ink);
          } else {
            target.style.removeProperty('background-color');
            target.style.removeProperty('color');
            ['--c-title-ink','--c-body-ink','--c-label-ink'].forEach((key) => target.style.removeProperty(key));
          }
          if (!archPanel) {
            if (hex) target.style.background = hex;
            else target.style.removeProperty('background');
          }
        };
        sheet.querySelectorAll('[data-field]').forEach((el) => {
          const key = el.dataset.field;
          const fieldDef = def.fields.find((x) => x.key === key) || {};
          el.addEventListener('input', async () => {
            let v;
            if (el.type === 'checkbox') v = el.checked;
            else if (el.type === 'range') {
              v = Number(el.value);
              const out = el.closest('.field').querySelector('[data-readout]');
              if (out) out.textContent = v;
            } else v = el.value;
            if (key === 'toneHex') {
              const hex = String(v).trim();
              if (hex && !/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(hex)) return;
              previewBackground(hex);
              const toneInput = sheet.querySelector('[data-field="tone"]');
              if (hex && toneInput) toneInput.value = 'none';
              if (hex) sheet.querySelectorAll('[data-tone-preset]').forEach((button) => {
                button.classList.remove('is-selected'); button.setAttribute('aria-pressed', 'false');
              });
              await commit(hex ? { tone: 'none', toneHex: hex } : { toneHex: '' });
              return;
            }
            if (key === 'shape') {
              const sectionNode = [...document.querySelectorAll('#app [data-sec]')].find(node => node.dataset.sec === sectionId);
              if (sectionNode) sectionNode.classList.toggle('shape-arch', v === 'arch');
            }
            // Keep the actual journal page in step with the text box without
            // replacing the entire section (which would disrupt the editor).
            if (['text', 'textarea', 'rich'].includes(fieldDef.type)) {
              const sectionNode = [...document.querySelectorAll('#app [data-sec]')].find(node => node.dataset.sec === sectionId);
              const visible = [...(sectionNode?.querySelectorAll('[data-edit]') || [])].find(node => node.dataset.edit === key);
              if (visible) visible.innerHTML = rich(v);
            }
            if (fieldDef.type === 'font') el.style.fontFamily = v || 'inherit';
            await commit({ [key]: v }, { rebuild: !!fieldDef.controls });
          });
        });

        sheet.querySelectorAll('[data-tone-preset]').forEach((button) => {
          button.onclick = async () => {
            const toneInput = sheet.querySelector('[data-field="tone"]');
            const hexInput = sheet.querySelector('[data-field="toneHex"]');
            if (!toneInput || !hexInput) return;
            hexInput.value = '';
            toneInput.value = button.dataset.tonePreset;
            await commit({ tone: button.dataset.tonePreset, toneHex: '' });
            previewBackground('');
            const node = [...document.querySelectorAll('#app [data-sec]')].find((x) => x.dataset.sec === sectionId);
            if (node) {
              [...node.classList].filter((name) => name.startsWith('tone-')).forEach((name) => node.classList.remove(name));
              if (button.dataset.tonePreset !== 'none') node.classList.add(`tone-${button.dataset.tonePreset}`);
            }
            sheet.querySelectorAll('[data-tone-preset]').forEach((b) => {
              b.classList.toggle('is-selected', b === button);
              b.setAttribute('aria-pressed', String(b === button));
            });
          };
        });
        sheet.querySelectorAll('[data-tone-wheel]').forEach((wheel) => {
          wheel.oninput = () => {
            const hexInput = sheet.querySelector('[data-field="toneHex"]');
            if (!hexInput) return;
            hexInput.value = wheel.value.toUpperCase();
            hexInput.dispatchEvent(new Event('input', { bubbles: true }));
            sheet.querySelectorAll('[data-tone-preset]').forEach((b) => {
              b.classList.remove('is-selected'); b.setAttribute('aria-pressed', 'false');
            });
          };
        });

        // Both pickers write through the row's hidden field, so every control
        // still commits down the one path above.
        const writeField = (key, v) => {
          const el = sheet.querySelector(`[data-field="${key}"]`);
          if (!el) return;
          el.value = v;
          el.dispatchEvent(new Event('input', { bubbles: true }));
        };

        const faceName = (v) => (FONT_CHOICES.find((x) => x.value === v) || {}).label || 'Site default';

        sheet.querySelectorAll('.type-row').forEach((row) => {
          const faceBtn = row.querySelector('[data-face]');
          // The role is read off the control itself, so a row beside a field
          // and a row in the foot block bind the same way.
          const r = TYPE_ROLES.find((x) => x.font === faceBtn.dataset.face) || {};
          const inkBtn = row.querySelector('[data-inkopen]');
          const facePop = row.querySelector('[data-pop="face"]');
          const inkPop = row.querySelector('[data-pop="ink"]');
          const faceKey = faceBtn.dataset.face;
          const inkKey = inkBtn.dataset.inkopen;

          // Only one panel open at a time, across every row.
          const toggle = (pop) => {
            const show = pop.hidden;
            sheet.querySelectorAll('.type-pop').forEach((x) => { x.hidden = true; });
            pop.hidden = !show;
          };
          faceBtn.onclick = () => toggle(facePop);
          inkBtn.onclick = () => toggle(inkPop);

          const repaintBtn = () => {
            const fv = row.querySelector(`[data-field="${faceKey}"]`).value;
            const wv = r.weight ? row.querySelector(`[data-field="${r.weight}"]`).value : '';
            const iv = r.italic ? row.querySelector(`[data-field="${r.italic}"]`).value : '';
            faceBtn.style.fontFamily = fv || 'inherit';
            faceBtn.style.fontWeight = wv || 'inherit';
            faceBtn.style.fontStyle = iv === 'italic' ? 'italic' : 'normal';
            faceBtn.textContent = faceName(fv);
          };

          facePop.querySelectorAll('.face-opt').forEach((o) => {
            o.onclick = () => {
              const v = o.dataset.val;
              writeField(faceKey, v);
              facePop.querySelectorAll('.face-opt').forEach((x) => x.classList.toggle('is-on', x === o));
              // The new family may not ship the weight or italic in force, so
              // the panel is rebuilt against what it actually has.
              facePop.innerHTML = stylePanelHtml(v, r, sec.id, (k) => (k
                ? (row.querySelector(`[data-field="${k}"]`) || {}).value || '' : ''));
              bindStyle();
              repaintBtn();
            };
          });

          // Chips and sliders inside the style panel.
          function bindStyle() {
            facePop.querySelectorAll('.face-opt').forEach((o) => {
              o.onclick = () => {
                const v = o.dataset.val;
                writeField(faceKey, v);
                facePop.innerHTML = stylePanelHtml(v, r, sec.id, (k) => (k
                  ? (row.querySelector(`[data-field="${k}"]`) || {}).value || '' : ''));
                bindStyle();
                repaintBtn();
              };
            });
            facePop.querySelectorAll('[data-sty]').forEach((el) => {
              const key = el.dataset.sty;
              if (el.tagName === 'BUTTON') {
                el.onclick = () => {
                  writeField(key, el.dataset.val);
                  el.parentElement.querySelectorAll('.sty-chip').forEach((c) => {
                    c.classList.toggle('is-on', c === el);
                  });
                  repaintBtn();
                };
              } else {
                el.addEventListener('input', () => {
                  const unit = el.dataset.unit || '';
                  // Size is a multiplier; tracking is an em value.
                  const v = unit === '%'
                    ? String(Number(el.value) / 100)
                    : `${(Number(el.value) / 100).toFixed(3)}em`;
                  writeField(key, v);
                  const out = facePop.querySelector(`[data-styout="${key}"]`);
                  if (out) out.textContent = unit === '%' ? `${el.value}%` : el.value;
                  repaintBtn();
                });
              }
            });
            const reset = facePop.querySelector('[data-styreset]');
            if (reset) {
              reset.onclick = () => {
                [faceKey, r.weight, r.italic, r.size, r.track, r.transform, inkKey]
                  .filter(Boolean).forEach((k) => writeField(k, ''));
                facePop.innerHTML = stylePanelHtml('', r, sec.id, () => '');
                bindStyle();
                repaintBtn();
                inkBtn.style.setProperty('--sw', 'transparent');
                inkBtn.classList.add('is-auto');
              };
            }
          }
          bindStyle();

          const wheel = inkPop.querySelector('[data-wheel]');
          const hex = inkPop.querySelector('[data-hex]');
          const paintDot = (v) => {
            inkBtn.style.setProperty('--sw', v || 'transparent');
            inkBtn.classList.toggle('is-auto', !v);
          };
          inkPop.querySelectorAll('.ink-sw').forEach((o) => {
            o.onclick = () => {
              const v = o.dataset.val;
              writeField(inkKey, v);
              paintDot(v);
              if (hex) hex.value = v;
              inkPop.querySelectorAll('.ink-sw').forEach((x) => x.classList.toggle('is-on', x === o));
              inkPop.hidden = true;
            };
          });
          if (wheel) {
            wheel.addEventListener('input', () => {
              hex.value = wheel.value;
              writeField(inkKey, wheel.value);
              paintDot(wheel.value);
            });
          }
          if (hex) {
            hex.addEventListener('input', () => {
              const v = hex.value.trim();
              // Only commit a complete colour, so typing "#C9" doesn't blank it.
              if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v)) {
                if (wheel) wheel.value = v;
                writeField(inkKey, v); paintDot(v);
              } else if (v === '') { writeField(inkKey, ''); paintDot(''); }
            });
          }
        });

        // Rich fields commit their cleaned HTML through the same path as
        // every other control, so nothing special happens on save.
        sheet.querySelectorAll('[data-rich-field]').forEach((box) => {
          const key = box.dataset.richField;
          const commitRich = () => commit({ [key]: richValue(box.innerHTML) });

          box.addEventListener('input', () => {
            const sectionNode = [...document.querySelectorAll('#app [data-sec]')].find(node => node.dataset.sec === sectionId);
            const visible = [...(sectionNode?.querySelectorAll('[data-edit]') || [])].find(node => node.dataset.edit === key);
            if (visible) visible.innerHTML = rich(richValue(box.innerHTML));
          });

          box.addEventListener('input', commitRich);
          box.addEventListener('blur', commitRich);

          box.addEventListener('keydown', (e) => {
            if (!(e.metaKey || e.ctrlKey)) {
              // A single-line field should not take a paragraph break.
              if (e.key === 'Enter' && box.getAttribute('aria-multiline') !== 'true') e.preventDefault();
              return;
            }
            const k = e.key.toLowerCase();
            if (k !== 'b' && k !== 'i') return;
            e.preventDefault();
            document.execCommand(k === 'b' ? 'bold' : 'italic');
            commitRich();
          });

          // Paste arrives as plain text: formatting comes from the buttons,
          // not from whatever was on the clipboard.
          box.addEventListener('paste', (e) => {
            e.preventDefault();
            const text = (e.clipboardData || window.clipboardData).getData('text/plain');
            document.execCommand('insertText', false, text);
          });

          const bar = box.previousElementSibling;
          if (bar) {
            bar.querySelectorAll('[data-rich]').forEach((b) => {
              // mousedown, not click: the selection is still live.
              b.addEventListener('mousedown', (e) => {
                e.preventDefault();
                box.focus();
                const act = b.dataset.rich;
                if (act === 'clear') document.execCommand('removeFormat');
                else document.execCommand(act);
                commitRich();
              });
            });
          }
        });

        sheet.querySelectorAll('[data-media]').forEach((btn) => {
          btn.onclick = () => {
            const key = btn.dataset.media;
            const [base, idx] = key.split(':');
            const current = idx === undefined
              ? layout.getSection(pageId, sectionId)[base]
              : (layout.getSection(pageId, sectionId)[base] || [])[Number(idx)];
            const fieldDef = def.fields.find((x) => x.key === base) || {};
            openMediaEditor(current, async (next) => {
              const fresh = layout.getSection(pageId, sectionId);
              if (idx === undefined) await commit({ [base]: next }, { rebuild: true });
              else {
                const list = [...(fresh[base] || [])];
                list[Number(idx)] = next;
                await commit({ [base]: list });
              }
              refreshPanel();
              render();
            }, { role: fieldDef.role || '', size: fieldDef.size || '' });
          };
        });

        sheet.querySelectorAll('[data-rmmedia]').forEach((btn) => {
          btn.onclick = async () => {
            const [base, idx] = btn.dataset.rmmedia.split(':');
            const fresh = layout.getSection(pageId, sectionId);
            const list = [...(fresh[base] || [])];
            list.splice(Number(idx), 1);
            await commit({ [base]: list });
            refreshPanel();
            render();
          };
        });

        sheet.querySelectorAll('[data-addmedia]').forEach((btn) => {
          btn.onclick = async () => {
            const base = btn.dataset.addmedia;
            const fresh = layout.getSection(pageId, sectionId);
            await commit({ [base]: [...(fresh[base] || []), media({})] });
            refreshPanel();
            render();
          };
        });
      }

      bind();
    },
  };
  if (mountIn) {
    mountIn.innerHTML = build();
    mountIn.querySelectorAll('[data-close]').forEach((el) => el.remove());
    editor.onMount(mountIn);
    return;
  }
  openSheet(build(), editor);
}

/* ------------------------------------------------------ media editor ---- */

export function openMediaEditor(value, onSave, { role = '', size = '' } = {}) {
  const m = media(value || {});
  const library = assets.list();
  // Each picture role has different rendering capabilities. In particular,
  // curtain and edge trim use only the chosen asset; transform sliders there
  // were misleading because they could never change the displayed artwork.
  const isBackdrop = role === 'backdrop';
  const isTrim = role === 'trim';
  const isCurtain = role === 'curtain';
  const isEdgeArtwork = isTrim || isCurtain;
  const isInset = !isBackdrop && !isEdgeArtwork;

  const num = (key, label, min, max, step) => `
    <div class="token-row">
      <label>${esc(label)} <span class="token-value" data-out="${attr(key)}">${esc(m[key])}</span></label>
      <span class="token-control">
        <input type="range" data-m="${attr(key)}" min="${min}" max="${max}" step="${step}" value="${attr(m[key])}">
      </span>
    </div>`;

  openSheet(`
    <h2>${isCurtain ? 'Curtain artwork' : isTrim ? 'Edge artwork' : isBackdrop ? 'Section background' : 'Picture'}</h2>
    ${size ? `<p class="hint" style="margin-top:-.3rem">This slot looks best at <b>${esc(size)}</b>.
      Bigger is fine — it is scaled down when you add it to the library.</p>` : ''}

    <label class="canvas-upload-choice">＋ Upload a new picture
      <input type="file" data-media-upload accept="image/*" class="visually-hidden"></label>
    <div class="asset-picker">
      <button class="asset-opt${!m.assetId ? ' is-on' : ''}" type="button" data-pick="">
        <span class="asset-opt-thumb asset-opt-none">none</span></button>
      ${library.map((a) => `<button class="asset-opt${m.assetId === a.id ? ' is-on' : ''}" type="button" data-pick="${attr(a.id)}">
        <span class="asset-opt-thumb"><img src="${attr(a.dataUrl)}" alt=""></span>
        <span class="asset-opt-name">${esc(a.name)}</span></button>`).join('')}
    </div>
    ${library.length ? '' : '<p class="hint">No pictures saved yet. Upload one above to use it here.</p>'}

    ${isEdgeArtwork ? `<p class="hint" style="margin-top:1rem">
      Choose your ${isCurtain ? 'curtain' : 'edge decoration'} here. To change where it hangs
      or how much of the section it covers, use this section’s Artwork settings.
      A transparent PNG works best.</p>` : ''}

    ${isInset ? `<div class="field" style="margin-top:1.1rem">
      <label for="m-frame">Frame</label>
      <select id="m-frame" data-m="frame">
        ${FRAMES.map(([v, l]) => `<option value="${attr(v)}" ${v === m.frame ? 'selected' : ''}>${esc(l)}</option>`).join('')}
      </select>
    </div>
    <div class="grid-2">
      <div class="field"><label for="m-ratio">Shape</label>
        <select id="m-ratio" data-m="ratio">
          ${RATIOS.map(([v, l]) => `<option value="${attr(v)}" ${v === m.ratio ? 'selected' : ''}>${esc(l)}</option>`).join('')}
        </select></div>
      <div class="field"><label for="m-fit">Crop</label>
        <select id="m-fit" data-m="fit">
          <option value="cover" ${m.fit === 'cover' ? 'selected' : ''}>Fill the shape</option>
          <option value="contain" ${m.fit === 'contain' ? 'selected' : ''}>Fit whole picture</option>
        </select></div>
    </div>
    <p class="field-label" style="margin-top:.9rem">Size and visibility</p>
      ${num('width', 'Width (% of slot)', 10, 100, 1)}
      ${num('opacity', 'Opacity', 0.1, 1, 0.05)}
    ` : ''}
    ${isBackdrop ? `
      <p class="hint" style="margin-top:1rem">This image fills the whole section.</p>
      ${num('opacity', 'Background strength', 0.1, 1, 0.05)}
    ` : ''}

    ${!isEdgeArtwork ? `<details class="picture-advanced">
      <summary>More adjustments <span>Optional</span></summary>
      <div class="picture-advanced-body">
        <p class="field-label">${isBackdrop ? 'Crop position' : 'Focal point when cropped'}</p>
        ${num('focalX', 'Horizontal', 0, 100, 1)}
        ${num('focalY', 'Vertical', 0, 100, 1)}
        ${isInset ? `
          <p class="field-label" style="margin-top:1rem">Fine-tune placement</p>
          ${num('rotate', 'Tilt', -20, 20, 1)}
          ${num('x', 'Move left / right', -50, 50, 1)}
          ${num('y', 'Move up / down', -50, 50, 1)}
          ${num('z', 'Layer order', 1, 9, 1)}
          <div class="field" style="margin-top:.8rem">
      <label for="m-tape">Tape</label>
      <select id="m-tape" data-m="tape">
        ${TAPES.map(([v, l]) => `<option value="${attr(v)}" ${v === m.tape ? 'selected' : ''}>${esc(l)}</option>`).join('')}
      </select>
    </div>
    <label class="switch-row"><input type="checkbox" data-m="shadow" ${m.shadow ? 'checked' : ''}>
      <span class="switch-text">Drop shadow</span></label>
    <label class="switch-row"><input type="checkbox" data-m="hideOnMobile" ${m.hideOnMobile ? 'checked' : ''}>
      <span class="switch-text">Hide on phones<em>Useful for decorative layers that crowd a small screen.</em></span></label>
    <div class="field" style="margin-top:.8rem">
      <label for="m-cap">Caption</label>
      <input type="text" id="m-cap" data-m="caption" value="${attr(m.caption || '')}">
    </div>` : ''}
      </div>
    </details>` : ''}

    <div class="btn-row" style="margin-top:1rem">
      <button class="btn grow" type="button" data-close>Cancel</button>
      <button class="btn btn-primary grow" type="button" data-act="save">Save picture</button>
    </div>
  `, {
    onMount(sheet, close) {
      const draft = { ...m };

      sheet.querySelector('[data-media-upload]').onchange = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
          const asset = await assets.add(file, { kind: isTrim || role === 'curtain' ? 'cutout' : 'photo' });
          draft.assetId = asset.id;
          const button = document.createElement('button');
          button.type = 'button';
          button.className = 'asset-opt is-on';
          button.dataset.pick = asset.id;
          const thumb = document.createElement('span');
          thumb.className = 'asset-opt-thumb';
          const image = document.createElement('img');
          image.src = asset.dataUrl;
          image.alt = asset.name;
          thumb.appendChild(image);
          const name = document.createElement('span');
          name.className = 'asset-opt-name';
          name.textContent = asset.name;
          button.append(thumb, name);
          sheet.querySelectorAll('[data-pick]').forEach((b) => b.classList.remove('is-on'));
          sheet.querySelector('.asset-picker').appendChild(button);
          button.onclick = () => {
            draft.assetId = asset.id;
            sheet.querySelectorAll('[data-pick]').forEach((b) => b.classList.toggle('is-on', b === button));
          };
          toast('Picture uploaded. Choose Save picture to place it.', 'good');
        } catch (err) { toast(err.message || 'Could not upload that picture.', 'bad'); }
      };

      sheet.querySelectorAll('[data-pick]').forEach((btn) => {
        btn.onclick = () => {
          draft.assetId = btn.dataset.pick || null;
          sheet.querySelectorAll('[data-pick]').forEach((b) => b.classList.toggle('is-on', b === btn));
        };
      });

      sheet.querySelectorAll('[data-m]').forEach((el) => {
        const key = el.dataset.m;
        el.addEventListener('input', () => {
          if (el.type === 'checkbox') draft[key] = el.checked;
          else if (el.type === 'range') {
            draft[key] = Number(el.value);
            const out = sheet.querySelector(`[data-out="${key}"]`);
            if (out) out.textContent = el.value;
          } else draft[key] = el.value;
        });
      });

      sheet.querySelector('[data-act="save"]').onclick = async () => {
        // Save before closing: closing returns to the panel underneath and
        // rebuilds it, so committing afterwards would rebuild from stale data
        // and the picture would look as though it had not been placed.
        await onSave(draft);
        close();
        toast('Picture placed.', 'good', 1600);
      };
    },
  });
}
