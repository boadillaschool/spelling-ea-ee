import test from 'node:test';
import assert from 'node:assert/strict';

import {
  advanceLearn,
  advancePractice,
  createLearnState,
  createPracticeState,
  isBlankAnswer,
  splitByPattern,
} from '../logic.js';

const answer = (correct) => ({ type: 'answer', correct });

function run(state, advance, events) {
  return events.reduce((current, event) => advance(current, event), state);
}

test('isBlankAnswer treats empty, whitespace-only and non-string answers as blank', () => {
  assert.equal(isBlankAnswer(''), true);
  assert.equal(isBlankAnswer('   \t '), true);
  assert.equal(isBlankAnswer(undefined), true);
  assert.equal(isBlankAnswer(null), true);
  assert.equal(isBlankAnswer('ea'), false);
});

test('splitByPattern separates the first pattern occurrence', () => {
  assert.deepEqual(splitByPattern('peanuts', 'ea'), { before: 'p', pattern: 'ea', after: 'nuts' });
  assert.deepEqual(splitByPattern('easy', 'ea'), { before: '', pattern: 'ea', after: 'sy' });
  assert.deepEqual(splitByPattern('between', 'ee'), { before: 'betw', pattern: 'ee', after: 'n' });
  assert.deepEqual(splitByPattern('street', 'ee'), { before: 'str', pattern: 'ee', after: 't' });
});

test('splitByPattern leaves the word intact when the pattern is missing', () => {
  assert.deepEqual(splitByPattern('cat', 'ea'), { before: 'cat', pattern: '', after: '' });
});

test('practice starts with an independent first try and no errors', () => {
  assert.deepEqual(createPracticeState(), { phase: 'first', errors: 0 });
});

test('practice: a correct first try finishes cleanly', () => {
  const state = advancePractice(createPracticeState(), answer(true));
  assert.deepEqual(state, { phase: 'done', errors: 0 });
});

test('practice: first error allows a retry, and success afterwards is not clean', () => {
  const retry = advancePractice(createPracticeState(), answer(false));
  assert.deepEqual(retry, { phase: 'retry', errors: 1 });
  assert.deepEqual(advancePractice(retry, answer(true)), { phase: 'done', errors: 1 });
});

test('practice: second error reveals the spelling instead of allowing more guesses', () => {
  const state = run(createPracticeState(), advancePractice, [answer(false), answer(false)]);
  assert.deepEqual(state, { phase: 'reveal', errors: 2 });
});

test('practice: the reveal must be hidden before one successful retrieval', () => {
  const revealed = run(createPracticeState(), advancePractice, [answer(false), answer(false)]);
  const ignoredAnswer = advancePractice(revealed, answer(true));
  assert.deepEqual(ignoredAnswer, revealed);

  const retrieve = advancePractice(revealed, { type: 'hide' });
  assert.deepEqual(retrieve, { phase: 'retrieve', errors: 2 });
  assert.deepEqual(advancePractice(retrieve, answer(true)), { phase: 'done', errors: 2 });
});

test('practice: a failed retrieval returns to the reveal and never finishes', () => {
  const state = run(createPracticeState(), advancePractice, [
    answer(false),
    answer(false),
    { type: 'hide' },
    answer(false),
  ]);
  assert.deepEqual(state, { phase: 'reveal', errors: 3 });
});

test('practice ignores unknown events and finished states, and never mutates input', () => {
  const start = Object.freeze(createPracticeState());
  assert.deepEqual(advancePractice(start, { type: 'nope' }), start);
  assert.deepEqual(advancePractice(start, { type: 'hide' }), start);
  const done = Object.freeze({ phase: 'done', errors: 0 });
  assert.deepEqual(advancePractice(done, answer(false)), done);
});

test('learn starts by listening with the spelling hidden', () => {
  assert.deepEqual(createLearnState(), { phase: 'listen', familyKnown: false, misses: 0 });
});

test('learn: listen, reveal, identify the family, hide, then retrieve once', () => {
  const state = run(createLearnState(), advanceLearn, [
    { type: 'reveal' },
    { type: 'family', correct: true },
    { type: 'hide' },
    answer(true),
  ]);
  assert.deepEqual(state, { phase: 'done', familyKnown: true, misses: 0 });
});

test('learn: the spelling cannot be hidden before the family is identified', () => {
  const revealed = advanceLearn(createLearnState(), { type: 'reveal' });
  assert.deepEqual(revealed, { phase: 'reveal', familyKnown: false, misses: 0 });
  assert.deepEqual(advanceLearn(revealed, { type: 'hide' }), revealed);
  assert.deepEqual(advanceLearn(revealed, { type: 'family', correct: false }), revealed);
});

test('learn: a failed retrieval shows the spelling again without repeating the family step', () => {
  const state = run(createLearnState(), advanceLearn, [
    { type: 'reveal' },
    { type: 'family', correct: true },
    { type: 'hide' },
    answer(false),
  ]);
  assert.deepEqual(state, { phase: 'reveal', familyKnown: true, misses: 1 });
  assert.deepEqual(advanceLearn(state, { type: 'hide' }).phase, 'retrieve');
});

test('learn ignores out-of-order events and never mutates input', () => {
  const start = Object.freeze(createLearnState());
  assert.deepEqual(advanceLearn(start, { type: 'hide' }), start);
  assert.deepEqual(advanceLearn(start, answer(true)), start);
  assert.deepEqual(advanceLearn(start, { type: 'nope' }), start);
});
