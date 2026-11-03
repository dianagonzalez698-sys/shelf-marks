// Home: the Goodreads-style goal cards, this period's checklist, and the
// bookmark shelf teaser.

import {
  state, annualProgress, quarterProgress, nonfictionProgress,
  bookmarkStats, allChallenges, getChallenge,
} from './state.js';
import { esc, progressBar, markVisual, lockedArt, attr } from './ui.js';
import { evaluate } from './rules.js';
import { focusQuarter, focusBimonth, daysLeftLabel, todayISO, formatDate } from './periods.js';

function goalCard({ label, read, goal, pct, period }) {
  const over = pct > 100;
  return `<section class="card">
    <div class="goal-head">
      <span class="goal-label">${esc(label)}</span>
      <span class="goal-pct${over ? ' over' : ''}">${pct}%</span>
    </div>
    <div class="goal-main"><b>${read}</b> of ${goal} books read</div>
    ${progressBar(pct)}
    <div class="goal-sub">
      <span>${esc(daysLeftLabel(period))}</span>
      <span>${over ? `${read - goal} past goal` : `${Math.max(0, goal - read)} to go`}</span>
    </div>
  </section>`;
}

function nonfictionCard() {
  const nf = nonfictionProgress();
  const over = nf.pct > 100;
  const detail = nf.total === 0
    ? 'No books logged yet this year.'
    : `${nf.nonfiction} of ${nf.total} books · goal ${nf.targetPct}%`;
  const right = nf.total === 0
    ? ''
    : (nf.onTrack
      ? 'on track'
      : `${nf.needed} more nonfiction to catch up`);
  return `<section class="card">
    <div class="goal-head">
      <span class="goal-label">Nonfiction</span>
      <span class="goal-pct${over ? ' over' : ''}">${nf.actualPct}%</span>
    </div>
    <div class="goal-main"><b>${nf.actualPct}%</b> of what I read</div>
    ${progressBar(nf.pct, { done: nf.onTrack && nf.total > 0 })}
    <div class="goal-sub">
      <span>${esc(detail)}</span>
      <span>${esc(right)}</span>
    </div>
  </section>`;
}

function checkRow(done, title, note, href) {
  return `<a class="check-row${done ? ' done' : ''}" href="${attr(href)}">
    <span class="check-mark" aria-hidden="true">${done ? '✓' : ''}</span>
    <span class="check-body">
      <span class="check-title">${esc(title)}</span>
      <span class="check-note">${esc(note)}</span>
    </span>
  </a>`;
}

// One row per preset recurring challenge, scoped to the period we're in now.
function periodChecklist() {
  const rows = [];
  const specs = [
    { id: 'classic-every-quarter', period: focusQuarter(state.settings.year), label: 'Classic' },
    { id: 'reread-every-quarter', period: focusQuarter(state.settings.year), label: 'Re-read' },
    { id: 'physical-tbr-every-other-month', period: focusBimonth(state.settings.year), label: 'Physical TBR' },
  ];

  for (const spec of specs) {
    const challenge = getChallenge(spec.id);
    if (!challenge) continue;
    const result = evaluate(challenge, state.books);
    const p = result.periods.find((x) => x.key === spec.period.key);
    if (!p) continue;
    const done = p.complete;
    // checkRow escapes for us, so these stay raw text.
    const note = done
      ? `${p.books[0].title} · finished ${formatDate(p.books[0].dateFinished)}`
      : `${p.label} · ${p.count} of ${p.target}`;
    rows.push(checkRow(
      done,
      `${spec.label} — ${p.label.replace(/^Q\d · /, '')}`,
      note,
      `#/challenge/${encodeURIComponent(challenge.id)}`,
    ));
  }

  if (!rows.length) return '';
  return `<h2 class="section-title">This period</h2>
    <section class="card"><div class="checklist">${rows.join('')}</div></section>`;
}

function bookmarkRow() {
  const { collected, total, catalog, have } = bookmarkStats();
  const recent = [...have.values()]
    .sort((a, b) => String(b.unlockedAt || '').localeCompare(String(a.unlockedAt || '')))
    .slice(0, 8);

  const strip = recent.length
    ? `<div class="bm-strip">${recent.map((u) => {
        const img = state.images.get(u.id);
        const meta = catalog.get(u.id);
        return markVisual(u.id, {
          bonus: !!(meta && meta.bonus),
          dataUrl: img ? img.dataUrl : null,
        });
      }).join('')}</div>`
    : `<div class="bm-strip">${[0, 1, 2, 3].map(() => lockedArt()).join('')}</div>`;

  return `<h2 class="section-title">Bookmarks</h2>
    <a class="card card-link" href="#/bookmarks">
      <div class="row-between" style="margin-bottom:.6rem">
        <strong>${collected} of ${total} bookmarks collected</strong>
        <span class="muted small">All ›</span>
      </div>
      ${strip}
      ${!recent.length ? '<p class="tiny muted" style="margin:.6rem 0 0">Finish a challenge period to unlock your first one.</p>' : ''}
    </a>`;
}

export function homeView() {
  const year = state.settings.year;
  const annual = annualProgress();
  const q = focusQuarter(year);
  const quarter = quarterProgress(q);
  const today = todayISO();

  const preface = today < `${year}-01-01`
    ? `<div class="notice">The ${year} challenge has not started yet. Anything you finish before Jan 1 will not count toward these goals — log it on or after ${formatDate(`${year}-01-01`)}.</div>`
    : '';

  const challengeCount = allChallenges().length;

  return {
    title: 'Shelf Marks',
    tab: 'home',
    fab: true,
    html: `
      ${preface}
      ${goalCard({ label: `${year} reading challenge`, read: annual.read, goal: annual.goal, pct: annual.pct, period: annual.period })}
      ${goalCard({ label: q.label, read: quarter.read, goal: quarter.goal, pct: quarter.pct, period: q })}
      ${nonfictionCard()}
      ${periodChecklist()}
      ${bookmarkRow()}
      <h2 class="section-title">Challenges</h2>
      <a class="card card-link" href="#/challenges">
        <div class="row-between">
          <strong>${challengeCount} challenge${challengeCount === 1 ? '' : 's'} running</strong>
          <span class="muted small">Open ›</span>
        </div>
      </a>
    `,
  };
}
