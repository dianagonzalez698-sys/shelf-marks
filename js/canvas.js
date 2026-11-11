// Freeform layer. Independent of reading records and the existing section data.
// Items belong to a section, so artwork travels with that section when reordered.
import * as store from './store.js';
import * as assets from './assets.js';
import * as theme from './theme.js';
import { FONT_STACKS } from './theme.js';
import * as layout from './layout.js';
import { typeList, SECTION_TYPES, roleForKey, applySectionVars } from './sections.js?v=86';
import { openSectionEditor } from './view-layout.js?v=95';
import { esc, rich, richValue, toast, confirmSheet, refresh as refreshPage } from './ui.js';


// Settings has no editorial layout records, but its visible typography is editable
// in Design Mode. These stable groups preserve normal form actions and their data.
const SETTINGS_STYLE_KEY = 'lit-picks-settings-text-v1';
const SETTINGS_STYLE_DATE_KEY = 'lit-picks-settings-text-updated-v1';
const SETTINGS_STYLE_GROUPS = [
  ['eyebrow','Page eyebrow','.settings-heading .lit-overline'],
  ['page-title','Settings title','.settings-heading h1'],
  ['page-description','Settings introduction','.settings-heading > p:last-child'],
  ['card-number','Section numbers','.settings-card-head > span'],
  ['card-heading','Card headings','.settings-card-head h2'],
  ['card-description','Card descriptions','.settings-card > p'],
  ['action','Design Mode button','.settings-design-card > .lit-primary-action'],
  ['section-toggle','Expandable section labels','.settings-disclosure > summary'],
  ['form-label','Reading goal labels','.settings-goals-card .field > label'],
  ['appearance-label','Appearance label','.settings-mode-field > label'],
  ['supporting','Explanatory notes','.settings-card .hint'],
  ['tool-link','Design tool links','.settings-link-grid a'],
  ['footnote','Page footnote','.settings-footnote'],
];
let settingsStyleSelected = null;
function settingsStyles() {
  try { return JSON.parse(localStorage.getItem(SETTINGS_STYLE_KEY) || '{}') || {}; }
  catch (_) { return {}; }
}
function applySettingsStyle(id) {
  const props = settingsStyles()[id] || {};
  document.querySelectorAll('#app [data-settings-style="'+id+'"]').forEach(node => {
    for (const property of ['fontFamily','fontSize','fontWeight','fontStyle','color']) {
      if (props[property]) node.style[property] = props[property];
      else node.style.removeProperty(property);
    }
  });
}
function updateSettingsStyle(id, prop, value) {
  const all = settingsStyles();
  const next = { ...(all[id] || {}) };
  if (value) next[prop] = value;
  else delete next[prop];
  all[id] = next;
  try { localStorage.setItem(SETTINGS_STYLE_KEY, JSON.stringify(all));
    localStorage.setItem(SETTINGS_STYLE_DATE_KEY, new Date().toISOString()); }
  catch (_) { toast('Could not save Settings text style on this device.', 'bad'); }
  applySettingsStyle(id);
}
// Include page-specific text edits in the ordinary device backup. Prior backups
// without this optional field continue to import exactly as before.
export function settingsTextStylesSnapshot() {
  let updatedAt = '';
  try { updatedAt = localStorage.getItem(SETTINGS_STYLE_DATE_KEY) || ''; } catch (_) { /* private mode */ }
  return { styles: settingsStyles(), updatedAt };
}
export function adoptSettingsTextStyles(payload) {
  const incoming = payload && payload.styles;
  if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) return false;
  try {
    const localDate = localStorage.getItem(SETTINGS_STYLE_DATE_KEY) || '';
    if (localDate && (!payload.updatedAt || payload.updatedAt <= localDate)) return false;
    localStorage.setItem(SETTINGS_STYLE_KEY, JSON.stringify(incoming));
    localStorage.setItem(SETTINGS_STYLE_DATE_KEY, payload.updatedAt || new Date().toISOString());
    document.querySelectorAll('#app [data-settings-style]').forEach(node => applySettingsStyle(node.dataset.settingsStyle));
    return true;
  } catch (_) { return false; }
}
export function attachSettingsDesign(root) {
  if (!root) return;
  for (const [id,,selector] of SETTINGS_STYLE_GROUPS) {
    root.querySelectorAll(selector).forEach(el => { el.dataset.settingsStyle = id; });
    applySettingsStyle(id);
  }
}
function paintSettingsStylePanel(panel) {
  const row = SETTINGS_STYLE_GROUPS.find(r => r[0] === settingsStyleSelected);
  if (!row) return;
  const current = settingsStyles()[settingsStyleSelected] || {};
  const example = document.querySelector('#app [data-settings-style="'+settingsStyleSelected+'"]');
  const effectiveSize = example ? Math.round(parseFloat(getComputedStyle(example).fontSize)) : 16;
  const fontOptions = FONT_STACKS.map(f => `<option value="${esc(f.value)}" ${f.value === current.fontFamily ? 'selected' : ''}>${esc(f.label)}</option>`).join('');
  panel.innerHTML = `<div class="canvas-panel-head"><strong>EDIT SETTINGS TEXT</strong><button type="button" data-canvas="settings-style-back">← Back</button></div>
    <p class="canvas-panel-hint">Editing: <strong>${esc(row[1])}</strong>. Changes appear immediately and stay on this device.</p>
    <label>Font<select id="settings-style-font"><option value="">Match site</option>${fontOptions}</select></label>
    <label>Size <output id="settings-style-size-val">${effectiveSize}px</output><input id="settings-style-size" type="range" min="12" max="72" step="1" value="${effectiveSize}"></label>
    <label>Boldness<select id="settings-style-weight">
      <option value="">Match site</option>
      ${[['400','Regular'],['500','Medium'],['600','Semibold'],['700','Bold'],['800','Extra bold']].map(([n,label]) => `<option value="${n}" ${current.fontWeight===n?'selected':''}>${label}</option>`).join('')}
    </select></label>
    <label class="canvas-text-italic"><input id="settings-style-italic" type="checkbox" ${current.fontStyle === 'italic' ? 'checked' : ''}> Italic</label>
    <label>Text color<input id="settings-style-color" type="color" value="${/^#[a-f0-9]{6}$/i.test(current.color || '') ? current.color : '#4b2828'}"></label>
    <button type="button" class="canvas-text-style-reset" id="settings-style-reset">Reset this text style</button>`;
  panel.querySelector('#settings-style-font').onchange = e => updateSettingsStyle(settingsStyleSelected, 'fontFamily', e.target.value);
  panel.querySelector('#settings-style-size').oninput = e => {
    panel.querySelector('#settings-style-size-val').textContent = e.target.value+'px';
    updateSettingsStyle(settingsStyleSelected, 'fontSize', e.target.value+'px');
  };
  panel.querySelector('#settings-style-weight').onchange = e => updateSettingsStyle(settingsStyleSelected, 'fontWeight', e.target.value);
  panel.querySelector('#settings-style-italic').onchange = e => updateSettingsStyle(settingsStyleSelected, 'fontStyle', e.target.checked ? 'italic' : 'normal');
  panel.querySelector('#settings-style-color').oninput = e => updateSettingsStyle(settingsStyleSelected, 'color', e.target.value);
  panel.querySelector('#settings-style-reset').onclick = () => {
    const all = settingsStyles(); delete all[settingsStyleSelected];
    localStorage.setItem(SETTINGS_STYLE_KEY, JSON.stringify(all));
    localStorage.setItem(SETTINGS_STYLE_DATE_KEY, new Date().toISOString());
    applySettingsStyle(settingsStyleSelected);paintSettingsStylePanel(panel);
  };
}

const records = new Map();
let activePage = null;
let simplePage = false;
let editing = false;
let selected = null;
let selectedSectionId = null;
let selectedText = null;
let panelMode = 'sections';
let history = [];
let future = [];
let saveQueue = Promise.resolve();
let saveRevision = 0;
let saveState = 'saved';
let advancedOpen = false;

const idFor = (page) => `canvas:${page}`;
const clone = (v) => JSON.parse(JSON.stringify(v));
const uid = () => `cv_${crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2)}`;
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const frameClass = frame => ['fine', 'ornate', 'gilded-round', 'gilded-oval', 'polaroid'].includes(frame) ? ` frame-${frame}` : '';
const data = () => records.get(idFor(activePage))?.items || [];

