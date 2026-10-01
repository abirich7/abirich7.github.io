# abirich7.github.io

Portfolio of **Abirich Vaithiyalingam**, Social Media & Content Lead.
Live at https://abirich7.github.io/

- Built a Facebook page from zero to 1.18M followers (87M+ views on 149 unique videos).
- Core team on the Keerthi creator brand (2.96M YouTube subscribers, brand total).
- 11.7M views on 13 showcased edits.

## How the site is built
React, TypeScript, Vite and Tailwind CSS. Editable source lives in `site/`. The root contains the production build served by GitHub Pages. No UI component libraries are used.

| Path | What it is |
|---|---|
| `site/src/App.tsx` | Copy, navigation, film player, contact and brief |
| `site/src/index.css` | Palette, typography, spacing and responsive layouts |
| `site/src/hooks.ts` | Typewriter, reduced motion and mouse-scrub video |
| `site/src/GrowthData.tsx` | Charts and accessible data tables |
| `site/public/data/` | Supplied Meta export and public YouTube counts |
| `site/public/cv/` | Designed and ATS resume PDFs |
| `site/public/assets/` | Portrait and film thumbnails |

## Updating numbers
Edit the JSON files in root `data/`, copy them into `site/public/data/` for downloadable copies, and update matching figures in the React app. Keep source dates current. Keerthi channel totals are whole-brand totals, not growth attributed to one person. Publication cohorts show lifetime views grouped by publication month, not historical monthly view counts. Each film retains its individual edit and AI credits.

## Preview locally
From `site/`, run `pnpm install --frozen-lockfile`, then `pnpm dev`. Preview at http://127.0.0.1:4175/.

Run `pnpm build` to check TypeScript and build `site/dist/`. Copy the contents of `site/dist/` into the repository root, commit and push to `main` to publish to the existing GitHub Pages address. Preserve `.nojekyll` and the `site/` source. Older root `css/` and `js/` files are retained for reference and are no longer loaded.

## Asset notes

Helvetica Now stylesheet links and the decorative video were supplied in the design brief. They remain externally hosted with system-font and red-background fallbacks. The background video never autoplays. YouTube embeds load only after opening a film.

The supplied portrait was processed using the imagegen skill. Output: `site/public/assets/img/portrait-cutout.png`. The original is preserved outside the website. Minor generative edge or texture differences may remain.

Portrait prompt: "Use case: background-extraction. Asset type: transparent PNG portrait for a personal portfolio hero. Image 1 is the edit target. Remove only the gray studio background and make it genuinely transparent. Extract the exact existing person without repainting or restyling him. Keep the same tall portrait framing and exact subject scale, position, complete hair silhouette, shoulders, arms, hands in pockets, and bottom crop. Preserve the exact face, identity, facial features, expression, hairstyle, facial hair, skin texture and tone, cream pinstripe suit, white shirt, posture, body proportions, original photographic detail, and original natural lighting including the warm hair rim light. Preserve fine individual hair edges and suit edges. Remove background visible through gaps between arms and torso. Clean alpha edges with no gray fringe or halos. No face alteration, beautification, retouching, skin smoothing, relighting, new objects, text, shadow, outline, or added elements. Only the background changes to transparency."
