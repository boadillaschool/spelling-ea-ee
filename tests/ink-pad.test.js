import test from 'node:test';
import assert from 'node:assert/strict';

import {
  appendInkPoint,
  clearInk,
  createInkState,
  finishInkStroke,
  startInkStroke,
  undoInkStroke,
} from '../ink-pad.js';

test('ink strokes use bounded normalised coordinates and one active pointer', () => {
  const empty = createInkState();
  const started = startInkStroke(empty, 7, { x: -0.2, y: 1.4, pressure: 0 });
  assert.deepEqual(started, {
    strokes: [[{ x: 0, y: 1, pressure: 0.5 }]],
    activePointerId: 7,
  });

  const wrongPointer = appendInkPoint(started, 8, { x: 0.2, y: 0.3, pressure: 0.8 });
  assert.equal(wrongPointer, started);
  const drawn = appendInkPoint(started, 7, { x: 0.25, y: 0.75, pressure: 0.8 });
  assert.deepEqual(drawn.strokes[0][1], { x: 0.25, y: 0.75, pressure: 0.8 });
  assert.deepEqual(empty, { strokes: [], activePointerId: null }, 'reducers must not mutate prior state');
});

test('finishing, undoing and clearing ink keep only in-memory stroke geometry', () => {
  const started = startInkStroke(createInkState(), 3, { x: 0.1, y: 0.2, pressure: 0.4 });
  const finished = finishInkStroke(started, 3);
  assert.equal(finished.activePointerId, null);
  assert.equal(finishInkStroke(finished, 99), finished);
  assert.deepEqual(undoInkStroke(finished), createInkState());

  const two = startInkStroke(finished, 4, { x: 0.8, y: 0.9, pressure: 1 });
  assert.equal(two.strokes.length, 2);
  assert.deepEqual(clearInk(two), createInkState());
});
