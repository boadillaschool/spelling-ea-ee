import test from 'node:test';
import assert from 'node:assert/strict';
import { LESSONS, ALL_WORDS, getLesson, getLessonHref } from '../lessons.js';
import { getContextSentence } from '../logic.js';

const WORDS = ['shorts', 'shops', 'shells', 'shoes', 'chops', 'cheese', 'child', 'chess', 'you', 'your'];
const SENTENCES = [
  'I wear shorts on a sunny day.',
  'There are three shops on this street.',
  'We found shells on the beach.',
  'I put on my shoes.',
  'There are two chops on the plate.',
  'I like cheese in my sandwich.',
  'The child is reading a book.',
  'We play chess together.',
  'You are my friend.',
  'This is your bag.',
];

test('16 October keeps the supplied sh/ch list in order with two special words', () => {
  const lesson = getLesson('?list=2026-10-16');
  assert.ok(lesson, 'the new dated lesson must be selectable');
  assert.equal(lesson.date, 'Viernes 16 de octubre de 2026');
  assert.equal(lesson.shortDate, '16/10/2026');
  assert.deepEqual(lesson.words.map(x => x.word), WORDS);
  assert.deepEqual(lesson.words.map(x => x.id), WORDS);
  assert.deepEqual(lesson.patterns, ['sh', 'ch']);
  assert.deepEqual(lesson.words.map(x => x.pattern), ['sh','sh','sh','sh','ch','ch','ch','ch','','']);
  assert.deepEqual(lesson.words.map(getContextSentence), SENTENCES);
  assert.equal(lesson.storageKey, 'spelling-ea-ee:list:2026-10-16:v1');
  assert.equal(new Set(LESSONS.map(x => x.storageKey)).size, LESSONS.length);
  assert.equal(getLessonHref(lesson), './?list=2026-10-16');
  assert.equal(ALL_WORDS.length, 30);
  assert.ok(Object.isFrozen(lesson) && Object.isFrozen(lesson.words));
  assert.ok(lesson.words.every(Object.isFrozen));
});
