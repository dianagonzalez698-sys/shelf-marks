// Editing on the page itself.
//
// The Layouts screen asks you to find a section in a list, open a panel, and
// work out which setting corresponds to the words you were looking at. This is
// the other way round: turn editing on, click the words, change them.
//
// Only text is edited in place — that is what gets rewritten most, and it is
// the part where the panel's indirection hurt most. Everything else is one
// click away through the section's own Settings button, which opens the same
// (now much shorter) panel.

import { richValue, toast, esc, attr } from './ui.js';
import * as layout from './layout.js';
import { openSectionEditor } from './view-layout.js';
import { HOME_PAGE_ID } from './view-home.js';
import { roleForKey, applySectionVars } from './sections.js';
import { FONT_STACKS, fontWeights, fontHasItalic } from './theme.js';

let on = false;
let pageId = HOME_PAGE_ID;

export function isEditing() { return on; }

/** Which layout a rendered page belongs to, so edits are saved to it. */
export function setEditPage(id) { pageId = id || HOME_PAGE_ID; }

export function toggleEditing(next) {
  on = next === undefined ? !on : !!next;
  document.body.classList.toggle('is-editing', on);
  const btn = document.getElementById('edit-page');
  if (btn) {
    btn.setAttribute('aria-pressed', String(on));
    btn.title = on ? 'Finish editing' : 'Edit this page';
  }
  if (on) attach(); else detach();
  return on;
}

/* --------------------------------------------------------------- text ---- */

function commitText(el) {
  const sec = el.closest('[data-sec]');
  const key = el.dataset.edit;
  if (!sec || !key) return;
  const value = richValue(el.innerHTML);
  layout.updateSection(pageId, sec.dataset.sec, { [key]: value })
    .catch(() => toast('Could not save that change.', 'bad'));
}

function onKeyDown(e) {
  const el = e.target.closest('[data-edit]');
  if (!el) return;
  if ((e.metaKey || e.ctrlKey) && /^[bi]$/i.test(e.key)) {
    e.preventDefault();
    document.execCommand(e.key.toLowerCase() === 'b' ? 'bold' : 'italic');
    commitText(el);
    return;
  }
  // A heading is one line; Enter should finish it, not split it in two.
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); el.blur(); }
  if (e.key === 'Escape') el.blur();
}

function onPaste(e) {
  if (!e.target.closest('[data-edit]')) return;
  e.preventDefault();
  const text = (e.clipboardData || window.clipboardData).getData('text/plain');
  document.execCommand('insertText', false, text);
}

function onBlur(e) {
  const el = e.target.closest('[data-edit]');
  if (el) commitText(el);
  // Moving into the toolbar is not leaving the text.
  setTimeout(() => {
    const a = document.activeElement;
    if (!a || (!a.closest('[data-edit]') && !a.closest('.type-bar'))) hideBar();
  }, 0);
}

function onFocusIn(e) {
  const el = e.target.closest('[data-edit]');
  if (el) showBar(el);
}

function onSelectionChange() {
  if (barFor && bar && !bar.hidden) paintBar(barFor);
}

/* ---------------------------------------------------------- type bar ----- */
//
// Styling where the words are. Bold and italic act on the selection; the rest
// — typeface, size, colour — belong to the role this text is drawn in, so
// changing them here is the same edit the panel would have made.

let bar = null;
let barFor = null;          // the element the bar is currently serving

function sectionOf(el) { return el.closest('[data-sec]'); }

function roleState(el) {
  const sec = sectionOf(el);
  const role = roleForKey(el.dataset.edit);
  if (!sec || !role) return null;
  const data = layout.getSection(pageId, sec.dataset.sec) || {};
  return { secId: sec.dataset.sec, role, data };
}

function setRole(el, patch) {
  const st = roleState(el);
  if (!st) return;
  layout.updateSection(pageId, st.secId, patch)
    .then(() => {
      // Show it at once rather than waiting for a re-render, which would take
      // the cursor out of the words being styled.
      applySectionVars(sectionOf(el), layout.getSection(pageId, st.secId));
      if (bar) { paintBar(el); placeBar(el); }
    })
    .catch(() => toast('Could not save that change.', 'bad'));
}

function buildBar() {
  const el = document.createElement('div');
  el.className = 'type-bar';
  el.setAttribute('role', 'toolbar');
  el.innerHTML = `
    <button type="button" data-tb="bold" title="Bold (⌘B)"><b>B</b></button>
    <button type="button" data-tb="italic" title="Italic (⌘I)"><i>I</i></button>
    <span class="tb-sep"></span>
    <button type="button" data-tb="smaller" title="Smaller">A&minus;</button>
    <button type="button" data-tb="bigger" title="Bigger">A+</button>
    <span class="tb-sep"></span>
    <select data-tb="face" title="Typeface" aria-label="Typeface"></select>
    <span class="tb-sep"></span>
    <label class="tb-ink" title="Colour">
      <span class="tb-dot"></span>
      <input type="color" data-tb="ink" aria-label="Text colour">
    </label>
    <button type="button" data-tb="reset" title="Back to the site's styling">⦸</button>`;

  // Built as nodes, not as a string: unclosed <optgroup> tags nest rather
  // than sit side by side, which silently swallowed most of the library.
  const sel = el.querySelector('[data-tb="face"]');
  const first = new Option('Match the site', '');
  sel.appendChild(first);
  let group = null;
  let holder = null;
  for (const f of FONT_STACKS) {
    if (f.group !== group) {
      group = f.group;
      holder = document.createElement('optgroup');
      holder.label = group;
      sel.appendChild(holder);
    }
    holder.appendChild(new Option(f.label, f.value));
  }

  el.addEventListener('mousedown', (e) => {
    // Keep the caret and selection while a button is pressed.
    if (e.target.tagName !== 'SELECT' && e.target.type !== 'color') e.preventDefault();
  });

  el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-tb]');
    if (!b || b.tagName === 'SELECT' || b.type === 'color' || !barFor) return;
    const act = b.dataset.tb;
    const st = roleState(barFor);

    if (act === 'bold' || act === 'italic') {
      document.execCommand(act);
      commitText(barFor);
      paintBar(barFor);
      return;
    }
    if (!st) return;
    const { role, data } = st;
    if (act === 'smaller' || act === 'bigger') {
      const now = Number(data[role.size]) || 1;
      const next = Math.max(0.6, Math.min(1.8,
        +(now + (act === 'bigger' ? 0.05 : -0.05)).toFixed(2)));
      setRole(barFor, { [role.size]: String(next) });
      return;
    }
    if (act === 'reset') {
      const blank = {};
      [role.font, role.ink, role.weight, role.italic, role.size, role.track, role.transform]
        .filter(Boolean).forEach((k) => { blank[k] = ''; });
      setRole(barFor, blank);
    }
  });

  sel.addEventListener('change', () => {
    if (!barFor) return;
    const st = roleState(barFor);
    if (st) setRole(barFor, { [st.role.font]: sel.value });
  });

  el.querySelector('[data-tb="ink"]').addEventListener('input', (e) => {
    if (!barFor) return;
    const st = roleState(barFor);
    if (st) setRole(barFor, { [st.role.ink]: e.target.value });
  });

  document.body.appendChild(el);
  return el;
}

