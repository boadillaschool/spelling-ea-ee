import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WORDS } from '../data.js';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = fileURLToPath(new URL('../', import.meta.url));
const out = process.env.QA_OUT || await fs.mkdtemp(path.join(os.tmpdir(), 'word-illustrations-'));
await fs.mkdir(out, { recursive: true });
let base = process.env.BASE;
let server;
if (!base) {
  const allowed = new Set([
    'index.html', 'styles.css', 'app.js', 'data.js', 'lessons.js', 'illustrations.js', 'logic.js', 'speech.js',
    'spelling-timings.js', 'ink-pad.js', 'ui-helpers.js', 'focus-policy.js',
    ...WORDS.map(({ id }) => `images/words/${id}.svg`),
    ...WORDS.map(({ id }) => `audio/en-gb-v1/${id}.mp3`),
    ...WORDS.map(({ id }) => `audio/spelling-en-gb-v1/${id}.mp3`),
  ]);
  server = http.createServer(async (req, res) => {
    try {
      const pathname = new URL(req.url, 'http://localhost').pathname;
      const file = pathname.slice('/spelling-ea-ee/'.length) || 'index.html';
      if (req.method !== 'GET' || !pathname.startsWith('/spelling-ea-ee/') || !allowed.has(file)) { res.writeHead(404); res.end(); return; }
      const body = await fs.readFile(path.join(root, file));
      const type = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg' }[path.extname(file)];
      res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' }); res.end(body);
    } catch { res.writeHead(404); res.end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}/spelling-ea-ee/`;
}
base = new URL('?list=2026-09-25', base).href;
const browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_PATH ? { executablePath: process.env.BROWSER_PATH } : {}) });
const report = { base, cases: [] };
async function test(name, fn, viewport = { width: 412, height: 915 }) {
  if (process.env.QA_CASES && !new RegExp(process.env.QA_CASES).test(name)) return;
  const context = await browser.newContext({ viewport, reducedMotion: 'reduce' });
  const page = await context.newPage();
  page.setDefaultTimeout(8000);
  const errors = [];
  const requests = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', req => requests.push({ url: req.url(), method: req.method() }));
  try {
    const response = await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 45000 });
    assert.equal(response.status(), 200);
    await page.locator('.mode-row').first().waitFor();
    await fn(page);
    assert.deepEqual(errors, []);
    assert.deepEqual(requests.filter(req => req.method !== 'GET' || new URL(req.url).origin !== new URL(base).origin), []);
    report.cases.push({ name, passed: true }); console.log('PASS ' + name);
  } catch (error) {
    report.cases.push({ name, passed: false, error: error.stack }); console.log('FAIL ' + name + ': ' + error.message);
  } finally { await context.close(); }
}
const click = (page, name) => page.getByRole('button', { name, exact: true }).click();
async function picture(page, id) {
  const image = page.locator('.word-picture img');
  assert.equal(await image.count(), 1, 'One meaning illustration must accompany the active word');
  assert.equal(await image.isVisible(), true);
  assert.equal(await image.getAttribute('src'), `./images/words/${id}.svg`);
  const alt = await image.getAttribute('alt');
  assert.ok(alt.toLocaleLowerCase('es').includes(WORDS.find(word => word.id === id).cue));
  for (const { word } of WORDS) assert.doesNotMatch(alt, new RegExp(`\\b${word}\\b`, 'i'), 'Alt text must not reveal an English answer');
  assert.equal(await image.getAttribute('width'), '320');
  assert.equal(await image.getAttribute('height'), '200');
  await image.evaluate(node => node.decode());
  assert.ok(await image.evaluate(node => node.complete && node.naturalWidth > 0));
  assert.equal(new URL(await image.getAttribute('src'), page.url()).origin, new URL(base).origin);
}
async function capture(page, name) {
  await page.screenshot({ path: path.join(out, name + '.png'), fullPage: true });
}
try {
  await test('learn_illustration_persists_through_all_phases', async page => {
    await page.getByRole('button', { name: /^Aprender / }).click();
    await picture(page, 'easy');
    await capture(page, 'learn-listen');
    await click(page, 'Mostrar la palabra'); await picture(page, 'easy');
    await click(page, 'ea'); await click(page, 'Ocultar y escribir'); await picture(page, 'easy');
    assert.equal(await page.locator('.word').count(), 0, 'The picture must not reveal the spelling');
    await page.locator('#answer').fill('wrong'); await click(page, 'Comprobar'); await picture(page, 'easy');
    await click(page, 'Ocultar y escribir');
    await page.locator('#answer').fill('easy'); await click(page, 'Comprobar'); await picture(page, 'easy');
    await click(page, 'Siguiente palabra'); await picture(page, 'meat');
  });
  await test('practice_and_error_review_keep_the_right_picture', async page => {
    await click(page, 'Practicar las 10 palabras');
    const seen = [];
    let firstId = null;
    for (let step = 0; step < WORDS.length + 1; step++) {
      const id = await page.locator('[data-audio]').first().getAttribute('data-audio');
      if (step === 0) firstId = id;
      seen.push(id);
      await picture(page, id);
      assert.equal(await page.locator('.word').count(), 0);
      const occurrence = seen.filter((value) => value === id).length;
      if ((step === 0) || (id === firstId && occurrence === 2)) {
        await page.locator('#answer').fill('wrong'); await click(page, 'Comprobar'); await picture(page, id);
        await page.locator('#answer').fill('wrong'); await click(page, 'Comprobar'); await picture(page, id);
        await click(page, 'Ocultar y escribir'); await picture(page, id);
      }
      await capture(page, `practice-${id}-${occurrence}`);
      await page.locator('#answer').fill(id); await click(page, 'Comprobar'); await picture(page, id);
      if (await page.getByRole('button', { name: 'Ver resumen', exact: true }).count()) {
        await click(page, 'Ver resumen');
        break;
      }
      await click(page, 'Siguiente palabra');
    }
    assert.equal(seen.length, WORDS.length + 1);
    assert.deepEqual([...new Set(seen)].sort(), WORDS.map(({ id }) => id).sort());
    assert.equal(seen.filter((id) => id === firstId).length, 2, 'the missed word should return once');
    assert.equal(await page.locator('.word-picture').count(), 0, 'No stale active-word picture on results');
    await page.locator('#back').click();
    await page.getByRole('button', { name: /^Repasar errores / }).click();
    assert.equal(await page.locator('#progress').getAttribute('max'), '1');
    await picture(page, firstId);
    await page.locator('#answer').fill(firstId); await click(page, 'Comprobar'); await picture(page, firstId);
    await click(page, 'Ver resumen');
  });
  await test('mock_images_follow_random_order_previous_and_edit_without_spelling', async page => {
    await page.getByRole('button', { name: /^Simulacro tranquilo / }).click();
    const order = [];
    for (let index = 0; index < WORDS.length; index++) {
      const id = await page.locator('[data-audio]').first().getAttribute('data-audio');
      order.push(id); await picture(page, id);
      assert.equal(await page.locator('.word').count(), 0);
      assert.doesNotMatch(await page.locator('#answer-hint').innerText(), /no hay pistas/i);
      if (index === 0) await capture(page, 'mock-question');
      if (index === 1) {
        await click(page, 'Anterior'); await picture(page, order[0]);
        assert.equal(await page.locator('#answer').inputValue(), order[0]);
        await click(page, 'Siguiente'); await picture(page, id);
      }
      await page.locator('#answer').fill(id);
      await click(page, index === WORDS.length - 1 ? 'Revisar respuestas' : 'Siguiente');
    }
    assert.deepEqual([...order].sort(), WORDS.map(({ id }) => id).sort());
    assert.equal(await page.locator('.word-picture').count(), 0);
    await click(page, 'Cambiar la palabra 3'); await picture(page, order[2]);
    await click(page, 'Volver a la revisión'); await click(page, 'Entregar simulacro');
    assert.equal(await page.locator('#screen-title').innerText(), 'Has terminado');
    assert.equal(await page.locator('.word-picture').count(), 0);
  });
  await test('failed_images_keep_an_accessible_meaning_and_working_exercise', async page => {
    await page.route('**/images/words/*.svg', route => route.abort());
    await click(page, 'Practicar las 10 palabras');
    const firstId = await page.locator('[data-audio]').first().getAttribute('data-audio');
    await page.waitForFunction(() => document.querySelector('.word-picture img')?.complete);
    assert.equal(await page.locator('.picture-fallback').isVisible(), true, 'A missing image must show a meaning fallback');
    assert.equal(await page.locator('.word-picture img').isVisible(), false);
    assert.ok((await page.locator('.picture-fallback').innerText()).toLocaleLowerCase('es').includes(WORDS.find(word => word.id === firstId).cue));
    await page.locator('#answer').fill(firstId); await click(page, 'Comprobar');
    await click(page, 'Siguiente palabra');
    const nextId = await page.locator('[data-audio]').first().getAttribute('data-audio');
    await page.waitForFunction(() => document.querySelector('.word-picture img')?.complete);
    assert.notEqual(nextId, firstId);
    assert.ok((await page.locator('.picture-fallback').innerText()).toLocaleLowerCase('es').includes(WORDS.find(word => word.id === nextId).cue));
    await page.locator('#back').click();
    await page.getByRole('button', { name: /^Simulacro tranquilo / }).click();
    await page.waitForFunction(() => document.querySelector('.word-picture img')?.complete);
    assert.equal(await page.locator('.picture-fallback').isVisible(), true);
    assert.equal(await page.locator('#answer').isEnabled(), true);
  });
  await test('image_space_is_reserved_before_download', async page => {
    let ready;
    const pendingRoute = new Promise(resolve => { ready = resolve; });
    await page.route('**/images/words/*.svg', route => ready(route));
    const request = page.waitForRequest(request => request.url().includes('/images/words/'));
    await page.getByRole('button', { name: /^Aprender / }).click();
    await request;
    const heldRoute = await pendingRoute;
    const before = await page.locator('.word-picture img').boundingBox();
    assert.ok(before.width > 0 && before.height > 0);
    await heldRoute.continue(); await picture(page, 'easy');
    const after = await page.locator('.word-picture img').boundingBox();
    for (const key of ['x', 'y', 'width', 'height']) assert.ok(Math.abs(before[key] - after[key]) < 0.1, key);
  });
  for (const [width, height, zoom] of [[320, 700, false], [412, 915, false], [800, 1280, false], [844, 390, false], [412, 380, false], [320, 700, true]]) {
    await test(`layout_${width}_${height}${zoom ? '_text_200' : ''}`, async page => {
      if (zoom) await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
      async function layout(label) {
        const id = await page.locator('[data-audio]').first().getAttribute('data-audio');
        await picture(page, id);
        const geometry = await page.evaluate(() => {
          const boxes = [...document.querySelectorAll('button, input')].filter(element => element.checkVisibility()).map(element => {
            const rect = element.getBoundingClientRect();
            return { label: element.innerText || element.id, width: rect.width, height: rect.height };
          });
          const image = document.querySelector('.word-picture').getBoundingClientRect();
          const obstacles = [...document.querySelectorAll('h2, .step-help, .cue, .word, .sentence, .hidden-word, button, input, #progress-label')].filter(element => element.checkVisibility()).filter(element => {
            const rect = element.getBoundingClientRect();
            return Math.min(image.right, rect.right) - Math.max(image.left, rect.left) > 1 && Math.min(image.bottom, rect.bottom) - Math.max(image.top, rect.top) > 1;
          }).map(element => element.textContent || element.id);
          const wrappedWords = [...document.querySelectorAll('.word')].filter(element => element.getBoundingClientRect().height > parseFloat(getComputedStyle(element).lineHeight) + 1).map(element => element.textContent);
          return { width: innerWidth, scrollWidth: document.documentElement.scrollWidth, small: boxes.filter(box => box.width < 47.9 || box.height < 47.9), image: { x: image.x, right: image.right, width: image.width, height: image.height }, obstacles, wrappedWords };
        });
        await capture(page, `layout-${width}-${height}${zoom ? '-text-200' : ''}-${label}`);
        assert.ok(geometry.scrollWidth <= width + 1, JSON.stringify({ label, ...geometry }));
        assert.deepEqual(geometry.small, [], label + ' touch targets');
        assert.deepEqual(geometry.obstacles, [], label + ' image overlap');
        assert.deepEqual(geometry.wrappedWords, [], label + ' spelling words must stay whole');
        assert.ok(geometry.image.x >= 0 && geometry.image.right <= width + 1);
        if (await page.locator('#answer').count()) {
          await page.locator('#answer').scrollIntoViewIfNeeded();
          assert.equal(await page.locator('#answer').evaluate(element => {
            const rect = element.getBoundingClientRect();
            return document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2) === element;
          }), true, label + ' answer must remain reachable');
        }
        if (process.env.AXE_SOURCE) {
          const source = await fs.readFile(process.env.AXE_SOURCE, 'utf8');
          await page.evaluate(source + ';undefined;');
          const violations = await page.evaluate(async () => (await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } })).violations.map(item => ({ id: item.id, nodes: item.nodes.map(node => node.target) })));
          assert.deepEqual(violations, [], label + ' accessibility');
        }
      }
      await page.getByRole('button', { name: /^Aprender / }).click(); await layout('learn');
      await click(page, 'Mostrar la palabra'); await layout('learn-reveal');
      await page.locator('#back').click(); await click(page, 'Quitar todas');
      await page.getByRole('checkbox', { name: 'between', exact: true }).check();
      await click(page, 'Practicar 1 palabra'); await layout('practice');
      await page.locator('#answer').fill('wrong'); await click(page, 'Comprobar');
      await page.locator('#answer').fill('wrong'); await click(page, 'Comprobar'); await layout('practice-reveal');
      await click(page, 'Ocultar y escribir'); await page.locator('#answer').fill('between');
      await click(page, 'Comprobar'); await click(page, 'Siguiente palabra'); await layout('practice-delayed');
      await page.locator('#answer').fill('wrong'); await click(page, 'Comprobar');
      await page.locator('#answer').fill('wrong'); await click(page, 'Comprobar'); await layout('practice-delayed-reveal');
      await click(page, 'Ocultar y escribir'); await page.locator('#answer').fill('between');
      await click(page, 'Comprobar'); await click(page, 'Ver resumen'); await page.locator('#back').click();
      await page.getByRole('button', { name: /^Repasar errores / }).click(); await layout('review');
      await page.locator('#back').click(); await page.getByRole('button', { name: /^Simulacro tranquilo / }).click(); await layout('mock');
    }, { width, height });
  }
} finally {
  await browser.close();
  if (server) await new Promise(resolve => server.close(resolve));
  await fs.writeFile(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
}
console.log('Evidence: ' + out);
if (report.cases.some(item => !item.passed)) process.exitCode = 1;
