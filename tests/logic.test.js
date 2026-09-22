import test from 'node:test';
import assert from 'node:assert/strict';

import { WORDS } from '../data.js';
import {
  buildReviewQueue,
  checkAnswer,
  createEmptyProgress,
  getDailyMission,
  normalizeAnswer,
  recordAttempt,
  sanitizeProgress,
} from '../logic.js';

const EXPECTED_WORDS = [
  'easy',
  'meat',
  'peanuts',
  'between',
  'read',
  'jeans',
  'heel',
  'sweets',
  'street',
  'reach',
];

const EXPECTED_SENTENCES = [
  'This spelling game is easy.',
  'We eat meat for lunch.',
  'The peanuts are in a bowl.',
  'The ball is between the boxes.',
  'I read a book every night.',
  'She is wearing blue jeans.',
  'Your heel is at the back of your foot.',
  'The sweets are in the jar.',
  'We cross the street safely.',
  'I can reach the shelf.',
];

test('vocabulary exposes the complete ordered teaching data', () => {
  assert.deepEqual(
    WORDS.map(({ word }) => word),
    EXPECTED_WORDS,
  );
  assert.equal(new Set(WORDS.map(({ id }) => id)).size, WORDS.length);
  assert.deepEqual(
    WORDS.map(({ id }) => id),
    EXPECTED_WORDS,
  );
  assert.deepEqual(
    WORDS.map(({ sentence }) => sentence),
    EXPECTED_SENTENCES,
  );

  for (const item of WORDS) {
    assert.equal(item.word.includes(item.pattern), true, `${item.word} must contain ${item.pattern}`);
    assert.equal(typeof item.cue, 'string');
    assert.notEqual(item.cue.trim(), '');
    assert.equal(Object.hasOwn(item, 'symbol'), false, 'the UI uses text cues, not platform emoji');
    assert.equal(Object.isFrozen(item), true);
  }

  assert.equal(WORDS.filter(({ pattern }) => pattern === 'ea').length, 6);
  assert.equal(WORDS.filter(({ pattern }) => pattern === 'ee').length, 4);
  assert.equal(Object.isFrozen(WORDS), true);
});

test('normalizeAnswer applies NFKC, trims, and lowercases', () => {
  assert.equal(normalizeAnswer('  ＥＡＳＹ  '), 'easy');
  assert.equal(normalizeAnswer(' ReAd '), 'read');
  assert.equal(normalizeAnswer('e\u0301'), 'é');
});

test('checkAnswer accepts only the complete normalised spelling', () => {
  assert.equal(checkAnswer('  ＲＥＡＤ  ', 'read'), true);
  assert.equal(checkAnswer('rea', 'read'), false);
  assert.equal(checkAnswer('read!', 'read'), false);
  assert.equal(checkAnswer('I read', 'read'), false);
  assert.equal(checkAnswer('', 'read'), false);
});

test('createEmptyProgress starts versioned counters for every word', () => {
  const progress = createEmptyProgress(WORDS.slice(0, 2));

  assert.deepEqual(progress, {
    version: 2,
    words: {
      easy: { seen: 0, correct: 0, wrong: 0, lastPractisedAt: null, level: 0, lastCleanAt: null, nextReviewAt: null },
      meat: { seen: 0, correct: 0, wrong: 0, lastPractisedAt: null, level: 0, lastCleanAt: null, nextReviewAt: null },
    },
    mockScores: [],
  });
  assert.notEqual(progress.words.easy, progress.words.meat);
});

test('sanitizeProgress resets null and malformed snapshots without throwing', () => {
  const expected = createEmptyProgress(WORDS.slice(0, 2));
  const malformedSnapshots = [
    null,
    undefined,
    'not an object',
    [],
    {},
    { version: 1 },
    { version: 1, words: null },
  ];

  for (const raw of malformedSnapshots) {
    assert.doesNotThrow(() => sanitizeProgress(raw, WORDS.slice(0, 2)));
    assert.deepEqual(sanitizeProgress(raw, WORDS.slice(0, 2)), expected);
  }
});

