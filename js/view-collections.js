import { allChallenges, bookmarkStats, state, saveSettings, uid } from './state.js';
import { esc, attr, toast, openSheet } from './ui.js';
import * as assets from './assets.js';

const FEATURES = [
  {id:'challenges',number:'I',label:'READING PROJECTS',title:'Reading Challenges',description:'Little promises made to the books still waiting.',href:'#/challenges',ornament:'✳'},
  {id:'bookmarks',number:'II',label:'KEEPSAKES',title:'Collected Bookmarks',description:'A small museum of reading milestones.',href:'#/bookmarks',ornament:'❧'},
  {id:'words',number:'III',label:'LANGUAGE',title:'Words of the Year',description:'Curious words, gathered like pressed flowers.',href:'#/words',ornament:'✦'},
];
const TONES = [['paper','Original ivory'],['sage','Sage'],['rose','Rose'],['blue','Pale blue'],['ochre','Warm ochre']];
const countFor = (id,marks) => id === 'challenges' ? `${allChallenges().length} challenges` : id === 'bookmarks' ? `${marks.collected} / ${marks.total} collected` : `${state.words.length} words`;
const assetPicker = (id) => `<option value="">No cover image</option>${assets.list().map(a=>`<option value="${attr(a.id)}" ${id === a.id ? 'selected' : ''}>${esc(a.name || 'Untitled image')}</option>`).join('')}`;
const shelfHref = (id) => `#/books?shelf=${encodeURIComponent(`custom:${id}`)}`;

