// Challenges: the index, and the challenge spread — the reference layout, with
// the bookmark collection as its centrepiece.

import {
  state, allChallenges, getChallenge, saveChallenge, archiveChallenge,
  unlockMap, knownTags, knownSeries, uid, sortedBooks,
} from './state.js';
import {
  esc, attr, toast, progressBar, progressLine, markVisual, checkBadge, checkGlyph,
  openSheet, navigate, confirmSheet, coverImg, render,
} from './ui.js';
import { evaluate, describeFilter, describeWindow, bookmarkLabels, eligibility, matchesFilter } from './rules.js?v=121';
import { formatDate, quarters, YEAR } from './periods.js';
import { FILTER_TYPES, WINDOW_TYPES } from './config.js?v=121';
import { t } from './theme.js';
import { renderSections, renderSection } from './sections.js?v=126';
import { figure, backdrop, media } from './media.js';
import * as layout from './layout.js';
import * as assets from './assets.js';
import { openMediaEditor } from './view-layout.js';
import { searchBooks, debounce } from './openlibrary.js';

/* ----------------------------------------------------------------- list ---- */

export const DIRECTORY_PAGE_ID = 'directory';

export function challengesView() {
  const sections = layout.get(DIRECTORY_PAGE_ID);
  const challenges = allChallenges();
  return {
    title: t('challengesHeading'),
    tab: 'challenges',
    banner: false,
    editorial: true,
    editPage: DIRECTORY_PAGE_ID,
    html: `
      ${renderSections(sections)}
      <footer class="lit-challenge-invite" aria-label="Challenge management">
      <div class="lit-challenge-tools" aria-label="Challenge management">
        <details class="lit-challenge-manage">
          <summary>Manage challenges <span aria-hidden="true">⌄</span></summary>
          <div class="lit-challenge-manage-list">
            ${challenges.map((challenge) => `<div class="lit-challenge-manage-row">
              <a href="#/challenge/${encodeURIComponent(challenge.id)}">${esc(challenge.name)}</a>
              <button type="button" data-edit-challenge="${attr(challenge.id)}" aria-label="Edit ${attr(challenge.name)}">Edit</button>
            </div>`).join('')}
          </div>
        </details>
        <button type="button" class="lit-challenge-add" id="new-challenge-bottom">+ Add challenge</button>
      </div>
      </footer>
    `,
    onMount(root) {
      const addButton = root.querySelector('#new-challenge-bottom');
      if (addButton) addButton.onclick = () => openEditor(null);
      root.querySelectorAll('[data-edit-challenge]').forEach((button) => {
        button.onclick = () => {
          const challenge = getChallenge(button.dataset.editChallenge);
          if (challenge) openEditor(challenge);
        };
      });
    },
  };
}

// Which spread we have already scrolled to a section on, so a re-render does
// not scroll again.
let focusedFor = null;

/* --------------------------------------------------------------- detail ---- */

export function challengePageId(id) { return `challenge:${id}`; }

// The working list under the collection: what each period still needs.
function periodDetail(p, have) {
  const unlocked = !!(p.bookmarkId && have.has(p.bookmarkId));
  const books = p.books.length
    ? `<span style="display:block;margin-top:.3rem">${p.books.map((b) => `
        <a class="row small" href="#/book/${encodeURIComponent(b.id)}" style="color:inherit;text-decoration:none;padding:.1rem 0">
          <span class="grow truncate">${esc(b.title)}</span>
          <span class="muted tiny nowrap">${esc(formatDate(b.dateFinished))}</span>
        </a>`).join('')}</span>`
    : '<span class="tick-note">Nothing logged yet.</span>';

  return `<div class="tick${p.complete ? ' done' : ''}">
    <span class="tick-mark" aria-hidden="true">${checkGlyph()}</span>
    <span class="tick-body">
      <span class="row-between">
        <span class="tick-title">${esc(p.label)}</span>
        <span class="tag tag-plain nowrap">${p.count} of ${p.target == null ? '—' : p.target}</span>
      </span>
      ${books}
      ${p.bookmarkId ? `<span class="tick-note">${unlocked ? 'Bookmark collected' : 'Bookmark still locked'}</span>` : ''}
    </span>
  </div>`;
}

