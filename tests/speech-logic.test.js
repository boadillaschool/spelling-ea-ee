import test from 'node:test';
import assert from 'node:assert/strict';

import { WORDS } from '../data.js';
import { getContextSentence, getSpeechText, getSpellingText, selectEnglishVoice } from '../logic.js';

const voice = (lang, name = lang) => ({ lang, name });

test('selectEnglishVoice prefers an exact en-GB voice', () => {
  const gb = voice('en-GB', 'UK');
  assert.equal(selectEnglishVoice([voice('en-US'), gb, voice('en-AU')]), gb);
});

test('selectEnglishVoice accepts Android-style en_GB and lowercase tags', () => {
  const underscore = voice('en_GB');
  const lower = voice('en-gb');
  assert.equal(selectEnglishVoice([voice('en-US'), underscore]), underscore);
  assert.equal(selectEnglishVoice([voice('es-ES'), lower]), lower);
});

test('selectEnglishVoice falls back to the first English voice', () => {
  const us = voice('en-US');
  assert.equal(selectEnglishVoice([voice('es-ES'), us, voice('en-AU')]), us);
  const bare = voice('en');
  assert.equal(selectEnglishVoice([voice('fr-FR'), bare]), bare);
});

test('selectEnglishVoice does not treat other languages that merely start with en as English', () => {
  assert.equal(selectEnglishVoice([voice('enm-XX'), voice('es-ES')]), null);
});

test('selectEnglishVoice returns null when nothing usable is available', () => {
  assert.equal(selectEnglishVoice([]), null);
  assert.equal(selectEnglishVoice([voice('es-ES')]), null);
  assert.equal(selectEnglishVoice(null), null);
  assert.equal(selectEnglishVoice(undefined), null);
  assert.equal(selectEnglishVoice([null, {}, { lang: 5 }]), null);
});

test('selectEnglishVoice accepts array-like voice lists', () => {
  const gb = voice('en-GB');
  assert.equal(selectEnglishVoice({ 0: voice('en-US'), 1: gb, length: 2 }), gb);
});

test('getContextSentence keeps the data sentence except for read', () => {
  for (const item of WORDS.filter(({ id }) => id !== 'read')) {
    assert.equal(getContextSentence(item), item.sentence);
  }
  assert.equal(getContextSentence(WORDS.find(({ id }) => id === 'read')), 'I read every day.');
});

test('getSpeechText says word, sentence, word for unambiguous words', () => {
  const meat = WORDS.find(({ id }) => id === 'meat');
  assert.equal(getSpeechText(meat), 'meat. We eat meat for lunch. meat.');
});

test('getSpeechText forces present-tense read with an imperative and habitual context', () => {
  const read = WORDS.find(({ id }) => id === 'read');
  assert.equal(getSpeechText(read), 'Read. I read every day.');
  assert.doesNotMatch(getSpeechText(read), /every night/);
});

test('getSpeechText is defined for every word and contains its sentence', () => {
  for (const item of WORDS) {
    assert.ok(getSpeechText(item).includes(getContextSentence(item)), item.id);
  }
});

test('getSpellingText names every letter separately before repeating the word', () => {
  const easy = WORDS.find(({ id }) => id === 'easy');
  const read = WORDS.find(({ id }) => id === 'read');

  assert.equal(getSpellingText(easy), 'E. A. S. Y. Easy.');
  assert.equal(getSpellingText(read), 'R. E. A. D. Read.');
  for (const item of WORDS) {
    const spokenLetters = item.word.toUpperCase().split('').map((letter) => `${letter}.`).join(' ');
    assert.equal(getSpellingText(item), `${spokenLetters} ${item.word[0].toUpperCase()}${item.word.slice(1)}.`);
  }
});
