// Words of the year.
//
// A word you kept meeting — "pantomime" for 2026 — gets a page of its own:
// the word set large, then every book it turned up in with the tally for each.
// The page is built from its layout like every other, so the arrangement is
// yours to change; this file supplies the word it is about.

import { state, allWords, getWord, newWord, saveWord, deleteWord, wordStats, sortedBooks } from './state.js';
import { esc, attr, toast, openSheet, confirmSheet, coverImg, navigate, render } from './ui.js';
import { renderSections } from './sections.js';
import { media } from './media.js';
import * as layout from './layout.js';

export const WORD_PAGE_ID = 'word';

export function wordPageId(id) { return `word:${id}`; }

/* ----------------------------------------------------------------- index -- */

export function wordsView() {
  const words = allWords();
  return {
    title: 'Words',
    tab: '',
    back: true,
    editorial: true,
    html: `
      <section class="word-cabinet">
        <header class="word-cabinet-head">
          <p class="lit-overline">THE LANGUAGE I KEPT FINDING</p>
          <h1>A collection of <em>words</em></h1>
          <p>Some words follow us from book to book. These are the ones I chose to keep.</p>
          <button class="word-cabinet-add" type="button" id="new-word">✧ &nbsp; Keep another word</button>
        </header>
        ${words.length ? `<div class="word-cabinet-intro"><span>THE LITTLE LEXICON</span><span>${String(words.length).padStart(2,'0')} ENTRIES</span></div><div class="word-cabinet-grid">${words.map((w,i) => {
          const st = wordStats(w);
          return `<article class="word-cabinet-entry">
            <a href="#/word/${encodeURIComponent(w.id)}" aria-label="Open ${attr(w.word || 'Untitled word')}">
              <span class="word-cabinet-number">${String(i+1).padStart(2,'0')} <span aria-hidden="true">❦</span></span>
              <span class="word-cabinet-word">${esc(w.word || 'Untitled')}</span>
              <span class="word-cabinet-label">${esc(w.label || 'A word worth keeping')}${w.period ? ` · ${esc(w.period)}` : ''}</span>
              ${w.note ? `<span class="word-cabinet-note">${esc(w.note)}</span>` : ''}
              <span class="word-cabinet-foot">${st.books} ${st.books === 1 ? 'book' : 'books'} <span>·</span> ${st.total} ${st.total === 1 ? 'appearance' : 'appearances'} <span class="word-cabinet-arrow" aria-hidden="true">↗</span></span>
            </a>
          </article>`;
        }).join('')}</div>`
        : `<div class="word-cabinet-empty"><span aria-hidden="true">❦</span><h2>A blank page for curious words.</h2>
             <p>Keep the first word that catches your eye, then note every book in which it appears.</p></div>`}
      </section>`,
    onMount(root) {
      const btn = root.querySelector('#new-word');
      if (btn) btn.onclick = () => openWordEditor(null);
    },
  };
}

/* ---------------------------------------------------------------- detail -- */

export function wordDetailView(params) {
  const word = getWord(params.id);
  if (!word) {
    return {
      title: 'Not found',
      back: true,
      html: `<div class="empty"><h3>No such word</h3>
        <a class="btn" href="#/words">All words</a></div>`,
    };
  }

  // Every editorial block on this page is a section in its layout, so what the
  // Layouts editor lists is exactly what renders here.
  const stats = wordStats(word);
  const ctx = { word, stats };

  return {
    title: word.word || 'Word',
    tab: '',
    banner: false,
    editorial: true,
    editPage: wordPageId(word.id),
    back: true,
    actions: '<button class="btn btn-quiet" type="button" id="edit-word">Edit</button>',
    html: renderSections(layout.get(wordPageId(word.id)), ctx),
    onMount(root) {
      const top = document.getElementById('edit-word');
      if (top) top.onclick = () => openWordEditor(word);
      const inline = root.querySelector('#edit-word-inline');
      if (inline) inline.onclick = () => openWordEditor(word);
    },
  };
}

/* ---------------------------------------------------------------- editor -- */

