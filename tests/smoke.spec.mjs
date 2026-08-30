import { test, expect } from '@playwright/test';

const INITIAL_HASH = '#13/-16.92030/145.77100/none/esri';

async function openMap(page, hash = INITIAL_HASH) {
  const issues = { pageErrors: [], consoleErrors: [], failedLocalRequests: [] };
  page.on('pageerror', error => issues.pageErrors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error' || message.type() === 'warning') {
      issues.consoleErrors.push(`${message.type()}: ${message.text()}`);
    }
  });
  page.on('requestfailed', request => {
    if (request.url().startsWith('http://127.0.0.1:4173/')) {
      issues.failedLocalRequests.push(`${request.method()} ${request.url()}: ${request.failure()?.errorText || 'failed'}`);
    }
  });
  await page.goto(`/index.html${hash}`);
  await page.getByRole('button', { name: 'Continue' }).click();
  return issues;
}

test('starts cleanly and exposes the historic imagery maps timeline', async ({ page }) => {
  const issues = await openMap(page);
  await expect(page.locator('#timeline-label')).toHaveText('Historic imagery maps');
  await expect(page.getByRole('toolbar', { name: 'Map tools' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Copy a link to this map view' })).toBeVisible();
  await expect(page.locator('.timeline-chip')).toHaveCount(11);
  await expect(page.getByRole('button', { name: '1978', exact: true })).toBeVisible();
  expect(issues).toEqual({ pageErrors: [], consoleErrors: [], failedLocalRequests: [] });
  expect(await page.evaluate(() => window.validateMapManifest(window.MAP_CONFIG).valid)).toBe(true);
  expect(await page.evaluate(() => window.MAP_CONFIG.layers.every(layer => {
    const urls = layer.tileUrls || [layer.url];
    return urls.every(url => /^https?:\/\//.test(url));
  }))).toBe(true);
  expect(await page.evaluate(() => {
    const layer = window.MAP_CONFIG.layers.find(item => item.id === 'cairns1978');
    return layer && {
      timelineLabel: layer.timelineLabel,
      maxNativeZoom: layer.maxNativeZoom,
      url: layer.url
    };
  })).toEqual({
    timelineLabel: '1978',
    maxNativeZoom: 20,
    url: 'https://tiles.melloy.bid/tiles/cairns1978_aws_native_affine_z20_q95/{z}/{x}/{y}.webp'
  });
});

test('keeps every left-side map tool in one consistent control rail', async ({ page }) => {
  await openMap(page);
  const panel = page.getByRole('toolbar', { name: 'Map tools' });
  await expect(panel.locator('[data-icon="location-arrow"]')).toBeVisible();
  await expect(panel.locator('[data-icon="share"]')).toBeVisible();

  await page.getByRole('button', { name: '1952' }).evaluate(button => button.click());
  await expect(panel.getByRole('button', { name: 'Open image enhancement controls' })).toBeVisible();

  const controls = [
    panel.locator('.leaflet-control-zoom-in'),
    panel.locator('.leaflet-control-zoom-out'),
    panel.getByRole('button', { name: /Use your location/ }),
    panel.getByRole('button', { name: 'Copy a link to this map view' }),
    panel.getByRole('button', { name: 'Initiate a new search' }),
    panel.getByRole('button', { name: 'Open image enhancement controls' })
  ];
  const sizes = await Promise.all(controls.map(control => control.boundingBox()));
  sizes.forEach(size => {
    expect(size?.width).toBe(44);
    expect(size?.height).toBe(44);
  });
});

test('rejects an invalid shared hash and falls back to the default view', async ({ page }) => {
  await openMap(page, '#999/999/999/none/esri');
  await expect.poll(() => page.evaluate(() => window.location.hash.split('/')[0].replace(/^#\/?/, ''))).toBe('13');
  await expect(page.locator('#timeline-label')).toHaveText('Historic imagery maps');
});

test('fails closed when manifest validation does not load', async ({ page }) => {
  await page.route('**/manifest-validation.js', route => route.abort());
  await page.goto(`/index.html${INITIAL_HASH}`);
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.locator('.configuration-error')).toContainText('Map configuration needs attention');
});

test('four-panel mode defaults to 1952 / 1965 / 1977 / current Esri', async ({ page }) => {
  await openMap(page);
  const panelToggle = page.locator('#layer-control-toggle');
  const panel = page.locator('.custom-layer-control');
  if (await panel.evaluate(el => el.classList.contains('collapsed'))) await panelToggle.click();
  await page.getByText('Four-panel comparison', { exact: true }).click();
  await expect(page.locator('.quadrant-select')).toHaveCount(4);
  await expect(page.locator('.quadrant-select').nth(0)).toHaveValue('cairns1952');
  await expect(page.locator('.quadrant-select').nth(1)).toHaveValue('cairns65');
  await expect(page.locator('.quadrant-select').nth(2)).toHaveValue('cairns1977');
  await expect(page.locator('.quadrant-select').nth(3)).toHaveValue('base:esri');
  await expect(page.locator('.quadrant-location')).toBeVisible();
});

test('location control centres the map at zoom 18 with permission', async ({ browser }) => {
  const context = await browser.newContext({
    permissions: ['geolocation'],
    geolocation: { latitude: -16.9203, longitude: 145.771 }
  });
  const page = await context.newPage();
  await openMap(page);
  await page.getByRole('button', { name: /Use your location/ }).click();
  await expect.poll(() => page.evaluate(() => window.location.hash.split('/')[0].replace(/^#\/?/, ''))).toBe('18');
  await expect(page.locator('#location-status')).toContainText('Location found');
  await context.close();
});

test('explains a denied location permission', async ({ browser }) => {
  const context = await browser.newContext({ permissions: [] });
  const page = await context.newPage();
  await openMap(page);
  await page.getByRole('button', { name: 'Use your location to centre the map (not stored)' }).click();
  await expect(page.locator('#location-status')).toContainText('denied', { timeout: 5_000 });
  await context.close();
});

test('reports a failed historic tile batch and leaves the base map available', async ({ page }) => {
  await page.route('https://filedn.com/**', route => route.abort());
  await openMap(page);
  await page.getByRole('button', { name: '1952' }).evaluate(button => button.click());
  await expect(page.locator('#layer-status')).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('#layer-status-detail')).toContainText('historic tiles failed to load');
  await expect(page.getByRole('button', { name: /Retry loading Cairns 1952/ })).toBeVisible();
});

test('silently enlarges historic imagery above its native zoom level', async ({ page }) => {
  await page.route('https://filedn.com/**', route => route.abort());
  await openMap(page, '#21/-16.92030/145.77100/cairns1952/esri');

  await expect.poll(() => page.evaluate(() =>
    window._app.historicLoadStates.cairns1952.settled
  )).toBe(true);
  await expect(page.locator('#layer-status')).toBeHidden();
  expect(await page.evaluate(() => window._app.historicLayers.tinaroo1949.options.maxZoom)).toBe(21);
});

test('keeps overzoomed quadrant panes free of missing-tile warnings', async ({ page }) => {
  await page.route('https://filedn.com/**', route => route.abort());
  await openMap(
    page,
    '#21/-16.92030/145.77100/cairns1952/esri/quadrants/cairns1952,cairns65,cairns1977,base:esri'
  );

  await expect.poll(() => page.evaluate(() =>
    window._app.quadrants.panes.slice(0, 3).every(pane => pane.tileState.settled)
  )).toBe(true);
  await expect(page.locator('.quadrant-availability-notice:visible')).toHaveCount(0);
});

test('keeps mobile controls at touch-friendly sizes', async ({ page }) => {
  await openMap(page);
  test.skip((await page.evaluate(() => window.innerWidth)) > 600, 'mobile viewport only');
  const locationBox = await page.getByRole('button', { name: /Use your location/ }).boundingBox();
  const timelineBox = await page.locator('.timeline-chip').first().boundingBox();
  expect(locationBox?.width).toBeGreaterThanOrEqual(44);
  expect(locationBox?.height).toBeGreaterThanOrEqual(44);
  expect(timelineBox?.height).toBeGreaterThanOrEqual(44);
});
