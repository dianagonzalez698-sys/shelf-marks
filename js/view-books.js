// The Library is a collection first; reading goals are a separate lens.
import { state, sortedBooks, saveBook, saveSettings, uid } from './state.js';
import { esc, attr, toast, confirmSheet } from './ui.js';
import * as assets from './assets.js';

export const BOOKS_PAGE_ID = 'books';
export const STATUS = [
  ['all', 'All books'], ['want', 'Want to read'], ['reading', 'Currently reading'],
  ['read', 'Read'], ['dnf', 'Did not finish'],
];
const statusOf = (b) => b.status || (b.dateFinished ? 'read' : 'want');

function filterLink(status, query) {
  const next = {...query};
  if (status === 'all') delete next.shelf; else next.shelf = status;
  const qs = new URLSearchParams(next).toString();
  return `#/books${qs ? `?${qs}` : ''}`;
}

export function booksView(params = {}) {
  const query = params.query || {};
  const customShelves = Array.isArray(state.settings.customShelves) ? state.settings.customShelves : [];
  const shelfChoices = [...STATUS, ...customShelves.map((s) => [`custom:${s.id}`, s.name])];
  const shelf = shelfChoices.some(([s]) => s === query.shelf) ? query.shelf : 'all';
  const search = String(query.search || '').trim().toLowerCase();
  const sort = query.sort === 'title' ? 'title' : 'recent';
  const all = sortedBooks();
  const onShelf = (b, key) => key === 'all' || (key.startsWith('custom:')
    ? (b.shelves || []).includes(key.slice(7)) : statusOf(b) === key);
  const counts = Object.fromEntries(shelfChoices.map(([key]) => [key, all.filter(b => onShelf(b,key)).length]));
  let shown = all.filter((b) => onShelf(b, shelf)
    && (!search || `${b.title} ${b.author} ${(b.tags || []).join(' ')}`.toLowerCase().includes(search)));
  if (sort === 'title') shown.sort((a,b) => a.title.localeCompare(b.title));

  return {
    title: 'My Library', tab: 'books', fab: true, editorial: true, keepScroll: true,
    html: `<div class="literary-shelf">
      <header class="lit-shelf-header"><div><p class="lit-overline">THE PERSONAL LIBRARY / ${state.settings.year}</p>
        <h1>My <em>Bookshelf</em></h1><p>Every book has a place here, whether read, reading, or still waiting.</p></div>
        <a class="lit-primary-action" href="#/add">+ Add a book <span>↗</span></a>
      </header>
      <nav class="lit-shelf-tabs" aria-label="Reading shelves">${shelfChoices.map(([key,label])=>`<a href="${filterLink(key,query)}" ${shelf === key ? 'class="active" aria-current="page"' : ''}>${esc(label)}<span>${counts[key]}</span></a>`).join('')}</nav>
      <div class="lit-custom-shelves"><details id="shelf-manager"><summary>＋ Create or manage shelves</summary>
        <form id="shelf-create"><label for="shelf-name">New shelf name</label><div><input id="shelf-name" maxlength="45" placeholder="e.g. Cozy mysteries" required><button type="submit">Create shelf</button></div></form>
        ${customShelves.length ? `<div class="lit-shelf-manage-list">${customShelves.map((s)=>`<div><span>${esc(s.name)}</span><button type="button" data-delete-shelf="${attr(s.id)}" aria-label="Remove shelf ${attr(s.name)}">Remove</button></div>`).join('')}</div>` : '<p class="hint">Your own shelves can hold books from any reading status.</p>'}
      </details></div>
      <div class="lit-shelf-tools"><form id="shelf-search"><label class="visually-hidden" for="shelf-query">Search books</label><input id="shelf-query" placeholder="Search books, authors, or tags…" value="${attr(query.search || '')}"><button type="submit" aria-label="Search">⌕</button></form>
        <label>Sort by <select id="shelf-sort"><option value="recent" ${sort === 'recent' ? 'selected' : ''}>Recently added</option><option value="title" ${sort === 'title' ? 'selected' : ''}>Title A–Z</option></select></label></div>
      <div class="lit-shelf-count">${shown.length} ${shown.length === 1 ? 'BOOK' : 'BOOKS'} ON THIS SHELF</div>
      ${shown.length ? `<div class="lit-shelf-grid">${shown.map((b)=>`<article class="lit-shelf-book">
        <a href="#/book/${encodeURIComponent(b.id)}" class="lit-shelf-cover">${assets.src(b.customCoverAssetId) || b.coverUrl ? `<img src="${attr(assets.src(b.customCoverAssetId) || b.coverUrl)}" alt="Cover of ${attr(b.title)}" loading="lazy">` : `<span>${esc(b.title.slice(0,1))}</span>`}</a>
        <div class="lit-shelf-info"><a href="#/book/${encodeURIComponent(b.id)}"><h2>${esc(b.title)}</h2></a><p>${esc(b.author || 'Author unknown')}</p>
          <label class="visually-hidden" for="shelf-status-${attr(b.id)}">Reading status for ${esc(b.title)}</label>
          <select id="shelf-status-${attr(b.id)}" class="lit-shelf-status" data-book-status="${attr(b.id)}">${STATUS.filter(([s])=>s !== 'all').map(([s,label])=>`<option value="${s}" ${statusOf(b) === s ? 'selected' : ''}>${label}</option>`).join('')}</select>
          ${customShelves.length ? `<details class="lit-book-shelves"><summary>Personal shelves ${(b.shelves || []).filter(id=>customShelves.some(s=>s.id===id)).length ? `· ${(b.shelves || []).filter(id=>customShelves.some(s=>s.id===id)).length}` : ''}</summary>
            ${customShelves.map((s)=>`<label><input type="checkbox" data-book-shelf="${attr(b.id)}" value="${attr(s.id)}" ${(b.shelves || []).includes(s.id) ? 'checked' : ''}>${esc(s.name)}</label>`).join('')}
          </details>` : ''}
        </div></article>`).join('')}</div>` : `<div class="lit-empty-shelf"><span>Ⅰ &nbsp; Ⅱ &nbsp; Ⅲ</span><p>${search ? 'No books matched that search.' : 'A lovely shelf waiting to be filled.'}</p><a href="#/add">ADD A BOOK ↗</a></div>`}
    </div>`,
    onMount(root) {
      const form = root.querySelector('#shelf-search');
      const move = (patch) => {
        const next = {...query,...patch};
        Object.keys(next).forEach(k => { if (!next[k]) delete next[k]; });
        const qs = new URLSearchParams(next).toString();
        location.hash = `#/books${qs ? `?${qs}` : ''}`;
      };
      form.onsubmit = (e) => { e.preventDefault(); move({search:root.querySelector('#shelf-query').value.trim()}); };
      root.querySelector('#shelf-sort').onchange = (e) => move({sort:e.target.value === 'recent' ? '' : 'title'});
      root.querySelectorAll('[data-book-status]').forEach(select => {
        select.onchange = async () => {
          const book = state.books.find(b => b.id === select.dataset.bookStatus);
          if (!book) return;
          try {
            await saveBook({...book,status:select.value,
              previousFinishDate: select.value === 'read' ? (book.previousFinishDate || '') : (book.dateFinished || book.previousFinishDate || ''),
              dateFinished: select.value === 'read' ? (book.dateFinished || book.previousFinishDate || '') : ''});
            toast('Shelf updated.', 'good');
          } catch (_) { toast('Could not update this book.', 'bad'); }
        };
      });
      root.querySelector('#shelf-create').onsubmit = async (e) => {
        e.preventDefault();
        const name = root.querySelector('#shelf-name').value.trim();
        if (!name) return;
        if (customShelves.some(s=>s.name.toLocaleLowerCase() === name.toLocaleLowerCase())) {
          toast('That shelf already exists.', 'bad'); return;
        }
        try {
          await saveSettings({ customShelves: [...customShelves, { id: uid('shelf'), name }] });
          toast(`“${name}” shelf created.`, 'good');
        } catch (_) { toast('Could not create the shelf.', 'bad'); }
      };
      root.querySelectorAll('[data-delete-shelf]').forEach(button => {
        button.onclick = async () => {
          const s = customShelves.find(x=>x.id===button.dataset.deleteShelf);
          if (!s) return;
          if (!await confirmSheet({title:`Remove “${s.name}”?`,body:'Books stay in your library and keep their reading statuses. Only this personal shelf is removed.',confirm:'Remove shelf',danger:true})) return;
          await saveSettings({customShelves:customShelves.filter(x=>x.id!==s.id)});
          if (shelf === `custom:${s.id}`) location.hash = '#/books';
        };
      });
      root.querySelectorAll('[data-book-shelf]').forEach(box => {
        box.onchange = async () => {
          const book = state.books.find(b=>b.id===box.dataset.bookShelf);
          if (!book) return;
          const shelves = new Set(book.shelves || []);
          if (box.checked) shelves.add(box.value); else shelves.delete(box.value);
          try { await saveBook({...book,shelves:[...shelves]}); }
          catch (_) { box.checked = !box.checked; toast('Could not update this shelf.', 'bad'); }
        };
      });
    },
  };
}
