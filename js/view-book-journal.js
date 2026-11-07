// The reader's personal writing desk, separate from bibliographic book details.
import { getBook, saveBook } from './state.js';
import { esc, attr, toast, navigate } from './ui.js';
import * as assets from './assets.js';

export function bookJournalView({ id } = {}) {
  const book = getBook(id);
  if (!book) return {
    title: 'Book not found', tab: 'books', back: true,
    html: '<div class="empty"><h3>This book is no longer on your shelf.</h3><a href="#/books">Back to Library</a></div>',
  };

  const url = `/book/${encodeURIComponent(book.id)}`;
  let artworkId = book.journalArtworkId || null;
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
        <section class="book-writing-art">
          <p class="lit-overline">THE VISUAL PAGE</p>
          <h2>A little scrapbook</h2>
          <p>Keep a painting, photograph, or collage beside your words. Entirely optional.</p>
          <div id="j-art-preview" class="book-writing-art-preview">${artworkId && assets.src(artworkId) ? `<img src="${assets.src(artworkId)}" alt="Artwork for this reading journal">` : '<span>✿</span><small>A space for something lovely</small>'}</div>
          <label class="btn" for="j-art-upload">${artworkId ? 'Change artwork' : '+ Add artwork'}<input id="j-art-upload" type="file" accept="image/*" class="visually-hidden"></label>
          <button class="btn" type="button" id="j-art-remove" ${artworkId ? '' : 'hidden'}>Remove artwork</button>
          <div class="book-writing-field book-writing-caption"><label for="j-art-caption">A caption <span>(optional)</span></label><input id="j-art-caption" type="text" value="${attr(book.journalArtCaption || '')}" placeholder="Why you kept this image…"></div>
        </section>
        <div class="book-writing-actions">
          <button class="btn btn-primary" type="submit">Save my journal</button>
          <a class="btn" href="#${url}">Cancel</a>
        </div>
      </form>
      <p class="book-writing-footnote">Want these pages to appear on your Journal homepage? In Design Studio, add the optional <strong>From the reading journal</strong> section. Looking for cover, status, or challenge checkboxes? <a href="#${url}/edit">Edit book details</a>.</p>
    </article>`,
    onMount(root) {
      const preview = root.querySelector('#j-art-preview');
      const remove = root.querySelector('#j-art-remove');
      const paintArtwork = () => {
        const src = assets.src(artworkId);
        preview.replaceChildren();
        if (src) {
          const img = document.createElement('img'); img.src = src; img.alt = 'Artwork for this reading journal'; preview.append(img);
        } else preview.innerHTML = '<span>✿</span><small>A space for something lovely</small>';
        remove.hidden = !artworkId;
      };
      root.querySelector('#j-art-upload').onchange = async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;
        try {
          const image = await assets.add(file, { kind: 'artwork', name: `Reading journal · ${book.title}` });
          artworkId = image.id;
          paintArtwork();
        } catch (_) { toast('Could not add that artwork.', 'bad'); }
      };
      remove.onclick = () => { artworkId = null; paintArtwork(); };
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
            journalArtworkId: artworkId,
            journalArtCaption: root.querySelector('#j-art-caption').value.trim(),
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
