// Date + period helpers.
// All book dates are stored as plain ISO date strings ("2027-03-04") so that
// lexicographic comparison is also chronological comparison. That sidesteps
// every timezone / DST bug that comes from putting Date objects in storage.

export const YEAR = 2027;

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                     'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function localISO(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function todayISO() {
  return localISO(new Date());
}

export function isValidISO(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  if (m < 1 || m > 12 || d < 1) return false;
  return d <= new Date(Date.UTC(y, m, 0)).getUTCDate();
}

// Days from a to b (b - a). Parsed as UTC midnights, so no DST drift.
export function daysBetween(aISO, bISO) {
  const a = Date.parse(aISO + 'T00:00:00Z');
  const b = Date.parse(bISO + 'T00:00:00Z');
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.round((b - a) / 86400000);
}

function lastDay(year, month1) {
  return new Date(Date.UTC(year, month1, 0)).getUTCDate();
}

function period(key, label, year, startMonth, endMonth) {
  return {
    key,
    label,
    start: `${year}-${String(startMonth).padStart(2, '0')}-01`,
    end: `${year}-${String(endMonth).padStart(2, '0')}-${lastDay(year, endMonth)}`,
  };
}

export function quarters(year = YEAR) {
  return [
    period('Q1', 'Q1 · Jan–Mar', year, 1, 3),
    period('Q2', 'Q2 · Apr–Jun', year, 4, 6),
    period('Q3', 'Q3 · Jul–Sep', year, 7, 9),
    period('Q4', 'Q4 · Oct–Dec', year, 10, 12),
  ];
}

export function bimonths(year = YEAR) {
  return [
    period('jan-feb', 'Jan–Feb', year, 1, 2),
    period('mar-apr', 'Mar–Apr', year, 3, 4),
    period('may-jun', 'May–Jun', year, 5, 6),
    period('jul-aug', 'Jul–Aug', year, 7, 8),
    period('sep-oct', 'Sep–Oct', year, 9, 10),
    period('nov-dec', 'Nov–Dec', year, 11, 12),
  ];
}

export function yearPeriod(year = YEAR) {
  return { key: 'year', label: String(year), start: `${year}-01-01`, end: `${year}-12-31` };
}

export function inPeriod(dateISO, p) {
  if (!dateISO || !p) return false;
  return dateISO >= p.start && dateISO <= p.end;
}

// 'before' | 'during' | 'after', with a day count that means something in each case.
export function periodStatus(p, today = todayISO()) {
  if (today < p.start) {
    return { state: 'before', days: daysBetween(today, p.start) };
  }
  if (today > p.end) {
    return { state: 'after', days: daysBetween(p.end, today) };
  }
  return { state: 'during', days: daysBetween(today, p.end) };
}

// The "N days left" line on the goal cards.
export function daysLeftLabel(p, today = todayISO()) {
  const s = periodStatus(p, today);
  if (s.state === 'before') {
    return s.days === 1 ? 'starts tomorrow' : `starts in ${s.days} days`;
  }
  if (s.state === 'after') {
    return 'period ended';
  }
  if (s.days === 0) return 'last day';
  return `${s.days} ${s.days === 1 ? 'day' : 'days'} left`;
}

export function quarterFor(dateISO, year = YEAR) {
  return quarters(year).find((q) => inPeriod(dateISO, q)) || null;
}

export function bimonthFor(dateISO, year = YEAR) {
  return bimonths(year).find((b) => inPeriod(dateISO, b)) || null;
}

// The quarter the home screen should feature: the live one inside the
// challenge year, otherwise the nearest edge so the card is never blank.
export function focusQuarter(year = YEAR, today = todayISO()) {
  const qs = quarters(year);
  return qs.find((q) => inPeriod(today, q)) || (today < qs[0].start ? qs[0] : qs[3]);
}

export function focusBimonth(year = YEAR, today = todayISO()) {
  const bs = bimonths(year);
  return bs.find((b) => inPeriod(today, b)) || (today < bs[0].start ? bs[0] : bs[bs.length - 1]);
}

export function formatDate(iso) {
  if (!isValidISO(iso)) return '—';
  const [y, m, d] = iso.split('-').map(Number);
  return `${MONTH_NAMES[m - 1]} ${d}, ${y}`;
}

export function formatDateTime(ts) {
  if (!ts) return 'never';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return 'never';
  return `${MONTH_NAMES[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()} at ` +
    d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}
