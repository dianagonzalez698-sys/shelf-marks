// UI plumbing: escaping, toasts, bottom sheets, the hash router, and the
// generated bookmark artwork.

export function esc(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function attr(value) {
  return esc(value);
}

/* --------------------------------------------------------------- toasts ---- */

export function toast(message, kind = '', ms = 3200) {
  const host = document.getElementById('toasts');
  if (!host) return;
  const div = document.createElement('div');
  div.className = `toast ${kind}`.trim();
  div.innerHTML = message;
  host.appendChild(div);
  setTimeout(() => {
    div.style.transition = 'opacity .25s ease';
    div.style.opacity = '0';
    setTimeout(() => div.remove(), 280);
  }, ms);
}

/* --------------------------------------------------------------- sheets ---- */


// Sheets stack.
//
// Editing a picture from inside a section's panel used to replace that panel,
// so closing the picture dropped you back at the page and you had to find your
// way in again. A sheet now opens on top of the one below it and closing
// returns you there — Cancel, Done, Escape and the backdrop all mean "back",
// and a nested sheet shows a Back control saying so.
let sheetStack = [];

function onSheetKey(e) { if (e.key === 'Escape') popSheet(); }

function paintSheet() {
  const host = document.getElementById('sheet-host');
  if (!host) return;
  const top = sheetStack[sheetStack.length - 1];

  if (!top) {
    host.hidden = true;
    host.innerHTML = '';
    host.onclick = null;
    document.body.style.overflow = '';
    document.removeEventListener('keydown', onSheetKey);
    return;
  }

  // A sheet returned to is rebuilt when it knows how, so it shows what changed
  // underneath it rather than the snapshot it was opened with.
  const html = typeof top.reopen === 'function' ? top.reopen() : top.innerHtml;
  const nested = sheetStack.length > 1;

  // Every panel carries its own way out, at the top where a back control
  // belongs. Nested, it returns to the panel underneath; outermost, it closes
  // — so the masthead's chevron is never the only way back out of settings.
  host.innerHTML = `<div class="sheet" role="dialog" aria-modal="true">`
    + `<button class="sheet-back" type="button" data-sheet-back>`
    + `&larr; ${nested ? 'Back' : 'Done'}</button>`
    + `${html}</div>`;
  host.hidden = false;
  document.body.style.overflow = 'hidden';

  const sheet = host.querySelector('.sheet');
  sheet.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', popSheet));
  const back = sheet.querySelector('[data-sheet-back]');
  if (back) back.onclick = popSheet;
  host.onclick = (e) => { if (e.target === host) popSheet(); };
  document.addEventListener('keydown', onSheetKey);

  if (top.onMount) top.onMount(sheet, popSheet);
}

function popSheet() {
  sheetStack.pop();
  paintSheet();
}

/* ------------------------------------------------------------ rich text --- */
//
// Displayed text may carry emphasis on a word or phrase. Only bold, italic and
// a line break survive: everything else — tags, attributes, URLs, scripts — is
// escaped to plain text. Sanitising happens at *render* time rather than only
// on save, because a backup file is editable and arrives from outside.

const RICH_OK = { B: 'b', STRONG: 'b', I: 'i', EM: 'i', BR: 'br' };

function cleanRich(root, out) {
  for (const node of root.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      out.appendChild(document.createTextNode(node.nodeValue));
      continue;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) continue;
    const keep = RICH_OK[node.tagName];
    if (!keep) {                      // unknown element: keep its words, drop it
      cleanRich(node, out);
      continue;
    }
    const el = document.createElement(keep);   // rebuilt, so no attributes carry
    if (keep !== 'br') cleanRich(node, el);
    out.appendChild(el);
  }
}

/** A stored string rendered as safe inline HTML. */
export function rich(value) {
  const raw = String(value == null ? '' : value);
  if (!raw) return '';
  if (!/[<&]/.test(raw)) return esc(raw);     // plain text, the common case
  const doc = new DOMParser().parseFromString(`<body>${raw}</body>`, 'text/html');
  const frag = document.createElement('div');
  cleanRich(doc.body, frag);
  return frag.innerHTML;
}

/** The same cleaning, for storing what a contenteditable produced. */
export function richValue(html) {
  const doc = new DOMParser().parseFromString(`<body>${String(html || '')}</body>`, 'text/html');
  const frag = document.createElement('div');
  cleanRich(doc.body, frag);
  const out = frag.innerHTML.replace(/(<br>)+$/, '').trim();
  return /^(<b><\/b>|<i><\/i>|\s)*$/.test(out) ? '' : out;
}

/** Plain text of a rich string, for titles and other attribute contexts. */
export function richPlain(value) {
  const doc = new DOMParser().parseFromString(`<body>${String(value || '')}</body>`, 'text/html');
  return doc.body.textContent || '';
}

