// Add a book (Open Library search or by hand) and edit an existing one.

import {
  state, newBook, getBook, saveBook, deleteBook,
  knownSeries, knownTags, allChallenges,
} from './state.js';
import { esc, attr, toast, coverImg, navigate, confirmSheet, bookmarkArt, openSheet } from './ui.js';
import { searchBooks, debounce, guessFormat } from './openlibrary.js';
import { AUTHOR_SERIES_HINTS } from './config.js';
import { todayISO, isValidISO, formatDate } from './periods.js';
import { bookmarkCatalog } from './rules.js';

// Handed from the search screen to the form screen.
let pendingPrefill = null;

/* ---------------------------------------------------------- search view ---- */

export function addView() {
  return {
    title: 'Add a book',
    tab: 'books',
    back: true,
    live: false,
    html: `
      <div class="field">
        <label for="ol-q">Search Open Library</label>
        <input id="ol-q" type="search" inputmode="search" autocomplete="off"
               enterkeyhint="search" placeholder="Title, author, ISBN…" autofocus>
        <p class="hint">Results fill in the cover, page count, year and subjects — all editable afterwards.</p>
      </div>
      <div id="ol-status" class="muted small" aria-live="polite"></div>
      <div id="ol-results"></div>
      <div class="card" style="margin-top:1rem">
        <strong>Can’t find it?</strong>
        <p class="muted small" style="margin:.3rem 0 .75rem">Enter the details yourself — same form, nothing pre-filled.</p>
        <button class="btn btn-block" type="button" id="manual">Add manually</button>
      </div>
    `,
    onMount(root) {
      const input = root.querySelector('#ol-q');
      const status = root.querySelector('#ol-status');
      const results = root.querySelector('#ol-results');
      let controller = null;

      root.querySelector('#manual').onclick = () => {
        pendingPrefill = null;
        navigate('/new');
      };

      function show(docs) {
        if (!docs.length) {
          results.innerHTML = '';
          status.textContent = 'No matches. Try fewer words, or add it manually below.';
          return;
        }
        status.textContent = '';
        results.innerHTML = docs.map((d, i) => `
          <button class="result" type="button" data-i="${i}">
            ${coverImg(d, { lazy: false })}
            <span class="grow">
              <span class="result-title">${esc(d.title || 'Untitled')}</span>
              <span class="result-meta">${esc(d.author || 'Unknown author')}</span>
              <span class="result-meta">${d.firstPublishYear ? esc(d.firstPublishYear) : 'Year unknown'}${d.pages ? ` · ${d.pages} pages` : ''}</span>
            </span>
          </button>
        `).join('');
        results.querySelectorAll('.result').forEach((btn) => {
          btn.onclick = () => {
            pendingPrefill = docs[Number(btn.dataset.i)];
            navigate('/new');
          };
        });
      }

      const run = debounce(async (q) => {
        if (controller) controller.abort();
        controller = new AbortController();
        status.textContent = 'Searching…';
        results.innerHTML = '';
        try {
          const docs = await searchBooks(q, { signal: controller.signal });
          show(docs);
        } catch (err) {
          if (err && err.name === 'AbortError') return;
          results.innerHTML = '';
          status.textContent = 'Open Library is not reachable right now — add the book manually below.';
        }
      }, 350);

      input.addEventListener('input', () => {
        const q = input.value.trim();
        if (q.length < 2) {
          run.cancel();
          if (controller) controller.abort();
          status.textContent = '';
          results.innerHTML = '';
          return;
        }
        run(q);
      });
      input.addEventListener('search', () => { if (input.value.trim().length >= 2) run(input.value.trim()); });
      setTimeout(() => input.focus(), 60);
    },
  };
}

/* ------------------------------------------------------------ form view ---- */

function prefillToBook(doc) {
  if (!doc) return newBook({ dateFinished: todayISO() });
  return newBook({
    title: doc.title || '',
    author: doc.author || '',
    authors: doc.authors || [],
    pages: doc.pages || null,
    coverId: doc.coverId || null,
    coverUrl: doc.coverUrl || null,
    olKey: doc.olKey || null,
    firstPublishYear: doc.firstPublishYear || null,
    subjects: doc.subjects || [],
    format: guessFormat(doc.subjects) || '',
    dateFinished: todayISO(),
  });
}

