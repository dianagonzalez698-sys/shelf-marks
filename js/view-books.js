// My Books: everything finished in the challenge year, newest first, filterable.

import { state, sortedBooks, deleteBook } from './state.js';
import { esc, attr, toast, coverImg, navigate, confirmSheet } from './ui.js';
import { quarters, inPeriod, formatDate, yearPeriod } from './periods.js';

const FLAGS = [
  { key: 'classic', label: 'Classic', field: 'isClassic' },
  { key: 'reread', label: 'Re-read', field: 'isReread' },
  { key: 'tbr', label: 'Physical TBR', field: 'isTbr' },
];

function chipRow(items, currentValue, paramName, query) {
  return `<div class="filters" role="group">${items.map((it) => {
    const next = { ...query };
    if (it.value === 'all') delete next[paramName]; else next[paramName] = it.value;
    const qs = new URLSearchParams(next).toString();
    const on = currentValue === it.value;
    return `<a class="chip${on ? ' on' : ''}" href="#/books${qs ? `?${qs}` : ''}"
      aria-pressed="${on}">${esc(it.label)}</a>`;
  }).join('')}</div>`;
}

function flagRow(activeFlags, query) {
  return `<div class="filters" role="group">${FLAGS.map((f) => {
    const on = activeFlags.includes(f.key);
    const nextFlags = on ? activeFlags.filter((x) => x !== f.key) : [...activeFlags, f.key];
    const next = { ...query };
    if (nextFlags.length) next.flags = nextFlags.join(','); else delete next.flags;
    const qs = new URLSearchParams(next).toString();
    return `<a class="chip${on ? ' on' : ''}" href="#/books${qs ? `?${qs}` : ''}"
      aria-pressed="${on}">${esc(f.label)}</a>`;
  }).join('')}</div>`;
}

function bookRow(book) {
  const bits = [];
  if (book.author) bits.push(book.author);
  if (book.pages) bits.push(`${book.pages} pp`);
  if (book.series) bits.push(book.series);

  const badges = [];
  badges.push(`<span class="badge${book.format === 'nonfiction' ? ' nf' : ''}">${book.format === 'nonfiction' ? 'Nonfiction' : 'Fiction'}</span>`);
  if (book.isClassic) badges.push('<span class="badge cl">Classic</span>');
  if (book.isReread) badges.push('<span class="badge">Re-read</span>');
  if (book.isTbr) badges.push('<span class="badge">Physical TBR</span>');
  (book.tags || []).forEach((t) => badges.push(`<span class="badge">${esc(t)}</span>`));

  return `<article class="book-row">
    <a href="#/book/${encodeURIComponent(book.id)}" style="flex:none" aria-label="Edit ${attr(book.title)}">${coverImg(book)}</a>
    <div class="grow">
      <a href="#/book/${encodeURIComponent(book.id)}" style="color:inherit;text-decoration:none">
        <div class="book-title">${esc(book.title)}</div>
        <div class="book-meta">${esc(bits.join(' · '))}</div>
        <div class="book-meta">Finished ${esc(formatDate(book.dateFinished))}</div>
      </a>
      <div class="badges">${badges.join('')}</div>
    </div>
    <button class="btn btn-ghost btn-sm" type="button" data-del="${attr(book.id)}"
            aria-label="Delete ${attr(book.title)}">Delete</button>
  </article>`;
}

export function booksView(params = {}) {
  const query = params.query || {};
  const year = state.settings.year;
  const qKey = query.q || 'all';
  const format = query.format || 'all';
  const flags = String(query.flags || '').split(',').filter(Boolean);

  const qs = quarters(year);
  let books = sortedBooks().filter((b) => inPeriod(b.dateFinished, yearPeriod(year)));
  const totalThisYear = books.length;

  if (qKey !== 'all') {
    const p = qs.find((x) => x.key === qKey);
    if (p) books = books.filter((b) => inPeriod(b.dateFinished, p));
  }
  if (format !== 'all') books = books.filter((b) => b.format === format);
  for (const key of flags) {
    const f = FLAGS.find((x) => x.key === key);
    if (f) books = books.filter((b) => !!b[f.field]);
  }

  const filtered = flags.length || qKey !== 'all' || format !== 'all';
  const outside = state.books.length - totalThisYear;

  return {
    title: 'My Books',
    tab: 'books',
    fab: true,
    keepScroll: true,
    html: `
      ${chipRow([{ value: 'all', label: 'All year' }, ...qs.map((q) => ({ value: q.key, label: q.key }))], qKey, 'q', query)}
      ${chipRow([{ value: 'all', label: 'Fiction + nonfiction' }, { value: 'fiction', label: 'Fiction' }, { value: 'nonfiction', label: 'Nonfiction' }], format, 'format', query)}
      ${flagRow(flags, query)}

      <p class="small muted" style="margin:.2rem 0 .8rem">
        ${books.length} of ${totalThisYear} book${totalThisYear === 1 ? '' : 's'} in ${year}
        ${filtered ? ` · <a href="#/books">clear filters</a>` : ''}
        ${outside > 0 ? ` · ${outside} logged outside ${year}` : ''}
      </p>

      ${books.length ? `<section class="card">${books.map(bookRow).join('')}</section>` : `
        <div class="empty">
          <h3>${totalThisYear ? 'Nothing matches those filters' : 'No books logged yet'}</h3>
          <p>${totalThisYear ? 'Try clearing a filter.' : `Add the first book you finish in ${year}.`}</p>
          <a class="btn btn-primary" href="${totalThisYear ? '#/books' : '#/add'}">${totalThisYear ? 'Clear filters' : 'Add a book'}</a>
        </div>`}
    `,
    onMount(root) {
      root.querySelectorAll('[data-del]').forEach((btn) => {
        btn.onclick = async () => {
          const id = btn.dataset.del;
          const book = state.books.find((b) => b.id === id);
          if (!book) return;
          const yes = await confirmSheet({
            title: `Delete “${book.title}”?`,
            body: 'It is removed from your list and your goal counts. Bookmarks you already collected stay collected.',
            confirm: 'Delete',
            danger: true,
          });
          if (!yes) return;
          try {
            await deleteBook(id);
            toast('Book deleted.');
          } catch (_) {
            toast('Could not delete that book — storage is unavailable.', 'bad');
          }
        };
      });
    },
  };
}
