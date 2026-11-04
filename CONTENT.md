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
| Frame | None, paper plate, polaroid, torn edge, oval, arch, hairline, postage stamp |
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

Every section also takes a **background** (paper, or one of six palette tints)
and a **vertical space** setting.

---

## 4. Changing things in code

| What | Where |
|---|---|
| Add a new section type | `js/sections.js` — add an entry to `SECTION_TYPES` with `create()`, `fields` and `render()`. It appears in the editor automatically. |
| Change a page's default arrangement | `js/layout.js` — `defaultLayout()` |
| Add a frame, shape or tape style | `js/media.js` (`FRAMES`, `RATIOS`, `TAPES`) + the matching `.mf-*` rule in `css/styles.css` |
| Change how uploads are stored | `js/assets.js` — `MAX_EDGE`, `JPEG_QUALITY`, `KINDS` |
| Restyle a section | `css/styles.css`, under **EDITORIAL SECTIONS** |
| The empty-plate tints | `css/styles.css` — `.m-tint-*` |
| The painterly empty hero | `css/styles.css` — `.hero .m-backdrop-empty` |

A section type is just data plus a render function, so adding one never means
touching the pages that use it.
