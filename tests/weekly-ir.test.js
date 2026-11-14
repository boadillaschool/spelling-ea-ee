import test from 'node:test';
import assert from 'node:assert/strict';
import { LESSONS, getLesson, getLessonHref } from '../lessons.js';
import { getContextSentence, getHighlightedParts } from '../logic.js';

const WORDS = ['skirt', 'bird', 'first', 'birthday', 'thirsty', 'shirt', 'thirteen', 'dirty', 'said', 'one'];

test('20 November list uses the confirmed next-Friday date and exact ten photographed words', () => {
  const lesson = getLesson('?list=2026-11-20');
  assert.ok(lesson, 'new photographed list must be selectable');
  assert.equal(lesson.date, 'Viernes 20 de noviembre de 2026');
  assert.equal(lesson.shortDate, '20/11/2026');
  assert.deepEqual(lesson.words.map(w => w.word), WORDS);
  assert.deepEqual(lesson.words.map(w => w.id), WORDS);
  assert.deepEqual(lesson.patterns, ['ir']);
  assert.deepEqual(lesson.words.map(w => w.pattern), [...Array(8).fill('ir'), '', '']);
  assert.equal(lesson.storageKey, 'spelling-ea-ee:list:2026-11-20:v1');
  assert.equal(new Set(LESSONS.map(l => l.storageKey)).size, LESSONS.length);
  assert.equal(getLessonHref(lesson), './?list=2026-11-20');
  assert.ok(Object.isFrozen(lesson) && Object.isFrozen(lesson.words));
  assert.ok(lesson.words.every(Object.isFrozen));
  for (const item of lesson.words) {
    assert.ok(getContextSentence(item).toLowerCase().includes(item.word));
    const parts = getHighlightedParts(item.word, item.pattern);
    assert.equal(parts.map(p => p.text).join(''), item.word);
    assert.deepEqual(parts.filter(p => p.highlighted).map(p => p.text), item.pattern ? ['ir'] : []);
  }
});
