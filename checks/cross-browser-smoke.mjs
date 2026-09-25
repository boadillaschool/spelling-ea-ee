import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const playwright = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const engine = process.env.BROWSER_ENGINE ?? 'chromium';
assert.ok(['chromium', 'firefox', 'webkit'].includes(engine), `Unsupported BROWSER_ENGINE: ${engine}`);
const browserType = playwright[engine];
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const words = ['easy', 'meat', 'peanuts', 'between', 'read', 'jeans', 'heel', 'sweets', 'street', 'reach'];
const allowed = new Set([
  'index.html', 'styles.css', 'app.js', 'data.js', 'lessons.js', 'illustrations.js', 'logic.js', 'speech.js',
  'spelling-timings.js', 'ink-pad.js', 'ui-helpers.js', 'focus-policy.js', 'robots.txt',
  ...words.map((id) => `audio/en-gb-v1/${id}.mp3`),
  ...words.map((id) => `audio/spelling-en-gb-v1/${id}.mp3`),
  ...words.map((id) => `images/words/${id}.svg`),
]);

const server = http.createServer(async (request, response) => {
  try {
    const pathname = new URL(request.url, 'http://localhost').pathname;
    const prefix = '/spelling-ea-ee/';
    if (!pathname.startsWith(prefix)) throw new Error('outside project path');
    const file = pathname.slice(prefix.length) || 'index.html';
    if (request.method !== 'GET' || !allowed.has(file)) {
      response.writeHead(404).end();
      return;
    }
    const types = { '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.txt': 'text/plain' };
    const body = await fs.readFile(path.join(root, file));
    response.writeHead(200, { 'Content-Type': types[path.extname(file)] ?? 'text/html' }).end(body);
  } catch {
    response.writeHead(404).end();
  }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}/spelling-ea-ee/?list=2026-09-25`;
const browser = await browserType.launch({
  headless: true,
  ...(engine === 'chromium' && process.env.BROWSER_PATH ? { executablePath: process.env.BROWSER_PATH } : {}),
});

try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const pageErrors = [];
  const externalOrigins = new Set();
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.origin !== new URL(base).origin) externalOrigins.add(url.origin);
  });

  await page.goto(base, { waitUntil: 'domcontentloaded' });
  assert.equal(await page.getByRole('checkbox').count(), 10);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1), true);
  const fullscreenState = await page.locator('#fullscreen-toggle').evaluate((button) => ({ hidden: button.hidden, pressed: button.getAttribute('aria-pressed') }));
  assert.equal(fullscreenState.pressed, 'false');

  await page.locator('input[name="input-method"][value="pencil"]').check();
  await page.getByRole('button', { name: 'Quitar todas', exact: true }).click();
  await page.getByRole('checkbox', { name: 'easy', exact: true }).check();
  await page.getByRole('button', { name: 'Practicar 1 palabra', exact: true }).click();
  assert.equal(await page.locator('[data-spelling]').count(), 0, 'practice must not reveal spelling before retrieval');
  const answer = page.locator('#answer');
  assert.equal(await page.locator('#answer-form').getAttribute('data-input-method'), 'pencil');
  assert.equal(await answer.getAttribute('autocomplete'), 'off');
  assert.equal(await answer.getAttribute('spellcheck'), 'false');
  await answer.fill('easy');
  await page.getByRole('button', { name: 'Comprobar', exact: true }).click();
  assert.equal(await page.locator('[data-spelling="easy"]').count(), 1, 'post-answer spelling must be visible');
  assert.equal(await page.evaluate(() => JSON.stringify(localStorage).includes('"answer"')), false);
  await page.getByRole('button', { name: 'Ver resumen', exact: true }).click();

  await page.locator('#back').click();
  await page.locator('.mode-row').filter({ hasText: /^Cuaderno con lápiz/ }).click();
  const canvas = page.locator('[data-ink-pad]');
  await canvas.scrollIntoViewIfNeeded();
  const box = await canvas.boundingBox();
  await page.mouse.move(box.x + 40, box.y + 45);
  await page.mouse.down();
  await page.mouse.move(box.x + 130, box.y + 95, { steps: 5 });
  await page.mouse.up();
  assert.equal(await page.getByRole('button', { name: 'Deshacer', exact: true }).isEnabled(), true);
  assert.equal(await page.getByRole('button', { name: 'Comparar', exact: true }).isEnabled(), true);
  await page.getByRole('button', { name: 'Comparar', exact: true }).click();
  assert.equal(await page.getByRole('button', { name: 'La he escrito bien', exact: true }).count(), 1);

  const visibleControls = await page.locator('button:visible').evaluateAll((buttons) => buttons.map((button) => {
    const rect = button.getBoundingClientRect();
    return { label: button.textContent.trim(), width: rect.width, height: rect.height };
  }));
  assert.deepEqual(visibleControls.filter(({ width, height }) => width < 48 || height < 48), [], 'visible buttons must keep 48px touch targets');
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1), true);
  assert.deepEqual([...externalOrigins], [], `unexpected external requests: ${JSON.stringify([...externalOrigins])}`);
  assert.deepEqual(pageErrors, [], `page errors: ${JSON.stringify(pageErrors)}`);
  await context.close();
  console.log(`PASS ${engine} project-path practice, pencil input, spelling, notebook, privacy and responsive smoke`);
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
