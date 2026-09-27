# abirich7.github.io

Portfolio of **Abirich Vaithiyalingam**, Social Media & Content Lead.
Live at https://abirich7.github.io/

- Built a Facebook page from zero to 1.18M followers (87M+ views on 149 unique videos).
- Core team on the Keerthi creator brand (2.96M YouTube subscribers, brand total).
- 11.7M views on 13 showcased edits.

## How the site is built
Plain HTML, CSS and JavaScript modules. No build step and no JavaScript libraries, so it loads fast and
GitHub Pages serves it as it is.

| Path | What it is |
|---|---|
| `index.html` | The page |
| `css/tokens.css` | Colours, type and spacing |
| `css/main.css`, `css/hero.css`, `css/charts.css` | Layout, hero, charts |
| `js/main.js` | Page behaviour (navigation, timeline dock, edit bay, hire brief) |
| `js/hero.js` | Hero effects (parallax, particle portrait on capable desktops) |
| `js/charts.js` | Growth charts drawn from `data/*.json` |
| `data/yogic_insights.json` | Meta Graph API export of the Yogic Insights page, 2019 to 2021 |
| `data/edited_videos.json` | Public YouTube counts for the 13 showcased edits |
| `cv/` | CV as PDF (designed version and ATS version) |

## Updating numbers
Edit the JSON files in `data/` and the matching figures in `index.html`. Every number on the page is sourced;
keep the source dates current.

## Preview locally
Any static server works, for example `python -m http.server` in this folder, then open http://localhost:8000/.
Opening `index.html` directly from disk will not load the charts or the photo mask, because browsers block
those requests on `file://`.
