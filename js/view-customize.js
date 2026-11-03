// The Design Studio — a private workbench for the journal's look.
// Every control writes one CSS custom property on <html>, so the change is
// visible the instant it moves. Nothing here is part of the reading experience.

import {
  THEME_SCHEMA, CONTENT_SCHEMA, FONT_STACKS, PRESETS,
  getToken, isOverridden, setToken, setContent, getContent,
  applyPreset, reset, download, importJson, exportJson,
} from './theme.js';
import { state } from './state.js';
import { esc, attr, toast, confirmSheet, bookmarkArt, lockedArt, checkBadge, progressLine, openSheet } from './ui.js';

/** A token's current value as a number, for slider controls. */
function numericValue(token) {
  const raw = getToken(token.var);
  const n = parseFloat(raw);
  if (Number.isFinite(n) && !raw.includes('clamp')) return n;
  return token.approx != null ? token.approx : (token.min || 0);
}

function control(token) {
  const id = `tk-${token.var.replace(/[^a-z0-9]/gi, '')}`;
  const current = getToken(token.var);
  const dirty = isOverridden(token.var) ? '<span class="token-dirty" title="Changed">•</span>' : '';

  switch (token.type) {
    case 'color':
      return `<div class="token-row" data-token="${attr(token.var)}">
        <label for="${id}">${esc(token.label)} ${dirty}</label>
        <span class="token-control">
          <input type="color" id="${id}" value="${attr(/^#[0-9a-f]{6}$/i.test(current) ? current : '#000000')}" data-role="color">
          <input type="text" value="${attr(current)}" data-role="text" spellcheck="false" aria-label="${attr(token.label)} value">
        </span>
      </div>`;

    case 'font':
      return `<div class="token-row is-wide" data-token="${attr(token.var)}">
        <label for="${id}">${esc(token.label)} ${dirty}</label>
        <span class="token-control">
          <select id="${id}" data-role="select">
            ${FONT_STACKS.map((f) => `<option value="${attr(f.value)}" ${f.value === current ? 'selected' : ''}>${esc(f.label)}</option>`).join('')}
            ${FONT_STACKS.some((f) => f.value === current) ? '' : `<option value="${attr(current)}" selected>Custom</option>`}
          </select>
        </span>
      </div>`;

    case 'select':
      return `<div class="token-row" data-token="${attr(token.var)}">
        <label for="${id}">${esc(token.label)} ${dirty}</label>
        <span class="token-control">
          <select id="${id}" data-role="select">
            ${token.options.map(([v, l]) => `<option value="${attr(v)}" ${String(v) === String(current).trim() ? 'selected' : ''}>${esc(l)}</option>`).join('')}
          </select>
        </span>
      </div>`;

    case 'length':
    case 'number':
    case 'ratio': {
      const unit = token.unit || '';
      const value = numericValue(token);
      return `<div class="token-row" data-token="${attr(token.var)}" data-unit="${attr(unit)}">
        <label for="${id}">${esc(token.label)} ${dirty}</label>
        <span class="token-control">
          <input type="range" id="${id}" data-role="range"
                 min="${token.min}" max="${token.max}" step="${token.step}" value="${value}">
          <span class="token-value" data-role="readout">${value}${esc(unit)}</span>
        </span>
      </div>`;
    }

    default:
      return '';
  }
}

function group(g) {
  return `<details class="studio-group" ${g.id === 'palette' ? 'open' : ''}>
    <summary>${esc(g.label)}</summary>
    <div class="studio-body">
      ${g.note ? `<p class="hint" style="margin:0 0 .3rem">${esc(g.note)}</p>` : ''}
      ${g.tokens.map(control).join('')}
    </div>
  </details>`;
}

function preview() {
  return `<div class="studio-preview" id="studio-preview">
    <div class="studio-preview-banner">
      <p class="banner-eyebrow">${esc(getContent().bannerEyebrow.replace('{year}', state.settings.year))}</p>
      <p class="banner-title" style="margin:.2rem 0">${esc(getContent().bannerTitle)}</p>
      <p class="banner-sub">${esc(getContent().bannerSubtitle)}</p>
    </div>
    <div class="studio-preview-body">
      ${progressLine('4 of 9 bookmarks collected', 44)}
      <div class="bm-grid" style="--bm-w:68px;margin-top:1.2rem">
        ${['preview-a', 'preview-b', 'preview-c'].map((id) => `
          <span class="bm">${bookmarkArt(id)}${checkBadge()}<span class="bm-label">A Debut Novel</span></span>`).join('')}
        <span class="bm locked">${lockedArt()}<span class="bm-label">A Classic</span></span>
      </div>
    </div>
  </div>`;
}

