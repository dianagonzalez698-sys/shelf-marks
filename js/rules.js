// The challenge rule engine.
//
// It knows filter types, window types and targets — it does not know about any
// particular challenge. Every preset in config.js, and every challenge you
// build in the app, runs through evaluate() below.

import { quarters, bimonths, yearPeriod, inPeriod, YEAR } from './periods.js';

function norm(s) {
  return String(s == null ? '' : s).trim().toLowerCase().replace(/\s+/g, ' ');
}

// "Didion, Joan" and "Joan Didion" should be the same author.
function flipName(s) {
  const m = /^([^,]+),\s*(.+)$/.exec(String(s || '').trim());
  return m ? `${m[2]} ${m[1]}` : String(s || '').trim();
}

function authorForms(book) {
  const raw = [book.author, ...(book.authors || [])].filter(Boolean);
  const forms = new Set();
  for (const r of raw) {
    forms.add(norm(r));
    forms.add(norm(flipName(r)));
  }
  return forms;
}

function authorMatches(book, wanted) {
  const target = norm(flipName(wanted));
  if (!target) return false;
  const forms = authorForms(book);
  if (forms.has(target)) return true;
  // Tolerate "Joan Didion" vs "Joan Didion, Hilton Als" style combined credits.
  for (const f of forms) {
    if (f.includes(target)) return true;
  }
  return false;
}

export function matchesFilter(book, filter) {
  if (!filter || !filter.type) return false;
  switch (filter.type) {
    case 'any': return true;
    case 'nonfiction': return book.format === 'nonfiction';
    case 'fiction': return book.format === 'fiction';
    case 'classic': return !!book.isClassic;
    case 'reread': return !!book.isReread;
    case 'tbr': return !!book.isTbr;
    case 'author': return (filter.authors || []).some((a) => authorMatches(book, a));
    case 'title': return (filter.titles || []).some((title) => norm(title) === norm(book.title));
    case 'publishedBefore': {
      const year = Number(book.firstPublishYear);
      const cutoff = Number(filter.year);
      return Number.isInteger(year) && year !== 0 && Number.isInteger(cutoff) && cutoff > 0 && year < cutoff;
    }
    case 'series': return !!book.series && norm(book.series) === norm(filter.series);
    case 'tag': return (book.tags || []).some((t) => norm(t) === norm(filter.tag));
    default: return false;
  }
}

export function describeFilter(filter) {
  if (!filter) return '—';
  switch (filter.type) {
    case 'any': return 'Any book';
    case 'nonfiction': return 'Nonfiction';
    case 'fiction': return 'Fiction';
    case 'classic': return 'Marked Classic';
    case 'reread': return 'Marked Re-read';
    case 'tbr': return 'From my physical TBR';
    case 'author': {
      const list = filter.authors || [];
      if (!list.length) return 'No authors chosen yet';
      if (list.length === 1) return `By ${list[0]}`;
      return `By ${list.slice(0, -1).join(', ')} or ${list[list.length - 1]}`;
    }
    case 'title': {
      const titles = filter.titles || [];
      if (!titles.length) return 'No book titles chosen yet';
      if (titles.length === 1) return `Reading “${titles[0]}”`;
      return `${titles.length} selected book titles`;
    }
    case 'publishedBefore': return Number.isInteger(Number(filter.year)) && Number(filter.year) > 0
      ? `First published before ${filter.year}` : 'Publication year not set';
    case 'series': return `In the ${filter.series} series`;
    case 'tag': return `Tagged “${filter.tag}”`;
    default: return filter.type;
  }
}

export function isRecurring(challenge) {
  return !!challenge && challenge.window && challenge.window.type === 'recurring';
}

// Every period the window covers, in order.
export function windowPeriods(window) {
  if (!window) return [yearPeriod(YEAR)];
  const year = window.year || YEAR;
  switch (window.type) {
    case 'year':
      return [yearPeriod(year)];
    case 'quarter': {
      const qs = quarters(year);
      const q = qs[(Number(window.quarter) || 1) - 1];
      return [q || qs[0]];
    }
    case 'range':
      return [{
        key: 'range',
        label: window.label || `${window.start} → ${window.end}`,
        start: window.start,
        end: window.end,
      }];
    case 'recurring':
      if (window.periods === 'quarters') return quarters(year);
      if (window.periods === 'bimonths') return bimonths(year);
      if (Array.isArray(window.periods)) return window.periods;
      return quarters(year);
    default:
      return [yearPeriod(year)];
  }
}

export function describeWindow(window) {
  if (!window) return '2027';
  switch (window.type) {
    case 'year': return `All of ${window.year || YEAR}`;
    case 'quarter': return windowPeriods(window)[0].label;
    case 'range': return `${window.start} → ${window.end}`;
    case 'recurring':
      if (window.periods === 'bimonths') return 'Every two months';
      if (window.periods === 'quarters') return 'Every quarter';
      return 'Recurring periods';
    default: return '2027';
  }
}

// Bookmark id for one period of a recurring challenge.
function periodBookmark(challenge, periodKey) {
  const map = challenge.bookmarks;
  if (map && !Array.isArray(map) && map[periodKey]) return map[periodKey];
  if (challenge.bookmarkPrefix) return `${challenge.bookmarkPrefix}-${periodKey}`;
  return `${challenge.id}-${periodKey}`;
}

