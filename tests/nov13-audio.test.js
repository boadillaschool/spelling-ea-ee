import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { getSpellingCues, getSpellingCueIndex } from '../spelling-timings.js';

// Frozen user-confirmed 13 November source, independent of curriculum integration.
const confirmed = [
  {
    "id": "rat",
    "word": "rat",
    "sentence": "The rat has a long tail."
  },
  {
    "id": "gate",
    "word": "gate",
    "sentence": "Please close the garden gate."
  },
  {
    "id": "bed",
    "word": "bed",
    "sentence": "My bed is soft and warm."
  },
  {
    "id": "beads",
    "word": "beads",
    "sentence": "The beads are on a string."
  },
  {
    "id": "pin",
    "word": "pin",
    "sentence": "The pin has a round head."
  },
  {
    "id": "socks",
    "word": "socks",
    "sentence": "I put on my socks."
  },
  {
    "id": "soak",
    "word": "soak",
    "sentence": "I soak the cloth in water."
  }
];
const retained = ["alphabet", "because", "between", "bike", "bone", "came", "cheese", "chess", "child", "chops", "cried", "cube", "dolphin", "dry", "easy", "elephant", "family", "fire", "five", "fly", "friends", "frighten", "heel", "home", "jeans", "kite", "lied", "light", "line", "meat", "mice", "mistake", "mule", "night", "nine", "peanuts", "people", "pharmacy", "phone", "photograph", "pine", "reach", "read", "rice", "shells", "shoes", "shops", "shorts", "should", "sky", "slide", "smoke", "street", "sweets", "telephone", "tied-up", "tights", "trophy", "tune", "wake-up", "you", "your"];
const reusedHashes = {
  "audio/en-gb-v1/pine.mp3": "c5cd65e9eeb3b0cd7bb85a0a319d28a2bfd7753917779989fc068c3ec0d0212d",
  "audio/en-gb-v1/you.mp3": "281e19c97b84221ac029738a63531ad72625f628dfcdb6f48145db02849e5703",
  "audio/en-gb-v1/your.mp3": "91dd3c9b193a0e0f5c4a6d2a8f4d2dbaa97b86d8c3a628b5bda0ced30d80ac38",
  "audio/spelling-en-gb-v1/pine.mp3": "7999e484c87933240fe0d338ea4994a04f5435dbe519549fa482fc53da9bddea",
  "audio/spelling-en-gb-v1/you.mp3": "849419cc24e176c575495a7703377bc31bafa59715b8cde5496805509f06f5e5",
  "audio/spelling-en-gb-v1/your.mp3": "a7589abe022922d121e3c10f645ef7ffa8eafbf825b1dc8a6fd9b5442b452de2"
};

// This is intentionally exact; future lessons must explicitly extend the inventory.
test('13 November contains the fourteen new pronunciation and spelling MP3s', () => {
  for (const { id } of confirmed) {
    for (const directory of ['en-gb-v1', 'spelling-en-gb-v1']) {
      const file = new URL(`../audio/${directory}/${id}.mp3`, import.meta.url);
      assert.ok(existsSync(file), `Missing 13 November asset: audio/${directory}/${id}.mp3`);
      const bytes = readFileSync(file);
      assert.ok(bytes.length > 10000, `${id}: nonempty MP3`);
      assert.ok(bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0, `${id}: untagged MP3 signature`);
      assert.notEqual(bytes.subarray(-128, -125).toString(), 'TAG', `${id}: no ID3v1 tag`);
    }
  }
});

test('13 November spelling cues follow actual PCM samples with a quiet pre-word interval', () => {
  for (const item of confirmed) {
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
      assert.equal(getSpellingCueIndex(item, at), -1, `${item.id}: quiet pre-word highlight`);
    }
  }
});

test('13 November provenance retains the exact confirmed sentences and voice profile', () => {
  const provenance = readFileSync(new URL('../audio/README.md', import.meta.url), 'utf8');
  assert.ok(provenance.includes('## Weekly audio — 13/11/2026'));
  for (const { id, sentence } of confirmed) {
    assert.ok(provenance.includes(`| ${id} | ${sentence} |`), `${id}: exact confirmed sentence`);
  }
  assert.ok(provenance.includes('en-GB-SoniaNeural'));
});

test('13 November directories contain exactly the retained plus seven new IDs', () => {
  const expected = [...retained, ...confirmed.map(({ id }) => id)].map(id => `${id}.mp3`).sort();
  assert.equal(new Set(expected).size, expected.length, 'no duplicate existing asset IDs');
  for (const directory of ['en-gb-v1', 'spelling-en-gb-v1']) {
    const actual = readdirSync(new URL(`../audio/${directory}/`, import.meta.url)).sort();
    assert.deepEqual(actual, expected, `${directory}: exact retained plus new inventory`);
  }
});

test('13 November reuses pine, you and your without changing any audio bytes', () => {
  for (const [path, expected] of Object.entries(reusedHashes)) {
    const actual = createHash('sha256').update(readFileSync(new URL(`../${path}`, import.meta.url))).digest('hex');
    assert.equal(actual, expected, `${path}: preserved baseline recording`);
  }
});
