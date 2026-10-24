import test from 'node:test';
import assert from 'node:assert/strict';
import * as logic from '../logic.js';

test('split i…e highlights separated letters, never the consonant between them', () => {
  assert.equal(typeof logic.getHighlightedParts, 'function');
  for (const word of ['mice','rice','fire','bike','pine','five','line','kite','nine','slide']) {
    const parts = logic.getHighlightedParts(word, 'i…e');
    assert.equal(parts.map(p => p.text).join(''), word);
    assert.deepEqual(parts.filter(p => p.highlighted).map(p => p.text), ['i','e']);
    assert.deepEqual(parts.filter(p => !p.highlighted).map(p => p.text), [word.slice(0, -3), word.at(-2)]);
    assert.deepEqual(logic.describeHighlightedWord({word, pattern:'i…e'}), {word, letters:'i-e', text:`${word}; letras resaltadas: i-e`});
  }
  for (const word of ['piece','pineapple','pie']) {
    assert.deepEqual(logic.getHighlightedParts(word, 'i…e'), [{text:word, highlighted:false}]);
  }
});

test('contiguous patterns retain every occurrence and exceptions remain whole', () => {
  assert.equal(typeof logic.getHighlightedParts, 'function');
  const parts = logic.getHighlightedParts('photograph', 'ph');
  assert.deepEqual(parts.filter(p => p.highlighted).map(p => p.text), ['ph','ph']);
  assert.equal(parts.map(p => p.text).join(''), 'photograph');
  assert.deepEqual(logic.getHighlightedParts('people',''), [{text:'people',highlighted:false}]);
});