test('sanitizeProgress preserves a valid current-version snapshot', () => {
  const raw = {
    version: 2,
    words: {
      easy: {
        seen: 3,
        correct: 2,
        wrong: 1,
        lastPractisedAt: '2026-09-20T10:00:00.000Z',
        level: 1,
        lastCleanAt: '2026-09-20T10:00:00.000Z',
        nextReviewAt: '2026-09-21T10:00:00.000Z',
      },
      meat: { seen: 0, correct: 0, wrong: 0, lastPractisedAt: null, level: 0, lastCleanAt: null, nextReviewAt: null },
    },
    mockScores: [{ score: 8, total: 10, completedAt: '2026-09-20T11:00:00.000Z' }],
  };

  const sanitized = sanitizeProgress(raw, WORDS.slice(0, 2));

  assert.deepEqual(sanitized, raw);
  assert.notEqual(sanitized, raw);
  assert.notEqual(sanitized.words, raw.words);
  assert.notEqual(sanitized.words.easy, raw.words.easy);
  assert.notEqual(sanitized.mockScores, raw.mockScores);
});

test('sanitizeProgress drops malformed mock score entries and preserves valid order', () => {
  class ScoreRecord {}

  const validFirst = {
    score: 0,
    total: 1,
    completedAt: '2026-09-20T11:00:00.000Z',
    unknown: 'discard me',
  };
  const validSecond = {
    score: 8,
    total: 10,
    completedAt: '2026-09-21T11:00:00.000Z',
  };
  const nonPlainScore = Object.assign(new ScoreRecord(), validSecond);
  const raw = {
    version: 1,
    words: {
      easy: { seen: 0, correct: 0, wrong: 0, lastPractisedAt: null },
    },
    mockScores: [
      null,
      [],
      'not an object',
      {},
      nonPlainScore,
      { ...validSecond, score: -1 },
      { ...validSecond, score: 1.5 },
      { ...validSecond, score: Number.MAX_SAFE_INTEGER + 1 },
      { ...validSecond, total: 0 },
      { ...validSecond, total: 1.5 },
      { ...validSecond, total: Number.MAX_SAFE_INTEGER + 1 },
      { ...validSecond, score: 11 },
      { ...validSecond, completedAt: 123 },
      { ...validSecond, completedAt: 'not-a-date' },
      validFirst,
      validSecond,
    ],
  };

  const sanitized = sanitizeProgress(raw, WORDS.slice(0, 1));

  assert.deepEqual(sanitized.mockScores, [
    { score: 0, total: 1, completedAt: '2026-09-20T11:00:00.000Z' },
    { score: 8, total: 10, completedAt: '2026-09-21T11:00:00.000Z' },
  ]);
});

test('sanitizeProgress accepts only canonical UTC ISO mock score timestamps', () => {
  const canonicalTimestamp = new Date().toISOString();
  const nonCanonicalTimestamps = [
    '2026-02-31T00:00:00.000Z',
    '09/20/2026',
    '0',
    '2026-09-20T11:00:00Z',
    '2026-09-20T13:00:00.000+02:00',
    'not-a-date',
  ];
  const raw = {
    version: 1,
    words: {},
    mockScores: [
      ...nonCanonicalTimestamps.map((completedAt) => ({ score: 8, total: 10, completedAt })),
      { score: 8, total: 10, completedAt: canonicalTimestamp },
    ],
  };

  const sanitized = sanitizeProgress(raw, WORDS.slice(0, 1));

  assert.deepEqual(sanitized.mockScores, [
    { score: 8, total: 10, completedAt: canonicalTimestamp },
  ]);
});

