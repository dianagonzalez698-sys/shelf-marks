// Freeform layer. Independent of reading records and the existing section data.
// Items belong to a section, so artwork travels with that section when reordered.
import * as store from './store.js';
import * as assets from './assets.js';
import * as theme from './theme.js';
import * as layout from './layout.js';
import { typeList, SECTION_TYPES } from './sections.js';
import { openSectionEditor } from './view-layout.js';
import { esc, rich, richValue, toast, confirmSheet, refresh as refreshPage } from './ui.js';

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
  node.className = `canvas-item canvas-${item.type}${item.type === 'image' ? frameClass(item.frame) : ''}`;
  node.dataset.canvasId = item.id;
  node.style.cssText = `left:${item.fullWidth ? 0 : clamp(item.x, 0, 100)}%;top:${clamp(item.y, 0, 100)}%;width:${item.fullWidth ? '100%' : `${clamp(item.width, 60, 1200)}px`};opacity:${clamp(item.opacity ?? 1, 0, 1)};transform:rotate(${clamp(item.rotate || 0, -180, 180)}deg)`;
  node.classList.toggle('is-full-width', !!item.fullWidth);
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
      const step = e.shiftKey ? 5 : 1;
      update(item.id, { x: clamp(item.x + dx * step, 0, 100), y: clamp(item.y + dy * step, 0, 100) });
      [...document.querySelectorAll('.canvas-item')].find(el => el.dataset.canvasId === item.id)?.focus({ preventScroll: true });
    });
  }
  return node;
}

