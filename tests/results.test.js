import test from 'node:test';
import assert from 'node:assert/strict';

import { WORDS } from '../data.js';
import { buildShareText, recommendNextStep } from '../logic.js';

test('recommendNextStep suggests going home when nothing was missed', () => {
  const step = recommendNextStep({ score: 10, total: 10, missedCount: 0 });
  assert.equal(step.mode, 'home');
  assert.match(step.message, /Sin errores/);
});

test('recommendNextStep suggests reviewing when a few words were missed', () => {
  const one = recommendNextStep({ score: 9, total: 10, missedCount: 1 });
  assert.equal(one.mode, 'review');
  assert.match(one.message, /1 palabra\b/);

  const four = recommendNextStep({ score: 6, total: 10, missedCount: 4 });
  assert.equal(four.mode, 'review');
  assert.match(four.message, /4 palabras/);
});

test('recommendNextStep suggests learning again when half or more were missed', () => {
  const step = recommendNextStep({ score: 5, total: 10, missedCount: 5 });
  assert.equal(step.mode, 'learn');
  assert.match(step.message, /5 palabras/);
});

test('recommendNextStep is defensive about malformed input', () => {
  assert.equal(recommendNextStep({ score: 0, total: 0, missedCount: 0 }).mode, 'home');
  assert.equal(recommendNextStep(null).mode, 'home');
});

test('buildShareText summarises a mock without any personal data or links', () => {
  const missed = ['heel', 'read'].map((id) => WORDS.find((item) => item.id === id));
  const text = buildShareText({
    kind: 'mock',
    score: 8,
    total: 10,
    best: { score: 9, total: 10 },
    missedWords: missed,
  });

  assert.equal(
    text,
    [
      'Boadilla School · Spelling: ea + ee',
      'Simulacro: 8/10',
      'Mejor resultado: 9/10',
      'Para repasar: heel, read',
    ].join('\n'),
  );
  assert.doesNotMatch(text, /https?:/);
});

test('buildShareText omits best score and review list when they do not apply', () => {
  const text = buildShareText({ kind: 'practice', score: 4, total: 4, best: null, missedWords: [] });
  assert.equal(text, ['Boadilla School · Spelling: ea + ee', 'Práctica: 4/4 a la primera'].join('\n'));
});
