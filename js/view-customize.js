// The Design Studio — a private workbench for the journal's look.
// Every control writes one CSS custom property on <html>, so the change is
// visible the instant it moves. Nothing here is part of the reading experience.

import {
  THEME_SCHEMA, CONTENT_SCHEMA, FONT_STACKS, PRESETS, MODES,
  getToken, isOverridden, setToken, setTokens, setContent, getContent,
  getMode, setMode, resolvedMode,
  applyPreset, reset, download, importJson, exportJson, saveNow,
} from './theme.js';
import { state } from './state.js';
import { esc, attr, toast, confirmSheet, bookmarkArt, lockedArt, checkBadge, progressLine, openSheet } from './ui.js';
import { studioNav } from './studio-nav.js';

/** A token's current value as a number, for slider controls. */
function numericValue(token) {
  const raw = getToken(token.var);
  const n = parseFloat(raw);
  if (Number.isFinite(n) && !raw.includes('clamp')) return n;
  return token.approx != null ? token.approx : (token.min || 0);
}

const TOKEN_HELP = {
  '--c-bg': 'The background behind the whole journal.',
  '--c-bg-raised': 'Cards and surfaces that sit above the page.',
  '--c-ink': 'Main titles and readable text.',
  '--c-ink-soft': 'Subtitles and supporting text.',
  '--c-accent': 'Progress bars, active choices and small highlights.',
  '--f-script': 'The decorative script used in the site name.',
  '--f-display': 'Large titles and editorial headings.',
  '--f-body': 'Paragraphs, descriptions and journal writing.',
  '--f-ui': 'Navigation, labels, buttons and form controls.',
  '--fs-wordmark': 'Size of “Diana’s Lit Picks” in the top navigation.',
  '--fs-display': 'Size of large section headings, such as “The Year So Far”.',
  '--fs-body': 'Size of paragraphs and descriptive text throughout the site.',
  '--fs-label': 'Small labels throughout the site, including field labels.',
  '--fs-nav': 'Size of the main navigation links at the top.',
  '--fw-display': 'Thickness of large display headings.',
  '--fi-display': 'Upright or italic display headings.',
  '--fw-body': 'Thickness of paragraph text.',
  '--fi-body': 'Upright or italic paragraph text.',
  '--fw-label': 'Boldness of small field labels and metadata.',
  '--fw-nav': 'JOURNAL, LIBRARY, NOTEBOOK, COLLECTIONS and SETTINGS at the top.',
  '--fs-button': 'Text inside buttons, including SAVE CHANGES.',
  '--fw-button': 'Boldness of button text, including SAVE CHANGES.',
  '--fs-studio-summary': 'The expandable titles PREVIEW & OPTIONAL STARTING STYLES and SAVE, RESTORE OR RESET DESIGN.',
  '--fw-studio-summary': 'Boldness of the expandable Design Studio titles.',
  '--fs-studio-help': 'The message next to SAVE CHANGES.',
  '--fw-studio-help': 'Boldness of the save confirmation message.',
  '--fi-ui': 'Upright or italic navigation and interface labels.',
  '--h-banner': 'The height of the large banner at the top.',
  '--fs-banner-title': 'The main title inside that banner.',
  '--paper-texture-opacity': 'How visible the paper grain looks.',
};

function tokenLabel(token, id, dirty) {
  return `<label for="${id}">${esc(token.label)} ${dirty}${TOKEN_HELP[token.var]
    ? `<small class="studio-control-hint">${esc(TOKEN_HELP[token.var])}</small>` : ''}</label>`;
}

const FONT_SAMPLES = {
  '--f-script': ["Diana’s Lit Picks", '--f-script'],
  '--f-display': ['A Year in Books', '--f-display'],
  '--f-body': ['A little reading adventure, kept for good.', '--f-body'],
  '--f-ui': ['JOURNAL  ·  LIBRARY  ·  SETTINGS', '--f-ui'],
};

function fontSample(token) {
  const sample = FONT_SAMPLES[token.var];
  return sample ? `<div class="studio-font-sample" style="font-family:var(${sample[1]});">${esc(sample[0])}</div>` : '';
}