// Bookmark ids for a counted (non-recurring) challenge, one per book.
function countedBookmarks(challenge) {
  const target = Number(challenge.target) || 0;
  if (Array.isArray(challenge.bookmarks) && challenge.bookmarks.length) {
    return challenge.bookmarks.slice(0, target || challenge.bookmarks.length);
  }
  const prefix = challenge.bookmarkPrefix || challenge.id;
  return Array.from({ length: target }, (_, i) => `${prefix}-${i + 1}`);
}

// Every bookmark this challenge can ever award, in display order.
export function allBookmarkIds(challenge) {
  if (isRecurring(challenge)) {
    const ids = windowPeriods(challenge.window).map((p) => periodBookmark(challenge, p.key));
    if (challenge.bonusBookmark) ids.push(challenge.bonusBookmark);
    return ids;
  }
  return countedBookmarks(challenge);
}

/**
 * Evaluate one challenge against the books read.
 * Returns period-by-period detail plus the flat list of bookmarks earned.
 */
export function evaluate(challenge, books) {
  const recurring = isRecurring(challenge);
  const periodsDef = windowPeriods(challenge.window);
  const perTarget = challenge.target == null ? null : Math.max(1, Number(challenge.target));
  // The filter proposes; you dispose. A rule can say "marked Classic", but it
  // cannot say "authors like Didion" — so a challenge may also name books that
  // count whatever the rule thinks, and books that do not. Hand-picked wins.
  const include = new Set(challenge.includeBooks || []);
  const exclude = new Set(challenge.excludeBooks || []);
  const matching = (books || []).filter((b) => !exclude.has(b.id)
    && (include.has(b.id) || matchesFilter(b, challenge.filter)));

  const periods = periodsDef.map((p) => {
    const inner = matching
      .filter((b) => inPeriod(b.dateFinished, p))
      .sort((a, b) => a.dateFinished.localeCompare(b.dateFinished));
    const target = recurring ? (perTarget || 1) : perTarget;
    return {
      ...p,
      books: inner,
      count: inner.length,
      target,
      complete: target != null && inner.length >= target,
      bookmarkId: recurring ? periodBookmark(challenge, p.key) : null,
    };
  });

  const earned = [];
  let bonus = null;
  let count;
  let target;

  if (recurring) {
    count = periods.filter((p) => p.complete).length;
    target = periods.length;
    periods.forEach((p) => { if (p.complete) earned.push(p.bookmarkId); });
    if (challenge.bonusBookmark) {
      const all = periods.every((p) => p.complete);
      bonus = { bookmarkId: challenge.bonusBookmark, complete: all };
      if (all) earned.push(challenge.bonusBookmark);
    }
  } else {
    count = periods[0] ? periods[0].count : 0;
    target = perTarget;
    const ids = countedBookmarks(challenge);
    for (let i = 0; i < Math.min(count, ids.length); i += 1) earned.push(ids[i]);
  }

  const unset = target == null;
  return {
    challenge,
    recurring,
    periods,
    books: matching,
    count,
    target,
    targetUnset: unset,
    complete: !unset && count >= target,
    pct: unset || !target ? 0 : Math.round((count / target) * 100),
    earned,
    bonus,
    allBookmarkIds: allBookmarkIds(challenge),
  };
}

// Label a bookmark for the Bookmarks screen, derived from its challenge.
export function bookmarkLabels(challenge) {
  const out = new Map();
  if (isRecurring(challenge)) {
    windowPeriods(challenge.window).forEach((p) => {
      out.set(periodBookmark(challenge, p.key), {
        id: periodBookmark(challenge, p.key),
        challengeId: challenge.id,
        challengeName: challenge.name,
        periodKey: p.key,
        title: p.label,
        bonus: false,
      });
    });
    if (challenge.bonusBookmark) {
      out.set(challenge.bonusBookmark, {
        id: challenge.bonusBookmark,
        challengeId: challenge.id,
        challengeName: challenge.name,
        periodKey: 'all',
        title: 'Complete set',
        bonus: true,
      });
    }
  } else {
    countedBookmarks(challenge).forEach((id, i) => {
      out.set(id, {
        id,
        challengeId: challenge.id,
        challengeName: challenge.name,
        periodKey: String(i + 1),
        title: `Book ${i + 1}`,
        bonus: false,
      });
    });
  }
  return out;
}

// Every bookmark across every challenge, in challenge order.
export function bookmarkCatalog(challenges) {
  const out = new Map();
  (challenges || []).forEach((c) => {
    bookmarkLabels(c).forEach((v, k) => out.set(k, v));
  });
  return out;
}

// Which bookmarks the current books have earned, keyed by bookmark id.
export function earnedBookmarks(challenges, books) {
  const out = new Map();
  (challenges || []).forEach((c) => {
    const result = evaluate(c, books);
    const labels = bookmarkLabels(c);
    result.earned.forEach((id) => {
      if (out.has(id)) return;
      const label = labels.get(id);
      out.set(id, {
        bookmarkId: id,
        challengeId: c.id,
        periodKey: label ? label.periodKey : null,
      });
    });
  });
  return out;
}


/**
 * Why a book does or does not count toward a challenge.
 *
 * Three states, and the difference matters when you are looking at a list
 * wondering why something is in it: the rule matched, you said so, or you
 * said not.
 */
export function eligibility(book, challenge) {
  if ((challenge.excludeBooks || []).includes(book.id)) return 'excluded';
  if ((challenge.includeBooks || []).includes(book.id)) return 'picked';
  return matchesFilter(book, challenge.filter) ? 'matched' : 'no';
}
