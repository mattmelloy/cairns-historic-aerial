// main.js - Cairns Historic Aerial Imagery
// Layers are defined in layers.js - the site builds itself from that manifest.
// Features: year timeline, swipe compare, opacity blend, shareable URL hash,
// address search, coverage outlines.

const SITE_CONFIG = window.APP_CONFIG || {};
// A proper 1×1 transparent GIF. Unlike a 1×1 PNG, browsers scale GIFs without
// colour fringing, so tiles outside coverage render as fully invisible.
const TRANSPARENT_TILE = SITE_CONFIG.TRANSPARENT_TILE ||
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
const MAP_MAX_ZOOM = SITE_CONFIG.MAP_MAX_ZOOM || 21;

// ---------------------------------------------------------------------------
// Tile loading indicator
// ---------------------------------------------------------------------------
const tileLoadState = { loading: 0, errors: 0 };

function showLoadingIndicator() {
  const indicator = document.getElementById('loading-indicator');
  if (indicator) indicator.classList.add('active');
  const mapElement = document.getElementById('map');
  if (mapElement) mapElement.setAttribute('aria-busy', 'true');
}

function hideLoadingIndicator() {
  const indicator = document.getElementById('loading-indicator');
  if (indicator && tileLoadState.loading === 0) indicator.classList.remove('active');
  const mapElement = document.getElementById('map');
  if (mapElement && tileLoadState.loading === 0) mapElement.setAttribute('aria-busy', 'false');
}

function updateLoadingCounter() {
  const counter = document.getElementById('tile-counter');
  if (counter) {
    counter.textContent = tileLoadState.loading > 0
      ? `Loading ${tileLoadState.loading} map ${tileLoadState.loading === 1 ? 'layer' : 'layers'}...`
      : '';
  }
}

function createTileLayer(pathTemplate, opts = {}) {
  const defaults = {
    tileSize: 256,
    maxZoom: MAP_MAX_ZOOM,
    minZoom: 0,
    errorTileUrl: TRANSPARENT_TILE,
    tms: false,
    attribution: '',
    keepBuffer: 2,
    updateWhenIdle: true,
    updateWhenZooming: false
  };

  const layer = L.tileLayer(pathTemplate, Object.assign({}, defaults, opts));
  let batchLoading = false;

  function beginLoadingBatch() {
    if (batchLoading) return;
    batchLoading = true;
    tileLoadState.loading++;
    showLoadingIndicator();
    updateLoadingCounter();
  }

  function endLoadingBatch() {
    if (!batchLoading) return;
    batchLoading = false;
    tileLoadState.loading = Math.max(0, tileLoadState.loading - 1);
    updateLoadingCounter();
    hideLoadingIndicator();
  }

  layer.on('loading', beginLoadingBatch);
  layer.on('load', endLoadingBatch);
  layer.on('remove', endLoadingBatch);

  // Tiles outside the photo footprint 404 forever - never retry them.
  layer.on('tileerror', () => {
    tileLoadState.errors++;
  });

  return layer;
}

function historicTileLayers(layer) {
  return layer?._historicTileLayers || (layer ? [layer] : []);
}

function historicLayerContainers(layer) {
  return historicTileLayers(layer)
    .map(tileLayer => tileLayer.getContainer())
    .filter(Boolean);
}

function createHistoricLayer(def) {
  const tileUrls = Array.isArray(def.tileUrls) && def.tileUrls.length
    ? def.tileUrls
    : [def.url];
  const tileLayers = tileUrls.map(url => createTileLayer(url, historicLayerOptions(def)));

  if (tileLayers.length === 1) return tileLayers[0];

  const composite = L.layerGroup(tileLayers);
  composite._historicTileLayers = tileLayers;
  composite.options.attribution = def.attribution;
  composite.setOpacity = opacity => {
    tileLayers.forEach(layer => layer.setOpacity(opacity));
    return composite;
  };
  composite.bringToFront = () => {
    tileLayers.forEach(layer => layer.bringToFront());
    return composite;
  };
  composite.redraw = () => {
    tileLayers.forEach(layer => layer.redraw());
    return composite;
  };

  return composite;
}

function historicLayerOptions(def) {
  return {
    attribution: def.attribution,
    minZoom: def.minZoom != null ? def.minZoom : 10,
    maxNativeZoom: def.maxNativeZoom,
    maxZoom: def.maxZoom != null ? def.maxZoom : MAP_MAX_ZOOM,
    bounds: L.latLngBounds(def.bounds),
    tms: def.scheme === 'tms'
  };
}

// ---------------------------------------------------------------------------
// Base layers
// ---------------------------------------------------------------------------
const BASE_LAYER_DEFS = SITE_CONFIG.BASE_LAYER_DEFS || [];

