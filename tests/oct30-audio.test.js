import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { getSpellingCues, getSpellingCueIndex } from '../spelling-timings.js';

// Frozen confirmed 30 October source; independent of pending curriculum integration.
const confirmed = [
  [
    "mice",
    "The mice eat cheese."
  ],
  [
    "rice",
    "I eat rice with my lunch."
  ],
  [
    "fire",
    "The fire keeps us warm."
  ],
  [
    "bike",
    "I ride my bike in the park."
  ],
  [
    "pine",
    "The pine tree is tall."
  ],
  [
    "five",
    "I have five pencils."
  ],
  [
    "line",
    "Draw a straight line."
  ],
  [
    "kite",
    "My kite flies in the sky."
  ],
  [
    "nine",
    "There are nine stars."
  ],
  [
    "slide",
    "I go down the slide."
  ]
];
const retained = ["alphabet", "between", "cheese", "chess", "child", "chops", "cried", "dolphin", "dry", "easy", "elephant", "family", "fly", "friends", "frighten", "heel", "jeans", "lied", "light", "meat", "night", "peanuts", "people", "pharmacy", "photograph", "reach", "read", "shells", "shoes", "shops", "shorts", "sky", "street", "sweets", "telephone", "tied-up", "tights", "trophy", "you", "your"];

test('30 October audio contains every confirmed clip, PCM-derived cue and exact sentence', () => {
  const provenance = readFileSync(new URL('../audio/README.md', import.meta.url), 'utf8');
  for (const [id, sentence] of confirmed) {
    for (const directory of ['en-gb-v1', 'spelling-en-gb-v1']) {
      const file = new URL(`../audio/${directory}/${id}.mp3`, import.meta.url);
      assert.ok(existsSync(file), `Missing 30 October asset: audio/${directory}/${id}.mp3`);
      const bytes = readFileSync(file);
      assert.ok(bytes.length > 10000, `${id}: nonempty MP3`);
      assert.ok(bytes.subarray(0, 3).toString() === 'ID3' || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0), `${id}: MP3 signature`);
    }
    const item = { id, word: id };
    const cue = getSpellingCues(item);
    assert.equal(cue.letters.length, id.length, `${id}: one cue per letter`);
    assert.ok(Object.isFrozen(cue) && Object.isFrozen(cue.letters));
    assert.equal(cue.letters[0], 0);
    cue.letters.forEach((at, index) => {
      assert.ok(Number.isFinite(at) && at >= 0);
      assert.ok(Math.abs(at * 24000 - Math.round(at * 24000)) < .02, `${id}: PCM sample grid`);
      if (index) assert.ok(at - cue.letters[index - 1] > .55);
      assert.equal(getSpellingCueIndex(item, at), index);
    });
    assert.ok(cue.lastLetterEndAt > cue.letters.at(-1));
    assert.equal(cue.pauseBeforeWord, 1.25);
    assert.ok(Math.abs(cue.wordAt - cue.lastLetterEndAt - 1.25) < .000002);
    for (const at of [cue.lastLetterEndAt, cue.lastLetterEndAt + .6, cue.wordAt]) {
      assert.equal(getSpellingCueIndex(item, at), -1, `${id}: quiet pre-word highlight`);
    }
    assert.ok(provenance.includes(`| ${id} | ${sentence} |`), `${id}: exact confirmed sentence`);
  }
  for (const directory of ['en-gb-v1', 'spelling-en-gb-v1']) {
    const actual = readdirSync(new URL(`../audio/${directory}/`, import.meta.url)).filter(name => name.endsWith('.mp3')).sort();
    const expected = [...retained, ...confirmed.map(([id]) => id)].map(id => `${id}.mp3`).sort();
    assert.deepEqual(actual, expected, `${directory}: retained plus new inventory only`);
  }
});
