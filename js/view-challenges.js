// Challenges: the index, and the challenge spread — the reference layout, with
// the bookmark collection as its centrepiece.

import {
  state, allChallenges, getChallenge, saveChallenge, archiveChallenge,
  unlockMap, knownTags, knownSeries, uid,
} from './state.js';
import {
  esc, attr, toast, progressBar, progressLine, markVisual, checkBadge, checkGlyph,
  openSheet, navigate, confirmSheet, coverImg,
} from './ui.js';
import { evaluate, describeFilter, describeWindow, bookmarkLabels } from './rules.js';
import { formatDate, quarters, YEAR } from './periods.js';
import { FILTER_TYPES, WINDOW_TYPES } from './config.js';
import { t } from './theme.js';

/* ----------------------------------------------------------------- list ---- */

function challengeRow(challenge) {
  const r = evaluate(challenge, state.books);
  const have = unlockMap();
  const labels = bookmarkLabels(challenge);
  const ids = [...labels.keys()];
  const earned = ids.filter((id) => have.has(id)).length;

  // A miniature run of this challenge's bookmarks, as a row ornament.
  const strip = ids.slice(0, 7).map((id) => markVisual(id, {
    unlocked: have.has(id),
    bonus: !!(labels.get(id) || {}).bonus,
    dataUrl: (state.images.get(id) || {}).dataUrl || null,
  })).join('');

  const standing = r.recurring
    ? `${r.count} of ${r.target} periods complete`
    : (r.targetUnset
      ? `${r.count} matching so far · no target set`
      : `${r.count} of ${r.target} books`);

  return `<a class="list-row list-row-link" href="#/challenge/${encodeURIComponent(challenge.id)}">
    <span class="grow">
      <span class="entry-title">${esc(challenge.name)}</span>
      <span class="entry-meta">${esc(describeFilter(challenge.filter))} · ${esc(describeWindow(challenge.window))}</span>
      <span class="tags">
        <span class="tag">${esc(standing)}</span>
        <span class="tag tag-accent">${ids.length ? `${earned}/${ids.length} bookmarks` : 'no bookmarks yet'}</span>
      </span>
      ${ids.length ? `<span class="bm-strip" style="margin-top:.8rem;max-width:320px">${strip}</span>` : ''}
    </span>
  </a>`;
}

export function challengesView() {
  const list = allChallenges();
  return {
    title: t('challengesHeading'),
    tab: 'challenges',
    banner: true,
    html: `
      <section class="section">
        <div class="section-head">
          <div>
            <h2 class="section-title">${esc(t('challengesHeading'))}</h2>
            <p class="section-sub">${esc(t('challengesSub'))}</p>
          </div>
          <button class="btn btn-sm" type="button" id="new-challenge">New challenge</button>
        </div>

        <div class="list" style="margin-top:1.5rem">
          ${list.length ? list.map(challengeRow).join('')
            : '<div class="empty"><h3>No challenges yet</h3><p>Start one and its bookmarks appear here.</p></div>'}
        </div>

        <p class="hint center" style="margin-top:1.4rem">
          Challenges are plain configuration — the presets live in <code>js/config.js</code>.
        </p>
      </section>
    `,
    onMount(root) {
      root.querySelector('#new-challenge').onclick = () => openEditor(null);
    },
  };
}

/* --------------------------------------------------------------- detail ---- */

// The bookmark collection, exactly as the reference presents it: the object,
// a check if it's yours, then its title underneath.
function bookmarkCollection(challenge, result, have) {
  const labels = bookmarkLabels(challenge);
  const ids = result.allBookmarkIds;
  if (!ids.length) return '';

  return `<div class="bm-grid">
    ${ids.map((id) => {
      const meta = labels.get(id);
      const unlocked = have.has(id);
      const img = state.images.get(id);
      return `<a class="bm${unlocked ? '' : ' locked'}" href="#/bookmarks?focus=${encodeURIComponent(id)}">
        ${markVisual(id, { unlocked, bonus: !!(meta && meta.bonus), dataUrl: img ? img.dataUrl : null })}
        ${unlocked ? checkBadge() : ''}
        <span class="bm-label">${esc(meta ? meta.title : id)}</span>
        ${meta && meta.bonus ? '<span class="bm-sub">bonus</span>' : ''}
      </a>`;
    }).join('')}
  </div>`;
}

