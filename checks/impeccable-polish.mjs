import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LESSONS, ALL_WORDS } from '../lessons.js';

// Optional, isolated developer tooling; no browser profile or runtime dependency is shared.
const playwright = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const engine = process.env.BROWSER_ENGINE || 'chromium';
const root = fileURLToPath(new URL('../', import.meta.url));
const out = process.env.QA_OUT || await fs.mkdtemp(path.join(os.tmpdir(), 'spelling-polish-'));
await fs.mkdir(out, { recursive: true });
let server;
let base = process.env.BASE;
if (!base) {
  const allowed = new Set(['index.html', 'styles.css', 'site-routing.js', 'app.js', 'data.js', 'lessons.js', 'logic.js', 'speech.js', 'illustrations.js', 'ink-pad.js', 'ui-helpers.js', 'focus-policy.js', 'spelling-timings.js',
    ...ALL_WORDS.flatMap(({ id }) => [`audio/en-gb-v1/${id}.mp3`, `audio/spelling-en-gb-v1/${id}.mp3`, `images/words/${id}.svg`])]);
  server = http.createServer(async (req, res) => {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    if (!pathname.startsWith('/spelling/')) { res.writeHead(404).end(); return; }
    const file = pathname.slice('/spelling/'.length) || 'index.html';
    if (req.method !== 'GET' || !allowed.has(file)) { res.writeHead(404).end(); return; }
    try {
      const body = await fs.readFile(path.join(root, file));
      res.writeHead(200, { 'Content-Type': ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.mp3': 'audio/mpeg', '.svg': 'image/svg+xml' })[path.extname(file)], 'Cache-Control': 'no-store' }).end(body);
    } catch { res.writeHead(404).end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}/spelling/`;
}
const browser = await playwright[engine].launch({ headless: true, ...(engine === 'chromium' && process.env.BROWSER_PATH ? { executablePath: process.env.BROWSER_PATH } : {}) });
const report = { base, engine, browser: browser.version(), cases: [], skipped: [] };
async function ready(page, url = base) {
  const response = await page.goto(url, { waitUntil: 'domcontentloaded' });
  assert.equal(response.status(), 200);
  await page.locator('body[data-view]').waitFor();
  await page.locator('.lesson-card, #start-selection').first().waitFor();
  await page.evaluate(() => document.fonts.ready);
}
async function check(name, fn, viewport = { width: 412, height: 915 }, requiredEngine) {
  if (process.env.QA_CASES && !new RegExp(process.env.QA_CASES).test(name)) return;
  if (requiredEngine && engine !== requiredEngine) {
    const reason = `CDP fixture requires ${requiredEngine}; unsupported in ${engine}`;
    report.skipped.push({ name, reason });
    console.log('SKIP', name, reason);
    return;
  }
  const context = await browser.newContext({ viewport, reducedMotion: 'reduce' });
  const page = await context.newPage();
  page.setDefaultTimeout(7000);
  const errors = [];
  const requests = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('request', req => requests.push({ url: req.url(), method: req.method() }));
  try {
    await fn(page, context);
    assert.deepEqual(errors, [], 'Browser errors');
    assert.deepEqual(requests.filter(req => req.method !== 'GET' || new URL(req.url).origin !== new URL(base).origin), [], 'Unexpected network request');
    report.cases.push({ name, passed: true });
    console.log('PASS', name);
  } catch (error) {
    report.cases.push({ name, passed: false, error: error.stack });
    await page.screenshot({ path: path.join(out, `${name}-failure.png`), fullPage: true });
    console.log('FAIL', name, error.message);
  } finally { await context.close(); }
}
try {
  if (process.env.CAPTURE_BASELINE) {
    for (const width of [320, 412, 820, 1280]) {
      const page = await browser.newPage({ viewport: { width, height: 960 } });
      await ready(page);
      await page.screenshot({ path: path.join(out, `before-catalog-${width}.png`), fullPage: true });
      await ready(page, `${base}?list=2026-10-16`);
      await page.screenshot({ path: path.join(out, `before-home-${width}.png`), fullPage: true });
      await page.close();
    }
  }
  await check('skip_link_bypasses_shell_with_keyboard', async page => {
    await ready(page);
    const skip = page.getByRole('link', { name: 'Saltar al contenido', exact: true });
    assert.equal(await skip.count(), 1, 'A skip link must bypass the shared shell');
    assert.equal(await skip.getAttribute('href'), '#main');
    assert.equal(await page.locator('a[href], button, input, summary').first().innerText(), 'Saltar al contenido');
    assert.equal(await page.locator('#main').getAttribute('tabindex'), '-1');
    // Existing app focus starts at the screen heading; preserve that policy.
    for (let i = 0; i < 6 && !(await skip.evaluate(node => node === document.activeElement)); i++) await page.keyboard.press('Shift+Tab');
    assert.equal(await skip.evaluate(node => node === document.activeElement), true, 'Skip link is keyboard reachable');
    const box = await skip.boundingBox();
    assert.ok(box.x >= 0 && box.y >= 0 && box.width >= 48 && box.height >= 48, 'Focused skip link is visible and touch-sized');
    await page.screenshot({ path: path.join(out, 'skip-link-focused.png') });
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('#main').evaluate(node => node === document.activeElement), true, 'Skip target receives native keyboard focus');
    await page.keyboard.press('Tab');
    assert.equal(await page.locator('.lesson-open').first().evaluate(node => node === document.activeElement), true, 'Next Tab reaches the actual content');
  });
  await check('brand_links_back_to_portal', async page => {
    await ready(page);
    const brand = page.getByRole('link', { name: 'Boadilla School, inicio', exact: true });
    assert.equal(await brand.count(), 1, 'The brand must be a named home link');
    assert.equal(await brand.getAttribute('href'), '/');
    const bounds = await brand.boundingBox();
    assert.ok(bounds.width >= 48 && bounds.height >= 48, 'Brand link is touch sized');
    assert.equal(new URL(await brand.getAttribute('href'), base).pathname, '/');
  });
  await check('latest_list_has_clear_priority', async page => {
    await ready(page);
    const before = await page.evaluate(() => JSON.stringify(Object.entries(localStorage)));
    const cards = page.locator('.lesson-card');
    const lessons = [...LESSONS].reverse();
    assert.equal(await cards.count(), lessons.length);
    assert.equal(await page.locator('.lesson-recency').count(), 1, 'Only the newest list has a recency label');
    assert.equal(await cards.first().locator('.lesson-recency').innerText(), 'Lista más reciente');
    assert.equal(await page.locator('.lesson-open:not(.btn-secondary)').count(), 1, 'One clear primary action');
    for (let i = 0; i < lessons.length; i++) {
      assert.deepEqual(await cards.nth(i).locator('.lesson-preview span').allTextContents(), lessons[i].words.map(word => word.word));
      const link = cards.nth(i).locator('.lesson-open');
      assert.equal(new URL(await link.getAttribute('href'), base).searchParams.get('list'), lessons[i].id);
      const box = await link.boundingBox();
      assert.ok(box.width >= 48 && box.height >= 48);
    }
    const boxes = await cards.evaluateAll(nodes => nodes.map(node => ({x:node.getBoundingClientRect().x,y:node.getBoundingClientRect().y,width:node.getBoundingClientRect().width})));
    assert.ok(boxes[0].width > boxes[1].width, 'Newest list spans the catalog');
    assert.ok(Math.abs(boxes[1].y-boxes[2].y) < 2 && boxes[2].x > boxes[1].x, 'Older lists share a calm tablet row');
    const actionBottoms = await page.locator('.lesson-open').evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().bottom));
    assert.ok(Math.abs(actionBottoms[1] - actionBottoms[2]) < 2, 'Sibling actions share a baseline');
    assert.equal(await page.evaluate(() => getComputedStyle(document.body).backgroundImage), 'none', 'Plain canvas matches the portal');
    assert.equal(await page.evaluate(() => JSON.stringify(Object.entries(localStorage))), before, 'Browsing does not write progress');
    await page.screenshot({path:path.join(out,'catalog-tablet.png'),fullPage:true});
  }, {width:820,height:1180});
  await check('skip_link_respects_safe_area_when_hidden', async (page, context) => {
    await ready(page);
    const session = await context.newCDPSession(page);
    await session.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: 47, left: 0, right: 0, bottom: 34 } });
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const skip = page.locator('.skip-link');
    assert.equal(await skip.evaluate(node => getComputedStyle(node).top), '47px', 'Safe-area simulation must be active');
    const hidden = await skip.boundingBox();
    assert.ok(hidden.y + hidden.height <= 0, 'Unfocused skip link stays wholly outside the viewport with a notch');
    await skip.focus();
    assert.ok((await skip.boundingBox()).y >= 47, 'Focused skip link is below the safe-area inset');
    await session.detach();
  }, undefined, 'chromium');
} finally {
  await browser.close();
  if (server) await new Promise(resolve => server.close(resolve));
  report.passed = report.cases.length > 0 && report.cases.every(item => item.passed);
  if (!report.cases.length) {
    report.harnessError = `No runnable tests for BROWSER_ENGINE=${engine} and QA_CASES=${process.env.QA_CASES || '(unset)'}; ${report.skipped.length} unsupported case(s) skipped`;
    console.error(report.harnessError);
  }
  await fs.writeFile(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
}
console.log('REPORT', path.join(out, 'report.json'));
if (!report.passed) process.exitCode = 1;