function paintSaveState() {
  const message = document.querySelector('#canvas-toolbar .canvas-save-state');
  if (!message) return;
  const label = simplePage ? 'Page accents' : 'Design edits';
  message.textContent = !activePage ? 'Design Mode stays on as you browse'
    : `${label} · ${saveState === 'saving' ? 'Saving…' : saveState === 'error' ? 'Not saved' : 'Saved on this device'}`;
  message.setAttribute('role', 'status');
}

export async function load() { adoptMany(await store.getAll('canvas')); }
export function snapshot() { return [...records.values()].map(clone); }
export function adoptMany(rows) {
  records.clear();
  (rows || []).filter((x) => x && x.id && Array.isArray(x.items)).forEach((x) => records.set(x.id, clone(x)));
}

function persist() {
  if (!activePage) return;
  const page = activePage;
  const revision = ++saveRevision;
  saveState = 'saving';
  paintSaveState();
  const id = idFor(activePage);
  const row = { id, items: clone(data()), updatedAt: new Date().toISOString() };
  records.set(id, row);
  saveQueue = saveQueue.catch(() => {}).then(() => store.put('canvas', row));
  saveQueue.then(() => {
    if (activePage === page && revision === saveRevision) { saveState = 'saved'; paintSaveState(); }
  }).catch(() => {
    if (activePage === page && revision === saveRevision) { saveState = 'error'; paintSaveState(); }
    toast('Could not save canvas edits. Export a backup.', 'bad');
  });
}

function checkpoint() { history.push(clone(data())); if (history.length > 40) history.shift(); future = []; }
function change(items) {
  records.set(idFor(activePage), { id: idFor(activePage), items, updatedAt: new Date().toISOString() });
  persist(); render();
}
function update(id, patch, { record = true } = {}) {
  if (record) checkpoint();
  change(data().map((i) => i.id === id ? { ...i, ...patch } : i));
}
function duplicateSelected() {
  const original = data().find(x => x.id === selected);
  if (!original) return;
  checkpoint();
  const copy = {
    ...clone(original), id: uid(), locked: false,
    x: original.fullWidth ? 0 : clamp(Number(original.x || 0) + 3, 0, 100),
    y: clamp(Number(original.y || 0) + 3, 0, 100),
    label: original.label ? `${original.label.replace(/ copy$/i, '')} copy`.slice(0, 60) : '',
  };
  const items = [...data()];
  items.splice(items.findIndex(x => x.id === original.id) + 1, 0, copy);
  selected = copy.id;
  panelMode = 'selected';
  change(items);
}
function removeSelected() {
  if (!selected || !data().some(x => x.id === selected)) return;
  checkpoint();
  const removing = selected;
  selected = null;
  panelMode = 'layers';
  change(data().filter(x => x.id !== removing));
}
function moveLayer(id, direction, { stayInLayers = true } = {}) {
  const items = [...data()];
  const from = items.findIndex(x => x.id === id);
  if (from < 0) return;
  const sameHost = items.map((x, i) => x.sectionId === items[from].sectionId ? i : -1).filter(i => i >= 0);
  const slot = sameHost.indexOf(from);
  const destination = sameHost[slot + direction];
  if (destination === undefined) return;
  checkpoint();
  [items[from], items[destination]] = [items[destination], items[from]];
  selected = id;
  if (stayInLayers) panelMode = 'layers';
  change(items);
}
function moveLayerToEdge(id, front) {
  const items = [...data()];
  const from = items.findIndex(x => x.id === id);
  if (from < 0) return;
  const peerIndices = items.map((x, i) => x.sectionId === items[from].sectionId ? i : -1).filter(i => i >= 0);
  const destination = front ? peerIndices[peerIndices.length - 1] : peerIndices[0];
  if (destination === from) return;
  checkpoint();
  const [moving] = items.splice(from, 1);
  items.splice(destination, 0, moving);
  change(items);
}
function alignSelected(where) {
  const item = data().find(x => x.id === selected);
  if (!item || item.locked || item.fullWidth) return;
  const host = section(item.sectionId);
  if (!host) return;
  const width = host.getBoundingClientRect().width;
  const rendered = [...document.querySelectorAll('.canvas-item')].find(el => el.dataset.canvasId === item.id);
  const itemWidth = rendered?.getBoundingClientRect().width || item.width;
  if (!width) return;
  const left = where === 'left' ? 0 : where === 'right' ? width - itemWidth : (width - itemWidth) / 2;
  update(item.id, { x: clamp(left / width * 100, 0, 100) });
}
function undo() { if (!history.length) return; future.push(clone(data())); change(history.pop()); }
function redo() { if (!future.length) return; history.push(clone(data())); change(future.pop()); }

function section(id) { return [...document.querySelectorAll('#app [data-sec]')].find((el) => el.dataset.sec === id); }
function targetSection() {
  if (selectedSectionId && section(selectedSectionId)) return section(selectedSectionId);
  const list = [...document.querySelectorAll('#app [data-sec]')];
  if (!list.length) return null;
  const center = window.scrollY + window.innerHeight / 2;
  return list.find((el) => {
    const r = el.getBoundingClientRect();
    return r.top + window.scrollY <= center && r.bottom + window.scrollY >= center;
  }) || list[0];
}

function add(type, assetId = null) {
  // The journal homepage has a full-page canvas as well as section canvases.
  // New accents belong to the full page, so they can cross section borders.
  const sec = document.querySelector('#app > .canvas-page-surface') || targetSection();
  if (!sec) { toast('This page has no editable sections.', 'bad'); return; }
  checkpoint();
  const artwork = type === 'image' ? assets.get(assetId) : null;
  const isWideDecoration = !!(artwork && (artwork.w > artwork.h * 2 || /curtain|cloud|valance|banner|drape/i.test(artwork.name)));
  const freePage = sec.dataset.sec === 'page-surface';
  const bounds = sec.getBoundingClientRect();
  const visibleY = freePage ? clamp((window.innerHeight * .45 - bounds.top) / Math.max(bounds.height, 1) * 100, 2, 96) : 35;
  const item = {
    id: uid(), sectionId: sec.dataset.sec, type, assetId,
    text: type === 'text' ? 'Your text here' : '', x: isWideDecoration ? 0 : 25, y: isWideDecoration ? 0 : visibleY,
    width: type === 'text' ? 260 : 240, fullWidth: isWideDecoration,
    frame: 'none',
    size: 34, color: '#4b2828',
    font: "'Bodoni Moda', serif", weight: 400, italic: false, opacity: 1, rotate: 0,
  };
  change([...data(), item]);
  select(item.id);
}

