// Settings: goals, backup export/import, and housekeeping.

import { state, saveSettings, pruneUnlocks, bookmarkStats } from './state.js';
import { esc, attr, toast, openSheet, confirmSheet } from './ui.js';
import { exportBackup, importBackup, parseBackup, readFile } from './backup.js';
import { quarters, formatDateTime } from './periods.js';
import { estimate } from './store.js';
import * as layout from './layout.js';
import * as assets from './assets.js';
import * as theme from './theme.js';
import { attachSettingsDesign } from './canvas.js';

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
      <section class="settings-dashboard">
        <header class="settings-heading"><p class="lit-overline">THE JOURNAL / PREFERENCES</p>
          <h1>Your <em>Settings</em></h1><p>A quieter place to manage your reading, appearance, and saved work.</p>
        </header>
        <div class="settings-top-grid">
          <section class="settings-card settings-design-card">
            <div class="settings-card-head"><span>01 / THE LOOK</span><h2>Design & appearance</h2></div>
            <p>Make the journal your own, from a single heading to the whole composition.</p>
            <a class="lit-primary-action" href="#/?design=1">Enter Design Mode <span>↗</span></a>
            <details class="settings-disclosure"><summary>More design tools <span>+</span></summary>
              <div class="settings-link-grid"><a href="#/customize">Typography & colors ↗</a><a href="#/layout">Page layouts ↗</a><a href="#/assets">Picture library ↗</a></div>
            </details>
            <div class="settings-mode-field"><label for="set-mode">COLOR APPEARANCE</label>
              <select id="set-mode"><option value="system" ${theme.getMode() === 'system' ? 'selected' : ''}>Follow my device (recommended)</option>
                <option value="light" ${theme.getMode() === 'light' ? 'selected' : ''}>Always light</option>
                <option value="dark" ${theme.getMode() === 'dark' ? 'selected' : ''}>Always dark</option></select>
              <p class="hint">When following your device, Shelf Marks uses the browser's reported system appearance. <span id="system-appearance-report"></span></p>
            </div>
          </section>
          <section class="settings-card settings-goals-card">
            <div class="settings-card-head"><span>02 / THE READING PLAN</span><h2>Reading goals</h2></div>
            ${numberField('set-annual', `Books to finish in ${s.year}`, s.annualGoal, { min: 1, max: 2000 })}
            ${numberField('set-nf', 'Nonfiction goal (%)', s.nonfictionTargetPct, { min: 0, max: 100, hint: 'Share of finished books that should be nonfiction.' })}
            <details class="settings-disclosure"><summary>Quarterly targets <span>+</span></summary>
              <div class="grid-2">${qs.map((q) => `<div class="field"><label for="set-${attr(q.key)}">${esc(q.label)}</label>
                <input id="set-${attr(q.key)}" data-quarter="${attr(q.key)}" type="number" inputmode="numeric" min="0" max="2000" value="${attr(s.quarterGoals[q.key])}"></div>`).join('')}</div>
              <p class="hint" id="quarter-sum">Quarters add up to ${quarterTotal} of ${s.annualGoal} for the year.</p>
            </details>
          </section>
        </div>

        <section class="settings-card settings-backup-card">
          <div class="settings-card-head"><span>03 / SAFEKEEPING</span><h2>Data & backups</h2></div>
          ${untouchedDevice() ? `<div class="notice"><strong>This device is using the default journal.</strong> Layouts and images don't sync automatically between browsers. Import a backup from the device where you customized them.</div>` : ''}
          <p>Your books, Notebook, artwork and design settings live in this browser. Export a backup regularly, especially before switching devices.</p>
          <div class="settings-backup-actions"><button class="btn btn-primary" type="button" id="do-export">Export backup</button>
            <button class="btn" type="button" id="do-import">Import backup</button></div>
          <input type="file" id="import-file" accept="application/json,.json" class="visually-hidden">
          <p class="hint" id="last-exported">Last exported: ${esc(formatDateTime(s.lastExportedAt))}</p>
          <details class="settings-disclosure"><summary>Storage & maintenance <span>+</span></summary>
            <dl class="kv"><dt>Books logged</dt><dd>${state.books.length}</dd><dt>Bookmarks</dt><dd>${collected} of ${total}</dd>
              <dt>Bookmark photos</dt><dd>${state.images.size}</dd><dt>Storage used</dt><dd id="storage-used">checking…</dd></dl>
            <button class="btn btn-block" type="button" id="recheck">Re-check bookmark unlocks</button>
            <p class="hint">This removes collected bookmarks that your current finished books no longer justify. Photos stay saved.</p>
          </details>
        </section>
        <p class="settings-footnote">Shelf Marks is a private, browser-stored reading journal. Book details come from <a href="https://openlibrary.org" rel="noopener">Open Library</a>. Clearing browser website data can erase locally saved entries unless you have exported a backup.</p>
      </section>
    `,

    onStateChange() {
      const line = document.getElementById('last-exported');
      if (line) line.textContent = `Last exported: ${formatDateTime(state.settings.lastExportedAt)}`;
    },

    onMount(root) {
      attachSettingsDesign(root);
      const report = root.querySelector('#system-appearance-report');
      const showDetectedMode = () => {
        if (!report) return;
        const detected = window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        report.textContent = `This browser currently reports ${detected} mode.${window.self !== window.top ? ' Embedded previews may use the host app’s appearance instead of your computer’s.' : ''}`;
      };
      showDetectedMode();
      root.querySelector('#set-mode').onchange = async (e) => {
        await theme.setMode(e.target.value);
        toast('Appearance preference saved.', 'good');
      };
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
          const incoming = parseBackup(text);
          const approved = await confirmSheet({
            title: 'Import this backup?',
            body: `This file contains ${incoming.books.length} books and was exported ${incoming.exportedAt ? formatDateTime(incoming.exportedAt) : 'on an unknown date'}. Newer records and design settings may replace versions on this device. Existing books that are not in the file will stay here.`,
            confirm: 'Import backup',
          });
          if (!approved) { file.value = ''; return; }
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
              ${res.settingsTextStylesChanged ? 'Your Settings page typography was restored. ' : ''}
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
            <p class="small muted">Check your journal before trying again. If the import stopped partway through, some records may have been updated.</p>
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
