// Carved frame ornament.
//
// A stepped moulding can be built from box-shadows, but scrollwork cannot —
// it needs real shapes. This generates an SVG of a baroque frame (ornate
// corner cartouches, a repeating acanthus rail) and hands it to CSS as a
// `border-image`, so the corners draw once and the rails repeat along each
// side at any size.
//
// It is generated rather than shipped as a file so the gilding follows the
// theme tokens: change the gold in the Design Studio and the carving re-tints.

const TILE = 320;        // SVG viewBox
export const SLICE = 96; // border-image-slice — the width of the carved band

const cache = new Map();

/* ------------------------------------------------------------ geometry -- */

const pt = (cx, cy, a, r) => [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
const fmt = (p) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`;

/** A tapering ribbon swept along a spiral — the basic volute of a scroll. */
function volute(cx, cy, rStart, rEnd, aStart, aEnd, wStart, wEnd, steps = 26) {
  const outer = [];
  const inner = [];
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const a = aStart + (aEnd - aStart) * t;
    const r = rStart + (rEnd - rStart) * t;
    const w = wStart + (wEnd - wStart) * t;
    outer.push(pt(cx, cy, a, r + w / 2));
    inner.push(pt(cx, cy, a, r - w / 2));
  }
  return `M${outer.map(fmt).join('L')}L${inner.reverse().map(fmt).join('L')}Z`;
}

/** An acanthus leaf: a tapering blade with lobed edges. */
function leaf(x, y, len, ang, width, lobes = 3, steps = 24) {
  const left = [];
  const right = [];
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const taper = Math.sin(Math.PI * (0.12 + t * 0.88)) * (1 - t * 0.55);
    const lobe = 1 + 0.42 * Math.sin(t * Math.PI * lobes * 2);
    const w = width * taper * lobe;
    const d = len * t;
    const cx = x + Math.cos(ang) * d;
    const cy = y + Math.sin(ang) * d;
    const n = ang + Math.PI / 2;
    left.push(pt(cx, cy, n, w / 2));
    right.push(pt(cx, cy, n, -w / 2));
  }
  return `M${left.map(fmt).join('L')}L${right.reverse().map(fmt).join('L')}Z`;
}

/** A small rosette — a ring of petals around a boss. */
function rosette(cx, cy, r, petals = 8) {
  let d = '';
  for (let i = 0; i < petals; i += 1) {
    const a = (i / petals) * Math.PI * 2;
    const [px, py] = pt(cx, cy, a, r * 0.62);
    d += `M${px.toFixed(1)} ${py.toFixed(1)}`
      + `a${(r * 0.38).toFixed(1)} ${(r * 0.26).toFixed(1)} 0 1 0 0.1 0Z`;
  }
  return d;
}

/* ---------------------------------------------------------- the carving -- */

/**
 * One corner cartouche filling the SLICE x SLICE box. Bold forms, because
 * fine detail turns to mud once the band is only forty pixels wide.
 */
function cornerOrnament() {
  return [
    volute(40, 40, 34, 8, Math.PI * 0.62, Math.PI * 2.75, 19, 5),
    leaf(26, 26, 54, Math.PI * 0.25, 30, 2),
    leaf(52, 22, 44, -0.04, 26, 3),
    leaf(22, 52, 44, Math.PI / 2 + 0.04, 26, 3),
    volute(76, 30, 17, 5, Math.PI * 1.15, Math.PI * 2.9, 11, 3),
    volute(30, 76, 17, 5, Math.PI * 1.65, Math.PI * 3.4, 11, 3),
    leaf(66, 66, 30, Math.PI * 0.25, 18, 2),
  ].join('');
}

function cornerStuds() {
  return rosette(30, 30, 13) + rosette(80, 52, 6) + rosette(52, 80, 6);
}

/**
 * The repeating rail: a continuous vine entering and leaving at the same
 * height, so one repeat flows into the next without a visible seam.
 */
function railOrnament() {
  const vine = 'M0 46 C 20 18, 44 18, 64 46 C 84 74, 108 74, 128 46'
    + ' L128 57 C 108 85, 84 85, 64 57 C 44 29, 20 29, 0 57 Z';
  return [
    vine,
    leaf(64, 46, 34, -Math.PI / 2 + 0.12, 26, 2),
    leaf(18, 34, 28, Math.PI * 0.30, 19, 2),
    leaf(110, 34, 28, Math.PI * 0.70, 19, 2),
    leaf(40, 62, 24, Math.PI * 0.62, 16, 2),
    leaf(88, 62, 24, Math.PI * 0.38, 16, 2),
  ].join('');
}

function railStuds() {
  return rosette(64, 76, 8) + rosette(0, 46, 5) + rosette(128, 46, 5);
}

/**
 * Carving is three passes: a cast shadow offset down-right, the modelled
 * body, then a highlight offset up-left. A single flat fill always reads
 * printed rather than carved.
 */
function relief(d, { light, dark }, stroke = 1.5) {
  return `<path d="${d}" fill="${dark}" opacity=".8" transform="translate(3.5,3.5)"/>`
    + `<path d="${d}" fill="url(#relief)" stroke="${dark}" stroke-width="${stroke}" stroke-linejoin="round"/>`
    + `<path d="${d}" fill="none" stroke="${light}" stroke-width="2" stroke-opacity=".95"`
    + ` stroke-linejoin="round" transform="translate(-1.8,-1.8)"/>`;
}

/* ------------------------------------------------------------- assembly -- */

function buildSvg(colours) {
  const { light, mid, deep, dark } = colours;
  const S = SLICE;
  const T = TILE;

  const corners = [
    '<use href="#cn"/>',
    `<use href="#cn" transform="translate(${T},0) scale(-1,1)"/>`,
    `<use href="#cn" transform="translate(0,${T}) scale(1,-1)"/>`,
    `<use href="#cn" transform="translate(${T},${T}) scale(-1,-1)"/>`,
  ].join('');

  const rails = [
    `<use href="#rl" transform="translate(${S},0)"/>`,
    `<use href="#rl" transform="translate(${S},${T}) scale(1,-1)"/>`,
    `<use href="#rl" transform="translate(0,${T}) rotate(-90) translate(${S},0)"/>`,
    `<use href="#rl" transform="translate(${T},0) rotate(90) translate(${S},0)"/>`,
  ].join('');

  const band = `M0 0H${T}V${T}H0Z M${S} ${S}H${T - S}V${T - S}H${S}Z`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${T} ${T}" width="${T}" height="${T}">
  <defs>
    <linearGradient id="metal" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${deep}"/><stop offset=".3" stop-color="${dark}"/>
      <stop offset=".58" stop-color="${deep}"/><stop offset=".82" stop-color="${dark}"/>
      <stop offset="1" stop-color="${deep}"/>
    </linearGradient>
    <linearGradient id="relief" x1=".1" y1="0" x2=".75" y2="1">
      <stop offset="0" stop-color="${light}"/><stop offset=".3" stop-color="${light}"/>
      <stop offset=".62" stop-color="${mid}"/><stop offset="1" stop-color="${deep}"/>
    </linearGradient>
    <g id="cn">${relief(cornerOrnament(), colours, 1.6)}<path d="${cornerStuds()}" fill="${light}" stroke="${dark}" stroke-width="1.2"/></g>
    <g id="rl">${relief(railOrnament(), colours, 1.5)}<path d="${railStuds()}" fill="${light}" stroke="${dark}" stroke-width="1.1"/></g>
  </defs>

  <path d="${band}" fill="url(#metal)" fill-rule="evenodd"/>
  <path d="M0 0H${T}V${T}H0Z M6 6H${T - 6}V${T - 6}H6Z" fill="${light}" fill-rule="evenodd" opacity=".9"/>
  <path d="M6 6H${T - 6}V${T - 6}H6Z M15 15H${T - 15}V${T - 15}H15Z" fill="${dark}" fill-rule="evenodd"/>

  ${rails}
  ${corners}

  <path d="M${S - 14} ${S - 14}H${T - S + 14}V${T - S + 14}H${S - 14}Z M${S - 7} ${S - 7}H${T - S + 7}V${T - S + 7}H${S - 7}Z"
        fill="${light}" fill-rule="evenodd" opacity=".95"/>
  <path d="M${S - 7} ${S - 7}H${T - S + 7}V${T - S + 7}H${S - 7}Z M${S} ${S}H${T - S}V${T - S}H${S}Z"
        fill="${dark}" fill-rule="evenodd"/>
</svg>`;
}

function toDataUri(svg) {
  return `url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg.replace(/\s{2,}/g, ' '))}")`;
}

function token(name, fallback) {
  try {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  } catch (_) { return fallback; }
}

/**
 * Build the ornament from the current gilt tokens and publish it as a custom
 * property, so every ornate frame on the page shares one decoded image.
 */
export function installOrnateFrame() {
  const colours = {
    light: token('--c-gilt-light', '#f0dcae'),
    mid: token('--c-gilt-mid', '#c6a45c'),
    deep: token('--c-gilt-deep', '#94703a'),
    dark: token('--c-gilt-shadow', '#5d431f'),
  };
  const key = Object.values(colours).join('|');
  if (!cache.has(key)) cache.set(key, toDataUri(buildSvg(colours)));
  document.documentElement.style.setProperty('--frame-ornate', cache.get(key));
  return key;
}
