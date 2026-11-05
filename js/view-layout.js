// The layout editor: add, reorder, hide and configure the editorial sections
// that make up each page — and place a picture into any slot.

import * as layout from './layout.js';
import { SECTION_TYPES, typeList, FONT_CHOICES } from './sections.js';
import { media, FRAMES, RATIOS, TAPES, MEDIA_DEFAULTS } from './media.js';
import * as assets from './assets.js';
import { allChallenges, state, allWords } from './state.js';
import { esc, attr, toast, openSheet, confirmSheet, navigate, render } from './ui.js';
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
    return `<li class="lay-row${hidden ? ' is-hidden' : ''}" data-sec="${attr(sec.id)}">
      <span class="lay-order">
        <button class="icon-btn" type="button" data-move="-1" ${i === 0 ? 'disabled' : ''} aria-label="Move up">↑</button>
        <button class="icon-btn" type="button" data-move="1" ${i === sections.length - 1 ? 'disabled' : ''} aria-label="Move down">↓</button>
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
      out.push(`“${esc(a.name)}” has no see-through opening in the middle, so it `
        + 'cannot be used as a frame — there is nothing for the section to show '
        + 'through. Use a PNG of the whole curtain with the centre cut out, added '
        + 'to the library as a <b>Cutout</b>.');
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

function fieldControl(f, value, secId) {
  const id = `f-${secId}-${f.key}`;
  switch (f.type) {
    case 'textarea':
      return `<div class="field"><label for="${id}">${esc(f.label)}</label>
        <textarea id="${id}" data-field="${attr(f.key)}" rows="5">${esc(value || '')}</textarea></div>`;
    case 'bool':
      return `<label class="switch-row"><input type="checkbox" id="${id}" data-field="${attr(f.key)}" ${value ? 'checked' : ''}>
        <span class="switch-text">${esc(f.label)}</span></label>`;
    case 'typeface': {
      // Face and colour on one line. Both open a proper picker rather than a
      // native menu, because a native <option> cannot show its own typeface —
      // which is the whole point of choosing one.
      const face = String(value || '');
      const ink = String(sec_ink(secId, f.inkKey) || '');
      const name = (FONT_CHOICES.find((x) => x.value === face) || {}).label || 'Match the site';
      return `<div class="type-row">
        <span class="type-row-label">${esc(f.label)}</span>
        <div class="type-row-ctl">
          <button type="button" class="face-btn" data-face="${attr(f.key)}"
            style="font-family:${attr(face || 'inherit')}">${esc(name)}</button>
          <button type="button" class="ink-dot${ink ? '' : ' is-auto'}" data-inkopen="${attr(f.inkKey)}"
            style="--sw:${attr(ink || 'transparent')}" title="Colour"
            aria-label="${esc(f.label)} colour"></button>
        </div>
        <input type="hidden" data-field="${attr(f.key)}" value="${attr(face)}">
        <input type="hidden" data-field="${attr(f.inkKey)}" value="${attr(ink)}">
        <div class="type-pop" data-pop="face" hidden>${facePickerHtml(face)}</div>
        <div class="type-pop" data-pop="ink" hidden>${inkPickerHtml(ink, `hex-${secId}-${f.inkKey}`)}</div>
      </div>`;
    }
    case 'select':
      return `<div class="field"><label for="${id}">${esc(f.label)}</label>
        <select id="${id}" data-field="${attr(f.key)}">
          ${f.options.map(([v, l]) => `<option value="${attr(v)}" ${String(v) === String(value || '') ? 'selected' : ''}>${esc(l)}</option>`).join('')}
        </select></div>`;
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
  return def.fields.filter((f) => typeof f.when !== 'function' || f.when(sec));
}

function fieldsHtml(def, sec) {
  EDITING = sec;
  refreshInkSwatches();
  return visibleFields(def, sec).map((f) => fieldControl(f, sec[f.key], sec.id)).join('');
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

export function openSectionEditor(pageId, sectionId) {
  const sec = layout.getSection(pageId, sectionId);
  if (!sec) return;
  const def = SECTION_TYPES[sec.type];
  if (!def) return;

  // Rebuilt rather than snapshotted, so returning from the picture editor
  // shows the picture you just chose.
  const build = () => {
    const fresh = layout.getSection(pageId, sectionId) || sec;
    return `
    <h2>${esc(def.label)}</h2>
    <p class="small muted">${esc(def.blurb)}</p>
    <div id="sec-warnings">${warningsHtml(fresh)}</div>
    <div id="sec-fields" style="margin-top:1rem">${fieldsHtml(def, fresh)}</div>
    <div class="btn-row" style="margin-top:1rem">
      <button class="btn btn-block" type="button" data-close>Done</button>
    </div>`;
  };

  openSheet(build(), {
    reopen: build,
    onMount(sheet) {
      const warnBox = sheet.querySelector('#sec-warnings');
      const fieldBox = sheet.querySelector('#sec-fields');

      const refreshPanel = () => {
        const fresh = layout.getSection(pageId, sectionId);
        if (warnBox) warnBox.innerHTML = warningsHtml(fresh);
        if (fieldBox) {
          fieldBox.innerHTML = fieldsHtml(def, fresh);
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
          fieldBox.innerHTML = fieldsHtml(def, fresh);
          bind();
        }
      };

      function bind() {
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
            if (fieldDef.type === 'font') el.style.fontFamily = v || 'inherit';
            await commit({ [key]: v }, { rebuild: !!fieldDef.controls });
          });
        });

        // Both pickers write through the row's hidden field, so every control
        // still commits down the one path above.
        const writeField = (key, v) => {
          const el = sheet.querySelector(`[data-field="${key}"]`);
          if (!el) return;
          el.value = v;
          el.dispatchEvent(new Event('input', { bubbles: true }));
        };

        const faceName = (v) => (FONT_CHOICES.find((x) => x.value === v) || {}).label || 'Match the site';

        sheet.querySelectorAll('.type-row').forEach((row) => {
          const faceBtn = row.querySelector('[data-face]');
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

          facePop.querySelectorAll('.face-opt').forEach((o) => {
            o.onclick = () => {
              const v = o.dataset.val;
              writeField(faceKey, v);
              faceBtn.style.fontFamily = v || 'inherit';
              faceBtn.textContent = faceName(v);
              facePop.querySelectorAll('.face-opt').forEach((x) => x.classList.toggle('is-on', x === o));
              facePop.hidden = true;
            };
          });

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
  });
}

/* ------------------------------------------------------ media editor ---- */

export function openMediaEditor(value, onSave, { role = '', size = '' } = {}) {
  const m = media(value || {});
  const library = assets.list();
  // A background fills its section edge to edge, so framing, shaping, tilting
  // and captioning have nothing to act on. Offering those controls anyway was
  // the reason a chosen frame appeared to do nothing.
  const isBackdrop = role === 'backdrop' || role === 'trim';
  const isTrim = role === 'trim';

  const num = (key, label, min, max, step) => `
    <div class="token-row">
      <label>${esc(label)} <span class="token-value" data-out="${attr(key)}">${esc(m[key])}</span></label>
      <span class="token-control">
        <input type="range" data-m="${attr(key)}" min="${min}" max="${max}" step="${step}" value="${attr(m[key])}">
      </span>
    </div>`;

  openSheet(`
    <h2>Picture</h2>
    ${size ? `<p class="hint" style="margin-top:-.3rem">This slot looks best at <b>${esc(size)}</b>.
      Bigger is fine — it is scaled down when you add it to the library.</p>` : ''}

    <div class="asset-picker">
      <button class="asset-opt${!m.assetId ? ' is-on' : ''}" type="button" data-pick="">
        <span class="asset-opt-thumb asset-opt-none">none</span></button>
      ${library.map((a) => `<button class="asset-opt${m.assetId === a.id ? ' is-on' : ''}" type="button" data-pick="${attr(a.id)}">
        <span class="asset-opt-thumb"><img src="${attr(a.dataUrl)}" alt=""></span>
        <span class="asset-opt-name">${esc(a.name)}</span></button>`).join('')}
    </div>
    ${library.length ? '' : '<p class="hint">Your library is empty — <a href="#/assets" data-close>add some pictures</a> first. An empty slot still renders as a tinted plate.</p>'}

    ${isTrim ? `<p class="notice" style="margin-top:1.1rem">
      <strong>This is a decorative band.</strong>
      The artwork is shown as it is, laid across the edge of the section — not
      used to cut a shape. A transparent PNG works best, so the page shows
      through around it.</p>` : ''}
    ${isBackdrop && !isTrim ? `<p class="notice" style="margin-top:1.1rem">
      <strong>This is a background.</strong>
      It fills the whole section, so frames, shapes and tilts don’t apply.
      Put those on a picture inside the section instead.</p>` : ''}

    <div class="field" style="margin-top:1.1rem" ${isBackdrop ? 'hidden' : ''}>
      <label for="m-frame">Frame</label>
      <select id="m-frame" data-m="frame">
        ${FRAMES.map(([v, l]) => `<option value="${attr(v)}" ${v === m.frame ? 'selected' : ''}>${esc(l)}</option>`).join('')}
      </select>
    </div>
    <div class="grid-2" ${isBackdrop ? 'hidden' : ''}>
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

    <p class="field-label" style="margin-top:.6rem">Focal point — what stays in frame when cropped</p>
    ${num('focalX', 'Horizontal', 0, 100, 1)}
    ${num('focalY', 'Vertical', 0, 100, 1)}

    ${isBackdrop ? `
      <p class="field-label" style="margin-top:.6rem">Strength</p>
      ${num('opacity', 'Opacity', 0.1, 1, 0.05)}
    ` : `
      <p class="field-label" style="margin-top:.6rem">Placement</p>
      ${num('width', 'Width (% of slot)', 10, 100, 1)}
      ${num('rotate', 'Tilt (degrees)', -20, 20, 1)}
      ${num('opacity', 'Opacity', 0.1, 1, 0.05)}
      ${num('z', 'Layer order', 1, 9, 1)}
      ${num('x', 'Nudge across (%)', -50, 50, 1)}
      ${num('y', 'Nudge down (%)', -50, 50, 1)}
    `}

    <div class="field" style="margin-top:.8rem" ${isBackdrop ? 'hidden' : ''}>
      <label for="m-tape">Tape</label>
      <select id="m-tape" data-m="tape">
        ${TAPES.map(([v, l]) => `<option value="${attr(v)}" ${v === m.tape ? 'selected' : ''}>${esc(l)}</option>`).join('')}
      </select>
    </div>
    <label class="switch-row" ${isBackdrop ? 'hidden' : ''}><input type="checkbox" data-m="shadow" ${m.shadow ? 'checked' : ''}>
      <span class="switch-text">Drop shadow</span></label>
    <label class="switch-row" ${isBackdrop ? 'hidden' : ''}><input type="checkbox" data-m="hideOnMobile" ${m.hideOnMobile ? 'checked' : ''}>
      <span class="switch-text">Hide on phones<em>Useful for decorative layers that crowd a small screen.</em></span></label>

    <div class="field" style="margin-top:.8rem" ${isBackdrop ? 'hidden' : ''}>
      <label for="m-cap">Caption</label>
      <input type="text" id="m-cap" data-m="caption" value="${attr(m.caption || '')}">
    </div>

    <div class="btn-row" style="margin-top:1rem">
      <button class="btn grow" type="button" data-close>Cancel</button>
      <button class="btn btn-primary grow" type="button" data-act="save">Save picture</button>
    </div>
  `, {
    onMount(sheet, close) {
      const draft = { ...m };

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
