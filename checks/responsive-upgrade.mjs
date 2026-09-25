import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = fileURLToPath(new URL('../', import.meta.url));
const words = ['easy', 'meat', 'peanuts', 'between', 'read', 'jeans', 'heel', 'sweets', 'street', 'reach'];
const allowed = new Set([
  'index.html', 'styles.css', 'app.js', 'data.js', 'lessons.js', 'illustrations.js', 'logic.js', 'speech.js',
  'spelling-timings.js', 'ink-pad.js', 'ui-helpers.js', 'focus-policy.js',
  ...words.map((id) => `audio/en-gb-v1/${id}.mp3`),
  ...words.map((id) => `audio/spelling-en-gb-v1/${id}.mp3`),
  ...words.map((id) => `images/words/${id}.svg`),
]);

const server = http.createServer(async (request, response) => {
  try {
    const file = new URL(request.url, 'http://localhost').pathname.slice(1) || 'index.html';
    if (request.method !== 'GET' || !allowed.has(file)) {
      response.writeHead(404); response.end(); return;
    }
    const body = await fs.readFile(path.join(root, file));
    const type = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.mp3': 'audio/mpeg', '.svg': 'image/svg+xml' }[path.extname(file)];
    response.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' });
    response.end(body);
  } catch {
    response.writeHead(404); response.end();
  }
});

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}/?list=2026-09-25`;
const axeSource = process.env.AXE_SOURCE ? await fs.readFile(process.env.AXE_SOURCE, 'utf8') : null;
const browser = await chromium.launch({
  headless: true,
  ...(process.env.BROWSER_PATH ? { executablePath: process.env.BROWSER_PATH } : {}),
});

const nextPaint = (page) => page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));

async function assertNoOverflow(page, label) {
  const widths = await page.evaluate(() => ({
    document: document.documentElement.scrollWidth,
    viewport: document.documentElement.clientWidth,
  }));
  assert.ok(widths.document <= widths.viewport + 1, `${label}: horizontal overflow ${JSON.stringify(widths)}`);
}

async function assertFormVisible(page, label) {
  const geometry = await page.evaluate(() => {
    const viewport = window.visualViewport;
    const form = document.querySelector('#answer-form').getBoundingClientRect();
    const submit = document.querySelector('#answer-form button[type="submit"]').getBoundingClientRect();
    const top = viewport?.offsetTop ?? 0;
    const bottom = top + (viewport?.height ?? window.innerHeight);
    return {
      top,
      bottom,
      form: { top: form.top, bottom: form.bottom },
      submit: { top: submit.top, bottom: submit.bottom },
    };
  });
  assert.ok(geometry.form.top >= geometry.top - 1, `${label}: form above viewport ${JSON.stringify(geometry)}`);
  assert.ok(geometry.form.bottom <= geometry.bottom + 1, `${label}: form below viewport ${JSON.stringify(geometry)}`);
  assert.ok(geometry.submit.bottom <= geometry.bottom + 1, `${label}: submit below viewport ${JSON.stringify(geometry)}`);
}

async function assertAccessible(page, label) {
  if (axeSource === null) return;
  await page.evaluate(`${axeSource};undefined;`);
  const violations = await page.evaluate(async () => (await axe.run(document, {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] },
  })).violations.map(({ id, nodes }) => ({ id, targets: nodes.map((node) => node.target) })));
  assert.deepEqual(violations, [], `${label}: accessibility violations ${JSON.stringify(violations)}`);
}

try {
  const externalOrigins = new Set();
  const consoleErrors = [];
  const context = await browser.newContext({ viewport: { width: 320, height: 720 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.origin !== new URL(base).origin) externalOrigins.add(url.origin);
  });
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => consoleErrors.push(error.message));
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await assertNoOverflow(page, '320px home');
  await assertAccessible(page, '320px home');
  assert.equal(await page.getByRole('checkbox').count(), 10);
  assert.equal(await page.getByRole('button', { name: 'Activar pantalla completa' }).count(), 1);

  const smallTargets = await page.locator('button:visible').evaluateAll((buttons) => buttons
    .map((button) => ({ name: button.getAttribute('aria-label') || button.textContent.trim(), height: button.getBoundingClientRect().height }))
    .filter(({ height }) => height < 47.5));
  assert.deepEqual(smallTargets, [], `touch targets below 48px: ${JSON.stringify(smallTargets)}`);

  await page.getByRole('button', { name: 'Quitar todas' }).click();
  await page.getByRole('checkbox', { name: 'easy', exact: true }).check();
  await page.getByRole('button', { name: 'Practicar 1 palabra', exact: true }).click();
  assert.equal(await page.locator('#answer-form button[type="submit"]').count(), 1, 'submit stays inside its form');
  assert.ok(Number.parseFloat(await page.locator('#answer').evaluate((node) => getComputedStyle(node).fontSize)) >= 16);
  await page.locator('#answer').focus();
  await nextPaint(page);
  await assertFormVisible(page, 'focused 320px form');

  await page.evaluate(() => {
    Object.defineProperty(window.visualViewport, 'height', { configurable: true, value: 390 });
    window.visualViewport.dispatchEvent(new Event('resize'));
    window.visualViewport.dispatchEvent(new Event('scroll'));
  });
  await nextPaint(page);
  assert.equal(await page.evaluate(() => document.body.classList.contains('keyboard-open')), true);
  await assertFormVisible(page, 'software-keyboard form');
  await assertNoOverflow(page, 'software-keyboard form');
  await assertAccessible(page, 'software-keyboard practice');
  assert.deepEqual([...externalOrigins], [], `unexpected external requests: ${JSON.stringify([...externalOrigins])}`);
  assert.deepEqual(consoleErrors, [], `console errors: ${JSON.stringify(consoleErrors)}`);
  await context.close();

  const tablet = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' });
  const tabletPage = await tablet.newPage();
  await tabletPage.goto(base, { waitUntil: 'domcontentloaded' });
  await tabletPage.getByRole('button', { name: /Cuaderno con lápiz/ }).click();
  const overlap = await tabletPage.evaluate(() => {
    const canvas = document.querySelector('[data-ink-pad]').getBoundingClientRect();
    const dock = document.querySelector('#dock').getBoundingClientRect();
    return Math.max(0, Math.min(canvas.right, dock.right) - Math.max(canvas.left, dock.left))
      * Math.max(0, Math.min(canvas.bottom, dock.bottom) - Math.max(canvas.top, dock.top));
  });
  assert.equal(overlap, 0, 'action dock must not cover the handwriting canvas');
  await assertNoOverflow(tabletPage, 'tablet notebook');
  await assertAccessible(tabletPage, 'tablet notebook');
  await tablet.close();

  const fullscreen = await browser.newContext({ viewport: { width: 800, height: 900 } });
  const fullscreenPage = await fullscreen.newPage();
  await fullscreenPage.goto(base, { waitUntil: 'domcontentloaded' });
  const fullscreenButton = fullscreenPage.getByRole('button', { name: 'Activar pantalla completa' });
  await fullscreenButton.click();
  await fullscreenPage.waitForFunction(() => document.fullscreenElement !== null);
  assert.equal(await fullscreenPage.getByRole('button', { name: 'Salir de pantalla completa' }).getAttribute('aria-pressed'), 'true');
  await fullscreenPage.getByRole('button', { name: 'Salir de pantalla completa' }).click();
  await fullscreenPage.waitForFunction(() => document.fullscreenElement === null);
  assert.equal(await fullscreenPage.getByRole('button', { name: 'Activar pantalla completa' }).getAttribute('aria-pressed'), 'false');
  await fullscreenPage.evaluate(() => {
    Object.defineProperty(document.documentElement, 'requestFullscreen', {
      configurable: true,
      value: async () => { throw new DOMException('Denied', 'NotAllowedError'); },
    });
  });
  await fullscreenPage.getByRole('button', { name: 'Activar pantalla completa' }).click();
  await fullscreenPage.waitForFunction(() => document.querySelector('#feedback').textContent.includes('no ha podido'));
  assert.equal(await fullscreenPage.evaluate(() => document.fullscreenElement), null);
  assert.equal(await fullscreenPage.locator('#main').isVisible(), true, 'fullscreen rejection must not break the lesson');
  await fullscreen.close();

  const unsupported = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await unsupported.addInitScript(() => {
    Object.defineProperty(Element.prototype, 'requestFullscreen', { configurable: true, value: undefined });
    Object.defineProperty(Element.prototype, 'webkitRequestFullscreen', { configurable: true, value: undefined });
  });
  const unsupportedPage = await unsupported.newPage();
  await unsupportedPage.goto(base, { waitUntil: 'domcontentloaded' });
  assert.equal(await unsupportedPage.locator('#fullscreen-toggle').isHidden(), true, 'fullscreen control hides without API support');
  await unsupported.close();

  const zoomed = await browser.newContext({ viewport: { width: 320, height: 720 }, reducedMotion: 'reduce' });
  const zoomedPage = await zoomed.newPage();
  await zoomedPage.goto(base, { waitUntil: 'domcontentloaded' });
  await zoomedPage.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
  await nextPaint(zoomedPage);
  await assertNoOverflow(zoomedPage, '320px at 200% CSS text size');
  const splitWords = await zoomedPage.locator('.word-option span').evaluateAll((nodes) => nodes
    .filter((node) => node.getBoundingClientRect().height > Number.parseFloat(getComputedStyle(node).lineHeight) * 1.25)
    .map((node) => node.textContent));
  assert.deepEqual(splitWords, [], `spelling words wrapped at enlarged text: ${JSON.stringify(splitWords)}`);
  await zoomed.close();
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
