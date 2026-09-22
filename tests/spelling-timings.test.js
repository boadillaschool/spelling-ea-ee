import test from 'node:test';
import assert from 'node:assert/strict';

import { WORDS } from '../data.js';
import { getSpellingCueIndex, getSpellingCues } from '../spelling-timings.js';

test('each spelling clip exposes one ordered cue per displayed letter and a final-word cue', () => {
  for (const item of WORDS) {
    const cues = getSpellingCues(item);
    assert.equal(cues.letters.length, item.word.length, item.id);
    assert.equal(cues.letters[0], 0, `${item.id} starts by highlighting its first letter`);
    assert.ok(cues.letters.every((value, index, list) => Number.isFinite(value) && value >= 0 && (index === 0 || value > list[index - 1])), item.id);
    assert.ok(cues.letters.slice(1).every((value, index) => value - cues.letters[index] >= 0.85), `${item.id} needs deliberate spacing between letter starts`);
    assert.ok(cues.wordAt > cues.letters.at(-1), item.id);
    assert.ok(cues.pauseBeforeWord >= 1.1, `${item.id} needs a clearly audible pause before the final word`);
    assert.ok(Math.abs(cues.wordAt - cues.lastLetterEndAt - cues.pauseBeforeWord) < 0.001, `${item.id} authored pause must match the clip timeline`);
    assert.ok(cues.wordAt - cues.letters.at(-1) > cues.pauseBeforeWord, `${item.id} pause starts only after the final letter is spoken`);
  }
});

test('cue lookup highlights letters in sequence and clears for the final whole word', () => {
  const easy = WORDS.find(({ id }) => id === 'easy');
  const cues = getSpellingCues(easy);
  assert.equal(getSpellingCueIndex(easy, -1), -1);
  assert.equal(getSpellingCueIndex(easy, 0), 0);
  assert.equal(getSpellingCueIndex(easy, cues.letters[2] + 0.01), 2);
  assert.equal(getSpellingCueIndex(easy, cues.lastLetterEndAt - 0.01), 3);
  assert.equal(getSpellingCueIndex(easy, cues.lastLetterEndAt), -1, 'the final letter stops glowing during the pause');
  assert.equal(getSpellingCueIndex(easy, cues.wordAt), -1);
  assert.equal(getSpellingCueIndex(easy, Number.NaN), -1);
});