function startPointer(e, node, item) {
  if (e.button !== 0) return;
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
  const origin = { x: item.x, y: item.y, width: item.width };
  node.setPointerCapture(e.pointerId);
  const move = (ev) => {
    const dx = ev.clientX - startX, dy = ev.clientY - startY;
    if (!moved && Math.abs(dx) + Math.abs(dy) < 3) return;
    if (!moved) { checkpoint(); moved = true; }
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
    if (moved) change(data().map((i) => i.id === item.id ? { ...item } : i));
  };
  node.addEventListener('pointermove', move);
  node.addEventListener('pointerup', stop);
  node.addEventListener('pointercancel', stop);
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
  const layerRows = (items) => items.map((x, index) => `<button type="button" data-canvas-select="${esc(x.id)}">${x.type === 'text' ? 'T' : '▧'} &nbsp; ${esc(x.type === 'text' ? x.text.slice(0, 28) : assets.get(x.assetId)?.name || 'Artwork')} <small>${index + 1}</small></button>`).join('');
  panel.hidden = false;
  if (simplePage && panelMode !== 'selected') {
    panel.innerHTML = `<div class="canvas-panel-head"><strong>PAGE ACCENTS</strong></div>
      <p class="canvas-panel-hint">Add a handwritten note or decorative artwork to this page. Your books, forms and lists stay editable through their usual controls.</p>
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
    panel.innerHTML = `<div class="canvas-panel-head"><strong>EDIT TEXT</strong><button type="button" data-canvas="text-back">← Back</button></div>
      <p class="canvas-section-label">${esc(SECTION_TYPES[sec.type]?.label || 'Section')}<strong>${esc(label)}</strong></p>
      <p class="canvas-panel-hint">Edit these words below. Typography, colors and visual styling are in the section's Style tab.</p>
      <div id="canvas-inline-text" class="canvas-inline-text" contenteditable="true" role="textbox" aria-label="${esc(label)}" aria-multiline="${!!field?.multiline}">${rich(sec[selectedText.key] || '')}</div>
      <button type="button" class="canvas-text-done" data-canvas="text-save">Save text</button>`;
    const input = panel.querySelector('#canvas-inline-text');
    const target = { ...selectedText };
    // The page itself is the preview. Update the rendered words during typing
    // without re-rendering the inspector and stealing the caret.
    input.addEventListener('input', () => {
      const block = [...document.querySelectorAll('#app [data-sec]')].find(el => el.dataset.sec === target.sectionId);
      const visible = [...(block?.querySelectorAll('[data-edit]') || [])].find(el => el.dataset.edit === target.key);
      if (visible) visible.innerHTML = rich(richValue(input.innerHTML));
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
    panel.innerHTML = `<div class="canvas-panel-head"><strong>SECTION ${order} OF ${sections.length}</strong><div class="canvas-panel-actions"><button type="button" data-canvas="section-back">← All sections</button><button type="button" data-canvas="section-exit" aria-label="Exit section editor">×</button></div></div>
      <p class="canvas-section-label">Editing: <strong>${esc(label)}</strong></p>
      <div class="canvas-section-inspector"></div>
      <button type="button" class="canvas-delete-section" data-canvas="delete-section">Remove this section</button>`;
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
    panel.innerHTML = `<div class="canvas-panel-head"><strong>DESIGN STUDIO</strong><button type="button" data-canvas="finish" aria-label="Exit design mode">× Exit</button></div>${tabs}` +
      (panelMode === 'sections' ? `<h3>Your page</h3><p class="canvas-panel-hint">Select any section below—or click an open area of it on the page—to edit it here.</p>
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
    ${item.type === 'image' ? `<p class="canvas-panel-hint">Drag the picture on the page to move it. Pull its corner to resize, or adjust the placement here.</p><button type="button" data-canvas="replace-art">Replace picture</button><label>Frame<select data-prop="frame"><option value="none" ${!item.frame || item.frame === 'none' ? 'selected' : ''}>No frame</option><option value="fine" ${item.frame === 'fine' ? 'selected' : ''}>Fine border</option><option value="ornate" ${item.frame === 'ornate' ? 'selected' : ''}>Carved gilt · rectangular</option><option value="gilded-round" ${item.frame === 'gilded-round' ? 'selected' : ''}>Carved gilt · round</option><option value="gilded-oval" ${item.frame === 'gilded-oval' ? 'selected' : ''}>Carved gilt · oval</option><option value="polaroid" ${item.frame === 'polaroid' ? 'selected' : ''}>Photograph mount</option></select></label>` : ''}
    ${item.type === 'text' ? `<label>Text<textarea data-prop="text" rows="2">${esc(item.text)}</textarea></label>
      <label>Font<select data-prop="font">
      ${["'Bodoni Moda', serif", "'Cormorant Garamond', serif", "'EB Garamond', serif", "'Playfair Display', serif", "'Pinyon Script', cursive", "'Imperial Script', cursive", "'Jost', sans-serif"].map((f) => `<option value="${f}" ${f === item.font ? 'selected' : ''}>${f.split("'")[1]}</option>`).join('')}
      </select></label>
      <div class="canvas-panel-row"><label>Size<input data-prop="size" type="number" min="10" max="150" value="${item.size}"></label><label>Color<input data-prop="color" type="color" value="${item.color}"></label></div>
      <div class="canvas-panel-row"><label>Bold<input data-prop="weight" type="checkbox" ${item.weight >= 700 ? 'checked' : ''}></label><label>Italic<input data-prop="italic" type="checkbox" ${item.italic ? 'checked' : ''}></label></div>` : ''}
    ${item.type === 'image' ? `<label class="canvas-check"><input data-prop="fullWidth" type="checkbox" ${item.fullWidth ? 'checked' : ''}> Stretch across the page</label>` : ''}
    ${item.fullWidth ? '' : `<label>Width (px)<input data-prop="width" type="number" min="60" max="1200" value="${Math.round(item.width)}"></label>`}
    <details class="canvas-more-tools" ${advancedOpen ? 'open' : ''}><summary>Fine-tune placement & appearance</summary>
      <label>Rotation<input data-prop="rotate" type="number" min="-180" max="180" value="${item.rotate}"></label>
      <label class="canvas-opacity-field">Opacity <output data-opacity-value>${Math.round((item.opacity ?? 1) * 100)}%</output><input data-prop="opacity" type="range" min="0" max="1" step="0.05" value="${item.opacity ?? 1}" style="--opacity-fill:${Math.round((item.opacity ?? 1) * 100)}%"></label>
      ${item.type === 'image' ? `<div class="canvas-panel-row"><label>Left (%)<input data-prop="x" type="number" min="0" max="100" step="0.1" value="${Number(Number(item.x).toFixed(1))}"></label><label>Top (%)<input data-prop="y" type="number" min="0" max="100" step="0.1" value="${Number(Number(item.y).toFixed(1))}"></label></div>
      <div class="canvas-panel-row"><button type="button" data-canvas="art-backward">Send backward</button><button type="button" data-canvas="art-forward">Bring forward</button></div>` : ''}
    </details>
    <button type="button" class="canvas-remove" data-canvas="remove">Remove element</button>`;
  panel.querySelector('.canvas-more-tools')?.addEventListener('toggle', (event) => { advancedOpen = event.target.open; });
  panel.querySelectorAll('[data-prop]').forEach((input) => {
    if (['rotate', 'width', 'x', 'y'].includes(input.dataset.prop)) input.addEventListener('input', () => {
      if (input.value === '') return;
      const itemNode = [...document.querySelectorAll('.canvas-item')].find(el => el.dataset.canvasId === item.id);
      if (!itemNode) return;
      const value = Number(input.value);
      input.style.setProperty('--opacity-fill', `${Math.round(value * 100)}%`);
      if (input.dataset.prop === 'rotate') itemNode.style.transform = `rotate(${value}deg)`;
      else if (input.dataset.prop === 'width') itemNode.style.width = `${value}px`;
      else itemNode.style[input.dataset.prop === 'x' ? 'left' : 'top'] = `${value}%`;
    });
    if (input.dataset.prop === 'opacity') input.addEventListener('input', () => {
      const value = Number(input.value);
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
    <button type="button" data-canvas="undo" title="Undo (⌘/Ctrl+Z)" aria-label="Undo">↶</button>
    <button type="button" data-canvas="redo" title="Redo (⌘/Ctrl+Shift+Z or Ctrl+Y)" aria-label="Redo">↷</button>
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
    if (action === 'replace-art' && selected) picker((assetId) => update(selected, { assetId }));
    if ((action === 'art-forward' || action === 'art-backward') && selected) {
      const items = [...data()];
      const from = items.findIndex((x) => x.id === selected);
      const to = from + (action === 'art-forward' ? 1 : -1);
      if (from >= 0 && to >= 0 && to < items.length) { checkpoint(); [items[from], items[to]] = [items[to], items[from]]; change(items); }
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
    if (action === 'finish') document.getElementById('edit-page')?.click();
    if (action === 'remove' && selected) { checkpoint(); change(data().filter((i) => i.id !== selected)); selected = null; render(); }
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
  document.getElementById('app')?.addEventListener('click', (e) => {
    if (!editing || e.target.closest('[data-edit],.canvas-item,a,button,input,select,textarea,[contenteditable]')) return;
    const sec = e.target.closest('[data-sec]');
    if (sec) inspectSection(sec.dataset.sec);
  });
  document.addEventListener('keydown', (e) => {
    if (!editing || !activePage) return;
    if (e.target.closest('input,textarea,select,[contenteditable],[role="dialog"]') || document.querySelector('.canvas-picker')) return;
    if (e.key === 'Escape' && (selected || selectedSectionId || selectedText)) {
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

export function setPage(pageId, { simple = false } = {}) { activePage = pageId; simplePage = !!simple; selected = null; selectedSectionId = null; selectedText = null; advancedOpen = false; panelMode = simplePage ? 'add' : 'sections'; history = []; future = []; saveState = 'saved'; render(); }
export function setEditing(next) {
  editing = next;
  if (next) { panelMode = 'sections'; selectedSectionId = null; selectedText = null; }
  ensureTools();
  document.body.classList.toggle('canvas-editing', next);
  if (!next) selected = null;
  // paintPanel intentionally does nothing outside editing. Explicitly hide
  // the old panel here or it remains floating over unrelated pages.
  const panel = document.getElementById('canvas-panel');
  if (panel) panel.hidden = !next;
  render();
}
export function refresh() { if (activePage) render({ preservePanel: panelMode === 'section' || panelMode === 'text' }); }
