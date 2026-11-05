// Bootstrap: wire routes, load the database, start the router.

import { load, onChange, state } from './state.js';
import * as theme from './theme.js';
import * as assets from './assets.js';
import * as layout from './layout.js';
import { installOrnateFrame } from './frames.js';
import { route, startRouter, refresh, navigate, initArtFallback } from './ui.js';
import { homeView } from './view-home.js';
import { booksView } from './view-books.js';
import { addView, bookFormView } from './view-book.js';
import { challengesView, challengeDetailView } from './view-challenges.js';
import { bookmarksView } from './view-bookmarks.js';
import { settingsView } from './view-settings.js';
import { customizeView } from './view-customize.js';
import { assetsView } from './view-assets.js';
import { layoutView } from './view-layout.js';

route('/', homeView);
route('/books', booksView);
route('/add', addView);
route('/new', bookFormView);
route('/book/:id', bookFormView);
route('/challenges', challengesView);
route('/challenge/:id', challengeDetailView);
route('/bookmarks', bookmarksView);
route('/settings', settingsView);
route('/customize', customizeView);
route('/assets', assetsView);
route('/layout', layoutView);

function paintStorageBanner() {
  const banner = document.getElementById('storage-banner');
  if (!banner) return;
  if (!state.storageError) {
    banner.hidden = true;
    return;
  }
  banner.hidden = false;
  banner.textContent = state.storageError.message;
}

async function boot() {
  initArtFallback();

  try {
    await load();
  } catch (_) {
    // load() already routed the failure through the storage-error banner;
    // the app still runs, just without persistence.
  }

  // The design layer sits on top of the data layer: it needs the challenge
  // year so {year} in the banner wording resolves.
  try {
    await theme.load(state.settings.year);
  } catch (_) {
    // Defaults from the stylesheet are a perfectly good fallback.
  }

  // Your pictures and your page arrangements. Both fall back to sensible
  // defaults, so a failure here costs decoration, never data.
  try {
    await Promise.all([assets.load(), layout.load()]);
  } catch (_) { /* default layouts and empty library still render */ }

  // Pictures added before transparency was recorded get the flag filled in,
  // then the page redraws so any auto edge mode settles on the right one.
  assets.backfillAlpha()
    .then((n) => { if (n) refresh(); })
    .catch(() => {});

  onChange(() => {
    paintStorageBanner();
    theme.applyContent(state.settings.year);
    refresh();
  });

  theme.onThemeChange(() => {
    theme.applyContent(state.settings.year);
    paintModeToggle();
    // The carved frame is generated from the gilt tokens, so it re-tints too.
    installOrnateFrame();
  });

  // Light/dark has to be reachable in one tap. It lived only in the Design
  // Studio, which is three taps deep — on a phone set to dark, following the
  // device read as being stuck in it with no way out.
  const modeBtn = document.getElementById('mode-toggle');
  function paintModeToggle() {
    if (!modeBtn) return;
    const dark = theme.resolvedMode() === 'dark';
    modeBtn.dataset.mode = dark ? 'dark' : 'light';
    modeBtn.setAttribute('aria-pressed', String(dark));
    modeBtn.title = dark ? 'Switch to light' : 'Switch to dark';
  }
  if (modeBtn) {
    // Always land on an explicit choice, so one tap settles it even when the
    // journal was following the device.
    modeBtn.onclick = () => theme.setMode(theme.resolvedMode() === 'dark' ? 'light' : 'dark');
  }
  paintModeToggle();

  installOrnateFrame();

  paintStorageBanner();
  if (!location.hash) navigate('/', { replace: true });
  startRouter();

  if ('serviceWorker' in navigator) {
    // Register after first paint so a stale worker can never block startup —
    // but boot() awaits the database first, so `load` has often already fired
    // by now and a plain listener would never run.
    const register = () => {
      navigator.serviceWorker.register('./sw.js').catch(() => {
        /* offline support is a bonus, not a requirement */
      });
    };
    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register, { once: true });
  }
}

boot();
