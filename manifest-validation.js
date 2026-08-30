// Validate the public layer manifest before Leaflet starts creating layers.
// Keeping this separate makes it easy to run the same guard in CI and in the
// browser without introducing a build step.
(function () {
  function isFiniteNumber(value) {
    return typeof value === 'number' && Number.isFinite(value);
  }

  function validateMapManifest(manifest) {
    const errors = [];
    if (!manifest || !Array.isArray(manifest.layers)) {
      return { valid: false, errors: ['layers must be an array'] };
    }

    if (!Array.isArray(manifest.defaultCenter) || manifest.defaultCenter.length !== 2 ||
        !manifest.defaultCenter.every(isFiniteNumber) ||
        manifest.defaultCenter[0] < -90 || manifest.defaultCenter[0] > 90 ||
        manifest.defaultCenter[1] < -180 || manifest.defaultCenter[1] > 180) {
      errors.push('defaultCenter must contain two finite numbers');
    }
    if (!Number.isInteger(manifest.defaultZoom) || manifest.defaultZoom < 8 || manifest.defaultZoom > 21) {
      errors.push('defaultZoom must be an integer between 8 and 21');
    }

    const ids = new Set();
    manifest.layers.forEach((layer, index) => {
      const label = `layers[${index}]`;
      if (!layer || typeof layer !== 'object') {
        errors.push(`${label} must be an object`);
        return;
      }
      if (!layer.id || typeof layer.id !== 'string') errors.push(`${label}.id is required`);
      if (ids.has(layer.id)) errors.push(`${label}.id duplicates "${layer.id}"`);
      ids.add(layer.id);
      if (!layer.name || typeof layer.name !== 'string') errors.push(`${label}.name is required`);
      if (!Number.isInteger(layer.year)) errors.push(`${label}.year must be an integer`);
      if (!['xyz', 'tms'].includes(layer.scheme)) errors.push(`${label}.scheme must be xyz or tms`);

      const urls = Array.isArray(layer.tileUrls) && layer.tileUrls.length
        ? layer.tileUrls
        : [layer.url];
      if (!urls.length || urls.some(url => typeof url !== 'string' || !/^https?:\/\//i.test(url) ||
          !url.includes('{z}') || !url.includes('{x}') || !url.includes('{y}'))) {
        errors.push(`${label} must use public http(s) tile URL templates with {z}, {x}, and {y}`);
      }

      if (!Array.isArray(layer.bounds) || layer.bounds.length !== 2 ||
          layer.bounds.some(point => !Array.isArray(point) || point.length !== 2 ||
            point.some(value => !isFiniteNumber(value)))) {
        errors.push(`${label}.bounds must be [[south, west], [north, east]]`);
      } else {
        const [[south, west], [north, east]] = layer.bounds;
        if (south >= north || west >= east || south < -90 || north > 90 || west < -180 || east > 180) {
          errors.push(`${label}.bounds must be ordered geographic coordinates`);
        }
      }

      const minZoom = layer.minZoom == null ? 0 : layer.minZoom;
      const maxNativeZoom = layer.maxNativeZoom == null ? layer.maxZoom : layer.maxNativeZoom;
      const maxZoom = layer.maxZoom == null ? 21 : layer.maxZoom;
      if (![minZoom, maxNativeZoom, maxZoom].every(Number.isInteger) ||
          minZoom < 0 || minZoom > maxNativeZoom || maxNativeZoom > maxZoom || maxZoom > 21) {
        errors.push(`${label} zoom limits must satisfy 0 <= minZoom <= maxNativeZoom <= maxZoom <= 21`);
      }
      if (layer.referenceOverlayUrl != null && typeof layer.referenceOverlayUrl !== 'string') {
        errors.push(`${label}.referenceOverlayUrl must be a string when provided`);
      }
    });

    return { valid: errors.length === 0, errors };
  }

  window.validateMapManifest = validateMapManifest;
})();
