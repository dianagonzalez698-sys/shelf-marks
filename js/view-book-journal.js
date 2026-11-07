// The reader's personal writing desk, separate from bibliographic book details.
import { getBook, saveBook } from './state.js';
import { esc, toast, navigate } from './ui.js';

export function bookJournalView({ id } = {}) {
  const book = getBook(id);
  if (!book) return {
    title: 'Book not found', tab: 'books', back: true,
    html: '<div class="empty"><h3>This book is no longer on your shelf.</h3><a href="#/books">Back to Library</a></div>',
  };

  const url = `/book/${encodeURIComponent(book.id)}`;
  return {
    title: 'Reading journal', tab: 'books', back: true, live: false,
    html: `<article class="book-writing-desk">
      <a class="book-writing-back" href="#${url}">← Back to ${esc(book.title)}</a>
      <p class="lit-overline">A PRIVATE PAGE IN MY LIBRARY</p>
      <h1>My Reading Journal</h1>
      <p class="book-writing-book">${esc(book.title)} <span>by ${esc(book.author || 'Unknown author')}</span></p>
      <p class="book-writing-intro">A place for your own words. A thought now, a favorite line later, or a full review whenever you're ready.</p>
      <form id="book-journal-form">
        <div class="book-writing-field">
          <label for="j-rating">My rating <span>(optional)</span></label>
          <select id="j-rating"><option value="">Not rated yet</option>${[1,2,3,4,5].map(n=>`<option value="${n}" ${Number(book.rating) === n ? 'selected' : ''}>${'★'.repeat(n)}${'☆'.repeat(5-n)}</option>`).join('')}</select>
        </div>
        <div class="book-writing-field">
          <label for="j-review">What I thought</label>
          <textarea id="j-review" rows="7" placeholder="Your impressions, your feelings, the things that stayed with you…">${esc(book.review || '')}</textarea>
        </div>
        <div class="book-writing-field">
          <label for="j-quote">A passage to keep</label>
          <textarea id="j-quote" rows="4" placeholder="A sentence worth remembering…">${esc(book.favoriteQuote || '')}</textarea>
        </div>
        <div class="book-writing-field">
          <label for="j-notes">Marginalia & little notes</label>
          <textarea id="j-notes" rows="5" placeholder="Questions, observations, scattered thoughts…">${esc(book.notes || '')}</textarea>
        </div>
        <div class="book-writing-actions">
          <button class="btn btn-primary" type="submit">Save my journal</button>
          <a class="btn" href="#${url}">Cancel</a>
        </div>
      </form>
      <p class="book-writing-footnote">Looking for the cover, title, reading status, or challenge checkboxes? <a href="#${url}/edit">Edit book details</a>.</p>
    </article>`,
    onMount(root) {
      root.querySelector('#book-journal-form').onsubmit = async (event) => {
        event.preventDefault();
        const rating = root.querySelector('#j-rating').value;
        try {
          await saveBook({
            ...book,
            rating: rating ? Number(rating) : null,
            review: root.querySelector('#j-review').value.trim(),
            favoriteQuote: root.querySelector('#j-quote').value.trim(),
            notes: root.querySelector('#j-notes').value.trim(),
          });
          toast('Journal saved.', 'good');
          navigate(url);
        } catch (_) {
          toast('Could not save your journal. Please try again.', 'bad');
        }
      };
    },
  };
}