export function openSheet(innerHtml, { onMount, reopen } = {}) {
  const host = document.getElementById('sheet-host');
  if (!host) return () => {};
  sheetStack.push({ innerHtml, onMount, reopen });
  paintSheet();
  return popSheet;
}

/** Dismiss every open sheet — used when the page itself changes. */
export function closeSheet() {
  if (!sheetStack.length) return;
  sheetStack = [];
  paintSheet();
}


export function confirmSheet({ title, body = '', confirm = 'Confirm', danger = false }) {
  return new Promise((resolve) => {
    openSheet(`
      <h2>${esc(title)}</h2>
      ${body ? `<p class="muted small">${body}</p>` : ''}
      <div class="btn-row" style="margin-top:1rem">
        <button class="btn grow" type="button" data-act="cancel">Cancel</button>
        <button class="btn grow ${danger ? 'btn-danger' : 'btn-primary'}" type="button" data-act="ok">${esc(confirm)}</button>
      </div>
    `, {
      onMount(sheet, close) {
        sheet.querySelector('[data-act="cancel"]').onclick = () => { close(); resolve(false); };
        sheet.querySelector('[data-act="ok"]').onclick = () => { close(); resolve(true); };
      },
    });
  });
}

/* ------------------------------------------------------- bookmark artwork -- */

const VARIANT_COUNT = 6;
const MOTIF_COUNT = 6;