test('sanitizeProgress reads each accepted mock score field exactly once', () => {
  const reads = { score: 0, total: 0, completedAt: 0 };
  const sourceScore = {};
  Object.defineProperties(sourceScore, {
    score: {
      enumerable: true,
      get() {
        reads.score += 1;
        return 8;
      },
    },
    total: {
      enumerable: true,
      get() {
        reads.total += 1;
        return 10;
      },
    },
    completedAt: {
      enumerable: true,
      get() {
        reads.completedAt += 1;
        return '2026-09-20T11:00:00.000Z';
      },
    },
  });
  const raw = {
    version: 1,
    words: {},
    mockScores: [sourceScore],
  };

  const sanitized = sanitizeProgress(raw, WORDS.slice(0, 1));

  assert.deepEqual(sanitized.mockScores, [
    { score: 8, total: 10, completedAt: '2026-09-20T11:00:00.000Z' },
  ]);
  assert.deepEqual(reads, { score: 1, total: 1, completedAt: 1 });
});

test('sanitizeProgress discards mock score entries that cannot be safely inspected', () => {
  const completedAt = '2026-09-20T11:00:00.000Z';
  const unreadableField = (field) => {
    const mockScore = { score: 8, total: 10, completedAt };
    Object.defineProperty(mockScore, field, {
      get() {
        throw new Error(`cannot read ${field}`);
      },
    });
    return mockScore;
  };
  const unsafeProxy = new Proxy(
    { score: 8, total: 10, completedAt },
    {
      getPrototypeOf() {
        throw new Error('cannot inspect prototype');
      },
    },
  );
  const raw = {
    version: 1,
    words: {},
    mockScores: [
      { score: 1, total: 2, completedAt },
      unreadableField('score'),
      unreadableField('total'),
      unreadableField('completedAt'),
      unsafeProxy,
      { score: 2, total: 2, completedAt },
    ],
  };

  const sanitized = sanitizeProgress(raw, WORDS.slice(0, 1));

  assert.deepEqual(sanitized.mockScores, [
    { score: 1, total: 2, completedAt },
    { score: 2, total: 2, completedAt },
  ]);
});

test('sanitizeProgress deeply detaches valid mock score records', () => {
  const sourceScore = {
    score: 8,
    total: 10,
    completedAt: '2026-09-20T11:00:00.000Z',
    unknown: { mutable: true },
  };
  const raw = {
    version: 1,
    words: {
      easy: { seen: 0, correct: 0, wrong: 0, lastPractisedAt: null },
    },
    mockScores: [sourceScore],
  };

  const sanitized = sanitizeProgress(raw, WORDS.slice(0, 1));

  assert.notEqual(sanitized.mockScores, raw.mockScores);
  assert.notEqual(sanitized.mockScores[0], sourceScore);
  assert.equal(Object.getPrototypeOf(sanitized.mockScores[0]), Object.prototype);
  assert.deepEqual(sanitized.mockScores[0], {
    score: 8,
    total: 10,
    completedAt: '2026-09-20T11:00:00.000Z',
  });

  sourceScore.score = 0;
  sourceScore.unknown.mutable = false;
  assert.equal(sanitized.mockScores[0].score, 8);
});

test('sanitizeProgress rejects mock scores whose total exceeds one hundred', () => {
  const raw = {
    version: 1,
    words: {},
    mockScores: [
      {
        score: 100,
        total: 101,
        completedAt: '2026-09-20T11:00:00.000Z',
      },
    ],
  };

  assert.deepEqual(sanitizeProgress(raw, WORDS.slice(0, 1)).mockScores, []);
});

test('sanitizeProgress keeps only the twenty most recent valid mock scores', () => {
  const mockScores = Array.from({ length: 25 }, (_, index) => ({
    score: index,
    total: 100,
    completedAt: new Date(Date.UTC(2026, 8, 1, index)).toISOString(),
  }));
  const raw = { version: 1, words: {}, mockScores };

  const sanitized = sanitizeProgress(raw, WORDS.slice(0, 1));

  assert.deepEqual(sanitized.mockScores, mockScores.slice(-20));
});

