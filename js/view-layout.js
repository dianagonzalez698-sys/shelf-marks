// The layout editor: add, reorder, hide and configure the editorial sections
// that make up each page — and place a picture into any slot.

import * as layout from './layout.js';
import { SECTION_TYPES, typeList, FONT_CHOICES, TYPE_ROLES, TONE_SWATCHES, applySectionVars, renderSection } from './sections.js?v=131';
import { media, FRAMES, RATIOS, TAPES, MEDIA_DEFAULTS } from './media.js';
import * as assets from './assets.js';
import { allChallenges, state, allWords } from './state.js';
import { fontWeights, fontHasItalic, getToken, setToken } from './theme.js';
import { esc, attr, toast, openSheet, confirmSheet, navigate, render, rich, richValue } from './ui.js';
import { studioNav } from './studio-nav.js';

/* ------------------------------------------------------------- pages ---- */

function pageOptions() {
  const pages = [
    ['home', 'The journal (home)'],
    ['directory', 'Challenge index'],
    ['books', 'My Books'],
    ['notebook', 'The Notebook'],
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
  const isNotebook = pageId === 'notebook';

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
      <div class="ed sp-tight form-wrap layout-studio-page">
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
          <button class="btn" type="button" id="lay-save">Save layout</button>
          <a class="btn" href="#/${pageId === 'directory' ? 'challenges' : pageId === 'notebook' ? 'notebook' : pageId === 'books' ? 'books' : pageId === 'bookmarks' ? 'bookmarks' : pageId.startsWith('word:') ? `word/${encodeURIComponent(pageId.slice(5))}` : pageId.startsWith('challenge:') ? `challenge/${encodeURIComponent(pageId.slice(10))}` : ''}">View page</a>
          ${custom ? '<button class="btn btn-danger" type="button" id="lay-reset">Reset page</button>' : ''}
        </div>

        <div class="lay-type-size-control">
          <label for="lay-type-size">Text size for the section list</label>
          <input type="range" id="lay-type-size" min="16" max="30" step="1" value="${Math.round(parseFloat(getToken('--fs-layout-list')) || 20)}" aria-describedby="lay-type-size-hint">
          <output for="lay-type-size" id="lay-type-size-value">${Math.round(parseFloat(getToken('--fs-layout-list')) || 20)}px</output>
          <p id="lay-type-size-hint">Changes section names, descriptions, and small action labels below.</p>
        </div>

        ${sections.some((x) => x.visible === false)
          ? `<p class="notice" style="margin-bottom:1rem"><strong>Some sections are hidden.</strong>
              Anything inside a hidden section — pictures included — won't appear on the page.
              Switch it back to <b>Shown</b> to bring it back.</p>`
          : ''}

        ${isNotebook ? `<div class="lay-built-in-sections" aria-label="Notebook built-in sections">
          <div class="lay-built-in-row"><div><strong>Notebook introduction</strong><p>Heading, description and Write a Note action</p></div><span>Built in</span></div>
          <div class="lay-built-in-row"><div><strong>Entry archive</strong><p>Your saved notes and their cards</p></div><span>Built in</span></div>
          <p class="hint">These are the Notebook's built-in areas. Additional sections can be arranged below them.</p>
        </div>` : ''}
        ${sections.length
          ? `<ol class="lay-list">${rows}</ol>`
          : `<div class="empty"><h3>${isNotebook ? 'No extra sections added' : 'Nothing on this page yet'}</h3>
              <p>${isNotebook ? 'The Notebook above is already in place. Add an editorial section if you want more content beneath its archive.' : 'Add a section to begin composing it.'}</p></div>`}

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
      root.querySelector('#lay-save').onclick = async () => {
        try {
          await layout.save(pageId, layout.get(pageId));
          toast('Layout saved.', 'good');
          render();
        } catch (_) { toast('Could not save layout.', 'bad'); }
      };
      const listSizeControl = root.querySelector('#lay-type-size');
      listSizeControl?.addEventListener('input', (event) => {
        const size = Number(event.target.value);
        document.documentElement.style.setProperty('--fs-layout-list', size + 'px');
        root.querySelector('#lay-type-size-value').textContent = size + 'px';
      });
      listSizeControl?.addEventListener('change', (event) => {
        setToken('--fs-layout-list', event.target.value + 'px');
      });

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
    ${r.size ? `<div class="type-quick-size">
      <label>Size <output data-quick-output="${attr(r.size)}">${cur(r.size) ? Math.round(Number(cur(r.size)) * 100) : 100}%</output></label>
      <input type="range" min="70" max="200" step="5" value="${cur(r.size) ? Math.round(Number(cur(r.size)) * 100) : 100}" data-quick-size="${attr(r.size)}">
    </div>` : ''}
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
        ${chip(r.italic, 'normal', 'Normal', !ital)}
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
    out.push('Pick a curtain image to see it on your page.');
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
      if (EDITING?.type === 'challengeHero') {
        const cur = (key) => key ? String(sec_ink(secId, key) || '') : '';
        const field = (key, label, options) => key ? `<label class="banner-type-field">${esc(label)}<select data-field="${attr(key)}">${options.map(([v, t]) => `<option value="${attr(v)}" ${cur(key) === String(v) ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></label>` : '';
        const weightOptions = [['', 'Match site'], ['300', 'Light'], ['400', 'Regular'], ['500', 'Medium'], ['600', 'Semibold'], ['700', 'Bold']];
        return `<div class="banner-type-controls">
          <h3>${esc(f.label)}</h3>
          <label class="banner-type-field">Font
            <select data-field="${attr(f.key)}">${FONT_CHOICES.map((opt) => `<option value="${attr(opt.value)}" ${face === opt.value ? 'selected' : ''}>${esc(opt.label)}</option>`).join('')}</select>
          </label>
          <div class="banner-type-pair">
            <label class="banner-type-field">HEX text color
              <input class="banner-hex-input" type="text" data-field="${attr(f.inkKey)}" value="${attr(ink)}" placeholder="#E0B35A" maxlength="7" spellcheck="false">
            </label>
            <label class="banner-type-field banner-color-field">Color picker
              <input type="color" data-banner-wheel="${attr(f.inkKey)}" value="${attr(/^#[0-9a-f]{6}$/i.test(ink) ? ink : '#E0B35A')}">
            </label>
          </div>
          <div class="banner-type-pair">
            ${field(r.weight, 'Weight', weightOptions)}
            ${field(r.italic, 'Style', [['', 'Match site'], ['normal', 'Regular'], ['italic', 'Italic']])}
          </div>
          ${r.size ? `<label class="banner-type-field">Size <span data-banner-size-out="${attr(r.size)}">${Math.round((Number(cur(r.size)) || 1) * 100)}%</span>
            <input type="range" data-field="${attr(r.size)}" min=".5" max="2.5" step=".05" value="${attr(cur(r.size) || '1')}">
          </label>` : ''}
          ${r.track ? `<label class="banner-type-field">Letter spacing
            <input type="text" data-field="${attr(r.track)}" value="${attr(cur(r.track))}" placeholder="Match site (or 0.05em)">
          </label>` : ''}
          ${field(r.transform, 'Capitalization', [['', 'Match site'], ['none', 'As typed'], ['uppercase', 'UPPERCASE'], ['capitalize', 'Title Case']])}
        </div>`;
      }
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
    case 'challengeSelect': {
      const all = allChallenges();
      const chosen = Array.isArray(value)
        ? value.map(String).filter(id => all.some(c => String(c.id) === id)).slice(0, 5)
        : all.slice(0, Math.min(5, Number(EDITING?.limit) > 0 ? Number(EDITING.limit) : 5)).map(c => String(c.id));
      const rows = all.map(c => {
        const index = chosen.indexOf(String(c.id));
        return `<label class="challenge-pick-row">
          <input type="checkbox" data-challenge-choice="${attr(c.id)}" ${index >= 0 ? 'checked' : ''}>
          <span class="challenge-pick-name">${esc(c.name)}</span>
          ${index >= 0 ? `<span class="challenge-pick-rank">${index + 1}</span>` : ''}
        </label>`;
      }).join('');
      return `<div class="field challenge-picker">
        <span class="field-label">Challenges in this section</span>
        <p class="hint">Choose up to 5. Select them in the order you want them displayed. Add another Challenge collection section to show more elsewhere on the homepage.</p>
        <div class="challenge-pick-count">${chosen.length} of 5 chosen</div>
        <div class="challenge-pick-list">${rows || '<p class="hint">No challenges yet. Create one from the Challenges page.</p>'}</div>
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
    case 'range': {
      const rangeValue = value ?? (f.key === 'descriptionSize' ? 20 : f.key === 'curtainOffset' ? 0 : f.min);
      return `<div class="field"><label for="${id}">${esc(f.label)} <span class="token-value" data-readout>${esc(rangeValue)}</span></label>
        <input type="range" id="${id}" data-field="${attr(f.key)}" min="${f.min}" max="${f.max}" step="${f.step}" value="${attr(rangeValue)}"></div>`;
    }
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
        <input type="text" id="${id}" data-field="${attr(f.key)}" value="${attr(value || '')}" placeholder="${attr(f.hint || '')}">
        ${f.hint ? `<p class="hint">${esc(f.hint)}</p>` : ''}</div>`;
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
  'curtainArt', 'curtainWhere', 'curtainDrop', 'curtainLift', 'curtainGap',
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

function fieldsHtml(def, sec, mode = 'all', pageId = '') {
  EDITING = sec;
  refreshInkSwatches();
  if (mode !== 'all') {
    const all = def.fields.filter((f) =>
      (typeof f.when !== 'function' || f.when(sec))
      && !(sec.type === 'challenges' && pageId === 'home' && f.key === 'limit')
      && !(sec.type === 'challenges' && pageId !== 'home' && f.key === 'challengeIds'));
    const content = (f) => ['rich', 'textarea', 'text'].includes(f.type)
      || (!f.type && /title|heading|subtitle|body|text|kicker|label|intro|caption|note|eyebrow|description/i.test(f.key));
    // The section editor is for the handful of decisions made repeatedly.
    // Existing values for all other fields remain in the saved data; they are
    // simply no longer surfaced as an intimidating grid of switches.
    const contentEssentials = new Set(['limit', 'layout', 'mode', 'columns', 'descriptionSize', 'challengeIds']);
    const styleEssentials = new Set(['shape', 'tone', 'fontDisplay', 'fontBody', 'fontUi', 'fontScript']);
    const artworkEssentials = new Set([
      'bgImage', 'backdrop', 'picture', 'inset', 'items', 'strip',
      'edge', 'edgeArt', 'edgeWhere', 'edgeSize',
      'curtainArt', 'curtainWhere', 'curtainOffset',
    ]);
    const chosen = all.filter((f) => mode === 'content'
      ? (sec.type === 'challengeHero' ? (f.type === 'typeface' || ['eyebrowText', 'titleText', 'subtitleText'].includes(f.key))
        : sec.type === 'interlude' && f.key === 'mode' ? false : content(f) || contentEssentials.has(f.key))
      : mode === 'style' ? (sec.type === 'challengeHero'
        ? ['shape', 'tone', 'height', 'align', 'scrim', 'showWindow', 'showBlurb'].includes(f.key)
        : styleEssentials.has(f.key))
      : mode === 'artwork' ? artworkEssentials.has(f.key) || (sec.type === 'interlude' && f.key === 'mode')
      : false);
    if (!chosen.length && mode !== 'artwork') return `<p class="canvas-panel-hint">${mode === 'content' ? 'This section draws its words from your reading records, so there is no text to rewrite here.' : mode === 'style' ? 'This section uses the journal’s shared visual style.' : 'No additional options for this section.'}</p>`;
    const draw = (f) => {
      const label = sec.type === 'interlude' && f.key === 'strip' ? 'Main picture'
        : sec.type === 'interlude' && f.key === 'bgImage' ? 'Background picture (optional)' : f.label;
      // A rich-text field should have one editor, not a second textarea with
      // duplicate styling controls. Reuse the click-to-edit inspector whenever
      // the field is visibly editable on the page.
      const liveNode = [...document.querySelectorAll('#app [data-sec]')]
        .find((node) => node.dataset.sec === sec.id);
      if (mode === 'content' && f.type === 'rich'
          && liveNode?.querySelector('[data-edit="' + f.key + '"]')) {
        return `<div class="field canvas-edit-text-shortcut">
          <span class="canvas-field-label">${esc(label)}</span>
          <button type="button" class="btn" data-edit-text-key="${attr(f.key)}">
            Edit text &amp; typography
          </button>
        </div>`;
      }
      const control = fieldControl(label === f.label ? f : { ...f, label }, sec[f.key], sec.id, { inlineStyle: false });
      // Picture frames live directly beside the main image, not two screens deep.
      // No media record changes until the user actually chooses another frame.
      if (mode === 'artwork' && sec.type === 'interlude' && f.key === 'strip') {
        const current = media(sec.strip || {});
        const currentFrame = current.frameAssetId ? 'custom:' + current.frameAssetId : (current.frame || 'none');
        const customFrames = assets.list({ kind: 'cutout' })
          .filter(a => a.hasAlpha !== false && (a.dataUrl || '').startsWith('data:image/png'));
        if (current.frameAssetId && !customFrames.some(a => a.id === current.frameAssetId)) {
          const existing = assets.get(current.frameAssetId);
          if (existing) customFrames.unshift(existing);
        }
        return control + `<div class="field canvas-quick-frame">
          <label for="section-quick-frame">Picture frame</label>
          <select id="section-quick-frame" data-frame-choice aria-label="Choose picture frame">
            ${FRAMES.map(([key, name]) => `<option value="${attr(key)}" ${currentFrame === key ? 'selected' : ''}>${esc(name)}</option>`).join('')}
            ${customFrames.map(a => `<option value="custom:${attr(a.id)}" ${currentFrame === 'custom:' + a.id ? 'selected' : ''}>${esc(a.name)} · uploaded PNG</option>`).join('')}
          </select>
          <label class="canvas-frame-upload">＋ Add transparent PNG frame
            <input type="file" data-frame-upload accept="image/png,.png" class="visually-hidden">
          </label>
          <p class="hint">Changes only this picture's frame. The painting stays in place.</p>
        </div>`;
      }
      return control;
    };
    if (mode === 'content' && sec.type === 'challengeHero') return '<p class="canvas-panel-hint">The words follow this challenge’s name and description. Customize each line’s font, size, weight, italic style, spacing, and color below.</p>' + chosen.map(draw).join('');
    if (mode === 'style') {
      const appearance = chosen.filter((f) => f.type !== 'typeface');
      const inlineRoles = new Set(all.filter((f) => f.type === 'rich' && f.styleRole)
        .filter((f) => [...document.querySelectorAll('#app [data-sec]')]
          .find((node) => node.dataset.sec === sec.id)?.querySelector('[data-edit="' + f.key + '"]'))
        .map((f) => f.styleRole));
      const typography = chosen.filter((f) => f.type === 'typeface' && !inlineRoles.has(f.role?.role));
      return `${appearance.length ? '<p class="canvas-field-group">Background</p>' + appearance.map(draw).join('') : ''}
        ${typography.length ? '<p class="canvas-field-group">Fonts & text colors</p>' + typography.map(draw).join('') : ''}`;
    }
    if (mode === 'artwork') return `${sec.type === 'interlude' ? '<p class="canvas-panel-hint">This is the decorative section between two parts of your page. Choose <strong>My picture</strong> to show your own artwork. Use <strong>Main picture</strong> to change it. The optional background is a separate image behind it.</p>' : ''}${sec.edge && sec.edge !== 'none' ? `<p class="canvas-panel-hint canvas-edge-help">${sec.edge === 'curtain' ? 'Place the curtain at the top or bottom.' : sec.edge === 'artwork' ? 'Choose which edge gets your artwork.' : 'This shapes the bottom edge.'}</p>` : ''}
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
      <span class="media-label">${esc(a ? a.name : 'Choose image')}</span>
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
    ${mountIn ? '' : `<p class="small muted">${esc(def.blurb)}</p>`}
    <div id="sec-warnings">${warningsHtml(fresh)}</div>
    ${mountIn ? `<div class="canvas-inspector-tabs" role="group" aria-label="Section settings">
      <button type="button" data-inspector-tab="content" class="${editingTab === 'content' ? 'active' : ''}">Text</button>
      <button type="button" data-inspector-tab="style" class="${editingTab === 'style' ? 'active' : ''}">Look</button>
      <button type="button" data-inspector-tab="artwork" class="${editingTab === 'artwork' ? 'active' : ''}">Images</button>
    </div>` : ''}
    <div id="sec-fields" style="margin-top:1rem">${fieldsHtml(def, fresh, editingTab, pageId)}</div>
    ${mountIn ? '' : `<div class="btn-row" style="margin-top:1rem"><button class="btn btn-block" type="button" data-close>Done</button></div>`}`;
  };

  const editor = {
    reopen: build,
    onMount(sheet) {
      // Text shortcuts switch to the one rich-text inspector. The sidebar
      // remains mounted and the original section persists unchanged.
      sheet.addEventListener('click', (event) => {
        const edit = event.target.closest('[data-edit-text-key]');
        if (!edit) return;
        event.preventDefault();
        document.dispatchEvent(new CustomEvent('canvas:inspect-text', {
          detail: { sectionId, key: edit.dataset.editTextKey },
        }));
      });
      const warnBox = sheet.querySelector('#sec-warnings');
      const fieldBox = sheet.querySelector('#sec-fields');

      sheet.querySelectorAll('[data-inspector-tab]').forEach((button) => {
        button.onclick = () => {
          editingTab = button.dataset.inspectorTab;
          sheet.querySelectorAll('[data-inspector-tab]').forEach((tab) => tab.classList.toggle('active', tab === button));
          fieldBox.innerHTML = fieldsHtml(def, layout.getSection(pageId, sectionId), editingTab, pageId);
          bind();
        };
      });

      const refreshPanel = () => {
        const fresh = layout.getSection(pageId, sectionId);
        if (warnBox) warnBox.innerHTML = warningsHtml(fresh);
        if (fieldBox) {
          fieldBox.innerHTML = fieldsHtml(def, fresh, editingTab, pageId);
          bind();
        }
      };

      const commit = async (patch, { rebuild = false } = {}) => {
        await layout.updateSection(pageId, sectionId, patch);
        const fresh = layout.getSection(pageId, sectionId);
        // Apply section typography and colours to the visible canvas immediately.
        // Saving the underlying record alone does not repaint this page.
        const previewNode = [...document.querySelectorAll('#app [data-sec]')].find((node) => node.dataset.sec === sectionId);
        if (previewNode) {
          applySectionVars(previewNode, fresh);
          // The challenge index's description-size slider updates the live
          // preview without replacing the section or closing its inspector.
          if (fresh.type === 'challenges' && 'descriptionSize' in patch) {
            const spreads = previewNode.querySelector('.spreads');
            if (spreads) {
              const px = Math.max(14, Math.min(30, Number(fresh.descriptionSize) || 20));
              spreads.style.setProperty('--challenge-description-size', px + 'px');
            }
          }
        }
        if (previewNode && fresh.type === 'interlude' && ('mode' in patch)) {
          const template = document.createElement('template');
          template.innerHTML = renderSection(fresh).trim();
          const updated = template.content.firstElementChild;
          if (updated) {
            if (previewNode.classList.contains('canvas-section-selected')) updated.classList.add('canvas-section-selected');
            previewNode.replaceWith(updated);
          }
        }
        if (warnBox) warnBox.innerHTML = warningsHtml(fresh);
        // A control that decides which other controls apply redraws the panel,
        // so the sheet never shows settings that cannot do anything.
        if (rebuild && fieldBox) {
          fieldBox.innerHTML = fieldsHtml(def, fresh, editingTab, pageId);
          bind();
        }
      };

      function bind() {
        const framePicker = sheet.querySelector('[data-frame-choice]');
        const setFrame = async (value) => {
          const current = layout.getSection(pageId, sectionId);
          if (!current || current.type !== 'interlude') return;
          const frameAssetId = value.startsWith('custom:') ? value.slice(7) : null;
          const next = { ...media(current.strip || {}), ...(frameAssetId ? { frameAssetId } : { frame: value, frameAssetId: null }) };
          await commit({ strip: next });
          refreshPanel();
          render();
        };
        if (framePicker) framePicker.onchange = async () => {
          try { await setFrame(framePicker.value); }
          catch (err) { toast('Could not change the frame.', 'bad'); refreshPanel(); }
        };
        const frameUpload = sheet.querySelector('[data-frame-upload]');
        if (frameUpload) frameUpload.onchange = async () => {
          const file = frameUpload.files?.[0];
          if (!file) return;
          if (file.type !== 'image/png' && !/\.png$/i.test(file.name)) {
            toast('Please choose a transparent PNG frame.', 'bad');
            frameUpload.value = '';
            return;
          }
          try {
            const asset = await assets.add(file, { kind: 'cutout' });
            if (!asset.hasAlpha) {
              await assets.remove(asset.id);
              toast('This PNG has no transparency. Please use a frame with a clear center.', 'bad');
              return;
            }
            await setFrame('custom:' + asset.id);
            toast('New frame added. Your picture is unchanged.', 'good');
          } catch (err) {
            toast('Could not add the PNG frame.', 'bad');
            refreshPanel();
          }
        };
        const picker = sheet.querySelector('.challenge-picker');
        if (picker && pageId === 'home') {
          picker.querySelectorAll('[data-challenge-choice]').forEach(input => {
            input.onchange = async () => {
              const current = layout.getSection(pageId, sectionId);
              const available = allChallenges();
              const selected = Array.isArray(current.challengeIds)
                ? current.challengeIds.map(String)
                : available.slice(0, Math.min(5, Number(current.limit) > 0 ? Number(current.limit) : 5)).map(c => String(c.id));
              const id = String(input.dataset.challengeChoice);
              const next = input.checked
                ? (selected.includes(id) ? selected : [...selected, id])
                : selected.filter(x => x !== id);
              if (next.length > 5) {
                input.checked = false;
                toast('Each section can display up to five challenges. Add another section for more.', 'bad');
                return;
              }
              await commit({ challengeIds: next });
              const live = [...document.querySelectorAll('#app [data-sec]')]
                .find(node => node.dataset.sec === sectionId);
              if (live) {
                const holder = document.createElement('template');
                holder.innerHTML = renderSection({ ...layout.getSection(pageId, sectionId), pageContext: 'home' }).trim();
                const replacement = holder.content.firstElementChild;
                if (replacement) {
                  if (live.classList.contains('canvas-section-selected')) replacement.classList.add('canvas-section-selected');
                  live.replaceWith(replacement);
                }
              }
              refreshPanel();
            };
          });
        }

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
              const out = el.closest('.field')?.querySelector('[data-readout]');
              if (out) out.textContent = v;
              const sizeOut = sheet.querySelector(`[data-banner-size-out="${key}"]`);
              if (sizeOut) sizeOut.textContent = Math.round(v * 100) + '%';
            } else v = el.value;
            if (el.classList.contains('banner-hex-input')) {
              const value = String(v).trim();
              if (value && !/^#[0-9a-f]{6}$/i.test(value)) return;
              const wheel = sheet.querySelector(`[data-banner-wheel="${key}"]`);
              if (wheel && value) wheel.value = value;
            }
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
            if (key === 'curtainOffset') {
              const sectionNode = [...document.querySelectorAll('#app [data-sec]')].find(node => node.dataset.sec === sectionId);
              if (sectionNode) sectionNode.style.setProperty('--cur-offset', `${v}px`);
            }
            if (key === 'shape') {
              const sectionNode = [...document.querySelectorAll('#app [data-sec]')].find(node => node.dataset.sec === sectionId);
              if (sectionNode) sectionNode.classList.toggle('shape-arch', v === 'arch');
            }
            // Keep the actual journal page in step with the text box without
            // replacing the entire section (which would disrupt the editor).
            if (['text', 'textarea', 'rich'].includes(fieldDef.type)) {
              const sectionNode = [...document.querySelectorAll('#app [data-sec]')].find(node => node.dataset.sec === sectionId);
              const previewKey = key === 'eyebrow' ? 'kicker' : key;
              const visible = [...(sectionNode?.querySelectorAll('[data-edit]') || [])].find(node => node.dataset.edit === previewKey);
              if (visible) visible.innerHTML = rich(v);
            }
            if (fieldDef.type === 'font') el.style.fontFamily = v || 'inherit';
            await commit({ [key]: v }, { rebuild: !!fieldDef.controls });
          });
        });

        sheet.querySelectorAll('[data-banner-wheel]').forEach((wheel) => {
          wheel.addEventListener('input', () => {
            const textInput = [...sheet.querySelectorAll('.banner-hex-input')].find((el) => el.dataset.field === wheel.dataset.bannerWheel);
            if (!textInput) return;
            textInput.value = wheel.value.toUpperCase();
            textInput.dispatchEvent(new Event('input', { bubbles: true }));
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

          const quickSize = row.querySelector('[data-quick-size]');
          if (quickSize) {
            quickSize.addEventListener('input', () => {
              const percent = Number(quickSize.value);
              row.querySelector('[data-quick-output]').textContent = percent + '%';
              writeField(quickSize.dataset.quickSize, String(percent / 100));
            });
          }

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
            const previewKey = key === 'eyebrow' ? 'kicker' : key;
            const visible = [...(sectionNode?.querySelectorAll('[data-edit]') || [])].find(node => node.dataset.edit === previewKey);
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
            const previewSelection = (chosenId, tweaks = {}) => {
              const sectionNode = [...document.querySelectorAll('#app [data-sec]')].find((node) => node.dataset.sec === sectionId);
              if (!sectionNode) return () => {};
              const chosenUrl = assets.src(chosenId);
              // Backgrounds already have a stable visible layer. Update it in
              // place so the live preview never depends on rebuilding a section,
              // which may require reading/challenge context unavailable here.
              if (base === 'backdrop' || base === 'bgImage') {
                const layer = sectionNode.querySelector(base === 'backdrop'
                  ? '.hero .m-backdrop, .m-backdrop' : ':scope > .m-backdrop');
                if (layer) {
                  const beforeStyle = layer.getAttribute('style');
                  const beforeClass = layer.className;
                  layer.classList.toggle('m-backdrop-empty', !chosenUrl);
                  layer.style.backgroundImage = chosenUrl ? `url("${chosenUrl.replace(/"/g, '%22')}")` : 'none';
                  layer.style.backgroundPosition = `${Number(tweaks.focalX ?? 50)}% ${Number(tweaks.focalY ?? 50)}%`;
                  layer.style.opacity = String(Number(tweaks.opacity ?? 1));
                  return () => {
                    layer.className = beforeClass;
                    if (beforeStyle == null) layer.removeAttribute('style');
                    else layer.setAttribute('style', beforeStyle);
                  };
                }
              }
              // Preview through the same renderer used after saving. A section
              // without a saved curtain has no .ed-curtain node to update,
              // so changing CSS variables alone cannot display the artwork.
              if (base === 'curtainArt') {
                const currentSection = layout.getSection(pageId, sectionId);
                if (!currentSection) return () => {};
                const previewSection = {
                  ...currentSection,
                  ...tweaks,
                  edge: chosenId ? 'curtain' : 'none',
                  curtainArt: { ...media(current), assetId: chosenId },
                };
                const template = document.createElement('template');
                template.innerHTML = renderSection(previewSection).trim();
                const nextNode = template.content.firstElementChild;
                if (!nextNode) return () => {};
                if (sectionNode.classList.contains('canvas-section-selected')) {
                  nextNode.classList.add('canvas-section-selected');
                }
                sectionNode.replaceWith(nextNode);
                return () => { if (nextNode.isConnected) nextNode.replaceWith(sectionNode); };
              }
              // Prefer the existing picture slot for immediate preview without
              // rebuilding DOM or losing any section interaction handlers.
              const oldUrl = assets.src(current?.assetId);
              const figures = [...sectionNode.querySelectorAll('.m-fig')];
              const matched = figures.find((fig) => oldUrl && fig.querySelector('img')?.src === oldUrl);
              const fieldOrder = (def.fields || []).filter((field) => field.type === 'media' || field.type === 'medialist');
              const preceding = fieldOrder.slice(0, fieldOrder.findIndex((field) => field.key === base))
                .reduce((sum, field) => sum + (field.type === 'medialist'
                  ? (layout.getSection(pageId, sectionId)?.[field.key] || []).length : 1), 0);
              const figureIndex = Math.max(0, preceding) + (idx === undefined ? 0 : Number(idx));
              const target = matched || figures[figureIndex] || figures[0];
              const box = target?.querySelector('.m-box');
              if (box) {
                const originalMarkup = box.innerHTML;
                const previousStyle = target.getAttribute('style');
                if (chosenUrl) {
                  const img = document.createElement('img');
                  img.className = 'm-img';
                  img.src = chosenUrl;
                  img.alt = assets.get(chosenId)?.name || '';
                  img.style.objectFit = tweaks.fit === 'contain' ? 'contain' : 'cover';
                  img.style.objectPosition = `${Number(tweaks.focalX ?? 50)}% ${Number(tweaks.focalY ?? 50)}%`;
                  box.replaceChildren(img);
                } else box.replaceChildren();
                target.style.opacity = String(Number(tweaks.opacity ?? 1));
                return () => {
                  box.innerHTML = originalMarkup;
                  if (previousStyle == null) target.removeAttribute('style');
                  else target.setAttribute('style', previousStyle);
                };
              }
              // No existing figure (for example an ornament becoming a strip):
              // let the section renderer create the missing picture slot.
              // Render the actual section temporarily for every image choice.
              // This also shows a strip even if its previous mode was an ornament.
              const currentSection = layout.getSection(pageId, sectionId);
              if (currentSection) {
                const previewSection = { ...currentSection,
                  [base]: idx === undefined ? { ...media(current), ...tweaks, assetId: chosenId } : (currentSection[base] || []).map((item, i) => i === Number(idx) ? { ...media(item), assetId: chosenId } : item) };
                if (base === 'strip' && chosenId) previewSection.mode = 'strip';
                const template = document.createElement('template');
                template.innerHTML = renderSection(previewSection).trim();
                const nextNode = template.content.firstElementChild;
                if (nextNode) {
                  if (sectionNode.classList.contains('canvas-section-selected')) nextNode.classList.add('canvas-section-selected');
                  sectionNode.replaceWith(nextNode);
                  return () => { if (nextNode.isConnected) nextNode.replaceWith(sectionNode); };
                }
              }
              // Context-bound challenge heroes cannot be re-rendered without
              // their challenge record. Preview the existing background layer
              // directly, including before any section override is saved.
              const backdropNode = base === 'backdrop' ? sectionNode.querySelector('.hero .m-backdrop, .m-backdrop') : null;
              if (backdropNode) {
                const oldStyle = backdropNode.getAttribute('style');
                const oldClass = backdropNode.className;
                if (chosenUrl) {
                  backdropNode.classList.remove('m-backdrop-empty');
                  backdropNode.style.backgroundImage = `url("${chosenUrl.replace(/"/g, '%22')}")`;
                } else {
                  backdropNode.style.backgroundImage = 'none';
                  backdropNode.classList.add('m-backdrop-empty');
                }
                backdropNode.style.backgroundPosition = `${Number(tweaks.focalX ?? 50)}% ${Number(tweaks.focalY ?? 50)}%`;
                backdropNode.style.opacity = String(Number(tweaks.opacity ?? 1));
                return () => {
                  backdropNode.className = oldClass;
                  if (oldStyle == null) backdropNode.removeAttribute('style');
                  else backdropNode.setAttribute('style', oldStyle);
                };
              }

            };
            openMediaEditor(current, async (next, tweaks = {}) => {
              const fresh = layout.getSection(pageId, sectionId);
              if (idx === undefined) await commit({ [base]: next, ...(base === 'strip' && next.assetId ? { mode: 'strip' } : {}), ...(base === 'curtainArt' && !next.assetId ? { edge: 'none' } : {}), ...tweaks }, { rebuild: true });
              else {
                const list = [...(fresh[base] || [])];
                list[Number(idx)] = next;
                await commit({ [base]: list });
              }
              refreshPanel();
              render();
            }, { role: fieldDef.role || '', size: fieldDef.size || '', previewSelection, sectionValues: layout.getSection(pageId, sectionId) });
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

