# Customising the journal

Two ways to change how this looks, depending on how permanent you want it:

| | Where | Good for |
|---|---|---|
| **Design Studio** | In the app: Settings → Design studio | Trying things. 73 live controls, saved to your device, no code. |
| **The token layer** | `css/styles.css`, the `:root` block at the top | Changing the *defaults* everyone starts from. 103 tokens. |

They are the same values. The studio writes overrides as inline custom
properties on `<html>`; the stylesheet holds the defaults underneath. **Reset
to defaults** removes the overrides, so the two can never drift apart.

> **If you change a colour that carries text, check it.** The defaults are all
> at or above 4.5:1 against their background in both light and dark mode.
> Several palette colours are too light to hold small type on Porcelain —
> Honey Ochre is 1.7:1, Wallpaper Sage 2.3:1, Powder Blue 2.4:1. They are
> lovely as grounds and ornament; they are not text colours.

---

## 1. The Design Studio

**Settings → Design studio**, or go straight to `#/customize`.

Every control changes the page the moment you move it. Groups:

- **Appearance** — Always light / Always dark / Follow my device
- **Palette** — backgrounds, the three levels of text, rules, accent colour
- **Editorial banner** — sage ground, banner text, height, title size, paper texture
- **Typography** — the four typefaces, sizes, weights, letterspacing, line heights, label casing
- **Layout & spacing** — content width, page margins, section rhythm, header height, rule and progress-bar weights
- **Bookmarks** — width, height ratio, gaps, corner radius, cord, outline style, check size
- **Bookmark colourways** — the six ground/pattern pairs collected bookmarks draw from
- **Wording** — 19 editable strings: site name, every navigation label, banner lines, page headings

A dot (•) next to a control means you've changed it from the default.

### Starting points

Six presets:

- **A Reading Room** — the house style (clears every override)
- **Velvet Library** — Mahogany banner, Olive Velvet accent; the same palette inverted
- **Powder & Rose** — Powder Blue above, Faded Rose beneath
- **Sage & Parchment** — the journal's first look, kept so you can go back
- **Ink & Ivory** — almost monochrome
- **Bodoni Editorial** — type only; keeps whatever colours you're on

A preset replaces all colour and type overrides. It never touches your books,
challenges or bookmarks.

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

The house palette is **"A Reading Room in Color"**:

| | Hex | Where it lives |
|---|---|---|
| Porcelain | `#F8F0E4` | the page (`--c-bg`) |
| Mahogany | `#4B2828` | all type (`--c-ink`), bookmark 2 |
| Olive Velvet | `#536E50` | the banner (`--c-banner-bg`), "complete" |
| Wallpaper Sage | `#8FA58B` | bookmark 1 |
| Burnt Apricot | `#D4763C` | bookmark 3, and the accent's parent colour |
| Powder Blue | `#7D9FCF` | bookmark 4 |
| Faded Rose | `#C9787E` | bookmark 5 |
| Honey Ochre | `#E0B35A` | bookmark 6, ink on Mahogany |

```css
--c-bg: #f8f0e4;        /* Porcelain */
--c-ink: #4b2828;       /* Mahogany */
--c-banner-bg: #536e50; /* Olive Velvet */
--c-accent: #a8482a;    /* Burnt Apricot, deepened — see below */
--c-rule: #e3d6c3;      /* Porcelain pulled toward Mahogany */
```

Two notes on how the palette was fitted to the interface:

- **The accent is a deepened Burnt Apricot (`#a8482a`), not the literal
  `#d4763c`.** At its true value Burnt Apricot only reaches 2.9:1 against
  Porcelain — too light for links, the current nav item and button text. The
  literal hex is used on the bookmarks, where it carries no small type.
- **The banner is Olive Velvet, not Wallpaper Sage.** Sage gives the small
  letterspaced eyebrow only 2.3:1; Olive Velvet gives it 5.0:1. If you prefer
  the lighter green, change `--c-banner-bg` to `#8fa58b` and raise
  `--c-banner-ink` to pure white — and accept the softer eyebrow.

Also `--c-ink-soft` / `--c-ink-faint` (secondary and caption text),
`--c-rose`, `--c-blue`, `--c-terracotta`, `--c-gold`, `--c-sage` for ornament,
and `--c-bm1-bg` … `--c-bm6-ink` for the six bookmark colourways.

**Where the colour shows up.** Each goal bar takes its own hue (annual =
Burnt Apricot, quarter = Powder Blue, nonfiction = Honey Ochre) via the
`.bar-apricot` / `.bar-blue` / `.bar-gold` / `.bar-rose` / `.bar-sage`
modifiers — pass `tone` to `progressBar()` or `progressLine()`. Book flags are
colour-coded the same way: Fiction apricot, Classic rose, Re-read blue,
Physical TBR gold, Nonfiction sage.

**Text vs. fill.** Lighter swatches get a deepened `*-ink` variant for text
(`--c-rose-ink`, `--c-blue-ink`, `--c-gold-ink`) while the literal hue stays on
the dot beside it and on bars and bookmarks. That is the rule throughout: full
strength where nothing must be read, deepened where something must.

### Light and dark

**The journal is light by default** — Porcelain is the house ground, and the
dark palette is opt-in. It is *not* tied to your operating system unless you
ask for that in the studio's **Appearance** control.

How it works: `js/theme.js` resolves your choice (`light`, `dark` or `system`)
and stamps `data-theme="light"` or `data-theme="dark"` on `<html>`. The dark
palette is a single plain rule — `:root[data-theme="dark"]` — re-tinting the
same token names, so components never change. A small inline script in
`index.html` replays the choice before first paint, so switching never
flashes the wrong palette.

The choice is saved with the rest of your design, travels in the design
export, and rides inside the ordinary device backup.

### Typography

```css
--f-script:  'Pinyon Script', …;  /* wordmark, and the banner's swash initial */
--f-display: 'Bodoni Moda', …;    /* headlines, set in caps */
--f-body:    'EB Garamond', …;    /* reading text */
--f-ui:      'Jost', …;           /* letterspaced small caps, nav, buttons */
```

Four faces, each with a job: a high-contrast Didone for display, a geometric
sans for the letterspaced labels, a formal script for the wordmark and the
banner initial, and a warm serif for anything read at length.

Sizes are `--fs-*`, weights `--fw-*`, letterspacing `--ls-*`, line heights
`--lh-*`. `--tt-label` flips small-caps labels to sentence case and
`--tt-display` does the same for headlines — set it to `none` to put the
display face back into mixed case.

**The banner's script initial.** The first letter of the banner title is set
in the script face — it *is* the letter, not an overlay, so the title still
reads and copies as plain text. `--banner-swash-display: none` turns it off;
`--banner-swash-scale` sizes it. `--c-banner-accent` colours the title and the
initial (brightened Honey Ochre by default — display sizes only, since at
label size it falls under the contrast floor).

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
