// The Library is a collection first; reading goals are a separate lens.
import { state, sortedBooks, saveBook } from './state.js';
import { esc, attr, toast } from './ui.js';

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
  const shelf = STATUS.some(([s]) => s === query.shelf) ? query.shelf : 'all';
  const search = String(query.search || '').trim().toLowerCase();
  const sort = query.sort === 'title' ? 'title' : 'recent';
  const all = sortedBooks();
  const counts = Object.fromEntries(STATUS.map(([key]) => [key, key === 'all' ? all.length : all.filter(b => statusOf(b) === key).length]));
  let shown = all.filter((b) => (shelf === 'all' || statusOf(b) === shelf)
    && (!search || `${b.title} ${b.author} ${(b.tags || []).join(' ')}`.toLowerCase().includes(search)));
  if (sort === 'title') shown.sort((a,b) => a.title.localeCompare(b.title));

  return {
    title: 'My Library', tab: 'books', fab: true, editorial: true, keepScroll: true,
    html: `<div class="literary-shelf">
      <header class="lit-shelf-header"><div><p class="lit-overline">THE PERSONAL LIBRARY / ${state.settings.year}</p>
        <h1>My <em>Bookshelf</em></h1><p>Every book has a place here, whether read, reading, or still waiting.</p></div>
        <a class="lit-primary-action" href="#/add">+ Add a book <span>↗</span></a>
      </header>
      <nav class="lit-shelf-tabs" aria-label="Reading shelves">${STATUS.map(([key,label])=>`<a href="${filterLink(key,query)}" ${shelf === key ? 'class="active" aria-current="page"' : ''}>${label}<span>${counts[key]}</span></a>`).join('')}</nav>
      <div class="lit-shelf-tools"><form id="shelf-search"><label class="visually-hidden" for="shelf-query">Search books</label><input id="shelf-query" placeholder="Search books, authors, or tags…" value="${attr(query.search || '')}"><button type="submit" aria-label="Search">⌕</button></form>
        <label>Sort by <select id="shelf-sort"><option value="recent" ${sort === 'recent' ? 'selected' : ''}>Recently added</option><option value="title" ${sort === 'title' ? 'selected' : ''}>Title A–Z</option></select></label></div>
      <div class="lit-shelf-count">${shown.length} ${shown.length === 1 ? 'BOOK' : 'BOOKS'} ON THIS SHELF</div>
      ${shown.length ? `<div class="lit-shelf-grid">${shown.map((b)=>`<article class="lit-shelf-book">
        <a href="#/book/${encodeURIComponent(b.id)}" class="lit-shelf-cover">${b.coverUrl ? `<img src="${attr(b.coverUrl)}" alt="Cover of ${attr(b.title)}" loading="lazy">` : `<span>${esc(b.title.slice(0,1))}</span>`}</a>
        <div class="lit-shelf-info"><a href="#/book/${encodeURIComponent(b.id)}"><h2>${esc(b.title)}</h2></a><p>${esc(b.author || 'Author unknown')}</p>
          <label class="visually-hidden" for="shelf-status-${attr(b.id)}">Reading status for ${esc(b.title)}</label>
          <select id="shelf-status-${attr(b.id)}" class="lit-shelf-status" data-book-status="${attr(b.id)}">${STATUS.filter(([s])=>s !== 'all').map(([s,label])=>`<option value="${s}" ${statusOf(b) === s ? 'selected' : ''}>${label}</option>`).join('')}</select>
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
    },
  };
}