export function openMediaEditor(value, onSave, { role = '', size = '', previewSelection = null, sectionValues = {} } = {}) {
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
    <div class="simple-picker-heading"><h2>${isCurtain ? 'Curtain' : isTrim ? 'Edge decoration' : isBackdrop ? 'Background' : 'Picture'}</h2><span>Live preview</span></div>
    <p class="simple-picker-intro">${isCurtain ? 'Drag the curtain on your page or move it below.' : 'Choose artwork and see it on the page.'}</p>
    ${isCurtain ? `<div class="simple-curtain-fit">
      <div class="simple-curtain-row simple-position-main">
        <label>Move curtain <output data-curtain-out="curtainOffset">${Number(sectionValues.curtainOffset ?? 0)}</output> px</label>
        <input type="range" data-curtain="curtainOffset" min="-200" max="400" step="2" value="${Number(sectionValues.curtainOffset ?? 0)}" aria-label="Move curtain up or down">
        <div class="simple-range-ends"><span>↑ Up</span><span>Down ↓</span></div>
      </div>
      <details class="simple-fit-more">
        <summary>More curtain adjustments</summary>
        <div class="simple-curtain-row"><label>Overlap above <output data-curtain-out="curtainLift">${Number(sectionValues.curtainLift ?? 72)}</output> px</label><input type="range" data-curtain="curtainLift" min="0" max="140" step="2" value="${Number(sectionValues.curtainLift ?? 72)}"></div>
        <div class="simple-curtain-row"><label>How far it hangs <output data-curtain-out="curtainDrop">${Number(sectionValues.curtainDrop ?? 30)}</output></label><input type="range" data-curtain="curtainDrop" min="6" max="70" step="1" value="${Number(sectionValues.curtainDrop ?? 30)}"></div>
        <div class="simple-curtain-row"><label>Space below <output data-curtain-out="curtainGap">${Number(sectionValues.curtainGap ?? 0)}</output></label><input type="range" data-curtain="curtainGap" min="0" max="120" step="2" value="${Number(sectionValues.curtainGap ?? 0)}"></div>
      </details>
    </div>` : ''}
    <details class="simple-gallery" ${isCurtain && m.assetId ? '' : 'open'}>
      <summary>${isCurtain ? 'Change curtain image' : 'Choose an image'} <span>${isCurtain && m.assetId ? 'Selected image' : ''}</span></summary>
      <div class="simple-gallery-body">
        <label class="canvas-upload-choice">＋ Upload image
          <input type="file" data-media-upload accept="image/*" class="visually-hidden"></label>
        <div class="asset-picker">
          <button class="asset-opt${!m.assetId ? ' is-on' : ''}" type="button" data-pick="">
            <span class="asset-opt-thumb asset-opt-none">None</span></button>
          ${library.map((a) => `<button class="asset-opt${m.assetId === a.id ? ' is-on' : ''}" type="button" data-pick="${attr(a.id)}">
            <span class="asset-opt-thumb"><img src="${attr(a.dataUrl)}" alt=""></span>
            <span class="asset-opt-name" title="${attr(a.name)}">${esc(a.name)}</span></button>`).join('')}
        </div>
        ${library.length ? '' : '<p class="hint">No saved pictures yet. Upload one to get started.</p>'}
      </div>
    </details>
    <details class="picture-tips"><summary>Image dimensions</summary><p>${isCurtain ? 'Transparent PNG, ideally 2400 × 1000 px.' : size ? `Recommended: ${esc(size)}.` : 'Use a high-resolution image.'}</p></details>

    ${isInset ? `<div class="field" style="margin-top:1.1rem">
      <label for="m-frame">Frame</label>
      <select id="m-frame" data-m="frame">
        ${m.frameAssetId ? '<option value="custom" selected>Uploaded PNG frame</option>' : ''}
        ${FRAMES.map(([v, l]) => `<option value="${attr(v)}" ${!m.frameAssetId && v === m.frame ? 'selected' : ''}>${esc(l)}</option>`).join('')}
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

    ${m.assetId ? `<button class="btn simple-remove-image" type="button" data-act="remove-image">${isCurtain ? 'Remove curtain' : 'Remove picture'}</button>` : ''}
    <div class="btn-row simple-picker-actions">
      <button class="btn grow" type="button" data-close>Cancel</button>
      <button class="btn btn-primary grow" type="button" data-act="save">Save changes</button>
    </div>
  `, {
    onMount(sheet, close) {
      const draft = { ...m };
      const curtainTweaks = isCurtain ? {
        curtainLift: Number(sectionValues.curtainLift ?? 72),
        curtainOffset: Number(sectionValues.curtainOffset ?? 0),
        curtainDrop: Number(sectionValues.curtainDrop ?? 30),
        curtainGap: Number(sectionValues.curtainGap ?? 0),
      } : {};
      sheet.classList.add('media-live-preview', 'simple-picture-editor');
      let restorePreview = null;
      let saved = false;
      const preview = () => {
        if (restorePreview) restorePreview();
        restorePreview = previewSelection ? previewSelection(draft.assetId, { ...draft, ...curtainTweaks }) : null;
      };
      const observer = new MutationObserver(() => {
        if (sheet.isConnected) return;
        observer.disconnect();
        if (!saved && restorePreview) restorePreview();
      });
      observer.observe(document.body, { childList: true, subtree: true });

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
            preview();
          };
          preview();
          toast('Picture uploaded. Choose Save picture to place it.', 'good');
        } catch (err) { toast(err.message || 'Could not upload that picture.', 'bad'); }
      };

      sheet.querySelectorAll('[data-pick]').forEach((btn) => {
        btn.onclick = () => {
          draft.assetId = btn.dataset.pick || null;
          sheet.querySelectorAll('[data-pick]').forEach((b) => b.classList.toggle('is-on', b === btn));
          preview();
        };
      });

      sheet.querySelectorAll('[data-curtain]').forEach((control) => {
        control.addEventListener('input', () => {
          const key = control.dataset.curtain;
          curtainTweaks[key] = Number(control.value);
          const output = sheet.querySelector(`[data-curtain-out="${key}"]`);
          if (output) output.textContent = control.value;
          preview();
        });
      });

      sheet.querySelectorAll('[data-m]').forEach((el) => {
        const key = el.dataset.m;
        el.addEventListener('input', () => {
          if (el.type === 'checkbox') draft[key] = el.checked;
          else if (el.type === 'range') {
            draft[key] = Number(el.value);
            const out = sheet.querySelector(`[data-out="${key}"]`);
            if (out) out.textContent = el.value;
          } else {
            draft[key] = el.value;
            if (key === 'frame' && el.value !== 'custom') draft.frameAssetId = null;
          }
          preview();
        });
      });

      const removeImage = sheet.querySelector('[data-act="remove-image"]');
      if (removeImage) removeImage.onclick = async () => {
        if (restorePreview) restorePreview();
        restorePreview = null;
        saved = true;
        await onSave({ ...draft, assetId: null }, curtainTweaks);
        close();
        toast(isCurtain ? 'Curtain removed.' : 'Picture removed.', 'good');
      };
      sheet.querySelector('[data-act="save"]').onclick = async () => {
        // Save before closing: closing returns to the panel underneath and
        // rebuilds it, so committing afterwards would rebuild from stale data
        // and the picture would look as though it had not been placed.
        if (restorePreview) restorePreview();
        restorePreview = null;
        saved = true;
        await onSave(draft, curtainTweaks);
        close();
        toast('Picture placed.', 'good', 1600);
      };
    },
  });
}