export function collectionsView() {
  const marks = bookmarkStats();
  const shelves = Array.isArray(state.settings.customShelves) ? state.settings.customShelves : [];
  const featureDesign = state.settings.collectionDesign || {};
  const items = [...FEATURES.map(f=>({...f,...featureDesign[f.id],type:'feature'})), ...shelves.map(s=>({...s,type:'shelf',title:s.name,label:'PERSONAL SHELF',href:shelfHref(s.id),description:s.description || 'A personal collection, still growing.',ornament:'❦'}))];
  const booksOn = (id) => state.books.filter(b=>(b.shelves || []).includes(id));
  const cover = (item) => assets.src(item.coverAssetId);
  const card = (item,index) => `<a class="lit-cabinet-piece lit-cabinet-${item.type}" data-collection-id="${attr(item.id)}" data-collection-tone="${attr(item.tone || 'paper')}" href="${attr(item.href)}">
    <div class="lit-cabinet-art" data-collection-art="${attr(item.id)}">${cover(item) ? `<img src="${attr(cover(item))}" alt="" loading="lazy">` : `<span class="lit-cabinet-ornament" aria-hidden="true">${item.ornament}</span>`}<span class="lit-cabinet-art-edit" aria-hidden="true">Change image</span></div>
    <div class="lit-cabinet-copy"><span class="lit-cabinet-index">${item.type === 'feature' ? item.number : String(index - FEATURES.length + 1).padStart(2,'0')} &nbsp; / &nbsp; ${esc(item.label)}</span>
      <h2 data-preview-title="${attr(item.id)}">${esc(item.title)}</h2><p data-preview-description="${attr(item.id)}">${esc(item.description)}</p>
      <small>${item.type === 'feature' ? esc(countFor(item.id,marks)) : `${booksOn(item.id).length} ${booksOn(item.id).length === 1 ? 'book' : 'books'}`} <span aria-hidden="true">↗</span></small></div>
  </a>`;
  const editor = (item) => `<details class="lit-curation-item" data-editor="${attr(item.id)}"><summary>${esc(item.title)} <span>${item.type === 'shelf' ? 'Personal shelf' : 'Collection'}</span></summary>
    <div class="lit-curation-fields">${item.type === 'shelf' ? `<label>Shelf name<input maxlength="45" data-edit-field="name" data-item-id="${attr(item.id)}" value="${attr(item.name)}"></label>` : ''}
      <label>Description<input maxlength="140" data-edit-field="description" data-item-id="${attr(item.id)}" value="${attr(item.description)}"></label>
      <label>Paper color<select data-edit-field="tone" data-item-id="${attr(item.id)}">${TONES.map(([value,label])=>`<option value="${value}" ${(item.tone || 'paper') === value ? 'selected' : ''}>${label}</option>`).join('')}</select></label>
      <label>Cover artwork<select data-edit-field="coverAssetId" data-item-id="${attr(item.id)}">${assetPicker(item.coverAssetId)}</select></label>
      <label>Upload artwork<input type="file" accept="image/*" data-cover-upload="${attr(item.id)}"></label>
      ${item.type === 'shelf' ? `<div class="lit-curation-order"><button type="button" data-move-shelf="${attr(item.id)}" data-shift="-1">Move earlier ↑</button><button type="button" data-move-shelf="${attr(item.id)}" data-shift="1">Move later ↓</button></div>` : ''}
    </div></details>`;

  return {
    title:'Collections',tab:'collections',fab:false,keepScroll:true,
    html:`<div class="literary-notebook lit-collections lit-cabinet">
      <header class="lit-page-heading lit-cabinet-heading"><p class="lit-overline">THE CABINET OF CURIOSITIES</p><h1>Collected Things</h1>
        <p>A personal archive of little fascinations, literary projects, and books kept close.</p></header>
      <div class="lit-cabinet-section-head"><span>THE COLLECTIONS</span><span>${FEATURES.length} CURATED ROOMS</span></div>
      <div class="lit-cabinet-grid">${items.filter(item=>item.type==='feature').map(card).join('')}</div>
      <div class="lit-cabinet-section-head lit-cabinet-shelf-head"><span>PERSONAL SHELVES</span><span>${shelves.length} ${shelves.length === 1 ? 'SHELF' : 'SHELVES'}</span></div>
      ${shelves.length ? `<div class="lit-cabinet-grid lit-cabinet-personal">${items.filter(item=>item.type==='shelf').map((item,i)=>card(item,i + FEATURES.length)).join('')}</div>` : `<div class="lit-cabinet-empty"><span>✧</span><p>A place for favorite categories—cozy mysteries, rereads, treasured covers, or whatever catches your fancy.</p><a href="#/books">Visit the library ↗</a></div>`}
      <details class="lit-curation-tools" id="lit-curation-tools"><summary>✧ Organize & personalize</summary><div class="lit-curation-body">
        <p>Make each collection your own. Covers and paper colors stay independent; your books and reading records are unchanged.</p>
        <form id="lit-curation-create"><label for="lit-new-shelf">New personal shelf</label><div><input id="lit-new-shelf" required maxlength="45" placeholder="e.g. Cozy mysteries"><button type="submit">Create shelf</button></div></form>
        <div class="lit-curation-editor-list">${items.map(editor).join('')}</div>
      </div></details>
    </div>`,
    onMount(root) {
      const tools = root.querySelector('#lit-curation-tools');
      const openEditorKey = 'dlp:collections-editor';
      try { const id = sessionStorage.getItem(openEditorKey); if (id) { tools.open = true; const editor = [...root.querySelectorAll('[data-editor]')].find(el=>el.dataset.editor===id); if (editor) editor.open = true; } } catch (_) { /* optional */ }
      root.querySelectorAll('[data-editor]').forEach(details => details.addEventListener('toggle', () => {
        if (details.open) try { sessionStorage.setItem(openEditorKey,details.dataset.editor); } catch (_) { /* optional */ }
      }));
      const update = async (id,patch) => {
        const currentShelves = state.settings.customShelves || [];
        const personal = currentShelves.some(s=>s.id===id);
        try {
          if (personal) await saveSettings({customShelves:currentShelves.map(s=>s.id===id ? {...s,...patch} : s)});
          else await saveSettings({collectionDesign:{...(state.settings.collectionDesign || {}),[id]:{...(state.settings.collectionDesign?.[id] || {}),...patch}}});
          toast('Collection updated.','good');
          return true;
        } catch (_) { toast('Could not update the collection.','bad'); return false; }
      };
      // In Design Mode, the picture itself is its editor. This also works
      // for the three built-in collections and every personal shelf.
      const openCoverPicker = (id) => {
        const currentItem = items.find(item => item.id === id);
        if (!currentItem) return;
        const savedImages = assets.list();
        openSheet(`
          <h2>Artwork for ${esc(currentItem.title)}</h2>
          <p class="hint">Choose a saved picture or upload a new one. Only this collection changes.</p>
          <div class="lit-collection-picker-grid">
            ${savedImages.map(image => `<button type="button" data-cover-choose="${attr(image.id)}"
                class="lit-collection-picker-choice${currentItem.coverAssetId === image.id ? ' is-selected' : ''}"
                aria-label="Use ${attr(image.name || 'this artwork')} for ${attr(currentItem.title)}"
                aria-pressed="${currentItem.coverAssetId === image.id}">
              <img src="${attr(image.dataUrl)}" alt="" loading="lazy"><span>${esc(image.name || 'Untitled')}</span>
            </button>`).join('')}
          </div>
          <label class="lit-collection-upload-label">＋ Upload new artwork
            <input type="file" accept="image/*" data-collection-picker-upload>
          </label>
          <div class="btn-row lit-collection-picker-footer">
            <button type="button" class="btn" data-collection-picker-clear>Remove image</button>
            <button type="button" class="btn btn-primary" data-close>Done</button>
          </div>
        `, {
          onMount(sheet, close) {
            const choose = async (assetId) => {
              const previous = currentItem.coverAssetId || '';
              // Update this image immediately, then persist through the same
              // collection setting as the existing Manage Collections editor.
              const card = [...root.querySelectorAll('[data-collection-id]')].find(node => node.dataset.collectionId === id);
              const art = card?.querySelector('[data-collection-art]');
              const image = assets.src(assetId);
              if (art) {
                art.querySelector('img, .lit-cabinet-ornament')?.remove();
                const node = document.createElement(image ? 'img' : 'span');
                if (image) { node.src = image; node.alt = ''; }
                else { node.className = 'lit-cabinet-ornament'; node.textContent = currentItem.ornament; }
                art.prepend(node);
              }
              try {
                const stored = await update(id, { coverAssetId: assetId });
                if (!stored) throw new Error('Save failed');
                currentItem.coverAssetId = assetId;
                close();
              } catch (_) {
                if (art) {
                  art.querySelector('img, .lit-cabinet-ornament')?.remove();
                  const previousSrc = assets.src(previous);
                  const node = document.createElement(previousSrc ? 'img' : 'span');
                  if (previousSrc) { node.src = previousSrc; node.alt = ''; }
                  else { node.className = 'lit-cabinet-ornament'; node.textContent = currentItem.ornament; }
                  art.prepend(node);
                }
              }
            };
            sheet.querySelectorAll('[data-cover-choose]').forEach(button => {
              button.onclick = () => choose(button.dataset.coverChoose);
            });
            sheet.querySelector('[data-collection-picker-clear]').onclick = () => choose('');
            sheet.querySelector('[data-collection-picker-upload]').onchange = async event => {
              const file = event.target.files?.[0];
              if (!file) return;
              try {
                const image = await assets.add(file, { kind: 'artwork' });
                await choose(image.id);
              } catch (_) { toast('Could not upload that picture.', 'bad'); }
            };
          },
        });
      };
      // Capture only artwork clicks during Design Mode. Normal card links
      // keep their usual navigation when Design Mode is off.
      root.querySelectorAll('[data-collection-art]').forEach(art => {
        art.addEventListener('click', event => {
          if (!document.body.classList.contains('canvas-editing')) return;
          event.preventDefault();
          event.stopPropagation();
          openCoverPicker(art.dataset.collectionArt);
        });
      });
      root.querySelector('#lit-curation-create').addEventListener('submit', async e => {
        e.preventDefault();
        const name = root.querySelector('#lit-new-shelf').value.trim();
        if (!name) return;
        const current = state.settings.customShelves || [];
        if (current.some(s=>s.name.toLocaleLowerCase()===name.toLocaleLowerCase())) { toast('That shelf already exists.','bad'); return; }
        const id = uid('shelf');
        try { sessionStorage.setItem(openEditorKey,id); } catch (_) { /* optional */ }
        try { await saveSettings({customShelves:[...current,{id,name,description:'',tone:'paper'}]}); toast('Shelf created.','good'); }
        catch (_) { toast('Could not create the shelf.','bad'); }
      });
      root.querySelectorAll('[data-edit-field]').forEach(input => {
        input.addEventListener('input', () => {
          const id = input.dataset.itemId;
          if (input.dataset.editField === 'name') { const node = [...root.querySelectorAll('[data-preview-title]')].find(x=>x.dataset.previewTitle===id); if (node) node.textContent=input.value; }
          if (input.dataset.editField === 'description') { const node = [...root.querySelectorAll('[data-preview-description]')].find(x=>x.dataset.previewDescription===id); if (node) node.textContent=input.value; }
          if (input.dataset.editField === 'tone') { const node = [...root.querySelectorAll('[data-collection-id]')].find(x=>x.dataset.collectionId===id); if (node) node.dataset.collectionTone=input.value; }
        });
        input.addEventListener('change', () => {
          const value = input.value.trim();
          if (input.dataset.editField === 'name' && !value) { toast('A shelf needs a name.','bad'); return; }
          update(input.dataset.itemId,{[input.dataset.editField]:value});
        });
      });
      root.querySelectorAll('[data-cover-upload]').forEach(input => input.addEventListener('change', async () => {
        const file = input.files?.[0]; if (!file) return;
        try { const a = await assets.add(file,{kind:'artwork'}); await update(input.dataset.coverUpload,{coverAssetId:a.id}); }
        catch (_) { toast('Could not upload that artwork.','bad'); }
      }));
      root.querySelectorAll('[data-move-shelf]').forEach(button => button.addEventListener('click', async () => {
        const current = [...(state.settings.customShelves || [])];
        const from = current.findIndex(s=>s.id===button.dataset.moveShelf);
        const to = from + Number(button.dataset.shift);
        if (from < 0 || to < 0 || to >= current.length) return;
        [current[from],current[to]] = [current[to],current[from]];
        try { await saveSettings({customShelves:current}); toast('Shelf order updated.','good'); } catch (_) { toast('Could not rearrange shelves.','bad'); }
      }));
    },
  };
}