export function challengeDetailView(params) {
  const challenge = getChallenge(params.id);
  if (!challenge) {
    return {
      title: 'Not found',
      tab: 'challenges',
      back: true,
      html: `<div class="empty"><h3>No such challenge</h3>
        <a class="btn" href="#/challenges">All challenges</a></div>`,
    };
  }

  const r = evaluate(challenge, state.books);
  const have = unlockMap();

  // A challenge with no target can't yield anything yet; that's a prompt to
  // finish setting it up, not editorial content, so it isn't a section.
  const unsetNotice = r.targetUnset
    ? `<div class="ed sp-tight"><div class="notice">
         <strong>This challenge has no target yet.</strong>
         Nothing can be collected until you say how many books it takes — and who counts.
         <div class="btn-row" style="margin-top:.8rem">
           <button class="btn btn-sm btn-primary" type="button" id="edit-challenge">Set target &amp; authors</button>
         </div>
       </div></div>`
    : '';

  // Every editorial block on this page is a section in the page's layout, so
  // what the Layouts editor lists is exactly what renders. The page passes the
  // challenge in as context; the sections draw themselves from it.
  const ctx = { challenge, result: r, have };
  const spread = renderSections(layout.get(challengePageId(challenge.id)), ctx);

  return {
    title: challenge.name,
    tab: 'challenges',
    banner: false,
    editorial: true,
    editPage: challengePageId(challenge.id),
    back: true,
    // A challenge spread is long, and saving from a sheet re-renders it.
    // Without this you are thrown back to the top every time you tick a book.
    keepScroll: true,
    actions: '',
    html: `
      ${spread}
      ${unsetNotice}
      <footer class="challenge-detail-toolbar" aria-label="Challenge settings" style="box-sizing:border-box;display:flex;align-items:center;justify-content:flex-end;width:min(100% - 40px, 1200px);margin:32px auto 52px;padding:16px 8px 10px;border-top:1px solid var(--c-rule, #d9caba);">
        <button type="button" id="edit-challenge-inline" class="lit-challenge-add" style="appearance:none;display:inline-flex;align-items:center;justify-content:center;min-height:34px;margin:0;padding:5px 10px;border:0;border-bottom:1px solid var(--c-rule-strong, #cbbba7);border-radius:0;background:transparent;box-shadow:none;color:var(--c-accent, #ad4069);font-family:var(--f-ui, serif);font-size:var(--fs-label, 14px);font-weight:400;letter-spacing:.08em;line-height:1.4;text-transform:none;cursor:pointer;">Edit challenge</button>
      </footer>
    `,
    onMount(root) {
      // Arriving from a bookmark's "Go to eligible books": the section is well
      // down a long spread, so land on it rather than at the top. Once per
      // arrival — the page re-renders whenever anything is saved, and
      // re-scrolling then would yank the page out from under you.
      if (params.query && params.query.focus === 'eligible') {
        const key = `${challenge.id}:eligible`;
        if (focusedFor !== key) {
          focusedFor = key;
          const target = root.querySelector('.ed-challengeEligible');
          if (target) setTimeout(() => target.scrollIntoView({ block: 'start' }), 60);
        }
      } else {
        focusedFor = null;
      }

      const open = () => openEditor(challenge);
      const visibleEdit = root.querySelector('#edit-challenge-inline');
      if (visibleEdit) visibleEdit.onclick = open;
      const top = document.getElementById('edit-top');
      if (top) top.onclick = open;
      const inline = root.querySelector('#edit-challenge');
      if (inline) inline.onclick = open;

      const pick = root.querySelector('#pick-eligible');
      if (pick) pick.onclick = () => openEligiblePicker(challenge);

    },
  };
}

/* ------------------------------------------------------ eligible books ---- */

/**
 * Choose which books count toward a challenge.
 *
 * The rule decides by default and the tick reflects that, so the sheet opens
 * showing the truth rather than an empty list. Changing a tick records an
 * override — "count this anyway", or "not this one" — and matching the rule
 * again clears the override rather than leaving a redundant one behind.
 */
