// Bootstrap: wire routes, load the database, start the router.

import { load, onChange, saveSettings, state } from './state.js';
import * as theme from './theme.js';
import * as assets from './assets.js';
import * as layout from './layout.js';
import * as canvas from './canvas.js?v=128';
import * as notebook from './notebook.js';
import { installOrnateFrame } from './frames.js';
import { route, startRouter, refresh, navigate, initArtFallback } from './ui.js';
import * as navigationUI from './ui.js';
import { homeView } from './view-home.js?v=126';
import { booksView } from './view-books.js';
import { addView, bookFormView, rememberAddOrigin } from './view-book.js?v=121';
import { bookDetailView } from './view-book-detail.js';
import { challengesView, challengeDetailView } from './view-challenges.js?v=126';
import { bookmarksView } from './view-bookmarks.js?v=121';
import { settingsView } from './view-settings.js';
import { customizeView } from './view-customize.js';
import { assetsView } from './view-assets.js';
import { layoutView } from './view-layout.js?v=129';
import { wordsView, wordDetailView } from './view-words.js';
import { notebookView, notebookEntryView } from './view-notebook.js';
import { collectionsView } from './view-collections.js';
import { toggleEditing, isEditing, setEditPage, refreshEditing } from './edit-page.js?v=95';
import { wireEditing } from './ui.js';

// The navigation uses the same saved banner heading as each challenge page.
navigationUI.setChallengeMenuTitleResolver?.((challenge) => {
  const hero = layout.get(`challenge:${challenge.id}`)
    .find((section) => section.type === 'challengeHero' && section.visible !== false);
  return hero?.titleText || challenge.name;
});

route('/', homeView);
route('/books', booksView);
route('/add', addView);
route('/new', bookFormView);
route('/book/:id', bookDetailView);
route('/book/:id/edit', bookFormView);
// Old deep links now land on the combined writing-and-decoration page.
route('/book/:id/journal', bookDetailView);
route('/challenges', challengesView);
route('/challenge/:id', challengeDetailView);
route('/bookmarks', bookmarksView);
route('/settings', settingsView);
route('/customize', customizeView);
route('/assets', assetsView);
route('/layout', layoutView);
route('/words', wordsView);
route('/word/:id', wordDetailView);
route('/notebook', notebookView);
route('/notebook/:id', notebookEntryView);
route('/collections', collectionsView);

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
    await Promise.all([assets.load(), layout.load(), canvas.load(), notebook.load()]);
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

  // Editing happens on the page; the button only appears where there is a
  // layout to edit, so it never offers to edit a form or the settings screen.
  wireEditing(setEditPage, () => toggleEditing(false), refreshEditing, () => toggleEditing(true));
  const editBtn = document.getElementById('edit-page');
  if (editBtn) editBtn.onclick = () => toggleEditing();

  onChange(() => { if (isEditing()) refreshEditing(); });

  document.addEventListener('click', (event) => {
    const addLink = event.target.closest('a[href^="#/add"]');
    if (addLink) rememberAddOrigin(location.hash || '#/', window.scrollY);
  });

  // The journal's period circles are actual checkboxes, independent of the
  // Details links. Keep manual checks separate from book-derived rewards.
  document.getElementById('app')?.addEventListener('click', async (event) => {
    const check = event.target.closest('[data-period-check]');
    if (!check || check.disabled) return;
    const key = check.dataset.periodCheck;
    if (!key) return;
    check.disabled = true;
    const next = { ...(state.settings.manualPeriodChecks || {}) };
    if (next[key]) delete next[key];
    else next[key] = true;
    try {
      await saveSettings({ manualPeriodChecks: next });
      // The state update repaints the row; keep keyboard focus on the same
      // checkmark without scrolling it into a different position.
      [...document.querySelectorAll('[data-period-check]')]
        .find((node) => node.dataset.periodCheck === key)?.focus({ preventScroll: true });
    }
    catch (_) { check.disabled = false; paintStorageBanner(); }
  });

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
