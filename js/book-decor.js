// A small visual collage editor for a single book's literary page.
// Artwork stays attached to its book record, not to the global site theme.
import { getBook, saveBook } from './state.js';
import { esc, attr, toast } from './ui.js';
import * as assets from './assets.js';

const clamp = (n, a, b) => Math.min(b, Math.max(a, n));

export function bookDecorMarkup(book) {
  const pieces = Array.isArray(book.journalDecorations) ? book.journalDecorations : [];
  return `<div class="book-decor-toolbar" id="book-decor-toolbar">
    <button class="btn" type="button" id="book-decor-toggle" aria-expanded="false">✧ Decorate this page</button>
    <div class="book-decor-tools" id="book-decor-tools" hidden>
      <div class="book-decor-add-row">
        <label>Add from your artwork library<select id="book-decor-asset"><option value="">Choose an image…</option>${assets.list().map(a => `<option value="${attr(a.id)}">${esc(a.name)}</option>`).join('')}</select></label>
        <button class="btn" type="button" id="book-decor-add">+ Add image</button>
        <label class="btn" for="book-decor-upload">Upload a new image<input type="file" id="book-decor-upload" accept="image/*" class="visually-hidden"></label>
      </div>
      <div class="book-decor-selected-tools" id="book-decor-selected-tools" hidden>
        <span>Selected image</span>
        <button class="btn" type="button" id="book-decor-smaller" aria-label="Make selected image smaller">− Smaller</button>
        <button class="btn" type="button" id="book-decor-larger" aria-label="Make selected image larger">+ Larger</button>
        <button class="btn" type="button" id="book-decor-remove">Remove</button>
      </div>
      <p>Drag images into place. Click an image to adjust its size. Changes save automatically.</p>
      <button class="btn btn-primary" type="button" id="book-decor-done">Done</button>
    </div>
  </div>
  <div class="book-decor-layer" id="book-decor-layer" aria-label="Decorative imagery">
    ${pieces.map(piece => {
      const source = assets.src(piece.assetId);
      return source ? `<img class="book-decor-piece" data-piece="${attr(piece.id)}" src="${source}" alt="" draggable="false" style="left:${clamp(Number(piece.x)||50,0,100)}%;top:${clamp(Number(piece.y)||20,0,100)}%;width:${clamp(Number(piece.width)||150,70,280)}px">` : '';
    }).join('')}
  </div>`;
}

export function mountBookDecor(root, book) {
  const article = root.querySelector('.book-archive-page');
  const layer = root.querySelector('#book-decor-layer');
  const tools = root.querySelector('#book-decor-tools');
  const toggle = root.querySelector('#book-decor-toggle');
  const assetSelect = root.querySelector('#book-decor-asset');
  const selectionTools = root.querySelector('#book-decor-selected-tools');
  let pieces = [...(Array.isArray(book.journalDecorations) ? book.journalDecorations : [])];
  let selected = null;
  let editing = false;
  let drag = null;

  const save = async () => {
    try { await saveBook({ ...(getBook(book.id) || book), journalDecorations: pieces }); }
    catch (_) { toast('Could not save this decoration.', 'bad'); }
  };
  const select = (id) => {
    selected = id;
    layer.querySelectorAll('.book-decor-piece').forEach(el => el.classList.toggle('selected', el.dataset.piece === id));
    selectionTools.hidden = !id || !editing;
  };
  const paint = () => {
    layer.replaceChildren();
    pieces.forEach(piece => {
      const src = assets.src(piece.assetId);
      if (!src) return;
      const img = document.createElement('img');
      img.className = 'book-decor-piece';
      img.dataset.piece = piece.id;
      img.src = src;
      img.alt = '';
      img.draggable = false;
      img.style.left = `${clamp(Number(piece.x)||50,0,100)}%`;
      img.style.top = `${clamp(Number(piece.y)||20,0,100)}%`;
      img.style.width = `${clamp(Number(piece.width)||150,70,280)}px`;
      layer.append(img);
    });
    select(selected && pieces.some(p => p.id === selected) ? selected : null);
  };
  const setEditing = (next) => {
    editing = !!next;
    article.classList.toggle('book-decor-editing', editing);
    tools.hidden = !editing;
    toggle.setAttribute('aria-expanded', String(editing));
    toggle.textContent = editing ? '✧ Decorating this page' : '✧ Decorate this page';
    if (!editing) select(null);
    else select(selected);
  };
  const add = async (assetId) => {
    if (!assetId) { toast('Choose an image first.'); return; }
    if (pieces.length >= 12) { toast('This page has room for up to 12 decorations.'); return; }
    const piece = { id: `decor_${Date.now()}_${Math.random().toString(36).slice(2,6)}`, assetId,
      x: 82 - (pieces.length % 3) * 10, y: 16 + (pieces.length % 5) * 13, width: 150 };
    pieces.push(piece);
    paint(); select(piece.id);
    await save();
  };

  toggle.onclick = () => setEditing(!editing);
  root.querySelector('#book-decor-done').onclick = () => setEditing(false);
  root.querySelector('#book-decor-add').onclick = () => add(assetSelect.value);
  root.querySelector('#book-decor-upload').onchange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const result = await assets.add(file, { kind: 'artwork', name: file.name });
      const option = document.createElement('option'); option.value = result.id; option.textContent = result.name;
      assetSelect.add(option); assetSelect.value = result.id;
      await add(result.id);
    } catch (_) { toast('Could not upload this artwork.', 'bad'); }
    event.target.value = '';
  };
  const resize = async delta => {
    const piece = pieces.find(p => p.id === selected);
    if (!piece) return;
    piece.width = clamp((Number(piece.width) || 150) + delta, 70, 280);
    paint(); await save();
  };
  root.querySelector('#book-decor-smaller').onclick = () => resize(-30);
  root.querySelector('#book-decor-larger').onclick = () => resize(30);
  root.querySelector('#book-decor-remove').onclick = async () => {
    if (!selected) return;
    pieces = pieces.filter(p => p.id !== selected);
    selected = null; paint(); await save();
  };
  layer.addEventListener('pointerdown', event => {
    if (!editing || !event.target.matches('.book-decor-piece')) return;
    event.preventDefault();
    const img = event.target;
    select(img.dataset.piece);
    drag = { id: selected, pointerId: event.pointerId };
    img.setPointerCapture(event.pointerId);
  });
  layer.addEventListener('pointermove', event => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    const piece = pieces.find(p => p.id === drag.id);
    if (!piece) return;
    const bounds = layer.getBoundingClientRect();
    piece.x = Math.round(clamp((event.clientX - bounds.left) / bounds.width * 100, 3, 97) * 10) / 10;
    piece.y = Math.round(clamp((event.clientY - bounds.top) / bounds.height * 100, 2, 98) * 10) / 10;
    const el = layer.querySelector(`[data-piece="${piece.id}"]`);
    if (el) { el.style.left = `${piece.x}%`; el.style.top = `${piece.y}%`; }
  });
  const finish = async event => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    drag = null;
    await save();
  };
  layer.addEventListener('pointerup', finish);
  layer.addEventListener('pointercancel', finish);
  paint();
}
