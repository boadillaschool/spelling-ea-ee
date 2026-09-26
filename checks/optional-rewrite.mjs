import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LESSONS, ALL_WORDS } from '../lessons.js';

const playwright = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const engine = process.env.BROWSER_ENGINE || 'chromium';
const root = fileURLToPath(new URL('../', import.meta.url));
const out = process.env.QA_OUT || await fs.mkdtemp(path.join(os.tmpdir(), 'optional-rewrite-'));
await fs.mkdir(out, { recursive: true });
const allowed = new Set([
  'index.html', 'styles.css', 'site-routing.js', 'app.js', 'data.js', 'lessons.js', 'logic.js', 'speech.js',
  'illustrations.js', 'ink-pad.js', 'ui-helpers.js', 'focus-policy.js', 'spelling-timings.js',
  ...ALL_WORDS.flatMap(({ id }) => [`audio/en-gb-v1/${id}.mp3`, `audio/spelling-en-gb-v1/${id}.mp3`, `images/words/${id}.svg`]),
]);
const server = http.createServer(async (request, response) => {
  const file = new URL(request.url, 'http://localhost').pathname.replace(/^\/spelling\//, '') || 'index.html';
  if (request.method !== 'GET' || !allowed.has(file)) { response.writeHead(404).end(); return; }
  try {
    const body = await fs.readFile(path.join(root, file));
    const type = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.mp3': 'audio/mpeg', '.svg': 'image/svg+xml' }[path.extname(file)];
    response.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' }).end(body);
  } catch { response.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}/spelling/`;
const report = { engine, cases: [] };
let browser;
const nextPaint = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const stored = page => page.evaluate(() => JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage } }));
const toggle = page => page.getByRole('button', { name: 'Volver a escribir (opcional)', exact: true });
const original = page => page.locator('[data-ink-pad]');
const rewrite = page => page.locator('[data-rewrite-ink]');
const picture = canvas => canvas.evaluate(node => node.toDataURL());
async function draw(page, canvas, offset = 0) {
  await canvas.scrollIntoViewIfNeeded();
  const box = await canvas.boundingBox();
  await page.mouse.move(box.x + 30 + offset, box.y + 40);
  await page.mouse.down();
  await page.mouse.move(box.x + 95 + offset, box.y + 100, { steps: 8 });
  await page.mouse.up();
}
async function notebook(page, lesson = LESSONS[0], ids = [lesson.words[0].id, lesson.words[1].id]) {
  await page.goto(`${base}?list=${lesson.id}`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Quitar todas', exact: true }).click();
  for (const id of ids) await page.getByRole('checkbox', { name: lesson.words.find(word => word.id === id).word, exact: true }).check();
  await page.getByRole('button', { name: /Cuaderno con lápiz/ }).click();
  await original(page).waitFor();
  await nextPaint(page);
}
async function check(name, fn, viewport = { width: 800, height: 1100 }) {
  if (process.env.QA_CASES && !new RegExp(process.env.QA_CASES).test(name)) return;
  const context = await browser.newContext({ viewport, reducedMotion: 'reduce' });
  const page = await context.newPage();
  page.setDefaultTimeout(5000);
  const errors = [], external = [], requests = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('request', request => {
    const url = new URL(request.url());
    requests.push(url.pathname);
    if (url.origin !== new URL(base).origin) external.push(url.origin);
  });
  try {
    await fn(page, { context, requests });
    assert.deepEqual(errors, [], 'no browser errors');
    assert.deepEqual(external, [], 'no external requests');
    report.cases.push({ name, passed: true });
    console.log('PASS', name);
  } catch (error) {
    report.cases.push({ name, passed: false, error: error.stack });
    await page.screenshot({ path: path.join(out, `${name}-failure.png`), fullPage: true });
    await fs.writeFile(path.join(out, `${name}-failure-ax.txt`), await page.locator('body').ariaSnapshot());
    console.error('FAIL', name, error.message);
  } finally { await context.close(); }
}

try {
  browser = await playwright[engine].launch({ headless: true, ...(process.env.BROWSER_PATH ? { executablePath: process.env.BROWSER_PATH } : {}) });
  await check('pencil_after_compare_is_optional_and_independent', async (page, { requests }) => {
    await notebook(page);
    assert.equal(await toggle(page).count(), 0, 'no rewrite before Compare');
    assert.equal(await page.locator('[data-spelling]').count(), 0);
    assert.doesNotMatch(await page.locator('#main').ariaSnapshot(), /\beasy\b/i, 'no spelling in hidden-answer AX');
    assert.equal(requests.some(url => url.includes('/spelling-en-gb-v1/')), false);
    const before = await stored(page);
    await draw(page, original(page));
    const firstAttempt = await picture(original(page));
    await page.getByRole('button', { name: 'Comparar', exact: true }).click();
    await nextPaint(page);
    assert.equal(await toggle(page).count(), 1, 'Compare must offer Volver a escribir (opcional)');
    assert.equal(await toggle(page).getAttribute('aria-expanded'), 'false');
    assert.equal(await rewrite(page).isVisible(), false);
    await toggle(page).click();
    await nextPaint(page);
    assert.equal(await rewrite(page).isVisible(), true, 'opening defaults to a second pencil canvas');
    assert.equal(await picture(original(page)), firstAttempt, 'the first attempt is preserved');
    const blank = await picture(rewrite(page));
    await draw(page, rewrite(page));
    const firstCopy = await picture(rewrite(page));
    assert.notEqual(firstCopy, blank);
    await draw(page, rewrite(page), 45);
    await page.getByRole('button', { name: 'Deshacer copia', exact: true }).click();
    assert.equal(await picture(rewrite(page)), firstCopy, 'undo affects only the last copy stroke');
    assert.equal(await picture(original(page)), firstAttempt);
    await page.setViewportSize({ width: 620, height: 900 });
    await nextPaint(page);
    for (const canvas of [original(page), rewrite(page)]) {
      assert.equal(await canvas.evaluate(node => node.width === Math.round(node.getBoundingClientRect().width * Number(node.dataset.dpr))), true, 'each canvas resizes its backing pixels');
    }
    await page.setViewportSize({ width: 800, height: 1100 });
    await nextPaint(page);
    assert.equal(await picture(original(page)), firstAttempt, 'original strokes survive resize');
    assert.equal(await picture(rewrite(page)), firstCopy, 'copy strokes survive resize');
    await page.getByRole('button', { name: 'Borrar copia', exact: true }).click();
    assert.equal(await picture(rewrite(page)), blank);
    assert.equal(await picture(original(page)), firstAttempt);
    assert.equal(await stored(page), before, 'copy, undo, clear and compare never write storage');
    await page.screenshot({ path: path.join(out, 'pencil.png'), fullPage: true });
    await page.getByRole('button', { name: 'Necesito otra vuelta', exact: true }).click();
    assert.equal(await toggle(page).count(), 0, 'retry hides optional copy');
    await page.getByRole('button', { name: 'Comparar', exact: true }).focus();
    await page.keyboard.press('Enter');
    assert.equal(await toggle(page).getAttribute('aria-expanded'), 'false');
    await page.getByRole('button', { name: 'La he escrito bien', exact: true }).click();
    assert.match(await page.locator('#progress-label').innerText(), /2 de 2/);
    assert.equal(await toggle(page).count(), 0, 'continue is allowed without ever opening the option');
    await page.getByRole('button', { name: 'Comparar', exact: true }).click();
    await toggle(page).click();
    assert.equal(await page.getByRole('button', { name: 'Deshacer copia', exact: true }).isDisabled(), true);
    await page.getByRole('button', { name: 'La he escrito bien', exact: true }).click();
    assert.equal(await page.getByRole('heading', { name: 'Cuaderno terminado', exact: true }).isVisible(), true, 'empty copy does not block completion');
    assert.equal(await rewrite(page).count(), 0);
  });
  for (const lesson of LESSONS) {
    await check(`keyboard_copy_is_unscored_${lesson.id}`, async page => {
      await notebook(page, lesson);
      await page.getByRole('button', { name: 'Comparar', exact: true }).click();
      assert.equal(await page.getByRole('radio', { name: 'Teclado', exact: true }).isVisible(), false);
      await toggle(page).click();
      const method = page.getByRole('group', { name: 'Cómo quieres volver a escribir', exact: true });
      assert.equal(await method.count(), 1, 'the optional area offers its own pencil/keyboard selector');
      assert.equal(await method.getByRole('radio', { name: 'Lápiz', exact: true }).isChecked(), true);
      await method.getByRole('radio', { name: 'Teclado', exact: true }).check();
      const input = page.getByRole('textbox', { name: 'Escribe la palabra del modelo', exact: true });
      assert.equal(await input.count(), 1, 'keyboard copy uses a labelled native input');
      for (const [attribute, value] of Object.entries({ autocomplete: 'off', autocorrect: 'off', autocapitalize: 'none', spellcheck: 'false' })) {
        assert.equal(await input.getAttribute(attribute), value);
      }
      assert.equal(await input.evaluate(node => Boolean(node.form?.querySelector('button[type="submit"]'))), true);
      assert.equal(await rewrite(page).isVisible(), false);
      const before = await stored(page);
      const progress = await page.locator('#progress-label').innerText();
      const first = await picture(original(page));
      const feedback = page.locator('#rewrite-feedback');
      for (const [value, message] of [
        ['', /escribir.*o seguir sin hacerlo/i],
        ['   ', /escribir.*o seguir sin hacerlo/i],
        ['private-copy-marker', /mira el modelo/i],
        [` ${lesson.words[0].word.toUpperCase()} `, /coincide con el modelo/i],
      ]) {
        await input.fill(value);
        await input.press('Enter');
        assert.match(await feedback.innerText(), message);
        assert.equal(await input.inputValue(), value, 'feedback preserves the draft');
        assert.equal(await input.evaluate(node => node === document.activeElement), true, 'feedback never moves focus');
        assert.equal(await stored(page), before, 'blank, incorrect and correct copies change no storage bytes');
        assert.equal(await page.locator('#progress-label').innerText(), progress);
        assert.equal(await picture(original(page)), first);
      }
      await page.getByRole('button', { name: 'Comprobar copia', exact: true }).click();
      assert.equal(await page.getByRole('button', { name: 'Comprobar copia', exact: true }).evaluate(node => node === document.activeElement), true);
      await method.getByRole('radio', { name: 'Lápiz', exact: true }).check();
      await draw(page, rewrite(page));
      const ink = await picture(rewrite(page));
      await method.getByRole('radio', { name: 'Teclado', exact: true }).check();
      assert.equal(await input.inputValue(), ` ${lesson.words[0].word.toUpperCase()} `, 'mode switches preserve the local draft');
      await toggle(page).click();
      assert.equal(await input.isVisible(), false);
      await toggle(page).click();
      assert.equal(await input.inputValue(), ` ${lesson.words[0].word.toUpperCase()} `);
      await method.getByRole('radio', { name: 'Lápiz', exact: true }).check();
      await nextPaint(page);
      assert.equal(await picture(rewrite(page)), ink, 'switching modes preserves copy strokes');
      assert.equal(await stored(page), before);
      await method.getByRole('radio', { name: 'Teclado', exact: true }).check();
      await input.fill('');
      await page.getByRole('button', { name: 'Necesito otra vuelta', exact: true }).click();
      assert.equal(await input.count(), 0, 'retry discards the optional input');
      await page.getByRole('button', { name: 'Comparar', exact: true }).click();
      await toggle(page).click();
      assert.equal(await method.getByRole('radio', { name: 'Lápiz', exact: true }).isChecked(), true);
      await method.getByRole('radio', { name: 'Teclado', exact: true }).check();
      assert.equal(await input.inputValue(), '');
      assert.equal(await feedback.innerText(), '');
      await page.getByRole('button', { name: 'La he escrito bien', exact: true }).click();
      assert.equal(await input.count(), 0, 'a blank typed copy never blocks the next word');
    });
  }
  await check('copy_form_stays_above_software_keyboard', async page => {
    await notebook(page);
    await page.getByRole('button', { name: 'Comparar', exact: true }).click();
    await toggle(page).click();
    await page.getByRole('radio', { name: 'Teclado', exact: true }).check();
    await page.locator('#rewrite-answer').focus();
    await nextPaint(page);
    // Start with the whole form visible near the bottom, as before a keyboard opens.
    await page.locator('#rewrite-answer').evaluate(input => {
      window.scrollBy(0, input.form.getBoundingClientRect().bottom - (innerHeight - 20));
    });
    await nextPaint(page);
    await page.evaluate(() => {
      Object.defineProperty(window.visualViewport, 'height', { configurable: true, value: 390 });
      window.visualViewport.dispatchEvent(new Event('resize'));
      window.visualViewport.dispatchEvent(new Event('scroll'));
    });
    await nextPaint(page);
    const geometry = await page.locator('#rewrite-answer').evaluate(input => {
      const form = input.form.getBoundingClientRect();
      const submit = input.form.querySelector('button[type="submit"]').getBoundingClientRect();
      const top = visualViewport.offsetTop, bottom = top + visualViewport.height;
      return { form: { top: form.top, bottom: form.bottom }, submit: { top: submit.top, bottom: submit.bottom }, top, bottom };
    });
    assert.ok(geometry.form.top >= geometry.top - 1 && geometry.form.bottom <= geometry.bottom + 1, `copy form must fit visual viewport: ${JSON.stringify(geometry)}`);
    assert.ok(geometry.submit.bottom <= geometry.bottom + 1);
    await page.screenshot({ path: path.join(out, 'software-keyboard.png'), fullPage: true });
  }, { width: 320, height: 720 });
  for (const size of [
    { width: 320, height: 740 }, { width: 320, height: 740, text200: true },
    { width: 390, height: 844 }, { width: 768, height: 1024 },
  ]) {
    await check(`rewrite_reflow_${size.width}_${size.height}${size.text200 ? '_text200' : ''}`, async page => {
      await notebook(page, LESSONS[1], ['photograph']);
      if (size.text200) await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
      await page.getByRole('button', { name: 'Comparar', exact: true }).click();
      await toggle(page).click();
      for (const mode of ['Lápiz', 'Teclado']) {
        await page.getByRole('radio', { name: mode, exact: true }).check();
        await nextPaint(page);
        const layout = await page.evaluate(() => {
          const visible = node => node.getBoundingClientRect().height > 0;
          const rect = node => node.getBoundingClientRect();
          return {
            overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
            clippedWords: [...document.querySelectorAll('.word')].filter(visible).filter(node => {
              const r = rect(node), p = rect(node.closest('.word-group'));
              return r.left < p.left - 1 || r.right > p.right + 1 || getComputedStyle(node).whiteSpace !== 'nowrap';
            }).map(node => node.textContent),
            escapedPads: [...document.querySelectorAll('canvas')].filter(visible).filter(node => {
              const r = rect(node), p = rect(node.closest('.notebook-card'));
              return r.left < p.left || r.right > p.right;
            }).map(node => node.getAttribute('aria-label')),
            smallControls: [...document.querySelectorAll('button, .input-method-option')].filter(visible).filter(node => {
              const r = rect(node);
              return r.width < 47.5 || r.height < 47.5;
            }).map(node => node.textContent),
          };
        });
        assert.deepEqual(layout, { overflow: false, clippedWords: [], escapedPads: [], smallControls: [] }, mode);
        if (process.env.AXE_SOURCE) {
          await page.evaluate(`${await fs.readFile(process.env.AXE_SOURCE, 'utf8')};undefined;`);
          const violations = await page.evaluate(async () => (await window.axe.run(document, {
            runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] },
          })).violations.map(({ id }) => id));
          assert.deepEqual(violations, [], `${mode} accessibility`);
        }
      }
    }, size);
  }
  await check('leaving_clears_copy_including_cached_back_navigation', async page => {
    await notebook(page);
    await page.getByRole('button', { name: 'Comparar', exact: true }).click();
    await toggle(page).click();
    await draw(page, rewrite(page));
    await page.getByRole('radio', { name: 'Teclado', exact: true }).check();
    await page.locator('#rewrite-answer').fill('private-copy-marker');
    const before = await stored(page);
    // Deterministic bfcache lifecycle in addition to the real Back navigation below.
    await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true })));
    assert.equal(await page.locator('#rewrite-answer').count(), 0, 'leaving must discard optional drafts even when the page is cached');
    await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })));
    assert.equal(await toggle(page).getAttribute('aria-expanded'), 'false');
    await toggle(page).click();
    await nextPaint(page);
    assert.equal(await page.getByRole('button', { name: 'Deshacer copia', exact: true }).isDisabled(), true);
    await page.getByRole('radio', { name: 'Teclado', exact: true }).check();
    assert.equal(await page.locator('#rewrite-answer').inputValue(), '');
    assert.equal(await stored(page), before);
    await page.locator('#rewrite-answer').fill('private-copy-marker');
    await page.locator('#back').click();
    assert.equal(await page.locator('#rewrite-answer').count(), 0);
    await page.getByRole('button', { name: /Cuaderno con lápiz/ }).click();
    await page.getByRole('button', { name: 'Comparar', exact: true }).click();
    await toggle(page).click();
    await page.getByRole('radio', { name: 'Teclado', exact: true }).check();
    assert.equal(await page.locator('#rewrite-answer').inputValue(), '');
    await page.locator('#rewrite-answer').fill('private-copy-marker');
    await page.getByRole('link', { name: 'Elegir otra lista', exact: true }).click();
    await page.locator('.lesson-card').first().waitFor();
    await page.getByRole('link', { name: `Practicar la lista del ${LESSONS[1].shortDate}`, exact: true }).click();
    await page.getByRole('button', { name: /Cuaderno con lápiz/ }).click();
    assert.equal(await toggle(page).count(), 0);
    await page.goBack();
    await page.locator('.lesson-card').first().waitFor();
    await page.goBack();
    await page.waitForFunction(() => ['home', 'notebook'].includes(document.body.dataset.view));
    if (await toggle(page).count()) {
      assert.equal(await toggle(page).getAttribute('aria-expanded'), 'false');
      await toggle(page).click();
      await page.getByRole('radio', { name: 'Teclado', exact: true }).check();
      assert.equal(await page.locator('#rewrite-answer').inputValue(), '');
    } else assert.equal(await page.locator('#rewrite-answer').count(), 0);
    assert.equal(await stored(page), before);
  });
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
  await fs.writeFile(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
  console.log('Evidence:', out);
}
if (report.cases.some(result => !result.passed)) process.exitCode = 1;
