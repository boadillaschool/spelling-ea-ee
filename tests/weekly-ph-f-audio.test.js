import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { getSpellingCues, getSpellingCueIndex } from '../spelling-timings.js';

const WEEKLY = [
  ['dolphin', 'The dolphin jumps out of the water.'],
  ['telephone', 'The telephone is ringing.'],
  ['alphabet', 'I know the letters of the alphabet.'],
  ['trophy', 'Our team won a trophy.'],
  ['photograph', 'This photograph shows a sunny day.'],
  ['elephant', 'The elephant has a long trunk.'],
  ['pharmacy', 'We buy medicine at the pharmacy.'],
  ['family', 'My family eats dinner together.'],
  ['friends', 'My friends play with me.'],
  ['people', 'The people are walking in the park.'],
];
const LEGACY = ['easy', 'meat', 'peanuts', 'between', 'read', 'jeans', 'heel', 'sweets', 'street', 'reach'];

test('02/10/2026 ph/f has the exact twenty new clips, authored spelling cues and source sentences', () => {
  const provenance = readFileSync(new URL('../audio/README.md', import.meta.url), 'utf8');
  for (const [id, sentence] of WEEKLY) {
    for (const folder of ['en-gb-v1', 'spelling-en-gb-v1']) {
      const path = new URL(`../audio/${folder}/${id}.mp3`, import.meta.url);
      assert.ok(existsSync(path), `missing weekly ${folder}/${id}.mp3`);
      const bytes = readFileSync(path);
      assert.ok(bytes.length > 10000, `${id} must contain real audio`);
      assert.ok(bytes.subarray(0, 3).toString() === 'ID3' || (bytes[0] === 255 && (bytes[1] & 224) === 224), `${id} MP3 signature`);
    }
    const item = { id };
    const cues = getSpellingCues(item);
    assert.equal(cues.letters.length, id.length, `${id}: one cue per letter`);
    assert.equal(cues.letters[0], 0);
    assert.ok(Object.isFrozen(cues) && Object.isFrozen(cues.letters));
    assert.ok(cues.letters.every((value, index, list) => Number.isFinite(value) && value >= 0 && (index === 0 || value - list[index - 1] >= 0.85)), id);
    assert.equal(cues.pauseBeforeWord, 1.25);
    assert.ok(cues.lastLetterEndAt > cues.letters.at(-1));
    assert.ok(Math.abs(cues.wordAt - cues.lastLetterEndAt - 1.25) < 0.001);
    cues.letters.forEach((at, index) => assert.equal(getSpellingCueIndex(item, at), index));
    assert.equal(getSpellingCueIndex(item, cues.lastLetterEndAt - 0.01), id.length - 1);
    for (const at of [cues.lastLetterEndAt, cues.lastLetterEndAt + 0.6, cues.wordAt]) {
      assert.equal(getSpellingCueIndex(item, at), -1, `${id}: quiet pre-word interval`);
    }
    assert.ok(provenance.includes(`| ${id} | ${sentence} |`), `${id}: exact source sentence documented`);
  }
  const expected = [...LEGACY, ...WEEKLY.map(([id]) => id)].map(id => `${id}.mp3`).sort();
  for (const folder of ['en-gb-v1', 'spelling-en-gb-v1']) {
    assert.deepEqual(readdirSync(new URL(`../audio/${folder}/`, import.meta.url)).filter(name => name.endsWith('.mp3')).sort(), expected);
  }
});