function elFor(item) {
  const node = document.createElement('div');
  node.className = `canvas-item canvas-${item.type}${item.type === 'image' ? frameClass(item.frame) : ''}${item.locked ? ' is-locked' : ''}`;
  if (item.hidden) node.hidden = true;
  node.dataset.canvasId = item.id;
  // The homepage cloud valance must remain at the top as content below grows.\n  const topCloud = item.fullWidth && item.type === 'image' && activePage === 'home'\n    && /cloud/i.test(`${assets.get(item.assetId)?.name || ''} ${assets.get(item.assetId)?.alt || ''}`);\n  const useBottom = item.fullWidth && !topCloud && Number.isFinite(item.anchorBottom);\n  node.style.cssText = `left:${item.fullWidth ? 0 : clamp(item.x, 0, 100)}%;top:${topCloud ? `${Number.isFinite(item.anchorTop) ? item.anchorTop : 0}px` : useBottom ? 'auto' : `${clamp(item.y, 0, 100)}%`};${useBottom ? `bottom:${item.anchorBottom}px;` : ''}width:${item.fullWidth ? '100%' : `${clamp(item.width, 60, 1200)}px`};opacity:${clamp(item.opacity ?? 1, 0, 1)};transform:rotate(${clamp(item.rotate || 0, -180, 180)}deg)`;
  node.classList.toggle('is-full-width', !!item.fullWidth);
  if (item.type === 'image') {
    const src = assets.src(item.assetId);
    if (src) {
      const img = document.createElement('img');
      img.src = src;
      img.alt = assets.get(item.assetId)?.alt || 'Decorative artwork';
      img.draggable = false;
      img.style.transform = `scale(${item.flipX ? -1 : 1}, ${item.flipY ? -1 : 1})`;
      node.appendChild(img);
    } else node.textContent = 'Missing artwork';
  } else {
    const label = document.createElement('div');
    label.className = 'canvas-text-content';
    label.textContent = item.text;
    label.style.cssText = `font-family:${item.font};font-size:${clamp(item.size, 10, 150)}px;color:${item.color};font-weight:${item.weight};font-style:${item.italic ? 'italic' : 'normal'}`;
    node.appendChild(label);
  }
  const handle = document.createElement('span');
  handle.className = 'canvas-resize';
  handle.title = 'Drag to resize';
  node.appendChild(handle);
  node.classList.toggle('is-selected', editing && selected === item.id);
  if (editing) {
    node.tabIndex = 0;
    node.setAttribute('aria-label', `${item.type === 'text' ? 'Text' : 'Artwork'}: ${item.locked ? 'locked in place; select to unlock' : 'select and drag to move'}`);
    node.addEventListener('pointerdown', (e) => startPointer(e, node, item));
    node.addEventListener('click', (e) => { e.stopPropagation(); select(item.id); });
    node.addEventListener('keydown', (e) => {
      if (item.locked || !['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)) return;
      e.preventDefault();
      const dx = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0;
      const dy = e.key === 'ArrowUp' ? -1 : e.key === 'ArrowDown' ? 1 : 0;
      const step = e.shiftKey ? 5 : 1;
      update(item.id, { x: clamp(item.x + dx * step, 0, 100), y: clamp(item.y + dy * step, 0, 100) });
      [...document.querySelectorAll('.canvas-item')].find(el => el.dataset.canvasId === item.id)?.focus({ preventScroll: true });
    });
  }
  return node;
}

function startPointer(e, node, item) {
  if (e.button !== 0) return;
  if (item.locked) { selected = item.id; panelMode = 'selected'; render(); return; }
  e.preventDefault(); e.stopPropagation();
  selected = item.id;
  panelMode = 'selected';
  document.querySelectorAll('.canvas-item').forEach((n) => n.classList.toggle('is-selected', n === node));
  paintPanel();
  let moved = false;
  const host = node.parentElement;
  const bounds = host.getBoundingClientRect();
  const resize = !item.fullWidth && e.target.classList.contains('canvas-resize');
  const startX = e.clientX, startY = e.clientY;
  const canvasScale = Number(getComputedStyle(document.getElementById('app')).zoom) || 1;
  const topCloud = item.fullWidth && item.type === 'image' && activePage === 'home'\n    && /cloud/i.test(`${assets.get(item.assetId)?.name || ''} ${assets.get(item.assetId)?.alt || ''}`);\n  const origin = { x: item.x, y: item.y, width: item.width, bottom: item.fullWidth ? (bounds.bottom - node.getBoundingClientRect().bottom) / canvasScale : 0, top: topCloud ? (node.getBoundingClientRect().top - bounds.top) / canvasScale : 0 };
  node.setPointerCapture(e.pointerId);
  const move = (ev) => {
    const dx = ev.clientX - startX, dy = ev.clientY - startY;
    if (!moved && Math.abs(dx) + Math.abs(dy) < 3) return;
    if (!moved) { checkpoint(); moved = true; }
    const patch = resize
      ? { width: clamp(origin.width + dx / canvasScale, 60, 1200) }
      : topCloud
        ? { anchorTop: Math.round(origin.top + dy / canvasScale) }
        : item.fullWidth
          ? { anchorBottom: Math.round(origin.bottom - dy / canvasScale) }
        : { x: clamp(origin.x + dx / Math.max(bounds.width, 1) * 100, 0, 100), y: clamp(origin.y + dy / Math.max(bounds.height, 1) * 100, 0, 100) };
    Object.assign(item, patch);
    if (resize) node.style.width = `${patch.width}px`;
    else if (topCloud) { node.style.top = `${patch.anchorTop}px`; node.style.bottom = 'auto'; }
    else if (item.fullWidth) { node.style.top = 'auto'; node.style.bottom = `${patch.anchorBottom}px`; }
    else { node.style.left = `${patch.x}%`; node.style.top = `${patch.y}%`; }
  };
  const stop = () => {
    node.removeEventListener('pointermove', move);
    node.removeEventListener('pointerup', stop);
    node.removeEventListener('pointercancel', stop);
    // Store the pointer result without repainting the editor mid-drag.
    if (moved) change(data().map((i) => i.id === item.id ? { ...item } : i));
  };
  node.addEventListener('pointermove', move);
  node.addEventListener('pointerup', stop);
  node.addEventListener('pointercancel', stop);
}

function attachStatementWidthHandle(textEl, sectionId) {
  if (!editing || textEl.querySelector('.canvas-text-width-handle')) return;
  const statement = textEl.closest('.statement');
  if (!statement) return;
  const handle = document.createElement('span');
  handle.className = 'canvas-text-width-handle';
  handle.title = 'Drag sideways to change text box width';
  handle.setAttribute('role', 'slider');
  handle.setAttribute('aria-label', 'Quote text box width');
  handle.setAttribute('aria-valuemin', '20');
  handle.setAttribute('aria-valuemax', '100');
  handle.setAttribute('tabindex', '0');
  const widthOf = () => Math.round(textEl.getBoundingClientRect().width / Math.max(1, statement.getBoundingClientRect().width) * 100);
  handle.setAttribute('aria-valuenow', String(Math.max(20, Math.min(100, widthOf()))));
  const show = (pct) => {
    const width = Math.max(20, Math.min(100, Math.round(pct)));
    textEl.style.width = width + '%';
    textEl.style.maxWidth = '100%';
    handle.setAttribute('aria-valuenow', String(width));
    return width;
  };
  handle.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const original = widthOf();
    let latest = original;
    let moved = false;
    handle.setPointerCapture(e.pointerId);
    const move = (event) => {
      if (event.pointerId !== e.pointerId) return;
      if (Math.abs(event.clientX - startX) > 2) moved = true;
      latest = show(original + (event.clientX - startX) / Math.max(1, statement.getBoundingClientRect().width) * 100);
    };
    const end = (event) => {
      if (event.pointerId !== e.pointerId) return;
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', end);
      handle.removeEventListener('pointercancel', end);
      if (event.type === 'pointercancel') { show(original); return; }
      if (moved) layout.updateSection(activePage, sectionId, { textBoxWidth: latest })
        .catch(() => toast('Could not save text box width.', 'bad'));
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', end);
    handle.addEventListener('pointercancel', end);
  });
  handle.addEventListener('keydown', (e) => {
    if (!['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
    e.preventDefault();
    e.stopPropagation();
    const next = show(widthOf() + (e.key === 'ArrowRight' ? 5 : -5));
    layout.updateSection(activePage, sectionId, { textBoxWidth: next })
      .catch(() => toast('Could not save text box width.', 'bad'));
  });
  textEl.appendChild(handle);
}

function render({ preservePanel = false } = {}) {
  document.querySelectorAll('.canvas-layer').forEach((el) => el.remove());
  const toolbar = document.getElementById('canvas-toolbar');
  if (toolbar) {
    paintSaveState();
    toolbar.querySelectorAll('[data-canvas="undo"], [data-canvas="redo"]').forEach(button => { button.hidden = !activePage; });
  }
  if (!activePage) {
    const panel = document.getElementById('canvas-panel');
    if (panel && editing) {
      panel.hidden = false;
      panel.innerHTML = '<div class="canvas-panel-head"><strong>DESIGN MODE</strong></div><h3>Keep exploring</h3><p class="canvas-panel-hint">This page has no editable layout sections. Design Mode is still on—visit Journal or another editable page to continue decorating, or choose Done above to leave Design Mode.</p>';
    }
    return;
  }
  document.querySelectorAll('#app [data-sec]').forEach((el) => {
    el.classList.toggle('canvas-section-selected', editing && (panelMode === 'section' || panelMode === 'text') && el.dataset.sec === selectedSectionId);
    el.querySelectorAll('[data-edit]').forEach((textEl) => {
      textEl.classList.toggle('canvas-text-target', editing && panelMode === 'text' && el.dataset.sec === selectedText?.sectionId && textEl.dataset.edit === selectedText?.key);
      if (editing && el.classList.contains('ed-statement') && textEl.dataset.edit === 'text'
          && panelMode === 'text' && el.dataset.sec === selectedText?.sectionId) {
        attachStatementWidthHandle(textEl, el.dataset.sec);
      }
    });
  });
  for (const item of data()) {
    const sec = section(item.sectionId);
    if (!sec) continue;
    let layer = sec.querySelector(':scope > .canvas-layer');
    if (!layer) {
      layer = document.createElement('div');
      layer.className = 'canvas-layer';
      sec.appendChild(layer);
    }
    layer.appendChild(elFor(item));
  }
  if (!preservePanel) paintPanel();
}

function select(id) { selected = id; advancedOpen = false; panelMode = id ? 'selected' : (simplePage ? 'add' : 'sections'); render(); }
export function inspectSection(id) {
  if (!editing || !id || !layout.getSection(activePage, id)) return;
  selectedSectionId = id;
  selected = null;
  panelMode = 'section';
  render();
}
export function inspectText(sectionId, key) {
  if (!editing || !sectionId || !key || !layout.getSection(activePage, sectionId)) return;
  // Challenge banner words are supplied by the challenge record until an
  // override is entered. The generic inline editor would otherwise show an
  // empty box and no styling controls. Open the proper banner Text panel.
  if (layout.getSection(activePage, sectionId).type === 'challengeHero') {
    inspectSection(sectionId);
    document.querySelector('#canvas-panel [data-inspector-tab="content"]')?.click();
    return;
  }
  selectedText = { sectionId, key };
  selectedSectionId = sectionId;
  selected = null;
  panelMode = 'text';
  render();
  document.querySelector('#canvas-inline-text')?.focus();
}
function paintPanel() {
  const panel = document.getElementById('canvas-panel');
  if (!panel || !editing) return;
  const item = data().find((i) => i.id === selected);
  const sectionBadge = (type) => {
    const groups = {
      image: ['hero', 'split', 'collage', 'gallery', 'interlude'],
      writing: ['notebookFeature', 'statement', 'note', 'journalEntries'],
      reading: ['readingNote', 'progress', 'period', 'challenges', 'challengeEligible', 'challengeMarks', 'challengeRecord'],
      books: ['books', 'shelf', 'archive', 'bookmarks', 'word', 'wordShelf', 'challengeHero'],
    };
    const group = Object.keys(groups).find(key => groups[key].includes(type)) || 'writing';
    const marks = { image: '▧', writing: '✎', reading: '◷', books: '▤' };
    const names = { image: 'Visual section', writing: 'Writing section', reading: 'Reading progress', books: 'Book collection' };
    return `<span class="canvas-kind-badge kind-${group}" title="${names[group]}" aria-label="${names[group]}">${marks[group]}</span>`;
  };
  const layerRows = (items) => [...items].reverse().map((x, index, ordered) => `<div class="canvas-layer-row${selected === x.id ? ' is-active' : ''}${x.hidden ? ' is-hidden' : ''}">
    <button class="canvas-layer-name" type="button" data-canvas-select="${esc(x.id)}" aria-label="Edit ${esc(x.label || (x.type === 'text' ? 'text' : 'artwork'))}"><span>${x.locked ? '🔒' : x.type === 'text' ? 'T' : '▧'}</span><span>${esc(x.label || (x.type === 'text' ? x.text.slice(0, 28) : assets.get(x.assetId)?.name || 'Artwork'))}</span></button>
    <span class="canvas-layer-order"><button type="button" data-layer-visible="${esc(x.id)}" aria-label="${x.hidden ? 'Show' : 'Hide'} this layer" aria-pressed="${!x.hidden}" title="${x.hidden ? 'Show layer' : 'Hide layer'}">${x.hidden ? '◌' : '◉'}</button><button type="button" data-layer-move="1" data-layer-id="${esc(x.id)}" aria-label="Bring this layer forward" title="Bring forward" ${index === 0 ? 'disabled' : ''}>↑</button><button type="button" data-layer-move="-1" data-layer-id="${esc(x.id)}" aria-label="Send this layer backward" title="Send backward" ${index === ordered.length - 1 ? 'disabled' : ''}>↓</button></span>
  </div>`).join('');
  panel.hidden = false;
  if (panelMode === 'settings-style' && settingsStyleSelected) { paintSettingsStylePanel(panel); return; }
  if (simplePage && panelMode !== 'selected') {
    panel.innerHTML = `<div class="canvas-panel-head"><strong>${activePage.includes("settings") ? "PAGE DESIGN" : "PAGE ACCENTS"}</strong></div>
      <p class="canvas-panel-hint">${activePage.includes("settings") ? "Click any heading, label or description on this page to change its font, size, weight or color. Forms still work normally." : "Add text or artwork here. Books, forms and lists remain editable through their usual controls."}</p>
      <div class="canvas-panel-tabs"><button type="button" data-canvas="tab-add" class="${panelMode !== 'layers' ? 'active' : ''}">Add</button><button type="button" data-canvas="tab-layers" class="${panelMode === 'layers' ? 'active' : ''}">Layers</button></div>
      ${panelMode === 'layers'
        ? `<div class="canvas-layer-list">${data().length ? layerRows(data()) : '<p>No page accents yet.</p>'}</div>`
        : `<button class="canvas-add-card" type="button" data-canvas="text"><strong>＋ Add text</strong><span>A personal inscription, small caption or note</span></button><button class="canvas-add-card" type="button" data-canvas="image"><strong>＋ Add floating artwork</strong><span>Use a saved image or upload your own</span></button>`}`;
    return;
  }
  if (panelMode === 'text' && selectedText) {
    const sec = layout.getSection(activePage, selectedText.sectionId);
    const field = SECTION_TYPES[sec?.type]?.fields.find((f) => f.key === selectedText.key);
    if (!sec) { panelMode = 'sections'; render(); return; }

    const label = field?.label || selectedText.key.replace(/([A-Z])/g, ' $1');
    const role = roleForKey(selectedText.key, sec.type);
    const currentFont = role ? String(sec[role.font] || '') : '';
    const currentWeight = role ? String(sec[role.weight] || '') : '';
    const currentSize = role ? Math.round((Number(sec[role.size]) || 1) * 100) : 100;
    const currentInk = role ? String(sec[role.ink] || '') : '';
    const fontOptions = FONT_STACKS.map(f => `<option value="${esc(f.value)}" ${f.value === currentFont ? 'selected' : ''}>${esc(f.label)}</option>`).join('');
    panel.innerHTML = `<div class="canvas-panel-head"><strong>EDIT TEXT</strong><button type="button" data-canvas="text-back">← Back</button></div>
      <p class="canvas-section-label">${esc(SECTION_TYPES[sec.type]?.label || 'Section')}<strong>${esc(label)}</strong></p>
      <p class="canvas-panel-hint">Change the words or their styling right here. Your homepage is the preview.</p>
      <div id="canvas-inline-text" class="canvas-inline-text" contenteditable="true" role="textbox" aria-label="${esc(label)}" aria-multiline="${!!field?.multiline}">${rich(sec[selectedText.key] || '')}</div>
      ${role ? `<div class="canvas-text-style-controls">
        <h3>Font &amp; styling</h3>
        <p>Changes other ${esc(role.label.toLowerCase())} in this section too.</p>
        <label>Font
          <select id="canvas-text-font"><option value="" ${!currentFont ? 'selected' : ''}>Match site font</option>
          ${currentFont && !FONT_STACKS.some(f => f.value === currentFont) ? `<option selected value="${esc(currentFont)}">Current custom font</option>` : ''}
          ${fontOptions}</select>
        </label>
        <label>Size <output id="canvas-text-size-value">${currentSize}%</output>
          <input id="canvas-text-size" type="range" min="60" max="200" step="5" value="${currentSize}">
        </label>
        <label>Boldness
          <select id="canvas-text-weight"><option value="" ${!currentWeight ? 'selected' : ''}>Match site</option>
          ${[['400','Regular'],['500','Medium'],['600','Semibold'],['700','Bold'],['800','Extra bold']].map(([w,n]) => `<option value="${w}" ${w===currentWeight?'selected':''}>${n}</option>`).join('')}</select>
        </label>
        <label class="canvas-text-italic"><input id="canvas-text-italic" type="checkbox" ${String(sec[role.italic] || '') === 'italic' ? 'checked' : ''}> Italic</label>
        <label class="canvas-text-color">Text color
          <input id="canvas-text-color" type="color" value="${/^#[a-f0-9]{6}$/i.test(currentInk) ? currentInk : '#49312b'}">
        </label>
        <button class="canvas-text-style-reset" type="button" id="canvas-text-style-reset">Use site styling</button>
      </div>` : '<p class="canvas-panel-hint">For more styling options, open this section.</p>'}
      <button type="button" class="canvas-text-done" data-canvas="text-save">Save text</button>`;
    const input = panel.querySelector('#canvas-inline-text');
    const target = { ...selectedText };
    if (role) {
      const updateStyle = (patch) => {
        layout.updateSection(activePage, target.sectionId, patch).then(() => {
          const block = [...document.querySelectorAll('#app [data-sec]')].find(el => el.dataset.sec === target.sectionId);
          if (block) applySectionVars(block, layout.getSection(activePage, target.sectionId));
        }).catch(() => toast('Could not save that typography change.', 'bad'));
      };
      panel.querySelector('#canvas-text-font').onchange = e => updateStyle({ [role.font]: e.target.value });
      panel.querySelector('#canvas-text-size').oninput = e => {
        const value = Number(e.target.value);
        panel.querySelector('#canvas-text-size-value').textContent = value + '%';
        const block = [...document.querySelectorAll('#app [data-sec]')].find(el => el.dataset.sec === target.sectionId);
        if (block) block.style.setProperty({ Display: '--fz-display', Ui: '--fz-ui', Script: '--fz-script', Body: '--fz-body' }[role.role] || '--fz-body', String(value / 100));
      };
      panel.querySelector('#canvas-text-size').onchange = e => updateStyle({ [role.size]: String(Number(e.target.value) / 100) });
      panel.querySelector('#canvas-text-weight').onchange = e => updateStyle({ [role.weight]: e.target.value });
      panel.querySelector('#canvas-text-italic').onchange = e => updateStyle({ [role.italic]: e.target.checked ? 'italic' : 'normal' });
      panel.querySelector('#canvas-text-color').oninput = e => updateStyle({ [role.ink]: e.target.value });
      panel.querySelector('#canvas-text-style-reset').onclick = () => {
        updateStyle(Object.fromEntries([role.font, role.size, role.weight, role.italic, role.ink].map(k => [k, ''])));
        panel.querySelector('#canvas-text-font').value = '';
        panel.querySelector('#canvas-text-size').value = '100';
        panel.querySelector('#canvas-text-size-value').textContent = '100%';
        panel.querySelector('#canvas-text-weight').value = '';
        panel.querySelector('#canvas-text-italic').checked = false;
      };
    }
    // The page itself is the preview. Update the rendered words during typing
    // without re-rendering the inspector and stealing the caret.
    input.addEventListener('input', () => {
      const block = [...document.querySelectorAll('#app [data-sec]')].find(el => el.dataset.sec === target.sectionId);
      const visible = [...(block?.querySelectorAll('[data-edit]') || [])].find(el => el.dataset.edit === target.key);
      if (visible) {
        visible.innerHTML = rich(richValue(input.innerHTML));
        if (block?.classList.contains('ed-statement') && target.key === 'text')
          attachStatementWidthHandle(visible, target.sectionId);
      }
    });
    const save = async () => {
      const current = layout.getSection(activePage, target.sectionId);
      const next = richValue(input.innerHTML);
      if (current && current[target.key] !== next) {
        await layout.updateSection(activePage, target.sectionId, { [target.key]: next });
      }
    };
    input.addEventListener('blur', () => save().catch(() => toast('Text could not be saved.', 'bad')));
    panel.querySelector('[data-canvas="text-save"]').onclick = () => {
      save().then(() => toast('Text saved.', 'good')).catch(() => toast('Text could not be saved.', 'bad'));
    };
    return;
  }
  if (panelMode === 'section' && selectedSectionId) {
    const sec = layout.getSection(activePage, selectedSectionId);
    if (!sec) { panelMode = 'sections'; selectedSectionId = null; render(); return; }
    const sections = layout.get(activePage).filter((s) => s.visible !== false);
    const order = sections.findIndex((s) => s.id === selectedSectionId) + 1;
    const label = SECTION_TYPES[sec.type]?.label || 'Section';
    panel.innerHTML = `<div class="canvas-panel-head"><strong>Edit section</strong><div class="canvas-panel-actions"><button type="button" data-canvas="section-back">← Page</button><button type="button" data-canvas="section-exit" aria-label="Close section editor">×</button></div></div>
      <div class="canvas-section-inspector"></div>
      <details class="studio-danger"><summary>Remove section</summary><p>Remove ${esc(label)} from this page?</p><button type="button" class="canvas-delete-section" data-canvas="delete-section">Remove ${esc(label)}</button></details>`;
    // Wire navigation at its source. On a small screen the panel is an
    // independently scrollable tray, so delegated document clicks are not a
    // reliable substitute for a working, obvious back/close control.
    const leaveSection = (e) => {
      e.preventDefault();
      e.stopPropagation();
      selectedSectionId = null;
      selectedText = null;
      panelMode = 'sections';
      render();
    };
    panel.querySelector('[data-canvas="section-back"]').addEventListener('click', leaveSection);
    panel.querySelector('[data-canvas="section-exit"]').addEventListener('click', leaveSection);
    openSectionEditor(activePage, selectedSectionId, { mountIn: panel.querySelector('.canvas-section-inspector') });
    return;
  }
  const tabs = `<div class="canvas-panel-tabs">
      <button type="button" data-canvas="tab-sections" class="${panelMode === 'sections' ? 'active' : ''}">Sections</button>
      <button type="button" data-canvas="tab-add" class="${panelMode === 'add' ? 'active' : ''}">Add</button>
      <button type="button" data-canvas="tab-layers" class="${panelMode === 'layers' ? 'active' : ''}">Layers</button>
    </div>`;
  if (panelMode !== 'selected' || !item) {
    panel.innerHTML = `<div class="canvas-panel-head"><strong>Design editor</strong><button type="button" data-canvas="finish" aria-label="Exit design mode">× Exit</button></div>${tabs}` +
      (panelMode === 'sections' ? `<h3>Sections</h3><p class="canvas-panel-hint">Click a section on the page to edit it.</p>
        <div class="canvas-section-list">${layout.get(activePage).filter((s) => s.visible !== false).map((s, i, arr) => `<div class="canvas-section-row" draggable="true" data-section-row="${esc(s.id)}">
          <span class="canvas-section-number" title="Drag to reorder">${sectionBadge(s.type)}</span>
          <button type="button" class="canvas-section-select" data-canvas-section="${esc(s.id)}"><strong>${esc(SECTION_TYPES[s.type]?.label || 'Section')}${arr.filter((x) => x.type === s.type).length > 1 ? ` <em class="canvas-duplicate">${arr.filter((x) => x.type === s.type).findIndex((x) => x.id === s.id) + 1} of ${arr.filter((x) => x.type === s.type).length}</em>` : ''}</strong><small>${esc(String(s.title || s.heading || s.text || SECTION_TYPES[s.type]?.blurb || '').replace(/<[^>]*>/g,'').slice(0,55))}</small></button>
          <span class="canvas-section-moves"><button type="button" data-move-section="${esc(s.id)}" data-move-delta="-1" ${i === 0 ? 'disabled' : ''} aria-label="Move section up">↑</button><button type="button" data-move-section="${esc(s.id)}" data-move-delta="1" ${i === arr.length - 1 ? 'disabled' : ''} aria-label="Move section down">↓</button></span>
        </div>`).join('')}</div>
        <button class="canvas-add-card" type="button" data-canvas="section"><strong>＋ Add section</strong><span>Build out your page</span></button>`
      : panelMode === 'site' ? `<h3>Site identity</h3><p class="canvas-panel-hint">Change your wordmark without editing code.</p>
        <label>Website name<input id="canvas-site-name" value="${esc(theme.getContent().siteName || theme.CONTENT_DEFAULTS.siteName)}"></label>
        <button type="button" data-canvas="save-site">Save website name</button>`
      : panelMode === 'layers' ? `<h3>Layers on this page</h3><p class="canvas-panel-hint">Choose a section or a decorative piece to edit. Artwork that floats across the page is listed separately from artwork attached to a section.</p>
        <p class="canvas-field-group">Page sections</p>
        <div class="canvas-layer-list">${layout.get(activePage).filter(s => s.visible !== false).map((s, index) => {
          const art = ['bgImage','picture','edgeArt','curtainArt','artwork','image'].some(key => !!s[key]);
          return `<button type="button" data-canvas-section="${esc(s.id)}">${sectionBadge(s.type)} &nbsp; ${esc(SECTION_TYPES[s.type]?.label || 'Section')} <small>${index + 1}${art ? ' · artwork' : ''}</small></button>`;
        }).join('')}</div>
        <p class="canvas-field-group">Floating artwork & text</p>
        <div class="canvas-layer-list">${data().some(x => x.sectionId === 'page-surface') ? layerRows(data().filter(x => x.sectionId === 'page-surface')) : '<p class="canvas-panel-hint">No floating elements added yet.</p>'}</div>
        ${data().some(x => x.sectionId !== 'page-surface') ? `<p class="canvas-field-group">Section-attached accents</p><div class="canvas-layer-list">${layerRows(data().filter(x => x.sectionId !== 'page-surface'))}</div>` : ''}`
      : `<h3>Add to this page</h3><p class="canvas-panel-hint">Choose what to add. Select existing pieces directly on the page, or find them in Layers.</p>
        <button class="canvas-add-card" type="button" data-canvas="section"><strong>＋ Section</strong><span>Build a new part of the page</span></button>
        <button class="canvas-add-card" type="button" data-canvas="text"><strong>＋ Text</strong><span>A handwritten note, heading or quote</span></button>
        <button class="canvas-add-card" type="button" data-canvas="image"><strong>＋ Floating artwork</strong><span>Place your own image anywhere on this page</span></button>
        <details class="canvas-more-tools"><summary>More design settings</summary><div class="canvas-panel-links"><a href="#/assets">Picture library</a><a href="#/layout">Page layout</a><a href="#/customize">Site colors & fonts</a></div></details>`);
    return;
  }
  panel.innerHTML = `<div class="canvas-panel-head"><strong>${item.type === 'text' ? 'EDIT TEXT' : 'EDIT ARTWORK'}</strong><button type="button" data-canvas="deselect" aria-label="Back to tools">← Back</button></div>
    <button type="button" class="canvas-lock-action${item.locked ? ' is-locked' : ''}" data-canvas="toggle-lock" aria-pressed="${!!item.locked}"><span aria-hidden="true">${item.locked ? '🔒' : '◇'}</span><strong>${item.locked ? 'Position locked' : 'Lock position & size'}</strong><small>${item.locked ? 'Click to unlock' : 'Prevent accidental moving or resizing'}</small></button>
    ${item.type === 'image' ? `<p class="canvas-panel-hint">Drag the picture on the page to move it. Pull its corner to resize, or adjust the placement here.</p><button type="button" data-canvas="replace-art">Replace picture</button><label>Frame<select data-prop="frame"><option value="none" ${!item.frame || item.frame === 'none' ? 'selected' : ''}>No frame</option><option value="fine" ${item.frame === 'fine' ? 'selected' : ''}>Fine border</option><option value="ornate" ${item.frame === 'ornate' ? 'selected' : ''}>Carved gilt · rectangular</option><option value="gilded-round" ${item.frame === 'gilded-round' ? 'selected' : ''}>Carved gilt · round</option><option value="gilded-oval" ${item.frame === 'gilded-oval' ? 'selected' : ''}>Carved gilt · oval</option><option value="polaroid" ${item.frame === 'polaroid' ? 'selected' : ''}>Photograph mount</option></select></label>` : ''}
    ${item.type === 'text' ? `<label>Text<textarea data-prop="text" rows="2">${esc(item.text)}</textarea></label>
      <label>Font<select data-prop="font">
      ${["'Bodoni Moda', serif", "'Cormorant Garamond', serif", "'EB Garamond', serif", "'Playfair Display', serif", "'Pinyon Script', cursive", "'Imperial Script', cursive", "'Jost', sans-serif"].map((f) => `<option value="${f}" ${f === item.font ? 'selected' : ''}>${f.split("'")[1]}</option>`).join('')}
      </select></label>
      <div class="canvas-panel-row"><label>Size<input data-prop="size" type="number" min="10" max="150" value="${item.size}" ${item.locked ? 'disabled' : ''}></label><label>Color<input data-prop="color" type="color" value="${item.color}"></label></div>
      <div class="canvas-panel-row"><label>Bold<input data-prop="weight" type="checkbox" ${item.weight >= 700 ? 'checked' : ''}></label><label>Italic<input data-prop="italic" type="checkbox" ${item.italic ? 'checked' : ''}></label></div>` : ''}
    ${item.type === 'image' ? `<label class="canvas-check"><input data-prop="fullWidth" type="checkbox" ${item.fullWidth ? 'checked' : ''} ${item.locked ? 'disabled' : ''}> Stretch across the page</label>` : ''}
    ${item.fullWidth ? '' : `<label>Width (px)<input data-prop="width" type="number" min="60" max="1200" value="${Math.round(item.width)}" ${item.locked ? 'disabled' : ''}></label>`}
    <details class="canvas-more-tools" ${advancedOpen ? 'open' : ''}><summary>Fine-tune placement & appearance</summary>
      <label>Layer name <input data-prop="label" type="text" maxlength="60" placeholder="e.g. Left gilded oval" value="${esc(item.label || '')}"></label>
      ${item.type === 'image' ? `<div class="canvas-panel-row canvas-flip-row"><label class="canvas-check"><input data-prop="flipX" type="checkbox" ${item.flipX ? 'checked' : ''}> Flip horizontally</label><label class="canvas-check"><input data-prop="flipY" type="checkbox" ${item.flipY ? 'checked' : ''}> Flip vertically</label></div>` : ''}
      <label>Rotation<input data-prop="rotate" type="number" min="-180" max="180" value="${item.rotate}" ${item.locked ? 'disabled' : ''}></label>
      <label class="canvas-opacity-field">Opacity <output data-opacity-value>${Math.round((item.opacity ?? 1) * 100)}%</output><input data-prop="opacity" type="range" min="0" max="1" step="0.05" value="${item.opacity ?? 1}" style="--opacity-fill:${Math.round((item.opacity ?? 1) * 100)}%"></label>
      ${item.type === 'image' ? `<div class="canvas-panel-row"><label>Left (%)<input data-prop="x" type="number" min="0" max="100" step="0.1" value="${Number(Number(item.x).toFixed(1))}" ${item.locked ? 'disabled' : ''}></label><label>Top (%)<input data-prop="y" type="number" min="0" max="100" step="0.1" value="${Number(Number(item.y).toFixed(1))}" ${item.locked ? 'disabled' : ''}></label></div>
      <div class="canvas-align-buttons"><span>Align horizontally</span><div><button type="button" data-canvas-align="left" ${item.locked || item.fullWidth ? 'disabled' : ''}>Left</button><button type="button" data-canvas-align="center" ${item.locked || item.fullWidth ? 'disabled' : ''}>Center</button><button type="button" data-canvas-align="right" ${item.locked || item.fullWidth ? 'disabled' : ''}>Right</button></div></div>
      <div class="canvas-panel-row"><button type="button" data-canvas="art-backward">Send to back</button><button type="button" data-canvas="art-forward">Bring to front</button></div>` : ''}
      <button type="button" class="canvas-duplicate" data-canvas="duplicate">＋ Duplicate element</button>
    </details>
    <button type="button" class="canvas-remove" data-canvas="remove" title="Remove selected element (Esc)">Remove element <small>Esc</small></button>`;
  panel.querySelector('.canvas-more-tools')?.addEventListener('toggle', (event) => { advancedOpen = event.target.open; });
  panel.querySelectorAll('[data-prop]').forEach((input) => {
    if (['rotate', 'width', 'x', 'y'].includes(input.dataset.prop)) input.addEventListener('input', () => {
      if (input.value === '') return;
      const itemNode = [...document.querySelectorAll('.canvas-item')].find(el => el.dataset.canvasId === item.id);
      if (!itemNode) return;
      const value = Number(input.value);
      if (input.dataset.prop === 'rotate') itemNode.style.transform = `rotate(${value}deg)`;
      else if (input.dataset.prop === 'width') itemNode.style.width = `${value}px`;
      else itemNode.style[input.dataset.prop === 'x' ? 'left' : 'top'] = `${value}%`;
    });
    if (input.dataset.prop === 'opacity') input.addEventListener('input', () => {
      const value = Number(input.value);
      input.style.setProperty('--opacity-fill', `${Math.round(value * 100)}%`);
      const itemNode = [...document.querySelectorAll('.canvas-item')].find(el => el.dataset.canvasId === item.id);
      if (itemNode) itemNode.style.opacity = String(value);
      const output = panel.querySelector('[data-opacity-value]');
      if (output) output.textContent = `${Math.round(value * 100)}%`;
    });
    if (input.dataset.prop === 'text') input.addEventListener('input', () => {
      const itemNode = [...document.querySelectorAll('.canvas-item')].find(el => el.dataset.canvasId === item.id);
      const visible = itemNode?.querySelector('.canvas-text-content');
      if (visible) visible.textContent = input.value;
    });
    input.addEventListener('change', () => {
      const key = input.dataset.prop;
      const value = input.type === 'checkbox' ? (key === 'weight' ? (input.checked ? 700 : 400) : input.checked)
        : input.type === 'number' || input.type === 'range' ? Number(input.value) : input.value;
      if (item[key] === value) return;
      update(item.id, key === 'fullWidth' && value ? { fullWidth: true, x: 0 } : { [key]: value });
    });
  });
}

function picker(onChoose = (id) => add('image', id)) {
  const list = assets.list();
  const modal = document.createElement('div');
  modal.className = 'canvas-picker';
  modal.innerHTML = `<div class="canvas-picker-dialog" role="dialog" aria-modal="true" aria-label="Choose artwork">
    <div class="canvas-panel-head"><strong>Choose artwork</strong><button type="button" data-close>×</button></div>
    <p class="canvas-panel-hint">Your own PNGs stay transparent. Wide curtains and cloud trims are placed across the section automatically; resize or reposition them afterward.</p>
    <label class="canvas-upload-choice">＋ Upload new artwork<input type="file" accept="image/*" class="visually-hidden" data-upload-art></label>
    <div class="canvas-picker-grid"></div></div>`;
  const grid = modal.querySelector('.canvas-picker-grid');
  if (!list.length) grid.innerHTML = '<p class="canvas-panel-hint">No saved artwork yet. Upload an image above to place it immediately.</p>';
  modal.querySelector('[data-upload-art]').onchange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const saved = await assets.add(file, { kind: 'cutout', name: file.name });
      modal.remove();
      onChoose(saved.id);
      toast('Artwork saved to your picture library and placed on this page.', 'good');
    } catch (err) { toast(err.message || 'Could not add that artwork.', 'bad'); }
  };
  for (const asset of list) {
    const b = document.createElement('button');
    b.type = 'button'; b.title = asset.name || 'Artwork';
    const img = document.createElement('img');
    img.src = asset.dataUrl; img.alt = asset.alt || asset.name || 'Artwork';
    b.appendChild(img);
    b.onclick = () => { modal.remove(); onChoose(asset.id); };
    grid.appendChild(b);
  }
  modal.querySelector('[data-close]').onclick = () => modal.remove();
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
  document.body.appendChild(modal);
}

function sectionPicker() {
  const types = typeList(activePage);
  const modal = document.createElement('div');
  modal.className = 'canvas-picker';
  modal.innerHTML = `<div class="canvas-picker-dialog" role="dialog" aria-modal="true" aria-label="Add a section">
    <div class="canvas-panel-head"><strong>Add a section</strong><button type="button" data-close>×</button></div>
    <p class="canvas-panel-hint">Choose a starting point. You can rearrange or edit it afterward.</p>
    <label class="canvas-picker-search-label" for="canvas-section-search">Find a section</label>
    <input id="canvas-section-search" type="search" placeholder="Search by name or description" autocomplete="off">
    <p class="canvas-section-search-count" aria-live="polite"></p>
    <div class="canvas-section-options"></div></div>`;
  const options = modal.querySelector('.canvas-section-options');
  types.forEach((type) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.innerHTML = `<strong>${esc(type.label)}</strong><span>${esc(type.blurb || '')}</span>`;
    b.onclick = async () => {
      b.disabled = true;
      try {
        const created = await layout.addSection(activePage, type.value);
        modal.remove();
        refreshPage();
        if (created) {
          requestAnimationFrame(() => {
            section(created.id)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
            inspectSection(created.id);
          });
        }
        toast('Section added at the bottom of the page.', 'good');
      } catch (_) { b.disabled = false; toast('Could not add this section.', 'bad'); }
    };
    b.dataset.searchText = (type.label + ' ' + (type.blurb || '')).toLowerCase();
    options.appendChild(b);
  });
  const search = modal.querySelector('#canvas-section-search');
  const count = modal.querySelector('.canvas-section-search-count');
  const filter = () => {
    const query = search.value.trim().toLowerCase();
    let visible = 0;
    options.querySelectorAll('button').forEach(button => {
      button.hidden = !button.dataset.searchText.includes(query);
      if (!button.hidden) visible++;
    });
    count.textContent = visible ? `${visible} section${visible === 1 ? '' : 's'} available` : 'No matching sections. Try another word.';
  };
  search.addEventListener('input', filter);
  filter();
  requestAnimationFrame(() => search.focus());
  modal.addEventListener('keydown', e => { if (e.key === 'Escape') modal.remove(); });
  modal.querySelector('[data-close]').onclick = () => modal.remove();
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  document.body.appendChild(modal);
}

