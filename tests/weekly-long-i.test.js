import test from 'node:test';
import assert from 'node:assert/strict';
import { LESSONS, ALL_WORDS, getLesson, getLessonHref } from '../lessons.js';
import { getContextSentence } from '../logic.js';

const WORDS = ['cried', 'tied up', 'lied', 'night', 'frighten', 'light', 'tights', 'sky', 'fly', 'dry'];
const SENTENCES = [
  'The baby cried.', 'I tied up the parcel with string.', 'He lied about eating the last biscuit.',
  'The stars shine at night.', 'Loud noises can frighten the cat.', 'Please turn on the light.',
  'She wears blue tights.', 'The sky is blue.', 'Birds can fly.', 'The towel is dry.',
];

test('19 October adds the exact received list with tied up as one item and separate progress', () => {
  const lesson = getLesson('?list=2026-10-19');
  assert.ok(lesson, 'the received long-i list must be selectable');
  assert.equal(lesson.date, 'Añadida el 19 de octubre de 2026');
  assert.equal(lesson.shortDate, '19/10/2026');
  assert.deepEqual(lesson.words.map(x => x.word), WORDS);
  assert.deepEqual(lesson.words.map(x => x.id), WORDS.map(x => x.replaceAll(' ', '-')));
  assert.deepEqual(lesson.patterns, ['ie', 'igh', 'y']);
  assert.deepEqual(lesson.words.map(x => x.pattern), ['ie','ie','ie','igh','igh','igh','igh','y','y','y']);
  assert.deepEqual(lesson.words.map(getContextSentence), SENTENCES);
  assert.ok(lesson.words.every(x => x.word.includes(x.pattern)));
  assert.equal(lesson.storageKey, 'spelling-ea-ee:list:2026-10-19:v1');
  assert.equal(new Set(LESSONS.map(x => x.storageKey)).size, LESSONS.length);
  assert.equal(getLessonHref(lesson), './?list=2026-10-19');
  assert.deepEqual(LESSONS.map(x => x.id), ['2026-09-25','2026-10-02','2026-10-16','2026-10-19']);
  assert.equal(ALL_WORDS.length, 40);
  assert.ok(Object.isFrozen(lesson) && Object.isFrozen(lesson.words));
  assert.ok(lesson.words.every(Object.isFrozen));
});
