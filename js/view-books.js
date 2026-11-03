// My Books: everything finished in the challenge year, newest first, filterable.

import { state, sortedBooks, deleteBook } from './state.js';
import { esc, attr, toast, coverImg, confirmSheet } from './ui.js';
import { quarters, inPeriod, formatDate, yearPeriod } from './periods.js';
import { t } from './theme.js';

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

  // One palette colour per flag, so the shelf reads at a glance.
  const tags = [];
  tags.push(book.format === 'nonfiction'
    ? '<span class="tag tag-sage">Nonfiction</span>'
    : '<span class="tag tag-accent">Fiction</span>');
  if (book.isClassic) tags.push('<span class="tag tag-rose">Classic</span>');
  if (book.isReread) tags.push('<span class="tag tag-blue">Re-read</span>');
  if (book.isTbr) tags.push('<span class="tag tag-gold">Physical TBR</span>');
  (book.tags || []).forEach((x) => tags.push(`<span class="tag tag-plain">${esc(x)}</span>`));

  return `<article class="list-row">
    <a class="list-row-link" href="#/book/${encodeURIComponent(book.id)}">
      ${coverImg(book)}
      <span class="grow">
        <span class="entry-title">${esc(book.title)}</span>
        <span class="entry-meta">${esc(bits.join(' · '))}</span>
        <span class="entry-meta">Finished ${esc(formatDate(book.dateFinished))}</span>
        <span class="tags">${tags.join('')}</span>
      </span>
    </a>
    <button class="btn btn-quiet btn-sm" type="button" data-del="${attr(book.id)}"
            aria-label="Delete ${attr(book.title)}">Remove</button>
  </article>`;
}

function plural(n) {
  return `${n} book${n === 1 ? '' : 's'}`;
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
    title: t('booksHeading'),
    tab: 'books',
    fab: true,
    keepScroll: true,
    html: `
      <section class="section">
        <div class="section-head">
          <div>
            <h2 class="section-title">${esc(t('booksHeading'))}</h2>
            <p class="section-sub">Everything finished in ${year}, newest first.</p>
          </div>
          <p class="section-meta">${books.length} of ${totalThisYear} shown</p>
        </div>

        <div style="margin-top:1.4rem">
          ${chipRow([{ value: 'all', label: 'All year' }, ...qs.map((q) => ({ value: q.key, label: q.key }))], qKey, 'q', query)}
          ${chipRow([{ value: 'all', label: 'Fiction + nonfiction' }, { value: 'fiction', label: 'Fiction' }, { value: 'nonfiction', label: 'Nonfiction' }], format, 'format', query)}
          ${flagRow(flags, query)}
        </div>

        <p class="hint" style="margin:.4rem 0 1rem">
          ${filtered ? '<a href="#/books">Clear filters</a>' : `${plural(totalThisYear)} logged`}
          ${outside > 0 ? ` · ${outside} logged outside ${year}` : ''}
        </p>

        ${books.length ? `<div class="list">${books.map(bookRow).join('')}</div>` : `
          <div class="empty">
            <h3>${totalThisYear ? 'Nothing matches those filters' : 'The shelf is empty'}</h3>
            <p>${totalThisYear ? 'Try clearing one.' : `Add the first book you finish in ${year}.`}</p>
            <a class="btn btn-primary" href="${totalThisYear ? '#/books' : '#/add'}">${totalThisYear ? 'Clear filters' : 'Add a book'}</a>
          </div>`}
      </section>
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
