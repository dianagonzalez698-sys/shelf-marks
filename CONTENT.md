# The visual content system

How pictures and page compositions work. For colours, type and spacing see
**[CUSTOMIZATION.md](CUSTOMIZATION.md)**.

Three workbenches, all under Settings → Design studio:

| | Where | What it does |
|---|---|---|
| **Design** | `#/customize` | Colours, typefaces, spacing, bookmarks |
| **Layouts** | `#/layout` | Add, reorder, hide and configure the sections on each page |
| **Pictures** | `#/assets` | Your library of artwork, photographs, cutouts and papers |

---

## 1. Pictures

**Settings → Design studio → Pictures.** Add paintings, photographs,
transparent cutouts, paper textures and small ornaments. Everything you add
becomes available to *every* image slot in the journal.

Five kinds, which only affect how the file is stored:

| Kind | Stored as | Longest edge |
|---|---|---|
| Artwork / painting | JPEG | 1800px |
| Photograph | JPEG | 1600px |
| Cutout (transparent PNG) | **PNG** — keeps transparency | 1200px |
| Texture / paper | JPEG | 1200px |
| Small ornament or sticker | **PNG** — keeps transparency | 700px |

Pictures live in this browser's database and travel inside the ordinary backup
(Settings → Export backup), so moving to your iPad brings them with you.

> **Keep an eye on the total.** The library warns past ~18MB. Everything is
> downscaled and re-encoded on the way in — a 1.4MB PNG painting becomes about
> 32KB — but hundreds of pictures will still make the backup file slow to move.

Nothing breaks if a slot is empty: it renders as a tinted paper plate, which is
why the layouts look deliberate before you have uploaded anything.

---

## 2. Placing a picture

Every picture anywhere — hero backdrops, collage layers, challenge covers — is
the same descriptor, edited through the same panel. Open any **Edit** on a
section and click a picture slot.

| Control | What it does |
|---|---|
| Picture | Which image from your library (or none) |
| Frame | Carved gilt (baroque), gilt museum frame, gilt oval, antique bronze, paper plate, polaroid, torn edge, oval, arch, hairline, postage stamp, none |
| Shape | Square, portrait, landscape, panorama, or the picture's natural ratio |
| Crop | Fill the shape, or fit the whole picture inside it |
| Focal point | Horizontal and vertical — what stays in frame when cropped |
| Width | Percentage of its slot |
| Tilt | −20° to +20° |
| Opacity | For washes and background layers |
| Layer order | Which picture sits on top in a collage |
| Nudge across / down | Offsets, for arranging overlaps |
| Tape | A washi strip, or two corners |
| Drop shadow | On or off |
| Hide on phones | For decorative layers that crowd a small screen |
| Caption | Printed under the picture — in script, inside a polaroid |

Tilts and offsets are flattened on narrow screens automatically, so a collage
becomes a clean stack rather than a mess.

> **Frames only apply to framed pictures, not backgrounds.** A hero's
> *Background image* fills the whole banner, so it uses just the picture, the
> focal point and opacity — the editor now hides the rest and says so. To hang
> a framed picture on a hero, tick **Show a framed photo on top** and set the
> frame on that.

**The carved gilt frame** is a different animal from the others. Its acanthus
scrollwork and corner cartouches are drawn as SVG in `js/frames.js` and applied
with `border-image`, so the corners render once and the rails repeat along each
side at any length. It is generated from the same four gilt tokens, so
re-tinting the gilding re-tints the carving. Give it room — the ornament needs
width to read, so it suits a hero photo or a split composition better than a
thumbnail.

**The gilt and bronze frames** are built from layered gradients rather than an image, so
they stay sharp at any size and cost nothing to load. Four tokens set the
gilding — highlight, mid-tone, shadow and rebate — under Design studio →
Design → **Picture frames**, along with the moulding width. A caption under a
gilt frame is set as a letterspaced museum label; under a polaroid it is set in
script, inside the border. The oval suits vintage portraits and miniatures.

---

## 2b. Picture dimensions

Every picture slot shows its recommended size in the editor, so you rarely
need this table. Anything larger is scaled down on upload; anything much
smaller will look soft.

| Slot | Size | Shape |
|---|---|---|
| Section background / hero background | **1800 × 1100 px** | landscape, 16:10 |
| Hero's framed photo | **900 × 1125 px** | portrait, 4:5 |
| Image & text picture | **1200 × 1500 px** | portrait, 4:5 |
| Collage pictures | **1000 × 1250 px** each | portrait, 4:5 |
| Gallery pictures | **800 × 1000 px** each | portrait, 4:5 |
| Decorative image strip | **1800 × 260 px** | wide band |
| Your own section edge | **1800 × 140 px** | transparent PNG |

Shape is only a suggestion — the **Shape** control re-crops any picture to
square, portrait, landscape or panorama, and the **focal point** decides what
stays in frame.

Hard ceilings on upload, by kind: artwork 1800 px on its longest edge,
photographs 1600, cutouts 1200, textures 1200, ornaments 700.

---

## 3. Sections

