import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

test('Pages export contains only complete, byte-identical runtime files', async () => {
  const { exportSite, SITE_FILES } = await import('../scripts/export-pages.mjs');
  const scratch = await fs.mkdtemp(path.join(os.tmpdir(), 'spelling-export-'));
  try {
    const destination = path.join(scratch, 'spelling');
    const copied = await exportSite(destination);
    assert.deepEqual(copied, SITE_FILES);
    for (const file of copied) {
      const source = await fs.readFile(new URL(`../${file}`, import.meta.url));
      assert.deepEqual(await fs.readFile(path.join(destination, file)), source, file);
    }
    assert.ok(copied.includes('site-routing.js'));
    assert.ok(copied.includes('audio/spelling-en-gb-v1/people.mp3'));
    assert.ok(copied.includes('images/words/photograph.svg'));
    assert.ok(!copied.some(file => /^(tests|checks|scripts|\.git)(\/|$)/.test(file)));
    await assert.rejects(fs.access(path.join(destination, 'package.json')));
    await assert.rejects(exportSite(scratch), /spelling/);
  } finally { await fs.rm(scratch, {recursive:true, force:true}); }
});
