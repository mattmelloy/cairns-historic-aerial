// Leaflet's errorTileUrl emits a later tileload for the transparent fallback.
// Keep the original outcome, and assess visible tiles rather than request batches.
(() => {
  const outcomes = new WeakMap();
  const probes = new Map();
  function inspect(url) {
    const cached = probes.get(url);
    if (cached && Date.now() - cached.time < 30000) return cached.result;
    const result = (async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);
      try {
        const response = await fetch(url, { method: 'HEAD', signal: controller.signal });
        if (response.status === 404 || response.status === 410) return 'absent';
        if (response.status === 403 || response.status === 429 || response.status >= 500) return 'failed';
        // A successful HEAD does not prove that the image can be decoded.
        return 'unknown';
      } catch {
        // CORS can hide HTTP status, including perfectly normal coverage 404s.
        return 'unknown';
      } finally {
        clearTimeout(timeout);
      }
    })();
    if (probes.size >= 128) probes.delete(probes.keys().next().value);
    probes.set(url, { time: Date.now(), result });
    return result;
  }

  window.monitorHistoricTiles = (layer, map, sources, onChange) => {
    const state = { loaded: 0, errors: 0, requested: 0, settled: false, kind: null, dismissed: false };
    let revision = 0;
    let timer;
    function schedule() {
      revision++;
      clearTimeout(timer);
      state.kind = null;
      state.settled = false;
      onChange();
      if (map.hasLayer(layer)) timer = setTimeout(assess, 350);
    }
    async function assess() {
      const version = revision;
      if (!map.hasLayer(layer)) return;
      const viewport = map.getBounds();
      const visible = sources.flatMap(source => Object.values(source._tiles || {}).filter(tile => {
        // _tiles/coords are from the vendored Leaflet GridLayer. Use native zoom
        // coordinates so overzoom and retained tiles are evaluated correctly.
        const { x, y, z } = tile.coords;
        if (z !== source._tileZoom) return false;
        const size = source.getTileSize();
        const bounds = L.latLngBounds(
          map.unproject(L.point(x * size.x, y * size.y), z),
          map.unproject(L.point((x + 1) * size.x, (y + 1) * size.y), z)
        );
        return viewport.overlaps(bounds);
      }).map(tile => outcomes.get(tile.el)));
      state.loaded = visible.filter(item => item?.status === 'loaded').length;
      const errors = visible.filter(item => item?.status === 'error');
      state.errors = errors.length;
      state.requested = visible.length;
      if (visible.some(item => !item || item.status === 'loading')) return;
      // Sample at most three failed URLs. Never issue a request per missing tile.
      const results = await Promise.all([...new Set(errors.map(item => item.url))].slice(0, 3).map(inspect));
      if (version !== revision || !map.hasLayer(layer)) return;
      state.settled = true;
      state.kind = results.includes('failed') ? 'failed'
        : errors.length && !state.loaded
          ? (results.every(result => result === 'absent') ? 'coverage' : 'unknown')
          : null;
      onChange();
    }
    sources.forEach(source => {
      source.on('tileloadstart', event => {
        outcomes.set(event.tile, { status: 'loading', url: source.getTileUrl(event.coords) });
        schedule();
      });
      source.on('tileerror', event => {
        outcomes.set(event.tile, { status: 'error', url: source.getTileUrl(event.coords) });
        schedule();
      });
      source.on('tileload', event => {
        if (outcomes.get(event.tile)?.status !== 'error') outcomes.set(event.tile, { status: 'loaded' });
        schedule();
      });
      source.on('load', schedule);
    });
    const attach = () => { map.on('movestart zoomstart moveend zoomend', schedule); schedule(); };
    layer.on('add', attach);
    layer.on('remove', () => {
      map.off('movestart zoomstart moveend zoomend', schedule);
      revision++;
      clearTimeout(timer);
      state.kind = null;
      onChange();
    });
    state.retry = () => {
      probes.clear();
      state.dismissed = false;
      sources.forEach(source => source.redraw());
      schedule();
    };
    if (map.hasLayer(layer)) attach();
    return state;
  };
})();
