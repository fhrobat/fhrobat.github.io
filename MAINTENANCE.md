# Site maintenance

How to update and maintain https://fhrobat.github.io on your own.
This file is in the repo but excluded from the build (`exclude:` in `_config.yml`), so it is not published on the site.

---

## 1. How it works, in two lines

- **Jekyll 4** site (no-style-please theme, heavily customised), repo `fhrobat/fhrobat.github.io`, branch **`master`**.
- Every push to `master` runs the **"Deploy Jekyll site to Pages"** Action (`.github/workflows/jekyll.yml`): build and publish in 1–2 minutes.
  Follow it in the repo's *Actions* tab. If it fails (red), the site stays at the previous version.
- Pushes that only touch `radar/**` do not rebuild the site.

## 2. Where things live

| What | File |
|---|---|
| Name, email, links (Email/GitHub/Scholar/...), photo and bio on the home page | `_config.yml` → `bio:` (HTML) |
| Description for search engines and link previews | `_config.yml` → `description:` (plain text) |
| News at the top of the home page (4 are shown) | `_data/news.yml` |
| Publications, Talks, Education, Teaching, Extra | `_data/menu.yml` (HTML inside `content: \|`) |
| Single pages (publications.html, talks.html, ...) | `publications.md`, `talks.md`, ... (they read from `menu.yml`, usually no need to touch them) |
| Home timeline | `_includes/timeline.html` (list `<ol class="tl-data">`) |
| Paper animations | `assets/anims/*.mp4` |
| PDF slides | `assets/slides/` |
| Order of the home page blocks | `_layouts/home.html` |
| Styles | `_sass/` (`organic.scss` = the vertical line on the home page) and `assets/css/main.scss` |
| Favicon | `favicon.svg`, `favicon-32.png`, `favicon.ico`, `apple-touch-icon.png` |
| Minigames | `_includes/{minigames,foosball,kart,mathsrun}.html`, `assets/js/games/`, `assets/games/`, `assets/kart/` |
| NLA radar | `_includes/radar*.html`, `assets/js/radar.js`, `_sass/radar.scss`, `radar/` (script + `conferences.json`) |

**Working copies.** The timeline, minigames, radar, cartoon and animations have their "source" version in
`OneDrive/Desktop/claude/` (folders `timeline/`, `minigames/`, `foosball/`, `kart/`, `mathsrun/`, `radar/`, `organic/`, `site_anims/`).
For these parts, edit **the working copy** and then copy it into the site (section 5). If you change only the site,
the change is lost the next time that part is published from the working copy.

---

## 3. Frequent updates

### Add a news item
At the top of `_data/news.yml` (newest first):
```yaml
- date: Nov 2026
  text: 'Talk at XYZ, Oxford (<a href="assets/slides/file.pdf" target="_blank" rel="noopener">slides</a>)'
```
Keep the single quotes around `text`. If the text needs an apostrophe, double it (`''`) or use `’`.

### Add a paper
In `_data/menu.yml`, `publications` section: copy an existing `<li>` and put it at the top. It contains:
- the title in `<strong>`, the authors in `<em>`, the year (+ journal: "2026, to appear in SIMAX");
- the arXiv / PDF / Code / Slides badges (`<a class="badge" ...>`) and the BibTeX button;
- the BibTeX inside `<pre class="bib-src" hidden>`.
- Optional animation: `<li class="has-anim">` + `<video class="paper-anim" src="assets/anims/Name.mp4" ...>`. Without a video use a plain `<li>`.

Remember also: a news item in `news.yml` and a milestone in the timeline (below).

### Add a talk
`talks` section of `menu.yml`, new `<li>` at the top:
```html
<li>
  <strong>Title</strong><br>
  <em>20 Oct 2026 &emsp; Seminar name, Place, Country</em><br>
  <span class="paper-links"><a class="badge" href="assets/slides/file.pdf" target="_blank" rel="noopener">Slides</a></span>
</li>
```
The slides PDF goes in `assets/slides/`. Date style: "20 Oct 2026", en dash "–" for ranges, "now" for ongoing things.

### Teaching, Education, Extra
Same rules: one `<li>` in the right section of `menu.yml`. Do not change the sections' `id:`, `url:` and `kind:`,
because the pages, the timeline and the home page line use them.

### Add a milestone to the timeline
In `_includes/timeline.html` (better: in the working copy `Desktop/claude/timeline/timeline.html`, then copy it over),
one `<li>` inside `<ol class="tl-data">`, **in date order**:
```html
<li data-d="2026-11" data-k="talk"><span class="tl-when">Nov 2026</span><span class="tl-what">Talk at XYZ, Oxford</span></li>
```
- `data-d` date (`YYYY` or `YYYY-MM`), `data-to` for a duration, `data-k` kind: `paper`, `talk`, `edu`, `prize`, `teach`, `role`, `event`.
- Optional: `data-anim="assets/anims/X.mp4"` (papers), `data-map="pisa>oxford"` (a trip; places are in `PLACES` in the script),
  `data-deck` (slides), `data-medal`/`data-rank`, `data-hl` (included in the short version of the film), `data-toon` (cartoon scene).
