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
import * as assets from './assets.js';

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
      <section class="section form-wrap">
      <div class="section-head" style="margin-bottom:1.6rem"><div>
        <h2 class="section-title">Add a book</h2>
        <p class="section-sub">Search Open Library, or write it in by hand.</p>
      </div></div>
      <div class="field">
        <label for="ol-q">Search</label>
        <input id="ol-q" type="search" inputmode="search" autocomplete="off"
               enterkeyhint="search" placeholder="Title, author, ISBN…" autofocus>
        <p class="hint">Results fill in the cover, page count, year and subjects — all editable afterwards.</p>
      </div>
      <div class="book-search-filters" aria-label="Search filters">
        <label>Search by <select id="ol-by"><option value="all">Title or author</option><option value="title">Title only</option><option value="author">Author only</option><option value="isbn">ISBN</option></select></label>
        <label>Language <select id="ol-language"><option value="en">English preferred</option><option value="all">All languages</option></select></label>
      </div>
      <div id="ol-status" class="muted small" aria-live="polite"></div>
      <div id="ol-results"></div>
      <div class="panel" style="margin-top:1rem">
        <strong>Can’t find it?</strong>
        <p class="muted small" style="margin:.3rem 0 .75rem">Enter the details yourself — same form, nothing pre-filled.</p>
        <button class="btn btn-block" type="button" id="manual">Add manually</button>
      </div>
      </section>
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
          status.textContent = 'No matches. Try All languages, search by title, or add it manually below.';
          return;
        }
        status.textContent = `${docs.length} possible matches · best title matches first`;
        results.innerHTML = docs.slice(0, 15).map((d, i) => `
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
          const docs = await searchBooks(q, {
            signal: controller.signal,
            by: root.querySelector('#ol-by').value,
            language: root.querySelector('#ol-language').value,
          });
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
      root.querySelectorAll('#ol-by, #ol-language').forEach(filter => {
        filter.onchange = () => {
          if (input.value.trim().length >= 2) run(input.value.trim());
        };
      });
      setTimeout(() => input.focus(), 60);
    },
  };
}

/* ------------------------------------------------------------ form view ---- */

function prefillToBook(doc) {
  if (!doc) return newBook();
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
    dateFinished: '',
    status: 'want',
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
  const personalShelves = Array.isArray(state.settings.customShelves) ? state.settings.customShelves : [];

  return {
    title: editing ? 'Edit book' : 'New book',
    tab: 'books',
    back: true,
    live: false,
    html: `
      <section class="section form-wrap">
      <div class="section-head" style="margin-bottom:1.6rem"><div>
        <h2 class="section-title">${editing ? 'Edit entry' : 'New entry'}</h2>
        <p class="section-sub">${editing ? 'Change anything — the goals recount themselves.' : 'Everything here is yours to adjust.'}</p>
      </div></div>
      <form id="book-form" novalidate>
        <section class="panel">
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
          <div class="book-cover-upload">
            <label class="btn" for="f-cover-upload">Upload your own cover
              <input type="file" id="f-cover-upload" accept="image/*" class="visually-hidden"></label>
            <button type="button" id="f-cover-original" ${draft.customCoverAssetId ? '' : 'hidden'}>Use original cover</button>
            <p class="hint">Your uploaded cover replaces the catalog image only for this book.</p>
          </div>

          <div class="field" style="margin-bottom:0">
            <label for="f-subjects">Subjects</label>
            <input id="f-subjects" name="subjects" type="text" autocomplete="off"
                   value="${attr((draft.subjects || []).join(', '))}" placeholder="comma separated">
            <p class="hint">From Open Library. Used to pre-select Fiction/Nonfiction.</p>
          </div>
        </section>

        <h2 class="form-heading">On my shelf</h2>
        <section class="panel">
          <div class="field">
            <label for="f-status">Reading status</label>
            <select id="f-status" name="status" class="shelf-status-select">
              ${[['want','Want to read'],['reading','Currently reading'],['read','Read'],['dnf','Did not finish']].map(([key,label]) => `<option value="${key}" ${(draft.status || (draft.dateFinished ? 'read' : 'want')) === key ? 'selected' : ''}>${label}</option>`).join('')}
            </select>
          </div>
          <div class="grid-2">
            <div class="field" style="margin-bottom:0">
              <label for="f-finished">Date finished <span class="muted">(optional)</span></label>
              <input id="f-finished" name="dateFinished" type="date"
                     value="${attr(draft.dateFinished || '')}">
            </div>
            <div class="field" style="margin-bottom:0">
              <label for="f-started">Date started <span class="muted">(optional)</span></label>
              <input id="f-started" name="dateStarted" type="date" value="${attr(draft.dateStarted || '')}">
            </div>
          </div>
          <p class="hint" id="period-hint"></p>
          <p class="hint">Save books at any stage. Only books marked Read with a finish date count toward dated reading challenges.</p>
          ${personalShelves.length ? `<div class="field lit-book-form-shelves"><span class="field-label">Personal shelves <span class="muted">(optional)</span></span>
            ${personalShelves.map(s=>`<label><input type="checkbox" data-personal-shelf value="${attr(s.id)}" ${(draft.shelves || []).includes(s.id) ? 'checked' : ''}> ${esc(s.name)}</label>`).join('')}
          </div>` : ''}
        </section>

        <h2 class="form-heading">How it counts</h2>
        <section class="panel">
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

        <h2 class="form-heading">Series &amp; tags</h2>
        <section class="panel">
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

        <h2 class="form-heading">Notes</h2>
        <section class="panel">
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
      </section>
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
      let customCoverAssetId = draft.customCoverAssetId || null;
      const repaintCover = () => {
        preview.innerHTML = coverImg({
          title: root.querySelector('#f-title').value,
          coverUrl: coverField.value.trim() || null,
          customCoverAssetId,
        }, { big: true, lazy: false });
      };
      root.querySelector('#f-cover-upload').onchange = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
          const uploaded = await assets.add(file, {kind:'artwork',name:`Cover · ${draft.title || file.name}`});
          customCoverAssetId = uploaded.id;
          root.querySelector('#f-cover-original').hidden = false;
          repaintCover();
          toast('Cover uploaded. Save the book to keep it.', 'good');
        } catch (_) { toast('Could not upload this cover image.', 'bad'); }
      };
      root.querySelector('#f-cover-original').onclick = () => {
        customCoverAssetId = null;
        root.querySelector('#f-cover-original').hidden = true;
        repaintCover();
      };
      coverField.addEventListener('change', repaintCover);
      root.querySelector('#f-title').addEventListener('change', repaintCover);

      /* which period the finish date lands in */
      const finished = root.querySelector('#f-finished');
      const readingStatus = root.querySelector('#f-status');
      const hint = root.querySelector('#period-hint');
      const repaintPeriod = () => {
        const v = finished.value;
        if (readingStatus.value !== 'read') { hint.textContent = 'On your shelf, not counted as finished.'; return; }
        if (!isValidISO(v)) { hint.textContent = 'Add a finish date whenever you want to count this book toward dated reading goals.'; return; }
        const year = Number(v.slice(0, 4));
        if (year !== state.settings.year) {
          hint.innerHTML = `<b>${formatDate(v)}</b> is outside ${state.settings.year}, so this book will not count toward your goals.`;
          return;
        }
        const q = ['Q1', 'Q2', 'Q3', 'Q4'][Math.floor((Number(v.slice(5, 7)) - 1) / 3)];
        hint.textContent = `Counts toward ${q} ${year}.`;
      };
      finished.addEventListener('change', repaintPeriod);
      readingStatus.addEventListener('change', repaintPeriod);
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
        if (dateFinished && !isValidISO(dateFinished)) {
          toast('Check the finish date.', 'bad');
          finished.focus();
          return;
        }
        const started = root.querySelector('#f-started').value;
        if (started && dateFinished && isValidISO(started) && started > dateFinished) {
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
          customCoverAssetId,
          subjects: root.querySelector('#f-subjects').value
            .split(',').map((s) => s.trim()).filter(Boolean),
          status: readingStatus.value,
          previousFinishDate: readingStatus.value === 'read' ? (draft.previousFinishDate || '') : (dateFinished || draft.previousFinishDate || ''),
          dateFinished: readingStatus.value === 'read' ? dateFinished : '',
          dateStarted: started && isValidISO(started) ? started : null,
          format,
          isClassic: root.querySelector('#f-classic').checked,
          isReread: root.querySelector('#f-reread').checked,
          isTbr: root.querySelector('#f-tbr').checked,
          series: seriesInput.value.trim() || null,
          tags: [...tags],
          shelves: [...root.querySelectorAll('[data-personal-shelf]:checked')].map(el=>el.value),
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
