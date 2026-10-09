import test from 'node:test';
import assert from 'node:assert/strict';
import { WORDS } from '../data.js';

const curriculum = await import('../lessons.js').catch(() => ({ LESSONS: [] }));

test('the Friday registry preserves the original and the exact supplied ph/f words', () => {
  assert.deepEqual(curriculum.LESSONS.map(x => x.id), ['2026-09-25', '2026-10-02', '2026-10-16']);
  assert.deepEqual(curriculum.LESSONS[0].words, WORDS);
  assert.deepEqual(curriculum.LESSONS[1].words.map(x => x.word), [
    'dolphin', 'telephone', 'alphabet', 'trophy', 'photograph',
    'elephant', 'pharmacy', 'family', 'friends', 'people',
  ]);
  assert.deepEqual(curriculum.LESSONS[1].patterns, ['ph', 'f']);
  assert.equal(curriculum.LESSONS[1].words.at(-1).pattern, '');
  assert.ok(curriculum.LESSONS[1].words.every(x => x.word.includes(x.pattern)));
  assert.equal(curriculum.ALL_WORDS.length, 30);
});

test('lesson routing allowlists IDs and gives each list its own progress without migrating the original key', () => {
  assert.equal(typeof curriculum.getLesson, 'function');
  assert.equal(curriculum.getLesson(''), null);
  assert.equal(curriculum.getLesson('?list=unknown'), null);
  assert.equal(curriculum.getLesson('?list=__proto__'), null);
  assert.equal(curriculum.getLesson('?list=%3Cscript%3E'), null);
  const old = curriculum.getLesson('?list=2026-09-25');
  const next = curriculum.getLesson('?list=2026-10-02&qa=private');
  assert.equal(old.storageKey, 'spelling-ea-ee:v1');
  assert.notEqual(old.storageKey, next.storageKey);
  assert.equal(curriculum.getLessonHref(next), './?list=2026-10-02');
});