test('sanitizeProgress resets missing or invalid per-word counters', () => {
  const words = WORDS.slice(0, 6);
  const raw = {
    version: 1,
    words: {
      meat: { seen: -1, correct: 0, wrong: 0, lastPractisedAt: null },
      peanuts: { seen: 1, correct: 0.5, wrong: 0, lastPractisedAt: null },
      between: { seen: 1, correct: 0, wrong: '1', lastPractisedAt: null },
      read: { seen: 1, correct: 1, wrong: 0, lastPractisedAt: 123 },
      jeans: { seen: 5, correct: 1, wrong: 1, lastPractisedAt: null },
    },
    mockScores: [],
  };

  const sanitized = sanitizeProgress(raw, words);

  assert.deepEqual(sanitized.words.easy, {
    seen: 0,
    correct: 0,
    wrong: 0,
    lastPractisedAt: null,
    level: 0,
    lastCleanAt: null,
    nextReviewAt: null,
  });
  assert.deepEqual(sanitized.words.meat, sanitized.words.easy);
  assert.deepEqual(sanitized.words.peanuts, sanitized.words.easy);
  assert.deepEqual(sanitized.words.between, sanitized.words.easy);
  assert.deepEqual(sanitized.words.jeans, sanitized.words.easy);
  assert.deepEqual(sanitized.words.read, {
    seen: 1,
    correct: 1,
    wrong: 0,
    lastPractisedAt: null,
    level: 0,
    lastCleanAt: null,
    nextReviewAt: null,
  });
});

test('sanitizeProgress resets version mismatches instead of reusing stale data', () => {
  const words = WORDS.slice(0, 1);
  const stale = {
    version: 0,
    words: {
      easy: { seen: 2, correct: 1, wrong: 1, lastPractisedAt: null },
    },
    mockScores: [{ score: 1, total: 1 }],
  };

  assert.deepEqual(sanitizeProgress(stale, words), createEmptyProgress(words));
});

test('sanitizeProgress drops unknown word ids and malformed mock score collections', () => {
  const words = WORDS.slice(0, 1);
  const raw = {
    version: 1,
    words: {
      easy: { seen: 1, correct: 0, wrong: 1, lastPractisedAt: null },
      unknown: { seen: 9, correct: 0, wrong: 9, lastPractisedAt: null },
    },
    mockScores: { score: 1, total: 1 },
  };

  const sanitized = sanitizeProgress(raw, words);

  assert.deepEqual(Object.keys(sanitized.words), ['easy']);
  assert.deepEqual(sanitized.words.easy, {
    seen: 1,
    correct: 0,
    wrong: 1,
    lastPractisedAt: null,
    level: 0,
    lastCleanAt: null,
    nextReviewAt: null,
  });
  assert.deepEqual(sanitized.mockScores, []);
});

test('recordAttempt immutably records correct and wrong attempts', () => {
  const original = createEmptyProgress(WORDS.slice(0, 2));
  const firstTimestamp = '2026-09-20T10:00:00.000Z';
  const secondTimestamp = '2026-09-20T10:01:00.000Z';

  const afterCorrect = recordAttempt(original, 'easy', true, firstTimestamp);
  const afterWrong = recordAttempt(afterCorrect, 'easy', false, secondTimestamp);

  assert.deepEqual(original.words.easy, {
    seen: 0,
    correct: 0,
    wrong: 0,
    lastPractisedAt: null,
    level: 0,
    lastCleanAt: null,
    nextReviewAt: null,
  });
  assert.deepEqual(afterCorrect.words.easy, {
    seen: 1,
    correct: 1,
    wrong: 0,
    lastPractisedAt: firstTimestamp,
    level: 1,
    lastCleanAt: firstTimestamp,
    nextReviewAt: '2026-09-21T10:00:00.000Z',
  });
  assert.deepEqual(afterWrong.words.easy, {
    seen: 2,
    correct: 1,
    wrong: 1,
    lastPractisedAt: secondTimestamp,
    level: 0,
    lastCleanAt: null,
    nextReviewAt: secondTimestamp,
  });
  assert.notEqual(afterCorrect, original);
  assert.notEqual(afterCorrect.words, original.words);
  assert.equal(afterCorrect.words.meat, original.words.meat);
});

