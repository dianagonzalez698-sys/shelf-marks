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
import { renderSections, renderSection } from './sections.js';
import { figure, backdrop, media } from './media.js';
import * as layout from './layout.js';

/* ----------------------------------------------------------------- list ---- */

export const DIRECTORY_PAGE_ID = 'directory';

export function challengesView() {
  const sections = layout.get(DIRECTORY_PAGE_ID);
  return {
    title: t('challengesHeading'),
    tab: 'challenges',
    banner: false,
    editorial: true,
    html: `
      ${renderSections(sections)}
      <div class="ed sp-tight">
        <div class="btn-row" style="justify-content:center">
          <button class="btn" type="button" id="new-challenge">Begin a new challenge</button>
        </div>
        <p class="hint center" style="margin-top:1rem">
          Challenges are plain configuration — the presets live in <code>js/config.js</code>.
        </p>
      </div>
    `,
    onMount(root) {
      const btn = root.querySelector('#new-challenge');
      if (btn) btn.onclick = () => openEditor(null);
    },
  };
}

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
  const canEdit = challenge.editable || challenge.custom;

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
    back: true,
    actions: canEdit ? '<button class="btn btn-quiet" type="button" id="edit-top">Edit</button>' : '',
    html: `
      ${spread}
      ${unsetNotice}
      ${challenge.custom ? `<div class="ed sp-tight"><div class="btn-row">
        <button class="btn btn-danger" type="button" id="archive">Remove this challenge</button>
      </div></div>` : ''}
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
