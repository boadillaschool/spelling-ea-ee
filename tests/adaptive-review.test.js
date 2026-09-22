import test from 'node:test';
import assert from 'node:assert/strict';

import { WORDS } from '../data.js';
import {
  createEmptyProgress,
  getDueWordIds,
  getReviewStatus,
  insertDelayedReview,
  recordAttempt,
  sanitizeProgress,
  summarizeProgress,
} from '../logic.js';

const at = '2026-09-20T10:00:00.000Z';

test('progress v2 adds bounded review metadata to every word', () => {
  const progress = createEmptyProgress(WORDS.slice(0, 1));
  assert.deepEqual(progress, {
    version: 2,
    words: {
      easy: {
        seen: 0,
        correct: 0,
        wrong: 0,
        lastPractisedAt: null,
        level: 0,
        lastCleanAt: null,
        nextReviewAt: null,
      },
    },
    mockScores: [],
  });
});

test('valid v1 counters migrate without claiming that a word is secure', () => {
  const migrated = sanitizeProgress({
    version: 1,
    words: {
      easy: { seen: 3, correct: 2, wrong: 1, lastPractisedAt: at },
    },
    mockScores: [{ score: 1, total: 1, completedAt: at }],
  }, WORDS.slice(0, 1));

  assert.deepEqual(migrated, {
    version: 2,
    words: {
      easy: {
        seen: 3,
        correct: 2,
        wrong: 1,
        lastPractisedAt: at,
        level: 1,
        lastCleanAt: at,
        nextReviewAt: at,
      },
    },
    mockScores: [{ score: 1, total: 1, completedAt: at }],
  });
});

test('progress sanitization reads review fields once and rejects hostile records', () => {
  const reads = new Map();
  const once = (name, value) => ({
    enumerable: true,
    get() {
      const count = (reads.get(name) ?? 0) + 1;
      reads.set(name, count);
      if (count > 1) throw new Error(`${name} was read twice`);
      return value;
    },
  });
  const stats = Object.defineProperties({}, {
    seen: once('seen', 1),
    correct: once('correct', 1),
    wrong: once('wrong', 0),
    lastPractisedAt: once('lastPractisedAt', at),
    level: once('level', 1),
    lastCleanAt: once('lastCleanAt', at),
    nextReviewAt: once('nextReviewAt', '2026-09-21T10:00:00.000Z'),
  });

  const sanitized = sanitizeProgress({ version: 2, words: { easy: stats }, mockScores: [] }, WORDS.slice(0, 1));
  assert.equal(sanitized.words.easy.level, 1);
  assert.deepEqual(Object.fromEntries(reads), {
    seen: 1,
    correct: 1,
    wrong: 1,
    lastPractisedAt: 1,
    level: 1,
    lastCleanAt: 1,
    nextReviewAt: 1,
  });

  const hostile = Object.defineProperty({}, 'seen', { get() { throw new Error('blocked'); } });
  assert.doesNotThrow(() => sanitizeProgress({ version: 2, words: { easy: hostile }, mockScores: [] }, WORDS.slice(0, 1)));
  assert.deepEqual(
    sanitizeProgress({ version: 2, words: { easy: hostile }, mockScores: [] }, WORDS.slice(0, 1)).words.easy,
    createEmptyProgress(WORDS.slice(0, 1)).words.easy,
  );
});

