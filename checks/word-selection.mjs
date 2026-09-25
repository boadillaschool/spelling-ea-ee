import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Optional developer tooling only; the learning app has no runtime dependencies.
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = fileURLToPath(new URL('../', import.meta.url));
const words = ['easy', 'meat', 'peanuts', 'between', 'read', 'jeans', 'heel', 'sweets', 'street', 'reach'];
const out = process.env.QA_OUT || await fs.mkdtemp(path.join(os.tmpdir(), 'word-selection-'));
await fs.mkdir(out, { recursive: true });
let server;
let base = process.env.BASE;
if (!base) {
  const allowed = new Set([
    'index.html', 'styles.css', 'app.js', 'data.js', 'lessons.js', 'illustrations.js', 'logic.js', 'speech.js',
    'spelling-timings.js', 'ink-pad.js', 'ui-helpers.js', 'focus-policy.js',
    ...words.map(id => `audio/en-gb-v1/${id}.mp3`),
    ...words.map(id => `audio/spelling-en-gb-v1/${id}.mp3`),
    ...words.map(id => `images/words/${id}.svg`),
  ]);
  server = http.createServer(async (req, res) => {
    try {
      const file = new URL(req.url, 'http://localhost').pathname.slice(1) || 'index.html';
      if (req.method !== 'GET' || !allowed.has(file)) { res.writeHead(404); res.end(); return; }
      const body = await fs.readFile(path.join(root, file));
      const type = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.mp3': 'audio/mpeg', '.svg': 'image/svg+xml' }[path.extname(file)];
      res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' });
      res.end(body);
    } catch { res.writeHead(404); res.end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}/`;
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
    report.cases.push({ name, passed: true });
    console.log('PASS ' + name);
  } catch (error) {
    report.cases.push({ name, passed: false, error: error.stack });
    console.log('FAIL ' + name + ': ' + error.message);
  } finally { await context.close(); }
}
try {
  await test('ten_visible_words_selected_by_default', async page => {
    assert.equal(await page.getByRole('checkbox').count(), 10, 'The complete ten-word list must be visible on arrival');
    assert.deepEqual(await page.getByRole('checkbox').evaluateAll(nodes => nodes.map(node => node.value)), words);
    assert.equal(await page.locator('input[type="checkbox"]:checked').count(), 10);
    assert.equal(await page.getByRole('heading', { name: 'Practica tus 10 palabras', exact: true }).count(), 1);
    assert.equal(await page.locator('#selection-count').innerText(), '10 de 10 palabras seleccionadas');
    assert.equal(await page.getByRole('button', { name: 'Practicar las 10 palabras', exact: true }).isEnabled(), true);
    assert.equal(await page.locator('#main section').first().getAttribute('aria-labelledby'), 'selection-title');
  });
  await test('the_whole_word_label_is_a_touch_target', async page => {
    const label = page.locator('label[for="choose-easy"]');
    const rect = await label.boundingBox();
    assert.ok(rect.width >= 48 && rect.height >= 48);
    await label.click({ position: { x: rect.width - 5, y: rect.height / 2 } });
    assert.equal(await page.getByRole('checkbox', { name: 'easy', exact: true }).isChecked(), false);
    assert.equal(await page.locator('#selection-count').innerText(), '9 de 10 palabras seleccionadas');
  });
  await test('changing_a_word_updates_count_without_losing_focus', async page => {
    const choice = page.getByRole('checkbox', { name: 'easy', exact: true });
    await choice.focus();
    await page.keyboard.press('Space');
    assert.equal(await choice.isChecked(), false);
    assert.equal(await page.locator('#selection-count').innerText(), '9 de 10 palabras seleccionadas');
    assert.equal(await page.getByRole('button', { name: 'Practicar 9 palabras', exact: true }).isEnabled(), true);
    assert.equal(await choice.evaluate(node => node === document.activeElement), true);
    await page.keyboard.press('Space');
    assert.equal(await page.locator('#selection-count').innerText(), '10 de 10 palabras seleccionadas');
  });
  await test('practice_contains_only_the_chosen_words_once', async page => {
    const chosen = ['easy', 'read', 'street'];
    for (const word of words.filter(word => !chosen.includes(word))) await page.getByRole('checkbox', { name: word, exact: true }).uncheck();
    await page.getByRole('button', { name: 'Practicar 3 palabras', exact: true }).click();
    assert.equal(await page.locator('#progress-label').innerText(), 'Palabra 1 de 3');
    assert.equal(await page.getByRole('checkbox').count(), 0, 'The list must be hidden during retrieval');
    const seen = [];
    for (let index = 0; index < chosen.length; index++) {
      const word = await page.locator('[data-audio]').first().getAttribute('data-audio');
      assert.ok(chosen.includes(word), 'An unselected word entered the session: ' + word);
      seen.push(word);
      await page.locator('#answer').fill(word);
      await page.getByRole('button', { name: 'Comprobar', exact: true }).click();
      await page.getByRole('button', { name: index === chosen.length - 1 ? 'Ver resumen' : 'Siguiente palabra', exact: true }).click();
    }
    assert.deepEqual(seen.sort(), [...chosen].sort());
    assert.equal(await page.locator('#screen-title').innerText(), 'Has terminado');
    await page.locator('#back').click();
    assert.deepEqual(await page.locator('input[type="checkbox"]:checked').evaluateAll(nodes => nodes.map(node => node.value)), chosen);
    assert.equal(await page.locator('#selection-count').innerText(), '3 de 10 palabras seleccionadas');
  });
  await test('bulk_selection_and_empty_guard_are_explicit', async page => {
    assert.equal(await page.getByRole('button', { name: 'Quitar todas', exact: true }).count(), 1);
    await page.getByRole('button', { name: 'Quitar todas', exact: true }).click();
    assert.equal(await page.locator('input[type="checkbox"]:checked').count(), 0);
    assert.equal(await page.locator('#start-selection').isDisabled(), true);
    assert.match(await page.locator('#selection-count').innerText(), /0 de 10/);
    assert.equal(await page.getByText('Elige al menos una palabra para empezar.', { exact: true }).isVisible(), true);
    await page.getByRole('checkbox', { name: 'read', exact: true }).check();
    assert.equal(await page.getByRole('button', { name: 'Practicar 1 palabra', exact: true }).isEnabled(), true);
    await page.getByRole('button', { name: 'Marcar todas', exact: true }).click();
    assert.equal(await page.locator('input[type="checkbox"]:checked').count(), 10);
    assert.equal(await page.getByRole('button', { name: 'Practicar las 10 palabras', exact: true }).isEnabled(), true);
  });
  await test('secondary_practice_entry_uses_the_same_selection', async page => {
    await page.getByRole('button', { name: 'Quitar todas', exact: true }).click();
    await page.getByRole('checkbox', { name: 'read', exact: true }).check();
    await page.locator('.mode-row').filter({ hasText: /^Practicar/ }).click();
    assert.equal(await page.locator('#progress-label').innerText(), 'Palabra 1 de 1');
    assert.equal(await page.locator('[data-audio]').first().getAttribute('data-audio'), 'read');
    await page.locator('#back').click();
    await page.getByRole('button', { name: 'Quitar todas', exact: true }).click();
    assert.equal(await page.locator('.mode-row').filter({ hasText: /^Practicar/ }).isDisabled(), true);
    await page.getByRole('button', { name: 'Marcar todas', exact: true }).click();
    assert.equal(await page.locator('.mode-row').filter({ hasText: /^Practicar/ }).isEnabled(), true);
  });
  await test('all_ten_words_finish_without_additions_or_duplicates', async page => {
    await page.getByRole('button', { name: 'Practicar las 10 palabras', exact: true }).click();
    const seen = [];
    for (let index = 0; index < words.length; index++) {
      assert.equal(await page.locator('#progress-label').innerText(), `Palabra ${index + 1} de 10`);
      const word = await page.locator('[data-audio]').first().getAttribute('data-audio');
      seen.push(word);
      await page.locator('#answer').fill(word);
      await page.getByRole('button', { name: 'Comprobar', exact: true }).click();
      await page.getByRole('button', { name: index === words.length - 1 ? 'Ver resumen' : 'Siguiente palabra', exact: true }).click();
    }
    assert.deepEqual(seen.sort(), [...words].sort());
    assert.equal(await page.locator('#screen-title').innerText(), 'Has terminado');
  });
  await test('selection_does_not_reduce_learn_or_mock_or_write_storage', async page => {
    const before = await page.evaluate(() => JSON.stringify(localStorage));
    await page.getByRole('button', { name: 'Quitar todas', exact: true }).click();
    await page.getByRole('checkbox', { name: 'read', exact: true }).check();
    assert.equal(await page.evaluate(() => JSON.stringify(localStorage)), before);
    for (const mode of ['Aprender', 'Simulacro tranquilo']) {
      await page.locator('.mode-row').filter({ hasText: mode }).click();
      assert.match(await page.locator('#progress-label').innerText(), /de 10/);
      await page.locator('#back').click();
      assert.equal(await page.locator('input[type="checkbox"]:checked').count(), 1);
    }
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.locator('#start-selection').waitFor();
    assert.equal(await page.locator('input[type="checkbox"]:checked').count(), 10);
  });
  for (const [width, height, zoom] of [[320, 700, false], [412, 915, false], [800, 1280, false], [740, 360, false], [320, 700, true]]) {
    const name = `layout_${width}_${height}${zoom ? '_text_200' : ''}`;
    await test(name, async page => {
      if (zoom) await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
      const measurements = await page.evaluate(() => {
        const nodes = [...document.querySelectorAll('button, input, summary')].filter(node => node.checkVisibility());
        const boxes = nodes.map(node => {
          const target = ['checkbox', 'radio'].includes(node.type) ? node.closest('label') : node;
          const rect = target.getBoundingClientRect();
          return { label: target.innerText || node.id, width: rect.width, height: rect.height };
        });
        const wrappedWords = [...document.querySelectorAll('.word-option span')].filter(node => node.getBoundingClientRect().height > parseFloat(getComputedStyle(node).lineHeight) + 1).map(node => node.textContent);
        return { width: innerWidth, scrollWidth: document.documentElement.scrollWidth, small: boxes.filter(box => box.width < 47.9 || box.height < 47.9), wrappedWords };
      });
      assert.ok(measurements.scrollWidth <= measurements.width + 1, JSON.stringify(measurements));
      assert.deepEqual(measurements.small, []);
      assert.deepEqual(measurements.wrappedWords, [], 'Spelling words must stay whole, including at 200% text size');
      await page.screenshot({ path: path.join(out, name + '.png'), fullPage: true });
      await page.locator('.word-selection').screenshot({ path: path.join(out, name + '-selector.png') });
      if (process.env.AXE_SOURCE) {
        const source = await fs.readFile(process.env.AXE_SOURCE, 'utf8');
        await page.evaluate(source + ';undefined;');
        const result = await page.evaluate(async () => (await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } })).violations.map(item => ({ id: item.id, nodes: item.nodes.map(node => node.target) })));
        assert.deepEqual(result, []);
      }
    }, { width, height });
  }
} finally {
  await browser.close();
  if (server) await new Promise(resolve => server.close(resolve));
  await fs.writeFile(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
}
if (report.cases.some(result => !result.passed)) process.exitCode = 1;
console.log('Evidence: ' + out);
