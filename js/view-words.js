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
      <section class="ed">
        <div class="ed-head ed-head-split">
          <div>
            <p class="ed-kicker">Kept turning up</p>
            <h2 class="ed-title">Words</h2>
          </div>
          <button class="btn btn-sm btn-primary" type="button" id="new-word">Add a word</button>
        </div>
        ${words.length ? `<div class="list">${words.map((w) => {
          const st = wordStats(w);
          return `<article class="list-row">
            <a class="list-row-link" href="#/word/${encodeURIComponent(w.id)}">
              <span class="grow">
                <span class="entry-title">${esc(w.word || 'Untitled')}</span>
                <span class="entry-meta">${esc(w.label || '')}${w.period ? ` · ${esc(w.period)}` : ''}</span>
                <span class="entry-meta">${st.books} book${st.books === 1 ? '' : 's'} · ${st.total} time${st.total === 1 ? '' : 's'}</span>
              </span>
            </a>
          </article>`;
        }).join('')}</div>`
        : `<div class="empty"><h3>No words yet</h3>
             <p>A word of the year is one you kept meeting — add it, then record the books you met it in.</p></div>`}
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
    <p class="small muted" style="margin-top:0">How many times the word turned up in each book. Leave a book blank if it never did.</p>
    ${state.books.length
      ? `<div class="wlist">${bookRows()}</div>`
      : '<p class="hint">No books logged yet — add some first and they will appear here.</p>'}

    <div class="btn-row" style="margin-top:1.2rem">
      <button class="btn btn-primary grow" type="button" data-save>Save</button>
      <button class="btn" type="button" data-close>Cancel</button>
    </div>
    ${creating ? '' : '<div class="btn-row" style="margin-top:.6rem"><button class="btn btn-danger btn-block" type="button" data-del>Remove this word</button></div>'}
  `, {
    onMount(sheet, close) {
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