**Settings → Design studio → Layouts.** Pick a page, then add, reorder, hide
or configure its sections. Reordering is the ↑ ↓ buttons; **Reset page**
returns to the default arrangement.

> **If a picture you placed doesn't appear**, check the section's
> **Shown / Hidden** switch. A hidden section renders nothing at all — its
> pictures and settings are kept, they just aren't drawn. The editor warns you
> at the top of the page when anything is hidden.

Pages you can compose:

- **The journal (home)**
- **Challenge index**
- **Each challenge individually** — changing one creates an arrangement just
  for that challenge; others keep the shared spread.

### The twelve section types

| Type | What it is |
|---|---|
| Image hero | Full-bleed artwork with oversized type over it, and an optional pinned photo |
| Image & text | A picture one side, an editorial column the other, with a drop capital |
| Layered collage | Overlapping pictures, tilted and taped like a scrapbook page |
| Gallery | A measured row or grid, optionally staggered |
| Typographic statement | A pull quote, letterspaced caps, or script |
| Decorative interlude | An ornament rule, a thin image strip, or a plain rule |
| Handwritten note | A line in the script face, set at an angle |
| Reading progress | *Live* — year, quarter and nonfiction share |
| This period | *Live* — this quarter's classic, re-read and TBR book |
| Challenge collection | *Live* — your challenges as alternating spreads or a list |
| Bookmark collection | *Live* — recently earned, or everything by challenge |
| Recent reading | *Live* — latest books finished, with covers |

The six **live** types are real features wearing editorial clothes. Hiding one
hides the presentation, never the data.

### Every section's own background

Whatever its type, every section takes:

- **Background colour** — paper, or one of six palette tints (olive and
  mahogany are full strength and flip the type to light automatically)
- **Background photograph** — any picture from your library, bleeding the full
  width while the contents stay in column
- **Darken the photograph** — the scrim between the picture and the type
- **Type over the photograph** — Light or Dark, so you can run a pale wash over
  a bright picture and keep mahogany type, or darken a photo and set it in gold
- **Vertical space** — tight, normal, loose, or flush

A section on a dark ground re-tints everything inside it: headings, captions,
rules, progress bars and bookmark labels all move to the banner palette.

### The seam between sections

One setting: **Edge treatment**.

| Choice | What happens |
|---|---|
| **None** | A straight edge |
| **Torn paper · Scalloped · Lace · Soft wave · Dissolve** | The section is *cut* into that shape. Needs a background colour or photograph to cut into. |
| **My own artwork…** | Your picture is *shown*, laid across the seam. Works on any section. |

Choosing it reveals only what applies:

- A preset shape adds **Size** (how deep the cut bites)
- **My own artwork** adds **Artwork**, **Where it goes** (bottom, top or both),
  **Size** (the band's height) and **Hang over the edge** (how far it drapes
  onto the section below — this is what gives the layered, pasted-in look)

For artwork, use a **transparent PNG, 1800 × 200 px**, added to the library as
a **Cutout** so the page shows through around it. A picture with no
transparency will draw as a solid block; the editor says so if it spots one.

**Empty margins are trimmed automatically.** Decorative PNGs usually come
drawn inside a larger canvas with transparent space around them. That space is
still part of the picture, so the artwork would float in the middle of its band
rather than filling it — which looks like the band is in the wrong place.
Cut-outs are cropped to their drawing when added, and anything already in the
library is cropped the next time the app opens.

**Hang below the edge** is a share of the band's own height, so it means the
same thing whatever size you pick:

- **0%** — the band sits inside the section, over its own background
- **50%** — it straddles the seam
- **100%** — its top edge lands exactly on the section's bottom, and the whole
  band hangs onto the section below

At 100% the section reserves the drop, so the band drapes over the section
beneath without covering its text — and the section's own height is unchanged.

For two plain paper sections meeting, use a **Decorative interlude** between
them — its **Lace band** and **Vine band** modes draw an ornamental divider,
and **Image strip** takes your own band.

---

## 4. Changing things in code

| What | Where |
|---|---|
| Add a new section type | `js/sections.js` — add an entry to `SECTION_TYPES` with `create()`, `fields` and `render()`. It appears in the editor automatically. |
| Change a page's default arrangement | `js/layout.js` — `defaultLayout()` |
| Add a frame, shape or tape style | `js/media.js` (`FRAMES`, `RATIOS`, `TAPES`) + the matching `.mf-*` rule in `css/styles.css`. Style the `.m-mount` inside the frame, not the figure — the figure handles placement, the mount is the framed object, and the caption sits outside it. |
| Re-tint the gilt frame | Design studio → Design → **Picture frames**, or `--c-gilt-*` in `css/styles.css` |
| Change how uploads are stored | `js/assets.js` — `MAX_EDGE`, `JPEG_QUALITY`, `KINDS` |
| Restyle a section | `css/styles.css`, under **EDITORIAL SECTIONS** |
| The empty-plate tints | `css/styles.css` — `.m-tint-*` |
| The painterly empty hero | `css/styles.css` — `.hero .m-backdrop-empty` |

A section type is just data plus a render function, so adding one never means
touching the pages that use it.
