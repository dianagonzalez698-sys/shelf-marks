// The bookmark collection: one group per challenge, with a photo you can
// attach to each one you've collected.

import {
  state, allChallenges, bookmarkStats, saveBookmarkImage, deleteBookmarkImage,
} from './state.js';
import {
  esc, attr, toast, markVisual, openSheet, confirmSheet,
} from './ui.js';
import { evaluate, bookmarkLabels } from './rules.js';
import { formatDateTime } from './periods.js';
import { fileToDataUrl } from './backup.js';

function tile(id, meta, unlocked) {
  const img = state.images.get(id);
  const art = markVisual(id, {
    unlocked,
    bonus: !!(meta && meta.bonus),
    dataUrl: img ? img.dataUrl : null,
  });
  return `<button class="bm${unlocked ? '' : ' locked'}" type="button" data-bm="${attr(id)}">
    ${art}
    <div class="bm-name">${esc(meta ? meta.title : id)}</div>
    <div class="bm-sub">${unlocked ? 'collected' : 'locked'}</div>
  </button>`;
}

export function bookmarksView(params = {}) {
  const { collected, total, have } = bookmarkStats();
  const challenges = allChallenges();
  const focus = (params.query && params.query.focus) || null;

  const groups = challenges.map((c) => {
    const labels = bookmarkLabels(c);
    const ids = [...labels.keys()];
    if (!ids.length) {
      return `<h2 class="section-title">${esc(c.name)}</h2>
        <p class="small muted" style="margin:0 0 .9rem">
          No bookmarks yet — <a href="#/challenge/${encodeURIComponent(c.id)}">set this challenge's target</a> first.
        </p>`;
    }
    const mine = ids.filter((id) => have.has(id)).length;
    return `<h2 class="section-title">${esc(c.name)} · ${mine}/${ids.length}</h2>
      <div class="bm-grid" style="margin-bottom:.4rem">
        ${ids.map((id) => tile(id, labels.get(id), have.has(id))).join('')}
      </div>`;
  }).join('');

  return {
    title: 'Bookmarks',
    tab: 'bookmarks',
    html: `
      <section class="card">
        <div class="goal-head">
          <span class="goal-label">Collection</span>
          <span class="goal-pct">${total ? Math.round((collected / total) * 100) : 0}%</span>
        </div>
        <div class="goal-main"><b>${collected}</b> of ${total} bookmarks collected</div>
        <div class="goal-sub"><span>Tap one to add a photo of the real thing</span></div>
      </section>
      ${groups}
    `,
    onMount(root) {
      root.querySelectorAll('[data-bm]').forEach((btn) => {
        btn.onclick = () => openBookmark(btn.dataset.bm);
      });
      if (focus) setTimeout(() => openBookmark(focus), 120);
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

  const art = markVisual(id, {
    unlocked,
    bonus: !!(meta && meta.bonus),
    dataUrl: img ? img.dataUrl : null,
  });

  const requirement = (() => {
    if (!challenge) return '';
    if (meta && meta.bonus) return 'Complete every period of this challenge.';
    if (period) return `Finish ${period.target} qualifying book${period.target === 1 ? '' : 's'} in ${period.label}. ${period.count} so far.`;
    return `Keep going on ${challenge.name}.`;
  })();

  openSheet(`
    <div class="row" style="gap:1rem;align-items:flex-start">
      <div style="width:72px;flex:none">${art}</div>
      <div class="grow">
        <h2 style="margin-bottom:.2rem">${esc(meta ? meta.title : id)}</h2>
        <p class="small muted" style="margin:0">${esc(challenge ? challenge.name : 'Unknown challenge')}</p>
      </div>
    </div>

    <dl class="kv" style="margin:1rem 0">
      <dt>Bookmark id</dt><dd><code>${esc(id)}</code></dd>
      <dt>Status</dt><dd>${unlocked ? 'Collected' : 'Locked'}</dd>
      ${unlocked ? `<dt>Unlocked</dt><dd>${esc(formatDateTime(unlock.unlockedAt))}</dd>` : ''}
      ${!unlocked ? `<dt>To unlock</dt><dd>${esc(requirement)}</dd>` : ''}
    </dl>

    ${unlocked ? `
      <input type="file" id="bm-file" accept="image/*" class="visually-hidden">
      <div class="btn-row">
        <button class="btn grow" type="button" id="bm-pick">${img ? 'Replace photo' : 'Add a photo'}</button>
        ${img ? '<button class="btn btn-danger" type="button" id="bm-remove">Remove photo</button>' : ''}
      </div>
      <p class="hint">Photos are stored on this device and travel inside your JSON backup.</p>
    ` : `
      <a class="btn btn-block" href="#/challenge/${encodeURIComponent(challenge ? challenge.id : '')}" data-close>
        Open ${esc(challenge ? challenge.name : 'challenge')}
      </a>
    `}

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
