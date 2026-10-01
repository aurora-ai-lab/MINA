# MINA implementation audit — 2026-10-01

## Confirmed repository state

- Hosting target: GitHub Pages, static site.
- Entry point: `index.html`.
- Runtime: vanilla JavaScript in `assets/app.js`; no package manager or build step is present.
- Styles: `assets/style.css`.
- Dataset: `data/works.json` contains **219 total records**.
- Category counts: `general` 112, `women` 101, `web-ui` 6.
- Images: stored in the repository under `images/` (`general`, `women`, `web-ui`, and `safe-rewrites` where applicable).
- Record fields: `id`, `title`, `date`, `image`, `mediaType`, `category`, `model`, `tags`, `source`, `prompt`, `tweet`, `notes`.
- Existing interactions: category tabs, full-text search, grouped tag filters, URL hash state, modal detail view, previous/next navigation, prompt copy, share-link copy, responsive gallery, starfield canvas.
- Deployment path: relative asset URLs are already used, compatible with `/MINA/`.

## Important count distinction

The live page's default **综合作品** tab shows 112 items. The underlying dataset contains 219 records in total. Any future validation must report both numbers and must not describe the site as having only 112 total works.

## Recommended implementation order

1. Add a client-facing website-type entry experience without changing the existing gallery data or modal behavior.
2. Add a lightweight 3D Hero enhancement with a CSS fallback.
3. Add an opt-in 3D showcase for selected works.
4. Only after performance testing, consider expanding the 3D scene to all records.
