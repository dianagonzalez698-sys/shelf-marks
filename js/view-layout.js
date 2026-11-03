// The layout editor: add, reorder, hide and configure the editorial sections
// that make up each page — and place a picture into any slot.

import * as layout from './layout.js';
import { SECTION_TYPES, typeList } from './sections.js';
import { media, FRAMES, RATIOS, TAPES, MEDIA_DEFAULTS } from './media.js';
import * as assets from './assets.js';
import { allChallenges, state } from './state.js';
import { esc, attr, toast, openSheet, confirmSheet, navigate, render } from './ui.js';
import { studioNav } from './studio-nav.js';

/* ------------------------------------------------------------- pages ---- */

function pageOptions() {
  const pages = [
    ['home', 'The journal (home)'],
    ['directory', 'Challenge index'],
  ];
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
    return `<li class="lay-row${sec.visible === false ? ' is-hidden' : ''}" data-sec="${attr(sec.id)}">
      <span class="lay-order">
        <button class="icon-btn" type="button" data-move="-1" ${i === 0 ? 'disabled' : ''} aria-label="Move up">↑</button>
        <button class="icon-btn" type="button" data-move="1" ${i === sections.length - 1 ? 'disabled' : ''} aria-label="Move down">↓</button>
      </span>
      <span class="lay-body">
        <span class="lay-type">${esc(def.label)}</span>
        <span class="lay-summary">${esc(String(summary || '').slice(0, 72))}</span>
      </span>
      <span class="lay-acts">
        <button class="btn btn-quiet btn-sm" type="button" data-act="vis">${sec.visible === false ? 'Show' : 'Hide'}</button>
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
        row.querySelector('[data-act="vis"]').onclick = async () => {
          const sec = layout.getSection(pageId, id);
          await layout.updateSection(pageId, id, { visible: sec.visible === false });
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

/* ------------------------------------------------------ type picker ----- */

function openTypePicker(pageId) {
  openSheet(`
    <h2>Add a section</h2>
    <p class="small muted">Each one is a different kind of editorial composition.</p>
    <div class="type-list">
      ${typeList().map((t) => `<button class="type-opt" type="button" data-type="${attr(t.value)}">
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

function fieldControl(f, value, secId) {
  const id = `f-${secId}-${f.key}`;
  switch (f.type) {
    case 'textarea':
      return `<div class="field"><label for="${id}">${esc(f.label)}</label>
        <textarea id="${id}" data-field="${attr(f.key)}" rows="5">${esc(value || '')}</textarea></div>`;
    case 'bool':
      return `<label class="switch-row"><input type="checkbox" id="${id}" data-field="${attr(f.key)}" ${value ? 'checked' : ''}>
        <span class="switch-text">${esc(f.label)}</span></label>`;
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
        ${mediaButton(f.key, value)}</div>`;
    case 'medialist':
      return `<div class="field"><span class="field-label">${esc(f.label)}</span>
        <div class="media-list" data-medialist="${attr(f.key)}">
          ${(value || []).map((m, i) => mediaButton(`${f.key}:${i}`, m, true)).join('')}
        </div>
        <button class="btn btn-sm" type="button" data-addmedia="${attr(f.key)}">Add a picture</button></div>`;
    default:
      return `<div class="field"><label for="${id}">${esc(f.label)}</label>
        <input type="text" id="${id}" data-field="${attr(f.key)}" value="${attr(value || '')}"></div>`;
  }
}

function mediaButton(key, m, removable = false) {
  const descriptor = media(m || {});
  const url = assets.src(descriptor.assetId);
  const a = assets.get(descriptor.assetId);
  return `<span class="media-slot">
    <button class="media-pick" type="button" data-media="${attr(key)}">
      <span class="media-thumb">${url
        ? `<img src="${attr(url)}" alt="">`
        : '<span class="media-thumb-empty">empty</span>'}</span>
      <span class="media-label">${esc(a ? a.name : 'Choose a picture')}</span>
      <span class="media-meta">${esc(descriptor.frame)} · ${esc(descriptor.ratio)}</span>
    </button>
    ${removable ? `<button class="icon-btn" type="button" data-rmmedia="${attr(key)}" aria-label="Remove picture">×</button>` : ''}
  </span>`;
}

export function openSectionEditor(pageId, sectionId) {
  const sec = layout.getSection(pageId, sectionId);
  if (!sec) return;
  const def = SECTION_TYPES[sec.type];
  if (!def) return;

  openSheet(`
    <h2>${esc(def.label)}</h2>
    <p class="small muted">${esc(def.blurb)}</p>
    <div id="sec-fields" style="margin-top:1rem">
      ${def.fields.map((f) => fieldControl(f, sec[f.key], sec.id)).join('')}
    </div>
    <div class="btn-row" style="margin-top:1rem">
      <button class="btn btn-block" type="button" data-close>Done</button>
    </div>
  `, {
    onMount(sheet) {
      const commit = async (patch) => {
        await layout.updateSection(pageId, sectionId, patch);
      };

      sheet.querySelectorAll('[data-field]').forEach((el) => {
        const key = el.dataset.field;
        const evt = (el.type === 'checkbox' || el.tagName === 'SELECT' || el.type === 'range') ? 'input' : 'input';
        el.addEventListener(evt, async () => {
          let v;
          if (el.type === 'checkbox') v = el.checked;
          else if (el.type === 'range') {
            v = Number(el.value);
            const out = el.closest('.field').querySelector('[data-readout]');
            if (out) out.textContent = v;
          } else v = el.value;
          await commit({ [key]: v });
        });
      });

      // single media slots
      sheet.querySelectorAll('[data-media]').forEach((btn) => {
        btn.onclick = () => {
          const key = btn.dataset.media;
          const [base, idx] = key.split(':');
          const current = idx === undefined ? sec[base] : (sec[base] || [])[Number(idx)];
          openMediaEditor(current, async (next) => {
            const fresh = layout.getSection(pageId, sectionId);
            if (idx === undefined) await commit({ [base]: next });
            else {
              const list = [...(fresh[base] || [])];
              list[Number(idx)] = next;
              await commit({ [base]: list });
            }
            render();
          });
        };
      });

      sheet.querySelectorAll('[data-rmmedia]').forEach((btn) => {
        btn.onclick = async () => {
          const [base, idx] = btn.dataset.rmmedia.split(':');
          const fresh = layout.getSection(pageId, sectionId);
          const list = [...(fresh[base] || [])];
          list.splice(Number(idx), 1);
          await commit({ [base]: list });
          render();
        };
      });

      sheet.querySelectorAll('[data-addmedia]').forEach((btn) => {
        btn.onclick = async () => {
          const base = btn.dataset.addmedia;
          const fresh = layout.getSection(pageId, sectionId);
          await commit({ [base]: [...(fresh[base] || []), media({})] });
          render();
        };
      });
    },
  });
}

/* ------------------------------------------------------ media editor ---- */

export function openMediaEditor(value, onSave) {
  const m = media(value || {});
  const library = assets.list();

  const num = (key, label, min, max, step) => `
    <div class="token-row">
      <label>${esc(label)} <span class="token-value" data-out="${attr(key)}">${esc(m[key])}</span></label>
      <span class="token-control">
        <input type="range" data-m="${attr(key)}" min="${min}" max="${max}" step="${step}" value="${attr(m[key])}">
      </span>
    </div>`;

  openSheet(`
    <h2>Picture</h2>

    <div class="asset-picker">
      <button class="asset-opt${!m.assetId ? ' is-on' : ''}" type="button" data-pick="">
        <span class="asset-opt-thumb asset-opt-none">none</span></button>
      ${library.map((a) => `<button class="asset-opt${m.assetId === a.id ? ' is-on' : ''}" type="button" data-pick="${attr(a.id)}">
        <span class="asset-opt-thumb"><img src="${attr(a.dataUrl)}" alt=""></span>
        <span class="asset-opt-name">${esc(a.name)}</span></button>`).join('')}
    </div>
    ${library.length ? '' : '<p class="hint">Your library is empty — <a href="#/assets" data-close>add some pictures</a> first. An empty slot still renders as a tinted plate.</p>'}

    <div class="field" style="margin-top:1.1rem">
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

    <p class="field-label" style="margin-top:.6rem">Focal point — what stays in frame when cropped</p>
    ${num('focalX', 'Horizontal', 0, 100, 1)}
    ${num('focalY', 'Vertical', 0, 100, 1)}

    <p class="field-label" style="margin-top:.6rem">Placement</p>
    ${num('width', 'Width (% of slot)', 10, 100, 1)}
    ${num('rotate', 'Tilt (degrees)', -20, 20, 1)}
    ${num('opacity', 'Opacity', 0.1, 1, 0.05)}
    ${num('z', 'Layer order', 1, 9, 1)}
    ${num('x', 'Nudge across (%)', -50, 50, 1)}
    ${num('y', 'Nudge down (%)', -50, 50, 1)}

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

      sheet.querySelector('[data-act="save"]').onclick = () => {
        close();
        onSave(draft);
        toast('Picture placed.', 'good', 1600);
      };
    },
  });
}
