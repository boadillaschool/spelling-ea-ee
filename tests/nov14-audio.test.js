import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { getSpellingCues, getSpellingCueIndex } from '../spelling-timings.js';

// Frozen approved source; independent of the integrating curriculum registry.
const confirmed = [
  { id: 'skirt', word: 'skirt', sentence: 'She wears a blue skirt.' },
  { id: 'bird', word: 'bird', sentence: 'The bird is singing in the tree.' },
  { id: 'first', word: 'first', sentence: 'I am first in the line.' },
  { id: 'birthday', word: 'birthday', sentence: 'Today is my birthday.' },
  { id: 'thirsty', word: 'thirsty', sentence: 'I am thirsty after playing.' },
  { id: 'shirt', word: 'shirt', sentence: 'My shirt has three buttons.' },
  { id: 'thirteen', word: 'thirteen', sentence: 'There are thirteen stars.' },
  { id: 'dirty', word: 'dirty', sentence: 'My boots are dirty.' },
  { id: 'said', word: 'said', sentence: 'She said hello to me.' },
  { id: 'one', word: 'one', sentence: 'I have one apple.' },
];
const retained = ['alphabet', 'beads', 'because', 'bed', 'between', 'bike', 'bone', 'came', 'cheese', 'chess', 'child', 'chops', 'cried', 'cube', 'dolphin', 'dry', 'easy', 'elephant', 'family', 'fire', 'five', 'fly', 'friends', 'frighten', 'gate', 'heel', 'home', 'jeans', 'kite', 'lied', 'light', 'line', 'meat', 'mice', 'mistake', 'mule', 'night', 'nine', 'peanuts', 'people', 'pharmacy', 'phone', 'photograph', 'pin', 'pine', 'rat', 'reach', 'read', 'rice', 'shells', 'shoes', 'shops', 'shorts', 'should', 'sky', 'slide', 'smoke', 'soak', 'socks', 'street', 'sweets', 'telephone', 'tied-up', 'tights', 'trophy', 'tune', 'wake-up', 'you', 'your'];
const directories = ['en-gb-v1', 'spelling-en-gb-v1'];

// One end-to-end asset contract: recordings, sample-authored cues, source and preservation.
test('14 November adds exactly the approved British recordings and paced spelling without changing earlier audio', () => {
  for (const item of confirmed) {
    for (const directory of directories) {
      const file = new URL(`../audio/${directory}/${item.id}.mp3`, import.meta.url);
      assert.ok(existsSync(file), `Missing 14 November asset: audio/${directory}/${item.id}.mp3`);
      const bytes = readFileSync(file);
      assert.ok(bytes.length > 10000, `${item.id}: nonempty recording`);
      assert.ok(bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0, `${item.id}: untagged MP3 signature`);
      assert.notEqual(bytes.subarray(-128, -125).toString(), 'TAG', `${item.id}: no ID3v1 tag`);
    }
    const cue = getSpellingCues(item);
    assert.equal(cue.letters.length, item.word.length, `${item.id}: one cue per letter`);
    assert.ok(Object.isFrozen(cue) && Object.isFrozen(cue.letters));
    assert.equal(cue.letters[0], 0);
    for (const at of [...cue.letters, cue.lastLetterEndAt, cue.wordAt]) {
      assert.ok(Number.isFinite(at) && at >= 0);
      assert.ok(Math.abs(at * 24000 - Math.round(at * 24000)) < .02, `${item.id}: PCM sample grid`);
    }
    cue.letters.forEach((at, index) => {
      if (index) assert.ok(at - cue.letters[index - 1] > .55, `${item.id}: letter plus gap`);
      assert.equal(getSpellingCueIndex(item, at), index);
    });
    assert.ok(cue.lastLetterEndAt > cue.letters.at(-1));
    assert.equal(cue.pauseBeforeWord, 1.25);
    assert.ok(Math.abs(cue.wordAt - cue.lastLetterEndAt - 1.25) < .000002);
    assert.equal(getSpellingCueIndex(item, cue.lastLetterEndAt - 1 / 24000), item.word.length - 1);
    for (const at of [cue.lastLetterEndAt, cue.lastLetterEndAt + .6, cue.wordAt]) {
      assert.equal(getSpellingCueIndex(item, at), -1, `${item.id}: no highlighted letter during pre-word silence`);
    }
  }
  const expected = [...retained, ...confirmed.map(({ id }) => id)].map(id => `${id}.mp3`).sort();
  assert.equal(new Set(expected).size, expected.length, 'all approved IDs are new');
  for (const directory of directories) {
    assert.deepEqual(readdirSync(new URL(`../audio/${directory}/`, import.meta.url)).sort(), expected);
  }
  // Hash domain: sorted relative path, NUL, complete MP3 bytes, NUL, for all earlier clips.
  const hash = createHash('sha256');
  const oldPaths = directories.flatMap(directory => retained.map(id => `audio/${directory}/${id}.mp3`)).sort();
  for (const path of oldPaths) hash.update(path).update('\0').update(readFileSync(new URL(`../${path}`, import.meta.url))).update('\0');
  assert.equal(hash.digest('hex'), 'c9f4d05b48aafb0fe7c9d76fc33576c1c1316a73252753a059e1cf80cadb6eb3', 'all 138 earlier MP3s are byte-identical');

  const provenance = readFileSync(new URL('../audio/README.md', import.meta.url), 'utf8');
  const addition = provenance.split('## Weekly audio — 14/11/2026')[1];
  assert.ok(addition, 'new provenance section');
  for (const { id, sentence } of confirmed) {
    assert.ok(addition.includes(`| ${id} | ${sentence} |`), `${id}: exact approved example sentence`);
  }
  for (const profile of ['en-GB-SoniaNeural', '-25%', '-35%', '-10%', '-20%', '0.70 s', '0.85 s', '0.55 s', '1.25 s', '24 kHz', '96 kbps']) {
    assert.ok(addition.includes(profile), `documented generation profile: ${profile}`);
  }
});
