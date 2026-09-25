import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { LESSONS } from '../lessons.js';
import { SITE_FILES } from '../scripts/export-pages.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const portal = process.env.PORTAL_ROOT;
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const out = process.env.QA_OUT || await fs.mkdtemp(path.join(os.tmpdir(), 'spelling-migration-'));
await fs.mkdir(out, { recursive: true });
let base = process.env.BASE;
let server;
if (!base) {
  assert.ok(portal, 'Set PORTAL_ROOT to the generated portal checkout, or BASE to the public /spelling/ URL.');
  const allowed = new Set(SITE_FILES);
  server = http.createServer(async (req, res) => {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    let directory, file;
    if (pathname === '/spelling-ea-ee' || pathname === '/spelling') {
      res.writeHead(301, { Location: pathname + '/' + new URL(req.url, 'http://localhost').search }).end(); return;
    }
    if (pathname.startsWith('/spelling-ea-ee/')) {
      directory = root; file = pathname.slice('/spelling-ea-ee/'.length) || 'index.html';
    } else if (pathname.startsWith('/spelling/')) {
      directory = path.join(portal, 'spelling'); file = pathname.slice('/spelling/'.length) || 'index.html';
    } else {
      directory = portal; file = pathname.slice(1) || 'index.html';
      if (!['index.html', 'styles.css', 'favicon.svg', '404.html'].includes(file)) { res.writeHead(404).end(); return; }
    }
    if (directory !== portal && !allowed.has(file)) { res.writeHead(404).end(); return; }
    try {
      const body = await fs.readFile(path.join(directory, file));
      const type = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.svg':'image/svg+xml', '.mp3':'audio/mpeg', '.txt':'text/plain' }[path.extname(file)] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type':type, 'Cache-Control':'no-store' }).end(body);
    } catch { res.writeHead(404).end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}/spelling/`;
}
const origin = new URL(base).origin;
const browser = await chromium.launch({ headless:true, ...(process.env.BROWSER_PATH ? {executablePath:process.env.BROWSER_PATH} : {}) });
const context = await browser.newContext({ viewport:{width:390,height:844}, reducedMotion:'reduce' });
const page = await context.newPage();
page.setDefaultTimeout(20000);
page.setDefaultNavigationTimeout(45000);
const errors = [], external = new Set(), results = [];
page.on('pageerror', error => errors.push(error.message));
page.on('request', request => {
  if (/^https?:/.test(request.url()) && new URL(request.url()).origin !== origin) external.add(request.url());
});
let stage;
try {
  stage = 'portal_to_canonical_catalogue';
  assert.equal((await page.goto(origin + '/', {waitUntil:'domcontentloaded'})).status(), 200);
  assert.equal(await page.locator('.resource-link').getAttribute('href'), '/spelling/');
  await page.locator('.resource-link').click();
  await page.locator('.lesson-card').first().waitFor();
  assert.equal(page.url(), base);
  assert.equal(await page.locator('.lesson-card').count(), LESSONS.length);
  results.push({name:stage,passed:true}); console.log('PASS',stage);

  stage = 'progress_survives_legacy_redirects_byte_for_byte';
  const progress = {};
  for (const lesson of LESSONS) {
    await page.goto(`${base}?list=${lesson.id}`, {waitUntil:'domcontentloaded'});
    await page.getByRole('button',{name:'Quitar todas',exact:true}).click();
    await page.getByRole('checkbox',{name:lesson.words[0].word,exact:true}).check();
    await page.getByRole('button',{name:'Practicar 1 palabra',exact:true}).click();
    await page.locator('#answer').fill(lesson.words[0].word);
    await page.getByRole('button',{name:'Comprobar',exact:true}).click();
    await page.getByRole('button',{name:'Ver resumen',exact:true}).click();
    progress[lesson.storageKey] = await page.evaluate(key=>localStorage.getItem(key), lesson.storageKey);
    assert.ok(progress[lesson.storageKey]);
  }
  for (const lesson of LESSONS) {
    await page.goto(`${origin}/spelling-ea-ee/?list=${lesson.id}&utm_source=qa#discard-me`, {waitUntil:'commit'});
    await page.waitForURL(`${base}?list=${lesson.id}`, {waitUntil:'domcontentloaded'});
    await page.getByRole('heading',{name:lesson.title,exact:true}).waitFor();
    assert.deepEqual(await page.evaluate(keys => Object.fromEntries(keys.map(k=>[k,localStorage.getItem(k)])), Object.keys(progress)), progress);
  }
  await page.getByRole('link',{name:'Elegir otra lista',exact:true}).click();
  await page.locator('.lesson-card').first().waitFor();
  assert.equal(await page.locator('.lesson-card .muted').filter({hasText:'1 de 10'}).count(), LESSONS.length);
  results.push({name:stage,passed:true}); console.log('PASS',stage);

  stage = 'legacy_root_index_unknown_query_and_no_redirect_loop';
  for (const suffix of ['', '/', '/index.html', '/?list=%3Cscript%3E&next=https://example.invalid/#secret']) {
    await page.goto(`${origin}/spelling-ea-ee${suffix}`, {waitUntil:'commit'});
    await page.waitForURL(base, {waitUntil:'domcontentloaded'});
    await page.locator('.lesson-card').first().waitFor();
    assert.equal(await page.locator('.lesson-card').count(), LESSONS.length);
  }
  await page.reload({waitUntil:'domcontentloaded'});
  await page.locator('.lesson-card').first().waitFor();
  assert.equal(page.url(), base);
  assert.deepEqual(await page.evaluate(keys=>Object.fromEntries(keys.map(k=>[k,localStorage.getItem(k)])), Object.keys(progress)), progress);
  assert.deepEqual(errors, []); assert.deepEqual([...external], []);
  await page.screenshot({path:path.join(out,'canonical-catalogue.png'),fullPage:true});
  results.push({name:stage,passed:true}); console.log('PASS',stage);
} catch(error) {
  results.push({name:stage,passed:false,error:error.stack});
  console.error('FAIL',stage,error.message); process.exitCode=1;
} finally {
  await fs.writeFile(path.join(out,'report.json'),JSON.stringify({base,results,errors,external:[...external]},null,2));
  await context.close(); await browser.close();
  if(server) await new Promise(resolve=>server.close(resolve));
  console.log('REPORT',path.join(out,'report.json'));
}
