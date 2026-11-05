// Settings: goals, backup export/import, and housekeeping.

import { state, saveSettings, pruneUnlocks, bookmarkStats } from './state.js';
import { esc, attr, toast, openSheet, confirmSheet } from './ui.js';
import { exportBackup, importBackup, readFile } from './backup.js';
import { quarters, formatDateTime } from './periods.js';
import { estimate } from './store.js';
import * as layout from './layout.js';
import * as assets from './assets.js';

function numberField(id, label, value, { min = 0, max = 9999, hint = '' } = {}) {
  return `<div class="field">
    <label for="${attr(id)}">${esc(label)}</label>
    <input id="${attr(id)}" type="number" inputmode="numeric" min="${min}" max="${max}" value="${attr(value)}">
    ${hint ? `<p class="hint">${esc(hint)}</p>` : ''}
  </div>`;
}

// A device nobody has designed on yet shows the stock templates, which looks
// like the app failing to update rather than a second device with its own
// store. Say so where the fix is.
function untouchedDevice() {
  try {
    return layout.snapshot().length === 0 && assets.list().length === 0;
  } catch (_) { return false; }
}

export function settingsView() {
  const s = state.settings;
  const qs = quarters(s.year);
  const quarterTotal = qs.reduce((sum, q) => sum + (Number(s.quarterGoals[q.key]) || 0), 0);
  const { collected, total } = bookmarkStats();

  return {
    title: 'Settings',
    tab: 'settings',
    live: false,
    html: `
      <section class="section form-wrap">
      <div class="section-head" style="margin-bottom:1.4rem"><div>
        <h2 class="section-title">Settings</h2>
        <p class="section-sub">Goals, syncing, and the look of the journal.</p>
      </div></div>
      <h2 class="form-heading">Goals</h2>
      <section class="panel">
        ${numberField('set-annual', `Books in ${s.year}`, s.annualGoal, { min: 1, max: 2000 })}
        <span class="field-label">Each quarter</span>
        <div class="grid-2">
          ${qs.map((q) => `<div class="field" style="margin-bottom:.4rem">
            <label for="set-${attr(q.key)}">${esc(q.label)}</label>
            <input id="set-${attr(q.key)}" data-quarter="${attr(q.key)}" type="number"
                   inputmode="numeric" min="0" max="2000" value="${attr(s.quarterGoals[q.key])}">
          </div>`).join('')}
        </div>
        <p class="hint" id="quarter-sum">Quarters add up to ${quarterTotal} of ${s.annualGoal} for the year.</p>
      </section>

      <h2 class="form-heading">Nonfiction</h2>
      <section class="panel">
        ${numberField('set-nf', 'Share of books read that should be nonfiction (%)', s.nonfictionTargetPct, { min: 0, max: 100, hint: 'The nonfiction bar on Home measures against this percentage.' })}
      </section>

      <h2 class="form-heading">Sync between devices</h2>
      <section class="panel">
        ${untouchedDevice() ? `<div class="notice" style="margin-top:0">
          <strong>This device is showing the default journal.</strong>
          Your layouts, pictures and design live on whichever device you built them on —
          nothing travels between devices on its own. Export there, then import the file here.
        </div>` : ''}
        <p class="small muted" style="margin-top:0">
          Export on one device, then import that file on the other. Items are merged by id,
          and whichever copy was edited more recently wins. Your design settings travel too.
        </p>
        <div class="btn-row">
          <button class="btn btn-primary grow" type="button" id="do-export">Export backup</button>
          <button class="btn grow" type="button" id="do-import">Import backup</button>
        </div>
        <input type="file" id="import-file" accept="application/json,.json" class="visually-hidden">
        <p class="hint" id="last-exported">Last exported: ${esc(formatDateTime(s.lastExportedAt))}</p>
      </section>

      <h2 class="form-heading">Appearance</h2>
      <section class="panel">
        <div class="row-between" style="gap:1rem">
          <div class="grow">
            <p class="h3" style="margin:0">Design studio</p>
            <p class="hint" style="margin:.2rem 0 0">
              Colours, typefaces, bookmark proportions and the wording on every page.
            </p>
          </div>
          <a class="btn btn-sm nowrap" href="#/customize">Open</a>
        </div>
        <div class="btn-row" style="margin-top:.9rem">
          <a class="btn btn-sm" href="#/layout">Page layouts</a>
          <a class="btn btn-sm" href="#/assets">Picture library</a>
        </div>
      </section>

      <h2 class="form-heading">This device</h2>
      <section class="panel">
        <dl class="kv">
          <dt>Books logged</dt><dd>${state.books.length}</dd>
          <dt>Bookmarks</dt><dd>${collected} of ${total}</dd>
          <dt>Bookmark photos</dt><dd>${state.images.size}</dd>
          <dt>Storage used</dt><dd id="storage-used">checking…</dd>
        </dl>
        <div class="btn-row" style="margin-top:.9rem">
          <button class="btn btn-block" type="button" id="recheck">Re-check unlocks</button>
        </div>
        <p class="hint">
          Bookmarks stay collected even if you later delete the book that earned one.
          Re-checking drops any bookmark your current books no longer justify.
        </p>
      </section>

      <h2 class="form-heading">About</h2>
      <section class="panel">
        <p class="small muted" style="margin:0">
          Shelf Marks keeps everything in this browser's local database — nothing is uploaded anywhere.
          Book details come from <a href="https://openlibrary.org" rel="noopener">Open Library</a>.
          Clearing Safari's website data for this site erases your log, so export a backup now and then.
        </p>
      </section>
      </section>
    `,

    onStateChange() {
      const line = document.getElementById('last-exported');
      if (line) line.textContent = `Last exported: ${formatDateTime(state.settings.lastExportedAt)}`;
    },

    onMount(root) {
      /* storage estimate */
      estimate().then((e) => {
        const el = root.querySelector('#storage-used');
        if (!el) return;
        if (!e || !e.usage) { el.textContent = 'not reported by this browser'; return; }
        const mb = (e.usage / 1048576).toFixed(1);
        const quota = e.quota ? ` of about ${(e.quota / 1048576).toFixed(0)} MB available` : '';
        el.textContent = `${mb} MB${quota}`;
      });

      const sumLine = root.querySelector('#quarter-sum');
      const repaintSum = () => {
        const annual = Number(root.querySelector('#set-annual').value) || 0;
        const total2 = qs.reduce((sum, q) =>
          sum + (Number(root.querySelector(`#set-${q.key}`).value) || 0), 0);
        sumLine.textContent = `Quarters add up to ${total2} of ${annual} for the year.`;
      };

      /* goals save on change */
      const annualEl = root.querySelector('#set-annual');
      annualEl.onchange = async () => {
        const v = Math.max(1, Math.min(2000, Number(annualEl.value) || 1));
        annualEl.value = v;
        await saveSettings({ annualGoal: v });
        repaintSum();
        toast('Annual goal updated.', 'good', 1800);
      };

      qs.forEach((q) => {
        const el = root.querySelector(`#set-${q.key}`);
        el.onchange = async () => {
          const v = Math.max(0, Math.min(2000, Number(el.value) || 0));
          el.value = v;
          await saveSettings({ quarterGoals: { [q.key]: v } });
          repaintSum();
          toast(`${q.key} goal updated.`, 'good', 1800);
        };
      });

      const nfEl = root.querySelector('#set-nf');
      nfEl.onchange = async () => {
        const v = Math.max(0, Math.min(100, Number(nfEl.value) || 0));
        nfEl.value = v;
        await saveSettings({ nonfictionTargetPct: v });
        toast('Nonfiction goal updated.', 'good', 1800);
      };

      /* export */
      root.querySelector('#do-export').onclick = async (e) => {
        const btn = e.currentTarget;
        btn.disabled = true;
        try {
          const res = await exportBackup();
          openSheet(`
            <h2>Backup exported</h2>
            <p class="small muted">Saved as <code>${esc(res.filename)}</code> (${(res.bytes / 1024).toFixed(0)} KB).
            On iPhone or iPad, Safari puts it in Files — put it somewhere both devices can reach, like iCloud Drive.</p>
            <ul class="summary-list">
              <li><span>Books</span><b>${res.counts.books}</b></li>
              <li><span>Challenge edits</span><b>${res.counts.challenges}</b></li>
              <li><span>Bookmark unlocks</span><b>${res.counts.unlocks}</b></li>
              <li><span>Bookmark photos</span><b>${res.counts.images}</b></li>
              <li><span>Design settings</span><b>included</b></li>
            </ul>
            <button class="btn btn-primary btn-block" type="button" data-close>Done</button>
          `);
        } catch (_) {
          toast('Export failed — could not read local storage.', 'bad');
        } finally {
          btn.disabled = false;
        }
      };

      /* import */
      const file = root.querySelector('#import-file');
      root.querySelector('#do-import').onclick = () => file.click();
      file.onchange = async () => {
        const f = file.files && file.files[0];
        if (!f) return;
        try {
          const text = await readFile(f);
          const res = await importBackup(text);
          file.value = '';
          const row = (label, g) => `<li><span>${label}</span>
            <b>+${g.added} new · ${g.updated} updated${g.skipped ? ` · ${g.skipped} unchanged` : ''}</b></li>`;
          openSheet(`
            <h2>Backup merged</h2>
            ${res.exportedAt ? `<p class="small muted">That file was exported ${esc(formatDateTime(res.exportedAt))}.</p>` : ''}
            <ul class="summary-list">
              ${row('Books', res.books)}
              ${row('Challenge edits', res.challenges)}
              ${row('Bookmark unlocks', res.unlocks)}
              ${row('Bookmark photos', res.images)}
            </ul>
            <p class="small muted">
              ${res.settingsChanged ? 'Goals were newer in that file, so they were updated. ' : 'Your goals on this device were newer, so they were kept. '}
              ${res.themeChanged ? 'The design settings in that file were newer and have been applied. ' : ''}
              ${res.newlyUnlocked ? `${res.newlyUnlocked} new bookmark${res.newlyUnlocked === 1 ? '' : 's'} unlocked by the merged books.` : ''}
            </p>
            <button class="btn btn-primary btn-block" type="button" data-close>Done</button>
          `);
        } catch (err) {
          file.value = '';
          openSheet(`
            <h2>Import failed</h2>
            <p class="small">${esc(err.message || 'That file could not be read.')}</p>
            <p class="small muted">Nothing on this device was changed.</p>
            <button class="btn btn-block" type="button" data-close>Close</button>
          `);
        }
      };

      /* re-check unlocks */
      root.querySelector('#recheck').onclick = async () => {
        const yes = await confirmSheet({
          title: 'Re-check every unlock?',
          body: 'Bookmarks your current books no longer justify will be removed from your collection. Photos on them are kept.',
          confirm: 'Re-check',
        });
        if (!yes) return;
        try {
          const dropped = await pruneUnlocks();
          toast(dropped
            ? `${dropped} bookmark${dropped === 1 ? '' : 's'} removed.`
            : 'Everything still checks out.', 'good');
        } catch (_) {
          toast('Could not re-check right now.', 'bad');
        }
      };
    },
  };
}