- The comment at the top of the list explains every attribute.

### New Manim animation for a paper
Sources in `Desktop/claude/site_anims/paper_anims.py`. Render with:
```
manim -r 960,540 --fps 30 paper_anims.py SceneName
```
Copy the mp4 to `assets/anims/` (keep it small, a few MB at most).

### Bio, photo, links
In `_config.yml`: `bio:` for the home page, `description:` for search engines, `social.links` for the profiles.
The photo is `hrobat.jpg` + `hrobat-300.webp` and `hrobat-600.webp`: if you change it, regenerate all three.

---

## 4. Publishing a change

1. Clone (or update) the repo:
   ```
   git clone https://github.com/fhrobat/fhrobat.github.io.git
   ```
   or `git pull` if you already have it.
2. Edit, then `git add` + `git commit -m "what you changed"`.
3. **Before every push, check that nobody is playing the minigames** (a deploy makes anyone who reloads lose their game):
   ```
   python -I minigames/players_online.py --wait
   ```
   from `Desktop/claude`. It waits until nobody is playing, then exits.
4. `git push` to `master`.
5. Watch the *Actions* tab until the deploy turns green, then reload the site with Ctrl+F5.

Small text fixes can also be made on the GitHub website (pencil icon on the file), but the players check still applies.

---

## 5. Parts published from `Desktop/claude`

| Part | Command (from `Desktop/claude`) |
|---|---|
| Minigames (foosball, kart, Maths Run, cards) | `python -I minigames/publish.py <repo folder>` |
| Radar (html, js, scss, script, conferences, workflow) | `python -I radar/publish.py <repo folder>` |
| Timeline | copy `timeline/timeline.html` to `_includes/timeline.html` |
| ▶ play cartoon | copy `timeline/toon.js` to `assets/timeline/toon.js` |
| Home page line | `organic/organic.scss` → `_sass/organic.scss`, `organic/organic.js` → `assets/js/organic.js` |

**Do not copy** `foosball.html` or `kart.html` straight into `_includes`: `publish.py` does it, splitting out the code so it loads only on the first click.

Local previews: each folder has a `build_preview.py` (e.g. `python -I timeline/build_preview.py`) and a configuration in `.claude/launch.json`.
There is no local Jekyll, so the final check is on the published site.

---

## 6. Automatic things

- **NLA radar**: the "NLA radar" Action (`.github/workflows/radar.yml`) runs every day at 05:17 UTC, collects arXiv, blogs, NA Digest etc. and writes `radar.json` to the `radar-data` branch. The home page reads it from there: **the site is not rebuilt**.
  If the radar is empty or stale, look at the latest run in *Actions*. It can be re-run by hand with *Run workflow*.
- **Conferences**: the weekly task "nla-conferences-weekly-check" (Monday 09:00) re-checks `radar/conferences.json` and writes `radar/conferences.proposed.json` + a report. To apply it, ask Claude "apply the proposed changes to the radar conferences", then publish with `radar/publish.py`.
- **Minigame leaderboards**: Firebase Realtime Database, project `online-foosball`. Allowed names are in `foosball/names.txt`.
  After a change: `python -I foosball/build_names.py` regenerates the names in the game and `firebase-rules.json`. The rules must be **pasted by hand in the Firebase console** (Realtime Database → Rules → Publish).
  Fake or test scores are deleted from the console (Data).
- **Visit statistics**: GoatCounter, account `fhrobat`.

---

## 7. Known pitfalls

- **KaTeX runs over the whole HTML, scripts included.** A `\[ ... \]`, `\( ... \)` or `$$` inside an include or a `<script>` becomes a formula and breaks the JavaScript. It does not show up locally, so search for them before pushing.
- Do not use generic class names (`news`, `title`, ...) in new components: the site CSS already styles them.
- In `_sass/organic.scss` no `//` comments, only `/* */`.
- Dark mode = the whole page inverted with a CSS filter. Blue links turn orange, and that is intended. Images that must not be inverted have the class `no-reinvert`.
- The timeline uses the section titles in `menu.yml` to open the right section: if you rename one, also update `SECTIONS` in `timeline.html`.
- The classic Pages build still uses Jekyll 3: if you add files to exclude, put them in the `exclude:` list in `_config.yml`, which replaces the default one.
- The Gemfile does not use the `github-pages` gem: the real build is the Action, not the classic build.

---

## 8. Still open

- `logo.png` (3.4 MB) is no longer the favicon but is still published. It can be removed after checking that no file uses it.
- Pages builds twice (classic build + Action): in *Settings → Pages* set *Source* to *GitHub Actions*.
- Kart "Francesco" ghost still to record (`kart.html?record=1`).

---

## 9. If something breaks

1. *Actions* tab: if the deploy is red, open the log; the error is almost always YAML (indentation or quotes in `menu.yml`/`news.yml`).
2. Site online but one part not working: open the browser console (F12) and look for JavaScript errors (often the KaTeX pitfall).
3. To go back: `git revert <commit>` and push. This undoes the commit without losing history.
