// Shared application configuration. Keep this as a plain script so the map
// still works when index.html is opened directly from file://.
window.APP_CONFIG = Object.freeze({
  MAP_MAX_ZOOM: 21,
  TRANSPARENT_TILE:
    'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  QUADRANT_BASE_PREFIX: 'base:',
  DEFAULT_QUADRANT_LAYER_IDS: [
    'cairns1952',
    'cairns65',
    'cairns1977',
    'base:esri'
  ],
  BASE_LAYER_DEFS: [
    {
      id: 'esri',
      name: 'Esri Imagery',
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      options: {
        maxZoom: 21,
        attribution: 'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics'
      }
    },
    {
      id: 'osm',
      name: 'OpenStreetMap',
      url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      options: {
        maxZoom: 21,
        maxNativeZoom: 19,
        attribution: '&copy; OpenStreetMap contributors'
      }
    }
  ],
  GEOCODER: {
    countrycodes: 'au',
    viewbox: '145.4,-17.1,146.1,-16.7',
    bounded: 1,
    limit: 5
  },
  PHOTON: {
    serviceUrl: 'https://photon.komoot.io/api/'
  }
});
