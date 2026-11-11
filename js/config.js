// Shelf Marks configuration.
//
// Challenges are DATA, not logic. Everything here is consumed by the rule
// engine in rules.js, which knows nothing about any specific challenge.
// To add a challenge, append an object to PRESET_CHALLENGES — no code changes.
//
// Challenge shape
//   id           stable string, used as the merge key for backups
//   name         display name
//   blurb        one-line description
//   filter       { type: 'any' | 'author' | 'series' | 'tag'
//                        | 'nonfiction' | 'fiction' | 'classic' | 'reread' | 'tbr' | 'title',
//                  authors?: [..], series?: '..', tag?: '..' }
//   window       { type: 'year',      year }
//                { type: 'quarter',   year, quarter: 1..4 }
//                { type: 'range',     start: 'YYYY-MM-DD', end: 'YYYY-MM-DD', label? }
//                { type: 'recurring', periods: 'quarters' | 'bimonths' | [ {key,label,start,end} ] }
//   target       books needed. For a recurring window this is PER PERIOD.
//                null means "not set yet" — the detail screen asks for it.
//   bookmarks    recurring: { periodKey: bookmarkId }
//                otherwise: [ bookmarkId, ... ] one per book toward the target
//   bookmarkPrefix  alternative to `bookmarks` for a non-recurring challenge whose
//                   target is editable: ids are generated as `${prefix}-1 … -N`
//   bonusBookmark   recurring only: granted when every period is complete
//   editable     true if the target / author list can be changed in the app

export const YEAR = 2027;

export const PRESET_CHALLENGES = [
  {
    id: 'classic-every-quarter',
    name: 'Classic Every Quarter',
    blurb: 'One book marked Classic in each quarter of 2027.',
    preset: true,
    filter: { type: 'classic' },
    window: { type: 'recurring', periods: 'quarters' },
    target: 1,
    bookmarks: {
      Q1: 'classic-q1',
      Q2: 'classic-q2',
      Q3: 'classic-q3',
      Q4: 'classic-q4',
    },
    bonusBookmark: 'classic-all',
  },
  {
    id: 'reread-every-quarter',
    name: 'Re-read Every Quarter',
    blurb: 'One book marked Re-read in each quarter of 2027.',
    preset: true,
    filter: { type: 'reread' },
    window: { type: 'recurring', periods: 'quarters' },
    target: 1,
    bookmarks: {
      Q1: 'reread-q1',
      Q2: 'reread-q2',
      Q3: 'reread-q3',
      Q4: 'reread-q4',
    },
    bonusBookmark: 'reread-all',
  },
  {
    id: 'physical-tbr-every-other-month',
    name: 'Physical TBR Every Other Month',
    blurb: 'One book from your physical TBR in each two-month period.',
    preset: true,
    filter: { type: 'tbr' },
    window: { type: 'recurring', periods: 'bimonths' },
    target: 1,
    bookmarks: {
      'jan-feb': 'tbr-jan-feb',
      'mar-apr': 'tbr-mar-apr',
      'may-jun': 'tbr-may-jun',
      'jul-aug': 'tbr-jul-aug',
      'sep-oct': 'tbr-sep-oct',
      'nov-dec': 'tbr-nov-dec',
    },
    bonusBookmark: 'tbr-all',
  },
  {
    // Target and author list were not specified, so both are set in the app
    // (Challenges → this challenge → Edit). Bookmark ids are generated from
    // the target as didion-1 … didion-N, so they stay stable as it grows.
    id: 'didion-and-kindred',
    name: 'Joan Didion & Kindred Voices',
    blurb: 'Books by Joan Didion and authors in her vein, across 2027.',
    preset: true,
    editable: true,
    filter: { type: 'author', authors: ['Joan Didion'] },
    window: { type: 'year', year: YEAR },
    target: null,
    bookmarkPrefix: 'didion',
  },
];

export const DEFAULT_SETTINGS = {
  id: 'settings',
  year: YEAR,
  annualGoal: 80,
  quarterGoals: { Q1: 20, Q2: 20, Q3: 20, Q4: 20 },
  // Nonfiction goal is a share of everything read, not a fixed book count.
  nonfictionTargetPct: 30,
  lastExportedAt: null,
};

// Author → series suggestions offered in the book form.
export const AUTHOR_SERIES_HINTS = {
  'suzanne collins': ['The Hunger Games'],
};

// Open Library subject keywords used to pre-select the Fiction/Nonfiction
// toggle. Always confirmed by hand in the form — these only set the default.
export const NONFICTION_SUBJECT_HINTS = [
  'nonfiction', 'non-fiction', 'biography', 'autobiography', 'memoir',
  'memoirs', 'essays', 'history', 'historiography', 'philosophy',
  'psychology', 'science', 'mathematics', 'economics', 'politics',
  'political science', 'sociology', 'anthropology', 'true crime',
  'travel', 'journalism', 'criticism', 'self-help', 'business',
  'cookbooks', 'nature', 'medicine', 'religion', 'reference',
  'correspondence', 'diaries', 'letters', 'interviews', 'speeches',
];

export const FICTION_SUBJECT_HINTS = [
  'fiction', 'novel', 'novels', 'short stories', 'fantasy',
  'science fiction', 'mystery', 'romance', 'thriller', 'horror',
  'juvenile fiction', 'graphic novels', 'comics', 'poetry', 'drama',
];

export const FILTER_TYPES = [
  { value: 'any', label: 'Any book' },
  { value: 'author', label: 'Author is one of…' },
  { value: 'title', label: 'Book title is one of…' },
  { value: 'series', label: 'Series is…' },
  { value: 'tag', label: 'Tag is…' },
  { value: 'nonfiction', label: 'Nonfiction' },
  { value: 'fiction', label: 'Fiction' },
  { value: 'classic', label: 'Classic' },
  { value: 'reread', label: 'Re-read' },
  { value: 'tbr', label: 'From my physical TBR' },
];

export const WINDOW_TYPES = [
  { value: 'year', label: 'Full year 2027' },
  { value: 'quarter', label: 'A specific quarter' },
  { value: 'range', label: 'A custom date range' },
  { value: 'recurring', label: 'Recurring periods' },
];