// ---------------------------------------------------------------------------
// URL hash  (#zoom/lat/lng/layerId/baseId[/quadrants/layerId,...])
// Quadrant IDs may be historic manifest IDs or base:<id> values such as
// base:esri.
// ---------------------------------------------------------------------------
function parseHash() {
  const parts = window.location.hash.replace(/^#\/?/, '').split('/');
  if (parts.length < 3) return null;
  const zoom = parseFloat(parts[0]);
  const lat = parseFloat(parts[1]);
  const lng = parseFloat(parts[2]);
  if (![zoom, lat, lng].every(Number.isFinite) ||
      zoom < 8 || zoom > MAP_MAX_ZOOM ||
      lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return null;
  }
  return {
    zoom,
    center: [lat, lng],
    layerId: parts[3] && parts[3] !== 'none' ? parts[3] : null,
    baseId: parts[4] || null,
    quadrantLayerIds: parts[5] === 'quadrants' && parts[6]
      ? parts[6].split(',').filter(Boolean)
      : null
  };
}

// ---------------------------------------------------------------------------
// App state
// ---------------------------------------------------------------------------
const app = {
  map: null,
  manifest: null,
  baseLayers: {},          // id -> L.TileLayer
  historicLayers: {},      // id -> L.TileLayer
  historicLoadStates: {},  // id -> visible tile health
  layerDefs: {},           // id -> manifest entry
  currentBaseId: 'esri',
  currentLayerId: null,
  mode: 'overlay',         // 'overlay' | 'blend' | 'compare' | 'quadrants'
  opacity: 0.7,
  showFootprint: false,
  footprintRect: null,
  showReferenceOverlay: false,
  referenceOverlay: null,
  referenceOverlayRequest: 0,
  referenceOverlayCache: new Map(),
  swipe: { position: 0.5, divider: null, dragging: false },
  gcpPicker: false,        // click-to-copy coordinate picker (for GCP collection)
  gcpMarker: null,
  brightness: 1,           // CSS filter on the active historic layer
  contrast: 1,
  quadrants: null,
  quadrantLayerIds: null
};

const QUADRANT_BASE_PREFIX = SITE_CONFIG.QUADRANT_BASE_PREFIX || 'base:';
const DEFAULT_QUADRANT_LAYER_IDS = SITE_CONFIG.DEFAULT_QUADRANT_LAYER_IDS || [
  'cairns1952', 'cairns65', 'cairns1977', `${QUADRANT_BASE_PREFIX}esri`
];

function quadrantBaseId(id) {
  return typeof id === 'string' && id.startsWith(QUADRANT_BASE_PREFIX)
    ? id.slice(QUADRANT_BASE_PREFIX.length)
    : null;
}

function quadrantBaseDef(id) {
  const baseId = quadrantBaseId(id);
  return baseId ? BASE_LAYER_DEFS.find(def => def.id === baseId) : null;
}

function isValidQuadrantId(id) {
  return Boolean(app.layerDefs[id] || quadrantBaseDef(id));
}

function currentHistoricLayer() {
  return app.currentLayerId ? app.historicLayers[app.currentLayerId] : null;
}

function renderTileNotice(notice, state, name) {
  notice.hidden = !state?.kind || state.dismissed;
  if (notice.hidden) return;
  const coverage = state.kind === 'coverage';
  notice.dataset.kind = state.kind;
  notice.querySelector('strong').textContent = coverage ? 'No imagery here'
    : state.kind === 'failed' ? 'Imagery loading issue' : 'Imagery unavailable here';
  notice.title = coverage
    ? `${name}: this location may be outside the photographed area.`
    : `${name}: imagery could not be loaded at this location. Retry or try another area or year.`;
  const retry = notice.querySelector('[data-tile-retry]');
  retry.hidden = coverage;
  retry.setAttribute('aria-label', `Retry loading ${name}`);
}

function updateActiveLayerStatus() {
  const notice = document.getElementById('layer-status');
  if (!notice) return;
  if (!app.map || !app.currentLayerId || app.mode === 'quadrants') {
    notice.hidden = true;
    return;
  }
  renderTileNotice(notice, app.historicLoadStates[app.currentLayerId], app.layerDefs[app.currentLayerId].name);
}

function bindHistoricLayerState(layer, def) {
  app.historicLoadStates[def.id] = window.monitorHistoricTiles(
    layer, app.map, historicTileLayers(layer), updateActiveLayerStatus
  );
}

function retryActiveHistoricLayer() {
  app.historicLoadStates[app.currentLayerId]?.retry();
}

function createAddressGeocoder() {
  const nominatim = L.Control.Geocoder.nominatim({
    geocodingQueryParams: SITE_CONFIG.GEOCODER || {
      countrycodes: 'au',
      viewbox: '145.4,-17.1,146.1,-16.7',
      bounded: 1,
      limit: 5
    }
  });
  const photon = L.Control.Geocoder.photon({
    serviceUrl: SITE_CONFIG.PHOTON?.serviceUrl || 'https://photon.komoot.io/api/'
  });
  const fallbackQuery = query => `${query}, Cairns, Queensland, Australia`;

  return {
    geocode(query, callback, context) {
      nominatim.geocode(query, results => {
        if (Array.isArray(results) && results.length) {
          callback.call(context, results);
          return;
        }
        photon.geocode(fallbackQuery(query), callback, context);
      }, context);
    },
    suggest(query, callback, context) {
      this.geocode(query, callback, context);
    },
    reverse(latlng, callback, context) {
      nominatim.reverse(latlng, results => {
        if (Array.isArray(results) && results.length) {
          callback.call(context, results);
          return;
        }
        photon.reverse(latlng, callback, context);
      }, context);
    }
  };
}

// Apply brightness/contrast as a CSS filter on the active historic layer's tile
// container. Purely client-side (no re-tiling); lets the user rescue washed-out or
// low-contrast areas per-view.
function applyImageAdjust() {
  const layer = currentHistoricLayer();
  if (!layer) return;
  historicLayerContainers(layer).forEach(container => {
    container.style.filter = `brightness(${app.brightness}) contrast(${app.contrast})`;
  });
}

function updateHash() {
  if (!app.map) return;
  const activeMap = app.quadrants ? app.quadrants.panes[0].map : app.map;
  const c = activeMap.getCenter();
  const z = activeMap.getZoom();
  const base = `#${z}/${c.lat.toFixed(5)}/${c.lng.toFixed(5)}/${app.currentLayerId || 'none'}/${app.currentBaseId || 'none'}`;
  const selected = app.quadrants ? app.quadrants.panes.map(pane => pane.layerId) : [];
  const hash = selected.length === 4 ? `${base}/quadrants/${selected.join(',')}` : base;
  history.replaceState(null, '', hash);
}

function updateAttribution() {
  const control = app.map.attributionControl;
  if (!control) return;
  control._attributions = {};
  const parts = [];
  if (app.currentBaseId) parts.push(app.baseLayers[app.currentBaseId].options.attribution);
  const historic = currentHistoricLayer();
  if (historic) parts.push(historic.options.attribution);
  control.addAttribution(parts.filter(Boolean).join(' | '));
}

// ---------------------------------------------------------------------------
// Swipe compare
// ---------------------------------------------------------------------------
function createSwipeDivider() {
  const mapEl = app.map.getContainer();
  const divider = document.createElement('div');
  divider.className = 'swipe-divider';
  divider.innerHTML = `
    <div class="swipe-handle" role="slider" tabindex="0"
      aria-label="Historic imagery comparison divider"
      aria-valuemin="3" aria-valuemax="97" aria-valuenow="50"
      aria-valuetext="50% historic imagery on the left"
      aria-orientation="horizontal" title="Drag or use arrow keys to compare">&#x2194;</div>
  `;
  mapEl.appendChild(divider);
  app.swipe.divider = divider;

  const handle = divider.querySelector('.swipe-handle');

  function setSwipePosition(position) {
    app.swipe.position = Math.min(0.97, Math.max(0.03, position));
    const percent = Math.round(app.swipe.position * 100);
    handle.setAttribute('aria-valuenow', String(percent));
    handle.setAttribute('aria-valuetext', `${percent}% historic imagery on the left`);
    updateSwipe();
  }

  function onMove(e) {
    if (!app.swipe.dragging) return;
    const rect = mapEl.getBoundingClientRect();
    const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
    setSwipePosition(x / rect.width);
    e.preventDefault();
  }

  function onUp() {
    if (!app.swipe.dragging) return;
    app.swipe.dragging = false;
    app.map.dragging.enable();
  }

  function onDown(e) {
    app.swipe.dragging = true;
    app.map.dragging.disable();
    e.preventDefault();
    e.stopPropagation();
  }

  function onKeyDown(e) {
    const step = e.shiftKey ? 0.1 : 0.02;
    let next = app.swipe.position;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') next -= step;
    else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') next += step;
    else if (e.key === 'Home') next = 0.03;
    else if (e.key === 'End') next = 0.97;
    else return;
    e.preventDefault();
    setSwipePosition(next);
  }

  handle.addEventListener('mousedown', onDown);
  handle.addEventListener('touchstart', onDown, { passive: false });
  handle.addEventListener('keydown', onKeyDown);
  document.addEventListener('mousemove', onMove);
  document.addEventListener('touchmove', onMove, { passive: false });
  document.addEventListener('mouseup', onUp);
  document.addEventListener('touchend', onUp);
  document.addEventListener('touchcancel', onUp);
  window.addEventListener('blur', onUp);

  app.map.on('move zoom viewreset resize', updateSwipe);
}

// Clip the historic layer's tile container to the left of the divider.
// Coordinates must be in layer-point space because the tile pane is
// transformed as the map pans.
function updateSwipe() {
  const layer = currentHistoricLayer();
  const active = app.mode === 'compare' && layer;
  if (app.swipe.divider) {
    app.swipe.divider.style.display = active ? 'block' : 'none';
    app.swipe.divider.style.left = `${app.swipe.position * 100}%`;
  }
  if (!layer) return;
  const containers = historicLayerContainers(layer);
  if (!containers.length) return;
  if (!active) {
    containers.forEach(container => { container.style.clip = ''; });
    return;
  }
  const nw = app.map.containerPointToLayerPoint([0, 0]);
  const se = app.map.containerPointToLayerPoint(app.map.getSize());
  const clipX = nw.x + (se.x - nw.x) * app.swipe.position;
  containers.forEach(container => {
    container.style.clip = `rect(${nw.y}px, ${clipX}px, ${se.y}px, ${nw.x}px)`;
  });
}

// ---------------------------------------------------------------------------
// Layer / mode switching
// ---------------------------------------------------------------------------
function applyMode() {
  const isQuadrants = app.mode === 'quadrants';
  if (isQuadrants) enterQuadrantMode();
  else exitQuadrantMode();

  const layer = currentHistoricLayer();
  if (layer) {
    layer.setOpacity(app.mode === 'blend' ? app.opacity : 1);
    // Compare needs a base layer underneath
    if (app.mode === 'compare' && !app.currentBaseId) setBaseLayer('esri');
  }
  const sliderContainer = document.querySelector('.opacity-slider-container');
  if (sliderContainer) {
    // show whenever a historic layer is active (brightness/contrast apply in every
    // mode); the opacity row itself only matters in blend mode
    sliderContainer.style.display = layer && !isQuadrants ? 'block' : 'none';
    const opRow = document.getElementById('opacity-slider');
    const opLbl = sliderContainer.querySelector('.opacity-label');
    const opVal = document.getElementById('opacity-value');
    const showOp = app.mode === 'blend' ? '' : 'none';
    if (opRow) opRow.style.display = showOp;
    if (opLbl) opLbl.style.display = showOp;
    if (opVal) opVal.style.display = showOp;
  }
  updateSwipe();
  updateActiveLayerStatus();
}

// ---------------------------------------------------------------------------
// Four-panel historic comparison
// ---------------------------------------------------------------------------
function updateQuadrantAttribution() {
  if (!app.quadrants || !app.quadrants.attribution) return;
  const attributions = app.quadrants.panes
    .map(pane => app.layerDefs[pane.layerId]?.attribution ||
      quadrantBaseDef(pane.layerId)?.options.attribution)
    .filter((value, index, values) => value && values.indexOf(value) === index);
  app.quadrants.attribution.innerHTML = [
    '<a href="https://leafletjs.com" target="_blank" rel="noopener noreferrer">Leaflet</a>',
    ...attributions
  ].join(' <span aria-hidden="true">|</span> ');
  app.quadrants.attribution.title = app.quadrants.attribution.textContent.trim();
}

function updatePaneNotices(pane) {
  const def = app.layerDefs[pane.layerId];
  if (!def) {
    pane.coverageNotice.hidden = true;
    pane.availabilityNotice.hidden = true;
    return;
  }
  const covered = L.latLngBounds(def.bounds).contains(pane.map.getCenter());
  pane.coverageNotice.hidden = covered;
  renderTileNotice(pane.availabilityNotice, pane.tileState, def.name);
  if (!covered) pane.availabilityNotice.hidden = true;
}

function updateQuadrantCoverage() {
  if (!app.quadrants) return;
  app.quadrants.panes.forEach(updatePaneNotices);
}

function setQuadrantLayer(pane, layerId) {
  const def = app.layerDefs[layerId];
  const baseDef = quadrantBaseDef(layerId);
  if (!def && !baseDef) return;
  if (pane.layer) pane.map.removeLayer(pane.layer);
  if (pane.baseLayer) {
    pane.map.removeLayer(pane.baseLayer);
    pane.baseLayer = null;
  }
  if (pane.coverageBoundary) {
    pane.map.removeLayer(pane.coverageBoundary);
    pane.coverageBoundary = null;
  }
  if (pane.referenceOverlay) {
    pane.map.removeLayer(pane.referenceOverlay);
    pane.referenceOverlay = null;
  }
  pane.layerId = layerId;
  pane.tileState = null;
  pane.layer = null;
  if (pane.mapElement) {
    const label = baseDef ? `Current ${baseDef.name} map pane` : `Historic ${def.name} imagery pane`;
    pane.mapElement.setAttribute('aria-label', label);
  }
  if (baseDef) {
    pane.baseLayer = createTileLayer(baseDef.url, Object.assign({ keepBuffer: 2 }, baseDef.options));
  } else {
    pane.layer = createHistoricLayer(def);
  }
  const sources = pane.layer ? historicTileLayers(pane.layer) : [pane.baseLayer];
  pane.tileState = window.monitorHistoricTiles(
    pane.layer || pane.baseLayer, pane.map, sources, () => updatePaneNotices(pane)
  );
  (pane.layer || pane.baseLayer).addTo(pane.map);
  updatePaneReferenceOverlay(pane, def);
  if (def?.showBoundaryInQuadrants) {
    pane.coverageBoundary = L.rectangle(def.bounds, {
      color: def.boundaryColor || '#06b6d4',
      weight: 3,
      dashArray: '8 6',
      fill: false,
      interactive: false
    }).addTo(pane.map);
  }
  pane.select.value = layerId;
  updatePaneNotices(pane);
  if (app.quadrants) {
    app.quadrantLayerIds = app.quadrants.panes.map(item => item.layerId);
    updateQuadrantAttribution();
    updateHash();
  }
}

function syncQuadrantMaps(sourceMap) {
  if (!app.quadrants || app.quadrants.syncing) return;
  app.quadrants.syncing = true;
  const center = sourceMap.getCenter();
  const zoom = sourceMap.getZoom();
  app.quadrants.panes.forEach(pane => {
    if (pane.map !== sourceMap) pane.map.setView(center, zoom, { animate: false });
  });
  app.quadrants.syncing = false;
  updateQuadrantCoverage();
  updateHash();
}

function exitQuadrantMode() {
  if (!app.quadrants) return;
  const { container, panes, resizeHandler } = app.quadrants;
  panes.forEach(pane => pane.map.remove());
  window.removeEventListener('resize', resizeHandler);
  container.remove();
  app.quadrants = null;
  app.map.invalidateSize();
}

function enterQuadrantMode() {
  if (app.quadrants || !app.map || !app.manifest) return;

  const currentView = { center: app.map.getCenter(), zoom: app.map.getZoom() };
  const defs = app.manifest.layers;
  const requestedIds = (app.quadrantLayerIds || []).filter(isValidQuadrantId);
  const defaults = requestedIds.length ? requestedIds : DEFAULT_QUADRANT_LAYER_IDS;
  const selectedIds = [...defaults, ...defs.map(def => def.id)]
    .filter((id, index, ids) => id && ids.indexOf(id) === index)
    .slice(0, 4);

  const currentOptions = BASE_LAYER_DEFS.map(def =>
    `<option value="${QUADRANT_BASE_PREFIX}${def.id}">Current — ${def.name}</option>`
  ).join('');
  const historicOptions = defs.map(def =>
    `<option value="${def.id}">${def.name}</option>`
  ).join('');

  const container = document.createElement('section');
  container.className = 'quadrant-view';
  container.setAttribute('aria-label', 'Four-panel historic imagery comparison');
  container.innerHTML = `
    <div class="quadrant-toolbar">
      <span>Four-panel comparison</span>
      <button type="button" class="location-control-button quadrant-location" title="Find my location" aria-label="Find my location"></button>
      <button type="button" class="quadrant-exit" title="Return to single-map view" aria-label="Return to single-map view">&times;</button>
    </div>
    <div class="quadrant-grid"></div>
    <div class="quadrant-attribution" aria-label="Map and imagery attribution"></div>
  `;
  app.map.getContainer().appendChild(container);

  const grid = container.querySelector('.quadrant-grid');
  const panes = selectedIds.map((layerId, index) => {
    const paneEl = document.createElement('article');
    paneEl.className = 'quadrant-pane';
    paneEl.innerHTML = `
      <div class="quadrant-pane-map" aria-label="Historic imagery pane ${index + 1}"></div>
      <label class="quadrant-select-wrap">
        <span class="sr-only">Map layer for pane ${index + 1}</span>
        <select class="quadrant-select">
          <optgroup label="Current maps">${currentOptions}</optgroup>
          <optgroup label="Historic imagery">${historicOptions}</optgroup>
        </select>
      </label>
      <div class="quadrant-coverage-notice" role="status" aria-live="polite" hidden>
        <strong>Outside survey area</strong>
      </div>
      <div class="quadrant-availability-notice" role="status" aria-live="polite" hidden>
        <strong>Imagery unavailable here</strong>
        <button type="button" data-tile-retry>Retry</button>
        <button type="button" data-tile-dismiss aria-label="Dismiss imagery notice">×</button>
      </div>
    `;
    grid.appendChild(paneEl);

    const map = L.map(paneEl.querySelector('.quadrant-pane-map'), {
      center: currentView.center,
      zoom: currentView.zoom,
      minZoom: 8,
      maxZoom: MAP_MAX_ZOOM,
      zoomControl: false,
      attributionControl: false,
      preferCanvas: true
    });
    L.control.zoom({ position: 'bottomleft' }).addTo(map);
    const pane = {
      map,
      mapElement: paneEl.querySelector('.quadrant-pane-map'),
      layerId,
      layer: null,
      baseLayer: null,
      coverageBoundary: null,
      referenceOverlay: null,
      referenceOverlayRequest: 0,
      select: paneEl.querySelector('.quadrant-select'),
      coverageNotice: paneEl.querySelector('.quadrant-coverage-notice'),
      availabilityNotice: paneEl.querySelector('.quadrant-availability-notice'),
      tileState: { loaded: 0, errors: 0, requested: 0, settled: false }
    };
    pane.availabilityNotice.querySelector('[data-tile-retry]').addEventListener('click', () => pane.tileState?.retry());
    pane.availabilityNotice.querySelector('[data-tile-dismiss]').addEventListener('click', () => {
      pane.tileState.dismissed = true;
      updatePaneNotices(pane);
    });
    L.DomEvent.disableClickPropagation(pane.availabilityNotice);
    pane.select.addEventListener('change', event => setQuadrantLayer(pane, event.target.value));
    L.DomEvent.disableClickPropagation(paneEl.querySelector('.quadrant-select-wrap'));
    map.on('moveend zoomend', () => syncQuadrantMaps(map));
    setQuadrantLayer(pane, layerId);
    return pane;
  });

  const resizeHandler = () => {
    if (!app.quadrants) return;
    app.quadrants.panes.forEach(pane => pane.map.invalidateSize());
  };
  app.quadrants = {
    container,
    panes,
    attribution: container.querySelector('.quadrant-attribution'),
    syncing: false,
    resizeHandler
  };
  app.quadrantLayerIds = panes.map(pane => pane.layerId);
  window.addEventListener('resize', resizeHandler);

  const quadrantLocationButton = container.querySelector('.quadrant-location');
  if (quadrantLocationButton) {
    bindLocationButton(quadrantLocationButton);
    L.DomEvent.disableClickPropagation(quadrantLocationButton);
  }

  container.querySelector('.quadrant-exit').addEventListener('click', () => {
    app.mode = 'overlay';
    const overlayRadio = document.querySelector('input[name="view-mode"][value="overlay"]');
    if (overlayRadio) overlayRadio.checked = true;
    applyMode();
    updateHash();
  });
  resizeHandler();
  updateQuadrantCoverage();
  updateQuadrantAttribution();
  updateHash();
}

function updateFootprint() {
  if (app.footprintRect) {
    app.map.removeLayer(app.footprintRect);
    app.footprintRect = null;
  }
  const def = app.currentLayerId ? app.layerDefs[app.currentLayerId] : null;
  if (def && app.showFootprint) {
    app.footprintRect = L.rectangle(def.bounds, {
      color: def.boundaryColor || '#06b6d4',
      weight: 2,
      dashArray: '6 6',
      fill: false,
      interactive: false
    }).addTo(app.map);
  }
}

function loadReferenceOverlay(url) {
  if (!app.referenceOverlayCache.has(url)) {
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    const timeout = window.setTimeout(() => controller?.abort(), 10000);
    const request = fetch(url, controller ? { signal: controller.signal } : undefined)
      .then(response => {
        if (!response.ok) throw new Error(`Could not load reference overlay (${response.status})`);
        return response.json();
      })
      .finally(() => window.clearTimeout(timeout))
      .catch(error => {
      app.referenceOverlayCache.delete(url);
      throw error;
      });
    app.referenceOverlayCache.set(url, request);
  }
  return app.referenceOverlayCache.get(url);
}

function referenceOverlayStyle(feature) {
  const isDamWall = feature.properties?.id === 'tinaroo-falls-dam-wall';
  return {
    color: isDamWall ? '#f97316' : '#06b6d4',
    weight: isDamWall ? 2.5 : 2,
    opacity: 0.95,
    dashArray: isDamWall ? null : '7 5',
    fill: false
  };
}

function createReferenceOverlay(collection) {
  return L.geoJSON(collection, {
    pane: 'overlayPane',
    style: referenceOverlayStyle,
    onEachFeature: (feature, layer) => {
      const label = feature.properties?.label;
      if (label) layer.bindTooltip(label, { sticky: true });
    }
  });
}

function updateReferenceOverlayControl() {
  const option = document.getElementById('reference-overlay-option');
  const checkbox = document.getElementById('reference-overlay-toggle');
  const label = document.getElementById('reference-overlay-label');
  const def = app.currentLayerId ? app.layerDefs[app.currentLayerId] : null;
  const available = Boolean(def?.referenceOverlayUrl);

  if (option) option.hidden = !available;
  if (label) label.textContent = def?.referenceOverlayLabel || 'Show reference boundary';
  app.showReferenceOverlay = available;
  if (checkbox) checkbox.checked = available;
}

async function updateReferenceOverlay() {
  const requestId = ++app.referenceOverlayRequest;
  const def = app.currentLayerId ? app.layerDefs[app.currentLayerId] : null;

  if (app.referenceOverlay) {
    app.map.removeLayer(app.referenceOverlay);
    app.referenceOverlay = null;
  }
  if (!app.showReferenceOverlay || !def?.referenceOverlayUrl) return;

  try {
    const collection = await loadReferenceOverlay(def.referenceOverlayUrl);
    if (requestId !== app.referenceOverlayRequest || app.currentLayerId !== def.id) return;
    app.referenceOverlay = createReferenceOverlay(collection).addTo(app.map);
    app.referenceOverlay.bringToFront();
  } catch (error) {
    console.error('Could not display reference overlay', error);
    if (requestId !== app.referenceOverlayRequest) return;
    app.showReferenceOverlay = false;
    const checkbox = document.getElementById('reference-overlay-toggle');
    if (checkbox) checkbox.checked = false;
  }
}

async function updatePaneReferenceOverlay(pane, def) {
  const requestId = ++pane.referenceOverlayRequest;
  if (pane.referenceOverlay) {
    pane.map.removeLayer(pane.referenceOverlay);
    pane.referenceOverlay = null;
  }
  if (!def?.referenceOverlayUrl) return;

  try {
    const collection = await loadReferenceOverlay(def.referenceOverlayUrl);
    if (requestId !== pane.referenceOverlayRequest || pane.layerId !== def.id) return;
    pane.referenceOverlay = createReferenceOverlay(collection).addTo(pane.map);
    pane.referenceOverlay.bringToFront();
  } catch (error) {
    console.error('Could not display quadrant reference overlay', error);
  }
}

function selectHistoricLayer(layerId) {
  const previous = currentHistoricLayer();
  if (previous) {
    historicLayerContainers(previous).forEach(container => { container.style.clip = ''; });
    app.map.removeLayer(previous);
  }
  app.currentLayerId = layerId && app.historicLayers[layerId] ? layerId : null;
  const layer = currentHistoricLayer();

  if (layer) {
    layer.addTo(app.map);
    layer.bringToFront();
    // Jump to the layer only if it's nowhere in the current view
    const def = app.layerDefs[app.currentLayerId];
    if (def.showBoundaryByDefault) {
      app.showFootprint = true;
      const footprintToggle = document.getElementById('footprint-toggle');
      if (footprintToggle) footprintToggle.checked = true;
    }
    const layerBounds = L.latLngBounds(def.bounds);
    if (!app.map.getBounds().intersects(layerBounds)) {
      app.map.fitBounds(layerBounds);
    }
  }

  // Update timeline UI
  document.querySelectorAll('.timeline-chip').forEach(chip => {
    const active = (chip.dataset.id || null) === app.currentLayerId;
    chip.classList.toggle('active', active);
    chip.setAttribute('aria-pressed', String(active));
  });
  const label = document.getElementById('timeline-label');
  if (label) {
    label.textContent = layer ? app.layerDefs[app.currentLayerId].name : 'Historic imagery maps';
  }

  updateReferenceOverlayControl();
  updateReferenceOverlay();
  updateFootprint();
  applyMode();
  applyImageAdjust();   // re-apply brightness/contrast to the newly-active layer
  updateActiveLayerStatus();
  updateAttribution();
  updateHash();
}

function setBaseLayer(baseId) {
  if (app.currentBaseId && app.baseLayers[app.currentBaseId]) {
    app.map.removeLayer(app.baseLayers[app.currentBaseId]);
  }
  app.currentBaseId = baseId && app.baseLayers[baseId] ? baseId : null;
  if (app.currentBaseId) {
    app.baseLayers[app.currentBaseId].addTo(app.map);
    const historic = currentHistoricLayer();
    if (historic) historic.bringToFront();
  }
  const radio = document.querySelector(`input[name="base-layer"][value="${app.currentBaseId || 'none'}"]`);
  if (radio) radio.checked = true;
  updateAttribution();
  updateHash();
}

// ---------------------------------------------------------------------------
// Controls
// ---------------------------------------------------------------------------
function createTimeline(manifest) {
  const mapEl = app.map.getContainer();
  const wrap = document.createElement('div');
  wrap.className = 'timeline-control';

  const sorted = [...manifest.layers].sort((a, b) => a.year - b.year);

  // When two layers share a year (e.g. two 1965 surveys of different areas),
  // a bare "1965" chip can't tell them apart - show the full name in that case.
  const yearCounts = {};
  sorted.forEach(d => { yearCounts[d.year] = (yearCounts[d.year] || 0) + 1; });
  const chipLabel = def => def.timelineLabel ||
    (yearCounts[def.year] > 1 ? def.name : String(def.year));

  wrap.innerHTML = `
    <div class="timeline-label" id="timeline-label" aria-live="polite">Historic imagery maps</div>
    <div class="timeline-track" role="group" aria-label="Historic imagery layer">
      ${sorted.map(def => `
        <button type="button" class="timeline-chip" data-id="${def.id}" title="${def.name}" aria-pressed="false">${chipLabel(def)}</button>
      `).join('')}
      <button type="button" class="timeline-chip active" data-id="" title="Hide historic imagery" aria-pressed="true">Today</button>
    </div>
  `;
  mapEl.appendChild(wrap);

  wrap.querySelectorAll('.timeline-chip').forEach(chip => {
    chip.addEventListener('click', () => selectHistoricLayer(chip.dataset.id || null));
  });

  L.DomEvent.disableClickPropagation(wrap);
  L.DomEvent.disableScrollPropagation(wrap);
}

function createLayerControl() {
  const control = L.control({ position: 'topright' });

  control.onAdd = function () {
    const div = L.DomUtil.create('div', 'custom-layer-control');
    const isMobile = window.matchMedia('(max-width: 600px)').matches;
    if (isMobile) div.classList.add('collapsed');

    div.innerHTML = `
      <div class="layer-control-header" id="layer-control-header">
        <span class="layer-control-title">Map Options</span>
        <button class="layer-control-toggle" id="layer-control-toggle" aria-label="Toggle map options panel" aria-expanded="${isMobile ? 'false' : 'true'}">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M2 8L6 4L10 8" stroke="#334155" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
      </div>
      <div class="layer-control-body">
        <div class="layer-group">
          <div class="group-title">Base Layer</div>
          ${BASE_LAYER_DEFS.map(def => `
            <label class="layer-option">
              <input type="radio" name="base-layer" value="${def.id}" ${def.id === app.currentBaseId ? 'checked' : ''}>
              <span>${def.name}</span>
            </label>
          `).join('')}
          <label class="layer-option">
            <input type="radio" name="base-layer" value="none" ${app.currentBaseId ? '' : 'checked'}>
            <span>None (Historic Only)</span>
          </label>
        </div>

        <div class="layer-group">
          <div class="group-title">Historic View</div>
          <label class="layer-option">
            <input type="radio" name="view-mode" value="overlay" checked>
            <span>Overlay (full)</span>
          </label>
          <label class="layer-option">
            <input type="radio" name="view-mode" value="blend">
            <span>Blend (opacity)</span>
          </label>
          <label class="layer-option">
            <input type="radio" name="view-mode" value="compare">
            <span>Compare (swipe)</span>
          </label>
          <label class="layer-option">
            <input type="radio" name="view-mode" value="quadrants">
            <span>Four-panel comparison</span>
          </label>
        </div>

        <div class="layer-group">
          <label class="layer-option">
            <input type="checkbox" id="footprint-toggle">
            <span>Show coverage outline</span>
          </label>
          <label class="layer-option" id="reference-overlay-option" hidden>
            <input type="checkbox" id="reference-overlay-toggle">
            <span id="reference-overlay-label">Show reference boundary</span>
          </label>
          <label class="layer-option">
            <input type="checkbox" id="gcp-toggle">
            <span>Coordinate picker (click&nbsp;&rarr;&nbsp;copy)</span>
          </label>
        </div>
      </div>
    `;

    const header = div.querySelector('#layer-control-header');
    const toggleBtn = div.querySelector('#layer-control-toggle');
    let userToggled = false;
    header.addEventListener('click', () => {
      userToggled = true;
      const collapsed = div.classList.toggle('collapsed');
      toggleBtn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
    });

    // The viewport can change (or report width 0 in embedded contexts) at load
    // time - keep the auto collapse in sync until the user takes over.
    const mql = window.matchMedia('(max-width: 600px)');
    function syncCollapse() {
      if (userToggled) return;
      div.classList.toggle('collapsed', mql.matches);
      toggleBtn.setAttribute('aria-expanded', mql.matches ? 'false' : 'true');
    }
    if (mql.addEventListener) mql.addEventListener('change', syncCollapse);
    window.addEventListener('resize', syncCollapse);
    setTimeout(syncCollapse, 300);

    div.querySelectorAll('input[name="base-layer"]').forEach(input => {
      input.addEventListener('change', e => {
        setBaseLayer(e.target.value === 'none' ? null : e.target.value);
      });
    });

    div.querySelectorAll('input[name="view-mode"]').forEach(input => {
      input.addEventListener('change', e => {
        app.mode = e.target.value;
        applyMode();
        updateHash();
      });
    });

    div.querySelector('#footprint-toggle').addEventListener('change', e => {
      app.showFootprint = e.target.checked;
      updateFootprint();
    });

    div.querySelector('#reference-overlay-toggle').addEventListener('change', e => {
      app.showReferenceOverlay = e.target.checked;
      updateReferenceOverlay();
    });

    div.querySelector('#gcp-toggle').addEventListener('change', e => {
      setGcpPicker(e.target.checked);
    });

    L.DomEvent.disableClickPropagation(div);
    L.DomEvent.disableScrollPropagation(div);
    return div;
  };

  return control;
}

// ---------------------------------------------------------------------------
// Coordinate picker  (click the map to read + copy "lat,lng" for GCP work)
// ---------------------------------------------------------------------------
function createCoordReadout() {
  const control = L.control({ position: 'topleft' });
  control.onAdd = function () {
    const div = L.DomUtil.create('div', 'gcp-readout');
    div.id = 'gcp-readout';
    div.style.cssText =
      'display:none;background:rgba(15,23,42,.92);color:#e2e8f0;font:13px/1.3 ' +
      'system-ui,sans-serif;padding:8px 10px;border-radius:8px;box-shadow:0 2px 8px ' +
      'rgba(0,0,0,.35);min-width:190px';
    div.innerHTML =
      '<div style="font-size:11px;text-transform:uppercase;letter-spacing:.04em;' +
      'color:#94a3b8;margin-bottom:4px">Coordinate picker</div>' +
      '<div id="gcp-readout-value" style="font-variant-numeric:tabular-nums;' +
      'font-weight:600;margin-bottom:6px">click the map…</div>' +
      '<button id="gcp-readout-copy" type="button" style="font:12px system-ui;' +
      'cursor:pointer;border:0;border-radius:6px;padding:4px 10px;background:#0ea5e9;' +
      'color:#fff">Copy</button>' +
      '<span id="gcp-readout-hint" style="margin-left:8px;color:#94a3b8;font-size:11px">' +
      'drag pin to nudge</span>';
    L.DomEvent.disableClickPropagation(div);
    L.DomEvent.disableScrollPropagation(div);
    return div;
  };
  return control;
}

let locationStatusTimer = null;

function showLocationStatus(message, isError = false) {
  const status = document.getElementById('location-status');
  if (!status) return;
  status.textContent = message;
  status.classList.toggle('error', isError);
  status.hidden = false;
  if (locationStatusTimer) window.clearTimeout(locationStatusTimer);
  locationStatusTimer = window.setTimeout(() => {
    status.hidden = true;
  }, isError ? 7000 : 4500);
}

function activeLocationMap() {
  if (app.mode === 'quadrants' && app.quadrants?.panes?.[0]?.map) {
    return app.quadrants.panes[0].map;
  }
  return app.map;
}

function locationButtonMarkup() {
  return '<svg viewBox="0 0 24 24" data-icon="location-arrow" aria-hidden="true">' +
    '<path fill="currentColor" d="M20.65 2.65 3.54 9.94c-.92.39-.83 1.72.14 1.99l6.91 1.92 1.92 6.91c.27.97 1.6 1.06 1.99.14l7.29-17.11c.34-.79-.36-1.49-1.14-1.14Zm-7.03 15.07-1.38-4.96a1.05 1.05 0 0 0-.73-.73l-4.96-1.38 12.31-5.24-5.24 12.31Z"></path>' +
    '</svg>';
}

function resetLocationButton(button) {
  button.disabled = false;
  button.classList.remove('is-locating');
  button.removeAttribute('aria-busy');
}

function requestUserLocation(button) {
  if (!navigator.geolocation) {
    showLocationStatus('Location detection is not available in this browser.', true);
    return;
  }

  button.disabled = true;
  button.classList.add('is-locating');
  button.setAttribute('aria-busy', 'true');
  showLocationStatus('Finding your location… It is used only to centre this map and is not stored.');

  navigator.geolocation.getCurrentPosition(position => {
    const map = activeLocationMap();
    if (!map) {
      resetLocationButton(button);
      return;
    }
    const { latitude, longitude, accuracy } = position.coords;
    const zoom = Math.min(MAP_MAX_ZOOM, 18);
    map.setView([latitude, longitude], zoom, { animate: true });
    const accuracyText = Number.isFinite(accuracy)
      ? ` (accuracy ±${Math.round(accuracy)} m)`
      : '';
    showLocationStatus(`Location found${accuracyText}.`);
    resetLocationButton(button);
  }, error => {
    const message = error.code === 1
      ? 'Location access was denied. Please allow it in your browser settings.'
      : error.code === 2
        ? 'Your location could not be determined.'
        : 'Location detection timed out. Please try again.';
    showLocationStatus(message, true);
    resetLocationButton(button);
  }, {
    enableHighAccuracy: true,
    maximumAge: 30000,
    timeout: 10000
  });
}

function bindLocationButton(button) {
  button.type = 'button';
  button.title = 'Use your location to centre the map (not stored)';
  button.setAttribute('aria-label', 'Use your location to centre the map (not stored)');
  button.innerHTML = locationButtonMarkup();
  button.addEventListener('click', () => requestUserLocation(button));
}

function createLocationControl() {
  const control = L.control({ position: 'topleft' });

  control.onAdd = function () {
    const div = L.DomUtil.create('div', 'leaflet-bar location-control');
    const button = L.DomUtil.create('button', 'location-control-button', div);
    bindLocationButton(button);

    L.DomEvent.disableClickPropagation(div);
    L.DomEvent.disableScrollPropagation(div);
    return div;
  };

  return control;
}

function createShareControl() {
  const control = L.control({ position: 'topleft' });
  control.onAdd = function () {
    const div = L.DomUtil.create('div', 'leaflet-bar share-control');
    const button = L.DomUtil.create('button', 'share-control-button', div);
    button.type = 'button';
    button.title = 'Copy a link to this map view';
    button.setAttribute('aria-label', 'Copy a link to this map view');
    button.innerHTML = '<svg viewBox="0 0 24 24" data-icon="share" aria-hidden="true">' +
      '<path d="M12 15V3"></path>' +
      '<path d="m7.75 7.25 4.25-4.25 4.25 4.25"></path>' +
      '<path d="M8 10H6.5A2.5 2.5 0 0 0 4 12.5v6A2.5 2.5 0 0 0 6.5 21h11a2.5 2.5 0 0 0 2.5-2.5v-6a2.5 2.5 0 0 0-2.5-2.5H16"></path>' +
      '</svg>';
    button.addEventListener('click', () => {
      updateHash();
      copyToClipboard(window.location.href).then(ok => {
        showLocationStatus(ok ? 'Share link copied to the clipboard.' :
          'Copy failed. You can copy the map URL from your browser address bar.', !ok);
      });
    });
    L.DomEvent.disableClickPropagation(div);
    L.DomEvent.disableScrollPropagation(div);
    return div;
  };
  return control;
}

function groupMapToolControls() {
  const corner = app.map?.getContainer().querySelector('.leaflet-top.leaflet-left');
  if (!corner || corner.querySelector('.map-tool-panel')) return;

  const controls = [
    corner.querySelector('.leaflet-control-zoom'),
    corner.querySelector('.location-control'),
    corner.querySelector('.share-control'),
    corner.querySelector('.leaflet-control-geocoder'),
    corner.querySelector('.opacity-slider-container')
  ].filter(Boolean);
  if (!controls.length) return;

  const panel = L.DomUtil.create('div', 'map-tool-panel leaflet-control');
  panel.setAttribute('role', 'toolbar');
  panel.setAttribute('aria-label', 'Map tools');
  panel.setAttribute('aria-orientation', 'vertical');
  corner.insertBefore(panel, corner.firstChild);
  controls.forEach(control => panel.appendChild(control));
  L.DomEvent.disableClickPropagation(panel);
  L.DomEvent.disableScrollPropagation(panel);
}

function copyToClipboard(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(text).then(() => true, () => false);
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return Promise.resolve(ok);
  } catch (e) { return Promise.resolve(false); }
}