test('recordAttempt safely ignores an unknown word id', () => {
  const progress = createEmptyProgress(WORDS);

  const result = recordAttempt(
    progress,
    'not-in-the-list',
    true,
    '2026-09-20T10:00:00.000Z',
  );

  assert.equal(result, progress);
});

test('recordAttempt leaves saturated safe-integer counters unchanged', () => {
  const progress = createEmptyProgress(WORDS.slice(0, 1));
  progress.words.easy = {
    seen: Number.MAX_SAFE_INTEGER,
    correct: Number.MAX_SAFE_INTEGER,
    wrong: 0,
    lastPractisedAt: '2026-09-20T10:00:00.000Z',
  };
  const before = structuredClone(progress);

  const result = recordAttempt(
    progress,
    'easy',
    false,
    '2026-09-20T10:01:00.000Z',
  );

  assert.equal(result, progress);
  assert.deepEqual(result, before);
});

test('buildReviewQueue prioritises more wrong then fewer correct answers', () => {
  const words = WORDS.slice(0, 4);
  const progress = createEmptyProgress(words);
  progress.words.easy = { seen: 3, correct: 1, wrong: 2, lastPractisedAt: null };
  progress.words.meat = { seen: 1, correct: 0, wrong: 1, lastPractisedAt: null };
  progress.words.peanuts = { seen: 3, correct: 2, wrong: 1, lastPractisedAt: null };
  progress.words.between = { seen: 0, correct: 0, wrong: 0, lastPractisedAt: null };
  const progressBefore = structuredClone(progress);

  const queue = buildReviewQueue(words, progress, () => {
    throw new Error('RNG must not be used for non-ties');
  });

  assert.deepEqual(queue.map(({ id }) => id), ['easy', 'meat', 'peanuts', 'between']);
  assert.deepEqual(progress, progressBefore);
  assert.deepEqual(words, WORDS.slice(0, 4));
});

test('buildReviewQueue uses the injected RNG to shuffle exact ties only', () => {
  const words = WORDS.slice(0, 3);
  const progress = createEmptyProgress(words);
  let randomCalls = 0;

  const queue = buildReviewQueue(words, progress, () => {
    randomCalls += 1;
    return 0;
  });

  assert.deepEqual(queue.map(({ id }) => id), ['meat', 'peanuts', 'easy']);
  assert.equal(randomCalls, 2);
});

test('getDailyMission recommends a ten-word diagnostic on 2026-09-20', () => {
  assert.deepEqual(getDailyMission('2026-09-20', null, WORDS), {
    title: 'Diagnóstico inicial',
    mode: 'diagnostic',
    wordIds: EXPECTED_WORDS,
    recommendedMinutes: 10,
  });
});

test('getDailyMission recommends the ea group on 2026-09-21', () => {
  assert.deepEqual(getDailyMission('2026-09-21', undefined, WORDS), {
    title: 'Familia ea',
    mode: 'pattern',
    wordIds: ['easy', 'meat', 'peanuts', 'read', 'jeans', 'reach'],
    recommendedMinutes: 8,
  });
});

test('getDailyMission combines ee words with prior weak words on 2026-09-22', () => {
  let progress = createEmptyProgress(WORDS);
  progress = recordAttempt(progress, 'easy', false, '2026-09-20T10:00:00.000Z');
  progress = recordAttempt(progress, 'easy', false, '2026-09-20T10:01:00.000Z');
  progress = recordAttempt(progress, 'between', false, '2026-09-20T10:02:00.000Z');
  progress = recordAttempt(progress, 'reach', false, '2026-09-20T10:03:00.000Z');
  const progressBefore = structuredClone(progress);

  const mission = getDailyMission('2026-09-22', progress, WORDS);

  assert.deepEqual(mission, {
    title: 'Familia ee y repaso',
    mode: 'pattern',
    wordIds: ['between', 'heel', 'sweets', 'street', 'easy', 'reach'],
    recommendedMinutes: 8,
  });
  assert.equal(new Set(mission.wordIds).size, mission.wordIds.length);
  assert.deepEqual(getDailyMission('2026-09-22', progress, WORDS), mission);
  assert.deepEqual(progress, progressBefore);
});

