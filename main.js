// main.js - Cairns Historic Aerial Imagery
// Layers are defined in layers.json - the site builds itself from that manifest.
// Features: year timeline, swipe compare, opacity blend, shareable URL hash,
// address search, coverage outlines.

// A proper 1×1 transparent GIF. Unlike a 1×1 PNG, browsers scale GIFs without
// colour fringing, so tiles outside coverage render as fully invisible.
const TRANSPARENT_TILE =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

const MAP_MAX_ZOOM = 21;

// ---------------------------------------------------------------------------
// Tile loading indicator
// ---------------------------------------------------------------------------
const tileLoadState = { loading: 0, loaded: 0, errors: 0 };

function showLoadingIndicator() {
  const indicator = document.getElementById('loading-indicator');
  if (indicator) indicator.classList.add('active');
}

function hideLoadingIndicator() {
  const indicator = document.getElementById('loading-indicator');
  if (indicator && tileLoadState.loading === 0) indicator.classList.remove('active');
}

function updateLoadingCounter() {
  const counter = document.getElementById('tile-counter');
  if (counter) {
    counter.textContent = tileLoadState.loading > 0
      ? `Loading ${tileLoadState.loading} tiles...`
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

  layer.on('loading', () => {
    tileLoadState.loading++;
    showLoadingIndicator();
    updateLoadingCounter();
  });

  layer.on('load', () => {
    tileLoadState.loading = Math.max(0, tileLoadState.loading - 1);
    tileLoadState.loaded++;
    updateLoadingCounter();
    hideLoadingIndicator();
  });

  // Tiles outside the photo footprint 404 forever - never retry them.
  layer.on('tileerror', () => {
    tileLoadState.loading = Math.max(0, tileLoadState.loading - 1);
    tileLoadState.errors++;
    updateLoadingCounter();
    hideLoadingIndicator();
  });

  return layer;
}

// ---------------------------------------------------------------------------
// Base layers
// ---------------------------------------------------------------------------
const BASE_LAYER_DEFS = [
  {
    id: 'esri',
    name: 'Esri Imagery',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    options: { maxZoom: MAP_MAX_ZOOM, attribution: 'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics' }
  },
  {
    id: 'osm',
    name: 'OpenStreetMap',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    options: { maxZoom: 19, maxNativeZoom: 19, attribution: '&copy; OpenStreetMap contributors' }
  }
];

// ---------------------------------------------------------------------------
// URL hash  (#zoom/lat/lng/layerId/baseId)
// ---------------------------------------------------------------------------
function parseHash() {
  const parts = window.location.hash.replace(/^#\/?/, '').split('/');
  if (parts.length < 3) return null;
  const zoom = parseFloat(parts[0]);
  const lat = parseFloat(parts[1]);
  const lng = parseFloat(parts[2]);
  if ([zoom, lat, lng].some(Number.isNaN)) return null;
  return {
    zoom,
    center: [lat, lng],
    layerId: parts[3] && parts[3] !== 'none' ? parts[3] : null,
    baseId: parts[4] || null
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
  layerDefs: {},           // id -> manifest entry
  currentBaseId: 'esri',
  currentLayerId: null,
  mode: 'overlay',         // 'overlay' | 'blend' | 'compare'
  opacity: 0.7,
  showFootprint: false,
  footprintRect: null,
  swipe: { position: 0.5, divider: null, dragging: false },
  gcpPicker: false,        // click-to-copy coordinate picker (for GCP collection)
  gcpMarker: null,
  brightness: 1,           // CSS filter on the active historic layer
  contrast: 1
};

function currentHistoricLayer() {
  return app.currentLayerId ? app.historicLayers[app.currentLayerId] : null;
}

// Apply brightness/contrast as a CSS filter on the active historic layer's tile
// container. Purely client-side (no re-tiling); lets the user rescue washed-out or
// low-contrast areas per-view.
function applyImageAdjust() {
  const layer = currentHistoricLayer();
  if (!layer) return;
  const c = layer.getContainer();
  if (c) c.style.filter = `brightness(${app.brightness}) contrast(${app.contrast})`;
}

function updateHash() {
  if (!app.map) return;
  const c = app.map.getCenter();
  const z = app.map.getZoom();
  const hash = `#${z}/${c.lat.toFixed(5)}/${c.lng.toFixed(5)}/${app.currentLayerId || 'none'}/${app.currentBaseId || 'none'}`;
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
  divider.innerHTML = '<div class="swipe-handle" title="Drag to compare">&#x2194;</div>';
  mapEl.appendChild(divider);
  app.swipe.divider = divider;

  const handle = divider.querySelector('.swipe-handle');

  function onMove(e) {
    if (!app.swipe.dragging) return;
    const rect = mapEl.getBoundingClientRect();
    const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
    app.swipe.position = Math.min(0.97, Math.max(0.03, x / rect.width));
    updateSwipe();
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

  handle.addEventListener('mousedown', onDown);
  handle.addEventListener('touchstart', onDown, { passive: false });
  document.addEventListener('mousemove', onMove);
  document.addEventListener('touchmove', onMove, { passive: false });
  document.addEventListener('mouseup', onUp);
  document.addEventListener('touchend', onUp);

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
  const container = layer.getContainer();
  if (!container) return;
  if (!active) {
    container.style.clip = '';
    return;
  }
  const nw = app.map.containerPointToLayerPoint([0, 0]);
  const se = app.map.containerPointToLayerPoint(app.map.getSize());
  const clipX = nw.x + (se.x - nw.x) * app.swipe.position;
  container.style.clip = `rect(${nw.y}px, ${clipX}px, ${se.y}px, ${nw.x}px)`;
}

// ---------------------------------------------------------------------------
// Layer / mode switching
// ---------------------------------------------------------------------------
function applyMode() {
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
    sliderContainer.style.display = layer ? 'block' : 'none';
    const opRow = document.getElementById('opacity-slider');
    const opLbl = sliderContainer.querySelector('.opacity-label');
    const opVal = document.getElementById('opacity-value');
    const showOp = app.mode === 'blend' ? '' : 'none';
    if (opRow) opRow.style.display = showOp;
    if (opLbl) opLbl.style.display = showOp;
    if (opVal) opVal.style.display = showOp;
  }
  updateSwipe();
}

function updateFootprint() {
  if (app.footprintRect) {
    app.map.removeLayer(app.footprintRect);
    app.footprintRect = null;
  }
  const def = app.currentLayerId ? app.layerDefs[app.currentLayerId] : null;
  if (def && app.showFootprint) {
    app.footprintRect = L.rectangle(def.bounds, {
      color: '#06b6d4', weight: 2, dashArray: '6 6', fill: false, interactive: false
    }).addTo(app.map);
  }
}

function selectHistoricLayer(layerId) {
  const previous = currentHistoricLayer();
  if (previous) {
    const container = previous.getContainer();
    if (container) container.style.clip = '';
    app.map.removeLayer(previous);
  }

  app.currentLayerId = layerId && app.historicLayers[layerId] ? layerId : null;
  const layer = currentHistoricLayer();

  if (layer) {
    layer.addTo(app.map);
    layer.bringToFront();
    // Jump to the layer only if it's nowhere in the current view
    const def = app.layerDefs[app.currentLayerId];
    const layerBounds = L.latLngBounds(def.bounds);
    if (!app.map.getBounds().intersects(layerBounds)) {
      app.map.fitBounds(layerBounds);
    }
  }

  // Update timeline UI
  document.querySelectorAll('.timeline-chip').forEach(chip => {
    chip.classList.toggle('active', (chip.dataset.id || null) === app.currentLayerId);
  });
  const label = document.getElementById('timeline-label');
  if (label) {
    label.textContent = layer ? app.layerDefs[app.currentLayerId].name : 'Modern imagery';
  }

  updateFootprint();
  applyMode();
  applyImageAdjust();   // re-apply brightness/contrast to the newly-active layer
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
  const chipLabel = def => yearCounts[def.year] > 1 ? def.name : String(def.year);

  wrap.innerHTML = `
    <div class="timeline-label" id="timeline-label">Modern imagery</div>
    <div class="timeline-track">
      ${sorted.map(def => `
        <button class="timeline-chip" data-id="${def.id}" title="${def.name}">${chipLabel(def)}</button>
      `).join('')}
      <button class="timeline-chip" data-id="" title="Hide historic imagery">Today</button>
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
        </div>

        <div class="layer-group">
          <label class="layer-option">
            <input type="checkbox" id="footprint-toggle">
            <span>Show coverage outline</span>
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
      });
    });

    div.querySelector('#footprint-toggle').addEventListener('change', e => {
      app.showFootprint = e.target.checked;
      updateFootprint();
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
  const control = L.control({ position: 'bottomleft' });

  control.onAdd = function () {
    const div = L.DomUtil.create('div', 'opacity-slider-container');
    div.innerHTML = `
      <div class="opacity-label">Historic Overlay Opacity</div>
      <input type="range" id="opacity-slider" min="0" max="100" value="${Math.round(app.opacity * 100)}" class="opacity-slider">
      <div class="opacity-value" id="opacity-value">${Math.round(app.opacity * 100)}%</div>
      <div class="opacity-label" style="margin-top:8px">Brightness</div>
      <input type="range" id="brightness-slider" min="50" max="150" value="${Math.round(app.brightness * 100)}" class="opacity-slider">
      <div class="opacity-label" style="margin-top:6px">Contrast</div>
      <input type="range" id="contrast-slider" min="50" max="200" value="${Math.round(app.contrast * 100)}" class="opacity-slider">
      <div style="text-align:center;margin-top:4px"><button id="bc-reset" style="font:11px system-ui;padding:3px 10px;border:1px solid #99a;border-radius:5px;background:#f6f7ff;cursor:pointer">Reset B/C</button></div>
    `;
    div.style.display = 'none';
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
  app.manifest = manifest;

  // Build layers from the manifest
  BASE_LAYER_DEFS.forEach(def => {
    app.baseLayers[def.id] = createTileLayer(def.url, Object.assign({ keepBuffer: 2 }, def.options));
  });

  manifest.layers.forEach(def => {
    app.layerDefs[def.id] = def;
    app.historicLayers[def.id] = createTileLayer(def.url, {
      attribution: def.attribution,
      minZoom: def.minZoom != null ? def.minZoom : 10,
      maxNativeZoom: def.maxNativeZoom,
      maxZoom: MAP_MAX_ZOOM,
      bounds: L.latLngBounds(def.bounds),
      tms: def.scheme === 'tms'
    });
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

  L.control.attribution({ prefix: 'Leaflet' }).addTo(app.map);
  L.control.scale().addTo(app.map);
  createLayerControl().addTo(app.map);
  createOpacitySlider().addTo(app.map);
  createCoordReadout().addTo(app.map);
  createTimeline(manifest);
  createSwipeDivider();
  setupGcpPicker();

  // Address search (Nominatim), biased towards the map area
  if (L.Control.geocoder) {
    L.Control.geocoder({
      position: 'topleft',
      defaultMarkGeocode: true,
      placeholder: 'Search address…',
      geocoder: L.Control.Geocoder.nominatim({
        geocodingQueryParams: { countrycodes: 'au', viewbox: '145.4,-17.1,146.1,-16.7' }
      })
    }).addTo(app.map);
  }

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
  if (bSlider) bSlider.addEventListener('input', e => { app.brightness = e.target.value / 100; applyImageAdjust(); });
  const cSlider = document.getElementById('contrast-slider');
  if (cSlider) cSlider.addEventListener('input', e => { app.contrast = e.target.value / 100; applyImageAdjust(); });
  const bcReset = document.getElementById('bc-reset');
  if (bcReset) bcReset.addEventListener('click', () => {
    app.brightness = 1; app.contrast = 1;
    if (bSlider) bSlider.value = 100;
    if (cSlider) cSlider.value = 100;
    applyImageAdjust();
  });

  app.map.on('moveend zoomend', updateHash);

  updateAttribution();

  // Apply layer from hash (after controls exist so the timeline highlights)
  if (hashState && hashState.layerId && app.historicLayers[hashState.layerId]) {
    selectHistoricLayer(hashState.layerId);
  } else if (!hashState) {
    updateHash();
  }

  // Expose for debugging
  window._app = app;
}

// Splash screen
const splashScreen = document.getElementById('splash-screen');
const continueBtn = document.getElementById('continue-btn');
if (splashScreen && continueBtn) {
  continueBtn.addEventListener('click', () => splashScreen.classList.add('hidden'));
}

init().catch(err => console.error('Initialization failed:', err));
