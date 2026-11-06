// Freeform layer. Independent of reading records and the existing section data.
// Items belong to a section, so artwork travels with that section when reordered.
import * as store from './store.js';
import * as assets from './assets.js';
import * as theme from './theme.js';
import * as layout from './layout.js';
import { typeList } from './sections.js';
import { esc, toast, refresh as refreshPage } from './ui.js';

const records = new Map();
let activePage = null;
let editing = false;
let selected = null;
let panelMode = 'add';
let history = [];
let future = [];
let saveQueue = Promise.resolve();

const idFor = (page) => `canvas:${page}`;
const clone = (v) => JSON.parse(JSON.stringify(v));
const uid = () => `cv_${crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2)}`;
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const data = () => records.get(idFor(activePage))?.items || [];

export async function load() { adoptMany(await store.getAll('canvas')); }
export function snapshot() { return [...records.values()].map(clone); }
export function adoptMany(rows) {
  records.clear();
  (rows || []).filter((x) => x && x.id && Array.isArray(x.items)).forEach((x) => records.set(x.id, clone(x)));
}

function persist() {
  if (!activePage) return;
  const id = idFor(activePage);
  const row = { id, items: clone(data()), updatedAt: new Date().toISOString() };
  records.set(id, row);
  saveQueue = saveQueue.catch(() => {}).then(() => store.put('canvas', row));
  saveQueue.catch(() => toast('Could not save canvas edits. Export a backup.', 'bad'));
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
function undo() { if (!history.length) return; future.push(clone(data())); change(history.pop()); }
function redo() { if (!future.length) return; history.push(clone(data())); change(future.pop()); }

function section(id) { return [...document.querySelectorAll('#app [data-sec]')].find((el) => el.dataset.sec === id); }
function targetSection() {
  const list = [...document.querySelectorAll('#app [data-sec]')];
  if (!list.length) return null;
  const center = window.scrollY + window.innerHeight / 2;
  return list.find((el) => {
    const r = el.getBoundingClientRect();
    return r.top + window.scrollY <= center && r.bottom + window.scrollY >= center;
  }) || list[0];
}

function add(type, assetId = null) {
  const sec = targetSection();
  if (!sec) { toast('This page has no editable sections.', 'bad'); return; }
  checkpoint();
  const item = {
    id: uid(), sectionId: sec.dataset.sec, type, assetId,
    text: type === 'text' ? 'Your text here' : '', x: 25, y: 35,
    width: type === 'text' ? 260 : 240, size: 34, color: '#4b2828',
    font: "'Bodoni Moda', serif", weight: 400, italic: false, opacity: 1, rotate: 0,
  };
  change([...data(), item]);
  panelMode = 'selected';
  select(item.id);
  sec.scrollIntoView({ block: 'center', behavior: 'smooth' });
}

function elFor(item) {
  const node = document.createElement('div');
  node.className = `canvas-item canvas-${item.type}`;
  node.dataset.canvasId = item.id;
  node.style.cssText = `left:${clamp(item.x, 0, 100)}%;top:${clamp(item.y, 0, 100)}%;width:${clamp(item.width, 60, 1200)}px;opacity:${clamp(item.opacity ?? 1, 0, 1)};transform:rotate(${clamp(item.rotate || 0, -180, 180)}deg)`;
  if (item.type === 'image') {
    const src = assets.src(item.assetId);
    if (src) {
      const img = document.createElement('img');
      img.src = src;
      img.alt = assets.get(item.assetId)?.alt || 'Decorative artwork';
      img.draggable = false;
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
    node.setAttribute('aria-label', `${item.type === 'text' ? 'Text' : 'Artwork'}: select and drag to move`);
    node.addEventListener('pointerdown', (e) => startPointer(e, node, item));
    node.addEventListener('click', (e) => { e.stopPropagation(); select(item.id); });
    node.addEventListener('keydown', (e) => {
      if (!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)) return;
      e.preventDefault();
      const dx = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0;
      const dy = e.key === 'ArrowUp' ? -1 : e.key === 'ArrowDown' ? 1 : 0;
      update(item.id, { x: clamp(item.x + dx, 0, 100), y: clamp(item.y + dy, 0, 100) });
    });
  }
  return node;
}

function startPointer(e, node, item) {
  if (e.button !== 0) return;
  e.preventDefault(); e.stopPropagation();
  selected = item.id;
  document.querySelectorAll('.canvas-item').forEach((n) => n.classList.toggle('is-selected', n === node));
  paintPanel();
  checkpoint();
  const host = node.parentElement;
  const bounds = host.getBoundingClientRect();
  const resize = e.target.classList.contains('canvas-resize');
  const startX = e.clientX, startY = e.clientY;
  const origin = { x: item.x, y: item.y, width: item.width };
  node.setPointerCapture(e.pointerId);
  const move = (ev) => {
    const dx = ev.clientX - startX, dy = ev.clientY - startY;
    const patch = resize
      ? { width: clamp(origin.width + dx, 60, 1200) }
      : { x: clamp(origin.x + dx / Math.max(bounds.width, 1) * 100, 0, 100), y: clamp(origin.y + dy / Math.max(bounds.height, 1) * 100, 0, 100) };
    Object.assign(item, patch);
    if (resize) node.style.width = `${patch.width}px`;
    else { node.style.left = `${patch.x}%`; node.style.top = `${patch.y}%`; }
  };
  const stop = () => {
    node.removeEventListener('pointermove', move);
    node.removeEventListener('pointerup', stop);
    node.removeEventListener('pointercancel', stop);
    // Store the pointer result without repainting the editor mid-drag.
    change(data().map((i) => i.id === item.id ? { ...item } : i));
  };
  node.addEventListener('pointermove', move);
  node.addEventListener('pointerup', stop);
  node.addEventListener('pointercancel', stop);
}

function render() {
  document.querySelectorAll('.canvas-layer').forEach((el) => el.remove());
  if (!activePage) return;
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
  paintPanel();
}

function select(id) { selected = id; panelMode = id ? 'selected' : 'add'; render(); }
function paintPanel() {
  const panel = document.getElementById('canvas-panel');
  if (!panel || !editing) return;
  const item = data().find((i) => i.id === selected);
  panel.hidden = false;
  const tabs = `<div class="canvas-panel-tabs">
      <button type="button" data-canvas="tab-add" class="${panelMode === 'add' ? 'active' : ''}">Add</button>
      <button type="button" data-canvas="tab-layers" class="${panelMode === 'layers' ? 'active' : ''}">Layers</button>
      <button type="button" data-canvas="tab-site" class="${panelMode === 'site' ? 'active' : ''}">Site</button>
    </div>`;
  if (panelMode !== 'selected' || !item) {
    panel.innerHTML = `<div class="canvas-panel-head"><strong>DESIGN STUDIO</strong><span class="canvas-live-dot">● Editing</span></div>${tabs}` +
      (panelMode === 'site' ? `<h3>Site identity</h3><p class="canvas-panel-hint">Change your wordmark without editing code.</p>
        <label>Website name<input id="canvas-site-name" value="${esc(theme.getContent().siteName || theme.CONTENT_DEFAULTS.siteName)}"></label>
        <button type="button" data-canvas="save-site">Save website name</button>
        <div class="canvas-panel-links"><a href="#/customize">Colors & typography</a><a href="#/layout">Page layout</a></div>`
      : panelMode === 'layers' ? `<h3>Elements on this page</h3><p class="canvas-panel-hint">Select a layer to style or move it.</p>
        <div class="canvas-layer-list">${data().length ? data().map((x, index) => `<button type="button" data-canvas-select="${x.id}">${x.type === 'text' ? 'T' : '▧'} &nbsp; ${esc(x.type === 'text' ? x.text.slice(0, 28) : assets.get(x.assetId)?.name || 'Artwork')} <small>${index + 1}</small></button>`).join('') : '<p>No freeform elements yet.</p>'}</div>`
      : `<h3>Make this page yours</h3><p class="canvas-panel-hint">Add something, then drag it anywhere within its section. Click any heading on the page to edit the words directly.</p>
        <button class="canvas-add-card" type="button" data-canvas="section"><strong>＋ Add section</strong><span>Choose a layout, writing feature, gallery, or decorative block</span></button>
        <button class="canvas-add-card" type="button" data-canvas="text"><strong>＋ Add text</strong><span>Headings, notes, labels & quotes</span></button>
        <button class="canvas-add-card" type="button" data-canvas="image"><strong>＋ Add artwork</strong><span>Transparent PNGs, illustrations & photos</span></button>
        <div class="canvas-panel-links"><a href="#/assets">Manage picture library</a><a href="#/layout">Add or arrange sections</a><a href="#/customize">Global colors & fonts</a></div>
        <p class="canvas-panel-hint">Your changes save on this device. Use Settings → Export backup to keep a copy.</p>`);
    return;
  }
  panel.innerHTML = `<div class="canvas-panel-head"><strong>${item.type === 'text' ? 'EDIT TEXT' : 'EDIT ARTWORK'}</strong><button type="button" data-canvas="deselect" aria-label="Back to tools">← Back</button></div>
    ${item.type === 'text' ? `<label>Text<textarea data-prop="text" rows="2">${esc(item.text)}</textarea></label>
      <label>Font<select data-prop="font">
      ${["'Bodoni Moda', serif", "'Cormorant Garamond', serif", "'EB Garamond', serif", "'Playfair Display', serif", "'Pinyon Script', cursive", "'Imperial Script', cursive", "'Jost', sans-serif"].map((f) => `<option value="${f}" ${f === item.font ? 'selected' : ''}>${f.split("'")[1]}</option>`).join('')}
      </select></label>
      <div class="canvas-panel-row"><label>Size<input data-prop="size" type="number" min="10" max="150" value="${item.size}"></label><label>Color<input data-prop="color" type="color" value="${item.color}"></label></div>
      <div class="canvas-panel-row"><label>Bold<input data-prop="weight" type="checkbox" ${item.weight >= 700 ? 'checked' : ''}></label><label>Italic<input data-prop="italic" type="checkbox" ${item.italic ? 'checked' : ''}></label></div>` : ''}
    <div class="canvas-panel-row"><label>Width<input data-prop="width" type="number" min="60" max="1200" value="${Math.round(item.width)}"></label><label>Rotation<input data-prop="rotate" type="number" min="-180" max="180" value="${item.rotate}"></label></div>
    <label>Opacity<input data-prop="opacity" type="range" min="0" max="1" step="0.05" value="${item.opacity}"></label>
    <button type="button" class="canvas-remove" data-canvas="remove">Remove element</button>`;
  panel.querySelectorAll('[data-prop]').forEach((input) => {
    input.addEventListener('change', () => {
      const key = input.dataset.prop;
      const value = input.type === 'checkbox' ? (key === 'weight' ? (input.checked ? 700 : 400) : input.checked)
        : input.type === 'number' || input.type === 'range' ? Number(input.value) : input.value;
      update(item.id, { [key]: value });
    });
  });
}

function picker() {
  const list = assets.list();
  if (!list.length) { toast('Add artwork in Picture Library first.', 'bad'); return; }
  const modal = document.createElement('div');
  modal.className = 'canvas-picker';
  modal.innerHTML = `<div class="canvas-picker-dialog" role="dialog" aria-modal="true" aria-label="Choose artwork">
    <div class="canvas-panel-head"><strong>Choose artwork</strong><button type="button" data-close>×</button></div>
    <div class="canvas-picker-grid"></div></div>`;
  const grid = modal.querySelector('.canvas-picker-grid');
  for (const asset of list) {
    const b = document.createElement('button');
    b.type = 'button'; b.title = asset.name || 'Artwork';
    const img = document.createElement('img');
    img.src = asset.dataUrl; img.alt = asset.alt || asset.name || 'Artwork';
    b.appendChild(img);
    b.onclick = () => { modal.remove(); add('image', asset.id); };
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
    <p class="canvas-panel-hint">Choose a starting point. Every section can be rearranged and edited later.</p>
    <div class="canvas-section-options"></div></div>`;
  const options = modal.querySelector('.canvas-section-options');
  types.forEach((type) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.innerHTML = `<strong>${esc(type.label)}</strong><span>${esc(type.blurb || '')}</span>`;
    b.onclick = async () => {
      b.disabled = true;
      try {
        await layout.addSection(activePage, type.value);
        modal.remove();
        refreshPage();
        toast('Section added. Select Settings on the section to customize it.', 'good');
      } catch (_) { b.disabled = false; toast('Could not add this section.', 'bad'); }
    };
    options.appendChild(b);
  });
  modal.querySelector('[data-close]').onclick = () => modal.remove();
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  document.body.appendChild(modal);
}

function ensureTools() {
  if (document.getElementById('canvas-toolbar')) return;
  const bar = document.createElement('div');
  bar.id = 'canvas-toolbar'; bar.className = 'canvas-toolbar';
  bar.innerHTML = `<span class="canvas-toolbar-title">DESIGN MODE</span>
    <span class="canvas-save-state">Editing this page · Saved locally</span>
    <button type="button" data-canvas="undo" title="Undo">↶</button>
    <button type="button" data-canvas="redo" title="Redo">↷</button>
    <button type="button" data-canvas="finish">Done</button>`;
  const panel = document.createElement('aside');
  panel.id = 'canvas-panel'; panel.className = 'canvas-panel'; panel.hidden = true;
  document.body.append(bar, panel);
  document.addEventListener('click', (e) => {
    const action = e.target.closest('[data-canvas]')?.dataset.canvas;
    if (!action || !editing) return;
    if (action === 'text') add('text');
    if (action === 'image') picker();
    if (action === 'section') sectionPicker();
    if (action === 'undo') undo();
    if (action === 'redo') redo();
    if (action === 'tab-add') { panelMode = 'add'; selected = null; render(); }
    if (action === 'tab-layers') { panelMode = 'layers'; selected = null; render(); }
    if (action === 'tab-site') { panelMode = 'site'; selected = null; render(); }
    if (action === 'save-site') {
      const name = document.getElementById('canvas-site-name')?.value.trim();
      if (name) theme.setContent('siteName', name).then(() => toast('Site name saved.', 'good'));
    }
    if (action === 'finish') document.getElementById('edit-page')?.click();
    if (action === 'remove' && selected) { checkpoint(); change(data().filter((i) => i.id !== selected)); selected = null; render(); }
    if (action === 'deselect') select(null);
  });
  document.addEventListener('click', (e) => {
    const id = e.target.closest('[data-canvas-select]')?.dataset.canvasSelect;
    if (editing && id) select(id);
  });
  document.addEventListener('keydown', (e) => {
    if (!editing || !(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'z') return;
    if (e.target.closest('input,textarea,[contenteditable]')) return;
    e.preventDefault(); e.shiftKey ? redo() : undo();
  });
}

export function setPage(pageId) { activePage = pageId; selected = null; history = []; future = []; render(); }
export function setEditing(next) {
  editing = next;
  if (next) panelMode = 'add';
  ensureTools();
  document.body.classList.toggle('canvas-editing', next);
  if (!next) selected = null;
  render();
}
export function refresh() { if (activePage) render(); }