test('getDailyMission recommends all words in mixed mode on 2026-09-23', () => {
  assert.deepEqual(getDailyMission('2026-09-23', null, WORDS), {
    title: 'Dictado mixto',
    mode: 'mixed',
    wordIds: EXPECTED_WORDS,
    recommendedMinutes: 10,
  });
});

test('getDailyMission recommends a full mock on 2026-09-24', () => {
  assert.deepEqual(getDailyMission('2026-09-24', null, WORDS), {
    title: 'Simulacro',
    mode: 'mock',
    wordIds: EXPECTED_WORDS,
    recommendedMinutes: 10,
  });
});

test('getDailyMission limits the 2026-09-25 warm-up to five weakest words', () => {
  const progress = createEmptyProgress(WORDS);
  progress.words.easy = { seen: 5, correct: 2, wrong: 3, lastPractisedAt: null };
  progress.words.meat = { seen: 3, correct: 0, wrong: 3, lastPractisedAt: null };
  progress.words.peanuts = { seen: 2, correct: 0, wrong: 2, lastPractisedAt: null };
  progress.words.between = { seen: 6, correct: 5, wrong: 1, lastPractisedAt: null };
  progress.words.read = { seen: 1, correct: 0, wrong: 1, lastPractisedAt: null };
  const progressBefore = structuredClone(progress);

  const mission = getDailyMission('2026-09-25', progress, WORDS);

  assert.deepEqual(mission, {
    title: 'Calentamiento corto',
    mode: 'warmup',
    wordIds: ['meat', 'easy', 'peanuts', 'read', 'between'],
    recommendedMinutes: 5,
  });
  assert.ok(mission.wordIds.length <= 5);
  assert.deepEqual(progress, progressBefore);
});

test('getDailyMission returns normal mixed practice after the exam', () => {
  const mission = getDailyMission('2026-09-26', null, WORDS);

  assert.deepEqual(mission, {
    title: 'Práctica mixta',
    mode: 'mixed',
    wordIds: EXPECTED_WORDS,
    recommendedMinutes: 10,
  });
  assert.doesNotMatch(mission.title, /examen|simulacro|prepar/i);
});

test('getDailyMission deterministically falls back for unsupported or malformed dates', () => {
  const expected = {
    title: 'Práctica mixta',
    mode: 'mixed',
    wordIds: EXPECTED_WORDS,
    recommendedMinutes: 10,
  };

  for (const localDate of ['2026-10-01', 'not-a-date', '2026-99-99']) {
    assert.deepEqual(getDailyMission(localDate, null, WORDS), expected);
    assert.deepEqual(getDailyMission(localDate, null, WORDS), expected);
  }
});

test('getDailyMission never mutates words or progress', () => {
  const words = structuredClone(WORDS);
  const progress = createEmptyProgress(words);
  progress.words.easy = { seen: 2, correct: 1, wrong: 1, lastPractisedAt: null };
  const wordsBefore = structuredClone(words);
  const progressBefore = structuredClone(progress);

  for (const localDate of [
    '2026-09-20',
    '2026-09-21',
    '2026-09-22',
    '2026-09-23',
    '2026-09-24',
    '2026-09-25',
    '2026-09-26',
    'malformed',
  ]) {
    getDailyMission(localDate, progress, words);
  }

  assert.deepEqual(words, wordsBefore);
  assert.deepEqual(progress, progressBefore);
});
