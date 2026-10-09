import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { getLesson } from '../lessons.js';
import { getContextSentence, getSpeechText, getSpellingText } from '../logic.js';
import { getSpellingCues, getSpellingCueIndex } from '../spelling-timings.js';
import { createSpeaker } from '../speech.js';

test('all 16 October spellings have authored letter cues with a quiet pre-word pause', () => {
  for (const item of getLesson('?list=2026-10-16').words) {
    const cues = getSpellingCues(item);
    assert.equal(cues.letters.length, item.word.length, item.id);
    assert.ok(Object.isFrozen(cues) && Object.isFrozen(cues.letters));
    assert.equal(cues.letters[0], 0);
    assert.ok(cues.letters.every((value, i, list) => Number.isFinite(value) && value >= 0 && (!i || value - list[i - 1] > .55)));
    assert.ok(cues.lastLetterEndAt > cues.letters.at(-1));
    assert.equal(cues.pauseBeforeWord, 1.25);
    assert.ok(Math.abs(cues.wordAt - cues.lastLetterEndAt - 1.25) < .001);
    cues.letters.forEach((at, i) => assert.equal(getSpellingCueIndex(item, at), i));
    assert.equal(getSpellingCueIndex(item, cues.lastLetterEndAt - .01), item.word.length - 1);
    for (const at of [cues.lastLetterEndAt, cues.lastLetterEndAt + .6, cues.wordAt]) assert.equal(getSpellingCueIndex(item, at), -1);
  }
});

test('new prompts select only their same-origin pronunciation and spelling clips', () => {
  const played = [];
  class Media {
    constructor(src) { this.src = src; }
    play() { played.push(this.src); return Promise.resolve(); }
    pause() {}
  }
  const speaker = createSpeaker({ AudioCtor:Media });
  for (const item of getLesson('?list=2026-10-16').words) {
    speaker.speak(getSpeechText(item));
    speaker.speak(getSpellingText(item));
    assert.deepEqual(played.splice(0), [`audio/en-gb-v1/${item.id}.mp3`, `audio/spelling-en-gb-v1/${item.id}.mp3`]);
  }
});

test('new recording provenance documents the exact displayed example sentences', () => {
  const provenance = readFileSync(new URL('../audio/README.md', import.meta.url), 'utf8');
  for (const item of getLesson('?list=2026-10-16').words) assert.ok(provenance.includes(`| ${item.id} | ${getContextSentence(item)} |`), item.id);
});
