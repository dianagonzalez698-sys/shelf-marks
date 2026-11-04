// Image placement.
//
// Every picture anywhere in the journal is described by one plain object and
// drawn by one function, so adding a new composition never means writing new
// image code. A descriptor with no asset still renders — as a tinted paper
// plate — which is why the layouts look deliberate before you have uploaded
// anything at all.

import { src as assetSrc, get as getAsset } from './assets.js';
import { esc, attr } from './ui.js';

export const FRAMES = [
  ['none', 'None'],
  ['gilt', 'Gilt museum frame'],
  ['gilt-oval', 'Gilt oval'],
  ['plate', 'Paper plate'],
  ['polaroid', 'Polaroid'],
  ['deckle', 'Torn edge'],
  ['oval', 'Oval'],
  ['arch', 'Arch'],
  ['line', 'Hairline'],
  ['stamp', 'Postage stamp'],
];

export const RATIOS = [
  ['auto', 'Natural'],
  ['1/1', 'Square'],
  ['4/5', 'Portrait 4:5'],
  ['2/3', 'Portrait 2:3'],
  ['3/4', 'Portrait 3:4'],
  ['4/3', 'Landscape 4:3'],
  ['3/2', 'Landscape 3:2'],
  ['16/9', 'Wide 16:9'],
  ['21/9', 'Panorama'],
];

export const TAPES = [
  ['none', 'None'],
  ['top', 'One strip'],
  ['corners', 'Two corners'],
];

export const MEDIA_DEFAULTS = {
  assetId: null,
  alt: '',
  fit: 'cover',
  focalX: 50,
  focalY: 50,
  ratio: '4/5',
  width: 100,        // % of its slot
  opacity: 1,
  rotate: 0,
  frame: 'plate',
  shadow: true,
  tape: 'none',
  caption: '',
  z: 1,
  x: 0,              // collage offset, % of slot
  y: 0,
  hideOnMobile: false,
};

export function media(partial = {}) {
  return { ...MEDIA_DEFAULTS, ...partial };
}

/** Placeholder tints, drawn from the palette, chosen stably from a seed. */
const TINTS = ['sage', 'olive', 'rose', 'blue', 'apricot', 'gold'];
function tintFor(seed) {
  let h = 2166136261;
  const s = String(seed || 'plate');
  for (let i = 0; i < s.length; i += 1) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return TINTS[Math.abs(h) % TINTS.length];
}

function frameClass(m) {
  const bits = [`mf-${m.frame || 'none'}`];
  if (m.shadow) bits.push('mf-shadow');
  if (m.tape && m.tape !== 'none') bits.push(`mf-tape-${m.tape}`);
  if (m.hideOnMobile) bits.push('hide-sm');
  return bits.join(' ');
}

// The shape goes on the inner box. Putting it on the figure made any frame
// padding invisible: an absolutely positioned `inset: 0` child is laid out
// against the padding box, so the picture covered the mount.
function shapeStyle(m) {
  return (m.ratio && m.ratio !== 'auto') ? `aspect-ratio:${m.ratio}` : '';
}

function boxStyle(m) {
  const out = [];
  if (Number(m.width) !== 100) out.push(`width:${Number(m.width)}%`);
  if (Number(m.opacity) !== 1) out.push(`opacity:${Number(m.opacity)}`);
  if (Number(m.rotate)) out.push(`--m-rot:${Number(m.rotate)}deg`);
  if (Number(m.z) !== 1) out.push(`z-index:${Number(m.z)}`);
  if (Number(m.x)) out.push(`--m-x:${Number(m.x)}%`);
  if (Number(m.y)) out.push(`--m-y:${Number(m.y)}%`);
  return out.join(';');
}

/**
 * Render one picture. `seed` only affects the empty-state tint, so a given
 * slot keeps the same colour until you fill it.
 */
export function figure(m, { seed = '', className = '', eager = false } = {}) {
  const descriptor = media(m);
  const asset = getAsset(descriptor.assetId);
  const url = assetSrc(descriptor.assetId);
  const alt = descriptor.alt || (asset ? asset.alt || asset.name : '');

  const inner = url
    ? `<img class="m-img" src="${attr(url)}" alt="${attr(alt)}"
         ${eager ? '' : 'loading="lazy"'} decoding="async"
         style="object-fit:${descriptor.fit === 'contain' ? 'contain' : 'cover'};
                object-position:${Number(descriptor.focalX)}% ${Number(descriptor.focalY)}%">`
    : `<span class="m-empty m-tint-${tintFor(seed || descriptor.caption || 'plate')}" aria-hidden="true">
         <svg viewBox="0 0 48 48" class="m-empty-mark"><path d="M24 7.5c1.3 9.2 3.1 11 12.3 12.3C27.1 21.1 25.3 22.9 24 32.1c-1.3-9.2-3.1-11-12.3-12.3C20.9 18.5 22.7 16.7 24 7.5z"/></svg>
       </span>`;

  const auto = !descriptor.ratio || descriptor.ratio === 'auto';
  // The mount carries the frame — its padding and gilding. Keeping it separate
  // from the figure means a caption sits *below* the frame rather than being
  // printed on the moulding.
  return `<figure class="m-fig ${frameClass(descriptor)}${auto ? ' m-auto' : ''} ${className}" style="${boxStyle(descriptor)}">
    <span class="m-mount">
      <span class="m-box" style="${shapeStyle(descriptor)}">${inner}</span>
    </span>
    ${descriptor.caption ? `<figcaption class="m-cap">${esc(descriptor.caption)}</figcaption>` : ''}
  </figure>`;
}

/** A background layer — full-bleed imagery behind a section. */
export function backdrop(m, { seed = '' } = {}) {
  const descriptor = media(m);
  const url = assetSrc(descriptor.assetId);
  if (!url) {
    return `<span class="m-backdrop m-backdrop-empty m-tint-${tintFor(seed)}" aria-hidden="true"></span>`;
  }
  return `<span class="m-backdrop" aria-hidden="true" style="
      background-image:url('${attr(url)}');
      background-position:${Number(descriptor.focalX)}% ${Number(descriptor.focalY)}%;
      opacity:${Number(descriptor.opacity)}"></span>`;
}

export function hasAsset(m) {
  return !!(m && m.assetId && assetSrc(m.assetId));
}
