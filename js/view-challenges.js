// Challenges list, challenge detail (period-by-period), and the editor used
// both for the author-list preset and for your own challenges.

import {
  state, allChallenges, getChallenge, saveChallenge, archiveChallenge,
  unlockMap, knownTags, knownSeries, uid,
} from './state.js';
import {
  esc, attr, toast, progressBar, markVisual,
  openSheet, navigate, confirmSheet, coverImg,
} from './ui.js';
import { evaluate, describeFilter, describeWindow, bookmarkLabels } from './rules.js';
import { formatDate, quarters, YEAR } from './periods.js';
import { FILTER_TYPES, WINDOW_TYPES } from './config.js';

/* ----------------------------------------------------------------- list ---- */

// "Q1" stays "Q1"; "jan-feb" becomes "J–F" so it fits the pill.
function shortPeriodLabel(key) {
  const k = String(key);
  if (k.length <= 2) return k.toUpperCase();
  return k.split('-').map((part) => (part[0] || '').toUpperCase()).join('–');
}

const BOOKMARK_GLYPH = `<svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true"
  style="vertical-align:-1px"><path d="M7 3h10v18l-5-4-5 4z" fill="none" stroke="currentColor"
  stroke-width="2.2" stroke-linejoin="round"/></svg>`;

function challengeCard(challenge) {
  const r = evaluate(challenge, state.books);
  const have = unlockMap();
  const earnedCount = r.allBookmarkIds.filter((id) => have.has(id)).length;

  const body = r.recurring
    ? `<div class="pills" style="margin-top:.6rem">
         ${r.periods.map((p) => `<span class="pill${p.complete ? ' done' : ''}" title="${attr(p.label)}">
            ${esc(shortPeriodLabel(p.key))}</span>`).join('')}
         ${challenge.bonusBookmark ? `<span class="pill${r.bonus && r.bonus.complete ? ' done' : ''}" title="Bonus">★</span>` : ''}
       </div>`
    : (r.targetUnset
      ? `<p class="small" style="margin:.5rem 0 0"><b>${r.count}</b> matching so far · <span class="muted">target not set yet</span></p>`
      : `${progressBar(r.pct, { done: r.complete })}
         <div class="goal-sub"><span>${r.count} of ${r.target} books</span><span>${r.pct}%</span></div>`);

  const marks = r.allBookmarkIds.length
    ? `${earnedCount}/${r.allBookmarkIds.length} ${BOOKMARK_GLYPH}`
    : '<span class="tiny">no bookmarks yet</span>';

  return `<a class="card card-link" href="#/challenge/${encodeURIComponent(challenge.id)}">
    <div class="row-between">
      <strong class="grow">${esc(challenge.name)}</strong>
      <span class="muted small nowrap">${marks}</span>
    </div>
    <div class="small muted">${esc(describeFilter(challenge.filter))} · ${esc(describeWindow(challenge.window))}</div>
    ${body}
  </a>`;
}

export function challengesView() {
  const list = allChallenges();
  return {
    title: 'Challenges',
    tab: 'challenges',
    html: `
      ${list.length ? list.map(challengeCard).join('') : '<div class="empty"><h3>No challenges</h3></div>'}
      <button class="btn btn-block" type="button" id="new-challenge" style="margin-top:.4rem">
        New challenge
      </button>
      <p class="hint center" style="margin-top:.6rem">
        Challenges are plain config — the four presets live in <code>js/config.js</code>.
      </p>
    `,
    onMount(root) {
      root.querySelector('#new-challenge').onclick = () => openEditor(null);
    },
  };
}

/* --------------------------------------------------------------- detail ---- */

function periodDetail(p, challenge, have) {
  const unlocked = !!(p.bookmarkId && have.has(p.bookmarkId));
  const photo = p.bookmarkId ? state.images.get(p.bookmarkId) : null;
  const art = p.bookmarkId
    ? markVisual(p.bookmarkId, { unlocked, dataUrl: photo ? photo.dataUrl : null })
    : '';

  const books = p.books.length
    ? `<div style="margin-top:.4rem">${p.books.map((b) => `
        <a class="row small" href="#/book/${encodeURIComponent(b.id)}" style="color:inherit;text-decoration:none;padding:.15rem 0">
          <span class="grow truncate">${esc(b.title)}</span>
          <span class="muted nowrap">${esc(formatDate(b.dateFinished))}</span>
        </a>`).join('')}</div>`
    : '<div class="small muted" style="margin-top:.3rem">Nothing logged yet.</div>';

  return `<div class="check-row${p.complete ? ' done' : ''}" style="align-items:flex-start">
    <span class="check-mark" aria-hidden="true">${p.complete ? '✓' : ''}</span>
    <span class="check-body">
      <span class="row-between">
        <span class="check-title">${esc(p.label)}</span>
        <span class="tiny muted nowrap">${p.count} of ${p.target == null ? '—' : p.target}</span>
      </span>
      ${books}
      ${p.bookmarkId ? `<span class="tiny muted" style="display:block;margin-top:.35rem">
         Bookmark <code>${esc(p.bookmarkId)}</code>${unlocked ? ' · collected' : ' · locked'}</span>` : ''}
    </span>
    ${art ? `<span style="width:30px;flex:none">${art}</span>` : ''}
  </div>`;
}

