import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { LESSONS, ALL_WORDS } from '../lessons.js';
const playwright = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const engine = process.env.BROWSER_ENGINE || 'chromium';
const root = fileURLToPath(new URL('../', import.meta.url));
const out = process.env.QA_OUT || await fs.mkdtemp(path.join(os.tmpdir(), 'weekly-lists-'));
await fs.mkdir(out, { recursive: true });
let server;
let base = process.env.BASE;
if (!base) {
  const allowed = new Set(['index.html','styles.css','app.js','data.js','lessons.js','logic.js','speech.js','illustrations.js','ink-pad.js','ui-helpers.js','focus-policy.js','spelling-timings.js',
    ...ALL_WORDS.flatMap(({id}) => [`audio/en-gb-v1/${id}.mp3`,`audio/spelling-en-gb-v1/${id}.mp3`,`images/words/${id}.svg`])]);
  server = http.createServer(async (req,res) => {
    const file = new URL(req.url, 'http://localhost').pathname.replace(/^\/spelling-ea-ee\//, '') || 'index.html';
    if (req.method !== 'GET' || !allowed.has(file)) { res.writeHead(404).end(); return; }
    try {
      const body = await fs.readFile(path.join(root,file));
      res.writeHead(200, { 'Content-Type': ({'.html':'text/html','.js':'text/javascript','.css':'text/css','.mp3':'audio/mpeg','.svg':'image/svg+xml'})[path.extname(file)], 'Cache-Control':'no-store' }).end(body);
    } catch { res.writeHead(404).end(); }
  });
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  base = `http://127.0.0.1:${server.address().port}/spelling-ea-ee/`;
}
const browser = await playwright[engine].launch({headless:true,...(engine === 'chromium' && process.env.BROWSER_PATH ? {executablePath:process.env.BROWSER_PATH} : {})});
const report = {base,engine,cases:[]};
async function check(name,fn,viewport={width:412,height:915}) {
  if (process.env.QA_CASES && !new RegExp(process.env.QA_CASES).test(name)) return;
  const context = await browser.newContext({viewport,reducedMotion:'reduce'});
  const page = await context.newPage(); page.setDefaultTimeout(5000);
  const errors=[]; page.on('pageerror',e=>errors.push(e.message));
  try { await fn(page,context); assert.deepEqual(errors,[]); report.cases.push({name,passed:true}); console.log('PASS',name); }
  catch(e) { report.cases.push({name,passed:false,error:e.stack}); await page.screenshot({path:path.join(out,`${name}-failure.png`),fullPage:true}); console.log('FAIL',name,e.message); }
  finally { await context.close(); }
}
try {
  await check('catalogue_and_both_dated_routes',async page=>{
    await page.goto(base,{waitUntil:'domcontentloaded'});
    await page.getByRole('heading',{name:'Elige tu lista de spelling',exact:true}).waitFor();
    assert.equal(await page.locator('.lesson-card').count(),2);
    for (const lesson of LESSONS) {
      const link=page.getByRole('link',{name:`Practicar la lista del ${lesson.shortDate}`,exact:true});
      await link.click();
      await page.getByRole('heading',{name:lesson.title,exact:true}).waitFor();
      assert.deepEqual(await page.getByRole('checkbox').evaluateAll(ns=>ns.map(n=>n.value)),lesson.words.map(w=>w.id));
      assert.equal(await page.locator('input:checked').count(),11);
      assert.ok((await page.locator('#eyebrow').innerText()).includes(lesson.shortDate));
      await page.getByRole('link',{name:'Elegir otra lista',exact:true}).click();
      await page.getByRole('heading',{name:'Elige tu lista de spelling',exact:true}).waitFor();
    }
  });
  await check('learn_ph_f_people_and_double_ph',async page=>{
    await page.goto(`${base}?list=2026-10-02`,{waitUntil:'domcontentloaded'});
    await page.locator('.mode-row').filter({hasText:/^Aprender/}).click();
    for (const [index,item] of LESSONS[1].words.entries()) {
      await page.getByRole('button',{name:'Mostrar la palabra',exact:true}).click();
      if (item.pattern) {
        assert.deepEqual(await page.locator('.family-buttons button').allTextContents(),['ph','f']);
        await page.locator('.family-buttons button').filter({hasText:new RegExp(`^${item.pattern}$`)}).click();
        if(item.id==='photograph') assert.equal(await page.locator('.word mark.pattern').count(),2);
      } else {
        assert.equal(await page.locator('.family-buttons button').count(),0);
        assert.equal(await page.getByText('Palabra especial: fíjate en todas sus letras.',{exact:true}).isVisible(),true);
        assert.equal(await page.locator('.word mark.pattern').count(),0);
      }
      const hide=page.getByRole('button',{name:'Ocultar y escribir',exact:true});
      assert.equal(await hide.isEnabled(),true); await hide.click();
      assert.equal(await page.locator('.word').count(),0);
      await page.locator('#answer').fill(item.word);
      await page.getByRole('button',{name:'Comprobar',exact:true}).click();
      await page.getByRole('button',{name:index===9?'Terminar':'Siguiente palabra',exact:true}).click();
    }
    assert.equal(await page.getByText('Has repasado 10 palabras',{exact:true}).isVisible(),true);
  });
  await check('separate_progress_reset_share_and_browser_history',async page=>{
    await page.addInitScript(()=>{Object.defineProperty(navigator,'share',{value:async data=>{window.sharedResult=data;},configurable:true});});
    const raw={};
    for (const lesson of LESSONS) {
      await page.goto(`${base}?list=${lesson.id}&qa=do-not-share`,{waitUntil:'domcontentloaded'});
      await page.getByRole('button',{name:'Quitar todas',exact:true}).click();
      const word=lesson.words[0].word;
      await page.getByRole('checkbox',{name:word,exact:true}).check();
      await page.getByRole('button',{name:'Practicar 1 palabra',exact:true}).click();
      await page.locator('#answer').fill(word);
      await page.getByRole('button',{name:'Comprobar',exact:true}).click();
      await page.getByRole('button',{name:'Ver resumen',exact:true}).click();
      raw[lesson.id]=await page.evaluate(key=>localStorage.getItem(key),lesson.storageKey);
      assert.ok(raw[lesson.id]);
      await page.getByRole('button',{name:'Compartir resultado',exact:true}).click();
      const shared=await page.evaluate(()=>window.sharedResult);
      assert.equal(shared.url,`${base}?list=${lesson.id}`);
      assert.ok(shared.text.includes(lesson.shortDate));
      assert.ok(shared.text.includes(lesson.patterns.join(' + ')));
    }
    assert.equal(await page.evaluate(key=>localStorage.getItem(key),LESSONS[0].storageKey),raw[LESSONS[0].id]);
    await page.getByRole('link',{name:'Elegir otra lista',exact:true}).click();
    await page.getByRole('heading',{name:'Elige tu lista de spelling',exact:true}).waitFor();
    await page.locator('.lesson-card').first().waitFor();
    assert.equal(await page.locator('.lesson-card .muted').filter({hasText:'1 de 10'}).count(),2);
    await page.getByRole('link',{name:'Practicar la lista del 02/10/2026',exact:true}).click();
    await page.goBack();
    await page.getByRole('heading',{name:'Elige tu lista de spelling',exact:true}).waitFor();
    await page.goForward();
    await page.getByRole('heading',{name:'Palabras con ph y f',exact:true}).waitFor();
    await page.getByText('Para familias',{exact:true}).click();
    await page.getByRole('button',{name:'Borrar progreso de este dispositivo',exact:true}).click();
    assert.ok((await page.locator('#confirm-text').innerText()).includes('Las otras listas no cambiarán'));
    await page.getByRole('button',{name:'Sí, borrar',exact:true}).click();
    assert.equal(await page.evaluate(key=>localStorage.getItem(key),LESSONS[1].storageKey),null);
    assert.equal(await page.evaluate(key=>localStorage.getItem(key),LESSONS[0].storageKey),raw[LESSONS[0].id]);
  });
  await check('new_list_practice_and_mock_cover_exactly_ten',async page=>{
    await page.goto(`${base}?list=2026-10-02`,{waitUntil:'domcontentloaded'});
    await page.getByRole('button',{name:'Practicar las 10 palabras',exact:true}).click();
    const seen=[];
    for(let i=0;i<10;i++) {
      const word=await page.locator('[data-audio]').first().getAttribute('data-audio');seen.push(word);
      assert.equal(await page.locator('.word').count(),0);
      assert.equal(await page.locator('.spelling-panel').count(),0);
      await page.locator('#answer').fill(word);
      await page.getByRole('button',{name:'Comprobar',exact:true}).click();
      await page.getByRole('button',{name:i===9?'Ver resumen':'Siguiente palabra',exact:true}).click();
    }
    assert.deepEqual(seen.sort(),LESSONS[1].words.map(w=>w.word).sort());
    await page.locator('#back').click();
    await page.locator('.mode-row').filter({hasText:/^Simulacro tranquilo/}).click();
    const mocked=[];
    for(let i=0;i<10;i++) {
      const word=await page.locator('[data-audio]').first().getAttribute('data-audio'); mocked.push(word);
      assert.equal(await page.locator('.word').count(),0);
      await page.locator('#answer').fill(word);
      await page.locator('#answer-form button[type=submit]').click();
    }
    assert.deepEqual(mocked.sort(),LESSONS[1].words.map(w=>w.word).sort());
    await page.getByRole('button',{name:'Entregar simulacro',exact:true}).click();
    assert.equal(await page.locator('.result-summary').innerText(),'10 de 10 palabras bien');
  });
  await check('real_bundled_audio_decode_playback_and_navigation_cancel',async page=>{
    await page.addInitScript(()=>{
      const OriginalAudio=window.Audio;window.qaAudio=[];
      window.Audio=function(...args){const audio=new OriginalAudio(...args);window.qaAudio.push(audio);return audio;};
    });
    await page.goto(`${base}?list=2026-10-02`,{waitUntil:'domcontentloaded'});
    await page.getByRole('heading',{name:'Palabras con ph y f',exact:true}).waitFor();
    const sources=[];
    for(const folder of ['en-gb-v1','spelling-en-gb-v1']) {
      for(const {id} of LESSONS[1].words) {
        // Fetch from the runner: the app deliberately has connect-src 'none'.
        const response=await fetch(new URL(`audio/${folder}/${id}.mp3`,base));
        assert.equal(response.status,200);
        sources.push({id,folder,bytes:[...new Uint8Array(await response.arrayBuffer())]});
      }
    }
    const decoded=await page.evaluate(async sources=>{
      const audioContext=new AudioContext();const clips=[];
      try {
        for(const {id,folder,bytes} of sources) {
          const audio=await audioContext.decodeAudioData(new Uint8Array(bytes).buffer);
          clips.push({id,folder,duration:audio.duration,channels:audio.numberOfChannels});
        }
      } finally {await audioContext.close();}
      return clips;
    },sources);
    assert.equal(decoded.length,20);assert.ok(decoded.every(clip=>clip.duration>3 && clip.channels===1));
    await page.getByRole('button',{name:'Quitar todas',exact:true}).click();
    await page.getByRole('checkbox',{name:'people',exact:true}).check();
    await page.getByRole('button',{name:'Practicar 1 palabra',exact:true}).click();
    await page.waitForFunction(()=>window.qaAudio.some(audio=>audio.src.endsWith('/en-gb-v1/people.mp3') && audio.currentTime>0.2 && !audio.paused));
    await page.locator('#answer').fill('people');
    await page.getByRole('button',{name:'Comprobar',exact:true}).click();
    await page.waitForFunction(()=>window.qaAudio.some(audio=>audio.src.endsWith('/spelling-en-gb-v1/people.mp3') && audio.currentTime>0.2 && !audio.paused));
    const active=await page.locator('.spelling-letter[data-active=true]').count();assert.equal(active,1);
    assert.equal(await page.evaluate(()=>window.qaAudio.find(audio=>audio.src.endsWith('/en-gb-v1/people.mp3')).paused),true);
    await page.evaluate(()=>addEventListener('pagehide',()=>sessionStorage.setItem('qa-audio-stopped',JSON.stringify(window.qaAudio.every(audio=>audio.paused)))));
    await page.getByRole('link',{name:'Elegir otra lista',exact:true}).click();
    await page.getByRole('heading',{name:'Elige tu lista de spelling',exact:true}).waitFor();
    assert.equal(await page.evaluate(()=>sessionStorage.getItem('qa-audio-stopped')),'true');
  });
  await check('unknown_list_and_storage_failure_are_safe',async page=>{
    await page.addInitScript(()=>{Object.defineProperty(window,'localStorage',{get(){throw new Error('blocked');}});});
    await page.goto(`${base}?list=%3Cscript%3E`,{waitUntil:'domcontentloaded'});
    await page.getByRole('heading',{name:'Elige tu lista de spelling',exact:true}).waitFor();
    await page.getByRole('link',{name:'Practicar la lista del 02/10/2026',exact:true}).click();
    await page.getByRole('button',{name:'Practicar las 10 palabras',exact:true}).click();
    const word=await page.locator('[data-audio]').first().getAttribute('data-audio');
    await page.locator('#answer').fill(word);
    await page.getByRole('button',{name:'Comprobar',exact:true}).click();
    assert.equal(await page.locator('#storage-note').isVisible(),true);
  });
  for(const viewport of [{width:320,height:740},{width:768,height:1024},{width:1024,height:600},{width:844,height:390}]) {
    await check(`layout_${viewport.width}_${viewport.height}`,async page=>{
      await page.goto(base,{waitUntil:'domcontentloaded'});
      await page.locator('.lesson-card').first().waitFor();
      for(const fontSize of ['100%','200%']) {
        await page.evaluate(size=>document.documentElement.style.fontSize=size,fontSize);
        assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'catalogue overflow');
        const boxes=await page.locator('.lesson-open').evaluateAll(ns=>ns.map(n=>({w:n.getBoundingClientRect().width,h:n.getBoundingClientRect().height})));
        assert.ok(boxes.every(b=>b.w>=48 && b.h>=48));
      }
      await page.evaluate(()=>document.documentElement.style.fontSize='100%');
      await page.screenshot({path:path.join(out,`catalog-${viewport.width}.png`),fullPage:true});
      await page.getByRole('link',{name:'Practicar la lista del 02/10/2026',exact:true}).click();
      await page.getByRole('button',{name:'Quitar todas',exact:true}).click();
      await page.getByRole('checkbox',{name:'photograph',exact:true}).check();
      await page.getByRole('button',{name:'Practicar 1 palabra',exact:true}).click();
      await page.locator('#answer').fill('photograph');
      await page.getByRole('button',{name:'Comprobar',exact:true}).click();
      for(const fontSize of ['100%','200%']) {
        await page.evaluate(size=>document.documentElement.style.fontSize=size,fontSize);
        assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'exercise overflow');
        const word=page.locator('.word');
        assert.equal(await word.innerText(),'photograph');
        assert.ok(await word.evaluate(n=>{
          const bounds=n.getBoundingClientRect(), content=n.closest('.stage').getBoundingClientRect();
          return bounds.left>=content.left-1 && bounds.right<=content.right+1;
        }),'word exceeds the inner task area');
        const intactButtons=await page.locator('.spelling-actions .btn').evaluateAll(buttons=>buttons.every(button=>{
          const text=[...button.childNodes].find(node=>node.nodeType===Node.TEXT_NODE && node.textContent.startsWith('Deletrear'));
          const range=document.createRange();range.setStart(text,0);range.setEnd(text,'Deletrear'.length);
          return range.getClientRects().length===1;
        }));
        assert.ok(intactButtons,'spelling controls must wrap between words, not letters');
      }
      await page.screenshot({path:path.join(out,`photograph-${viewport.width}-200.png`),fullPage:true});
    },viewport);
  }
} finally {
  await browser.close(); await new Promise(resolve=>server ? server.close(resolve) : resolve());
  await fs.writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));
}
console.log('REPORT',path.join(out,'report.json'));
if(report.cases.some(x=>!x.passed)) process.exitCode=1;
