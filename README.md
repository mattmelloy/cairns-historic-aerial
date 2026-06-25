# Cairns Historic Aerial Imagery

An interactive web map for browsing historic aerial photography of Cairns, Queensland,
overlaid on modern satellite imagery. Built with [Leaflet](https://leafletjs.com/).

🔗 **Live site:** _(add your Vercel URL here after the first deploy)_

## Features

- **Year timeline** — jump between 1952, 1962, 1965 surveys and today's imagery
- **Blend** historic over modern with an opacity slider
- **Swipe compare** between historic and modern views
- **Coverage outlines** for each survey
- **Address search** (Nominatim), biased to the Cairns region
- **Shareable URL** — the map view, layer, and base map are stored in the URL hash

## How it works

This is a **static site** — no build step, no backend.

| File | Purpose |
|------|---------|
| `index.html` | Page shell, styles, splash/disclaimer |
| `main.js` | Map logic: layers, modes, timeline, swipe, URL hash |
| `layers.js` | Layer manifest (`window.MAP_CONFIG`) — the site builds itself from this |
| `vercel.json` | Cache + security headers for Vercel |

Map tiles for the historic layers are served from an external tile host (see the
`url` fields in `layers.js`); base layers come from Esri and OpenStreetMap.

### Adding or editing a layer

Edit the `layers` array in [`layers.js`](layers.js). Each entry needs an `id`,
`name`, `year`, tile `url` template, `scheme` (`xyz` or `tms`), zoom limits,
`bounds`, and `attribution`.

## Local development

It's plain static files, so any static server works:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

The site also works opened directly from `file://` because `layers.js` is loaded
as a plain script rather than fetched.

## Deploying to Vercel

1. Push this repo to GitHub.
2. In Vercel, **Add New → Project** and import the repo.
3. Framework preset: **Other**. No build command, no output directory — the root
   is served as-is.
4. Deploy.

## Imagery acknowledgement

Historic aerial imagery is sourced from the Queensland Government's
[QImagery](https://qimagery.information.qld.gov.au) program, used under the
Queensland Government's Online Services Terms and Conditions. Imagery may not be
precisely aligned and should be treated as indicative only.
