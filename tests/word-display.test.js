import test from 'node:test';
import assert from 'node:assert/strict';

import { WORDS } from '../data.js';
import { describeHighlightedWord } from '../logic.js';
import { getAudioLabel } from '../ui-helpers.js';

const byId = (id) => WORDS.find((item) => item.id === id);

test('describeHighlightedWord gives the full word plus the highlighted letters, spelled out', () => {
  assert.deepEqual(describeHighlightedWord(byId('street')), {
    word: 'street',
    letters: 'e-e',
    text: 'street; letras resaltadas: e-e',
  });
  assert.equal(describeHighlightedWord(byId('peanuts')).text, 'peanuts; letras resaltadas: e-a');
});

test('describeHighlightedWord keeps the whole English word, with no fake syllable separators', () => {
  for (const item of WORDS) {
    const { word, text } = describeHighlightedWord(item);
    assert.equal(word, item.word);
    assert.doesNotMatch(text, /[·•.]/);
    assert.match(text, new RegExp(`^${item.word}; letras resaltadas: ${item.pattern[0]}-${item.pattern[1]}$`));
  }
});

test('describeHighlightedWord does not invent highlighted letters when the pattern is missing', () => {
  assert.deepEqual(describeHighlightedWord({ word: 'cat', pattern: 'ea' }), { word: 'cat', letters: '', text: 'cat' });
});

test('the ea and ee families read the same way: only the letters differ', () => {
  assert.equal(describeHighlightedWord(byId('read')).text, 'read; letras resaltadas: e-a');
  assert.equal(describeHighlightedWord(byId('heel')).text, 'heel; letras resaltadas: e-e');
});

test('getAudioLabel offers Escuchar palabra first, then Escuchar otra vez, and a quiet playing state', () => {
  assert.equal(getAudioLabel({ speaking: false, played: false }), 'Escuchar palabra');
  assert.equal(getAudioLabel({ speaking: false, played: true }), 'Escuchar otra vez');
  assert.equal(getAudioLabel({ speaking: true, played: false }), 'Reproduciendo…');
  assert.equal(getAudioLabel({ speaking: true, played: true }), 'Reproduciendo…');
});