export function bookFormView(params = {}) {
  const editing = !!params.id;
  const existing = editing ? getBook(params.id) : null;

  if (editing && !existing) {
    return {
      title: 'Book not found',
      tab: 'books',
      back: true,
      html: `<div class="empty"><h3>That book is gone</h3>
        <p>It may have been deleted on this device.</p>
        <a class="btn btn-primary" href="#/books">Back to My Books</a></div>`,
    };
  }

  // Working copy — nothing is written until Save.
  const draft = editing ? { ...existing } : prefillToBook(pendingPrefill);
  const guessed = !editing && !!pendingPrefill && !!draft.format;
  pendingPrefill = null;

  const seriesOptions = new Set(knownSeries());
  Object.entries(AUTHOR_SERIES_HINTS).forEach(([author, list]) => {
    if (String(draft.author || '').toLowerCase().includes(author)) {
      list.forEach((s) => seriesOptions.add(s));
    }
  });
  const tagOptions = new Set([...knownTags(), ...(draft.tags || [])]);

  return {
    title: editing ? 'Edit book' : 'New book',
    tab: 'books',
    back: true,
    live: false,
    html: `
      <form id="book-form" novalidate>
        <section class="card">
          <div class="row" style="align-items:flex-start;gap:.9rem;margin-bottom:.9rem">
            <div id="cover-preview">${coverImg(draft, { big: true, lazy: false })}</div>
            <div class="grow">
              <div class="field" style="margin-bottom:.6rem">
                <label for="f-title">Title</label>
                <input id="f-title" name="title" type="text" value="${attr(draft.title)}" required autocomplete="off">
              </div>
              <div class="field" style="margin-bottom:0">
                <label for="f-author">Author</label>
                <input id="f-author" name="author" type="text" value="${attr(draft.author)}" autocomplete="off">
              </div>
            </div>
          </div>

          <div class="grid-2">
            <div class="field">
              <label for="f-pages">Pages</label>
              <input id="f-pages" name="pages" type="number" inputmode="numeric" min="1" max="20000"
                     value="${draft.pages == null ? '' : attr(draft.pages)}">
            </div>
            <div class="field">
              <label for="f-year">First published</label>
              <input id="f-year" name="firstPublishYear" type="number" inputmode="numeric" min="-3000" max="2100"
                     value="${draft.firstPublishYear == null ? '' : attr(draft.firstPublishYear)}">
            </div>
          </div>

          <div class="field">
            <label for="f-cover">Cover image URL</label>
            <input id="f-cover" name="coverUrl" type="text" inputmode="url" autocomplete="off"
                   value="${attr(draft.coverUrl || '')}" placeholder="https://covers.openlibrary.org/…">
          </div>

          <div class="field" style="margin-bottom:0">
            <label for="f-subjects">Subjects</label>
            <input id="f-subjects" name="subjects" type="text" autocomplete="off"
                   value="${attr((draft.subjects || []).join(', '))}" placeholder="comma separated">
            <p class="hint">From Open Library. Used to pre-select Fiction/Nonfiction.</p>
          </div>
        </section>

        <h2 class="section-title">When I read it</h2>
        <section class="card">
          <div class="grid-2">
            <div class="field" style="margin-bottom:0">
              <label for="f-finished">Date finished</label>
              <input id="f-finished" name="dateFinished" type="date" required
                     value="${attr(draft.dateFinished || todayISO())}">
            </div>
            <div class="field" style="margin-bottom:0">
              <label for="f-started">Date started <span class="muted">(optional)</span></label>
              <input id="f-started" name="dateStarted" type="date" value="${attr(draft.dateStarted || '')}">
            </div>
          </div>
          <p class="hint" id="period-hint"></p>
        </section>

        <h2 class="section-title">How it counts</h2>
        <section class="card">
          <div class="field">
            <span class="field-label">Fiction or nonfiction <span class="muted">(required)</span></span>
            <div class="seg" id="f-format" role="group" aria-label="Fiction or nonfiction">
              <button type="button" data-v="fiction" aria-pressed="${draft.format === 'fiction'}">Fiction</button>
              <button type="button" data-v="nonfiction" aria-pressed="${draft.format === 'nonfiction'}">Nonfiction</button>
            </div>
            ${guessed ? `<p class="hint">Pre-selected <b>${esc(draft.format)}</b> from the Open Library subjects — change it if that's wrong.</p>` : ''}
          </div>

          <label class="switch-row">
            <input type="checkbox" id="f-classic" ${draft.isClassic ? 'checked' : ''}>
            <span class="switch-text">Classic<em>Counts toward Classic Every Quarter</em></span>
          </label>
          <label class="switch-row">
            <input type="checkbox" id="f-reread" ${draft.isReread ? 'checked' : ''}>
            <span class="switch-text">Re-read<em>Still counts toward every goal</em></span>
          </label>
          <label class="switch-row">
            <input type="checkbox" id="f-tbr" ${draft.isTbr ? 'checked' : ''}>
            <span class="switch-text">From my physical TBR<em>Counts toward Physical TBR Every Other Month</em></span>
          </label>
        </section>

        <h2 class="section-title">Series &amp; tags</h2>
        <section class="card">
          <div class="field">
            <label for="f-series">Series <span class="muted">(optional)</span></label>
            <input id="f-series" name="series" type="text" autocomplete="off" list="series-list"
                   value="${attr(draft.series || '')}">
            <datalist id="series-list">
              ${[...seriesOptions].map((s) => `<option value="${attr(s)}"></option>`).join('')}
            </datalist>
            ${seriesOptions.size ? `<div class="chips" style="margin-top:.45rem" id="series-chips">
              ${[...seriesOptions].map((s) => `<button class="chip" type="button" data-series="${attr(s)}">${esc(s)}</button>`).join('')}
            </div>` : ''}
          </div>

          <div class="field" style="margin-bottom:0">
            <span class="field-label">Tags <span class="muted">(optional)</span></span>
            <div class="chips" id="tag-chips">
              ${[...tagOptions].map((t) => `<button class="chip" type="button" data-tag="${attr(t)}"
                 aria-pressed="${(draft.tags || []).includes(t)}">${esc(t)}</button>`).join('')}
              ${tagOptions.size ? '' : '<span class="muted small">No tags yet — add one below.</span>'}
            </div>
            <div class="row" style="margin-top:.55rem">
              <input id="f-newtag" type="text" placeholder="New tag" autocomplete="off" enterkeyhint="done">
              <button class="btn btn-sm nowrap" type="button" id="add-tag">Add tag</button>
            </div>
          </div>
        </section>

        <h2 class="section-title">Notes</h2>
        <section class="card">
          <div class="field" style="margin-bottom:0">
            <label for="f-notes" class="visually-hidden">Notes</label>
            <textarea id="f-notes" placeholder="Anything you want to remember (optional)">${esc(draft.notes || '')}</textarea>
          </div>
        </section>

        <div class="btn-row" style="margin-top:1rem">
          <button class="btn btn-primary grow" type="submit">${editing ? 'Save changes' : 'Add to my books'}</button>
          ${editing ? '<button class="btn btn-danger" type="button" id="delete-book">Delete</button>' : ''}
        </div>
      </form>
    `,

    onMount(root) {
      const form = root.querySelector('#book-form');
      const tags = new Set(draft.tags || []);
      let format = draft.format || '';

      /* format segmented control */
      const seg = root.querySelector('#f-format');
      const setFormat = (v) => {
        format = v;
        seg.classList.remove('unset');
        seg.querySelectorAll('button').forEach((b) => {
          b.setAttribute('aria-pressed', String(b.dataset.v === v));
        });
      };
      seg.querySelectorAll('button').forEach((b) => { b.onclick = () => setFormat(b.dataset.v); });

      /* live cover preview */
      const coverField = root.querySelector('#f-cover');
      const preview = root.querySelector('#cover-preview');
      const repaintCover = () => {
        preview.innerHTML = coverImg({
          title: root.querySelector('#f-title').value,
          coverUrl: coverField.value.trim() || null,
        }, { big: true, lazy: false });
      };
      coverField.addEventListener('change', repaintCover);
      root.querySelector('#f-title').addEventListener('change', repaintCover);

      /* which period the finish date lands in */
      const finished = root.querySelector('#f-finished');
      const hint = root.querySelector('#period-hint');
      const repaintPeriod = () => {
        const v = finished.value;
        if (!isValidISO(v)) { hint.textContent = ''; return; }
        const year = Number(v.slice(0, 4));
        if (year !== state.settings.year) {
          hint.innerHTML = `<b>${formatDate(v)}</b> is outside ${state.settings.year}, so this book will not count toward your goals.`;
          return;
        }
        const q = ['Q1', 'Q2', 'Q3', 'Q4'][Math.floor((Number(v.slice(5, 7)) - 1) / 3)];
        hint.textContent = `Counts toward ${q} ${year}.`;
      };
      finished.addEventListener('change', repaintPeriod);
      repaintPeriod();

      /* series chips */
      const seriesInput = root.querySelector('#f-series');
      root.querySelectorAll('#series-chips .chip').forEach((chip) => {
        chip.onclick = () => {
          const v = chip.dataset.series;
          seriesInput.value = seriesInput.value === v ? '' : v;
        };
      });

      /* tags */
      const tagHost = root.querySelector('#tag-chips');
      const renderTagChips = () => {
        const all = new Set([...knownTags(), ...tags]);
        tagHost.innerHTML = all.size
          ? [...all].map((t) => `<button class="chip" type="button" data-tag="${attr(t)}" aria-pressed="${tags.has(t)}">${esc(t)}</button>`).join('')
          : '<span class="muted small">No tags yet — add one below.</span>';
        tagHost.querySelectorAll('.chip').forEach((chip) => {
          chip.onclick = () => {
            const t = chip.dataset.tag;
            if (tags.has(t)) tags.delete(t); else tags.add(t);
            renderTagChips();
          };
        });
      };
      renderTagChips();

      const newTag = root.querySelector('#f-newtag');
      const addTag = () => {
        const v = newTag.value.trim();
        if (!v) return;
        tags.add(v);
        newTag.value = '';
        renderTagChips();
      };
      root.querySelector('#add-tag').onclick = addTag;
      newTag.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); addTag(); }
      });

      /* delete */
      const del = root.querySelector('#delete-book');
      if (del) {
        del.onclick = async () => {
          const yes = await confirmSheet({
            title: `Delete “${draft.title}”?`,
            body: 'It is removed from your 2027 list and your goal counts. Bookmarks you already collected stay collected.',
            confirm: 'Delete',
            danger: true,
          });
          if (!yes) return;
          try {
            await deleteBook(draft.id);
            toast('Book deleted.');
            navigate('/books');
          } catch (_) {
            toast('Could not delete that book — storage is unavailable.', 'bad');
          }
        };
      }

      /* save */
      form.onsubmit = async (e) => {
        e.preventDefault();
        const title = root.querySelector('#f-title').value.trim();
        const dateFinished = finished.value;

        if (!title) {
          toast('A title is required.', 'bad');
          root.querySelector('#f-title').focus();
          return;
        }
        if (!isValidISO(dateFinished)) {
          toast('Pick the date you finished it.', 'bad');
          finished.focus();
          return;
        }
        if (!format) {
          toast('Choose Fiction or Nonfiction.', 'bad');
          seg.classList.add('unset');
          seg.scrollIntoView({ block: 'center', behavior: 'smooth' });
          return;
        }
        const started = root.querySelector('#f-started').value;
        if (started && isValidISO(started) && started > dateFinished) {
          toast('The start date is after the finish date.', 'bad');
          return;
        }

        const pages = Number(root.querySelector('#f-pages').value);
        const year = Number(root.querySelector('#f-year').value);
        const record = {
          ...draft,
          title,
          author: root.querySelector('#f-author').value.trim(),
          authors: draft.authors && draft.authors.length
            ? draft.authors
            : root.querySelector('#f-author').value.split(',').map((s) => s.trim()).filter(Boolean),
          pages: Number.isFinite(pages) && pages > 0 ? pages : null,
          firstPublishYear: Number.isFinite(year) && year !== 0 ? year : null,
          coverUrl: coverField.value.trim() || null,
          subjects: root.querySelector('#f-subjects').value
            .split(',').map((s) => s.trim()).filter(Boolean),
          dateFinished,
          dateStarted: started && isValidISO(started) ? started : null,
          format,
          isClassic: root.querySelector('#f-classic').checked,
          isReread: root.querySelector('#f-reread').checked,
          isTbr: root.querySelector('#f-tbr').checked,
          series: seriesInput.value.trim() || null,
          tags: [...tags],
          notes: root.querySelector('#f-notes').value.trim(),
        };

        try {
          const { unlocked } = await saveBook(record);
          if (unlocked.length) {
            celebrate(unlocked);
          } else {
            toast(editing ? 'Changes saved.' : `“${esc(title)}” added.`, 'good');
          }
          navigate('/books');
        } catch (_) {
          toast('Could not save — this device is blocking local storage.', 'bad');
        }
      };
    },
  };
}

// Bookmark unlock celebration, shown after a save that completed a period.
function celebrate(ids) {
  const catalog = bookmarkCatalog(allChallenges());
  const items = ids.map((id) => ({ id, meta: catalog.get(id) }));
  const lines = items.map(({ id, meta }) => `
    <div class="row" style="gap:.7rem;padding:.4rem 0">
      <div style="width:40px;flex:none">${bookmarkArt(id, { bonus: meta && meta.bonus })}</div>
      <div class="grow">
        <div style="font-weight:650">${esc(meta ? meta.challengeName : id)}</div>
        <div class="small muted">${esc(meta ? meta.title : '')}${meta && meta.bonus ? ' · bonus' : ''}</div>
      </div>
    </div>`).join('');

  openSheet(`
    <h2>${ids.length === 1 ? 'Bookmark unlocked' : `${ids.length} bookmarks unlocked`}</h2>
    ${lines}
    <div class="btn-row" style="margin-top:.9rem">
      <a class="btn grow" href="#/bookmarks" data-close>See bookmarks</a>
      <button class="btn btn-primary grow" type="button" data-close>Nice</button>
    </div>
  `);
}