export function challengeDetailView(params) {
  const challenge = getChallenge(params.id);
  if (!challenge) {
    return {
      title: 'Challenge not found',
      tab: 'challenges',
      back: true,
      html: `<div class="empty"><h3>No such challenge</h3>
        <a class="btn btn-primary" href="#/challenges">All challenges</a></div>`,
    };
  }

  const r = evaluate(challenge, state.books);
  const have = unlockMap();
  const labels = bookmarkLabels(challenge);
  const canEdit = challenge.editable || challenge.custom;

  const header = `<section class="card">
    <div class="goal-head">
      <span class="goal-label">${esc(describeWindow(challenge.window))}</span>
      ${r.targetUnset ? '' : `<span class="goal-pct${r.pct > 100 ? ' over' : ''}">${r.pct}%</span>`}
    </div>
    <div class="goal-main">${r.recurring
      ? `<b>${r.count}</b> of ${r.target} periods complete`
      : (r.targetUnset ? `<b>${r.count}</b> books matching` : `<b>${r.count}</b> of ${r.target} books`)}</div>
    ${r.targetUnset ? '' : progressBar(r.pct, { done: r.complete })}
    <div class="goal-sub">
      <span>${esc(describeFilter(challenge.filter))}</span>
      <span>${r.allBookmarkIds.filter((id) => have.has(id)).length} of ${r.allBookmarkIds.length || 0} bookmarks</span>
    </div>
    ${challenge.blurb ? `<p class="small muted" style="margin:.7rem 0 0">${esc(challenge.blurb)}</p>` : ''}
  </section>`;

  const unsetNotice = r.targetUnset
    ? `<div class="notice">
         <strong>Set a target to start unlocking bookmarks.</strong>
         <p style="margin:.3rem 0 .6rem">This challenge has no target count yet, so nothing can be earned from it.
         Pick how many books you want, and add the authors you count as kindred.</p>
         <button class="btn btn-sm btn-primary" type="button" id="edit-challenge">Set target &amp; authors</button>
       </div>`
    : '';

  const periodsBlock = r.recurring
    ? `<h2 class="section-title">Each period</h2>
       <section class="card"><div class="ch-periods">
         ${r.periods.map((p) => periodDetail(p, challenge, have)).join('')}
         ${challenge.bonusBookmark ? `<div class="check-row${r.bonus.complete ? ' done' : ''}" style="align-items:flex-start">
            <span class="check-mark" aria-hidden="true">${r.bonus.complete ? '✓' : ''}</span>
            <span class="check-body">
              <span class="check-title">Bonus — every period complete</span>
              <span class="check-note">Bookmark <code>${esc(challenge.bonusBookmark)}</code>${have.has(challenge.bonusBookmark) ? ' · collected' : ' · locked'}</span>
            </span>
            <span style="width:30px;flex:none">${markVisual(challenge.bonusBookmark, {
              unlocked: have.has(challenge.bonusBookmark),
              bonus: true,
              dataUrl: (state.images.get(challenge.bonusBookmark) || {}).dataUrl || null,
            })}</span>
          </div>` : ''}
       </div></section>`
    : `<h2 class="section-title">Books counted</h2>
       <section class="card">
         ${r.books.length ? r.books.map((b) => `
           <article class="book-row">
             <a href="#/book/${encodeURIComponent(b.id)}" style="flex:none">${coverImg(b)}</a>
             <a class="grow" href="#/book/${encodeURIComponent(b.id)}" style="color:inherit;text-decoration:none">
               <div class="book-title">${esc(b.title)}</div>
               <div class="book-meta">${esc(b.author || '')}</div>
               <div class="book-meta">Finished ${esc(formatDate(b.dateFinished))}</div>
             </a>
           </article>`).join('')
          : '<p class="muted small" style="margin:0">No books match this challenge yet.</p>'}
       </section>`;

  const bookmarksBlock = r.allBookmarkIds.length
    ? `<h2 class="section-title">Bookmarks from this challenge</h2>
       <div class="bm-grid">
         ${r.allBookmarkIds.map((id) => {
           const meta = labels.get(id);
           const unlocked = have.has(id);
           const img = state.images.get(id);
           return `<a class="bm${unlocked ? '' : ' locked'}" href="#/bookmarks?focus=${encodeURIComponent(id)}">
             ${markVisual(id, {
               unlocked,
               bonus: !!(meta && meta.bonus),
               dataUrl: img ? img.dataUrl : null,
             })}
             <div class="bm-name">${esc(meta ? meta.title : id)}</div>
             <div class="bm-sub">${esc(id)}</div>
           </a>`;
         }).join('')}
       </div>`
    : '';

  return {
    title: challenge.name,
    tab: 'challenges',
    back: true,
    actions: canEdit ? '<button class="btn btn-ghost" type="button" id="edit-top">Edit</button>' : '',
    html: `
      ${unsetNotice}
      ${header}
      ${periodsBlock}
      ${bookmarksBlock}
      ${challenge.custom ? `<div class="btn-row" style="margin-top:1rem">
        <button class="btn btn-danger btn-block" type="button" id="archive">Remove this challenge</button>
      </div>` : ''}
    `,
    onMount(root) {
      const open = () => openEditor(challenge);
      const top = document.getElementById('edit-top');
      if (top) top.onclick = open;
      const inline = root.querySelector('#edit-challenge');
      if (inline) inline.onclick = open;

      const archive = root.querySelector('#archive');
      if (archive) {
        archive.onclick = async () => {
          const yes = await confirmSheet({
            title: `Remove “${challenge.name}”?`,
            body: 'Bookmarks you already collected from it stay in your collection.',
            confirm: 'Remove',
            danger: true,
          });
          if (!yes) return;
          try {
            await archiveChallenge(challenge.id);
            toast('Challenge removed.');
            navigate('/challenges');
          } catch (_) {
            toast('Could not save that change.', 'bad');
          }
        };
      }
    },
  };
}

