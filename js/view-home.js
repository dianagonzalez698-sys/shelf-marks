// Editorial prototype: reading and writing first, embellishment in Design Mode.
// Existing book, challenge, and layout records remain intact.
import { state, sortedBooks, annualProgress } from './state.js';
import * as notebook from './notebook.js';
import { esc, attr } from './ui.js';

export const HOME_PAGE_ID = 'home';
const short = (s,n=160) => String(s || '').replace(/\s+/g,' ').slice(0,n);

export function homeView() {
  const books = sortedBooks().slice(0,4);
  const writing = notebook.list().slice(0,2);
  const progress = annualProgress();
  const year = state.settings.year;
  return {
    title:'', tab:'home', banner:false, editorial:true, editPage:HOME_PAGE_ID, fab:false,
    html:`<div class="lit-home">
      <section class="lit-hero" data-sec="lit-hero" data-editorial-static>
        <div class="lit-hero-edition"><span>THE READING JOURNAL</span><span>VOL. I · ${year}</span></div>
        <div class="lit-hero-content"><p class="lit-overline">A PERSONAL CHRONICLE OF BOOKS & BEAUTIFUL DETOURS</p>
          <h1>A life <em>between</em><br>the pages<span class="lit-hero-period">.</span></h1>
          <p class="lit-hero-deck">The things I read, the words I collect, and all that stays with me long after the final chapter.</p>
          <div class="lit-hero-actions"><a href="#/add" class="lit-primary-action">Log a book <span>↗</span></a><a href="#/notebook/new" class="lit-text-action">Begin writing ↗</a></div>
        </div>
        <div class="lit-hero-art" aria-hidden="true"><span class="lit-art-orbit"></span><span class="lit-art-initial">S</span><span class="lit-art-small">M</span><span class="lit-art-caption">A COLLECTION OF LITTLE READING ADVENTURES</span></div>
        <div class="lit-hero-foot"><span>EST. IN CURIOSITY</span><span>SCROLL TO EXPLORE ↓</span></div>
      </section>

      <section class="lit-feature lit-feature-writing" data-sec="lit-feature-writing" data-editorial-static>
        <div class="lit-section-top"><span>01 / THE WRITING DESK</span><a href="#/notebook">VIEW THE NOTEBOOK ↗</a></div>
        <div class="lit-feature-grid"><div class="lit-feature-intro"><p class="lit-script-note">Collected thoughts</p>
            <h2>The <em>Notebook</em></h2><p>A place for the lines that linger, the ideas that unfold, and the books that become part of who we are.</p>
            <a href="#/notebook/new" class="lit-underline-action">Write something new ↗</a></div>
          <div class="lit-feature-content">${writing.length ? writing.map(e => `<a class="lit-writing-excerpt" href="#/notebook/${encodeURIComponent(e.id)}"><span>${esc(e.kind.toUpperCase())}</span><h3>${esc(e.title)}</h3><p>${esc(short(e.body))}${e.body.length > 160 ? '…' : ''}</p><small>OPEN ENTRY ↗</small></a>`).join('') : `<div class="lit-feature-placeholder"><span class="lit-plume">❧</span><h3>Your first page awaits.</h3><p>Start with a favorite line, a quick observation, or a longer reflection.</p><a href="#/notebook/new">OPEN THE WRITING DESK ↗</a></div>`}</div>
        </div>
      </section>

      <section class="lit-feature lit-feature-books" data-sec="lit-feature-books" data-editorial-static>
        <div class="lit-section-top"><span>02 / THE BOOKSHELF</span><a href="#/books">EXPLORE MY LIBRARY ↗</a></div>
        <div class="lit-section-heading"><h2>Recently <em>read</em></h2><p>Each book its own little world.</p></div>
        ${books.length ? `<div class="lit-books-grid">${books.map((b,i)=>`<a href="#/book/${encodeURIComponent(b.id)}" class="lit-book-tile"><div class="lit-book-art">${b.coverUrl ? `<img src="${attr(b.coverUrl)}" alt="Cover of ${attr(b.title)}" loading="lazy">` : `<span>${esc(b.title.slice(0,1))}</span>`}</div><small>NO. ${String(i+1).padStart(2,'0')}</small><h3>${esc(b.title)}</h3><p>${esc(b.author || '')}</p></a>`).join('')}</div>` : `<div class="lit-empty-shelf"><span>Ⅰ &nbsp; Ⅱ &nbsp; Ⅲ &nbsp; Ⅳ</span><p>Your reading shelf is waiting for its first book.</p><a href="#/add">LOG YOUR FIRST BOOK ↗</a></div>`}
      </section>

      <section class="lit-reading-note" data-sec="lit-reading-note" data-editorial-static>
        <span class="lit-section-number">03 / A NOTE ON THE YEAR</span>
        <div><p class="lit-script-note">The year so far</p><h2>${progress.read} <em>of</em> ${progress.goal}</h2><p>books read in ${year}</p></div>
        <div class="lit-reading-bar"><span style="width:${Math.min(100,progress.pct)}%"></span></div>
        <a href="#/challenges">Reading challenges & collected marks ↗</a>
      </section>

      <section class="lit-outro" data-sec="lit-outro" data-editorial-static><span>AN INVITATION TO KEEP NOTICING</span><h2>For the love of <em>turning pages.</em></h2><div><a href="#/notebook">THE NOTEBOOK ↗</a><a href="#/bookmarks">BOOKMARK ARCHIVE ↗</a><a href="#/words">WORDS OF THE YEAR ↗</a></div></section>
    </div>`,
  };
}
