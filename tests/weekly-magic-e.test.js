import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { LESSONS, ALL_WORDS, getLesson, getLessonHref } from '../lessons.js';
import { getContextSentence, getHighlightedParts, describeHighlightedWord, getSpellingText } from '../logic.js';
import { getSpellingCues, getSpellingCueIndex } from '../spelling-timings.js';

const WORDS = ['smoke','home','bone','phone','mule','cube','tune','wake up','came','mistake','because','should'];
const IDS = ['smoke','home','bone','phone','mule','cube','tune','wake-up','came','mistake','because','should'];
const PATTERNS = ['o…e','o…e','o…e','o…e','u…e','u…e','u…e','a…e','a…e','a…e','',''];

test('6 November adds the twelve photographed words, date and independent progress', () => {
  const lesson = getLesson('?list=2026-11-06');
  assert.ok(lesson, '6 November list must be selectable');
  assert.equal(lesson.date, 'Viernes 6 de noviembre de 2026');
  assert.equal(lesson.shortDate, '06/11/2026');
  assert.deepEqual(lesson.words.map(w => w.word), WORDS);
  assert.deepEqual(lesson.words.map(w => w.id), IDS);
  assert.deepEqual(lesson.words.map(w => w.pattern), PATTERNS);
  assert.deepEqual(lesson.patterns, ['o…e', 'u…e', 'a…e']);
  assert.ok(lesson.words.every(w => getContextSentence(w).toLowerCase().includes(w.word)));
  assert.equal(lesson.storageKey, 'spelling-ea-ee:list:2026-11-06:v1');
  assert.equal(new Set(LESSONS.map(x => x.storageKey)).size, LESSONS.length);
  assert.equal(new Set(ALL_WORDS.map(x => x.id)).size, ALL_WORDS.length);
  assert.equal(getLessonHref(lesson), './?list=2026-11-06');
  assert.equal(LESSONS.find(l => l.id === '2026-11-06'), lesson);
  assert.ok(Object.isFrozen(lesson) && Object.isFrozen(lesson.words));
  assert.ok(lesson.words.every(Object.isFrozen));
});

test('magic e highlights the vowel and the final e, never the consonant between them', () => {
  for (const [word, pattern, before, vowel, consonant, after] of [
    ['smoke', 'o…e', 'sm', 'o', 'k', ''],
    ['phone', 'o…e', 'ph', 'o', 'n', ''],
    ['cube', 'u…e', 'c', 'u', 'b', ''],
    ['mistake', 'a…e', 'mist', 'a', 'k', ''],
    ['wake up', 'a…e', 'w', 'a', 'k', ' up'],
  ]) {
    const parts = getHighlightedParts(word, pattern);
    assert.equal(parts.map(p => p.text).join(''), word);
    assert.deepEqual(parts.filter(p => p.highlighted).map(p => p.text), [vowel, 'e']);
    assert.deepEqual(parts.filter(p => !p.highlighted).map(p => p.text), [before, consonant, after].filter(Boolean));
    assert.equal(describeHighlightedWord({ word, pattern }).letters, `${vowel}-e`);
  }
  assert.deepEqual(getHighlightedParts('because', ''), [{ text: 'because', highlighted: false }]);
  assert.deepEqual(getHighlightedParts('home', 'u…e'), [{ text: 'home', highlighted: false }]);
});

test('6 November ships both clips and one PCM-grid cue per spoken letter', () => {
  const provenance = readFileSync(new URL('../audio/README.md', import.meta.url), 'utf8');
  for (const item of getLesson('?list=2026-11-06').words) {
    for (const directory of ['en-gb-v1', 'spelling-en-gb-v1']) {
      const file = new URL(`../audio/${directory}/${item.id}.mp3`, import.meta.url);
      assert.ok(existsSync(file), `Missing audio/${directory}/${item.id}.mp3`);
      assert.ok(readFileSync(file).length > 10000);
    }
    const cue = getSpellingCues(item);
    assert.equal(cue.letters.length, item.word.length, `${item.id}: one cue per letter or space`);
    assert.equal(cue.letters[0], 0);
    cue.letters.forEach((at, index) => {
      assert.ok(Math.abs(at * 24000 - Math.round(at * 24000)) < .02, `${item.id}: PCM sample grid`);
      if (index) assert.ok(at - cue.letters[index - 1] > .55);
      assert.equal(getSpellingCueIndex(item, at), index);
    });
    assert.equal(cue.pauseBeforeWord, 1.25);
    assert.ok(Math.abs(cue.wordAt - cue.lastLetterEndAt - 1.25) < .000002);
    assert.ok(provenance.includes(`| ${item.id} | ${item.sentence} |`), `${item.id}: documented sentence`);
  }
  assert.equal(getSpellingText({ word: 'wake up' }), 'W. A. K. E. Space. U. P. Wake up.');
});
