import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { getLesson } from '../lessons.js';
import { getContextSentence, getSpeechText, getSpellingText, checkAnswer } from '../logic.js';
import { getSpellingCues, getSpellingCueIndex } from '../spelling-timings.js';
import { createSpeaker } from '../speech.js';
const words = getLesson('?list=2026-10-19').words;

test('long-i clips have ordered cues for every displayed character including the phrase space', () => {
  for (const item of words) {
    const cues = getSpellingCues(item);
    assert.equal(cues.letters.length, item.word.length, item.id);
    assert.ok(Object.isFrozen(cues) && Object.isFrozen(cues.letters));
    assert.equal(cues.letters[0], 0);
    assert.ok(cues.letters.every((v, i, list) => Number.isFinite(v) && v >= 0 && (!i || v - list[i-1] > .55)));
    assert.ok(cues.lastLetterEndAt > cues.letters.at(-1));
    assert.equal(cues.pauseBeforeWord, 1.25);
    assert.ok(Math.abs(cues.wordAt - cues.lastLetterEndAt - 1.25) < .001);
    cues.letters.forEach((at, i) => assert.equal(getSpellingCueIndex(item, at), i));
    for (const at of [cues.lastLetterEndAt, cues.lastLetterEndAt + .6, cues.wordAt]) assert.equal(getSpellingCueIndex(item, at), -1);
  }
});

test('long-i prompts allowlist pronunciation and spelling assets, including tied-up asset ID', () => {
  const played = [];
  class Media { constructor(src) { this.src = src; } play() { played.push(this.src); return Promise.resolve(); } pause() {} }
  const speaker = createSpeaker({ AudioCtor:Media });
  for (const item of words) {
    speaker.speak(getSpeechText(item)); speaker.speak(getSpellingText(item));
    assert.deepEqual(played.splice(0), [`audio/en-gb-v1/${item.id}.mp3`, `audio/spelling-en-gb-v1/${item.id}.mp3`]);
  }
});

test('long-i recording provenance includes all exact example sentences', () => {
  const provenance = readFileSync(new URL('../audio/README.md', import.meta.url), 'utf8');
  for (const item of words) assert.ok(provenance.includes(`| ${item.id} | ${getContextSentence(item)} |`), item.id);
});

test('the phrase keeps a required word boundary without accepting its hyphenated asset ID', () => {
  assert.equal(checkAnswer('tied up', 'tied up'), true);
  assert.equal(checkAnswer(' TIED UP ', 'tied up'), true);
  assert.equal(checkAnswer('tiedup', 'tied up'), false);
  assert.equal(checkAnswer('tied-up', 'tied up'), false);
});
