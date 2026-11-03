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

export function plural(n, one, many) {
  return `${n} ${n === 1 ? one : (many || one + 's')}`;
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

let sheetCloser = null;

export function openSheet(innerHtml, { onMount } = {}) {
  const host = document.getElementById('sheet-host');
  if (!host) return () => {};
  host.innerHTML = `<div class="sheet" role="dialog" aria-modal="true">${innerHtml}</div>`;
  host.hidden = false;
  document.body.style.overflow = 'hidden';

  const close = () => {
    host.hidden = true;
    host.innerHTML = '';
    document.body.style.overflow = '';
    sheetCloser = null;
    document.removeEventListener('keydown', onKey);
  };
  function onKey(e) { if (e.key === 'Escape') close(); }
  document.addEventListener('keydown', onKey);

  host.onclick = (e) => { if (e.target === host) close(); };
  host.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', close));
  sheetCloser = close;
  if (onMount) onMount(host.querySelector('.sheet'), close);
  return close;
}

export function closeSheet() {
  if (sheetCloser) sheetCloser();
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

const BM_COLORS = [
  ['#8c5a3c', '#e8d4bf'], ['#45614f', '#dceadf'], ['#5b4a72', '#e2daee'],
  ['#1f4f63', '#d4e6ee'], ['#7a3f45', '#eed9db'], ['#6b6230', '#eae6cc'],
  ['#2f5b5b', '#d7e9e7'], ['#7b4a2a', '#eeddcb'], ['#3f4a6b', '#dbe0ef'],
  ['#6b3a5c', '#eed9e8'],
];

function hashCode(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

/**
 * A deterministic little bookmark graphic per bookmark id, so an unlocked
 * bookmark looks like a specific collectible even before you photograph it.
 */
export function bookmarkArt(id, { bonus = false } = {}) {
  const h = hashCode(String(id));
  const [dark, light] = BM_COLORS[h % BM_COLORS.length];
  const motif = Math.floor(h / 7) % 4;
  const shape = 'M3 3 H57 V93 L30 79 L3 93 Z';

  let pattern = '';
  if (motif === 0) {
    pattern = [20, 34, 48].map((y) => `<rect x="12" y="${y}" width="36" height="3.4" rx="1.7" fill="${light}" opacity=".85"/>`).join('');
  } else if (motif === 1) {
    pattern = [0, 1, 2].map((r) => [0, 1, 2].map((c) =>
      `<circle cx="${18 + c * 12}" cy="${24 + r * 14}" r="3.4" fill="${light}" opacity=".85"/>`).join('')).join('');
  } else if (motif === 2) {
    pattern = [22, 38, 54].map((y) => `<path d="M13 ${y + 8} L30 ${y} L47 ${y + 8}" fill="none" stroke="${light}" stroke-width="3" stroke-linecap="round" opacity=".85"/>`).join('');
  } else {
    pattern = `<rect x="11" y="22" width="38" height="40" rx="4" fill="none" stroke="${light}" stroke-width="3" opacity=".8"/>
               <circle cx="30" cy="42" r="7" fill="${light}" opacity=".85"/>`;
  }

  const gilt = bonus
    ? `<path d="${shape}" fill="none" stroke="#d9ab52" stroke-width="3"/>
       <path d="M30 10 l2.6 5.4 5.9.8-4.3 4.1 1 5.9-5.2-2.8-5.2 2.8 1-5.9-4.3-4.1 5.9-.8z" fill="#d9ab52"/>`
    : '';

  return `<svg class="bm-art" viewBox="0 0 60 100" role="img" aria-label="Bookmark artwork" preserveAspectRatio="xMidYMid meet">
    <path d="${shape}" fill="${dark}"/>
    <g transform="${bonus ? 'translate(0,8) scale(1,0.9)' : ''}">${pattern}</g>
    ${gilt}
  </svg>`;
}

/**
 * The single way a bookmark is drawn anywhere in the app: your photo if there
 * is one, otherwise the generated artwork, otherwise the locked outline.
 * A photo that fails to decode falls back to the artwork (see initArtFallback).
 */
export function markVisual(id, { bonus = false, unlocked = true, dataUrl = null } = {}) {
  if (!unlocked) return lockedArt();
  if (dataUrl) {
    return `<img class="bm-photo" src="${attr(dataUrl)}" alt=""
            data-bm-id="${attr(id)}" data-bm-bonus="${bonus ? '1' : ''}">`;
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
    const span = document.createElement('span');
    span.innerHTML = bookmarkArt(id, { bonus: !!el.dataset.bmBonus });
    const svg = span.firstElementChild;
    if (svg) el.replaceWith(svg);
  }, true);
}

export function lockedArt() {
  return `<svg class="bm-art" viewBox="0 0 60 100" role="img" aria-label="Locked bookmark" preserveAspectRatio="xMidYMid meet">
    <path d="M3 3 H57 V93 L30 79 L3 93 Z" fill="none" stroke="currentColor" stroke-width="2.5" stroke-dasharray="6 5" opacity=".55"/>
    <path d="M24 46 v-5 a6 6 0 0 1 12 0 v5" fill="none" stroke="currentColor" stroke-width="2.5" opacity=".55"/>
    <rect x="21" y="46" width="18" height="14" rx="3" fill="none" stroke="currentColor" stroke-width="2.5" opacity=".55"/>
  </svg>`;
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

export function progressBar(pct, { done = false } = {}) {
  const width = Math.max(0, Math.min(100, pct));
  const over = pct > 100;
  return `<div class="bar${done || over ? ' done' : ''}">
    <div class="bar-fill" style="width:${width}%"></div>
    ${over ? '<div class="bar-over" style="left:100%"></div>' : ''}
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
      app.innerHTML = `<div class="empty"><h3>Nothing here</h3><p>That page does not exist.</p>
        <a class="btn btn-primary" href="#/">Back to home</a></div>`;
      setChrome({ title: 'Shelf Marks', back: false, actions: '', fab: false });
      return;
    }

    const previousPath = current ? current.path : null;
    const view = match.route.handler({ ...match.params, query }) || {};
    current = { path, view, params: match.params, query };

    app.innerHTML = view.html || '';
    setChrome(view);
    highlightTab(view.tab);
    // keepScroll only holds position across re-renders of the same screen;
    // arriving at a different screen always starts at the top.
    if (!view.keepScroll || path !== previousPath) window.scrollTo(0, 0);
    app.querySelectorAll('[data-nav]').forEach((node) => {
      node.addEventListener('click', (e) => {
        e.preventDefault();
        navigate(node.getAttribute('data-nav'));
      });
    });
    if (typeof view.onMount === 'function') view.onMount(app);
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
  const title = document.getElementById('appbar-title');
  const backBtn = document.getElementById('appbar-back');
  const actions = document.getElementById('appbar-actions');
  const fab = document.getElementById('fab');
  if (title) title.textContent = view.title || 'Shelf Marks';
  if (backBtn) backBtn.hidden = !view.back;
  if (actions) {
    actions.innerHTML = view.actions || '';
    actions.querySelectorAll('[data-nav]').forEach((node) => {
      node.addEventListener('click', (e) => {
        e.preventDefault();
        navigate(node.getAttribute('data-nav'));
      });
    });
  }
  if (fab) fab.hidden = !view.fab;
  document.title = view.title && view.title !== 'Shelf Marks'
    ? `${view.title} · Shelf Marks` : 'Shelf Marks';
}

function highlightTab(tab) {
  document.querySelectorAll('.tab').forEach((a) => {
    if (a.dataset.tab === tab) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
}

export function startRouter() {
  window.addEventListener('hashchange', render);
  const backBtn = document.getElementById('appbar-back');
  if (backBtn) backBtn.addEventListener('click', back);
  render();
}
