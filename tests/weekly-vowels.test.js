import test from 'node:test';
import assert from 'node:assert/strict';
import { ALL_WORDS, LESSONS, getLesson, getLessonHref } from '../lessons.js';
import { getContextSentence, getHighlightedParts } from '../logic.js';

const WORDS = ['rat', 'gate', 'bed', 'beads', 'pin', 'pine', 'socks', 'soak', 'you', 'your'];
const PATTERNS = ['a', 'a…e', 'e', 'ea', 'i', 'i…e', 'o', 'oa', '', ''];

test('repeated weekly words reuse identical assets and appear once in the asset registry', () => {
  const lesson = getLesson('?list=2026-11-13');
  assert.equal(new Set(ALL_WORDS.map(w => w.id)).size, ALL_WORDS.length, 'global asset IDs are unique');
  assert.deepEqual(ALL_WORDS.map(w => w.id).sort(), [...new Set(LESSONS.flatMap(l => l.words.map(w => w.id)))].sort());
  for (const [id, oldId] of [['pine', '2026-10-30'], ['you', '2026-10-16'], ['your', '2026-10-16']]) {
    const original = getLesson(`?list=${oldId}`).words.find(w => w.id === id);
    assert.equal(lesson.words.find(w => w.id === id), original);
    assert.equal(ALL_WORDS.find(w => w.id === id), original);
  }
});

test('13 November contains exactly the ten photographed words in order with independent progress', () => {
  const lesson = getLesson('?list=2026-11-13');
  assert.ok(lesson, '13 November list must be selectable');
  assert.equal(lesson.date, 'Viernes 13 de noviembre de 2026');
  assert.equal(lesson.shortDate, '13/11/2026');
  assert.deepEqual(lesson.words.map(w => w.word), WORDS);
  assert.deepEqual(lesson.words.map(w => w.id), WORDS);
  assert.deepEqual(lesson.words.map(w => w.pattern), PATTERNS);
  assert.deepEqual(lesson.patterns, PATTERNS.filter(Boolean));
  assert.equal(lesson.storageKey, 'spelling-ea-ee:list:2026-11-13:v1');
  assert.equal(new Set(LESSONS.map(l => l.storageKey)).size, LESSONS.length);
  assert.equal(getLessonHref(lesson), './?list=2026-11-13');
  assert.ok(Object.isFrozen(lesson) && Object.isFrozen(lesson.words));
  assert.ok(lesson.words.every(Object.isFrozen));
  assert.ok(lesson.words.every(w => getContextSentence(w).toLowerCase().includes(w.word)));
  for (const item of lesson.words) {
    const parts = getHighlightedParts(item.word, item.pattern);
    assert.equal(parts.map(p => p.text).join(''), item.word);
    const expected = item.pattern.includes('…') ? item.pattern.split('…') : item.pattern ? [item.pattern] : [];
    assert.deepEqual(parts.filter(p => p.highlighted).map(p => p.text), expected);
  }
});
