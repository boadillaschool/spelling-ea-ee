import test from 'node:test';
import assert from 'node:assert/strict';

import { normalizeChildren } from '../ui-helpers.js';

test('normalizeChildren drops null, undefined and false so no literal "null" text is created', () => {
  const node = { id: 'button' };

  assert.deepEqual(normalizeChildren([null, node, undefined, false]), [node]);
});

test('normalizeChildren flattens nested lists and drops nullish children inside them', () => {
  const first = { id: 'a' };
  const second = { id: 'b' };

  assert.deepEqual(normalizeChildren([[first, null], [[undefined, second]]]), [first, second]);
});

test('normalizeChildren keeps valid zero and empty text', () => {
  assert.deepEqual(normalizeChildren([0, '', 'texto']), [0, '', 'texto']);
});

test('normalizeChildren accepts a missing list', () => {
  assert.deepEqual(normalizeChildren(undefined), []);
  assert.deepEqual(normalizeChildren(null), []);
});
