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
- **My own artwork** adds **Artwork**, **Where it goes** (bottom, top or both)
  and **Size** (the band's height)

For artwork, use a **transparent PNG, 1800 × 200 px**, added to the library as
a **Cutout** so the page shows through around it. A picture with no
transparency will draw as a solid block; the editor says so if it spots one.

**Empty margins are trimmed automatically.** Decorative PNGs usually come
drawn inside a larger canvas with transparent space around them. That space is
still part of the picture, so the artwork would float in the middle of its band
rather than filling it — which looks like the band is in the wrong place.
Cut-outs are cropped to their drawing when added, and anything already in the
library is cropped the next time the app opens.

**A band always hangs clear of its edge.** On the bottom, its top edge lands
exactly on the section's bottom, and the whole band drapes onto the section
below; on the top, its bottom edge lands on the section's top. Nothing of the
section shows beneath a bottom band — that is the layered, pasted-in look, and
it is the only placement, so there is no offset to get wrong.

The section beneath reserves the drop, so the band drapes over it without
covering its text — and the section's own height is unchanged, which is why
**Size** never shortens your banner.

For two plain paper sections meeting, use a **Decorative interlude** between
them — its **Lace band** and **Vine band** modes draw an ornamental divider,
and **Image strip** takes your own band.

## Every page is its layout

The Layouts editor lists **everything** a page draws. There are no blocks
hidden in the code behind it: if you can see it on the page, it is a row in the
list, and it can be reordered, hidden, restyled or removed.

| Page | What it is made of |
|---|---|
| The journal (home) | Hero, progress, this period, challenges, bookmarks, recent reading |
| Challenge index | Hero, the challenge list, a margin note |
| **My Books** | The shelf — heading, filter chips, tally and list |
| **The bookmark archive** | The archive — every bookmark, grouped by challenge |
| **Challenge — *each one*** | Opening, bookmarks, the record — plus anything you add |

Some sections belong to one page and only appear in **Add a section** there:
*Challenge — opening*, *— bookmarks* and *— the record* on a challenge spread,
*The shelf* on My Books, *The bookmark archive* on the archive. They draw from
whatever that page is about, so the same *Challenge — opening* section shows
each challenge its own cover, name and window.

Earlier versions drew a challenge spread's opening, bookmarks and record
straight from the code, so the editor listed only the sections you had added on
top of them. They are ordinary sections now. An arrangement saved before that
change keeps everything it had — the three blocks are added back at the top the
first time you open the app, and you can move or delete them from there.

### Type and colour, section by section

The Design Studio sets the typography for the whole journal. Every section can
depart from it on its own — open a section's **Edit** panel and scroll to the
bottom. Four rows, one per role:

| Row | What it re-types |
|---|---|
| **Headings** | The big display line, and any subheading |
| **Body text** | Running text, captions, metadata |
| **Small labels** | The letterspaced eyebrow above a heading |
| **Script initial** | The swash first letter, where one is on |

Each row is a typeface and a colour. Tap the typeface to open a specimen list —
21 faces, grouped, **each one drawn in itself** so you can see what you are
picking. Tap the dot for colour: your palette first, then a colour wheel and a
hex box for anything else. Both panels open inside the row and close when you
choose.

Both start at **Match the site**, so a section looks exactly as it does now
until you move something. The crossed swatch (first in the colour row) hands it
back.

**A colour you set here wins over the automatic light-on-dark flip.** A section
over a photograph or a deep tone normally switches its type to the pale banner
colours; an explicit colour overrides that, because you asked for it by name.
If a section goes hard to read over its background, that is the usual cause —
clear the colour and the automatic behaviour comes back.

### Your phone is a separate journal until you move it there

Everything — books, layouts, pictures, typography, palette — is stored **on the
device you made it on**. Nothing syncs by itself; there is no account and no
server, which is what keeps the journal private and free. A phone that has
never been given your data shows the stock templates, and that looks exactly
like the site failing to update.

To put your journal on another device:

1. On the device you have been designing on: **Settings → Export backup**.
   One `.json` file; your design, pictures and books all ride along.
2. Get the file to the other device — AirDrop, iCloud Drive, or email it to
   yourself.
3. On the phone: **Settings → Import backup**, and pick the file.

Items merge by id and the more recently edited copy wins, so importing is safe
in either direction and can be repeated whenever the two drift apart. A device
with nothing on it yet says so, right above those buttons.

## Panels stack

Opening a picture from inside a section's panel used to replace that panel, so
closing the picture dropped you back at the page with the section to find
again. Panels open on top of one another now: **Back** at the top of the inner
one returns you to the outer, and Cancel, Done, Escape and tapping outside all
mean the same thing. Only the outermost panel closes outright.

A panel you come back to is rebuilt rather than restored from a snapshot, so
it shows the picture you just chose instead of the one that was there before.

## Bookmarks sit on one line

A challenge's bookmarks are one set, so they are drawn as one row rather than
wrapping onto a second line. They take their natural width when there is room
and shrink when there is not; below **44px** each the row scrolls sideways
instead of shrinking further, which is what happens to a six- or seven-mark
challenge on a phone.

Two tokens in the Design Studio govern it: **--bm-w** (a bookmark's natural
width) and **--bm-min** (how small one may get before the row scrolls).

## A challenge's cover picture

The picture on a challenge — the one filling its card on the index and backing
its spread's opening — is set on the challenge itself: **open the challenge,
then Cover** in the top bar. Best around **1800 × 1100 px**.

It lives on the challenge rather than on a section because two different
sections draw it: the card in the index and the spread's own opening. Setting
it once fills both. Preset challenges take a cover the same way as ones you
made yourself.

## Eligible books

Every challenge spread carries an **Eligible books** section: which of your
books count toward it, and why.

A challenge's rule decides by default — *marked Classic*, *re-read*, *physical
TBR*. But some things a rule cannot say. "Joan Didion and authors like her" is
not a checkbox, so that challenge could never count anything on its own.

**Choose books** opens a list of everything you have logged, ticked to show
what counts now. Tick one the rule misses and it counts anyway; untick one the
rule caught and it stops. Each book in the section says which it was —
*matches the rule* or *chosen by hand*.

Hand-picking only records a difference. Tick a book that already matches and no
override is stored; untick it later and the rule simply applies again. So a
challenge whose rule works needs no maintenance, and one whose rule cannot
work is still usable.

Books that qualify but fall outside the challenge's dates are listed too,
marked as outside — they are eligible, they just are not counting this time.
Turn that off in the section's settings if you would rather not see them.

A bookmark in the archive links straight here: **Go to eligible books** opens
the challenge and lands on the section.

## Word of the year

A word you kept meeting — *pantomime* for 2026 — gets a section and a page of
its own.

**Settings → Words of the year → Add a word.** Give it the word, what to call
it (*Word of the Year*, *Word of the Summer* — anything), the year or season it
belongs to, and a line about why it stuck. Then, in the same panel, put a
number against each book: **how many times the word turned up in it**. Leave a
book blank if it never did.

Counting per book rather than just ticking the books is what makes the tally
worth having — the interesting question is not only how many books carried the
word but which one was steeped in it.

**On any page**, add a **Word of the year** section. The word is set as large
as the measure allows, with an optional picture beside it, and the line
underneath links to the word's own page. The section can point at a particular
word or just follow the newest one.

**The word's page** — reached from that link, or from Settings → Words —
carries the word again, then every book it turned up in, commonest first, with
the tally for each and four figures across the top:

| Figure | What it counts |
|---|---|
| **Books** | How many books the word appeared in |
| **Times in all** | Every appearance added up |
| **Average a book** | Times in all, divided by books |
| **Of everything read** | Those books as a share of your whole log |

Underneath, a line names the book it was thickest in. The page is built from
its layout like every other, so its arrangement is yours to change — and each
word gets its own entry in the Layouts page list.

### Light and dark

The sun/moon in the top right switches the journal between them, one tap, and
it remembers. **Follow my device** (in the Design Studio, under Mode) is also
available: on that setting a phone in dark mode shows the journal dark, which
is easy to mistake for being stuck. Tapping the toggle always lands on an
explicit light or dark, so one tap gets you out of it either way.

### A curtain around a section

**Edge treatment → Curtain / full frame** hangs a curtain from the top of a
section: valance across the top, drapes down both sides, the page showing
through the opening between them.

Give it **one picture of the whole curtain**, centre cut out, added to the
library as a **Cutout**. Wide suits the job — around **2400 × 1000 px**. Up to
1800px on the long edge is kept at full resolution.

One slider: **How far the curtain hangs**, 8–60% of the window's width. Nothing
else to set — the drape width, the scalloped hem and the shape of the arch are
all the picture's, and they are drawn exactly as painted.

**The picture is drawn whole, not cut into a frame.** An earlier version sliced
it into nine pieces so the drapes could stretch to any height. That is how CSS
frames usually work, but a nine-slice's opening is a *rectangle* — straight
inner edges, square corners — so an arched curtain came out as a box with the
arch visible only along the top. Drawn whole, the silhouette is the one you
painted.

What follows from that: the curtain hangs as far as you set and the section
continues below it, the way a real curtain hangs from above rather than lining
a doorway top to bottom. Content is inset past the drapes and below the lowest
point of the arch, both measured from the picture itself.

A picture with no see-through centre cannot be a curtain, and the editor says
so rather than drawing nothing. On a phone the whole thing hangs shallower,
since a narrow screen cannot spare a third of its width on cloth.

## Panels stack

Opening a picture from inside a section's panel used to replace that panel, so
closing the picture dropped you back at the page with the section to find
again. Panels open on top of one another now: **Back** at the top of the inner
one returns you to the outer, and Cancel, Done, Escape and tapping outside all
mean the same thing. Only the outermost panel closes outright.

A panel you come back to is rebuilt rather than restored from a snapshot, so
it shows the picture you just chose instead of the one that was there before.

## Bookmarks sit on one line

A challenge's bookmarks are one set, so they are drawn as one row rather than
wrapping onto a second line. They take their natural width when there is room
and shrink when there is not; below **44px** each the row scrolls sideways
instead of shrinking further, which is what happens to a six- or seven-mark
challenge on a phone.

Two tokens in the Design Studio govern it: **--bm-w** (a bookmark's natural
width) and **--bm-min** (how small one may get before the row scrolls).

## A challenge's cover picture

The picture on a challenge — the one filling its card on the index and backing
its spread's opening — is set on the challenge itself: **open the challenge,
then Cover** in the top bar. Best around **1800 × 1100 px**.

It lives on the challenge rather than on a section because two different
sections draw it: the card in the index and the spread's own opening. Setting
it once fills both. Preset challenges take a cover the same way as ones you
made yourself.

## Eligible books

Every challenge spread carries an **Eligible books** section: which of your
books count toward it, and why.

A challenge's rule decides by default — *marked Classic*, *re-read*, *physical
TBR*. But some things a rule cannot say. "Joan Didion and authors like her" is
not a checkbox, so that challenge could never count anything on its own.

**Choose books** opens a list of everything you have logged, ticked to show
what counts now. Tick one the rule misses and it counts anyway; untick one the
rule caught and it stops. Each book in the section says which it was —
*matches the rule* or *chosen by hand*.

Hand-picking only records a difference. Tick a book that already matches and no
override is stored; untick it later and the rule simply applies again. So a
challenge whose rule works needs no maintenance, and one whose rule cannot
work is still usable.

Books that qualify but fall outside the challenge's dates are listed too,
marked as outside — they are eligible, they just are not counting this time.
Turn that off in the section's settings if you would rather not see them.

A bookmark in the archive links straight here: **Go to eligible books** opens
the challenge and lands on the section.

## Word of the year

A word you kept meeting — *pantomime* for 2026 — gets a section and a page of
its own.

**Settings → Words of the year → Add a word.** Give it the word, what to call
it (*Word of the Year*, *Word of the Summer* — anything), the year or season it
belongs to, and a line about why it stuck. Then, in the same panel, put a
number against each book: **how many times the word turned up in it**. Leave a
book blank if it never did.

Counting per book rather than just ticking the books is what makes the tally
worth having — the interesting question is not only how many books carried the
word but which one was steeped in it.

**On any page**, add a **Word of the year** section. The word is set as large
as the measure allows, with an optional picture beside it, and the line
underneath links to the word's own page. The section can point at a particular
word or just follow the newest one.

**The word's page** — reached from that link, or from Settings → Words —
carries the word again, then every book it turned up in, commonest first, with
the tally for each and four figures across the top:

| Figure | What it counts |
|---|---|
| **Books** | How many books the word appeared in |
| **Times in all** | Every appearance added up |
| **Average a book** | Times in all, divided by books |
| **Of everything read** | Those books as a share of your whole log |

Underneath, a line names the book it was thickest in. The page is built from
its layout like every other, so its arrangement is yours to change — and each
word gets its own entry in the Layouts page list.

### Light and dark

The sun/moon in the top right switches the journal between them, one tap, and
it remembers. **Follow my device** (in the Design Studio, under Mode) is also
available: on that setting a phone in dark mode shows the journal dark, which
is easy to mistake for being stuck. Tapping the toggle always lands on an
explicit light or dark, so one tap gets you out of it either way.

### A curtain around a whole section

**Edge treatment → Curtain / full frame** wraps a section in a proscenium:
valance across the top, drapes down both sides, tied-back bunches in the
corners — the full stage-curtain look rather than a band along one edge.

Give it **one picture of the whole curtain**, centre cut out, added to the
library as a **Cutout**. Roughly **1600 × 1200 px**; the exact size doesn't
matter, the proportions do.

It is drawn as a nine-slice, which is what makes it work at any height: the
corners stay put, the valance repeats along the top, and the drapes stretch
down however far the section runs. A plain background image can't do this —
it would squash the valance on a tall section and stretch it flat on a short
one.

**Where the drapes end and the opening begins is measured from your picture
when you add it**, by finding the see-through middle. So the only thing to set
is **how wide the drapes hang** — everything else keeps the curtain's own
proportions. A picture with no transparent centre can't be a frame, and the
editor says so rather than drawing nothing.

**Put it on the section you want framed — not on the banner above it.** The
valance is the top of the frame, so the section it belongs to is the one whose
sides the drapes run down. To get a valance under the hero with drapes
continuing down the page, set the curtain on the section *below* the hero and
set the hero's own edge back to **None**, or you end up with two valances
stacked.

A curtained section runs the full width of the window — a curtain hangs off
the edges of the page, not off the edges of the text column. Content inside it
is pushed in from the drapes and down past the valance, so nothing sits behind
the cloth.

Two sliders, both a share of the window's width:

- **How wide the drapes hang** — 3–28%, starting at 10.
- **How deep the valance hangs** — 0–26%. At **0** it follows the picture's own
  proportions; set it and the valance is yours to control.

They are separate on purpose. Keeping them locked is honest to the picture, but
a curtain drawn around a squarish opening then throws an enormous pelmet across
a wide, short section. A nine-slice's edges are independent, so yours are too.

**What makes a good curtain picture.** Draw it for the shape it has to fill: a
web section is wide and not very tall, so a **wide** source works far better
than a square one — around **2400 × 1000 px**, with the valance shallow
relative to the width and the drapes occupying roughly the outer sixth on each
side. Up to 1800px on the long edge is kept at full resolution. A squarish
frame can be made to fit with the two sliders, but its drapes are being
stretched a long way to cover a tall section, and that shows as softness. On a phone the whole
frame comes in by a third, since a narrow screen can't spare that much width
on both sides.

### Why edges overlap very slightly

Every edge treatment — a hanging band, or a preset cut like torn or lace —
bites about 3px into the section it sits on. Landing it exactly on the seam
leaves a hairline of page showing through, because a section's height is
rarely a whole number of pixels: the background paints to 530.46 and the band
starts at 531. The overlap is roughly 2% of a band's height and closes the
seam completely.

---|---|
| **Headings** / **Heading colour** | The big display line, and any subheading |
| **Body text** / **Body colour** | Running text, captions, metadata |
| **Small labels** / **Label colour** | The letterspaced eyebrow above a heading |
| **Script initial** / **Script colour** | The swash first letter, where one is on |

Both halves start at **Match the site**, so a section looks exactly as it does
now until you move something. The typeface list shows each face drawn in
itself, grouped into old-style serifs, display serifs, scripts, sans serifs and
typewriters — 21 in all. The colour swatches are your own palette, pulled live
from the Design Studio, with a custom picker at the end for anything else.

To hand a section back to the site's design, pick **Match the site** (the
crossed swatch, first in the row). Nothing is remembered once it is cleared.

**A colour you set here wins over the automatic light-on-dark flip.** A section
over a photograph or a deep tone normally switches its type to the pale banner
colours; an explicit colour overrides that, because you asked for it by name.
If a section goes hard to read over its background, that is the usual cause —
clear the colour and the automatic behaviour comes back.

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
