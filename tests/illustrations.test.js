import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { ALL_WORDS as WORDS } from '../lessons.js';

test('each curriculum word has a fixed local illustration with a Spanish meaning description', async () => {
  assert.ok(existsSync(new URL('../illustrations.js', import.meta.url)), 'Missing illustration metadata for the ten words');
  const { getWordIllustration } = await import('../illustrations.js');
  const sources = new Set();
  for (const item of WORDS) {
    const illustration = getWordIllustration(item.id);
    assert.equal(illustration.src, `./images/words/${item.id}.svg`);
    assert.ok(illustration.alt.toLocaleLowerCase('es').includes(item.cue), item.id + ': Spanish meaning missing');
    assert.ok(illustration.alt.length > item.cue.length);
    assert.equal(Object.isFrozen(illustration), true);
    sources.add(illustration.src);
  }
  assert.equal(sources.size, WORDS.length);
});
