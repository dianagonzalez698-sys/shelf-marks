# Customising the journal

Two ways to change how this looks, depending on how permanent you want it:

| | Where | Good for |
|---|---|---|
| **Design Studio** | In the app: Settings → Design studio | Trying things. 73 live controls, saved to your device, no code. |
| **The token layer** | `css/styles.css`, the `:root` block at the top | Changing the *defaults* everyone starts from. 103 tokens. |

They are the same values. The studio writes overrides as inline custom
properties on `<html>`; the stylesheet holds the defaults underneath. **Reset
to defaults** removes the overrides, so the two can never drift apart.

---

## 1. The Design Studio

**Settings → Design studio**, or go straight to `#/customize`.

Every control changes the page the moment you move it. Groups:

- **Palette** — backgrounds, the three levels of text, rules, accent colour
- **Editorial banner** — sage ground, banner text, height, title size, paper texture
- **Typography** — the four typefaces, sizes, weights, letterspacing, line heights, label casing
- **Layout & spacing** — content width, page margins, section rhythm, header height, rule and progress-bar weights
- **Bookmarks** — width, height ratio, gaps, corner radius, cord, outline style, check size
- **Bookmark colourways** — the six ground/pattern pairs collected bookmarks draw from
- **Wording** — 19 editable strings: site name, every navigation label, banner lines, page headings

A dot (•) next to a control means you've changed it from the default.

### Starting points

Four presets: **Sage & Parchment** (the house style), **Oxblood Library**,
**Ink & Ivory**, **Bodoni Editorial**. A preset replaces all colour and type
overrides. It never touches your books, challenges or bookmarks.

### Keeping and sharing a design

- **Export design** downloads a small JSON file of just your overrides.
- **Import design** reads one back. Unknown tokens are ignored, so a file from
  a future version won't break anything.
- **Reset to defaults** returns to the stylesheet.
- Your design also rides inside the ordinary backup (Settings → Export backup),
  so syncing your iPad brings the look across too.

Saved to IndexedDB, mirrored to `localStorage` so a customised theme never
flashes the default styling on load.

---

## 2. Editing the defaults in CSS

Open `css/styles.css`. Everything is in the `:root` block at the top, grouped
and commented. Nothing else in the file contains a literal colour or size —
components only ever say `var(--…)`.

### Colour

```css
--c-bg: #f6f1e6;        /* warm ivory page */
--c-ink: #342a21;       /* deep espresso text */
--c-accent: #7b2b2b;    /* oxblood: progress, selected states */
--c-banner-bg: #8b9a7b; /* the sage editorial banner */
--c-rule: #ddd3c1;      /* hairlines */
```

Also `--c-ink-soft` / `--c-ink-faint` (secondary and caption text),
`--c-rose`, `--c-blue`, `--c-terracotta`, `--c-gold`, `--c-sage` for accents,
and `--c-bm1-bg` … `--c-bm6-ink` for the bookmark colourways.

Dark mode re-tints the same names inside
`@media (prefers-color-scheme: dark)`. Components never change.

### Typography

```css
--f-script:  'Pinyon Script', …;      /* the wordmark */
--f-display: 'Cormorant Garamond', …; /* headings, big numerals */
--f-body:    'EB Garamond', …;        /* reading text */
--f-ui:      'EB Garamond', …;        /* labels, navigation, buttons */
```

Sizes are `--fs-*`, weights `--fw-*`, letterspacing `--ls-*`, line heights
`--lh-*`. `--tt-label` flips every small-caps label to sentence case.

To use a different webfont, add it to the Google Fonts `<link>` in
`index.html`, then add the stack to `FONT_STACKS` in `js/theme.js` so it shows
up in the studio's dropdowns.

### Layout

```css
--w-content: 1180px;   /* the reading column */
--w-prose: 720px;      /* forms and long text */
--sp-section: clamp(2.2rem, 5vw, 3.6rem);
--h-banner: clamp(148px, 27vw, 300px);
--r-sm: 2px;           /* corners stay nearly square on purpose */
```

### Bookmarks

```css
--bm-w: 104px;        /* width — this is what sets the column count */
--bm-ratio: 3;        /* height = width x ratio */
--bm-gap-x / --bm-gap-y
--bm-cord-show: block;  /* `none` removes the hanging cord */
--bm-empty-dash: 0;     /* 5 = dashed outline, 2 = dotted */
```

The grid is `repeat(auto-fit, minmax(0, calc(var(--bm-w) * var(--bm-scale))))`
and centred, so **columns follow from the width** — make bookmarks narrower to
fit more per row, wider to fit fewer. Any number of bookmarks reflows cleanly;
nothing is hard-coded to nine. `--bm-row-max` caps the row if you want to force
an earlier wrap.

> **One rule worth knowing.** Anything the studio can override must not be
> re-declared inside a media query — an inline style on `<html>` outranks every
> stylesheet rule, so the responsive version would stop working. Fluid tokens
> use `clamp()` instead, and bookmark width scales through the internal
> `--bm-scale` multiplier. If you add a new user-editable token, follow the
> same pattern.

---

## 3. Changing the content

All visible wording lives in `CONTENT_DEFAULTS` in `js/theme.js` and is
editable in the studio's **Wording** group. `{year}` in any string is replaced
with the challenge year.

Shell text (wordmark, navigation, banner) is bound by `data-content="key"`
attributes in `index.html`. Views read the same strings via `t('key')`.
To add one: add it to `CONTENT_DEFAULTS` and `CONTENT_SCHEMA`, then either put
`data-content="yourKey"` on an element or call `t('yourKey')` in a view.

---

## 4. Challenges and bookmarks are data

Challenges live in `PRESET_CHALLENGES` in `js/config.js` and run through a
generic engine in `js/rules.js`. There is no per-challenge logic anywhere.

```js
{
  id: 'classic-every-quarter',
  name: 'Classic Every Quarter',
  blurb: 'One book marked Classic in each quarter of 2027.',
  filter: { type: 'classic' },                     // any | author | series | tag
                                                   // nonfiction | fiction | classic | reread | tbr
  window: { type: 'recurring', periods: 'quarters' },  // year | quarter | range | recurring
  target: 1,                                       // per period when recurring
  bookmarks: { Q1: 'classic-q1', /* … */ },
  bonusBookmark: 'classic-all',
}
```

Add as many as you like — nothing caps the count. You can also build them in
the app (Challenges → **New challenge**), which writes the same shape.

Bookmark artwork is generated in `js/ui.js` (`bookmarkBody`). Each bookmark
picks one of six colourways and one of six motifs from a hash of its id, so it
always looks the same. The motifs are rectangles and rules only, which is why
they stay clean at any `--bm-ratio`; the star and the cord sit outside the
stretched SVG so they never distort.

---

## 5. Where things live

```
css/styles.css          the token layer, then components that only use var(--…)
js/theme.js             token schema, presets, persistence, export/import
js/view-customize.js    the Design Studio
index.html              shell: masthead, banner, tab bar, [data-content] bindings
js/ui.js                router, bookmark artwork, progress, sheets, toasts
js/config.js            challenge presets and goal defaults
js/rules.js             the challenge engine
```
