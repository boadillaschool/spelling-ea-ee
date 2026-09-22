import test from 'node:test';
import assert from 'node:assert/strict';

import { WORDS } from '../data.js';
import {
  STORAGE_KEY,
  addMockScore,
  clearProgress,
  createEmptyProgress,
  formatLocalDate,
  getBestScore,
  getMissionRoute,
  getWeakWordIds,
  loadProgress,
  recordAttempt,
  sanitizeProgress,
  saveProgress,
  summarizeProgress,
} from '../logic.js';

const at = '2026-09-20T10:00:00.000Z';

function memoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
  };
}

const throwingStorage = {
  getItem() {
    throw new Error('blocked');
  },
  setItem() {
    throw new Error('quota');
  },
  removeItem() {
    throw new Error('blocked');
  },
};

test('storage key is generic and versioned', () => {
  assert.equal(STORAGE_KEY, 'spelling-ea-ee:v1');
});

test('getWeakWordIds lists words whose mistakes outweigh successes, worst first', () => {
  let progress = createEmptyProgress(WORDS);
  progress = recordAttempt(progress, 'meat', false, at);
  progress = recordAttempt(progress, 'heel', false, at);
  progress = recordAttempt(progress, 'heel', false, at);
  progress = recordAttempt(progress, 'read', false, at);
  progress = recordAttempt(progress, 'read', true, at);
  progress = recordAttempt(progress, 'easy', true, at);

  assert.deepEqual(getWeakWordIds(WORDS, progress), ['heel', 'meat']);
});

test('getWeakWordIds is empty for a fresh progress snapshot', () => {
  assert.deepEqual(getWeakWordIds(WORDS, createEmptyProgress(WORDS)), []);
});

test('summarizeProgress counts practised, secure and weak words', () => {
  let progress = createEmptyProgress(WORDS);
  progress = recordAttempt(progress, 'easy', true, at);
  progress = recordAttempt(progress, 'easy', true, '2026-09-21T10:00:00.000Z');
  progress = recordAttempt(progress, 'meat', false, at);
  progress = recordAttempt(progress, 'read', false, at);
  progress = recordAttempt(progress, 'read', true, at);
  progress = recordAttempt(progress, 'read', true, '2026-09-21T10:00:00.000Z');

  assert.deepEqual(summarizeProgress(WORDS, progress), {
    total: 10,
    practised: 3,
    mastered: 2,
    weak: 1,
  });
});

test('addMockScore appends a valid score immutably and ignores invalid ones', () => {
  const empty = createEmptyProgress(WORDS);
  const next = addMockScore(empty, { score: 7, total: 10, completedAt: at });

  assert.deepEqual(empty.mockScores, []);
  assert.deepEqual(next.mockScores, [{ score: 7, total: 10, completedAt: at }]);
  assert.equal(addMockScore(next, { score: 11, total: 10, completedAt: at }), next);
  assert.equal(addMockScore(next, { score: -1, total: 10, completedAt: at }), next);
  assert.equal(addMockScore(next, { score: 1.5, total: 10, completedAt: at }), next);
  assert.equal(addMockScore(next, null), next);
});

test('addMockScore keeps only the twenty most recent scores', () => {
  let progress = createEmptyProgress(WORDS);
  for (let score = 0; score < 25; score += 1) {
    progress = addMockScore(progress, { score: score % 11, total: 10, completedAt: at });
  }

  assert.equal(progress.mockScores.length, 20);
  assert.equal(progress.mockScores[0].score, 5);
});

test('getBestScore returns the highest score or null', () => {
  let progress = createEmptyProgress(WORDS);
  assert.equal(getBestScore(progress), null);
  progress = addMockScore(progress, { score: 6, total: 10, completedAt: at });
  progress = addMockScore(progress, { score: 9, total: 10, completedAt: at });
  progress = addMockScore(progress, { score: 7, total: 10, completedAt: at });
  assert.deepEqual(getBestScore(progress), { score: 9, total: 10 });
});