function showGcpCoord(latlng, copy) {
  const lat = latlng.lat.toFixed(5);
  const lng = latlng.lng.toFixed(5);
  const text = `${lat},${lng}`;
  const valEl = document.getElementById('gcp-readout-value');
  const hintEl = document.getElementById('gcp-readout-hint');
  if (valEl) valEl.textContent = text;
  if (copy) {
    copyToClipboard(text).then(ok => {
      if (hintEl) hintEl.textContent = ok ? 'copied ✓' : 'copy failed – select manually';
    });
  } else if (hintEl) {
    hintEl.textContent = 'drag pin to nudge';
  }
  return text;
}

function setGcpPicker(on) {
  app.gcpPicker = on;
  app.map.getContainer().style.cursor = on ? 'crosshair' : '';
  const ro = document.getElementById('gcp-readout');
  if (ro) ro.style.display = on ? 'block' : 'none';
  if (!on && app.gcpMarker) {
    app.map.removeLayer(app.gcpMarker);
    app.gcpMarker = null;
  }
}

function setupGcpPicker() {
  app.map.on('click', e => {
    if (!app.gcpPicker) return;
    if (!app.gcpMarker) {
      app.gcpMarker = L.marker(e.latlng, { draggable: true }).addTo(app.map);
      app.gcpMarker.on('dragend', () => showGcpCoord(app.gcpMarker.getLatLng(), true));
    } else {
      app.gcpMarker.setLatLng(e.latlng);
    }
    showGcpCoord(e.latlng, true);
  });

  const copyBtn = document.getElementById('gcp-readout-copy');
  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      if (app.gcpMarker) showGcpCoord(app.gcpMarker.getLatLng(), true);
    });
  }
}