export function customizeView() {
  return {
    title: 'Design studio',
    tab: 'settings',
    back: true,
    live: false,
    html: `
      <section class="section form-wrap">
        <div class="section-head" style="margin-bottom:1.3rem"><div>
          <h2 class="section-title">Design studio</h2>
          <p class="section-sub">Every change lands immediately and is kept on this device.</p>
        </div></div>

        ${preview()}

        <h2 class="form-heading">Starting points</h2>
        <div class="btn-row" id="presets">
          ${Object.entries(PRESETS).map(([id, p]) =>
            `<button class="btn btn-sm" type="button" data-preset="${attr(id)}" title="${attr(p.note || '')}">${esc(p.label)}</button>`).join('')}
        </div>
        <p class="hint">A preset replaces every colour and type override. Your writing and books are untouched.</p>

        <div style="margin-top:var(--sp-section)">
          ${THEME_SCHEMA.map(group).join('')}

          <details class="studio-group">
            <summary>Wording</summary>
            <div class="studio-body">
              <p class="hint" style="margin:0 0 .3rem">Titles and labels shown around the journal.</p>
              ${CONTENT_SCHEMA.map((c) => `
                <div class="token-row is-wide" data-content-key="${attr(c.key)}">
                  <label for="ct-${attr(c.key)}">${esc(c.label)}</label>
                  <span class="token-control">
                    <input type="text" id="ct-${attr(c.key)}" value="${attr(getContent()[c.key] || '')}">
                  </span>
                  ${c.hint ? `<p class="hint" style="grid-column:1/-1;margin:0">${esc(c.hint)}</p>` : ''}
                </div>`).join('')}
            </div>
          </details>
        </div>

        <h2 class="form-heading">Keep or share this design</h2>
        <div class="btn-row">
          <button class="btn" type="button" id="export">Export design</button>
          <button class="btn" type="button" id="import">Import design</button>
          <button class="btn btn-danger" type="button" id="reset">Reset to defaults</button>
        </div>
        <input type="file" id="design-file" accept="application/json,.json" class="visually-hidden">
        <p class="hint">
          Exported settings are a small JSON file — the same one the Import button reads.
          Your design also travels inside the ordinary backup in Settings.
        </p>
      </section>
    `,

    onMount(root) {
      const year = state.settings.year;

      const repaintPreview = () => {
        const host = root.querySelector('#studio-preview');
        if (!host) return;
        const fresh = document.createElement('div');
        fresh.innerHTML = preview();
        host.replaceWith(fresh.firstElementChild);
      };

      const markDirty = (row) => {
        if (row.querySelector('.token-dirty')) return;
        const label = row.querySelector('label');
        if (label) label.insertAdjacentHTML('beforeend', ' <span class="token-dirty" title="Changed">•</span>');
      };

      /* ---- token controls ---- */
      root.querySelectorAll('[data-token]').forEach((row) => {
        const name = row.dataset.token;
        const unit = row.dataset.unit || '';

        const colorEl = row.querySelector('[data-role="color"]');
        const textEl = row.querySelector('[data-role="text"]');
        const selectEl = row.querySelector('[data-role="select"]');
        const rangeEl = row.querySelector('[data-role="range"]');
        const readout = row.querySelector('[data-role="readout"]');

        const commit = (value) => {
          setToken(name, value);
          markDirty(row);
          if (name.includes('banner') || name.includes('bm') || name.includes('--f-') || name.includes('--c-')) {
            repaintPreview();
          }
        };

        if (colorEl) {
          colorEl.addEventListener('input', () => {
            if (textEl) textEl.value = colorEl.value;
            commit(colorEl.value);
          });
        }
        if (textEl) {
          textEl.addEventListener('change', () => {
            const v = textEl.value.trim();
            if (colorEl && /^#[0-9a-f]{6}$/i.test(v)) colorEl.value = v;
            commit(v);
          });
        }
        if (selectEl) {
          selectEl.addEventListener('change', () => commit(selectEl.value));
        }
        if (rangeEl) {
          rangeEl.addEventListener('input', () => {
            const v = `${rangeEl.value}${unit}`;
            if (readout) readout.textContent = v;
            commit(v);
          });
        }
      });

      /* ---- wording ---- */
      root.querySelectorAll('[data-content-key]').forEach((row) => {
        const key = row.dataset.contentKey;
        const input = row.querySelector('input');
        input.addEventListener('input', () => {
          setContent(key, input.value);
          // Shell text (wordmark, nav, banner) is re-filled from the content map.
          import('./theme.js').then((m) => m.applyContent(year));
          repaintPreview();
        });
      });

      /* ---- presets ---- */
      root.querySelectorAll('[data-preset]').forEach((btn) => {
        btn.onclick = async () => {
          await applyPreset(btn.dataset.preset, year);
          toast(`“${esc(PRESETS[btn.dataset.preset].label)}” applied.`, 'good');
          navigateReload();
        };
      });

      /* ---- export / import / reset ---- */
      root.querySelector('#export').onclick = () => {
        try {
          const name = download();
          toast(`Saved ${esc(name)}.`, 'good');
        } catch (_) {
          // Some in-app browsers block generated downloads; show the JSON instead.
          openSheet(`<h2>Copy your design</h2>
            <p class="small muted">This device blocked the download, so here it is to copy by hand.</p>
            <textarea rows="12" spellcheck="false">${esc(exportJson())}</textarea>
            <div class="btn-row" style="margin-top:.8rem"><button class="btn btn-block" type="button" data-close>Close</button></div>`);
        }
      };

      const file = root.querySelector('#design-file');
      root.querySelector('#import').onclick = () => file.click();
      file.onchange = async () => {
        const f = file.files && file.files[0];
        if (!f) return;
        try {
          const text = await f.text();
          const res = await importJson(text, year);
          file.value = '';
          toast(`Design imported — ${res.applied} setting${res.applied === 1 ? '' : 's'} applied.`, 'good');
          navigateReload();
        } catch (err) {
          file.value = '';
          toast(esc(err.message || 'Could not read that file.'), 'bad');
        }
      };

      root.querySelector('#reset').onclick = async () => {
        const yes = await confirmSheet({
          title: 'Reset the design?',
          body: 'Colours, type and wording return to the defaults. Your books, challenges and bookmarks are not touched.',
          confirm: 'Reset',
          danger: true,
        });
        if (!yes) return;
        await reset(year);
        toast('Back to the house style.');
        navigateReload();
      };
    },
  };
}

// Re-render the studio so every control shows its new value.
function navigateReload() {
  import('./ui.js').then((m) => m.render());
}
