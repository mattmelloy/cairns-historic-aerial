# Tile notice investigation — 7 September 2026

Implementation status: local changes, not deployed.

## Checklist

- [x] Compare the published source with the website checkout.
- [x] Reproduce desktop coverage edges and mobile four-panel views.
- [x] Check failed requests against neighbouring available tiles.
- [x] Replace batch counters with visible-tile health checks.
- [x] Keep partial coverage gaps quiet and genuine/uncertain failures unobtrusive.
- [x] Verify Retry, dismissal, recovery, layer/mode changes, and mobile layout.

## Findings

The published `https://map.melloy.com.au/main.js` matched this checkout before editing. HistoricMaps contains an older map implementation; the published website belongs to `cairns-historic-aerial`.

The previous notice did not establish an outage:

1. It counted only the latest loading batch. Panning can load only absent edge tiles while previously loaded imagery remains on screen.
2. Leaflet's transparent `errorTileUrl` generates a subsequent `tileload`. This counted an absent tile as both an error and a success. A completely failed batch could hit the 50% "missing tiles" threshold even when much of the viewport still looked correct.
3. The rectangular manifest bounds are not exact photo footprints. Missing files within those rectangles are often expected.
4. Above-native zoom was suppressing all failures, including real connectivity failures. It now uses native tile coordinates and the same health policy at every display zoom.

Live checks:

- Desktop 1977, zoom 16 at `-16.887, 145.751`: 24 tiles loaded, no tile failures.
- Four-panel mobile, zoom 17 at `-16.92, 145.771`: 1952, 1965, 1977 and 1978 each loaded four tiles, with no failures.
- Panning to `-16.87, 145.77` reproduced 1977 absent edge tiles. Actual browser-requested `/historic/cairns77/16/59305/35884.webp` returned HTTP 404; neighbouring `/16/59304/35884.webp` returned HTTP 200, `image/webp`. The rendered image showed an irregular photography boundary here.
- Panning to `-16.94, 145.8` reproduced 1977 and 1978 absent tiles. Actual browser-requested `https://tiles.melloy.bid/tiles/cairns1978_aws_native_affine_z20_q95/16/59310/35897.webp` returned HTTP 404; neighbouring `/16/59309/35897.webp` returned HTTP 200, `image/webp`.
- Chromium exposed these image failures as `ERR_BLOCKED_BY_ORB`. A JavaScript HEAD probe could not read the status because the hosts do not provide the required CORS headers. A browser image error alone cannot establish why a tile failed.

These samples do not establish a service outage or prove the original screenshots' exact cause. Their map coordinates were not supplied. A 404 also cannot prove whether a file was intentionally omitted or accidentally lost.

## New behaviour

`tile-health.js` tracks original image outcomes and evaluates only tiles intersecting the current viewport, including previously cached tiles. Transparent fallbacks cannot count as imagery. Old diagnostics cannot update a removed layer. Notices wait for tile activity to settle.

- Some imagery visible, with absent or unclassified failures: no warning.
- Confirmed HTTP 403, 429 or 5xx in sampled failures: compact "Imagery loading issue", Retry and Dismiss.
- No imagery visible and sampled failures return 404/410: neutral "No imagery here", with Dismiss.
- No imagery visible and the cause cannot be read: neutral "Imagery unavailable here", Retry and Dismiss.
- Outside the rectangular survey area in quadrants: small "Outside survey area" label.

The notice sits below the quadrant selector, leaving the centre clear. Action targets remain at least 44 by 44 CSS pixels. Dismissal persists for that layer instance. Retry clears diagnostic cache and redraws the selected layer; normal tile success clears the notice. Single-map status is hidden while comparing quadrants.

Diagnostics sample at most three unique failed URLs per settled assessment. HEAD results are cached for 30 seconds, cache size is bounded to 128 entries, and each request times out after four seconds. CORS failures remain unknown, never evidence of a server outage. The site's CSP now permits diagnostic requests to its existing 1978 tile host.

## Remaining infrastructure options

If precise diagnosis is wanted, publish a compact availability index from the generated tile directories (for example, x/y row ranges per zoom). The viewer can then avoid requesting known gaps and can flag an expected file that is genuinely missing. Compare the index with uploaded objects to find incomplete uploads; regenerate or re-upload only those expected files.

Allow the website origin to read tile responses through CORS, including 404 and error responses, on both tile hosts. This makes status diagnostics more useful; it does not itself recover missing imagery. Persistent 403/429/5xx responses would require checking host access rules, rate limits or upstream availability. No hosting configuration was changed in this task.

## Verification and screenshots

Playwright covers Chrome desktop, Android-sized Chrome and iPhone-sized WebKit. Scenarios include retained visible tiles after panning, partial and total coverage absence, CORS-hidden failures, confirmed partial server errors, recovery through Retry, dismissal, delayed diagnostics after layer changes, mode transitions and touch layout. This is browser emulation, not a physical iPhone test.

- `desktop-edge.png`: real 1977 imagery at an irregular coverage edge, without a warning.
- `mobile-normal.png`: real four-panel imagery with all tiles loading normally.
- `mobile-loading-issue.png`: real imagery with deliberately simulated HTTP 503 responses in alternate tile rows, demonstrating three compact notices. It is a UI test, not evidence of a live outage.