export function openWordEditor(existing) {
  const creating = !existing;
  const word = existing ? { ...existing, entries: [...(existing.entries || [])] } : newWord();
  const counts = new Map((word.entries || []).map((e) => [e.bookId, e.count]));

  const bookRows = () => sortedBooks().map((b) => {
    const n = counts.get(b.id) || 0;
    return `<label class="wrow${n ? ' is-on' : ''}" data-book="${attr(b.id)}">
      <span class="wrow-title">${esc(b.title)}</span>
      <span class="wrow-meta">${esc(b.author || '')}</span>
      <input type="number" min="0" max="9999" step="1" value="${n || ''}" placeholder="0"
             data-count="${attr(b.id)}" aria-label="Times in ${attr(b.title)}">
    </label>`;
  }).join('');

  openSheet(`
    <h2>${creating ? 'A word you kept meeting' : 'Edit word'}</h2>
    <div class="field"><label for="w-word">The word</label>
      <input type="text" id="w-word" value="${attr(word.word)}" placeholder="Pantomime"></div>
    <div class="grid-2">
      <div class="field"><label for="w-label">What to call it</label>
        <input type="text" id="w-label" value="${attr(word.label)}" placeholder="Word of the Year"></div>
      <div class="field"><label for="w-period">For</label>
        <input type="text" id="w-period" value="${attr(word.period)}" placeholder="2026"></div>
    </div>
    <div class="field"><label for="w-note">A line underneath</label>
      <textarea id="w-note" rows="2" placeholder="Why it stuck.">${esc(word.note || '')}</textarea></div>

    <p class="form-heading" style="margin-top:1.4rem">Where you met it</p>
    <p class="small muted" style="margin-top:0">Note how often the word appeared. Leave the other books blank.</p>
    ${state.books.length
      ? `<label class="visually-hidden" for="w-book-search">Find a book</label><input class="w-book-search" type="search" id="w-book-search" placeholder="Find a book in your library…"><div class="wlist">${bookRows()}</div><p class="small muted" id="w-no-results" hidden>No matching books.</p>`
      : '<p class="hint">No books logged yet — add some first and they will appear here.</p>'}

    <div class="btn-row" style="margin-top:1.2rem">
      <button class="btn btn-primary grow" type="button" data-save>Save</button>
      <button class="btn" type="button" data-close>Cancel</button>
    </div>
    ${creating ? '' : '<div class="btn-row" style="margin-top:.6rem"><button class="btn btn-danger btn-block" type="button" data-del>Remove this word</button></div>'}
  `, {
    onMount(sheet, close) {
      const searchBooks = sheet.querySelector('#w-book-search');
      if (searchBooks) searchBooks.addEventListener('input', () => {
        const query = searchBooks.value.trim().toLocaleLowerCase();
        let visible = 0;
        sheet.querySelectorAll('.wrow').forEach(row => {
          row.hidden = !!query && !row.textContent.toLocaleLowerCase().includes(query);
          if (!row.hidden) visible++;
        });
        sheet.querySelector('#w-no-results').hidden = visible !== 0;
      });
      sheet.querySelectorAll('[data-count]').forEach((input) => {
        input.addEventListener('input', () => {
          const n = Math.max(0, Number(input.value) || 0);
          if (n > 0) counts.set(input.dataset.count, n); else counts.delete(input.dataset.count);
          input.closest('.wrow').classList.toggle('is-on', n > 0);
        });
      });

      sheet.querySelector('[data-save]').onclick = async () => {
        const next = {
          ...word,
          word: sheet.querySelector('#w-word').value.trim(),
          label: sheet.querySelector('#w-label').value.trim() || 'Word of the Year',
          period: sheet.querySelector('#w-period').value.trim(),
          note: sheet.querySelector('#w-note').value.trim(),
          entries: [...counts].map(([bookId, count]) => ({ bookId, count })),
        };
        if (!next.word) { toast('Give it a word first.', 'bad'); return; }
        try {
          const saved = await saveWord(next);
          close();
          toast(creating ? 'Word saved.' : 'Word updated.');
          if (creating) navigate(`/word/${encodeURIComponent(saved.id)}`); else render();
        } catch (_) {
          toast('Could not save that — storage is unavailable.', 'bad');
        }
      };

      const del = sheet.querySelector('[data-del]');
      if (del) {
        del.onclick = async () => {
          const yes = await confirmSheet({
            title: `Remove “${word.word}”?`,
            body: 'The books themselves are untouched.',
            confirm: 'Remove',
            danger: true,
          });
          if (!yes) return;
          try {
            await deleteWord(word.id);
            close();
            toast('Word removed.');
            navigate('/words');
          } catch (_) {
            toast('Could not save that change.', 'bad');
          }
        };
      }
    },
  });
}