export function openEligiblePicker(challenge) {
  const include = new Set(challenge.includeBooks || []);
  const exclude = new Set(challenge.excludeBooks || []);
  const books = sortedBooks();

  const row = (b) => {
    const state_ = eligibility(b, challenge);
    const on = state_ === 'matched' || state_ === 'picked';
    const note = state_ === 'picked' ? 'chosen by hand'
      : state_ === 'excluded' ? 'ruled out by hand'
        : state_ === 'matched' ? 'matches the rule' : '';
    return `<label class="erow${on ? ' is-on' : ''}" data-book="${attr(b.id)}">
      <input type="checkbox" data-pick="${attr(b.id)}" ${on ? 'checked' : ''}>
      <span class="erow-body">
        <span class="erow-title">${esc(b.title)}</span>
        <span class="erow-meta">${esc(b.author || '')}${b.dateFinished ? ` · ${esc(formatDate(b.dateFinished))}` : ''}</span>
        <span class="erow-why" data-why="${attr(b.id)}">${esc(note)}</span>
      </span>
    </label>`;
  };

  openSheet(`
    <h2>Eligible books</h2>
    <p class="small muted" style="margin-top:0">
      ${esc(describeFilter(challenge.filter))} counts automatically. Tick anything else
      that should, or untick one that shouldn't.
    </p>
    ${books.length
      ? `<div class="elist">${books.map(row).join('')}</div>`
      : '<p class="hint">No books logged yet.</p>'}
    <div class="btn-row" style="margin-top:1.2rem">
      <button class="btn btn-primary grow" type="button" data-save>Save</button>
      <button class="btn" type="button" data-close>Cancel</button>
    </div>
  `, {
    onMount(sheet, close) {
      sheet.querySelectorAll('[data-pick]').forEach((box) => {
        box.addEventListener('change', () => {
          const id = box.dataset.pick;
          const book = books.find((b) => b.id === id);
          const byRule = matchesFilter(book, challenge.filter);
          include.delete(id);
          exclude.delete(id);
          // Only record an override where it actually differs from the rule.
          if (box.checked && !byRule) include.add(id);
          if (!box.checked && byRule) exclude.add(id);

          const why = sheet.querySelector(`[data-why="${CSS.escape(id)}"]`);
          if (why) {
            why.textContent = include.has(id) ? 'chosen by hand'
              : exclude.has(id) ? 'ruled out by hand'
                : byRule ? 'matches the rule' : '';
          }
          box.closest('.erow').classList.toggle('is-on', box.checked);
        });
      });

      sheet.querySelector('[data-save]').onclick = async () => {
        try {
          await saveChallenge({
            id: challenge.id,
            custom: !!challenge.custom,
            includeBooks: [...include],
            excludeBooks: [...exclude],
          });
          close();
          toast('Eligible books saved.');
          render();
        } catch (_) {
          toast('Could not save that change.', 'bad');
        }
      };
    },
  });
}

/* --------------------------------------------------------------- editor ---- */

function slug(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'challenge';
}

// Cover settings belong to the challenge editor, not a separate page action.
function openChallengeCoverEditor(challenge, root) {
  openMediaEditor(
            challenge.cover || media({ ratio: 'auto', frame: 'none', shadow: false }),
            async (next) => {
              try {
                await saveChallenge({ id: challenge.id, custom: !!challenge.custom, cover: next });
                toast('Cover saved.');
                render();
              } catch (_) {
                toast('Could not save that change.', 'bad');
              }
            },
            { role: 'backdrop', size: '1800 × 1100 px',
              previewSelection(chosenId, tweaks = {}) {
                const hero = root.querySelector('.ed-challengeHero .m-backdrop');
                if (!hero) return () => {};
                const previousStyle = hero.getAttribute('style');
                const previousClass = hero.className;
                const url = assets.src(chosenId);
                if (url) {
                  hero.classList.remove('m-backdrop-empty');
                  hero.style.backgroundImage = `url("${url.replace(/"/g, '%22')}")`;
                } else {
                  hero.style.backgroundImage = 'none';
                  hero.classList.add('m-backdrop-empty');
                }
                hero.style.backgroundPosition = `${Number(tweaks.focalX ?? 50)}% ${Number(tweaks.focalY ?? 50)}%`;
                hero.style.opacity = String(Number(tweaks.opacity ?? 1));
                return () => {
                  hero.className = previousClass;
                  if (previousStyle == null) hero.removeAttribute('style');
                  else hero.setAttribute('style', previousStyle);
                };
              },
            },
          );
}

