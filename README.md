# Diana's Lit Picks

A personal reading journal for 2027, built as an editorial publication. Log
the books you finish, watch the goal bars move, and collect a bookmark every
time you complete a challenge period.

The whole look is adjustable from inside the app — see
**[CUSTOMIZATION.md](CUSTOMIZATION.md)** and Settings → Design studio.

Plain HTML, CSS and vanilla JavaScript — no build step, no framework, no
backend. Everything lives on your device; the only network call is to the
Open Library search API when you look a book up.

---

## Publishing to GitHub Pages

Everything below assumes you're in the project folder:

```bash
cd ~/shelf-marks
```

### 1. Create the repository on GitHub

Go to <https://github.com/new> and make a repository named `shelf-marks`.
Leave "Add a README" unchecked — this folder already has one.

It can be **public or private**: GitHub Pages works with private repos on
all current plans.

### 2. Push this folder up

Replace `YOUR-USERNAME` with your GitHub username:

```bash
git remote add origin https://github.com/YOUR-USERNAME/shelf-marks.git
```

```bash
git push -u origin main
```

### 3. Turn on Pages

1. Open your repository on GitHub.
2. **Settings** (top bar) → **Pages** (left sidebar).
3. Under **Build and deployment**:
   - **Source**: `Deploy from a branch`
   - **Branch**: `main`, folder `/ (root)`
4. Click **Save**.

Wait a minute or two, then reload that page — it will show your URL:

```
https://YOUR-USERNAME.github.io/shelf-marks/
```

### 4. Add it to your home screen

On **each** device (iPhone and iPad), in **Safari** — this does not work in
Chrome on iOS:

1. Open the URL above.
2. Tap the **Share** button (the square with the arrow).
3. Scroll down and tap **Add to Home Screen**.
4. Tap **Add**.

It now opens full screen with its own icon, like any other app.

### 5. Pushing changes later

```bash
git add -A && git commit -m "Describe the change" && git push
```

Pages redeploys in about a minute. If an update doesn't show, close the app
from the iOS app switcher and reopen it.

---

## Syncing the iPhone and the iPad

There is no server, so the two devices sync through a file you move yourself.

**On the device with the newer data:**
Settings → **Export backup**. Safari saves a `shelf-marks-YYYY-MM-DD.json`
file — put it in **iCloud Drive** (or anywhere both devices can reach).

**On the other device:**
Settings → **Import backup** → pick that file.

The merge is per item, by id:

- An item that only exists in the file is **added**.
- An item on both sides is **updated** only if the file's copy has a newer
  `updatedAt`. Otherwise the device keeps what it has.
- Nothing is ever deleted by an import.
- You get a summary of exactly what was added and updated.

Settings (your goals) follow the same newer-wins rule. Bookmark photos travel
inside the JSON as data URLs, so the backup is a single self-contained file.

Settings shows a **Last exported** date so you can tell whether you're synced.
Your design settings travel inside the same file.

> Back up now and then regardless. Clearing Safari's website data for the site
> erases the app's database.

---

## The challenges

Challenges are **data, not code** — they live in
[`js/config.js`](js/config.js) and run through a generic rule engine in
[`js/rules.js`](js/rules.js). Each one has a filter, a time window and a
target.

Four are preloaded:

| Challenge | Counts | Window | Bookmarks |
|---|---|---|---|
| Classic Every Quarter | books marked Classic | each quarter | `classic-q1…q4` + bonus `classic-all` |
| Re-read Every Quarter | books marked Re-read | each quarter | `reread-q1…q4` + bonus `reread-all` |
| Physical TBR Every Other Month | books from your physical TBR | each two-month period | `tbr-jan-feb`, `tbr-mar-apr`, `tbr-may-jun`, `tbr-jul-aug`, `tbr-sep-oct`, `tbr-nov-dec` + bonus `tbr-all` |
| Joan Didion & Kindred Voices | books by an author on the list | all of 2027 | `didion-1 … didion-N`, from the target |

The last one ships with **no target and only Joan Didion on the list**,
because that part wasn't specified. Open it in the app and tap **Edit** to set
the target and add the other authors — no code change needed. Its bookmark ids
are generated from the target (`didion-1`, `didion-2`, …), so raising the
target later only adds ids and never renumbers the ones you already collected.

### Adding more challenges

Two ways:

- **In the app** — Challenges → **New challenge**. Pick a filter (any book,
  author list, series, tag, nonfiction, classic, re-read, physical TBR), a
  window (the full year, one quarter, a custom date range, or repeating every
  quarter / every two months) and a target.
- **In the config** — append an object to `PRESET_CHALLENGES` in
  `js/config.js`. The comment block at the top of that file documents every
  field.

A recurring challenge awards one bookmark per completed period plus a bonus
bookmark once every period is done.

---

## How things count

- A book counts toward the period that contains its **finish date**.
- Quarters are Q1 Jan 1–Mar 31, Q2 Apr 1–Jun 30, Q3 Jul 1–Sep 30,
  Q4 Oct 1–Dec 31.
- **Re-reads count toward every goal**, exactly like a first read.
- Progress bars can go past 100% — the percentage keeps climbing.
- The nonfiction goal is a **share of what you've read**, not a book count.
- Unlocks are kept as history: deleting a book does not take a bookmark back.
  Settings → **Re-check unlocks** drops any bookmark your current books no
  longer justify.

---

## Running it locally

Any static file server works. This repo includes one with caching turned off,
so an edit always shows on reload:

```bash
node tools/dev-server.mjs
```

Then open <http://localhost:4321>. Opening `index.html` directly from Finder
will **not** work — the app uses ES modules, which browsers only load over
`http://` or `https://`.

### Regenerating the icons

`tools/make-icons.mjs` draws the app icons as PNGs with no dependencies. Edit
the colours or the shape in that file and run:

```bash
node tools/make-icons.mjs
```

---

## Layout

```
index.html              shell: masthead, editorial banner, tab bar, content bindings
manifest.webmanifest    home-screen name, icons, standalone display
sw.js                   service worker — offline support, network-first
css/styles.css          the design token layer, then components that only use var(--…)
js/
  app.js                boot: registers routes, loads the database and the theme
  theme.js              design tokens, presets, persistence, export/import
  config.js             challenge presets, goal defaults, subject hints  ← edit me
  rules.js              the rule engine: filters, windows, targets
  periods.js            quarters, two-month periods, date maths
  store.js              IndexedDB wrapper; every call has error handling
  state.js              in-memory state, writes through to the database
  backup.js             JSON export / import and the merge
  openlibrary.js        search + autofill + fiction/nonfiction guess
  ui.js                 router, bookmark artwork, progress, sheets, toasts
  view-*.js             one file per screen
  view-customize.js     the Design Studio
icons/                  generated PNGs
tools/                  icon generator, local dev server
```

## Notes

- Book data comes from [Open Library](https://openlibrary.org). If it's
  unreachable, the search box says so and **Add manually** still works.
- Nothing is uploaded anywhere. There is no account and no analytics.
- Storage failures (Private Browsing, a full device) surface as a banner
  rather than silently losing a book.
- Typefaces come from Google Fonts (Cormorant Garamond, EB Garamond, Pinyon
  Script, Bodoni Moda, Jost). Offline, the system serif stands in — every
  stack has a real fallback.