test('two clean recalls on different days make a word secure and a miss resets it', () => {
  let progress = createEmptyProgress(WORDS.slice(0, 1));
  progress = recordAttempt(progress, 'easy', true, '2026-09-20T10:00:00.000Z');
  assert.deepEqual(progress.words.easy, {
    seen: 1,
    correct: 1,
    wrong: 0,
    lastPractisedAt: '2026-09-20T10:00:00.000Z',
    level: 1,
    lastCleanAt: '2026-09-20T10:00:00.000Z',
    nextReviewAt: '2026-09-21T10:00:00.000Z',
  });

  progress = recordAttempt(progress, 'easy', true, '2026-09-20T18:00:00.000Z');
  assert.equal(progress.words.easy.level, 1, 'same-day repetition must not simulate spacing');
  assert.equal(progress.words.easy.nextReviewAt, '2026-09-21T18:00:00.000Z');

  progress = recordAttempt(progress, 'easy', true, '2026-09-21T18:00:00.000Z');
  assert.equal(progress.words.easy.level, 2);
  assert.equal(progress.words.easy.nextReviewAt, '2026-09-24T18:00:00.000Z');

  progress = recordAttempt(progress, 'easy', false, '2026-09-22T09:00:00.000Z');
  assert.equal(progress.words.easy.level, 0);
  assert.equal(progress.words.easy.lastCleanAt, null);
  assert.equal(progress.words.easy.nextReviewAt, '2026-09-22T09:00:00.000Z');
});

test('review status distinguishes new, learning, due and secure words', () => {
  let progress = createEmptyProgress(WORDS.slice(0, 1));
  assert.equal(getReviewStatus(progress.words.easy, '2026-09-20T09:00:00.000Z'), 'new');

  progress = recordAttempt(progress, 'easy', true, '2026-09-20T10:00:00.000Z');
  assert.equal(getReviewStatus(progress.words.easy, '2026-09-20T18:00:00.000Z'), 'learning');
  assert.equal(getReviewStatus(progress.words.easy, '2026-09-21T10:00:00.000Z'), 'due');

  progress = recordAttempt(progress, 'easy', true, '2026-09-21T10:00:00.000Z');
  assert.equal(getReviewStatus(progress.words.easy, '2026-09-22T10:00:00.000Z'), 'secure');
  assert.equal(getReviewStatus(progress.words.easy, '2026-09-24T10:00:00.000Z'), 'due');
});

test('due-word queue puts active errors before scheduled review items', () => {
  let progress = createEmptyProgress(WORDS.slice(0, 3));
  progress = recordAttempt(progress, 'easy', false, '2026-09-22T09:00:00.000Z');
  progress = recordAttempt(progress, 'meat', true, '2026-09-20T09:00:00.000Z');
  progress = recordAttempt(progress, 'peanuts', true, '2026-09-22T09:00:00.000Z');

  assert.deepEqual(
    getDueWordIds(WORDS.slice(0, 3), progress, '2026-09-22T10:00:00.000Z'),
    ['easy', 'meat'],
  );
});

test('a missed practice word returns once after up to two intervening prompts', () => {
  const queue = ['easy', 'meat', 'read', 'heel'].map((id) => ({ id, delayed: false }));
  const inserted = insertDelayedReview(queue, 0, 2);
  assert.deepEqual(inserted, [
    { id: 'easy', delayed: false },
    { id: 'meat', delayed: false },
    { id: 'read', delayed: false },
    { id: 'easy', delayed: true },
    { id: 'heel', delayed: false },
  ]);
  assert.deepEqual(queue, ['easy', 'meat', 'read', 'heel'].map((id) => ({ id, delayed: false })));
  assert.equal(insertDelayedReview(inserted, 0, 2), inserted, 'the same word is never queued twice');
  assert.equal(insertDelayedReview(inserted, 3, 2), inserted, 'a delayed repeat cannot schedule itself');
});

test('progress only calls a word secure after clean recalls on separate days', () => {
  let progress = createEmptyProgress(WORDS.slice(0, 2));
  progress = recordAttempt(progress, 'easy', true, '2026-09-20T09:00:00.000Z');
  progress = recordAttempt(progress, 'easy', true, '2026-09-20T18:00:00.000Z');
  progress = recordAttempt(progress, 'meat', true, '2026-09-20T09:00:00.000Z');
  progress = recordAttempt(progress, 'meat', true, '2026-09-21T09:00:00.000Z');

  assert.deepEqual(summarizeProgress(WORDS.slice(0, 2), progress), {
    practised: 2,
    mastered: 1,
    weak: 0,
    total: 2,
  });
});
