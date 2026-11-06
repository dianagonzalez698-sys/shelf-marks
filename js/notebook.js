// Literary writing is independent of page layouts and survives redesigns.
import * as store from './store.js';

let entries = [];
export const KINDS = [
  ['reflection', 'Reading reflection'],
  ['review', 'Book review'],
  ['passage', 'Passage / quotation'],
  ['essay', 'Personal essay'],
  ['note', 'Reading note'],
];

export async function load() {
  entries = (await store.getAll('notebook')).filter(x => x && x.id && !x.deleted);
}
export function list() { return [...entries].sort((a,b) => (b.updatedAt || '').localeCompare(a.updatedAt || '')); }
export function get(id) { return entries.find(x => x.id === id) || null; }
export function snapshot() { return entries.map(x => ({...x})); }
export function adoptMany(rows) { entries = (rows || []).filter(x => x && x.id && !x.deleted); }
export async function save(patch) {
  const existing = patch.id && get(patch.id);
  const now = new Date().toISOString();
  const entry = { id: existing?.id || `nt_${crypto.randomUUID()}`, kind: 'reflection', title: '', body: '', bookId: '', createdAt: now, ...existing, ...patch, updatedAt: now };
  await store.put('notebook', entry);
  entries = [...entries.filter(x => x.id !== entry.id), entry];
  return entry;
}
export async function remove(id) {
  const found = get(id);
  if (!found) return;
  const record = {...found, deleted: true, updatedAt: new Date().toISOString()};
  await store.put('notebook', record);
  entries = entries.filter(x => x.id !== id);
}