function createOpacitySlider() {
  const control = L.control({ position: 'topleft' });

  control.onAdd = function () {
    const div = L.DomUtil.create('div', 'opacity-slider-container');
    div.innerHTML = `
      <button type="button" id="opacity-toggle" class="opacity-toggle" title="Image enhancement" aria-label="Open image enhancement controls" aria-expanded="false" aria-controls="image-enhancement-controls">
        <svg viewBox="0 0 24 24" data-icon="image-enhancement" aria-hidden="true">
          <path d="M4 6h5M15 6h5M4 12h9M17 12h3M4 18h2M10 18h10"></path>
          <circle cx="12" cy="6" r="2"></circle>
          <circle cx="15" cy="12" r="2"></circle>
          <circle cx="8" cy="18" r="2"></circle>
        </svg>
      </button>
      <div class="opacity-controls" id="image-enhancement-controls">
        <div class="range-heading">
          <label class="opacity-label" for="opacity-slider">Historic Overlay Opacity</label>
          <output class="opacity-value" id="opacity-value" for="opacity-slider">${Math.round(app.opacity * 100)}%</output>
        </div>
        <input type="range" id="opacity-slider" min="0" max="100" value="${Math.round(app.opacity * 100)}" class="opacity-slider">
        <div class="range-heading range-heading-spaced">
          <label class="opacity-label" for="brightness-slider">Brightness</label>
          <output class="opacity-value" id="brightness-value" for="brightness-slider">${Math.round(app.brightness * 100)}%</output>
        </div>
        <input type="range" id="brightness-slider" min="50" max="150" value="${Math.round(app.brightness * 100)}" class="opacity-slider">
        <div class="range-heading range-heading-spaced">
          <label class="opacity-label" for="contrast-slider">Contrast</label>
          <output class="opacity-value" id="contrast-value" for="contrast-slider">${Math.round(app.contrast * 100)}%</output>
        </div>
        <input type="range" id="contrast-slider" min="50" max="200" value="${Math.round(app.contrast * 100)}" class="opacity-slider">
        <div class="enhancement-reset-wrap"><button type="button" id="bc-reset" class="enhancement-reset">Reset brightness and contrast</button></div>
      </div>
    `;
    div.style.display = 'none';
    div.classList.add('collapsed');
    const toggle = div.querySelector('#opacity-toggle');
    toggle.addEventListener('click', () => {
      const collapsed = div.classList.toggle('collapsed');
      toggle.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
      toggle.setAttribute('aria-label', collapsed
        ? 'Open image enhancement controls'
        : 'Minimize image enhancement controls');
    });
    L.DomEvent.disableClickPropagation(div);
    L.DomEvent.disableScrollPropagation(div);
    return div;
  };

  return control;
}

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------
async function init() {
  // The manifest is loaded by layers.js as a global (window.MAP_CONFIG), not
  // fetch()'d, so the page works from the filesystem (file://) as well as HTTP.
  const manifest = window.MAP_CONFIG;
  if (!manifest || !Array.isArray(manifest.layers)) {
    console.error('Map configuration not found. Is layers.js loaded before main.js?');
    document.getElementById('map').innerHTML =
      '<p style="padding:20px;font-family:sans-serif">Failed to load layer configuration. ' +
      'Make sure <code>layers.js</code> sits next to <code>index.html</code> and loads before <code>main.js</code>.</p>';
    return;
  }
  const validation = window.validateMapManifest
    ? window.validateMapManifest(manifest)
    : { valid: false, errors: ['manifest-validation.js did not load'] };
  if (!validation.valid) {
    console.error('Invalid map configuration:', validation.errors);
    document.getElementById('map').innerHTML =
      '<div class="configuration-error" role="alert">' +
      '<strong>Map configuration needs attention.</strong>' +
      '<span>Some imagery layers could not be started. Please report this message to the site owner.</span>' +
      '</div>';
    return;
  }
  app.manifest = manifest;

  // Build layers from the manifest
  BASE_LAYER_DEFS.forEach(def => {
    app.baseLayers[def.id] = createTileLayer(def.url, Object.assign({ keepBuffer: 2 }, def.options));
  });

  manifest.layers.forEach(def => {
    app.layerDefs[def.id] = def;
    const layer = createHistoricLayer(def);
    app.historicLayers[def.id] = layer;
  });

  // Restore state from the URL hash if present
  const hashState = parseHash();
  if (hashState && hashState.baseId) {
    app.currentBaseId = hashState.baseId === 'none' ? null
      : (app.baseLayers[hashState.baseId] ? hashState.baseId : app.currentBaseId);
  }

  app.map = L.map('map', {
    center: hashState ? hashState.center : manifest.defaultCenter,
    zoom: hashState ? hashState.zoom : manifest.defaultZoom,
    minZoom: 8,
    maxZoom: MAP_MAX_ZOOM,
    layers: app.currentBaseId ? [app.baseLayers[app.currentBaseId]] : [],
    attributionControl: false
  });

  manifest.layers.forEach(def => bindHistoricLayerState(app.historicLayers[def.id], def));

  L.control.attribution({ prefix: 'Leaflet' }).addTo(app.map);
  L.control.scale().addTo(app.map);
  createLayerControl().addTo(app.map);
  createOpacitySlider().addTo(app.map);
  createCoordReadout().addTo(app.map);
  createLocationControl().addTo(app.map);
  createShareControl().addTo(app.map);
  createTimeline(manifest);
  createSwipeDivider();
  setupGcpPicker();

  document.getElementById('layer-status-dismiss').addEventListener('click', () => {
    const state = app.historicLoadStates[app.currentLayerId];
    if (state) state.dismissed = true;
    updateActiveLayerStatus();
  });
  const layerStatusRetry = document.getElementById('layer-status-retry');
  if (layerStatusRetry) layerStatusRetry.addEventListener('click', retryActiveHistoricLayer);

  // Address search uses bounded Nominatim first, with Photon as a fallback for
  // transient failures or empty results. A hosted proxy/provider is preferred
  // if traffic grows beyond occasional interactive use.
  if (L.Control.geocoder) {
    L.Control.geocoder({
      position: 'topleft',
      defaultMarkGeocode: true,
      placeholder: 'Search address…',
      errorMessage: 'Address search is temporarily unavailable. Please try again or pan the map.',
      geocoder: createAddressGeocoder()
    }).addTo(app.map);
  }
  groupMapToolControls();

  // Opacity slider wiring
  const slider = document.getElementById('opacity-slider');
  if (slider) {
    slider.addEventListener('input', e => {
      app.opacity = e.target.value / 100;
      const valueDisplay = document.getElementById('opacity-value');
      if (valueDisplay) valueDisplay.textContent = `${e.target.value}%`;
      const layer = currentHistoricLayer();
      if (layer && app.mode === 'blend') layer.setOpacity(app.opacity);
    });
  }

  // Brightness / contrast sliders (CSS filter on the active historic layer)
  const bSlider = document.getElementById('brightness-slider');
  const bValue = document.getElementById('brightness-value');
  if (bSlider) bSlider.addEventListener('input', e => {
    app.brightness = e.target.value / 100;
    if (bValue) bValue.textContent = `${e.target.value}%`;
    applyImageAdjust();
  });
  const cSlider = document.getElementById('contrast-slider');
  const cValue = document.getElementById('contrast-value');
  if (cSlider) cSlider.addEventListener('input', e => {
    app.contrast = e.target.value / 100;
    if (cValue) cValue.textContent = `${e.target.value}%`;
    applyImageAdjust();
  });
  const bcReset = document.getElementById('bc-reset');
  if (bcReset) bcReset.addEventListener('click', () => {
    app.brightness = 1; app.contrast = 1;
    if (bSlider) bSlider.value = 100;
    if (cSlider) cSlider.value = 100;
    if (bValue) bValue.textContent = '100%';
    if (cValue) cValue.textContent = '100%';
    applyImageAdjust();
  });

  app.map.on('moveend zoomend', updateHash);
  app.map.on('moveend zoomend', updateActiveLayerStatus);

  updateAttribution();

  // Apply layer from hash (after controls exist so the timeline highlights)
  if (hashState && hashState.layerId && app.historicLayers[hashState.layerId]) {
    selectHistoricLayer(hashState.layerId);
  } else if (!hashState) {
    updateHash();
  }

  if (hashState && hashState.quadrantLayerIds) {
    app.quadrantLayerIds = hashState.quadrantLayerIds;
    app.mode = 'quadrants';
    const quadrantRadio = document.querySelector('input[name="view-mode"][value="quadrants"]');
    if (quadrantRadio) quadrantRadio.checked = true;
    applyMode();
  }

  // Expose for debugging
  window._app = app;
}

// Splash screen
const splashScreen = document.getElementById('splash-screen');
const continueBtn = document.getElementById('continue-btn');
if (splashScreen && continueBtn) {
  const backgroundRegions = [
    document.getElementById('site-header'),
    document.getElementById('map')
  ].filter(Boolean);

  backgroundRegions.forEach(region => { region.inert = true; });

  function dismissSplash() {
    splashScreen.classList.add('hidden');
    splashScreen.setAttribute('aria-hidden', 'true');
    backgroundRegions.forEach(region => { region.inert = false; });
    if (app.map) app.map.getContainer().focus();
  }

  continueBtn.addEventListener('click', dismissSplash);
  splashScreen.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      event.preventDefault();
      dismissSplash();
    } else if (event.key === 'Tab') {
      event.preventDefault();
      continueBtn.focus();
    }
  });
  requestAnimationFrame(() => continueBtn.focus());
}

init().catch(err => console.error('Initialization failed:', err));
