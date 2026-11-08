import * as notebook from './notebook.js';
import { state } from './state.js';
import { esc, attr, navigate, toast } from './ui.js';
import { bookDecorMarkup, mountBookDecor } from './book-decor.js';
import * as assets from './assets.js';

const excerpt = (value, limit = 190) => String(value || '').replace(/\s+/g, ' ').slice(0, limit);
const kindLabel = (kind) => notebook.KINDS.find(x => x[0] === kind)?.[1] || 'Journal entry';
const dateLabel = (s) => s ? new Date(s).toLocaleDateString(undefined, {month:'long', day:'numeric', year:'numeric'}) : '';
const bookName = (id) => state.books.find(b => b.id === id)?.title || '';
const CARD_PAPERS = [['default','Original paper'],['ivory','Soft ivory'],['rose','Blush parchment'],['sage','Muted sage'],['blue','Pale blue'],['plain','No texture']];
const cardPaperStyle = (entry) => {
  const image = assets.src(entry.cardBackgroundAssetId);
  return image ? `background-image:url('${image}');background-size:cover;background-position:center` : '';
};

export function notebookView() {
  const entries = notebook.list();
  return {
    title: 'The Notebook', tab: 'notebook', fab: false,
    html: `<div class="literary-notebook">
      <header class="lit-page-heading"><p class="lit-overline">THE WRITING DESK / ${state.settings.year}</p>
        <h1>The <em>Notebook</em></h1>
        <p>A place for loose thoughts, little essays, and passages worth keeping. Notes on a particular book belong in its <a href="#/books">reading journal</a>.</p>
        <a class="lit-primary-action" href="#/notebook/new">Write a note <span>↗</span></a>
      </header>
      <div class="lit-notebook-index"><span>THE ARCHIVE</span><span>${entries.length} ${entries.length === 1 ? 'ENTRY' : 'ENTRIES'}</span></div>
      ${entries.length ? `<details class="lit-card-design"><summary>Customize card backgrounds</summary><p>Choose a paper color, or use an image from your artwork library. Each entry can have its own background.</p><div class="lit-card-design-list">${entries.map(e => `<label>${esc(e.title || 'Untitled entry')}<select data-card-paper="${attr(e.id)}">${CARD_PAPERS.map(([value,name]) => `<option value="${value}" ${e.cardPaper === value ? 'selected' : ''}>${name}</option>`).join('')}</select><select data-card-asset="${attr(e.id)}"><option value="">No background image</option>${assets.list().map(a => `<option value="${attr(a.id)}" ${e.cardBackgroundAssetId === a.id ? 'selected' : ''}>${esc(a.name || 'Untitled image')}</option>`).join('')}</select><span class="lit-card-upload">Or upload <input type="file" accept="image/*" data-card-upload="${attr(e.id)}"></span></label>`).join('')}</div></details>` : ''}
      ${entries.length ? `<div class="lit-writing-grid">${entries.map((e,i) => `
        <a class="lit-writing-card" data-card-id="${attr(e.id)}" data-card-paper-tone="${attr(e.cardPaper || 'default')}" style="${attr(cardPaperStyle(e))}" href="#/notebook/${encodeURIComponent(e.id)}">
          <span class="lit-entry-number">${String(i+1).padStart(2,'0')} / ${esc(kindLabel(e.kind))}</span>
          <h2>${esc(e.title || 'Untitled entry')}</h2>
          <p>${esc(excerpt(e.body))}${e.body?.length > 190 ? '…' : ''}</p>
          <span class="lit-entry-foot">${esc(bookName(e.bookId) || dateLabel(e.updatedAt))}<span>Read & edit ↗</span></span>
        </a>`).join('')}</div>` : `<div class="lit-empty-writing"><span class="lit-flourish">❧</span>
        <h2>Begin anywhere.</h2><p>A sentence from a novel, a thought you don't want to lose, or a page of your own.</p>
        <a href="#/notebook/new">Write your first entry ↗</a></div>`}
    </div>`,
    onMount(root) {
      const updateCard = async (id, patch) => {
        try {
          const entry = await notebook.save({id, ...patch});
          const card = [...root.querySelectorAll('[data-card-id]')].find(el => el.dataset.cardId === id);
          if (card) { card.dataset.cardPaperTone = entry.cardPaper || 'default'; card.style.backgroundImage = assets.src(entry.cardBackgroundAssetId) ? `url("${assets.src(entry.cardBackgroundAssetId)}")` : ''; card.style.backgroundSize = 'cover'; card.style.backgroundPosition = 'center'; }
          toast('Card background saved.', 'good');
        } catch (_) { toast('Could not save the card background.', 'bad'); }
      };
      root.querySelectorAll('[data-card-paper]').forEach(el => el.addEventListener('change', () => updateCard(el.dataset.cardPaper, {cardPaper:el.value})));
      root.querySelectorAll('[data-card-asset]').forEach(el => el.addEventListener('change', () => updateCard(el.dataset.cardAsset, {cardBackgroundAssetId:el.value})));
      root.querySelectorAll('[data-card-upload]').forEach(el => el.addEventListener('change', async () => {
        if (!el.files?.[0]) return;
        try { const a = await assets.add(el.files[0], {kind:'texture'}); await updateCard(el.dataset.cardUpload, {cardBackgroundAssetId:a.id});
          const picker = [...root.querySelectorAll('[data-card-asset]')].find(x => x.dataset.cardAsset === el.dataset.cardUpload);
          if (picker) { picker.add(new Option(a.name || el.files[0].name, a.id)); picker.value = a.id; }
        } catch (_) { toast('Could not add that image.', 'bad'); }
      }));
    },
  };
}

