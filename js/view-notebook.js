import * as notebook from './notebook.js';
import { state } from './state.js';
import { esc, attr, navigate, toast } from './ui.js';

const excerpt = (value, limit = 190) => String(value || '').replace(/\s+/g, ' ').slice(0, limit);
const kindLabel = (kind) => notebook.KINDS.find(x => x[0] === kind)?.[1] || 'Journal entry';
const dateLabel = (s) => s ? new Date(s).toLocaleDateString(undefined, {month:'long', day:'numeric', year:'numeric'}) : '';
const bookName = (id) => state.books.find(b => b.id === id)?.title || '';

export function notebookView() {
  const entries = notebook.list();
  return {
    title: 'The Notebook', tab: 'notebook', fab: false,
    html: `<div class="literary-notebook">
      <header class="lit-page-heading"><p class="lit-overline">THE WRITING DESK / ${state.settings.year}</p>
        <h1>The <em>Notebook</em></h1>
        <p>For everything worth keeping after the last page.</p>
        <a class="lit-primary-action" href="#/notebook/new">+ New entry <span>↗</span></a>
      </header>
      <div class="lit-notebook-index"><span>THE ARCHIVE</span><span>${entries.length} ${entries.length === 1 ? 'ENTRY' : 'ENTRIES'}</span></div>
      ${entries.length ? `<div class="lit-writing-grid">${entries.map((e,i) => `
        <a class="lit-writing-card" href="#/notebook/${encodeURIComponent(e.id)}">
          <span class="lit-entry-number">${String(i+1).padStart(2,'0')} / ${esc(kindLabel(e.kind))}</span>
          <h2>${esc(e.title || 'Untitled entry')}</h2>
          <p>${esc(excerpt(e.body))}${e.body?.length > 190 ? '…' : ''}</p>
          <span class="lit-entry-foot">${esc(bookName(e.bookId) || dateLabel(e.updatedAt))}<span>Read & edit ↗</span></span>
        </a>`).join('')}</div>` : `<div class="lit-empty-writing"><span class="lit-flourish">❧</span>
        <h2>Begin anywhere.</h2><p>A sentence from a novel, a thought you don't want to lose, or a page of your own.</p>
        <a href="#/notebook/new">Write your first entry ↗</a></div>`}
    </div>`,
  };
}

export function notebookEntryView({id}) {
  const existing = id !== 'new' ? notebook.get(id) : null;
  if (id !== 'new' && !existing) return { title: 'Not found', html: '<div class="empty"><h2>Entry not found</h2><a href="#/notebook">Back to notebook</a></div>' };
  const item = existing || {kind:'reflection',title:'',body:'',bookId:''};
  return {
    title: existing ? 'Edit writing' : 'New writing', tab:'notebook', fab:false, live:false,
    html:`<div class="lit-writing-form"><a class="lit-back" href="#/notebook">← The Notebook</a>
      <p class="lit-overline">THE WRITING DESK</p><h1>${existing ? 'Refine your words' : 'Something worth keeping'}</h1>
      <form id="lit-entry-form">
        <div class="lit-form-row"><label>ENTRY TYPE<select name="kind">${notebook.KINDS.map(([key,name]) => `<option value="${key}" ${item.kind === key ? 'selected' : ''}>${name}</option>`).join('')}</select></label>
        <label>BOOK (OPTIONAL)<select name="bookId"><option value="">Not tied to a book</option>${state.books.map(b => `<option value="${attr(b.id)}" ${item.bookId === b.id ? 'selected' : ''}>${esc(b.title)}</option>`).join('')}</select></label></div>
        <label>TITLE<input name="title" required maxlength="180" placeholder="Give this piece a title…" value="${attr(item.title)}"></label>
        <label>YOUR WORDS<textarea name="body" rows="14" placeholder="Start writing…">${esc(item.body)}</textarea></label>
        <div class="lit-form-actions"><span>Saved privately on this device</span><button class="lit-primary-action" type="submit">Save entry ↗</button></div>
      </form></div>`,
    onMount(root) {
      root.querySelector('#lit-entry-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const btn = form.querySelector('button[type=submit]');
        btn.disabled = true;
        try {
          await notebook.save({...(existing ? {id: existing.id} : {}),title:form.elements.title.value.trim(),body:form.elements.body.value,kind:form.elements.kind.value,bookId:form.elements.bookId.value});
          toast('Your writing is saved.', 'good');
          navigate('/notebook');
        } catch (_) { toast('Could not save your writing.', 'bad'); btn.disabled = false; }
      });
    },
  };
}