function paintBar(el) {
  const st = roleState(el);
  const sel = bar.querySelector('[data-tb="face"]');
  const dot = bar.querySelector('.tb-dot');
  const ink = bar.querySelector('[data-tb="ink"]');
  const face = st ? String(st.data[st.role.font] || '') : '';

  sel.value = face;
  const colour = st ? String(st.data[st.role.ink] || '') : '';
  dot.style.background = colour || 'transparent';
  dot.classList.toggle('is-auto', !colour);
  if (colour) ink.value = colour;

  // A family without a true italic must not offer one.
  const it = bar.querySelector('[data-tb="italic"]');
  it.disabled = !fontHasItalic(face);
  it.title = it.disabled ? 'This typeface has no italic' : 'Italic (⌘I)';

  bar.querySelector('[data-tb="bold"]').classList
    .toggle('is-on', document.queryCommandState && document.queryCommandState('bold'));
  it.classList.toggle('is-on', !it.disabled && document.queryCommandState
    && document.queryCommandState('italic'));

  // Only offered where the text belongs to a role we can style.
  bar.querySelectorAll('[data-tb="smaller"],[data-tb="bigger"],[data-tb="face"],[data-tb="reset"]')
    .forEach((n) => { n.disabled = !st; });
  bar.querySelector('.tb-ink').classList.toggle('is-off', !st);
}

function placeBar(el) {
  const r = el.getBoundingClientRect();
  const b = bar.getBoundingClientRect();
  const left = Math.max(8, Math.min(window.innerWidth - b.width - 8, r.left));
  // Above the text where there is room, below it when there is not.
  const above = r.top - b.height - 10;
  bar.style.left = `${Math.round(left)}px`;
  bar.style.top = `${Math.round(above > 70 ? above : r.bottom + 10)}px`;
}

function showBar(el) {
  if (!bar) bar = buildBar();
  barFor = el;
  bar.hidden = false;
  paintBar(el);
  placeBar(el);
}

function hideBar() {
  if (bar) bar.hidden = true;
  barFor = null;
}

/* ------------------------------------------------------------ sections --- */

function addSectionTools(root) {
  root.querySelectorAll('[data-sec]').forEach((sec) => {
    if (sec.querySelector(':scope > .edit-tools')) return;
    const tools = document.createElement('div');
    tools.className = 'edit-tools';
    tools.innerHTML = '<button type="button" class="edit-chip" data-edit-open>Settings</button>';
    tools.querySelector('[data-edit-open]').onclick = (e) => {
      e.preventDefault();
      openSectionEditor(pageId, sec.dataset.sec);
    };
    sec.appendChild(tools);
  });
}

function attach() {
  const root = document.getElementById('app');
  if (!root) return;
  root.querySelectorAll('[data-edit]').forEach((el) => {
    el.setAttribute('contenteditable', 'true');
    el.setAttribute('spellcheck', 'true');
  });
  addSectionTools(root);
  root.addEventListener('keydown', onKeyDown);
  root.addEventListener('paste', onPaste);
  root.addEventListener('focusout', onBlur);
  root.addEventListener('focusin', onFocusIn);
  document.addEventListener('selectionchange', onSelectionChange);
  window.addEventListener('scroll', onScroll, true);
  window.addEventListener('resize', onScroll);
}

function onScroll() { if (barFor && bar && !bar.hidden) placeBar(barFor); }

function detach() {
  const root = document.getElementById('app');
  if (!root) return;
  root.querySelectorAll('[data-edit]').forEach((el) => {
    el.removeAttribute('contenteditable');
    el.removeAttribute('spellcheck');
  });
  root.querySelectorAll('.edit-tools').forEach((n) => n.remove());
  root.removeEventListener('keydown', onKeyDown);
  root.removeEventListener('paste', onPaste);
  root.removeEventListener('focusout', onBlur);
  root.removeEventListener('focusin', onFocusIn);
  document.removeEventListener('selectionchange', onSelectionChange);
  window.removeEventListener('scroll', onScroll, true);
  window.removeEventListener('resize', onScroll);
  hideBar();
}

/** Re-apply after a re-render, since the DOM it decorated has been replaced. */
export function refreshEditing() {
  if (!on) return;
  detach();
  attach();
}
