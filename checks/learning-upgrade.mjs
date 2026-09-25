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
const server = http.createServer(async (req, res) => {
  try {
    const file = new URL(req.url, 'http://localhost').pathname.slice(1) || 'index.html';
    if (req.method !== 'GET' || !allowed.has(file)) {
      res.writeHead(404); res.end(); return;
    }
    const body = await fs.readFile(path.join(root, file));
    const type = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.mp3': 'audio/mpeg', '.svg': 'image/svg+xml' }[path.extname(file)];
    res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' });
    res.end(body);
  } catch {
    res.writeHead(404); res.end();
  }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}/?list=2026-09-25`;
const browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_PATH ? { executablePath: process.env.BROWSER_PATH } : {}) });

try {
  const context = await browser.newContext({ viewport: { width: 800, height: 1280 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const requests = [];
  page.on('request', (request) => requests.push(new URL(request.url()).pathname));
  await page.addInitScript(() => {
    const NativeAudio = window.Audio;
    window.__playedAudio = [];
    window.__audioElements = [];
    window.Audio = function TrackedAudio(...args) {
      const audio = new NativeAudio(...args);
      window.__audioElements.push(audio);
      const nativePlay = audio.play.bind(audio);
      audio.play = () => {
        window.__playedAudio.push({ src: audio.src, rate: audio.playbackRate });
        return nativePlay();
      };
      return audio;
    };
    window.Audio.prototype = NativeAudio.prototype;
  });
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  const methodGroup = page.getByRole('radiogroup', { name: 'Cómo quieres escribir' });
  assert.equal(await methodGroup.count(), 1);
  assert.equal(await page.getByRole('radio', { name: 'Teclado', exact: true }).isChecked(), true);
  await page.getByRole('radio', { name: 'Lápiz de la tablet', exact: true }).check();
  assert.equal(await page.getByRole('radio', { name: 'Lápiz de la tablet', exact: true }).isChecked(), true);
  await page.getByRole('button', { name: 'Quitar todas', exact: true }).click();
  await page.getByRole('checkbox', { name: 'easy', exact: true }).check();
  await page.getByRole('button', { name: 'Practicar 1 palabra', exact: true }).click();

  assert.equal(await page.locator('#answer-form').getAttribute('data-input-method'), 'pencil');
  assert.match(await page.locator('#answer-hint').innerText(), /escritura a mano/i);
  assert.equal(await page.locator('#answer').getAttribute('autocomplete'), 'off');
  assert.equal(await page.locator('#answer').getAttribute('autocorrect'), 'off');
  assert.equal(await page.locator('#answer').getAttribute('spellcheck'), 'false');
  assert.equal(await page.locator('[data-spelling]').count(), 0, 'spelling must not leak before an attempt');
  await page.locator('#answer').fill('easy');
  await page.getByRole('button', { name: 'Comprobar', exact: true }).click();

  const panel = page.locator('[data-spelling="easy"]');
  await panel.waitFor();
  assert.equal(await panel.locator('.spelling-letter').allTextContents().then((letters) => letters.join('')), 'EASY');
  assert.equal(await panel.getByRole('button', { name: 'Deletrear otra vez', exact: true }).count(), 1);
  assert.equal(await panel.getByRole('button', { name: 'Deletrear más despacio', exact: true }).count(), 1);
  await page.waitForTimeout(250);
  assert.ok(requests.includes('/audio/spelling-en-gb-v1/easy.mp3'), JSON.stringify(requests));
  assert.equal(
    await page.evaluate(() => window.__playedAudio.filter(({ src }) => src.includes('/spelling-en-gb-v1/easy.mp3')).at(-1)?.rate),
    1,
    'rebuilt spelling feedback must play its real pauses at the natural rate',
  );
  await panel.getByRole('button', { name: 'Deletrear más despacio', exact: true }).click();
  assert.equal(
    await page.evaluate(() => window.__playedAudio.filter(({ src }) => src.includes('/spelling-en-gb-v1/easy.mp3')).at(-1)?.rate),
    0.8,
    'the slower spelling replay must avoid aggressive time stretching',
  );
  const pauseHighlight = await page.evaluate(async () => {
    const [{ getSpellingCues }, { WORDS }] = await Promise.all([
      import('./spelling-timings.js'),
      import('./data.js'),
    ]);
    const audio = window.__audioElements.filter(({ src }) => src.includes('/spelling-en-gb-v1/easy.mp3')).at(-1);
    const cues = getSpellingCues(WORDS.find(({ id }) => id === 'easy'));
    audio.pause();
    audio.currentTime = cues.lastLetterEndAt - 0.01;
    audio.dispatchEvent(new Event('timeupdate'));
    const beforePause = [...document.querySelectorAll('[data-spelling="easy"] .spelling-letter')]
      .findIndex((letter) => letter.dataset.active === 'true');
    audio.currentTime = cues.lastLetterEndAt;
    audio.dispatchEvent(new Event('timeupdate'));
    const duringPause = [...document.querySelectorAll('[data-spelling="easy"] .spelling-letter')]
      .findIndex((letter) => letter.dataset.active === 'true');
    return { beforePause, duringPause };
  });
  assert.deepEqual(pauseHighlight, { beforePause: 3, duringPause: -1 }, 'the last-letter highlight must clear for the authored pause');

  await page.locator('#back').click();
  await page.locator('.mode-row').filter({ hasText: /^Aprender/ }).click();
  await page.getByRole('button', { name: 'Mostrar la palabra', exact: true }).click();
  assert.equal(await page.locator('[data-spelling="easy"]').count(), 1, 'Learn may offer spelling while the teaching answer is visible');
  const beforeLearnAnswer = requests.filter((pathname) => pathname.endsWith('/spelling-en-gb-v1/easy.mp3')).length;
  await page.getByRole('button', { name: 'ea', exact: true }).click();
  await page.getByRole('button', { name: 'Ocultar y escribir', exact: true }).click();
  await page.locator('#answer').fill('easy');
  await page.getByRole('button', { name: 'Comprobar', exact: true }).click();
  await page.waitForTimeout(250);
  assert.equal(await page.locator('[data-spelling="easy"]').count(), 1);
  assert.equal(
    requests.filter((pathname) => pathname.endsWith('/spelling-en-gb-v1/easy.mp3')).length,
    beforeLearnAnswer + 1,
    'a completed Learn retrieval automatically spells the word once',
  );

  await page.locator('#back').click();
  const spellingRequestsBeforeMock = requests.filter((pathname) => pathname.includes('/spelling-en-gb-v1/')).length;
  await page.locator('.mode-row').filter({ hasText: /^Simulacro tranquilo/ }).click();
  assert.equal(await page.locator('[data-spelling]').count(), 0);
  for (let index = 0; index < words.length; index += 1) {
    await page.getByRole('button', { name: index === words.length - 1 ? 'Revisar respuestas' : 'Siguiente', exact: true }).click();
  }
  assert.equal(
    requests.filter((pathname) => pathname.includes('/spelling-en-gb-v1/')).length,
    spellingRequestsBeforeMock,
    'Mock must never request spelling audio before submission',
  );
  await page.getByRole('button', { name: 'Entregar simulacro', exact: true }).click();
  assert.equal(await page.getByRole('button', { name: /^Deletrear / }).count(), words.length);
  await page.getByRole('button', { name: 'Deletrear easy', exact: true }).click();
  await page.waitForTimeout(250);
  assert.ok(requests.filter((pathname) => pathname.endsWith('/spelling-en-gb-v1/easy.mp3')).length > beforeLearnAnswer + 1);

  await page.locator('#back').click();
  await page.locator('.mode-row').filter({ hasText: /^Cuaderno con lápiz/ }).click();
  const canvas = page.locator('[data-ink-pad]');
  await canvas.waitFor();
  assert.equal(await canvas.getAttribute('aria-label'), 'Área de escritura a mano. La palabra sigue oculta.');
  assert.doesNotMatch(await canvas.getAttribute('aria-label'), /easy/i, 'the canvas label must not reveal the hidden spelling');
  assert.equal(await page.getByRole('button', { name: 'Deshacer', exact: true }).isDisabled(), true);
  assert.equal(await page.getByRole('button', { name: 'Borrar', exact: true }).isDisabled(), true);
  assert.equal(await page.getByRole('button', { name: 'Comparar', exact: true }).isEnabled(), true);
  await page.getByRole('button', { name: 'Comparar', exact: true }).focus();
  await page.keyboard.press('Enter');
  assert.equal(await page.locator('[data-spelling="easy"]').count(), 1, 'keyboard and switch users can compare without drawing');
  await page.getByRole('button', { name: 'Necesito otra vuelta', exact: true }).click();
  assert.equal(await canvas.getAttribute('aria-label'), 'Área de escritura a mano. La palabra sigue oculta.');
  const storageBeforeInk = await page.evaluate(() => JSON.stringify(localStorage));
  const box = await canvas.boundingBox();
  await page.mouse.move(box.x + 30, box.y + 40);
  await page.mouse.down();
  await page.mouse.move(box.x + 100, box.y + 90, { steps: 6 });
  await page.mouse.up();
  assert.equal(await page.getByRole('button', { name: 'Deshacer', exact: true }).isEnabled(), true);
  assert.equal(await page.getByRole('button', { name: 'Borrar', exact: true }).isEnabled(), true);
  assert.equal(await page.getByRole('button', { name: 'Comparar', exact: true }).isEnabled(), true);
  assert.equal(await page.evaluate(() => JSON.stringify(localStorage)), storageBeforeInk, 'freehand strokes stay in memory only');
  await page.getByRole('button', { name: 'Deshacer', exact: true }).click();
  assert.equal(await page.getByRole('button', { name: 'Comparar', exact: true }).isEnabled(), true);
  await page.mouse.move(box.x + 40, box.y + 50);
  await page.mouse.down();
  await page.mouse.move(box.x + 130, box.y + 100, { steps: 6 });
  await page.mouse.up();
  await page.getByRole('button', { name: 'Comparar', exact: true }).click();
  assert.equal(await page.locator('[data-spelling="easy"]').count(), 1);
  assert.equal(await page.getByRole('button', { name: 'La he escrito bien', exact: true }).count(), 1);
  assert.equal(await page.getByRole('button', { name: 'Necesito otra vuelta', exact: true }).count(), 1);

  await page.locator('#back').click();
  await page.getByRole('button', { name: 'Quitar todas', exact: true }).click();
  for (const word of ['easy', 'meat', 'read']) await page.getByRole('checkbox', { name: word, exact: true }).check();
  await page.getByRole('button', { name: 'Practicar 3 palabras', exact: true }).click();
  const firstWord = await page.locator('[data-audio]').first().getAttribute('data-audio');
  await page.locator('#answer').fill('child-private-marker');
  await page.getByRole('button', { name: 'Comprobar', exact: true }).click();
  const storedAfterAnswer = await page.evaluate(() => JSON.stringify(localStorage));
  assert.doesNotMatch(storedAfterAnswer, /child-private-marker/, 'typed answers must never enter storage');
  await page.locator('#answer').fill('child-private-marker');
  await page.getByRole('button', { name: 'Comprobar', exact: true }).click();
  await page.getByRole('button', { name: 'Ocultar y escribir', exact: true }).click();
  await page.locator('#answer').fill(firstWord);
  await page.getByRole('button', { name: 'Comprobar', exact: true }).click();
  await page.getByRole('button', { name: 'Siguiente palabra', exact: true }).click();
  for (let count = 0; count < 2; count += 1) {
    const current = await page.locator('[data-audio]').first().getAttribute('data-audio');
    assert.notEqual(current, firstWord);
    await page.locator('#answer').fill(current);
    await page.getByRole('button', { name: 'Comprobar', exact: true }).click();
    await page.getByRole('button', { name: 'Siguiente palabra', exact: true }).click();
  }
  assert.equal(await page.locator('[data-audio]').first().getAttribute('data-audio'), firstWord, 'missed word returns after two others');
  assert.match(await page.locator('#progress-label').innerText(), /4 de 4/);
  await page.locator('#answer').fill(firstWord);
  await page.getByRole('button', { name: 'Comprobar', exact: true }).click();
  await page.getByRole('button', { name: 'Ver resumen', exact: true }).click();
  assert.match(await page.locator('.result-summary').innerText(), /^2 de 3 palabras bien a la primera$/);
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
