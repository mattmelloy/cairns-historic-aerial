# Manual mobile QA checklist

The automated suite covers Chromium and WebKit layouts, keyboard semantics, and
touch-target sizing. A real iPhone Safari pass is still required before a release
because VoiceOver and Safari's bottom browser toolbar are device features that
browser automation cannot reproduce faithfully.

## iPhone Safari

- Open the HTTP/HTTPS deployment in portrait and landscape.
- With the browser toolbar expanded, confirm the bottom timeline remains visible
  and tappable; expand/collapse Map Options and scroll the timeline horizontally.
- Select a historic layer, switch to Blend and Compare, and confirm the layer
  failure notice and Retry button remain reachable.
- Open Four-panel comparison and confirm the defaults are 1952 / 1965 / 1977 /
  current Esri. Change pane four to OpenStreetMap and reload the shared URL.
- Allow location access, confirm the map centres at zoom 18, then deny access in
  Safari settings and confirm the explanatory error message.

## VoiceOver

- Rotor through the Map Options toggle, layer chips, location button, share button,
  timeline group, and four panel selectors.
- Confirm the active historic chip is announced as pressed and each quadrant map
  announces whether it is historic imagery or a current base map.
- Confirm live status messages announce location success/failure and tile retry
  states without trapping focus.