let pendingChallengeForm = null;

export function openEditor(challenge) {
  const creating = !challenge;
  const c = challenge || {
    id: '',
    name: '',
    custom: true,
    filter: { type: 'any' },
    window: { type: 'year', year: YEAR },
    target: 1,
  };

  const filterType = c.filter ? c.filter.type : 'any';
  const windowType = c.window ? c.window.type : 'year';

  openSheet(`
    <h2>${creating ? 'New challenge' : `Edit ${esc(c.name)}`}</h2>
    <form id="ch-form">
      <div class="field">
        <label for="ch-name">Name</label>
        <input id="ch-name" type="text" value="${attr(c.name)}" required autocomplete="off">
      </div>

      <div class="field">
        <label for="ch-filter">Counts books where…</label>
        <select id="ch-filter" >
          ${FILTER_TYPES.map((f) => `<option value="${attr(f.value)}" ${f.value === filterType ? 'selected' : ''}>${esc(f.label)}</option>`).join('')}
        </select>
      </div>

      <div class="field" id="filter-extra"></div>

      <div class="field">
        <label for="ch-window">Time window</label>
        <select id="ch-window" >
          ${WINDOW_TYPES.map((w) => `<option value="${attr(w.value)}" ${w.value === windowType ? 'selected' : ''}>${esc(w.label)}</option>`).join('')}
        </select>
      </div>

      <div class="field" id="window-extra"></div>

      <div class="field">
        <label for="ch-target">Target <span class="muted" id="target-note"></span></label>
        <input id="ch-target" type="number" inputmode="numeric" min="1" max="999"
               value="${c.target == null ? '' : attr(c.target)}" placeholder="e.g. 3">
        <p class="hint" id="bookmark-note"></p>
      </div>

      ${!creating ? `<div class="field">
        <label>Cover artwork</label>
        <button class="btn" id="ch-edit-cover" type="button">Edit cover artwork</button>
        <p class="hint">Choose, crop, and position the artwork for this challenge.</p>
      </div>` : ''}

      <div class="btn-row" style="margin-top:.3rem">
        <button class="btn grow" type="button" data-close>Cancel</button>
        <button class="btn btn-primary grow" type="submit">${creating ? 'Create' : 'Save'}</button>
      </div>
      ${!creating ? `<details class="lit-challenge-more"><summary>More options</summary><button type="button" id="ch-remove" class="btn btn-danger btn-sm">Remove this challenge</button></details>` : ''}
    </form>
  `, {
    onMount(sheet, close) {
      const nameEl = sheet.querySelector('#ch-name');
      const filterEl = sheet.querySelector('#ch-filter');
      const windowEl = sheet.querySelector('#ch-window');
      const targetEl = sheet.querySelector('#ch-target');
      const filterExtra = sheet.querySelector('#filter-extra');
      // A title rule keeps the book names rather than only database ids,
      // so the challenge continues to recognise a book added later.
      const selectedTitles = new Map(((c.filter?.type === 'title' ? c.filter.titles : []) || [])
        .filter(Boolean).map((title) => [title.trim().toLocaleLowerCase(), title.trim()]));
      const titleKey = (title) => String(title || '').trim().toLocaleLowerCase();

      const windowExtra = sheet.querySelector('#window-extra');
      const targetNote = sheet.querySelector('#target-note');
      const bookmarkNote = sheet.querySelector('#bookmark-note');
      const removeButton = sheet.querySelector('#ch-remove');
      const coverButton = sheet.querySelector('#ch-edit-cover');
      if (coverButton) coverButton.onclick = () => {
        // The cover picker is a nested panel. Reopening the parent rebuilds
        // its form, so retain any unsaved text and selector edits.
        const snapshot = {};
        sheet.querySelectorAll('#ch-form input, #ch-form select, #ch-form textarea')
          .forEach((input) => { if (input.id) snapshot[input.id] = input.value; });
        pendingChallengeForm = { id: c.id, values: snapshot,
          selectedTitles: [...selectedTitles.values()] };
        openChallengeCoverEditor(c, document.getElementById('app'));
      };

      if (removeButton) removeButton.addEventListener('click', async () => {
        const yes = await confirmSheet({title:`Remove “${c.name}”?`,body:'Bookmarks already collected from this challenge stay in your archive.',confirm:'Remove',danger:true});
        if (!yes) return;
        try { await archiveChallenge(c.id); close(); toast('Challenge removed.'); navigate('/challenges'); }
        catch (_) { toast('Could not remove the challenge.','bad'); }
      });

      function paintFilterExtra() {
        const t = filterEl.value;
        if (t === 'author') {
          const authors = (c.filter && c.filter.authors) || [];
          filterExtra.innerHTML = `
            <label for="ch-authors">Authors — one per line</label>
            <textarea id="ch-authors" rows="5" placeholder="Joan Didion&#10;Janet Malcolm">${esc(authors.join('\n'))}</textarea>
            <p class="hint">A book counts if any of these wrote it. “Didion, Joan” and “Joan Didion” both match.</p>`;
        } else if (t === 'title') {
          // Search and selection remain in this compact form; no second sheet
          // and no need to navigate away to the Library.
          filterExtra.innerHTML = `
            <label for="ch-title-search">Find a book (Library or Open Library)</label>
            <input type="search" id="ch-title-search" placeholder="Search title or author…" autocomplete="off">
            <div id="ch-title-results" class="ch-title-results" role="group" aria-label="Your Library book titles"></div>
            <div id="ch-openlibrary-status" class="hint" aria-live="polite"></div>
            <div id="ch-openlibrary-results" class="ch-title-results" role="group" aria-label="Curated Open Library results" hidden></div>
            <div class="ch-title-picked" id="ch-title-picked" aria-live="polite"></div>
            <label for="ch-title-manual">Or add a book title not in your Library yet</label>
            <div class="ch-title-manual">
              <input type="text" id="ch-title-manual" placeholder="Enter book title" autocomplete="off">
              <button type="button" id="ch-title-add" class="btn">Add</button>
            </div>
            <p class="hint">A finished book counts when its title matches one of these. The reading dates and target still apply.</p>`;
          const library = [...state.books].filter((book) => book.title).sort((a,b) =>
            a.title.localeCompare(b.title) || String(a.author || '').localeCompare(String(b.author || '')));
          const query = filterExtra.querySelector('#ch-title-search');
          const results = filterExtra.querySelector('#ch-title-results');
          const picked = filterExtra.querySelector('#ch-title-picked');
          const paintTitles = () => {
            picked.innerHTML = selectedTitles.size
              ? `<p class="ch-title-count">${selectedTitles.size} selected</p>` +
                [...selectedTitles.values()].map((title) => `<button type="button" class="ch-title-chip" data-remove-title="${attr(title)}" title="Remove this title">${esc(title)} <span aria-hidden="true">×</span></button>`).join('')
              : '<p class="hint">No titles selected yet.</p>';
            picked.querySelectorAll('[data-remove-title]').forEach((button) => {
              button.onclick = () => { selectedTitles.delete(titleKey(button.dataset.removeTitle)); paintTitles(); };
            });
            const search = query.value.trim().toLowerCase();
            const matches = library.filter((book) => `${book.title} ${book.author || ''}`.toLowerCase().includes(search));
            const unique = [...new Map(matches.map((book) => [titleKey(book.title), book])).values()];
            results.innerHTML = unique.length
              ? unique.slice(0, 40).map((book) => {
                const pickedAlready = selectedTitles.has(titleKey(book.title));
                return `<button type="button" class="ch-title-result${pickedAlready ? ' is-selected' : ''}" data-add-title="${attr(book.title)}" aria-pressed="${pickedAlready}">
                  <span class="ch-title-result-name">${esc(book.title)}<small>${esc(book.author || '')}</small></span>
                  <span class="ch-title-result-mark">${pickedAlready ? '✓' : '+'}</span>
                </button>`;
              }).join('') + (unique.length > 40 ? '<p class="hint">Keep typing to narrow your results.</p>' : '')
              : `<p class="hint">${library.length ? 'No matching books. You can add a title below.' : 'Your Library is empty. Add a title below to start.'}</p>`;
            results.querySelectorAll('[data-add-title]').forEach((button) => {
              button.onclick = () => {
                const title = button.dataset.addTitle;
                const key = titleKey(title);
                if (selectedTitles.has(key)) selectedTitles.delete(key);
                else selectedTitles.set(key, title.trim());
                paintTitles();
              };
            });
          };
          // Search the same curated, English-first Open Library catalogue used
          // by Add a Book. Selecting a result adds a title to the challenge
          // rule, not a new Library record or a second editing dialog.
          const olStatus = filterExtra.querySelector('#ch-openlibrary-status');
          const olResults = filterExtra.querySelector('#ch-openlibrary-results');
          let olController = null;
          let olSequence = 0;
          const updateRemoteMarks = () => {
            olResults.querySelectorAll('[data-ol-title]').forEach((button) => {
              const chosen = selectedTitles.has(titleKey(button.dataset.olTitle));
              button.classList.toggle('is-selected', chosen);
              button.setAttribute('aria-pressed', String(chosen));
              button.querySelector('.ch-title-result-mark').textContent = chosen ? '✓' : '+';
            });
          };
          const findRemote = debounce(async (term) => {
            if (olController) olController.abort();
            olController = new AbortController();
            const requestId = ++olSequence;
            olStatus.textContent = 'Searching Open Library…';
            olResults.hidden = true;
            try {
              const matches = await searchBooks(term, { signal: olController.signal, limit: 25, language: 'en' });
              if (requestId !== olSequence || !query.isConnected || query.value.trim() !== term) return;
              const seen = new Set();
              const curated = matches.filter((book) => {
                const key = titleKey(book.title);
                if (!key || seen.has(key)) return false;
                seen.add(key);
                return true;
              }).slice(0, 10);
              olStatus.textContent = curated.length ? 'OPEN LIBRARY · Closest matches first' : 'No Open Library matches. Try fewer words or enter the title below.';
              olResults.hidden = !curated.length;
              olResults.innerHTML = curated.map((book) => `<button type="button" class="ch-title-result" data-ol-title="${attr(book.title)}" aria-pressed="false">
                ${book.coverUrl ? `<img class="ch-title-cover" src="${attr(book.coverUrl)}" alt="" loading="lazy">` : ''}
                <span class="ch-title-result-name">${esc(book.title)}<small>${esc(book.author || 'Author unknown')}${book.firstPublishYear ? ` · ${esc(book.firstPublishYear)}` : ''}</small></span>
                <span class="ch-title-result-mark">+</span>
              </button>`).join('');
              olResults.querySelectorAll('[data-ol-title]').forEach((button) => {
                button.onclick = () => {
                  const title = button.dataset.olTitle;
                  const key = titleKey(title);
                  if (selectedTitles.has(key)) selectedTitles.delete(key);
                  else selectedTitles.set(key, title.trim());
                  paintTitles();
                  updateRemoteMarks();
                };
              });
              updateRemoteMarks();
            } catch (err) {
              if (err?.name === 'AbortError' || requestId !== olSequence || !query.isConnected) return;
              olResults.hidden = true;
              olStatus.textContent = 'Open Library is unavailable. You can still choose a Library book or enter a title.';
            }
          }, 350);
          query.addEventListener('input', () => {
            paintTitles();
            if (olController) olController.abort();
            olSequence++;
            const term = query.value.trim();
            if (term.length < 2) {
              findRemote.cancel();
              olStatus.textContent = '';
              olResults.hidden = true;
              olResults.innerHTML = '';
            } else findRemote(term);
          });
          const manual = filterExtra.querySelector('#ch-title-manual');
          const addTitle = () => {
            const value = manual.value.trim();
            if (!value) return;
            selectedTitles.set(titleKey(value), value);
            manual.value = '';
            paintTitles();
          };
          filterExtra.querySelector('#ch-title-add').onclick = addTitle;
          manual.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addTitle(); } });
          paintTitles();
        } else if (t === 'publishedBefore') {
          filterExtra.innerHTML = `
            <label for="ch-publication-year">Published before the year</label>
            <input type="number" id="ch-publication-year" min="1" max="2100"
              step="1" inputmode="numeric" placeholder="e.g. 2000"
              value="${attr(c.filter?.type === 'publishedBefore' ? c.filter.year ?? '' : '')}">
            <p class="hint">Uses each book’s <em>First published</em> year in your Library. A book published in the selected year does not qualify; books without a publication year will not match automatically.</p>`;
        } else if (t === 'series') {
          const known = knownSeries();
          filterExtra.innerHTML = `
            <label for="ch-series">Series</label>
            <input id="ch-series" type="text" list="ch-series-list" value="${attr((c.filter && c.filter.series) || '')}">
            <datalist id="ch-series-list">${known.map((s) => `<option value="${attr(s)}"></option>`).join('')}</datalist>`;
        } else if (t === 'tag') {
          const known = knownTags();
          filterExtra.innerHTML = `
            <label for="ch-tag">Tag</label>
            <input id="ch-tag" type="text" list="ch-tag-list" value="${attr((c.filter && c.filter.tag) || '')}">
            <datalist id="ch-tag-list">${known.map((s) => `<option value="${attr(s)}"></option>`).join('')}</datalist>
            <p class="hint">Tag books in the book form, then count them here.</p>`;
        } else {
          filterExtra.innerHTML = '';
        }
      }

      function paintWindowExtra() {
        const t = windowEl.value;
        if (t === 'quarter') {
          const cur = (c.window && c.window.quarter) || 1;
          windowExtra.innerHTML = `
            <label for="ch-quarter">Quarter</label>
            <select id="ch-quarter">${quarters(YEAR).map((q, i) =>
              `<option value="${i + 1}" ${i + 1 === Number(cur) ? 'selected' : ''}>${esc(q.label)}</option>`).join('')}</select>`;
        } else if (t === 'range') {
          windowExtra.innerHTML = `
            <div class="grid-2">
              <div><label for="ch-start">From</label><input id="ch-start" type="date" value="${attr((c.window && c.window.start) || `${YEAR}-01-01`)}"></div>
              <div><label for="ch-end">To</label><input id="ch-end" type="date" value="${attr((c.window && c.window.end) || `${YEAR}-12-31`)}"></div>
            </div>`;
        } else if (t === 'recurring') {
          const cur = (c.window && c.window.periods) || 'quarters';
          windowExtra.innerHTML = `
            <label for="ch-periods">Repeat every</label>
            <select id="ch-periods">
              <option value="quarters" ${cur === 'quarters' ? 'selected' : ''}>Quarter (4 periods)</option>
              <option value="bimonths" ${cur === 'bimonths' ? 'selected' : ''}>Two months (6 periods)</option>
            </select>
            <p class="hint">One bookmark per completed period, plus a bonus when all of them are done.</p>`;
        } else {
          windowExtra.innerHTML = '';
        }
        paintNotes();
      }

      function paintNotes() {
        const recurring = windowEl.value === 'recurring';
        targetNote.textContent = recurring ? '(books needed in each period)' : '(books needed in total)';
        const n = Number(targetEl.value);
        const id = c.id || slug(nameEl.value || 'challenge');
        if (recurring) {
          const count = (windowExtra.querySelector('#ch-periods') || {}).value === 'bimonths' ? 6 : 4;
          bookmarkNote.textContent = `Unlocks ${count} bookmarks, one per period, plus 1 bonus.`;
        } else if (Number.isFinite(n) && n > 0) {
          const prefix = c.bookmarkPrefix || id;
          bookmarkNote.textContent = `Unlocks ${n} bookmark${n === 1 ? '' : 's'}: ${prefix}-1 … ${prefix}-${n}.`;
        } else {
          bookmarkNote.textContent = 'Set a target to decide how many bookmarks this unlocks.';
        }
      }

      filterEl.addEventListener('change', () => { paintFilterExtra(); paintNotes(); });
      windowEl.addEventListener('change', paintWindowExtra);
      targetEl.addEventListener('input', paintNotes);
      windowExtra.addEventListener('change', paintNotes);
      nameEl.addEventListener('input', paintNotes);
      paintFilterExtra();
      paintWindowExtra();
      if (pendingChallengeForm?.id === c.id) {
        const saved = pendingChallengeForm.values;
        const titleDraft = pendingChallengeForm.selectedTitles;
        pendingChallengeForm = null;
        if (Array.isArray(titleDraft)) {
          selectedTitles.clear();
          titleDraft.forEach((title) => { if (title?.trim()) selectedTitles.set(titleKey(title), title.trim()); });
        }
        for (const [id, value] of Object.entries(saved)) {
          const input = sheet.querySelector('#' + CSS.escape(id));
          if (!input) continue;
          if (input.value !== value) {
            input.value = value;
            if (id === 'ch-filter') paintFilterExtra();
            if (id === 'ch-window') paintWindowExtra();
          }
        }
        if (filterEl.value === 'title') paintFilterExtra();
        paintNotes();
      }

      sheet.querySelector('#ch-form').onsubmit = async (e) => {
        e.preventDefault();
        const name = nameEl.value.trim();
        if (!name) { toast('Give the challenge a name.', 'bad'); return; }

        const target = Number(targetEl.value);
        if (!Number.isFinite(target) || target < 1) {
          toast('Set a target of at least 1 book.', 'bad');
          targetEl.focus();
          return;
        }

        // Build the filter
        let filter = { type: filterEl.value };
        if (filter.type === 'author') {
          const authors = (sheet.querySelector('#ch-authors').value || '')
            .split('\n').map((s) => s.trim()).filter(Boolean);
          if (!authors.length) { toast('Add at least one author.', 'bad'); return; }
          filter.authors = authors;
        } else if (filter.type === 'title') {
          filter.titles = [...selectedTitles.values()];
          if (!filter.titles.length) {
            toast('Select or add at least one book title.', 'bad');
            return;
          }
        } else if (filter.type === 'publishedBefore') {
          const rawYear = sheet.querySelector('#ch-publication-year')?.value.trim() || '';
          const year = Number(rawYear);
          if (!rawYear || !Number.isInteger(year) || year < 1 || year > 2100) {
            toast('Enter a valid publication cutoff year (1–2100).', 'bad');
            sheet.querySelector('#ch-publication-year')?.focus();
            return;
          }
          filter.year = year;
        } else if (filter.type === 'series') {
          const v = sheet.querySelector('#ch-series').value.trim();
          if (!v) { toast('Name the series.', 'bad'); return; }
          filter.series = v;
        } else if (filter.type === 'tag') {
          const v = sheet.querySelector('#ch-tag').value.trim();
          if (!v) { toast('Name the tag.', 'bad'); return; }
          filter.tag = v;
        }

        // Build the window
        let win = { type: windowEl.value, year: YEAR };
        if (win.type === 'quarter') {
          win.quarter = Number(sheet.querySelector('#ch-quarter').value) || 1;
        } else if (win.type === 'range') {
          win.start = sheet.querySelector('#ch-start').value;
          win.end = sheet.querySelector('#ch-end').value;
          if (!win.start || !win.end || win.start > win.end) {
            toast('Check the date range.', 'bad');
            return;
          }
        } else if (win.type === 'recurring') {
          win.periods = sheet.querySelector('#ch-periods').value;
        }

        // All challenges are editable. Keep the original stable id and any
        // existing bookmark identifiers so previously earned artwork survives.
        const record = {
          id: c.id || `${slug(name)}-${uid('c').split('_')[1]}`,
          name,
          custom: creating || !!c.custom,
          filter,
          window: win,
          target,
          bookmarkPrefix: c.bookmarkPrefix || c.id || null,
        };
        if (!record.bookmarkPrefix) record.bookmarkPrefix = record.id;
        // Existing recurring challenges retain their awarded bookmark ids.
        // When changing repeat frequency, new periods receive new ids.
        if (win.type === 'recurring') {
          if (c.bonusBookmark) record.bonusBookmark = c.bonusBookmark;
          else record.bonusBookmark = `${record.bookmarkPrefix}-all`;
        } else {
          // The evaluator ignores a bonus on non-recurring challenges.
          // Clear it in the editable record so future switching is predictable.
          record.bonusBookmark = null;
        }

        try {
          const { unlocked } = await saveChallenge(record);
          close();
          toast(unlocked.length
            ? `Saved — ${unlocked.length} bookmark${unlocked.length === 1 ? '' : 's'} unlocked.`
            : 'Challenge saved.', 'good');
          navigate(`/challenge/${encodeURIComponent(record.id)}`);
        } catch (_) {
          toast('Could not save that challenge.', 'bad');
        }
      };
    },
  });
}
