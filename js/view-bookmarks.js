// The archive: every bookmark, grouped by the challenge that awards it, with
// a photo of the real object if you've taken one.

import {
  state, allChallenges, bookmarkStats, saveBookmarkImage, deleteBookmarkImage,
} from './state.js';
import {
  esc, attr, toast, markVisual, checkBadge, openSheet, confirmSheet,
} from './ui.js';
import { evaluate, bookmarkLabels } from './rules.js';
import { renderSections } from './sections.js';
import * as layout from './layout.js';

export const ARCHIVE_PAGE_ID = 'bookmarks';
import { formatDateTime } from './periods.js';
import { fileToDataUrl } from './backup.js';
import { t } from './theme.js';

function tile(id, meta, unlocked) {
  const img = state.images.get(id);
  return `<button class="bm${unlocked ? '' : ' locked'}" type="button" data-bm="${attr(id)}">
    ${markVisual(id, { unlocked, bonus: !!(meta && meta.bonus), dataUrl: img ? img.dataUrl : null })}
    ${unlocked ? checkBadge() : ''}
    <span class="bm-label">${esc(meta ? meta.title : id)}</span>
    <span class="bm-sub">${unlocked ? 'collected' : 'not yet'}</span>
  </button>`;
}

export function bookmarksView(params = {}) {
  const { collected, total, have } = bookmarkStats();
  const challenges = allChallenges();
  const focus = (params.query && params.query.focus) || null;
  const pct = total ? Math.round((collected / total) * 100) : 0;

  // Every block on this page is a section in its layout, so what the Layouts
  // editor lists is exactly what renders.
  const ctx = { have, challenges, tile, collected, total, pct };

  return {
    title: '',
    tab: 'bookmarks',
    banner: false,
    editorial: true,
    html: `<div class="bookmark-curator-intro">
      <span class="lit-overline">THE KEEPSAKE CABINET</span>
      <p>Every reading accomplishment has a little work of art waiting for it.</p>
      <button type="button" id="bm-artwork-manage">Curate bookmark artwork <span aria-hidden="true">↗</span></button>
    </div>${renderSections(layout.get(ARCHIVE_PAGE_ID), ctx)}`,
    onMount(root) {
      const manage = root.querySelector('#bm-artwork-manage');
      if (manage) manage.onclick = openBookmarkArtworkStudio;
      root.querySelectorAll('[data-bm]').forEach((btn) => {
        btn.onclick = () => openBookmark(btn.dataset.bm);
      });
      if (focus) setTimeout(() => openBookmark(focus), 140);
    },
  };
}

function openBookmarkArtworkStudio() {
  const groups = allChallenges().map((challenge) => ({
    challenge, labels: [...bookmarkLabels(challenge)],
  })).filter((group) => group.labels.length);
  if (!groups.length) return toast('Create a reading challenge first.');
  const titles = new Map(groups.flatMap(({ labels }) => labels));

  openSheet(`<div class="bm-curator-studio bm-curator-compact">
    <p class="lit-overline">THE BOOKMARK ATELIER</p><h2>Choose an illustration</h2>
    <label class="bm-curator-one-choice" for="bm-curator-bookmark">For this bookmark
      <select id="bm-curator-bookmark">${groups.map(({ challenge, labels }) => `<optgroup label="${attr(challenge.name)}">${labels.map(([id, meta]) => `<option value="${attr(id)}">${esc(meta.title || id)}</option>`).join('')}</optgroup>`).join('')}</select>
    </label>
    <div class="bm-curator-focus"><div class="bm-curator-preview" id="bm-curator-preview" aria-live="polite"></div>
      <div class="bm-curator-caption"><strong id="bm-curator-name"></strong><span id="bm-curator-status"></span>
        <button type="button" id="bm-curator-pick">Choose image ↗</button>
      </div>
    </div>
    <input id="bm-curator-file" class="visually-hidden" type="file" accept="image/*">
    <p class="bm-curator-footnote">The illustration appears when the bookmark is earned.</p>
  </div>`, {
    onMount(sheet) {
      const file = sheet.querySelector('#bm-curator-file');
      const bookmarkPicker = sheet.querySelector('#bm-curator-bookmark');
      const button = sheet.querySelector('#bm-curator-pick');
      const selectedId = () => bookmarkPicker.value;
      const show = () => {
        const id = selectedId();
        const meta = titles.get(id);
        const image = state.images.get(id);
        sheet.querySelector('#bm-curator-preview').innerHTML = image
          ? `<img src="${attr(image.dataUrl)}" alt="Selected bookmark artwork">`
          : `<span aria-hidden="true">✦</span>`;
        sheet.querySelector('#bm-curator-name').textContent = meta?.title || id;
        sheet.querySelector('#bm-curator-status').textContent = state.unlocks.some((u) => u.id === id) ? 'Collected' : 'Not yet earned';
        button.textContent = image ? 'Replace image ↗' : 'Choose image ↗';
      };
      bookmarkPicker.onchange = show;
      button.onclick = () => { file.value = ''; file.click(); };
      show();
      file.onchange = async () => {
        const picture = file.files && file.files[0];
        const id = selectedId();
        if (!picture || !id) return;
        button.disabled = true; button.textContent = 'Saving…';
        try {
          const dataUrl = await fileToDataUrl(picture);
          await saveBookmarkImage(id, dataUrl);
          show();
          toast('Artwork assigned to this bookmark.', 'good');
        } catch (error) {
          toast(esc(error.message || 'Could not save artwork.'), 'bad');
        } finally { button.disabled = false; show(); }
      };
    },
  });
}