function hashCode(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

// A small four-pointed star, drawn in its own element so it never distorts
// when the bookmark ratio changes.
const STAR = `<svg class="bm-glyph" viewBox="0 0 24 24" aria-hidden="true">
  <path d="M12 2.6c.7 5 1.7 6 6.7 6.7-5 .7-6 1.7-6.7 6.7-.7-5-1.7-6-6.7-6.7 5-.7 6-1.7 6.7-6.7z"/></svg>`;

const CORD = `<svg class="bm-cord" viewBox="0 0 40 44" aria-hidden="true" preserveAspectRatio="xMidYMax meet">
  <path d="M20 43 C 7 33, 7 11, 20 5 C 33 11, 33 33, 20 43"
        fill="none" stroke-width="2.6" vector-effect="non-scaling-stroke"/></svg>`;

/**
 * The bookmark body. Drawn in a 100x340 viewBox with
 * preserveAspectRatio="none", so it fills whatever --bm-ratio is set to.
 * Every shape is a rectangle or a straight rule, which stretch predictably;
 * anything that must keep its shape (the star, the cord) lives outside it.
 */
function bookmarkBody(motif) {
  const ground = '<rect class="bm-ground" x="0" y="0" width="100" height="340"/>';
  const frame = (inset) => `<rect class="bm-ink-stroke" x="${inset}" y="${inset}"
      width="${100 - inset * 2}" height="${340 - inset * 2}" fill="none"
      stroke-width="2" vector-effect="non-scaling-stroke"/>`;

  switch (motif) {
    case 0: // vertical stripes
      return ground + [12, 42, 72].map((x) =>
        `<rect class="bm-ink" x="${x}" y="0" width="16" height="340"/>`).join('');
    case 1: // solid with an inset rule, like a gilt-edged binding
      return ground + frame(9) + frame(14);
    case 2: // colour-blocked landscape
      return ground
        + '<rect class="bm-ink" x="0" y="0" width="100" height="128" opacity=".55"/>'
        + '<rect class="bm-ink" x="0" y="196" width="100" height="62"/>'
        + '<rect class="bm-ink" x="0" y="286" width="100" height="54" opacity=".4"/>';
    case 3: // ruled paper
      return ground + [70, 116, 162, 208, 254].map((y) =>
        `<rect class="bm-ink" x="20" y="${y}" width="60" height="5"/>`).join('');
    case 4: // half block with a horizon rule
      return ground
        + '<rect class="bm-ink" x="0" y="206" width="100" height="134" opacity=".75"/>'
        + '<rect class="bm-ink" x="0" y="198" width="100" height="4"/>';
    default: // broad bands
      return ground
        + '<rect class="bm-ink" x="0" y="54" width="100" height="26" opacity=".8"/>'
        + '<rect class="bm-ink" x="0" y="252" width="100" height="26" opacity=".8"/>';
  }
}

/**
 * A collected bookmark. The colourway and motif are derived from the id, so a
 * given bookmark always looks the same — it reads as a specific object you own.
 */
export function bookmarkArt(id, { bonus = false } = {}) {
  const h = hashCode(String(id));
  const variant = (h % VARIANT_COUNT) + 1;
  const motif = bonus ? 1 : Math.floor(h / 7) % MOTIF_COUNT;
  return `<span class="bm-art bm-v${variant}${bonus ? ' bm-bonus' : ''}">
    ${CORD}
    <span class="bm-body-wrap">
      <svg class="bm-body" viewBox="0 0 100 340" preserveAspectRatio="none" role="img"
           aria-label="Collected bookmark">${bookmarkBody(motif)}</svg>
      ${bonus ? STAR : ''}
    </span>
  </span>`;
}

/** An uncollected bookmark: outline only, with a small star. */
export function lockedArt() {
  return `<span class="bm-art bm-empty">
    ${CORD}
    <span class="bm-body-wrap">
      <svg class="bm-body" viewBox="0 0 100 340" preserveAspectRatio="none" role="img"
           aria-label="Uncollected bookmark">
        <rect class="bm-ground" x="0" y="0" width="100" height="340"/>
        <rect class="bm-frame" x="5" y="5" width="90" height="330" fill="none"
              stroke-width="2" vector-effect="non-scaling-stroke"/>
        <rect class="bm-frame" x="11" y="11" width="78" height="318" fill="none"
              stroke-width="1" vector-effect="non-scaling-stroke"/>
      </svg>
      ${STAR}
    </span>
  </span>`;
}

const CHECK = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"
  fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

export function checkBadge() {
  return `<span class="bm-check">${CHECK}</span>`;
}

export function checkGlyph() {
  return CHECK;
}

/**
 * The single way a bookmark is drawn anywhere in the app: your photo if there
 * is one, otherwise the generated artwork, otherwise the uncollected outline.
 * A photo that fails to decode falls back to the artwork (see initArtFallback).
 */
export function markVisual(id, { bonus = false, unlocked = true, dataUrl = null } = {}) {
  if (!unlocked) return lockedArt();
  if (dataUrl) {
    return `<span class="bm-art bm-has-photo">
      ${CORD}
      <span class="bm-body-wrap">
        <img class="bm-photo" src="${attr(dataUrl)}" alt=""
             data-bm-id="${attr(id)}" data-bm-bonus="${bonus ? '1' : ''}">
      </span>
    </span>`;
  }
  return bookmarkArt(id, { bonus });
}

// `error` does not bubble, so listen in the capture phase for the whole app.
export function initArtFallback() {
  document.addEventListener('error', (event) => {
    const el = event.target;
    if (!el || el.tagName !== 'IMG' || !el.classList.contains('bm-photo')) return;
    const id = el.dataset.bmId;
    if (!id) return;
    const host = el.closest('.bm-art');
    const span = document.createElement('span');
    span.innerHTML = bookmarkArt(id, { bonus: !!el.dataset.bmBonus });
    const replacement = span.firstElementChild;
    if (host && replacement) host.replaceWith(replacement);
  }, true);
}

/* ------------------------------------------------------------ cover art ---- */

export function coverImg(book, { big = false, lazy = true } = {}) {
  const cls = `cover${big ? ' cover-lg' : ''}`;
  const initial = (book.title || '?').trim().slice(0, 1) || '?';
  if (book.coverUrl) {
    // If the cover 404s, swap in the initial rather than leaving a blank box.
    return `<img class="${cls}" src="${attr(book.coverUrl)}" alt=""
            ${lazy ? 'loading="lazy"' : ''} decoding="async"
            onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'${cls} cover-ph',textContent:'${attr(initial)}'}))">`;
  }
  return `<div class="${cls} cover-ph">${esc(initial)}</div>`;
}

/* ------------------------------------------------------------- progress ---- */

export function progressBar(pct, { done = false, tone = '' } = {}) {
  const width = Math.max(0, Math.min(100, pct));
  return `<div class="bar${done ? ' done' : ''}${tone ? ` bar-${tone}` : ''}" role="img" aria-label="${pct}% complete">
    <div class="bar-fill" style="width:${width}%"></div>
  </div>`;
}

/** The reference's inline progress row: caption — hairline bar — percentage. */
export function progressLine(label, pct, { done = false, tone = '' } = {}) {
  return `<div class="progress-line">
    <span class="progress-label">${esc(label)}</span>
    ${progressBar(pct, { done, tone })}
    <span class="progress-pct">${pct}%</span>
  </div>`;
}

/* --------------------------------------------------------------- router ---- */

const routes = [];
let current = null;
let rendering = false;

export function route(pattern, handler) {
  // '/book/:id' -> regex with named groups
  const names = [];
  const rx = new RegExp('^' + pattern.replace(/:[a-zA-Z]+/g, (m) => {
    names.push(m.slice(1));
    return '([^/]+)';
  }) + '$');
  routes.push({ rx, names, handler, pattern });
}

function parseHash() {
  const raw = (location.hash || '#/').replace(/^#/, '');
  const [path, queryString] = raw.split('?');
  const query = {};
  new URLSearchParams(queryString || '').forEach((v, k) => { query[k] = v; });
  return { path: path || '/', query };
}

export function navigate(path, { replace = false } = {}) {
  const target = path.startsWith('#') ? path : `#${path}`;
  if (replace) {
    history.replaceState(null, '', target);
    render();
  } else if (location.hash === target) {
    render();
  } else {
    location.hash = target;
  }
}

export function back() {
  if (history.length > 1) history.back();
  else navigate('/');
}

export function currentRoute() {
  return current;
}

// Set by app.js once edit-page.js is loaded, so ui.js need not import it and
// create a cycle between the router and the editor.
let setEditPageId = () => {};
let stopEditing = () => {};
let refreshEditLayer = () => {};
let startEditing = () => {};
export function wireEditing(setPage, stop, refreshLayer = () => {}, start = () => {}) {
  setEditPageId = setPage; stopEditing = stop; refreshEditLayer = refreshLayer;
  startEditing = start;
}

export function render() {
  if (rendering) return;
  rendering = true;
  try {
    const { path, query } = parseHash();
    const match = routes.map((r) => {
      const m = r.rx.exec(path);
      if (!m) return null;
      const params = {};
      r.names.forEach((n, i) => { params[n] = decodeURIComponent(m[i + 1]); });
      return { route: r, params };
    }).find(Boolean);

    const app = document.getElementById('app');
    if (!match) {
      current = null;
      app.innerHTML = `<div class="empty"><h3>Nothing on this page</h3>
        <p>That address isn't part of the journal.</p>
        <a class="btn" href="#/">Back to the journal</a></div>`;
      setChrome({ title: '', back: false, actions: '', fab: false, banner: false });
      highlightTab(null);
      return;
    }

    const previousPath = current ? current.path : null;
    const view = match.route.handler({ ...match.params, query }) || {};
    current = { path, view, params: match.params, query };

    app.innerHTML = view.html || '';
    setChrome(view);

    // The pencil only appears where the page is built from a layout, and it
    // has to know which layout so an edit lands on the right page.
    const editBtn = document.getElementById('edit-page');
    if (editBtn) {
      const pageId = view.editPage || null;
      editBtn.hidden = !pageId;
      if (pageId) setEditPageId(pageId);
      else if (document.body.classList.contains('is-editing')) stopEditing();
    }
    highlightTab(view.tab);
    // keepScroll only holds position across re-renders of the same screen;
    // arriving at a different screen always starts at the top.
    if (!view.keepScroll || path !== previousPath) window.scrollTo(0, 0);
    // Moving to a different screen dismisses any open sheet; a re-render of
    // the same screen leaves it alone, so saving from inside one is safe.
    if (path !== previousPath) closeSheet();
    app.querySelectorAll('[data-nav]').forEach((node) => {
      node.addEventListener('click', (e) => {
        e.preventDefault();
        navigate(node.getAttribute('data-nav'));
      });
    });
    if (typeof view.onMount === 'function') view.onMount(app);
    refreshEditLayer();
    if (query.design === '1' && path !== previousPath && view.editPage) startEditing();
  } finally {
    rendering = false;
  }
}

// Re-render the live view after a state change, leaving form views alone.
export function refresh() {
  if (!current) { render(); return; }
  if (current.view && current.view.live === false) {
    if (typeof current.view.onStateChange === 'function') current.view.onStateChange();
    return;
  }
  render();
}

function setChrome(view) {
  const app = document.getElementById('app');
  // Editorial pages drop the content gutter so sections can bleed full width.
  if (app) app.classList.toggle('is-editorial', !!view.editorial);
  const backBtn = document.getElementById('appbar-back');
  const actions = document.getElementById('appbar-actions');
  const fab = document.getElementById('fab');
  const banner = document.getElementById('editorial-banner');

  if (backBtn) backBtn.hidden = !view.back;
  if (banner) banner.hidden = !view.banner;
  if (fab) fab.hidden = !view.fab;

  if (actions) {
    actions.innerHTML = view.actions || '';
    actions.querySelectorAll('[data-nav]').forEach((node) => {
      node.addEventListener('click', (e) => {
        e.preventDefault();
        navigate(node.getAttribute('data-nav'));
      });
    });
  }

  const site = document.documentElement.dataset.siteName || "Diana's Lit Picks";
  document.title = view.title ? `${view.title} · ${site}` : site;
}

// Both the desktop masthead links and the phone tab bar mark the same section.
function highlightTab(tab) {
  document.querySelectorAll('.tab, .masthead-link').forEach((a) => {
    if (tab && a.dataset.tab === tab) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
}

export function startRouter() {
  window.addEventListener('hashchange', render);
  const backBtn = document.getElementById('appbar-back');
  if (backBtn) backBtn.addEventListener('click', back);
  render();
}