// The working detail under the collection: what each period still needs.
function periodDetail(p, have) {
  const unlocked = !!(p.bookmarkId && have.has(p.bookmarkId));
  const books = p.books.length
    ? `<span style="display:block;margin-top:.3rem">${p.books.map((b) => `
        <a class="row small" href="#/book/${encodeURIComponent(b.id)}" style="color:inherit;text-decoration:none;padding:.1rem 0">
          <span class="grow truncate">${esc(b.title)}</span>
          <span class="muted tiny nowrap">${esc(formatDate(b.dateFinished))}</span>
        </a>`).join('')}</span>`
    : '<span class="check-note">Nothing logged yet.</span>';

  return `<div class="check-row${p.complete ? ' done' : ''}">
    <span class="check-mark" aria-hidden="true">${checkGlyph()}</span>
    <span class="check-body">
      <span class="row-between">
        <span class="check-title">${esc(p.label)}</span>
        <span class="tag nowrap">${p.count} of ${p.target == null ? '—' : p.target}</span>
      </span>
      ${books}
      ${p.bookmarkId ? `<span class="check-note">${unlocked ? 'Bookmark collected' : 'Bookmark still locked'} · <code>${esc(p.bookmarkId)}</code></span>` : ''}
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
  const canEdit = challenge.editable || challenge.custom;
  const ids = r.allBookmarkIds;
  const earned = ids.filter((id) => have.has(id)).length;
  const collectedPct = ids.length ? Math.round((earned / ids.length) * 100) : 0;

  const unsetNotice = r.targetUnset
    ? `<div class="notice">
         <strong>This challenge has no target yet.</strong>
         Nothing can be collected until you say how many books it takes — and who counts.
         <div class="btn-row" style="margin-top:.8rem">
           <button class="btn btn-sm btn-primary" type="button" id="edit-challenge">Set target &amp; authors</button>
         </div>
       </div>`
    : '';

  const standing = r.recurring
    ? `${r.count} of ${r.target} periods complete`
    : (r.targetUnset ? `${r.count} books matching` : `${r.count} of ${r.target} books read`);

  const working = r.recurring
    ? `<section class="section section-rule">
         <div class="section-head"><h2 class="h2">Each period</h2></div>
         <div class="checklist" style="margin-top:.9rem">
           ${r.periods.map((p) => periodDetail(p, have)).join('')}
           ${challenge.bonusBookmark ? `<div class="check-row${r.bonus.complete ? ' done' : ''}">
              <span class="check-mark" aria-hidden="true">${checkGlyph()}</span>
              <span class="check-body">
                <span class="check-title">Bonus — every period complete</span>
                <span class="check-note">${have.has(challenge.bonusBookmark) ? 'Collected' : 'Locked'} · <code>${esc(challenge.bonusBookmark)}</code></span>
              </span>
            </div>` : ''}
         </div>
       </section>`
    : `<section class="section section-rule">
         <div class="section-head"><h2 class="h2">Books counted</h2></div>
         <div class="list" style="margin-top:.9rem">
           ${r.books.length ? r.books.map((b) => `
             <article class="list-row">
               <a class="list-row-link" href="#/book/${encodeURIComponent(b.id)}">
                 ${coverImg(b)}
                 <span class="grow">
                   <span class="entry-title">${esc(b.title)}</span>
                   <span class="entry-meta">${esc(b.author || '')}</span>
                   <span class="entry-meta">Finished ${esc(formatDate(b.dateFinished))}</span>
                 </span>
               </a>
             </article>`).join('')
            : '<p class="muted italic" style="padding:1rem 0">No books match this challenge yet.</p>'}
         </div>
       </section>`;

  return {
    title: challenge.name,
    tab: 'challenges',
    banner: true,
    back: true,
    actions: canEdit ? '<button class="btn btn-quiet" type="button" id="edit-top">Edit</button>' : '',
    html: `
      ${unsetNotice}
      <section class="section">
        <div class="section-head">
          <div>
            <h2 class="section-title">${esc(challenge.name)}</h2>
            ${challenge.blurb ? `<p class="section-sub">${esc(challenge.blurb)}</p>` : ''}
          </div>
          <p class="section-meta">${esc(describeWindow(challenge.window))}</p>
        </div>

        ${ids.length
          ? progressLine(`${earned} of ${ids.length} bookmarks collected`, collectedPct, { done: earned === ids.length })
          : `<p class="hint" style="margin-top:1rem">${esc(standing)}</p>`}

        ${bookmarkCollection(challenge, r, have)}

        <p class="center tiny muted italic" style="margin-top:1.4rem">
          ${esc(describeFilter(challenge.filter))} · ${esc(standing)}
        </p>
      </section>

      ${working}

      ${challenge.custom ? `<div class="btn-row" style="margin-top:var(--sp-section)">
        <button class="btn btn-danger" type="button" id="archive">Remove this challenge</button>
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
            body: 'Bookmarks you already collected from it stay in your archive.',
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
