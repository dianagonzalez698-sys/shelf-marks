// The journal's opening spread: the editorial banner, the year's goals as
// editorial statistics, this period's checklist, and the bookmark archive.

import {
  state, annualProgress, quarterProgress, nonfictionProgress,
  bookmarkStats, allChallenges, getChallenge,
} from './state.js';
import { esc, attr, progressBar, markVisual, lockedArt, checkGlyph } from './ui.js';
import { evaluate } from './rules.js';
import { t } from './theme.js';
import { focusQuarter, focusBimonth, daysLeftLabel, todayISO, formatDate } from './periods.js';

/** One editorial goal statistic: label, big numeral, hairline bar, footnotes. */
function goal({ label, stat, of, pct, left, right, done, tone }) {
  const over = pct > 100;
  return `<div class="goal">
    <div class="goal-head">
      <div>
        <p class="label">${esc(label)}</p>
        <p class="goal-stat"><b>${esc(stat)}</b> <span class="of">${esc(of)}</span></p>
      </div>
      <span class="goal-pct${over ? ' over' : ''}">${pct}%</span>
    </div>
    ${progressBar(pct, { done, tone })}
    <div class="goal-foot"><span>${esc(left)}</span><span>${esc(right)}</span></div>
  </div>`;
}

function checkRow(done, title, note, href) {
  return `<a class="check-row${done ? ' done' : ''}" href="${attr(href)}">
    <span class="check-mark" aria-hidden="true">${checkGlyph()}</span>
    <span class="check-body">
      <span class="check-title">${esc(title)}</span>
      <span class="check-note">${esc(note)}</span>
    </span>
  </a>`;
}

// One row per preset recurring challenge, scoped to the period we're in now.
function periodChecklist(year) {
  const rows = [];
  const specs = [
    { id: 'classic-every-quarter', period: focusQuarter(year), label: 'A classic' },
    { id: 'reread-every-quarter', period: focusQuarter(year), label: 'A re-read' },
    { id: 'physical-tbr-every-other-month', period: focusBimonth(year), label: 'From the physical pile' },
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
      : `${p.label} · nothing logged yet`;
    rows.push(checkRow(
      done,
      `${spec.label} — ${p.label.replace(/^Q\d · /, '')}`,
      note,
      `#/challenge/${encodeURIComponent(challenge.id)}`,
    ));
  }

  if (!rows.length) return '';
  return `<section class="section section-rule">
    <div class="section-head">
      <h2 class="section-title">${esc(t('periodHeading'))}</h2>
    </div>
    <div class="checklist" style="margin-top:1.1rem">${rows.join('')}</div>
  </section>`;
}

function archiveTeaser() {
  const { collected, total, catalog, have } = bookmarkStats();
  const recent = [...have.values()]
    .sort((a, b) => String(b.unlockedAt || '').localeCompare(String(a.unlockedAt || '')))
    .slice(0, 10);

  const strip = recent.length
    ? recent.map((u) => {
        const img = state.images.get(u.id);
        const meta = catalog.get(u.id);
        return markVisual(u.id, {
          bonus: !!(meta && meta.bonus),
          dataUrl: img ? img.dataUrl : null,
        });
      }).join('')
    : [0, 1, 2, 3, 4, 5].map(() => lockedArt()).join('');

  return `<section class="section section-rule">
    <div class="section-head">
      <div>
        <h2 class="section-title">${esc(t('archiveHeading'))}</h2>
        <p class="section-sub">${esc(t('archiveSub'))}</p>
      </div>
      <a class="section-meta" href="#/bookmarks" style="text-decoration:none">
        ${collected} of ${total} collected →
      </a>
    </div>
    <div class="bm-strip" style="margin-top:1.3rem">${strip}</div>
    ${recent.length ? '' : '<p class="hint">Finish a challenge period to press the first one.</p>'}
  </section>`;
}

function challengeTeaser(year) {
  const list = allChallenges();
  if (!list.length) return '';
  const rows = list.slice(0, 4).map((c) => {
    const r = evaluate(c, state.books);
    const count = r.recurring
      ? `${r.count} of ${r.target} periods`
      : (r.targetUnset ? `${r.count} matching · no target yet` : `${r.count} of ${r.target} books`);
    return `<a class="check-row${r.complete ? ' done' : ''}" href="#/challenge/${encodeURIComponent(c.id)}">
      <span class="check-mark" aria-hidden="true">${checkGlyph()}</span>
      <span class="check-body">
        <span class="check-title">${esc(c.name)}</span>
        <span class="check-note">${esc(count)}</span>
      </span>
    </a>`;
  }).join('');

  return `<section class="section section-rule">
    <div class="section-head">
      <div>
        <h2 class="section-title">${esc(t('challengesHeading'))}</h2>
        <p class="section-sub">${esc(t('challengesSub'))}</p>
      </div>
      <a class="section-meta" href="#/challenges" style="text-decoration:none">All ${list.length} →</a>
    </div>
    <div class="checklist" style="margin-top:1.1rem">${rows}</div>
  </section>`;
}

export function homeView() {
  const year = state.settings.year;
  const annual = annualProgress();
  const q = focusQuarter(year);
  const quarter = quarterProgress(q);
  const nf = nonfictionProgress();
  const today = todayISO();

  const preface = today < `${year}-01-01`
    ? `<div class="notice"><strong>The ${year} challenge hasn’t opened yet.</strong>
         Anything finished before January 1 won’t count toward these goals.</div>`
    : '';

  return {
    title: '',
    tab: 'home',
    banner: true,
    fab: true,
    html: `
      ${preface}
      <section class="section">
        <div class="section-head">
          <div>
            <h2 class="section-title">${esc(t('homeHeading', year))}</h2>
            <p class="section-sub">${esc(t('homeSub', year))}</p>
          </div>
          <p class="section-meta">January — December ${year}</p>
        </div>

        <div style="margin-top:1.5rem">
          ${goal({
            label: `${year} reading challenge`,
            stat: annual.read,
            of: `of ${annual.goal} books`,
            pct: annual.pct,
            left: daysLeftLabel(annual.period),
            right: annual.pct > 100 ? `${annual.read - annual.goal} past goal` : `${annual.remaining} to go`,
            done: annual.pct >= 100,
            tone: 'apricot',
          })}
          ${goal({
            label: q.label,
            stat: quarter.read,
            of: `of ${quarter.goal} books`,
            pct: quarter.pct,
            left: daysLeftLabel(q),
            right: quarter.pct > 100 ? `${quarter.read - quarter.goal} past goal` : `${quarter.remaining} to go`,
            done: quarter.pct >= 100,
            tone: 'blue',
          })}
          ${goal({
            label: 'Nonfiction',
            stat: `${nf.actualPct}%`,
            of: `of ${nf.total || 'nothing'} read`,
            pct: nf.pct,
            left: nf.total ? `${nf.nonfiction} of ${nf.total} books · goal ${nf.targetPct}%` : 'No books logged yet',
            right: nf.total ? (nf.onTrack ? 'on track' : `${nf.needed} more to catch up`) : '',
            done: nf.onTrack && nf.total > 0,
            tone: 'gold',
          })}
        </div>
      </section>

      ${periodChecklist(year)}
      ${challengeTeaser(year)}
      ${archiveTeaser()}
    `,
  };
}