test('sanitizeProgress keeps only well-formed mock scores and strips extra fields', () => {
  const raw = {
    version: 1,
    words: {},
    mockScores: [
      { score: 8, total: 10, completedAt: at, extra: 'unexpected' },
      { score: 12, total: 10, completedAt: at },
      { score: 'x', total: 10 },
      null,
      'nope',
      { score: 3, total: 10, completedAt: 5 },
    ],
  };

  assert.deepEqual(sanitizeProgress(raw, WORDS.slice(0, 1)).mockScores, [
    { score: 8, total: 10, completedAt: at },
  ]);
});

test('loadProgress restores a saved snapshot', () => {
  const storage = memoryStorage();
  const progress = recordAttempt(createEmptyProgress(WORDS), 'easy', true, at);
  assert.equal(saveProgress(storage, progress), true);

  assert.deepEqual(loadProgress(storage, WORDS), progress);
  assert.equal(storage.data.has(STORAGE_KEY), true);
});

test('loadProgress falls back to empty progress for missing, corrupt or blocked storage', () => {
  const empty = createEmptyProgress(WORDS);

  assert.deepEqual(loadProgress(memoryStorage(), WORDS), empty);
  assert.deepEqual(loadProgress(memoryStorage({ [STORAGE_KEY]: '{not json' }), WORDS), empty);
  assert.deepEqual(loadProgress(memoryStorage({ [STORAGE_KEY]: '"text"' }), WORDS), empty);
  assert.deepEqual(loadProgress(throwingStorage, WORDS), empty);
  assert.deepEqual(loadProgress(null, WORDS), empty);
  assert.deepEqual(loadProgress(undefined, WORDS), empty);
});

test('saveProgress and clearProgress report failure instead of throwing', () => {
  const progress = createEmptyProgress(WORDS);

  assert.equal(saveProgress(throwingStorage, progress), false);
  assert.equal(saveProgress(null, progress), false);
  assert.equal(clearProgress(throwingStorage), false);
  assert.equal(clearProgress(null), false);
});

test('clearProgress removes the stored snapshot', () => {
  const storage = memoryStorage({ [STORAGE_KEY]: '{}' });
  assert.equal(clearProgress(storage), true);
  assert.equal(storage.data.has(STORAGE_KEY), false);
});

test('saved data contains only aggregate counters and mock scores', () => {
  const storage = memoryStorage();
  saveProgress(
    storage,
    addMockScore(createEmptyProgress(WORDS), { score: 4, total: 10, completedAt: at }),
  );
  const saved = JSON.parse(storage.data.get(STORAGE_KEY));

  assert.deepEqual(Object.keys(saved).sort(), ['mockScores', 'version', 'words']);
  for (const stats of Object.values(saved.words)) {
    assert.deepEqual(Object.keys(stats).sort(), [
      'correct',
      'lastCleanAt',
      'lastPractisedAt',
      'level',
      'nextReviewAt',
      'seen',
      'wrong',
    ]);
  }
});

test('formatLocalDate uses local calendar fields with zero padding', () => {
  assert.equal(formatLocalDate(new Date(2026, 8, 5, 23, 59)), '2026-09-05');
  assert.equal(formatLocalDate(new Date(2026, 0, 1, 0, 0)), '2026-01-01');
  assert.equal(formatLocalDate(new Date('invalid')), '');
});

test('getMissionRoute sends mock missions to the mock and the rest to practice', () => {
  assert.deepEqual(getMissionRoute({ mode: 'mock', wordIds: ['a', 'b'] }), {
    view: 'mock',
    wordIds: ['a', 'b'],
  });
  for (const mode of ['diagnostic', 'pattern', 'mixed', 'warmup']) {
    assert.deepEqual(getMissionRoute({ mode, wordIds: ['a'] }), {
      view: 'practice',
      wordIds: ['a'],
    });
  }
});
