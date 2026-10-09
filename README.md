# abirich7.github.io

Portfolio of **Abirich Vaithiyalingam**, Content Strategist & Social Media Lead, Bengaluru.
Live at https://abirich7.github.io/

The page opens with the five channels he has built and worked on (Yogic Insights, Keerthi, Kootan Soru,
Kharigai, Dr. Rajaram Prasad), then shows the work on each one, then experience, skills and contact.

## How the site is built
Plain HTML, CSS and one small script. No build step and no libraries, so GitHub Pages serves it as it is
and it also opens straight from disk.

| Path | What it is |
|---|---|
| `index.html` | The page: all copy and numbers live here |
| `css/tokens.css` | Colours, fonts, type sizes, spacing |
| `css/site.css` | Layout and components, plus the print / Save as PDF styles at the end |
| `js/site.js` | Menu, active nav, reveal on scroll, video player, "Show all 13 edits", copy email, the Yogic Insights chart (its monthly data is embedded in this file) |
| `assets/brands/` | `yogic.svg` (a plain "YI" lettermark, not Isha or Sadhguru branding), `kharigai.jpg` |
| `assets/img/abirich-portrait-cutout.webp` | Hero portrait (desktop). The `.png` beside it is the fallback for browsers without WebP |
| `assets/img/abirich-face.webp` | Small round face used in the mobile hero (120x120 crop of the portrait) |
| `assets/thumbs/` | Fallback thumbnails for the 13 Keerthi edits (used if YouTube's image fails) |
| `data/channels.json` | Channel totals and roles, 9 Oct 2026 |
| `data/kootansoru.json` | Kootan Soru uploads since 21 Aug 2024, top Shorts, "Life of" series |
| `data/yogic_insights.json` | Meta Graph API export of the Yogic Insights page, 2019 to 2021 |
| `data/edited_videos.json` | The 13 Keerthi edits with views, 9 Oct 2026 |
| `cv/` | `Abirich-Vaithiyalingam-CV.pdf` (designed) and `Abirich-Vaithiyalingam-CV-ATS.pdf` (ATS) |
| `og.png` | The social share image (1200x630) used by the OG, Twitter and JSON-LD tags. Its source is `src/og.html` in the working folder |
| `favicon.svg` | Browser tab icon |
| `.nojekyll` | Tells GitHub Pages to serve the files as they are (no Jekyll processing) |

The page does not read the JSON files at runtime. They are the record of where each number came from.

## Updating numbers
1. Update the right file in `data/` (and `src/FACTS.md` in the working folder) with the new count and date.
2. Change the same figure in `index.html`. Search for the old value, for example `670K` or `2.97M`, because a
   number can appear in a channel card, a case and the totals bar. Numbers also appear in the meta, OG and
   Twitter descriptions at the top of `index.html`, in `aria-label` and `data-credit` attributes, and in the
   share image (`og.png`, re-render it from `src/og.html` and update the `og:image:alt` / `twitter:image:alt`
   text). A search for the old value finds all of them except the image.
3. Update the dates: "9 Oct 2026" in the totals note, the case source lines and the footer ("Last updated").
4. The combined totals (`7.6M+` followers, `1.7B+` views) are channel totals. Recompute them from
   `data/channels.json` and keep the "channel totals" and "team work" labels.
5. Yogic Insights chart: if the data changes, edit the `Y` array in `js/site.js`
   (month posted, posts that month, lifetime views of that month's videos, running total). These are lifetime
   views grouped by the month each video was posted, not views the page got in that month: never call them
   "monthly views" or "best month". Also check the hard-coded chart settings in `js/site.js`: `ia` (the labelled
   month, now Apr 2020), the y-axis maximum (`1e8`) and the posts maximum (`24`), plus the chart `aria-label`
   in `index.html`.

Honesty rules: only Yogic Insights is his alone; every other channel number is a channel total (team work).
Kootan Soru counts start at 21 Aug 2024. Do not name individual Dr. Rajaram Prasad episodes.
Yogic Insights is an independent, unofficial page, not linked to Sadhguru or Isha Foundation.

## Preview locally
Open `index.html` in a browser. Everything works from disk except video playback: YouTube refuses
embeds on pages opened from disk, so the player shows a short note and an "Open on YouTube" button.
To test playback, serve the folder over http and open it from there. There is no Node or Python on the
working machine, so use the small PowerShell server in the working folder:
`powershell -ExecutionPolicy Bypass -File src\serve.ps1` (then open http://localhost:8765/), or check the live site.

Print / Save as PDF uses light colours and shows every section; the menu, player and buttons that only work
on screen are left out.
