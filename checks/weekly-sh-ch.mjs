import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { LESSONS, getLesson } from '../lessons.js';
import { SITE_FILES } from '../scripts/export-pages.mjs';
import { getSpellingCues } from '../spelling-timings.js';
const playwright = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const engine = process.env.BROWSER_ENGINE || 'chromium';
const root = fileURLToPath(new URL('../', import.meta.url));
const out = process.env.QA_OUT || await fs.mkdtemp(path.join(os.tmpdir(), 'weekly-sh-ch-'));
await fs.mkdir(out, { recursive: true });
const lesson = getLesson('?list=2026-10-16');
const allowed = new Set(SITE_FILES);
let server, base = process.env.BASE;
if (!base) {
  server = http.createServer(async (req, res) => {
    const file = new URL(req.url, 'http://localhost').pathname.replace(/^\/spelling\//, '') || 'index.html';
    if (req.method !== 'GET' || !allowed.has(file)) { res.writeHead(404).end(); return; }
    try {
      const body = await fs.readFile(path.join(root, file));
      res.writeHead(200, { 'Content-Type': ({ '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.mp3':'audio/mpeg', '.svg':'image/svg+xml' })[path.extname(file)], 'Cache-Control':'no-store' }).end(body);
    } catch { res.writeHead(404).end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}/spelling/`;
}
const browser = await playwright[engine].launch({ headless:true, ...(process.env.BROWSER_PATH ? { executablePath:process.env.BROWSER_PATH } : {}) });
const report = { base, engine, cases:[] };
async function check(name, fn, viewport = { width:412, height:915 }, allowMediaFailure = false) {
  const context = await browser.newContext({ viewport, reducedMotion:'reduce' });
  const page = await context.newPage();
  page.setDefaultTimeout(process.env.BASE ? 20000 : 6000);
  page.setDefaultNavigationTimeout(45000);
  const errors = [], external = [], failed = [], requests = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('request', r => { requests.push(r.url()); if (new URL(r.url()).origin !== new URL(base).origin) external.push(r.url()); });
  page.on('response', r => { if (r.status() >= 400) failed.push(r.url()); });
  try {
    await fn(page, requests);
    assert.deepEqual(errors, []); assert.deepEqual(external, []);
    if (!allowMediaFailure) assert.deepEqual(failed, []);
    report.cases.push({ name, passed:true }); console.log('PASS', name);
  } catch (e) {
    report.cases.push({ name, passed:false, error:e.stack, pageErrors:errors, externalRequests:external, failedResponses:failed }); console.error('FAIL', name, e.message);
    try { await page.screenshot({ path:path.join(out, `${name}-failure.png`), fullPage:true, timeout:10000 }); } catch {}
  } finally { await context.close(); }
}
async function home(page, id = lesson.id) {
  await page.goto(`${base}?list=${id}`, { waitUntil:'domcontentloaded' });
  await page.getByRole('button', { name:'Quitar todas', exact:true }).waitFor();
}
async function select(page, ids) {
  await page.getByRole('button', { name:'Quitar todas', exact:true }).click();
  for (const id of ids) await page.getByRole('checkbox', { name:id, exact:true }).check();
}
const storage = page => page.evaluate(() => ({ ...localStorage }));
try {
  await check('newest_card_exact_inventory_and_all_learning_gates', async page => {
    await page.goto(base, { waitUntil:'domcontentloaded' });
    await page.locator('.lesson-card').first().waitFor();
    assert.equal(await page.locator('.lesson-card').count(), LESSONS.length);
    assert.match(await page.locator('.lesson-card').first().innerText(), /Viernes 16 de octubre de 2026/);
    await page.getByRole('link', { name:'Practicar la lista del 16/10/2026', exact:true }).click();
    await page.getByRole('checkbox').first().waitFor();
    assert.deepEqual(await page.getByRole('checkbox').evaluateAll(ns => ns.map(n => n.value)), lesson.words.map(w => w.id));
    await page.locator('.mode-row').filter({ hasText:/^Aprender/ }).click();
    for (const [index, item] of lesson.words.entries()) {
      assert.equal(await page.locator('.word').count(), 0);
      assert.doesNotMatch(await page.locator('#main').ariaSnapshot(), new RegExp(`\\b${item.word}\\b`, 'i'));
      await page.getByRole('button', { name:'Mostrar la palabra', exact:true }).click();
      if (item.pattern) {
        assert.deepEqual(await page.locator('.family-buttons button').allTextContents(), ['sh', 'ch']);
        await page.locator('.family-buttons button').filter({ hasText:new RegExp(`^${item.pattern}$`) }).click();
        assert.equal(await page.locator('.word mark.pattern').count(), 1);
      } else {
        assert.equal(await page.locator('.family-buttons button').count(), 0);
        assert.ok(await page.getByText('Palabra especial: fíjate en todas sus letras.', { exact:true }).isVisible());
      }
      await page.getByRole('button', { name:'Ocultar y escribir', exact:true }).click();
      await page.locator('#answer').fill(item.word);
      await page.getByRole('button', { name:'Comprobar', exact:true }).click();
      await page.getByRole('button', { name:index === lesson.words.length - 1 ? 'Terminar' : 'Siguiente palabra', exact:true }).click();
    }
    assert.ok(await page.getByText('Has repasado 10 palabras', { exact:true }).isVisible());
  });
  await check('practice_and_mock_cover_the_exact_new_list', async (page, requests) => {
    await home(page);
    await page.getByRole('button', { name:'Practicar las 10 palabras', exact:true }).click();
    const seen = [];
    for (let i = 0; i < lesson.words.length; i++) {
      const word = await page.locator('[data-audio]').first().getAttribute('data-audio'); seen.push(word);
      assert.equal(await page.locator('.spelling-panel').count(), 0);
      await page.locator('#answer').fill(word);
      await page.getByRole('button', { name:'Comprobar', exact:true }).click();
      await page.getByRole('button', { name:i === lesson.words.length - 1 ? 'Ver resumen' : 'Siguiente palabra', exact:true }).click();
    }
    assert.deepEqual(seen.sort(), lesson.words.map(w => w.word).sort());
    await page.locator('#back').click();
    requests.length = 0;
    await page.locator('.mode-row').filter({ hasText:/^Simulacro tranquilo/ }).click();
    const mocked = [];
    for (let i = 0; i < lesson.words.length; i++) {
      const word = await page.locator('[data-audio]').first().getAttribute('data-audio'); mocked.push(word);
      assert.equal(await page.locator('.word').count(), 0);
      await page.locator('#answer').fill(word);
      await page.locator('#answer-form button[type=submit]').click();
    }
    assert.deepEqual(mocked.sort(), lesson.words.map(w => w.word).sort());
    assert.equal(requests.some(url => url.includes('/spelling-en-gb-v1/')), false);
    await page.getByRole('button', { name:'Entregar simulacro', exact:true }).click();
    assert.equal(await page.locator('.result-summary').innerText(), '10 de 10 palabras bien');
  });
  await check('previous_progress_survives_new_work_chooser_unknown_route_and_reset', async page => {
    for (const old of LESSONS.slice(0, -1)) {
      await home(page, old.id); await select(page, [old.words[0].id]);
      await page.getByRole('button', { name:'Practicar 1 palabra', exact:true }).click();
      await page.locator('#answer').fill(old.words[0].word);
      await page.getByRole('button', { name:'Comprobar', exact:true }).click();
      await page.getByRole('button', { name:'Ver resumen', exact:true }).click();
    }
    const before = await storage(page);
    await home(page); await select(page, ['you']);
    await page.getByRole('button', { name:'Practicar 1 palabra', exact:true }).click();
    await page.locator('#answer').fill('you');
    await page.getByRole('button', { name:'Comprobar', exact:true }).click();
    await page.getByRole('button', { name:'Ver resumen', exact:true }).click();
    assert.ok((await storage(page))[lesson.storageKey]);
    for (const route of ['', '?list=unknown']) {
      await page.goto(base + route, { waitUntil:'domcontentloaded' });
      await page.locator('.lesson-card').first().waitFor();
      for (const [key, value] of Object.entries(before)) assert.equal((await storage(page))[key], value);
    }
    await home(page);
    await page.getByText('Para familias', { exact:true }).click();
    await page.getByRole('button', { name:'Borrar progreso de este dispositivo', exact:true }).click();
    await page.getByRole('button', { name:'Sí, borrar', exact:true }).click();
    assert.deepEqual(await storage(page), before);
  });
  await check('new_recordings_decode_play_and_keep_spelling_cues', async page => {
    await page.addInitScript(() => {
      const NativeAudio = window.Audio; window.qaAudio = [];
      window.Audio = function(...args) { const audio = new NativeAudio(...args); window.qaAudio.push(audio); return audio; };
      Object.defineProperty(window, 'speechSynthesis', { value:undefined, configurable:true });
    });
    await home(page);
    const clips = [];
    for (const folder of ['en-gb-v1', 'spelling-en-gb-v1']) {
      for (const { id } of lesson.words) {
        const response = await fetch(new URL(`audio/${folder}/${id}.mp3`, base)); assert.equal(response.status, 200);
        clips.push({ id, folder, bytes:[...new Uint8Array(await response.arrayBuffer())] });
      }
    }
    const decoded = await page.evaluate(async clips => {
      const ctx = new AudioContext(); const results = [];
      try { for (const clip of clips) { const audio = await ctx.decodeAudioData(new Uint8Array(clip.bytes).buffer); results.push({ duration:audio.duration, channels:audio.numberOfChannels }); } }
      finally { await ctx.close(); } return results;
    }, clips);
    assert.equal(decoded.length, lesson.words.length * 2);
    assert.ok(decoded.every(x => x.duration > 2 && x.channels === 1));
    await select(page, ['your']);
    await page.getByRole('button', { name:'Practicar 1 palabra', exact:true }).click();
    await page.waitForFunction(() => window.qaAudio.some(a => a.src.endsWith('/en-gb-v1/your.mp3') && a.currentTime > .2 && !a.paused));
    assert.equal(await page.evaluate(() => window.qaAudio.at(-1).playbackRate), 1);
    await page.locator('#answer').fill('your');
    await page.getByRole('button', { name:'Comprobar', exact:true }).click();
    await page.waitForFunction(() => window.qaAudio.at(-1).src.endsWith('/spelling-en-gb-v1/your.mp3') && window.qaAudio.at(-1).currentTime > .1);
    const cues = getSpellingCues({ id:'your' });
    await page.evaluate(at => { window.qaAudio.at(-1).currentTime = at; }, cues.lastLetterEndAt - .25);
    await page.waitForFunction(() => document.querySelectorAll('.spelling-letter[data-active=true]').length === 1);
    await page.evaluate(at => { window.qaAudio.at(-1).currentTime = at; }, cues.lastLetterEndAt + .15);
    await page.waitForFunction(() => document.querySelectorAll('.spelling-letter[data-active=true]').length === 0);
    await page.waitForFunction(() => window.qaAudio.at(-1).ended, undefined, { timeout:10000 });
    await page.getByRole('button', { name:'Deletrear más despacio', exact:true }).click();
    await page.waitForFunction(() => window.qaAudio.at(-1).currentTime > .1 && !window.qaAudio.at(-1).paused);
    assert.equal(await page.evaluate(() => window.qaAudio.at(-1).playbackRate), .8);
    assert.ok(await page.evaluate(() => window.qaAudio.slice(0, -1).every(a => a.paused)));
    await page.getByRole('button', { name:'Ver resumen', exact:true }).click();
    assert.ok(await page.evaluate(() => window.qaAudio.every(a => a.paused)));
  });
  await check('new_list_remains_usable_without_audio_or_storage', async page => {
    await page.addInitScript(() => {
      Object.defineProperty(window, 'speechSynthesis', { value:undefined, configurable:true });
      Object.defineProperty(window, 'localStorage', { get() { throw new Error('blocked'); } });
    });
    await page.route('**/*.mp3', route => route.fulfill({ status:404, body:'' }));
    await home(page); await select(page, ['you']);
    await page.getByRole('button', { name:'Practicar 1 palabra', exact:true }).click();
    await page.locator('#answer').fill('you');
    await page.getByRole('button', { name:'Comprobar', exact:true }).click();
    assert.ok(await page.locator('#storage-note').isVisible());
    await page.getByRole('button', { name:'Ver resumen', exact:true }).click();
    assert.ok(await page.getByRole('heading', { name:'Has terminado', exact:true }).isVisible());
  }, undefined, true);
  for (const viewport of [{ width:320, height:740 }, { width:800, height:1100 }, { width:1024, height:600 }]) {
    await check(`layout_new_list_${viewport.width}`, async page => {
      await home(page);
      for (const size of ['100%', '200%']) {
        await page.evaluate(size => document.documentElement.style.fontSize = size, size);
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
        await page.screenshot({ path:path.join(out, `new-list-${viewport.width}-${size}.png`), fullPage:true });
      }
      await page.evaluate(() => document.documentElement.style.fontSize = '100%');
      await select(page, ['cheese']);
      await page.getByRole('button', { name:'Practicar 1 palabra', exact:true }).click();
      await page.locator('#answer').fill('cheese');
      await page.getByRole('button', { name:'Comprobar', exact:true }).click();
      await page.evaluate(() => document.documentElement.style.fontSize = '200%');
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      assert.ok(await page.locator('.word').evaluate(n => { const a = n.getBoundingClientRect(), b = n.closest('.stage').getBoundingClientRect(); return a.left >= b.left - 1 && a.right <= b.right + 1; }));
      assert.ok(await page.locator('.spelling-actions button').evaluateAll(ns => ns.every(n => { const r = n.getBoundingClientRect(); return r.width >= 48 && r.height >= 48; })));
      await page.screenshot({ path:path.join(out, `feedback-${viewport.width}-200.png`), fullPage:true });
    }, viewport);
  }
} finally {
  await browser.close(); await new Promise(resolve => server ? server.close(resolve) : resolve());
  await fs.writeFile(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
}
console.log('REPORT', path.join(out, 'report.json'));
if (report.cases.some(x => !x.passed)) process.exitCode = 1;
