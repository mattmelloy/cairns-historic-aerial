# Cairns Historic Aerial Imagery

An interactive web map for browsing historic aerial photography of Cairns and Lake
Tinaroo, Queensland, overlaid on current satellite or street-map imagery. Built
with [Leaflet](https://leafletjs.com/).

🔗 **Live site:** _(add your Vercel URL here after the first deploy)_

## Features

- **Historic imagery maps timeline** — jump between Lake Tinaroo 1949, Cairns 1952,
  1962 Beaches, 1965, 1972, 1977, 1983, 1987 Beaches, and today's imagery
- **Blend** historic over modern with an opacity slider
- **Swipe compare** between historic and modern views
- **Four-panel comparison** — compare three historic surveys with a current Esri or
  OpenStreetMap pane; the default is 1952 / 1965 / 1977 / current Esri
- **Coverage outlines** for each survey
- **Lake Tinaroo reference boundary** — show the present reservoir and dam wall
- **Location detection** — centre the map at zoom 18 after an explicit browser permission
- **Address search** (OpenStreetMap Nominatim), bounded to the Cairns region
- **Copy share link** — preserve view, layer, base map, and four-panel choices in the URL
- **Accessible controls** — keyboard focus states, live status messages, reduced-motion support,
  and larger touch targets on small screens
- **Shareable URL** — the map view, layer, and base map are stored in the URL hash

## How it works

This is a **static site** — no build step, no backend.

| File | Purpose |
|------|---------|
| `index.html` | Page shell, styles, splash/disclaimer |
| `styles.css` | External stylesheet for the map shell and responsive controls |
| `app-config.js` | Shared base-layer, geocoder, and comparison defaults |
| `manifest-validation.js` | Startup validation for public tile URLs, bounds, and zoom limits |
| `main.js` | Map logic: layers, modes, timeline, swipe, URL hash, location, sharing |
| `layers.js` | Layer manifest (`window.MAP_CONFIG`) — the site builds itself from this |
| `vercel.json` | Cache + security headers for Vercel |

Map tiles for every historic layer are served from public HTTPS tile roots (see the
`url` or `tileUrls` fields in `layers.js`); base layers come from Esri and
OpenStreetMap. The startup validator intentionally rejects local tile paths so a
published build cannot silently depend on a developer's filesystem.

The public tile host remains an external availability dependency. If tiles fail,
the map reports a missing/unavailable layer and offers a retry; it does not replace
the imagery with a derived mosaic or hide the failure.

Address search is intentionally bounded to Cairns and limited to five results. It
uses the public Nominatim service first and falls back to Photon for transient
failures or empty results. Both are suitable only for occasional interactive
searches; for a high-traffic deployment, route requests through an application-
owned proxy or a provider with an agreed usage policy.

### Adding or editing a layer

Edit the `layers` array in [`layers.js`](layers.js). Each entry needs an `id`,
`name`, `year`, a public HTTPS tile `url` template (or `tileUrls` for a composite
layer), `scheme` (`xyz` or `tms`), zoom limits, `bounds`, and `attribution`.
Keep the existing IDs stable: they are part of shared URL hashes and four-panel
links. Include a concise provenance note in `attribution` when a layer has a
distinct survey, alignment, or source treatment.

## Local development

It's plain static files, so any static server works:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

The site also works opened directly from `file://` because `layers.js` is loaded
as a plain script rather than fetched. The normal development path is HTTP so
geolocation permission prompts and browser smoke tests behave like production.

### Automated checks

```bash
npm install
npx playwright install chromium webkit
npm test
```

The smoke suite checks startup errors, manifest validation, the historic timeline,
current-base four-panel defaults, mobile touch targets, and the location control
with a mocked permission. GitHub Actions runs the same checks on every push and
pull request. The remaining device-specific release gate is documented in
[`docs/manual-qa.md`](docs/manual-qa.md) for iPhone Safari and VoiceOver.

## Deploying to Vercel

1. Push this repo to GitHub.
2. In Vercel, **Add New → Project** and import the repo.
3. Framework preset: **Other**. No build command, no output directory — the root
   is served as-is.
4. Deploy.

Application scripts and styles use revalidation headers in `vercel.json`, so a
manual query-string cache bump is not required after each change.

## Imagery acknowledgement

Historic aerial imagery is sourced from the Queensland Government's
[QImagery](https://qimagery.information.qld.gov.au) program, used under the
Queensland Government's Online Services Terms and Conditions. Imagery may not be
precisely aligned and should be treated as indicative only.