// Keep the page's original layout width; scale the entire rendered page only
// while the inspector is open. This is a viewport fit, never a saved design edit.
let canvasFitEnabled = true;
function syncCanvasFit() {
  const app = document.getElementById('app');
  const panel = document.getElementById('canvas-panel');
  if (!app) return;
  const fit = editing && canvasFitEnabled && window.innerWidth > 850 && panel && !panel.hidden;
  if (!fit) {
    app.style.removeProperty('--canvas-fit-scale');
    app.style.removeProperty('--canvas-fit-offset');
    document.body.classList.remove('canvas-fit-page');
  } else {
    const sidebarWidth = panel.getBoundingClientRect().width || 460;
    const offset = Math.ceil(sidebarWidth + 18);
    const scale = Math.min(1, Math.max(.48, (window.innerWidth - offset - 18) / window.innerWidth));
    app.style.setProperty('--canvas-fit-scale', String(scale));
    app.style.setProperty('--canvas-fit-offset', Math.round(offset / scale) + 'px');
    document.body.classList.add('canvas-fit-page');
  }
  const button = document.querySelector('[data-canvas="toggle-fit"]');
  if (button) { button.textContent = canvasFitEnabled ? '100%' : 'Fit page'; button.title = canvasFitEnabled ? 'Show page at actual size' : 'Fit the entire page beside the editor'; }
}
window.addEventListener('resize', syncCanvasFit);

