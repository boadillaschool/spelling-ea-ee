import test from 'node:test';
import assert from 'node:assert/strict';

import { WORDS } from '../data.js';
import {
  clearAudioFailure,
  createAudioFailure,
  markAudioFailure,
  scoreMock,
  shouldShowSpanishCue,
  shuffleWords,
} from '../logic.js';

const ids = (list) => list.map(({ id }) => id);

test('shuffleWords returns every word exactly once without mutating the input', () => {
  const input = [...WORDS];
  const shuffled = shuffleWords(input, () => 0.42);

  assert.deepEqual(ids(input), ids(WORDS));
  assert.equal(shuffled.length, 10);
  assert.deepEqual(ids(shuffled).sort(), ids(WORDS).sort());
  assert.notEqual(shuffled, input);
});

test('shuffleWords is a deterministic Fisher-Yates driven by the injected RNG', () => {
  const abc = ['a', 'b', 'c', 'd'].map((id) => ({ id }));

  assert.deepEqual(ids(shuffleWords(abc, () => 0)), ['b', 'c', 'd', 'a']);
  assert.deepEqual(ids(shuffleWords(abc, () => 0.999999)), ['a', 'b', 'c', 'd']);
  assert.deepEqual(ids(shuffleWords(abc, () => 0.5)), ids(shuffleWords(abc, () => 0.5)));
});

test('shuffleWords handles empty and single-word lists', () => {
  assert.deepEqual(shuffleWords([], () => 0.5), []);
  assert.deepEqual(ids(shuffleWords([{ id: 'x' }], () => 0.5)), ['x']);
});

test('scoreMock counts only complete correct spellings, ignoring case and spaces', () => {
  const words = WORDS.slice(0, 3);
  const result = scoreMock(words, { easy: ' EASY ', meat: 'met', peanuts: 'peanuts' });

  assert.equal(result.score, 2);
  assert.equal(result.total, 3);
  assert.deepEqual(result.missedIds, ['meat']);
  assert.deepEqual(result.blankIds, []);
  assert.deepEqual(result.results, [
    { id: 'easy', answered: true, correct: true },
    { id: 'meat', answered: true, correct: false },
    { id: 'peanuts', answered: true, correct: true },
  ]);
});

test('scoreMock treats missing and blank answers as missed but flags them as blank', () => {
  const words = WORDS.slice(0, 3);
  const result = scoreMock(words, { easy: '   ', meat: undefined });

  assert.equal(result.score, 0);
  assert.deepEqual(result.missedIds, ['easy', 'meat', 'peanuts']);
  assert.deepEqual(result.blankIds, ['easy', 'meat', 'peanuts']);
  assert.equal(result.results.every(({ answered }) => answered === false), true);
});

test('scoreMock tolerates null, non-string answers and unknown keys', () => {
  const words = WORDS.slice(0, 2);
  assert.doesNotThrow(() => scoreMock(words, null));
  const result = scoreMock(words, { easy: 5, meat: 'meat', other: 'x' });
  assert.equal(result.score, 1);
  assert.deepEqual(result.missedIds, ['easy']);
  assert.deepEqual(result.blankIds, ['easy']);
});

test('scoreMock reports a perfect ten out of ten', () => {
  const answers = Object.fromEntries(WORDS.map(({ id, word }) => [id, word]));
  const result = scoreMock(WORDS, answers);
  assert.equal(result.score, 10);
  assert.equal(result.total, 10);
  assert.deepEqual(result.missedIds, []);
});

test('mock shows the Spanish cue only when speech is unsupported or audio failed for the current prompt', () => {
  const none = createAudioFailure();

  assert.equal(shouldShowSpanishCue({ supported: false, failure: none, promptId: 'easy' }), true);
  assert.equal(shouldShowSpanishCue({ supported: true, failure: none, promptId: 'easy' }), false);

  const failed = markAudioFailure(none, 'easy');
  assert.equal(shouldShowSpanishCue({ supported: true, failure: failed, promptId: 'easy' }), true);
});

test('a runtime audio failure belongs to one prompt and is reset when advancing', () => {
  const failed = markAudioFailure(createAudioFailure(), 'easy');

  assert.equal(shouldShowSpanishCue({ supported: true, failure: failed, promptId: 'meat' }), false);
  assert.equal(shouldShowSpanishCue({ supported: true, failure: clearAudioFailure(), promptId: 'easy' }), false);
});

test('markAudioFailure ignores a missing prompt and never mutates the previous state', () => {
  const none = createAudioFailure();

  assert.deepEqual(markAudioFailure(none, null), createAudioFailure());
  markAudioFailure(none, 'easy');
  assert.deepEqual(none, createAudioFailure());
});
