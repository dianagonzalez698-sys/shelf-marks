// My Books: everything finished in the challenge year, newest first, filterable.

import { state, sortedBooks, deleteBook } from './state.js';
import { esc, toast, confirmSheet } from './ui.js';
import { quarters, inPeriod, yearPeriod } from './periods.js';
import { renderSections, SHELF_FLAGS as FLAGS } from './sections.js';
import * as layout from './layout.js';

export const BOOKS_PAGE_ID = 'books';

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

  // The page is its layout: the shelf, the filters and the tally are one
  // section, so the Layouts editor lists exactly what renders here.
  const chips = `<div style="margin-top:1.4rem">
    ${chipRow([{ value: 'all', label: 'All year' }, ...qs.map((q) => ({ value: q.key, label: q.key }))], qKey, 'q', query)}
    ${chipRow([{ value: 'all', label: 'Fiction + nonfiction' }, { value: 'fiction', label: 'Fiction' }, { value: 'nonfiction', label: 'Nonfiction' }], format, 'format', query)}
    ${flagRow(flags, query)}
  </div>`;

  const ctx = { books, totalThisYear, outside, filtered, year, chips };

  return {
    title: '',
    tab: 'books',
    fab: true,
    editorial: true,
    keepScroll: true,
    html: renderSections(layout.get(BOOKS_PAGE_ID), ctx),
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
