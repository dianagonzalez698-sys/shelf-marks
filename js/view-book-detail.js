// A book is a small page in the reader's literary archive, distinct from the
// form used to change it. Everything here reads existing book records.
import { getBook, state, saveBook } from './state.js';
import { esc, attr, coverImg, toast, navigate } from './ui.js';
import { formatDate } from './periods.js';
import { src as artworkSrc } from './assets.js';
import { bookDecorMarkup, mountBookDecor } from './book-decor.js';

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
  const hasWriting = !!(book.review || book.favoriteQuote || book.notes || book.journalArtworkId);

  return {
    title: book.title, tab: 'books', editorial: true, back: true, live: false,
    html: `<article class="book-archive-page">
      ${bookDecorMarkup(book)}
      <div class="book-archive-nav"><a href="#/books">← Back to the Library</a>
        <a class="book-archive-edit" href="#/book/${encodeURIComponent(book.id)}/edit">Edit book details ↗</a></div>

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
            <p>${hasWriting ? 'Your words and artwork live together on this page.' : status === 'want' ? 'On your to-read shelf. Start collecting thoughts whenever you’re ready.' : 'This is your space for thoughts, passages, and artwork.'}</p>
            <button class="book-archive-primary" type="button" id="book-journal-toggle" aria-expanded="false">${hasWriting ? '✎ Edit my journal' : '✎ Write in my journal'}</button>
            ${hasWriting ? '<a class="book-archive-jump" href="#book-journal">Read my notes ↓</a>' : ''}
          </div>
        </div>
      </header>

      <div class="book-archive-body">
        <main class="book-archive-writing" id="book-journal">
          <form class="book-inline-journal" id="book-inline-journal" hidden>
            <div class="book-inline-heading"><p class="lit-overline">A PAGE OF YOUR OWN</p><h2>Write in your journal</h2><p>Just the words you want to keep. Decorate the page separately whenever inspiration strikes.</p></div>
            <label for="bj-rating">My rating <span>(optional)</span></label>
            <select id="bj-rating"><option value="">Not rated yet</option>${[1,2,3,4,5].map(n=>`<option value="${n}" ${Number(book.rating)===n?'selected':''}>${'★'.repeat(n)}${'☆'.repeat(5-n)}</option>`).join('')}</select>
            <label for="bj-review">What I thought</label>
            <textarea id="bj-review" rows="6" placeholder="Your impressions and reflections…">${esc(book.review || '')}</textarea>
            <label for="bj-quote">A passage to keep</label>
            <textarea id="bj-quote" rows="3" placeholder="A line worth remembering…">${esc(book.favoriteQuote || '')}</textarea>
            <label for="bj-notes">Marginalia & little notes</label>
            <textarea id="bj-notes" rows="4" placeholder="Anything else worth keeping…">${esc(book.notes || '')}</textarea>
            <div class="book-inline-actions"><button class="btn btn-primary" type="submit">Save my words</button><button class="btn" type="button" id="book-journal-cancel">Cancel</button></div>
          </form>
          <div id="book-journal-reading">
          ${book.review ? `<section class="book-archive-review"><p class="lit-overline">MY READING JOURNAL / REVIEW</p><h2>What I thought</h2><div class="book-archive-prose">${paragraph(book.review)}</div></section>` : ''}
          ${book.favoriteQuote ? `<section class="book-archive-passage"><p class="lit-overline">A PASSAGE TO KEEP</p><blockquote>“${paragraph(book.favoriteQuote)}”</blockquote></section>` : ''}
          ${book.notes ? `<section class="book-archive-notes"><p class="lit-overline">MARGINALIA</p><h2>Notes to remember</h2><div class="book-archive-prose">${paragraph(book.notes)}</div></section>` : ''}
          ${book.journalArtworkId && artworkSrc(book.journalArtworkId) ? `<section class="book-archive-art"><p class="lit-overline">A VISUAL MEMENTO</p><figure><img src="${artworkSrc(book.journalArtworkId)}" alt="Artwork saved with this reading journal">${book.journalArtCaption ? `<figcaption>${esc(book.journalArtCaption)}</figcaption>` : ''}</figure></section>` : ''}
          ${!hasWriting ? `<section class="book-archive-empty"><p class="book-archive-ornament">❦</p><h2>The pages are waiting.</h2><p>Your thoughts, favorite lines and reflections can live here whenever you’re ready.</p><button class="btn" type="button" id="book-journal-empty-edit">Write a first note ✎</button></section>` : ''}
          </div>
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
    onMount(root) {
      mountBookDecor(root, book);
      const form = root.querySelector('#book-inline-journal');
      const reading = root.querySelector('#book-journal-reading');
      const toggle = root.querySelector('#book-journal-toggle');
      const edit = () => {
        form.hidden = false;
        reading.hidden = true;
        toggle.setAttribute('aria-expanded', 'true');
        form.scrollIntoView({ behavior: 'smooth', block: 'start' });
      };
      const cancel = () => {
        form.hidden = true;
        reading.hidden = false;
        toggle.setAttribute('aria-expanded', 'false');
      };
      toggle.onclick = () => form.hidden ? edit() : cancel();
      const empty = root.querySelector('#book-journal-empty-edit');
      if (empty) empty.onclick = edit;
      root.querySelector('#book-journal-cancel').onclick = cancel;
      form.onsubmit = async event => {
        event.preventDefault();
        const rating = root.querySelector('#bj-rating').value;
        try {
          await saveBook({ ...book,
            rating: rating ? Number(rating) : null,
            review: root.querySelector('#bj-review').value.trim(),
            favoriteQuote: root.querySelector('#bj-quote').value.trim(),
            notes: root.querySelector('#bj-notes').value.trim(),
          });
          toast('Journal saved.', 'good');
          navigate(`/book/${encodeURIComponent(book.id)}`);
        } catch (_) { toast('Could not save your journal.', 'bad'); }
      };
    },
  };
}
