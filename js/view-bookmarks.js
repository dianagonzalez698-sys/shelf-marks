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
    html: renderSections(layout.get(ARCHIVE_PAGE_ID), ctx),
    onMount(root) {
      root.querySelectorAll('[data-bm]').forEach((btn) => {
        btn.onclick = () => openBookmark(btn.dataset.bm);
      });
      if (focus) setTimeout(() => openBookmark(focus), 140);
    },
  };
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
    <div class="row" style="gap:1.2rem;align-items:flex-start">
      <span style="width:88px;flex:none">
        ${markVisual(id, { unlocked, bonus: !!(meta && meta.bonus), dataUrl: img ? img.dataUrl : null })}
      </span>
      <span class="grow">
        <h2 style="margin-bottom:.15rem">${esc(meta ? meta.title : id)}</h2>
        <p class="small italic muted" style="margin:0">${esc(challenge ? challenge.name : 'Unknown challenge')}</p>
        <dl class="kv" style="margin-top:1rem">
          <dt>Status</dt><dd>${unlocked ? 'Collected' : 'Not yet collected'}</dd>
          ${unlocked ? `<dt>Earned</dt><dd>${esc(formatDateTime(unlock.unlockedAt))}</dd>` : ''}
          ${!unlocked ? `<dt>To earn</dt><dd>${esc(requirement)}</dd>` : ''}
        </dl>
      </span>
    </div>

    ${unlocked ? `
      <input type="file" id="bm-file" accept="image/*" class="visually-hidden">
      <div class="btn-row" style="margin-top:1.3rem">
        <button class="btn grow" type="button" id="bm-pick">${img ? 'Replace photo' : 'Add a photo'}</button>
        ${img ? '<button class="btn btn-danger" type="button" id="bm-remove">Remove photo</button>' : ''}
      </div>
      <p class="hint">Photos stay on this device and travel inside your backup file.</p>
    ` : ''}

    ${challenge ? `
      <a class="btn btn-block" style="margin-top:${unlocked ? '.7rem' : '1.3rem'}"
         href="#/challenge/${encodeURIComponent(challenge.id)}?focus=eligible" data-close>
        Go to eligible books
      </a>
      <a class="btn btn-block" style="margin-top:.7rem"
         href="#/challenge/${encodeURIComponent(challenge.id)}" data-close>
        Open ${esc(challenge.name)}
      </a>
    ` : ''}

    <div class="btn-row" style="margin-top:.7rem">
      <button class="btn btn-block" type="button" data-close>Close</button>
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
            toast('Photo saved to this bookmark.', 'good');
          } catch (err) {
            pick.disabled = false;
            pick.textContent = 'Add a photo';
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
            body: 'The bookmark stays collected — only the photo is deleted.',
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
