// A book is a small page in the reader's literary archive, distinct from the
// form used to change it. Everything here reads existing book records.
import { getBook, state } from './state.js';
import { esc, attr, coverImg } from './ui.js';
import { formatDate } from './periods.js';

const STATUS = { want: 'Want to read', reading: 'Currently reading', read: 'Read', dnf: 'Did not finish' };
const paragraph = (value) => esc(String(value || '')).replace(/\n/g, '<br>');

export function bookDetailView({ id } = {}) {
  const book = getBook(id);
  if (!book) return {
    title: 'Book not found', tab: 'books', back: true,
    html: '<div class="empty"><h3>That book is not on your shelf.</h3><a class="btn" href="#/books">Back to the Library</a></div>',
  };

  const status = book.status || (book.dateFinished ? 'read' : 'want');
  const shelves = (state.settings.customShelves || []).filter(s => (book.shelves || []).includes(s.id));
  const challengeNames = [
    book.isClassic && 'Classic Every Quarter',
    book.isTbr && 'Physical TBR Every Other Month',
    book.isReread && 'Re-read',
  ].filter(Boolean);
  const readingDates = [book.dateStarted && `Started ${formatDate(book.dateStarted)}`,
    book.dateFinished && `Finished ${formatDate(book.dateFinished)}`].filter(Boolean);
  const hasWriting = !!(book.review || book.favoriteQuote || book.notes);

  return {
    title: book.title, tab: 'books', editorial: true, back: true,
    html: `<article class="book-archive-page">
      <div class="book-archive-nav"><a href="#/books">← Back to the Library</a>
        <a class="book-archive-edit" href="#/book/${encodeURIComponent(book.id)}/edit">Edit this book ↗</a></div>

      <header class="book-archive-hero">
        <div class="book-archive-cover">${coverImg(book, { big: true })}</div>
        <div class="book-archive-intro">
          <p class="lit-overline">FROM MY PERSONAL LIBRARY <span>✦</span> ${esc(STATUS[status] || 'On my shelf')}</p>
          <h1>${esc(book.title)}</h1>
          <p class="book-archive-author">by ${esc(book.author || 'Unknown author')}</p>
          ${book.rating ? `<p class="book-archive-rating" aria-label="My rating ${book.rating} out of 5 stars">${'★'.repeat(Math.max(1,Math.min(5,Number(book.rating))))}${'☆'.repeat(5-Math.max(1,Math.min(5,Number(book.rating))))}<span>My rating</span></p>` : ''}
          ${readingDates.length ? `<p class="book-archive-dates">${readingDates.map(esc).join(' <span>·</span> ')}</p>` : ''}
          <div class="book-archive-facts">
            ${book.firstPublishYear ? `<span>First published ${esc(book.firstPublishYear)}</span>` : ''}
            ${book.pages ? `<span>${esc(book.pages)} pages</span>` : ''}
            ${book.format ? `<span>${esc(book.format)}</span>` : ''}
            ${book.series ? `<span>${esc(book.series)}</span>` : ''}
          </div>
          <div class="book-archive-next-step">
            <p>${hasWriting ? 'Your reading journal is below.' : status === 'want' ? 'On your to-read shelf. When you begin, this is where you can track your reading and collect your thoughts.' : 'Your journal is ready for a rating, a favorite passage, or a few thoughts.'}</p>
            <a class="book-archive-primary" href="#/book/${encodeURIComponent(book.id)}/edit">${hasWriting ? 'Update my journal' : 'Add notes or update this book'} →</a>
            ${hasWriting ? '<a class="book-archive-jump" href="#book-journal">Read my notes ↓</a>' : ''}
          </div>
        </div>
      </header>

      <div class="book-archive-body">
        <main class="book-archive-writing" id="book-journal">
          ${book.review ? `<section class="book-archive-review"><p class="lit-overline">MY READING JOURNAL / REVIEW</p><h2>What I thought</h2><div class="book-archive-prose">${paragraph(book.review)}</div></section>` : ''}
          ${book.favoriteQuote ? `<section class="book-archive-passage"><p class="lit-overline">A PASSAGE TO KEEP</p><blockquote>“${paragraph(book.favoriteQuote)}”</blockquote></section>` : ''}
          ${book.notes ? `<section class="book-archive-notes"><p class="lit-overline">MARGINALIA</p><h2>Notes to remember</h2><div class="book-archive-prose">${paragraph(book.notes)}</div></section>` : ''}
          ${!hasWriting ? `<section class="book-archive-empty"><p class="book-archive-ornament">❦</p><h2>The pages are waiting.</h2><p>Your thoughts, favorite lines and reflections can live here whenever you’re ready.</p><a href="#/book/${encodeURIComponent(book.id)}/edit">Write about this book ↗</a></section>` : ''}
        </main>
        <aside class="book-archive-aside">
          <section><p class="lit-overline">READING CHALLENGES</p><h3>How it counts</h3>
            ${challengeNames.length ? `<ul>${challengeNames.map(name=>`<li><span>✧</span> ${esc(name)}</li>`).join('')}</ul>` : '<p>No challenge categories selected yet.</p>'}
            ${book.dateFinished && status === 'read' ? '<small>Completed reading dates count toward applicable goals.</small>' : '<small>Finish dates determine progress on dated challenges.</small>'}
          </section>
          <section><p class="lit-overline">MY SHELVES</p><h3>Filed under</h3>
            ${shelves.length || (book.tags || []).length ? `<div class="book-archive-tags">${[...shelves.map(s=>s.name),...(book.tags || [])].map(name=>`<span>${esc(name)}</span>`).join('')}</div>` : '<p>No personal shelves or tags yet.</p>'}
          </section>
        </aside>
      </div>
    </article>`,
  };
}
