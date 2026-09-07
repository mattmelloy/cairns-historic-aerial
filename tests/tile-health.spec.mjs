import { test, expect } from '@playwright/test';

const pixel = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
const hash = '#16/-16.92030/145.77100/cairns1977/esri';
async function open(page, suffix = hash) {
  await page.goto(`/index.html${suffix}`);
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
}
async function serve(route, status = 200) {
  await route.fulfill({ status, contentType: status === 200 ? 'image/gif' : 'text/plain',
    headers: { 'access-control-allow-origin': '*' }, body: status === 200 ? pixel : 'Unavailable' });
}
async function settled(page) {
  await expect.poll(() => page.evaluate(() => window._app.historicLoadStates.cairns1977.settled)).toBe(true);
}

test('expected partial coverage stays quiet, including after a pan with cached good tiles', async ({ page }) => {
  let gaps = false;
  await page.route('https://filedn.com/**', route => serve(route, gaps ? 404 : 200));
  await open(page);
  await settled(page);
  gaps = true;
  await page.evaluate(() => window._app.map.panBy([256, 0], { animate: false }));
  await expect.poll(() => page.evaluate(() => window._app.historicLoadStates.cairns1977.errors)).toBeGreaterThan(0);
  await settled(page);
  expect(await page.evaluate(() => window._app.historicLoadStates.cairns1977.loaded)).toBeGreaterThan(0);
  await expect(page.locator('#layer-status')).toBeHidden();
});

test('all absent tiles give a neutral compact coverage notice without retry', async ({ page }) => {
  await page.route('https://filedn.com/**', route => serve(route, 404));
  await open(page);
  await settled(page);
  await expect(page.locator('#layer-status-title')).toHaveText('No imagery here');
  await expect(page.locator('#layer-status-retry')).toBeHidden();
  expect(await page.evaluate(() => window._app.historicLoadStates.cairns1977.loaded)).toBe(0);
  expect((await page.locator('#layer-status').boundingBox()).height).toBeLessThanOrEqual(50);
  await page.getByRole('button', { name: 'Dismiss imagery notice' }).click();
  await expect(page.locator('#layer-status')).toBeHidden();
});

test('confirmed partial server failure offers retry and clears on recovery', async ({ page }) => {
  let failing = true;
  await page.route('https://filedn.com/**', route => {
    const x = Number(new URL(route.request().url()).pathname.split('/').at(-2));
    return serve(route, failing && x % 2 === 0 ? 503 : 200);
  });
  await open(page);
  await expect(page.locator('#layer-status-title')).toHaveText('Imagery loading issue');
  expect(await page.evaluate(() => window._app.historicLoadStates.cairns1977.loaded)).toBeGreaterThan(0);
  failing = false;
  await page.getByRole('button', { name: 'Retry loading Cairns 1977' }).click();
  await settled(page);
  await expect(page.locator('#layer-status')).toBeHidden();
});

test('CORS-hidden edge responses do not claim a partial outage', async ({ page }) => {
  await page.route('https://filedn.com/**', route => {
    const x = Number(new URL(route.request().url()).pathname.split('/').at(-2));
    return x % 2 === 0 ? route.abort() : serve(route);
  });
  await open(page);
  await settled(page);
  await expect(page.locator('#layer-status')).toBeHidden();
});

test('quadrant notice leaves centre clear and supports touch-sized retry and dismissal', async ({ page }) => {
  let failing = true;
  await page.route('https://filedn.com/**', route => serve(route, failing ? 503 : 200));
  await open(page, hash + '/quadrants/cairns1952,cairns65,cairns1977,base:esri');
  const notices = page.locator('.quadrant-availability-notice:visible');
  await expect(notices).toHaveCount(3);
  const pane = page.locator('.quadrant-pane').first();
  const notice = pane.locator('.quadrant-availability-notice');
  const rect = await notice.boundingBox();
  const mapRect = await pane.boundingBox();
  expect(rect.height).toBeLessThanOrEqual(50);
  expect(rect.y + rect.height).toBeLessThan(mapRect.y + mapRect.height / 2);
  expect(rect.x + rect.width).toBeLessThanOrEqual(mapRect.x + mapRect.width);
  const retry = notice.locator('[data-tile-retry]');
  expect((await retry.boundingBox()).width).toBeGreaterThanOrEqual(44);
  await notice.getByRole('button', { name: 'Dismiss imagery notice' }).click();
  await expect(notice).toBeHidden();
  failing = false;
  await notices.first().locator('[data-tile-retry]').click();
  await expect(notices).toHaveCount(1);
  await expect(page.locator('#layer-status')).toBeHidden();
});

test('late diagnostics cannot resurrect a warning after switching layer', async ({ page }) => {
  await page.route('https://filedn.com/**', async route => {
    if (route.request().method() === 'HEAD') await new Promise(resolve => setTimeout(resolve, 500));
    await serve(route, 503);
  });
  await open(page);
  await expect.poll(() => page.evaluate(() => window._app.historicLoadStates.cairns1977.errors)).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Today', exact: true }).evaluate(button => button.click());
  await page.waitForTimeout(900);
  await expect(page.locator('#layer-status')).toBeHidden();
});

test('single-map status hides on entering quadrants and returns on exit', async ({ page }) => {
  await page.route('https://filedn.com/**', route => serve(route, 503));
  await open(page);
  await expect(page.locator('#layer-status')).toBeVisible();
  const panel = page.locator('.custom-layer-control');
  if (await panel.evaluate(el => el.classList.contains('collapsed'))) await page.locator('#layer-control-toggle').click();
  await page.getByText('Four-panel comparison', { exact: true }).click();
  await expect(page.locator('#layer-status')).toBeHidden();
  await page.getByRole('button', { name: 'Return to single-map view' }).click();
  await expect(page.locator('#layer-status')).toBeVisible();
});
