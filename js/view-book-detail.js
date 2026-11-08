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
  const hasWriting = !!(book.review || book.favoriteQuote || book.notes || book.journalArtworkId || (book.journalDecorations || []).length);
  let libraryReturn = '#/books';
  try {
    const saved = sessionStorage.getItem('dlp:last-library-view') || '';
    if (/^#\/books(?:\?[^#]*)?$/.test(saved)) libraryReturn = saved;
  } catch (_) { /* library fallback is always available */ }

  return {
    title: book.title, tab: 'books', editorial: true, back: true, live: false,
    html: `<article class="book-archive-page${hasWriting ? '' : ' is-unwritten'}">
      ${bookDecorMarkup(book)}
      <div class="book-archive-nav"><a href="${attr(libraryReturn)}">← Back to the Library</a>
        <a class="book-archive-edit" href="#/book/${encodeURIComponent(book.id)}/edit">Edit book details ↗</a></div>

      <header class="book-archive-hero">
        <div class="book-archive-cover"><div class="book-archive-cover-art">${coverImg(book, { big: true })}</div><p class="book-archive-cover-caption">A BOOK FROM MY SHELVES <span>✦</span></p></div>
        <div class="book-archive-intro">
          <p class="lit-overline">AN ENTRY FROM MY PERSONAL LIBRARY <span>✦</span> ${esc(STATUS[status] || 'On my shelf')}</p>
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
          <div class="book-archive-ornamental-rule" aria-hidden="true"><span>❦</span></div>
          <div class="book-archive-next-step">
            <p>${hasWriting ? 'Your words and artwork live together on this page.' : status === 'want' ? 'On your to-read shelf. Start collecting thoughts whenever you’re ready.' : 'This is your space for thoughts, passages, and artwork.'}</p>
            <button class="book-archive-primary" type="button" id="book-journal-toggle" aria-expanded="false">${hasWriting ? '✎ Edit my journal' : '✎ Write in my journal'}</button>
            ${hasWriting ? '<a class="book-archive-jump" href="#book-journal">Read my notes ↓</a>' : ''}
            ${bookDecorMarkup(book, 'toolbar')}
          </div>
        </div>
      </header>

      <div class="book-archive-body">
        <main class="book-archive-writing" id="book-journal">
          <div class="book-archive-page-marker" aria-hidden="true"><span>NOTES FROM THE READING DESK</span><span>✧ &nbsp; ✧ &nbsp; ✧</span></div>
          <form class="book-inline-journal" id="book-inline-journal" hidden>
            <div class="book-inline-heading"><p class="lit-overline">A PAGE OF YOUR OWN</p><h2>Write in your journal</h2><p>A few thoughts, a favorite line, a little marginalia. Keep whatever matters.</p></div>
            <div class="book-inline-spread"><div class="book-inline-fields">
            <label for="bj-rating">My rating <span>(optional)</span></label>
            <select id="bj-rating"><option value="">Not rated yet</option>${[1,2,3,4,5].map(n=>`<option value="${n}" ${Number(book.rating)===n?'selected':''}>${'★'.repeat(n)}${'☆'.repeat(5-n)}</option>`).join('')}</select>
            <label for="bj-review">What I thought</label>
            <textarea id="bj-review" rows="6" placeholder="Your impressions and reflections…">${esc(book.review || '')}</textarea>
            <label for="bj-quote">A passage to keep</label>
            <textarea id="bj-quote" rows="3" placeholder="A line worth remembering…">${esc(book.favoriteQuote || '')}</textarea>
            <label for="bj-notes">Marginalia & little notes</label>
            <textarea id="bj-notes" rows="4" placeholder="Anything else worth keeping…">${esc(book.notes || '')}</textarea>
            </div>
            <section class="book-inline-preview" aria-label="Live journal preview">
              <p class="lit-overline">THE FACING PAGE <span aria-hidden="true">✧</span></p>
              <div data-preview="review"><h3>What I thought</h3><p></p></div>
              <div data-preview="quote"><h3>A passage to keep</h3><blockquote></blockquote></div>
              <div data-preview="notes"><h3>Marginalia</h3><p></p></div>
              <p class="book-inline-preview-empty" id="bj-preview-empty">Start writing above to see your journal take shape here.</p>
            </section>
            </div>
            <div class="book-inline-actions"><button class="btn btn-primary" type="submit">Save my words</button><button class="btn" type="button" id="book-journal-cancel">Close editor</button></div>
            <p class="book-draft-state" id="book-draft-state" aria-live="polite">Your draft stays in this tab until you save.</p>
          </form>
          <div id="book-journal-reading">
          ${book.review ? `<section class="book-archive-review"><p class="lit-overline">MY READING JOURNAL / REVIEW</p><div class="book-entry-heading"><h2>What I thought</h2><button type="button" data-edit-journal="review" aria-label="Edit review">Edit ↗</button></div><div class="book-archive-prose">${paragraph(book.review)}</div></section>` : ''}
          ${book.favoriteQuote ? `<section class="book-archive-passage"><div class="book-entry-heading"><p class="lit-overline">A PASSAGE TO KEEP</p><button type="button" data-edit-journal="quote" aria-label="Edit favorite passage">Edit ↗</button></div><blockquote>“${paragraph(book.favoriteQuote)}”</blockquote></section>` : ''}
          ${book.notes ? `<section class="book-archive-notes"><p class="lit-overline">MARGINALIA</p><div class="book-entry-heading"><h2>Notes to remember</h2><button type="button" data-edit-journal="notes" aria-label="Edit marginalia">Edit ↗</button></div><div class="book-archive-prose">${paragraph(book.notes)}</div></section>` : ''}
          ${book.journalArtworkId && artworkSrc(book.journalArtworkId) ? `<section class="book-archive-art"><p class="lit-overline">A VISUAL MEMENTO</p><figure><img src="${artworkSrc(book.journalArtworkId)}" alt="Artwork saved with this reading journal">${book.journalArtCaption ? `<figcaption>${esc(book.journalArtCaption)}</figcaption>` : ''}</figure></section>` : ''}
          ${!hasWriting ? `<section class="book-archive-empty"><span class="book-empty-dateline">A LITTLE SPACE FOR THOUGHTS &amp; THINGS WORTH KEEPING</span><h2>This page is yours.</h2><p>A thought, a sentence you loved, a moment you want to remember. It doesn't need to be a formal review.</p><button class="book-inline-start" type="button" data-edit-journal="review">Put pen to paper ↗</button><span class="book-empty-ornament" aria-hidden="true">❦</span></section>` : ''}
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
      const draftState = root.querySelector('#book-draft-state');
      const draftFields = {
        rating: root.querySelector('#bj-rating'),
        review: root.querySelector('#bj-review'),
        quote: root.querySelector('#bj-quote'),
        notes: root.querySelector('#bj-notes'),
      };
      const draftKey = `dlp:journal-draft:${book.id}`;
      const paintPreview = () => {
        let filled = 0;
        for (const key of ['review', 'quote', 'notes']) {
          const text = draftFields[key].value.trim();
          const section = root.querySelector(`[data-preview="${key}"]`);
          section.hidden = !text;
          if (text) { filled++; section.querySelector('p, blockquote').textContent = text; }
        }
        root.querySelector('#bj-preview-empty').hidden = !!filled;
      };
      let draftTimer = null;
      try {
        const saved = JSON.parse(sessionStorage.getItem(draftKey) || 'null');
        if (saved && Date.now() - saved.at < 30 * 24 * 60 * 60 * 1000) {
          Object.entries(draftFields).forEach(([key, field]) => {
            if (typeof saved[key] === 'string') field.value = saved[key];
          });
          draftState.textContent = 'Your unfinished draft has been restored.';
        }
      } catch (_) { draftState.textContent = 'Press Save my words to keep your writing.'; }
      paintPreview();
      const keepDraft = () => {
        clearTimeout(draftTimer);
        draftState.textContent = 'Keeping your draft…';
        draftTimer = setTimeout(() => {
          try {
            sessionStorage.setItem(draftKey, JSON.stringify({
              at: Date.now(), ...Object.fromEntries(Object.entries(draftFields).map(([key, field]) => [key, field.value])),
            }));
            draftState.textContent = 'Draft kept in this tab.';
          } catch (_) { draftState.textContent = 'Draft storage unavailable. Please save your words.'; }
        }, 350);
      };
      form.addEventListener('input', () => { keepDraft(); paintPreview(); });
      form.addEventListener('change', () => { keepDraft(); paintPreview(); });
      const edit = () => {
        form.hidden = false;
        reading.hidden = true;
        root.querySelector('.book-archive-page')?.classList.add('is-editing-journal');
        toggle.setAttribute('aria-expanded', 'true');
        form.scrollIntoView({ behavior: 'smooth', block: 'start' });
      };
      const cancel = () => {
        form.hidden = true;
        reading.hidden = false;
        root.querySelector('.book-archive-page')?.classList.remove('is-editing-journal');
        toggle.setAttribute('aria-expanded', 'false');
      };
      toggle.onclick = () => form.hidden ? edit() : cancel();
      root.querySelectorAll('[data-edit-journal]').forEach(button => {
        button.onclick = () => {
          edit();
          const field = draftFields[button.dataset.editJournal];
          if (field) field.focus({ preventScroll: true });
        };
      });
      root.querySelector('#book-journal-cancel').onclick = cancel;
      form.onsubmit = async event => {
        event.preventDefault();
        const rating = root.querySelector('#bj-rating').value;
        try {
          await saveBook({ ...(getBook(book.id) || book),
            rating: rating ? Number(rating) : null,
            review: root.querySelector('#bj-review').value.trim(),
            favoriteQuote: root.querySelector('#bj-quote').value.trim(),
            notes: root.querySelector('#bj-notes').value.trim(),
          });
          clearTimeout(draftTimer);
          try { sessionStorage.removeItem(draftKey); } catch (_) { /* saved book is authoritative */ }
          toast('Journal saved.', 'good');
          navigate(`/book/${encodeURIComponent(book.id)}`);
        } catch (_) { toast('Could not save your journal.', 'bad'); }
      };
    },
  };
}
