import test from 'node:test';
import assert from 'node:assert/strict';
import { LESSONS, ALL_WORDS, getLesson, getLessonHref } from '../lessons.js';
import { getContextSentence } from '../logic.js';

const WORDS = ['mice','rice','fire','bike','pine','five','line','kite','nine','slide'];
const SENTENCES = ['The mice eat cheese.','I eat rice with my lunch.','The fire keeps us warm.','I ride my bike in the park.','The pine tree is tall.','I have five pencils.','Draw a straight line.','My kite flies in the sky.','There are nine stars.','I go down the slide.'];

test('30 October adds the exact photographed vocabulary, date and independent progress', () => {
  const lesson = getLesson('?list=2026-10-30');
  assert.ok(lesson, '30 October list must be selectable');
  assert.equal(lesson.date, 'Viernes 30 de octubre de 2026');
  assert.equal(lesson.shortDate, '30/10/2026');
  assert.deepEqual(lesson.words.map(w => w.word), WORDS);
  assert.deepEqual(lesson.words.map(w => w.id), WORDS);
  assert.deepEqual(lesson.words.map(getContextSentence), SENTENCES);
  assert.deepEqual(lesson.patterns, ['i…e']);
  assert.ok(lesson.words.every(w => w.pattern === 'i…e'));
  assert.equal(lesson.storageKey, 'spelling-ea-ee:list:2026-10-30:v1');
  assert.equal(new Set(LESSONS.map(x => x.storageKey)).size, LESSONS.length);
  assert.equal(getLessonHref(lesson), './?list=2026-10-30');
  assert.deepEqual(LESSONS.map(x => x.id), ['2026-09-25','2026-10-02','2026-10-16','2026-10-19','2026-10-30']);
  assert.equal(ALL_WORDS.length, 50);
  assert.ok(Object.isFrozen(lesson) && Object.isFrozen(lesson.words));
  assert.ok(lesson.words.every(Object.isFrozen));
});