function ensureTools() {
  if (document.getElementById('canvas-toolbar')) return;
  const bar = document.createElement('div');
  bar.id = 'canvas-toolbar'; bar.className = 'canvas-toolbar';
  bar.innerHTML = `<span class="canvas-toolbar-title">DESIGN MODE</span>
    <span class="canvas-save-state">Editing this page · Saved locally</span>
    <button type="button" data-canvas="toggle-fit" title="Show page at actual size">100%</button>
    <button type="button" data-canvas="undo" title="Undo (⌘/Ctrl+Z)" aria-label="Undo">↶</button>
    <button type="button" data-canvas="redo" title="Redo (⌘/Ctrl+Shift+Z or Ctrl+Y)" aria-label="Redo">↷</button>
    <button type="button" data-canvas="finish">Done</button>`;
  const panel = document.createElement('aside');
  panel.id = 'canvas-panel'; panel.className = 'canvas-panel'; panel.hidden = true;
  document.body.append(bar, panel);
  document.addEventListener('click', (e) => {
    if (editing && simplePage && activePage.includes('settings')) {
      const target = e.target.closest('[data-settings-style]');
      if (target && !e.target.closest('input,select,button,[contenteditable]')) {
        e.preventDefault();
        settingsStyleSelected = target.dataset.settingsStyle;
        panelMode = 'settings-style';selected = null;render();return;
      }
    }
    const action = e.target.closest('[data-canvas]')?.dataset.canvas;
    if (!action || !editing) return;
    if (action === 'settings-style-back') {settingsStyleSelected=null;panelMode='add';render();}
    if (action === 'text') add('text');
    if (action === 'image') picker();
    if (action === 'section') sectionPicker();
    if (action === 'replace-art' && selected) picker((assetId) => update(selected, { assetId }));
    if (action === 'duplicate' && selected) duplicateSelected();
    if (action === 'toggle-lock' && selected) {
      const current = data().find(x => x.id === selected);
      if (current) update(selected, { locked: !current.locked });
    }
    if ((action === 'art-forward' || action === 'art-backward') && selected) {
      moveLayerToEdge(selected, action === 'art-forward');
    }
    if (action === 'undo') undo();
    if (action === 'redo') redo();
    if (action === 'tab-sections') { panelMode = 'sections'; selected = null; render(); }
    if (action === 'tab-add') { panelMode = 'add'; selected = null; render(); }
    if (action === 'tab-layers') { panelMode = 'layers'; selected = null; render(); }
    if (action === 'tab-site') { panelMode = 'site'; selected = null; render(); }
    if (action === 'save-site') {
      const name = document.getElementById('canvas-site-name')?.value.trim();
      if (name) theme.setContent('siteName', name).then(() => toast('Site name saved.', 'good'));
    }
    if (action === 'toggle-fit') { canvasFitEnabled = !canvasFitEnabled; syncCanvasFit(); }
    if (action === 'finish') document.getElementById('edit-page')?.click();
    if (action === 'remove' && selected) removeSelected();
    if (action === 'deselect') select(null);
    if (action === 'section-back') { selectedSectionId = null; panelMode = 'sections'; render(); }
    if (action === 'delete-section' && selectedSectionId) {
      const removingId = selectedSectionId;
      const sec = layout.getSection(activePage, removingId);
      confirmSheet({ title: 'Remove this section?', body: `Remove “${SECTION_TYPES[sec?.type]?.label || 'Section'}” from this page? Reading records and books are unaffected. Artwork attached to this section will no longer appear.`, confirm: 'Remove section', danger: true }).then(async (yes) => {
        if (!yes) return;
        await layout.removeSection(activePage, removingId);
        selectedSectionId = null;
        panelMode = 'sections';
        refreshPage();
        toast('Section removed from the page.', 'good');
      });
    }
    if (action === 'text-back') { selectedText = null; panelMode = 'sections'; render(); }
  });
  document.addEventListener('click', (e) => {
    const visibility = e.target.closest('[data-layer-visible]');
    if (editing && visibility) {
      e.preventDefault();
      const item = data().find(x => x.id === visibility.dataset.layerVisible);
      if (item) { panelMode = 'layers'; update(item.id, { hidden: !item.hidden }); }
      return;
    }
    const alignment = e.target.closest('[data-canvas-align]');
    if (editing && alignment) { e.preventDefault(); alignSelected(alignment.dataset.canvasAlign); return; }
    const layerMove = e.target.closest('[data-layer-move]');
    if (editing && layerMove) { e.preventDefault(); moveLayer(layerMove.dataset.layerId, Number(layerMove.dataset.layerMove)); return; }
    const id = e.target.closest('[data-canvas-select]')?.dataset.canvasSelect;
    if (editing && id) select(id);
    const sectionId = e.target.closest('[data-canvas-section]')?.dataset.canvasSection;
    if (editing && sectionId) {
      inspectSection(sectionId);
      section(sectionId)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
    const moveId = e.target.closest('[data-move-section]')?.dataset.moveSection;
    if (editing && moveId) {
      const delta = Number(e.target.closest('[data-move-section]').dataset.moveDelta);
      layout.moveSection(activePage, moveId, delta).then(() => { refreshPage(); toast('Section order updated.', 'good'); });
    }
  });
  let draggedSection = null;
  document.addEventListener('dragstart', (e) => {
    if (!editing) return;
    const row = e.target.closest('[data-section-row]');
    if (!row) return;
    draggedSection = row.dataset.sectionRow;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', draggedSection);
  });
  document.addEventListener('dragover', (e) => {
    if (editing && draggedSection && e.target.closest('[data-section-row]')) e.preventDefault();
  });
  document.addEventListener('drop', (e) => {
    const row = e.target.closest('[data-section-row]');
    if (!editing || !row || !draggedSection) return;
    e.preventDefault();
    const destination = layout.get(activePage).findIndex((s) => s.id === row.dataset.sectionRow);
    const id = draggedSection;
    draggedSection = null;
    layout.reorderSection(activePage, id, destination).then(() => refreshPage());
  });
  document.addEventListener('dragend', () => { draggedSection = null; });
  // A curtain is part of the next section even when painted over the one
  // above. Clicking the cloth selects its actual owner; dragging moves it.
  document.getElementById('app')?.addEventListener('pointerdown', (e) => {
    if (!editing || e.button !== 0) return;
    const curtain = e.target.closest('.ed-curtain');
    const owner = curtain?.closest('[data-sec]');
    if (!curtain || !owner) return;
    const id = owner.dataset.sec;
    const sec = layout.getSection(activePage, id);
    if (!sec || sec.edge !== 'curtain') return;
    e.preventDefault();
    e.stopPropagation();
    const startY = e.clientY;
    const initial = Number(sec.curtainOffset ?? 0);
    let latest = initial;
    let moved = false;
    const move = (event) => {
      if (event.pointerId !== e.pointerId) return;
      const next = Math.max(-200, Math.min(400, Math.round(initial + (event.clientY - startY) / (Number(getComputedStyle(document.getElementById('app')).zoom) || 1))));
      if (Math.abs(event.clientY - startY) > 3) moved = true;
      latest = next;
      owner.style.setProperty('--cur-offset', `${latest}px`);
    };
    const end = (event) => {
      if (event.pointerId !== e.pointerId) return;
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', end);
      document.removeEventListener('pointercancel', end);
      if (event.type === 'pointercancel') { owner.style.setProperty('--cur-offset', `${initial}px`); return; }
      if (!moved) { inspectSection(id); return; }
      layout.updateSection(activePage, id, { curtainOffset: latest }).then(() => inspectSection(id));
    };
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', end);
    document.addEventListener('pointercancel', end);
  });
  document.getElementById('app')?.addEventListener('click', (e) => {
    if (!editing || e.target.closest('[data-edit],.canvas-item,a,button,input,select,textarea,[contenteditable]')) return;
    const sec = e.target.closest('[data-sec]');
    if (!sec) return;
    // Clicking a photograph (or the artwork area of an image hero) opens
    // that section's Images controls immediately, on the homepage too.
    const photoTarget = e.target.closest('img,.m-backdrop,.m-figure,.hero-inset')
      || (sec.classList.contains('ed-hero') && e.target.closest('.hero') && !e.target.closest('.hero-type'));
    inspectSection(sec.dataset.sec);
    if (photoTarget) document.querySelector('#canvas-panel [data-inspector-tab="artwork"]')?.click();
  });
  document.addEventListener('keydown', (e) => {
    if (!editing || !activePage) return;
    if (e.target.closest('input,textarea,select,[contenteditable],[role="dialog"]') || document.querySelector('.canvas-picker')) return;
    if (e.key === 'Escape' && selected) {
      e.preventDefault();
      removeSelected();
      return;
    }
    if (e.key === 'Escape' && (selectedSectionId || selectedText)) {
      e.preventDefault();
      selected = null; selectedSectionId = null; selectedText = null;
      panelMode = simplePage ? 'add' : 'sections';
      render();
      return;
    }
    if (!(e.metaKey || e.ctrlKey)) return;
    const key = e.key.toLowerCase();
    if (key !== 'z' && !(key === 'y' && e.ctrlKey)) return;
    e.preventDefault();
    key === 'y' || e.shiftKey ? redo() : undo();
  });
}

export function setPage(pageId, { simple = false } = {}) { settingsStyleSelected = null; activePage = pageId; simplePage = !!simple; selected = null; selectedSectionId = null; selectedText = null; advancedOpen = false; panelMode = simplePage ? 'add' : 'sections'; history = []; future = []; saveState = 'saved'; render(); }
export function setEditing(next) {
  editing = next;
  if (next) { panelMode = simplePage ? 'add' : 'sections'; settingsStyleSelected = null; selectedSectionId = null; selectedText = null; }
  ensureTools();
  document.body.classList.toggle('canvas-editing', next);
  if (!next) selected = null;
  // paintPanel intentionally does nothing outside editing. Explicitly hide
  // the old panel here or it remains floating over unrelated pages.
  const panel = document.getElementById('canvas-panel');
  if (panel) panel.hidden = !next;
  syncCanvasFit();
  render();
}
export function refresh() { if (activePage) render({ preservePanel: panelMode === 'section' || panelMode === 'text' }); }
