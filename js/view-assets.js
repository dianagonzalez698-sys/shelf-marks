// The asset library — your photographs, paintings, cutouts and textures.
// Everything added here becomes available to every image slot in the journal.

import * as assets from './assets.js';
import { esc, attr, toast, openSheet, confirmSheet, render } from './ui.js';
import { studioNav } from './studio-nav.js';

function sizeLabel(bytes) {
  if (!bytes) return '—';
  return bytes > 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;
}

function card(a) {
  return `<button class="asset" type="button" data-asset="${attr(a.id)}">
    <span class="asset-thumb"><img src="${attr(a.dataUrl)}" alt="" loading="lazy" decoding="async"></span>
    <span class="asset-name">${esc(a.name)}</span>
    <span class="asset-meta">${esc((assets.KINDS.find((k) => k[0] === a.kind) || [, a.kind])[1])}
      · ${a.w ? `${a.w}×${a.h}` : 'vector'} · ${sizeLabel(a.bytes)}</span>
  </button>`;
}

export function assetsView() {
  const all = assets.list();
  const total = assets.totalBytes();
  const heavy = total > assets.SOFT_TOTAL_WARN;

  return {
    title: 'Pictures',
    tab: 'settings',
    back: true,
    live: false,
    html: `
      <div class="ed sp-tight form-wrap">
        ${studioNav('assets')}
        <div class="ed-head" style="margin-bottom:1.2rem">
          <p class="ed-kicker">The library</p>
          <h2 class="ed-title">Pictures</h2>
          <p class="ed-sub">Paintings, photographs, cutouts and papers. Everything here can be
            dropped into any image slot in the journal.</p>
        </div>

        <input type="file" id="asset-file" accept="image/*" multiple class="visually-hidden">
        <div class="field">
          <label for="asset-kind">What are you adding?</label>
          <select id="asset-kind">
            ${assets.KINDS.map(([v, l]) => `<option value="${attr(v)}">${esc(l)}</option>`).join('')}
          </select>
          <p class="hint">Cutouts and ornaments keep their transparency; the rest are saved as
            JPEG and scaled down so backups stay a sensible size.</p>
        </div>
        <div class="btn-row">
          <button class="btn btn-primary" type="button" id="asset-add">Add pictures</button>
        </div>

        <p class="hint" style="margin-top:1rem">
          ${all.length} picture${all.length === 1 ? '' : 's'} · ${sizeLabel(total)} stored on this device
          ${heavy ? ' · <b>getting large</b> — big libraries make the backup file slow to move between devices.' : ''}
        </p>

        ${all.length
          ? `<div class="asset-grid" style="margin-top:1.4rem">${all.map(card).join('')}</div>`
          : `<div class="empty"><h3>Nothing in the library yet</h3>
              <p>Add a painting or a photograph and the empty plates around the journal
                will start filling in.</p></div>`}
      </div>
    `,
    onMount(root) {
      const file = root.querySelector('#asset-file');
      const kind = root.querySelector('#asset-kind');
      root.querySelector('#asset-add').onclick = () => file.click();

      file.onchange = async () => {
        const list = [...(file.files || [])];
        if (!list.length) return;
        let added = 0;
        let failed = 0;
        for (const f of list) {
          try {
            await assets.add(f, { kind: kind.value });
            added += 1;
          } catch (err) {
            failed += 1;
          }
        }
        file.value = '';
        if (added) toast(`${added} picture${added === 1 ? '' : 's'} added.`, 'good');
        if (failed) toast(`${failed} file${failed === 1 ? '' : 's'} could not be read.`, 'bad');
        render();
      };

      root.querySelectorAll('[data-asset]').forEach((btn) => {
        btn.onclick = () => openAsset(btn.dataset.asset);
      });
    },
  };
}

function openAsset(id) {
  const a = assets.get(id);
  if (!a) return;
  openSheet(`
    <h2>${esc(a.name)}</h2>
    <div class="asset-preview"><img src="${attr(a.dataUrl)}" alt=""></div>
    <div class="field" style="margin-top:1rem">
      <label for="a-name">Name</label>
      <input type="text" id="a-name" value="${attr(a.name)}">
    </div>
    <div class="field">
      <label for="a-alt">Description (for screen readers)</label>
      <input type="text" id="a-alt" value="${attr(a.alt || '')}" placeholder="e.g. Botticelli, detail">
    </div>
    <div class="field">
      <label for="a-kind">Kind</label>
      <select id="a-kind">
        ${assets.KINDS.map(([v, l]) => `<option value="${attr(v)}" ${v === a.kind ? 'selected' : ''}>${esc(l)}</option>`).join('')}
      </select>
    </div>
    <dl class="kv">
      <dt>Size</dt><dd>${a.w ? `${a.w} × ${a.h}` : 'vector'} · ${sizeLabel(a.bytes)}</dd>
    </dl>
    <div class="btn-row" style="margin-top:1.2rem">
      <button class="btn btn-primary grow" type="button" data-act="save">Save</button>
      <button class="btn btn-danger" type="button" data-act="delete">Delete</button>
    </div>
    <div class="btn-row" style="margin-top:.6rem">
      <button class="btn btn-block" type="button" data-close>Close</button>
    </div>
  `, {
    onMount(sheet, close) {
      sheet.querySelector('[data-act="save"]').onclick = async () => {
        await assets.update(id, {
          name: sheet.querySelector('#a-name').value.trim() || a.name,
          alt: sheet.querySelector('#a-alt').value.trim(),
          kind: sheet.querySelector('#a-kind').value,
        });
        close();
        toast('Saved.', 'good');
        render();
      };
      sheet.querySelector('[data-act="delete"]').onclick = async () => {
        close();
        const yes = await confirmSheet({
          title: `Delete “${a.name}”?`,
          body: 'Any slot using it will fall back to an empty plate.',
          confirm: 'Delete',
          danger: true,
        });
        if (!yes) return;
        await assets.remove(id);
        toast('Picture deleted.');
        render();
      };
    },
  });
}