function control(token) {
  const id = `tk-${token.var.replace(/[^a-z0-9]/gi, '')}`;
  const current = getToken(token.var);
  const dirty = isOverridden(token.var) ? '<span class="token-dirty" title="Changed">•</span>' : '';

  switch (token.type) {
    case 'color':
      return `<div class="token-row" data-token="${attr(token.var)}">
        ${tokenLabel(token, id, dirty)}
        <span class="token-control">
          <input type="color" id="${id}" value="${attr(/^#[0-9a-f]{6}$/i.test(current) ? current : '#000000')}" data-role="color">
          <input type="text" value="${attr(current)}" data-role="text" spellcheck="false" aria-label="${attr(token.label)} value">
        </span>
      </div>`;

    case 'font':
      return `<div class="token-row is-wide" data-token="${attr(token.var)}">
        ${tokenLabel(token, id, dirty)}
        <span class="token-control">
          <select id="${id}" data-role="select">
            ${FONT_STACKS.map((f) => `<option value="${attr(f.value)}" ${f.value === current ? 'selected' : ''}>${esc(f.label)}</option>`).join('')}
            ${FONT_STACKS.some((f) => f.value === current) ? '' : `<option value="${attr(current)}" selected>Custom</option>`}
          </select>
        </span>
        ${fontSample(token)}
      </div>`;

    case 'select':
      return `<div class="token-row" data-token="${attr(token.var)}">
        ${tokenLabel(token, id, dirty)}
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
        ${tokenLabel(token, id, dirty)}
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

const GROUP_GUIDE = {
  palette: ['Page colors', 'Change the backgrounds, text colors and accents used throughout Shelf Marks.'],
  banner: ['Top banner', 'Change the height, headline and decorative details of the opening banner.'],
  typography: ['Fonts & text', 'Choose the exact text you want to change. Size and boldness are grouped by where the words appear.'],
  layout: ['Spacing & shape', 'Adjust the overall width, corners and spacing shared across pages.'],
  bookmarks: ['Bookmark display', 'Change how large bookmarks appear and how they are arranged.'],
  frames: ['Picture frames', 'Adjust the colors and proportions of the decorative frame styles.'],
  'bookmark-colours': ['Bookmark colors', 'Change the six built-in bookmark color combinations.'],
  wording: ['Page wording', 'Edit the titles, subtitles and navigation labels shown across the journal.'],
};

const KEY_CONTROLS = {
  palette: ['--c-bg', '--c-bg-raised', '--c-ink', '--c-ink-soft', '--c-accent'],
  banner: ['--c-banner-bg', '--c-banner-ink', '--h-banner', '--fs-banner-title'],
  typography: ['--f-script', '--f-display', '--f-body', '--f-ui'],
  layout: [], bookmarks: [], frames: [], 'bookmark-colours': [],
};

const TYPE_TARGETS = [
  { id: 'site-name', name: 'Site name', example: 'Diana’s Lit Picks', vars: ['--f-script', '--fs-wordmark'] },
  { id: 'navigation', name: 'Top navigation', example: 'JOURNAL · LIBRARY · NOTEBOOK · COLLECTIONS · SETTINGS', vars: ['--f-ui', '--fs-nav', '--fw-nav'] },
  { id: 'buttons', name: 'Buttons', example: 'SAVE CHANGES', vars: ['--fs-button', '--fw-button'] },
  { id: 'studio-titles', name: 'Expandable Design Studio titles', example: 'PREVIEW & OPTIONAL STARTING STYLES', vars: ['--fs-studio-summary', '--fw-studio-summary'] },
  { id: 'field-labels', name: 'Field labels', example: 'Display line height · Label case · Headline case', vars: ['--fs-label', '--fw-label'] },
  { id: 'save-message', name: 'Save message', example: 'Changes made. Select Save changes to confirm.', vars: ['--fs-studio-help', '--fw-studio-help'] },
  { id: 'headlines', name: 'Page headlines', example: 'The Year So Far', vars: ['--f-display', '--fs-display', '--fw-display', '--fi-display'] },
  { id: 'paragraphs', name: 'Paragraph text', example: 'A little reading adventure, kept for good.', vars: ['--f-body', '--fs-body', '--fw-body', '--fi-body'] },
];

function typographyGroup(g) {
  const used = new Set(TYPE_TARGETS.flatMap((target) => target.vars));
  const extra = g.tokens.filter((token) => !used.has(token.var));
  return `<section class="studio-edit-panel" data-studio-panel="typography" hidden>
    <h3>Fonts & text</h3>
    <p class="studio-panel-help">Select the words you recognize, then change their size or boldness. Your changes appear on the page immediately.</p>
    <div class="field studio-type-picker">
      <label for="studio-type-target">Which text do you want to edit?</label>
      <select id="studio-type-target">${TYPE_TARGETS.map((target) => `<option value="${attr(target.id)}">${esc(target.name)}</option>`).join('')}</select>
    </div>
    ${TYPE_TARGETS.map((target, index) => `<div class="studio-type-target" data-type-target="${attr(target.id)}" ${index ? 'hidden' : ''}>
      <p class="studio-type-example" data-preview-role="${attr(target.id)}"><span>Example on your site</span><strong>${esc(target.example)}</strong></p>
      <div class="studio-body">${target.vars.map((name) => g.tokens.find((token) => token.var === name)).filter(Boolean).map(control).join('')}</div>
    </div>`).join('')}
    ${extra.length ? `<details class="studio-advanced"><summary>More typography options <span>${extra.length} additional settings</span></summary><div class="studio-body">${extra.map(control).join('')}</div></details>` : ''}
  </section>`;
}

function group(g) {
  if (g.id === 'typography') return typographyGroup(g);
  const primary = KEY_CONTROLS[g.id] || [];
  const front = primary.length ? primary.map((key) => g.tokens.find((t) => t.var === key)).filter(Boolean) : g.tokens.slice(0, 4);
  const extra = g.tokens.filter((t) => !front.includes(t));
  return `<section class="studio-edit-panel" data-studio-panel="${attr(g.id)}" ${g.id === 'palette' ? '' : 'hidden'}>
    <h3>${esc(GROUP_GUIDE[g.id][0])}</h3>
    <p class="studio-panel-help">${esc(GROUP_GUIDE[g.id][1])}</p>
    <div class="studio-body">${front.map(control).join('')}</div>
    ${extra.length ? `<details class="studio-advanced"><summary>Fine-tune ${esc(GROUP_GUIDE[g.id][0].toLowerCase())} <span>${extra.length} more settings</span></summary>
      <div class="studio-body">${extra.map(control).join('')}</div></details>` : ''}
  </section>`;
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
        ${studioNav('design')}
        <div class="section-head" style="margin-bottom:1.3rem"><div>
          <h2 class="section-title">Design studio</h2>
          <p class="section-sub">Choose a detail below. Changes appear immediately and stay on this device.</p>
        </div></div>

        <div class="studio-simple-workbench">
          <div class="studio-picker-row">
            <div class="field">
              <label for="studio-area">What would you like to change?</label>
              <select id="studio-area">
                ${THEME_SCHEMA.map((g) => `<option value="${attr(g.id)}">${esc(GROUP_GUIDE[g.id][0])}</option>`).join('')}
                <option value="wording">Page wording</option>
              </select>
            </div>
            <div class="field">
              <label for="mode-choice">Light or dark appearance</label>
              <select id="mode-choice">
                ${MODES.map(([v, label]) => `<option value="${attr(v)}" ${getMode() === v ? 'selected' : ''}>${esc(label)}</option>`).join('')}
              </select>
            </div>
          </div>
          <p class="studio-picker-note">Site-wide settings are below. To change just one section, open that page and select its text or artwork.</p>
          ${THEME_SCHEMA.map(group).join('')}

          <section class="studio-edit-panel" data-studio-panel="wording" hidden>
            <h3>Page wording</h3>
            <p class="studio-panel-help">Change titles, subtitles and navigation labels without changing their styling.</p>
            <div class="studio-body">
              ${CONTENT_SCHEMA.map((c) => `
                <div class="token-row is-wide" data-content-key="${attr(c.key)}">
                  <label for="ct-${attr(c.key)}">${esc(c.label)}</label>
                  <span class="token-control">
                    <input type="text" id="ct-${attr(c.key)}" value="${attr(getContent()[c.key] || '')}">
                  </span>
                  ${c.hint ? `<p class="hint" style="grid-column:1/-1;margin:0">${esc(c.hint)}</p>` : ''}
                </div>`).join('')}
            </div>
          </section>
        </div>

        <div class="studio-save-row">
          <p id="studio-save-status" role="status" aria-live="polite">Changes preview live and are saved on this device.</p>
          <button class="btn btn-primary" type="button" id="studio-save">Save changes</button>
        </div>

        <details class="studio-group studio-extras"><summary>Preview & optional starting styles</summary><div class="studio-body">
        ${preview()}
        <section class="type-direction">
          <p class="lit-overline">THE NEW HOUSE STYLE</p>
          <h2>Something a little <em>romantic.</em></h2>
          <p class="type-direction-sample">The art of reading <em>beautifully</em></p>
          <p>Mrs Saint Delafield calligraphy, Bodoni Moda headlines, EB Garamond for reading and understated Jost for navigation. This is the new default—not another full-site preset.</p>
          <button class="btn btn-primary" type="button" id="use-editorial-type">Use this typography</button>
          <p class="hint">Changes typography only. Your artwork, colors, page composition and books stay as they are.</p>
        </section>
        <details class="studio-group"><summary>Other style starting points</summary>
          <div class="studio-body"><div class="btn-row" id="presets">
            ${Object.entries(PRESETS).map(([id, p]) =>
              `<button class="btn btn-sm" type="button" data-preset="${attr(id)}" title="${attr(p.note || '')}">${esc(p.label)}</button>`).join('')}
          </div><p class="hint">These replace color and typography overrides together.</p></div>
        </details>

        </div></details>

        <details class="studio-group studio-extras"><summary>Save, restore or reset design</summary>
          <div class="studio-body">
            <div class="btn-row">
              <button class="btn" type="button" id="export">Export design</button>
              <button class="btn" type="button" id="import">Import design</button>
              <button class="btn btn-danger" type="button" id="reset">Reset to defaults</button>
            </div>
            <input type="file" id="design-file" accept="application/json,.json" class="visually-hidden">
            <p class="hint">Your design is also included when you export a full backup from Settings.</p>
          </div>
        </details>
      </section>
    `,

    onMount(root) {
      const year = state.settings.year;
      // The masthead sits outside this view. Keep its typography and this
      // example in sync even if a previous stylesheet is still HTTP-cached.
      const syncNavigation = () => {
        const font = getToken('--f-ui');
        const size = getToken('--fs-nav');
        const weight = getToken('--fw-nav');
        document.querySelectorAll('.masthead-link').forEach((link) => {
          link.style.fontFamily = font;
          link.style.fontSize = size;
          link.style.fontWeight = weight;
        });
        const sample = root.querySelector('[data-preview-role="navigation"] strong');
        if (sample) {
          sample.style.fontFamily = font;
          sample.style.fontSize = size;
          sample.style.fontWeight = weight;
        }
      };
      syncNavigation();
      const saveStatus = root.querySelector('#studio-save-status');
      const noteChange = () => { saveStatus.textContent = 'Changes made. Select Save changes to confirm.'; };
      root.querySelector('#studio-save').onclick = async () => {
        const button = root.querySelector('#studio-save');
        button.disabled = true;
        try {
          await saveNow();
          saveStatus.textContent = 'Saved to this browser.';
          toast('Design saved.', 'good');
        } catch (_) {
          saveStatus.textContent = 'Could not confirm the save. Please export a backup.';
          toast('Save could not be confirmed. Export a backup to be safe.', 'bad');
        } finally { button.disabled = false; }
      };
      root.querySelector('#use-editorial-type').onclick = async () => {
        await setTokens({
          '--f-script': "'Mrs Saint Delafield', 'Imperial Script', 'Snell Roundhand', cursive",
          '--f-display': "'Bodoni Moda', 'Didot', Georgia, serif",
          '--f-body': "'EB Garamond', 'Cormorant Garamond', Georgia, serif",
          '--f-ui': "'Jost', 'Futura', Arial, sans-serif",
          '--fw-display': '400', '--fw-heading': '500', '--fw-body': '400',
          '--tt-display': 'none',
        });
        toast('New editorial typography applied. You can refine each font below.', 'good');
        navigateReload();
      };

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

      /* ---- appearance ---- */
      root.querySelector('#studio-area').onchange = (event) => {
        root.querySelectorAll('[data-studio-panel]').forEach((panel) => {
          panel.hidden = panel.dataset.studioPanel !== event.target.value;
        });
      };
      root.querySelector('#studio-type-target').onchange = (event) => {
        root.querySelectorAll('[data-type-target]').forEach((panel) => {
          panel.hidden = panel.dataset.typeTarget !== event.target.value;
        });
      };
      root.querySelector('#mode-choice').onchange = async (event) => {
        await setMode(event.target.value);
        noteChange();
        repaintPreview();
        toast('Appearance updated.', 'good', 1800);
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
          if (name === '--f-ui' || name === '--fs-nav' || name === '--fw-nav') syncNavigation();
          noteChange();
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
          noteChange();
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