function openBookmark(id) {
  const challenges = allChallenges();
  let meta = null;
  let challenge = null;
  let period = null;

  for (const c of challenges) {
    const labels = bookmarkLabels(c);
    if (labels.has(id)) {
      meta = labels.get(id);
      challenge = c;
      const r = evaluate(c, state.books);
      period = r.periods.find((p) => p.bookmarkId === id) || null;
      break;
    }
  }

  const unlock = state.unlocks.find((u) => u.id === id);
  const unlocked = !!unlock;
  const img = state.images.get(id);

  const requirement = (() => {
    if (!challenge) return '';
    if (meta && meta.bonus) return 'Complete every period of this challenge.';
    if (period) return `Finish ${period.target} qualifying book${period.target === 1 ? '' : 's'} in ${period.label}. ${period.count} so far.`;
    return `Keep going on ${challenge.name}.`;
  })();

  openSheet(`
    <div class="bookmark-detail">
      <div class="bookmark-detail-visual${unlocked ? '' : ' is-waiting'}">
        ${img ? `<img src="${attr(img.dataUrl)}" alt="Bookmark artwork selected for ${attr(meta ? meta.title : id)}">` : markVisual(id, { unlocked, bonus: !!(meta && meta.bonus) })}
      </div>
      <div class="bookmark-detail-copy">
        <p class="lit-overline">${esc(challenge ? challenge.name : 'Reading collection')}</p>
        <h2>${esc(meta ? meta.title : id)}</h2>
        <p class="bookmark-detail-status">${unlocked ? '✦ Collected' : '◇ Waiting to be earned'}</p>
        <p class="bookmark-detail-requirement">${unlocked ? `Earned ${esc(formatDateTime(unlock.unlockedAt))}` : esc(requirement)}</p>
        ${!unlocked && img ? '<p class="bookmark-detail-ready">Artwork selected · Reveals when collected</p>' : ''}
      </div>
    </div>
    <div class="bookmark-detail-actions">
      <input type="file" id="bm-file" accept="image/*" class="visually-hidden">
      <div class="bookmark-detail-manage">
        <button type="button" id="bm-pick">${img ? 'Change artwork' : 'Choose bookmark artwork'}</button>
        ${img ? '<button type="button" id="bm-remove">Remove</button>' : ''}
      </div>
      ${challenge ? `<a href="#/challenge/${encodeURIComponent(challenge.id)}${unlocked ? '' : '?focus=eligible'}" data-close>${unlocked ? 'Open reading challenge' : 'See qualifying books'} ↗</a>` : ''}
    </div>
  `, {
    onMount(sheet, close) {
      const file = sheet.querySelector('#bm-file');
      const pick = sheet.querySelector('#bm-pick');
      if (pick && file) {
        pick.onclick = () => file.click();
        file.onchange = async () => {
          const f = file.files && file.files[0];
          if (!f) return;
          pick.disabled = true;
          pick.textContent = 'Saving…';
          try {
            const dataUrl = await fileToDataUrl(f);
            await saveBookmarkImage(id, dataUrl);
            close();
            toast('Bookmark artwork saved.', 'good');
          } catch (err) {
            pick.disabled = false;
            pick.textContent = img ? 'Change artwork' : 'Choose bookmark artwork';
            toast(esc(err.message || 'Could not save that photo.'), 'bad');
          }
        };
      }

      const remove = sheet.querySelector('#bm-remove');
      if (remove) {
        remove.onclick = async () => {
          close();
          const yes = await confirmSheet({
            title: 'Remove this photo?',
            body: 'The bookmark and its unlock status stay the same. Only its artwork is removed.',
            confirm: 'Remove',
            danger: true,
          });
          if (!yes) return;
          try {
            await deleteBookmarkImage(id);
            toast('Photo removed.');
          } catch (_) {
            toast('Could not remove that photo.', 'bad');
          }
        };
      }
    },
  });
}
