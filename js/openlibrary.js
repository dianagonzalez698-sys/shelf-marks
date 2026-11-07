// Open Library search + autofill. No API key, CORS-friendly, so it works
// straight from a GitHub Pages origin.

import { NONFICTION_SUBJECT_HINTS, FICTION_SUBJECT_HINTS } from './config.js';

const SEARCH_URL = 'https://openlibrary.org/search.json';
const FIELDS = [
  'key', 'title', 'author_name', 'first_publish_year',
  'cover_i', 'number_of_pages_median', 'subject', 'edition_count', 'language',
].join(',');

export function coverUrl(coverId, size = 'M') {
  if (!coverId) return null;
  return `https://covers.openlibrary.org/b/id/${encodeURIComponent(coverId)}-${size}.jpg`;
}

export async function searchBooks(query, { signal, limit = 35, by = 'all', language = 'en' } = {}) {
  const q = String(query || '').trim();
  if (q.length < 2) return [];

  const key = ({ title: 'title', author: 'author', isbn: 'isbn' })[by] || 'q';
  const url = `${SEARCH_URL}?${key}=${encodeURIComponent(q)}&limit=${limit}&fields=${FIELDS}`;
  const res = await fetch(url, { signal, headers: { Accept: 'application/json' } });
  if (!res.ok) {
    throw new Error(`Open Library returned ${res.status}`);
  }
  const data = await res.json();
  return rankResults((data.docs || []).map(normalizeDoc), q, { language });
}

function clean(text) {
  return String(text || '').normalize('NFKD').toLocaleLowerCase()
    .replace(/[\u0300-\u036f]/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

/** Relevance first, then richer records. Language is a preference, not a gate:
 * an untranslated book should still be findable when English was selected. */
export function rankResults(docs, query, { language = 'en' } = {}) {
  const q = clean(query);
  const parts = q.split(' ').filter(Boolean);
  const score = (doc) => {
    const title = clean(doc.title);
    const author = clean(doc.author);
    const tokens = new Set(title.split(' '));
    const matching = parts.filter(p => tokens.has(p)).length;
    const titleRelevance = title === q ? 200 : title.startsWith(q) ? 140
      : title.includes(q) ? 115 : matching / (parts.length || 1) * 80;
    const authorRelevance = author.includes(q) ? 85 : 0;
    const english = (doc.languages || []).includes('eng');
    return titleRelevance + authorRelevance + (language === 'en' && english ? 36 : 0)
      + (doc.coverUrl ? 8 : 0) + (doc.author ? 4 : 0)
      + (doc.firstPublishYear ? 2 : 0);
  };
  return docs.sort((a,b) => score(b)-score(a));
}

function normalizeDoc(doc) {
  const subjects = (doc.subject || []).slice(0, 40);
  return {
    olKey: doc.key || null,
    title: doc.title || '',
    author: (doc.author_name || []).join(', '),
    authors: doc.author_name || [],
    firstPublishYear: doc.first_publish_year || null,
    pages: doc.number_of_pages_median || null,
    coverId: doc.cover_i || null,
    coverUrl: coverUrl(doc.cover_i, 'M'),
    subjects,
    editionCount: doc.edition_count || null,
    languages: doc.language || [],
  };
}

// Whole-word match, so "fiction" does not match inside "nonfiction" and
// "novel" does not match inside "novelists".
function hasTerm(subject, term) {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`).test(subject);
}

/**
 * Best guess at Fiction vs Nonfiction from Open Library subjects.
 * Returns 'nonfiction' | 'fiction' | null (null = don't pre-select).
 */
export function guessFormat(subjects) {
  const list = (subjects || [])
    .map((s) => String(s).toLowerCase().trim())
    // Open Library mixes in machine tags like
    // "award:national_book_award=nonfiction" and "nyt:…-nonfiction=2022-01-16".
    // They describe lists and prizes, not genre, so they only add noise.
    .filter((s) => s && !s.includes(':') && !s.includes('='));
  if (!list.length) return null;

  let nf = 0;
  let fic = 0;
  for (const s of list) {
    // Nonfiction wins a subject outright, so "non-fiction" is never counted
    // as fiction.
    if (NONFICTION_SUBJECT_HINTS.some((h) => hasTerm(s, h))) { nf += 1; continue; }
    if (FICTION_SUBJECT_HINTS.some((h) => hasTerm(s, h))) { fic += 1; }
  }
  if (nf === 0 && fic === 0) return null;
  // Only pre-select when the signal is reasonably clear; otherwise leave the
  // toggle empty and let the reader decide.
  if (nf > fic * 1.5) return 'nonfiction';
  if (fic > nf * 1.5) return 'fiction';
  return null;
}

// Debounce helper used by the search box, with cancel support.
export function debounce(fn, ms) {
  let t = null;
  const wrapped = (...args) => {
    if (t) clearTimeout(t);
    t = setTimeout(() => { t = null; fn(...args); }, ms);
  };
  wrapped.cancel = () => { if (t) clearTimeout(t); t = null; };
  return wrapped;
}