export function notebookEntryView({id}) {
  const existing = id !== 'new' ? notebook.get(id) : null;
  if (id !== 'new' && !existing) return { title: 'Not found', html: '<div class="empty"><h2>Entry not found</h2><a href="#/notebook">Back to notebook</a></div>' };
  const item = existing || {kind:'reflection',title:'',body:'',bookId:''};
  const leftWriting = item.bodyLeft ?? item.body ?? '';
  const rightWriting = item.bodyRight ?? '';
  const initialTabs = Array.from({length:6}, (_,i) => ({label:String(i+1).padStart(2,'0'), left:i === 0 ? leftWriting : '', right:i === 0 ? rightWriting : '', ...(item.journalTabs?.[i] || {})}));
  return {
    title: existing ? 'Edit writing' : 'New writing', tab:'notebook', fab:false, live:false,
    html:`<div class="lit-writing-form${existing ? ' is-decoratable' : ''}">${existing ? bookDecorMarkup(existing) : ''}<a class="lit-back" href="#/notebook">← The Notebook</a>
      <p class="lit-overline">THE WRITING DESK</p><h1>${existing ? 'Your page' : 'A blank page'}</h1>
      ${existing ? bookDecorMarkup(existing, 'toolbar') : '<p class="lit-new-paper-hint">Save your first entry, then add pictures and arrange them on the page.</p>'}
      <div class="lit-journal-tab-bar"><button type="button" class="lit-rename-tabs-toggle" aria-expanded="false" aria-controls="lit-tab-label-editor">Rename tabs</button><div class="lit-journal-tabs" role="tablist" aria-label="Journal page spreads">${initialTabs.map((page,i) => `<button type="button" role="tab" class="${i === 0 ? 'is-active' : ''}" aria-selected="${i === 0}" data-journal-tab="${i}" title="Open ${attr(page.label)}">${esc(page.label)}</button>`).join('')}</div></div>
      <div id="lit-tab-label-editor" class="lit-tab-label-editor" hidden>${initialTabs.map((page,i) => `<label>Tab ${i+1}<input type="text" maxlength="16" data-tab-label="${i}" value="${attr(page.label)}" aria-label="Rename tab ${i+1}"></label>`).join('')}</div>
      <form id="lit-entry-form" class="lit-open-journal">
        <div class="lit-journal-frontispiece" aria-hidden="true"><span class="lit-journal-kicker">A COMMONPLACE BOOK</span><h2>Little things<br><em>worth keeping.</em></h2><p>An unhurried place for the words that linger.</p></div>
        <div class="lit-form-row"><label>ENTRY TYPE<select name="kind">${notebook.KINDS.map(([key,name]) => `<option value="${key}" ${item.kind === key ? 'selected' : ''}>${name}</option>`).join('')}</select></label>
        <label>BOOK (OPTIONAL)<select name="bookId"><option value="">Not tied to a book</option>${state.books.map(b => `<option value="${attr(b.id)}" ${item.bookId === b.id ? 'selected' : ''}>${esc(b.title)}</option>`).join('')}</select></label></div>
        <p class="hint" id="linked-journal-hint">${item.bookId ? `Writing about this book? <a href="#/book/${encodeURIComponent(item.bookId)}">Open its reading journal ↗</a>` : 'Writing a book review or tracking a reading challenge? You can do that in the book’s reading journal.'}</p>
        <label>TITLE<input name="title" required maxlength="180" placeholder="Give this piece a title…" value="${attr(item.title)}"></label>
        <label class="lit-left-writing">FIRST PAGE<textarea name="bodyLeft" rows="12" placeholder="Begin anywhere…">${esc(leftWriting)}</textarea></label>
        <label class="lit-right-writing">FACING PAGE<textarea name="bodyRight" rows="16" placeholder="Continue your thoughts…">${esc(rightWriting)}</textarea></label>
        <div class="lit-form-actions"><span id="lit-draft-status" role="status" aria-live="polite">Draft kept in this tab until you save.</span><button class="lit-primary-action" type="submit">Save entry ↗</button></div>
      </form></div>`,
    onMount(root) {
      if (existing) mountBookDecor(root, existing, {getRecord:notebook.get, saveRecord:notebook.save});
      const form = root.querySelector('#lit-entry-form');
      const status = root.querySelector('#lit-draft-status');
      const draftKey = `dlp:notebook-draft:${existing?.id || 'new'}`;
      const fields = ['kind', 'bookId', 'title'];
      let journalTabs = initialTabs.map(page => ({...page}));
      let activeTab = 0;
      const tabButtons = [...root.querySelectorAll('[data-journal-tab]')];
      const captureSpread = () => {
        journalTabs[activeTab].left = form.elements.bodyLeft.value;
        journalTabs[activeTab].right = form.elements.bodyRight.value;
      };
      const showSpread = (index) => {
        activeTab = index;
        form.elements.bodyLeft.value = journalTabs[index].left || '';
        form.elements.bodyRight.value = journalTabs[index].right || '';
        tabButtons.forEach((button,i) => { button.classList.toggle('is-active',i === index); button.setAttribute('aria-selected',String(i === index)); });
      };
      try {
        const draft = JSON.parse(sessionStorage.getItem(draftKey) || 'null');
        const savedAt = existing?.updatedAt ? new Date(existing.updatedAt).getTime() : 0;
        if (draft && draft.at > savedAt && Date.now() - draft.at < 30 * 86400000) {
          fields.forEach(key => { if (typeof draft[key] === 'string') form.elements[key].value = draft[key]; });
          if (Array.isArray(draft.journalTabs)) journalTabs = initialTabs.map((page,i) => ({...page,...(draft.journalTabs[i] || {})}));
          else { journalTabs[0].left = draft.bodyLeft ?? journalTabs[0].left; journalTabs[0].right = draft.bodyRight ?? journalTabs[0].right; }
          activeTab = Math.max(0,Math.min(5,Number(draft.activeTab) || 0));
          status.textContent = 'Your unfinished draft has been restored.';
        }
      } catch (_) { status.textContent = 'Save your entry to keep it permanently.'; }
      showSpread(activeTab);
      const keepDraft = () => {
        captureSpread();
        try {
          sessionStorage.setItem(draftKey, JSON.stringify({at:Date.now(), ...Object.fromEntries(fields.map(key => [key,form.elements[key].value])),journalTabs,activeTab}));
          status.textContent = 'Draft kept in this tab. Save when ready.';
        } catch (_) { status.textContent = 'Draft storage unavailable. Please save your entry.'; }
      };
      tabButtons.forEach(button => button.addEventListener('click', () => {
        const next = Number(button.dataset.journalTab);
        if (next === activeTab) return;
        captureSpread();
        showSpread(next);
        keepDraft();
      }));
      const renameToggle = root.querySelector('.lit-rename-tabs-toggle');
      const labelEditor = root.querySelector('#lit-tab-label-editor');
      renameToggle.addEventListener('click', () => {
        labelEditor.hidden = !labelEditor.hidden;
        renameToggle.setAttribute('aria-expanded',String(!labelEditor.hidden));
      });
      root.querySelectorAll('[data-tab-label]').forEach(input => input.addEventListener('input', () => {
        const index = Number(input.dataset.tabLabel);
        journalTabs[index].label = input.value.slice(0,16) || String(index+1).padStart(2,'0');
        tabButtons[index].textContent = journalTabs[index].label;
        tabButtons[index].title = `Open ${journalTabs[index].label}`;
        keepDraft();
      }));
      form.addEventListener('input', keepDraft);
      form.addEventListener('change', keepDraft);
      const bookPicker = root.querySelector('[name="bookId"]');
      const linkedHint = root.querySelector('#linked-journal-hint');
      const updateBookHint = () => {
        linkedHint.replaceChildren();
        if (!bookPicker.value) {
          linkedHint.textContent = 'Writing a book review or tracking a reading challenge? You can do that in the book’s reading journal.';
          return;
        }
        linkedHint.append('Writing about this book? ');
        const link = document.createElement('a');
        link.href = `#/book/${encodeURIComponent(bookPicker.value)}`;
        link.textContent = 'Open its reading journal ↗';
        linkedHint.append(link);
      };
      bookPicker.addEventListener('change', updateBookHint);
      updateBookHint();
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const btn = form.querySelector('button[type=submit]');
        btn.disabled = true;
        try {
          captureSpread();
          const body = journalTabs.flatMap(page => [page.left.trimEnd(),page.right.trimStart()]).filter(Boolean).join('\n\n');
          const saved = await notebook.save({...(existing ? {id: existing.id} : {}),title:form.elements.title.value.trim(),body,bodyLeft:journalTabs[0].left,bodyRight:journalTabs[0].right,journalTabs,kind:form.elements.kind.value,bookId:form.elements.bookId.value});
          try { sessionStorage.removeItem(draftKey); } catch (_) { /* entry is already saved */ }
          toast('Your writing is saved.', 'good');
          navigate(`/notebook/${encodeURIComponent(saved.id)}`);
        } catch (_) { toast('Could not save your writing.', 'bad'); btn.disabled = false; }
      });
    },
  };
}