/* --------------------------------------------------------------- editor ---- */

function slug(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'challenge';
}

export function openEditor(challenge) {
  const creating = !challenge;
  const presetLocked = !!(challenge && challenge.preset); // keep preset shape intact
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
        <select id="ch-filter" ${presetLocked && filterType !== 'author' ? 'disabled' : ''}>
          ${FILTER_TYPES.map((f) => `<option value="${attr(f.value)}" ${f.value === filterType ? 'selected' : ''}>${esc(f.label)}</option>`).join('')}
        </select>
        ${presetLocked && filterType !== 'author' ? '<p class="hint">Fixed by the preset.</p>' : ''}
      </div>

      <div class="field" id="filter-extra"></div>

      <div class="field">
        <label for="ch-window">Time window</label>
        <select id="ch-window" ${presetLocked ? 'disabled' : ''}>
          ${WINDOW_TYPES.map((w) => `<option value="${attr(w.value)}" ${w.value === windowType ? 'selected' : ''}>${esc(w.label)}</option>`).join('')}
        </select>
        ${presetLocked ? '<p class="hint">Fixed by the preset.</p>' : ''}
      </div>

      <div class="field" id="window-extra"></div>

      <div class="field">
        <label for="ch-target">Target <span class="muted" id="target-note"></span></label>
        <input id="ch-target" type="number" inputmode="numeric" min="1" max="999"
               value="${c.target == null ? '' : attr(c.target)}" placeholder="e.g. 3">
        <p class="hint" id="bookmark-note"></p>
      </div>

      <div class="btn-row" style="margin-top:.3rem">
        <button class="btn grow" type="button" data-close>Cancel</button>
        <button class="btn btn-primary grow" type="submit">${creating ? 'Create' : 'Save'}</button>
      </div>
    </form>
  `, {
    onMount(sheet, close) {
      const nameEl = sheet.querySelector('#ch-name');
      const filterEl = sheet.querySelector('#ch-filter');
      const windowEl = sheet.querySelector('#ch-window');
      const targetEl = sheet.querySelector('#ch-target');
      const filterExtra = sheet.querySelector('#filter-extra');
      const windowExtra = sheet.querySelector('#window-extra');
      const targetNote = sheet.querySelector('#target-note');
      const bookmarkNote = sheet.querySelector('#bookmark-note');

      function paintFilterExtra() {
        const t = filterEl.value;
        if (t === 'author') {
          const authors = (c.filter && c.filter.authors) || [];
          filterExtra.innerHTML = `
            <label for="ch-authors">Authors — one per line</label>
            <textarea id="ch-authors" rows="5" placeholder="Joan Didion&#10;Janet Malcolm">${esc(authors.join('\n'))}</textarea>
            <p class="hint">A book counts if any of these wrote it. “Didion, Joan” and “Joan Didion” both match.</p>`;
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

        // A preset keeps its own window and bookmark ids — only the parts the
        // preset marked editable are stored as an override.
        let record;
        if (presetLocked) {
          record = { id: c.id, name, target, filter };
        } else {
          record = {
            id: c.id || `${slug(name)}-${uid('c').split('_')[1]}`,
            name,
            custom: true,
            filter,
            window: win,
            target,
          };
          record.bookmarkPrefix = c.bookmarkPrefix || record.id;
          if (win.type === 'recurring') record.bonusBookmark = `${record.bookmarkPrefix}-all`;
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
