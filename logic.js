/**
 * Normalises a typed spelling answer for a case-insensitive full-word comparison.
 *
 * @param {string} answer
 * @returns {string}
 */
export function normalizeAnswer(answer) {
  return answer.normalize('NFKC').trim().toLowerCase();
}

/**
 * Checks a complete typed answer against the expected word after normalisation.
 *
 * @param {string} answer
 * @param {string} expectedWord
 * @returns {boolean}
 */
export function checkAnswer(answer, expectedWord) {
  return normalizeAnswer(answer) === normalizeAnswer(expectedWord);
}

const LEGACY_PROGRESS_VERSION = 1;
const PROGRESS_VERSION = 2;
const MAX_MOCK_SCORES = 20;

/** @typedef {{ score: number, total: number, completedAt: string }} MockScore */

function isNonNegativeInteger(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

function isPlainObject(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function sanitizeTimestamp(value) {
  if (typeof value !== 'string') return null;
  try {
    return new Date(value).toISOString() === value ? value : null;
  } catch {
    return null;
  }
}

function sanitizeMockScore(value) {
  try {
    if (!isPlainObject(value)) {
      return null;
    }

    const score = value.score;
    const total = value.total;
    const completedAt = value.completedAt;

    if (
      !isNonNegativeInteger(score) ||
      !isNonNegativeInteger(total) ||
      total === 0 ||
      total > 100 ||
      score > total ||
      typeof completedAt !== 'string' ||
      new Date(completedAt).toISOString() !== completedAt
    ) {
      return null;
    }

    return { score, total, completedAt };
  } catch {
    return null;
  }
}

/**
 * Creates a fresh progress snapshot with independent counters for every word.
 *
 * @param {{ id: string }[]} words
 * @returns {{ version: number, words: Record<string, object>, mockScores: MockScore[] }}
 */
export function createEmptyProgress(words) {
  return {
    version: PROGRESS_VERSION,
    words: Object.fromEntries(
      words.map(({ id }) => [
        id,
        {
          seen: 0,
          correct: 0,
          wrong: 0,
          lastPractisedAt: null,
          level: 0,
          lastCleanAt: null,
          nextReviewAt: null,
        },
      ]),
    ),
    mockScores: [],
  };
}

/**
 * Converts persisted data into a safe progress snapshot for the current vocabulary.
 *
 * @param {unknown} raw
 * @param {{ id: string }[]} words
 * @returns {{ version: number, words: Record<string, object>, mockScores: MockScore[] }}
 */
export function sanitizeProgress(raw, words) {
  const sanitized = createEmptyProgress(words);
  let version;
  let storedWords;
  let storedScores;

  try {
    if (!isPlainObject(raw)) return sanitized;
    version = raw.version;
    storedWords = raw.words;
    storedScores = raw.mockScores;
  } catch {
    return sanitized;
  }

  if (
    ![LEGACY_PROGRESS_VERSION, PROGRESS_VERSION].includes(version) ||
    !isPlainObject(storedWords)
  ) {
    return sanitized;
  }

  for (const { id } of words) {
    let seen;
    let correct;
    let wrong;
    let lastPractisedAtValue;
    let levelValue = 0;
    let lastCleanAtValue = null;
    let nextReviewAtValue = null;

    try {
      if (!Object.hasOwn(storedWords, id)) continue;
      const stats = storedWords[id];
      if (!isPlainObject(stats)) continue;
      seen = stats.seen;
      correct = stats.correct;
      wrong = stats.wrong;
      lastPractisedAtValue = stats.lastPractisedAt;
      if (version === PROGRESS_VERSION) {
        levelValue = stats.level;
        lastCleanAtValue = stats.lastCleanAt;
        nextReviewAtValue = stats.nextReviewAt;
      }
    } catch {
      continue;
    }

    if (
      !isNonNegativeInteger(seen) ||
      !isNonNegativeInteger(correct) ||
      !isNonNegativeInteger(wrong) ||
      seen !== correct + wrong
    ) {
      continue;
    }

    const lastPractisedAt = sanitizeTimestamp(lastPractisedAtValue);
    const legacy = version === LEGACY_PROGRESS_VERSION;
    const legacyLevel = correct > 0 && lastPractisedAt !== null ? 1 : 0;
    let level = legacy
      ? legacyLevel
      : isNonNegativeInteger(levelValue) && levelValue <= 2
        ? levelValue
        : 0;
    const lastCleanAt = legacy ? (legacyLevel > 0 ? lastPractisedAt : null) : sanitizeTimestamp(lastCleanAtValue);
    let nextReviewAt = legacy ? (legacyLevel > 0 ? lastPractisedAt : null) : sanitizeTimestamp(nextReviewAtValue);
    if (level > 0 && lastCleanAt === null) {
      level = 0;
      nextReviewAt = null;
    }

    sanitized.words[id] = {
      seen,
      correct,
      wrong,
      lastPractisedAt,
      level,
      lastCleanAt,
      nextReviewAt,
    };
  }

  if (Array.isArray(storedScores)) {
    try {
      for (const mockScore of storedScores) {
        const safeMockScore = sanitizeMockScore(mockScore);
        if (safeMockScore !== null) sanitized.mockScores.push(safeMockScore);
      }
    } catch {
      // Keep any scores that were safely inspected before a hostile entry failed.
    }
    sanitized.mockScores = sanitized.mockScores.slice(-MAX_MOCK_SCORES);
  }

  return sanitized;
}

/**
 * Returns a new progress snapshot containing one recorded attempt.
 *
 * @param {{ words: Record<string, object> }} progress
 * @param {string} wordId
 * @param {boolean} wasCorrect
 * @param {string} timestamp
 * @returns {object}
 */
export function recordAttempt(progress, wordId, wasCorrect, timestamp) {
  if (!Object.hasOwn(progress.words, wordId)) {
    return progress;
  }

  const current = progress.words[wordId];
  if (current.seen === Number.MAX_SAFE_INTEGER) {
    return progress;
  }

  const safeTimestamp = sanitizeTimestamp(timestamp);
  if (safeTimestamp === null) {
    return progress;
  }
  const currentLevel = isNonNegativeInteger(current.level) && current.level <= 2 ? current.level : 0;
  const priorCleanAt = sanitizeTimestamp(current.lastCleanAt);
  let level = currentLevel;
  let lastCleanAt = priorCleanAt;
  let nextReviewAt = sanitizeTimestamp(current.nextReviewAt);

  if (wasCorrect) {
    const differentDay = priorCleanAt === null || priorCleanAt.slice(0, 10) !== safeTimestamp.slice(0, 10);
    level = differentDay ? Math.min(2, currentLevel + 1) : currentLevel;
    lastCleanAt = safeTimestamp;
    const intervalDays = level >= 2 ? 3 : 1;
    const due = new Date(safeTimestamp);
    due.setUTCDate(due.getUTCDate() + intervalDays);
    nextReviewAt = due.toISOString();
  } else {
    level = 0;
    lastCleanAt = null;
    nextReviewAt = safeTimestamp;
  }

  const nextWordProgress = {
    ...current,
    seen: current.seen + 1,
    correct: current.correct + (wasCorrect ? 1 : 0),
    wrong: current.wrong + (wasCorrect ? 0 : 1),
    lastPractisedAt: safeTimestamp,
    level,
    lastCleanAt,
    nextReviewAt,
  };

  return {
    ...progress,
    words: {
      ...progress.words,
      [wordId]: nextWordProgress,
    },
  };
}

/**
 * Builds a review queue ordered by mistakes first and successful answers second.
 *
 * @param {{ id: string }[]} words
 * @param {{ words: Record<string, { correct: number, wrong: number }> }} progress
 * @param {() => number} randomFn
 * @returns {{ id: string }[]}
 */
export function buildReviewQueue(words, progress, randomFn = Math.random) {
  const queue = [...words].sort((left, right) => {
    const leftStats = progress.words[left.id];
    const rightStats = progress.words[right.id];

    return rightStats.wrong - leftStats.wrong || leftStats.correct - rightStats.correct;
  });

  let groupStart = 0;
  while (groupStart < queue.length) {
    const groupStats = progress.words[queue[groupStart].id];
    let groupEnd = groupStart + 1;

    while (groupEnd < queue.length) {
      const candidateStats = progress.words[queue[groupEnd].id];
      if (
        candidateStats.wrong !== groupStats.wrong ||
        candidateStats.correct !== groupStats.correct
      ) {
        break;
      }
      groupEnd += 1;
    }

    for (let index = groupEnd - 1; index > groupStart; index -= 1) {
      const swapIndex = groupStart + Math.floor(randomFn() * (index - groupStart + 1));
      [queue[index], queue[swapIndex]] = [queue[swapIndex], queue[index]];
    }

    groupStart = groupEnd;
  }

  return queue;
}

function rankWordIdsByWeakness(words, progress) {
  return words
    .map((word, index) => ({ word, index }))
    .sort((left, right) => {
      const leftStats = progress.words[left.word.id];
      const rightStats = progress.words[right.word.id];

      return (
        rightStats.wrong - leftStats.wrong ||
        leftStats.correct - rightStats.correct ||
        left.index - right.index
      );
    })
    .map(({ word }) => word.id);
}

/**
 * Returns the non-blocking practice recommendation for a local calendar date.
 *
 * @param {string} localDate
 * @param {unknown} progress
 * @param {{ id: string, pattern: string }[]} words
 * @returns {{ title: string, mode: string, wordIds: string[], recommendedMinutes: number }}
 */
export function getDailyMission(localDate, progress, words) {
  if (localDate === '2026-09-20') {
    return {
      title: 'Diagnóstico inicial',
      mode: 'diagnostic',
      wordIds: words.map(({ id }) => id),
      recommendedMinutes: 10,
    };
  }

  if (localDate === '2026-09-21') {
    return {
      title: 'Familia ea',
      mode: 'pattern',
      wordIds: words.filter(({ pattern }) => pattern === 'ea').map(({ id }) => id),
      recommendedMinutes: 8,
    };
  }

  if (localDate === '2026-09-22') {
    const safeProgress = sanitizeProgress(progress, words);
    const weakIds = rankWordIdsByWeakness(words, safeProgress).filter(
      (id) => safeProgress.words[id].wrong > 0,
    );
    const eeIds = words.filter(({ pattern }) => pattern === 'ee').map(({ id }) => id);

    return {
      title: 'Familia ee y repaso',
      mode: 'pattern',
      wordIds: [...new Set([...eeIds, ...weakIds])],
      recommendedMinutes: 8,
    };
  }

  if (localDate === '2026-09-23') {
    return {
      title: 'Dictado mixto',
      mode: 'mixed',
      wordIds: words.map(({ id }) => id),
      recommendedMinutes: 10,
    };
  }

  if (localDate === '2026-09-24') {
    return {
      title: 'Simulacro',
      mode: 'mock',
      wordIds: words.map(({ id }) => id),
      recommendedMinutes: 10,
    };
  }

  if (localDate === '2026-09-25') {
    const safeProgress = sanitizeProgress(progress, words);

    return {
      title: 'Calentamiento corto',
      mode: 'warmup',
      wordIds: rankWordIdsByWeakness(words, safeProgress).slice(0, 5),
      recommendedMinutes: 5,
    };
  }

  if (localDate === '2026-09-26') {
    return {
      title: 'Práctica mixta',
      mode: 'mixed',
      wordIds: words.map(({ id }) => id),
      recommendedMinutes: 10,
    };
  }

  return {
    title: 'Práctica mixta',
    mode: 'mixed',
    wordIds: words.map(({ id }) => id),
    recommendedMinutes: 10,
  };
}

function normalizeLanguageTag(lang) {
  return typeof lang === 'string' ? lang.replace(/_/g, '-').toLowerCase() : '';
}

/**
 * Picks the best speech synthesis voice: exact en-GB first, then any English, else null.
 *
 * @param {ArrayLike<{ lang?: string }> | null | undefined} voices
 * @returns {object | null}
 */
export function selectEnglishVoice(voices) {
  if (voices === null || typeof voices !== 'object') {
    return null;
  }

  const candidates = Array.from(voices).filter(
    (voice) => voice !== null && typeof voice === 'object',
  );

  const british = candidates.find((voice) => normalizeLanguageTag(voice.lang) === 'en-gb');
  if (british) {
    return british;
  }

  return (
    candidates.find((voice) => {
      const tag = normalizeLanguageTag(voice.lang);
      return tag === 'en' || tag.startsWith('en-');
    }) ?? null
  );
}

const SPEECH_OVERRIDES = Object.freeze({
  read: Object.freeze({
    sentence: 'I read every day.',
    text: 'Read. I read every day.',
  }),
});

/**
 * Returns the sentence shown and spoken for a word. `read` uses a present-tense
 * sentence so the pronunciation is unambiguous (/riːd/, never /rɛd/).
 *
 * @param {{ id: string, sentence: string }} item
 * @returns {string}
 */
export function getContextSentence(item) {
  return SPEECH_OVERRIDES[item.id]?.sentence ?? item.sentence;
}

/**
 * Returns the text sent to speech synthesis: word, contextual sentence, word.
 *
 * @param {{ id: string, word: string, sentence: string }} item
 * @returns {string}
 */
export function getSpeechText(item) {
  return SPEECH_OVERRIDES[item.id]?.text ?? `${item.word}. ${item.sentence} ${item.word}.`;
}

/**
 * Returns letter names separated into distinct utterance phrases, then repeats
 * the complete word. The display spelling is never changed for pronunciation.
 *
 * @param {{ word: string }} item
 * @returns {string}
 */
export function getSpellingText(item) {
  const word = item.word;
  const letters = word.toUpperCase().split('').map((letter) => `${letter}.`).join(' ');
  return `${letters} ${word[0].toUpperCase()}${word.slice(1)}.`;
}

/**
 * Whether a typed answer is empty and therefore must not be counted as an attempt.
 *
 * @param {unknown} answer
 * @returns {boolean}
 */
export function isBlankAnswer(answer) {
  return typeof answer !== 'string' || normalizeAnswer(answer) === '';
}

/**
 * Splits a word around the first occurrence of its ea/ee pattern.
 *
 * @param {string} word
 * @param {string} pattern
 * @returns {{ before: string, pattern: string, after: string }}
 */
export function splitByPattern(word, pattern) {
  const index = pattern === '' ? -1 : word.indexOf(pattern);
  if (index === -1) {
    return { before: word, pattern: '', after: '' };
  }

  return {
    before: word.slice(0, index),
    pattern,
    after: word.slice(index + pattern.length),
  };
}

/**
 * Text for assistive technology: the whole word plus the highlighted letters spelled out,
 * e.g. `street; letras resaltadas: e-e`.
 *
 * @param {{ word: string, pattern: string }} item
 * @returns {{ word: string, letters: string, text: string }}
 */
export function describeHighlightedWord({ word, pattern }) {
  const { pattern: found } = splitByPattern(word, pattern);
  const letters = [...found].join('-');

  return {
    word,
    letters,
    text: letters === '' ? word : `${word}; letras resaltadas: ${letters}`,
  };
}

export function insertDelayedReview(queue, currentIndex, gap = 2) {
  if (!Array.isArray(queue) || !Number.isSafeInteger(currentIndex) || currentIndex < 0 || currentIndex >= queue.length) {
    return queue;
  }
  const current = queue[currentIndex];
  if (!current || current.delayed === true) return queue;
  if (queue.slice(currentIndex + 1).some((entry) => entry?.id === current.id && entry.delayed === true)) {
    return queue;
  }
  const safeGap = Number.isSafeInteger(gap) && gap >= 0 ? gap : 2;
  const insertAt = Math.min(queue.length, currentIndex + safeGap + 1);
  return [
    ...queue.slice(0, insertAt),
    { id: current.id, delayed: true },
    ...queue.slice(insertAt),
  ];
}

/**
 * Creates the state of one Practice word: an independent first try.
 *
 * @returns {{ phase: string, errors: number }}
 */
export function createPracticeState() {
  return { phase: 'first', errors: 0 };
}

/**
 * Advances one Practice word. First error: retry. Second error: reveal, then
 * hide and require one successful retrieval. `errors === 0` means a clean word.
 *
 * @param {{ phase: string, errors: number }} state
 * @param {{ type: string, correct?: boolean }} event
 * @returns {{ phase: string, errors: number }}
 */
export function advancePractice(state, event) {
  const { phase, errors } = state;

  if (event.type === 'hide' && phase === 'reveal') {
    return { phase: 'retrieve', errors };
  }

  if (event.type !== 'answer') {
    return state;
  }

  if (phase === 'first') {
    return event.correct ? { phase: 'done', errors } : { phase: 'retry', errors: errors + 1 };
  }

  if (phase === 'retry') {
    return event.correct ? { phase: 'done', errors } : { phase: 'reveal', errors: errors + 1 };
  }

  if (phase === 'retrieve') {
    return event.correct ? { phase: 'done', errors } : { phase: 'reveal', errors: errors + 1 };
  }

  return state;
}

/**
 * Creates the state of one Learn word: hear and cue, spelling still hidden.
 *
 * @returns {{ phase: string, familyKnown: boolean, misses: number }}
 */
export function createLearnState() {
  return { phase: 'listen', familyKnown: false, misses: 0 };
}

/**
 * Advances one Learn word: listen, reveal, identify the ea/ee family, hide,
 * then retrieve once. A failed retrieval shows the spelling again.
 *
 * @param {{ phase: string, familyKnown: boolean, misses: number }} state
 * @param {{ type: string, correct?: boolean }} event
 * @returns {{ phase: string, familyKnown: boolean, misses: number }}
 */
export function advanceLearn(state, event) {
  const { phase } = state;

  if (phase === 'listen' && event.type === 'reveal') {
    return { ...state, phase: 'reveal' };
  }

  if (phase === 'reveal' && event.type === 'family' && event.correct === true) {
    return { ...state, familyKnown: true };
  }

  if (phase === 'reveal' && event.type === 'hide' && state.familyKnown) {
    return { ...state, phase: 'retrieve' };
  }

  if (phase === 'retrieve' && event.type === 'answer') {
    return event.correct
      ? { ...state, phase: 'done' }
      : { ...state, phase: 'reveal', misses: state.misses + 1 };
  }

  return state;
}

/**
 * Returns a shuffled copy of the words (Fisher-Yates), leaving the input untouched.
 *
 * @template T
 * @param {T[]} words
 * @param {() => number} randomFn
 * @returns {T[]}
 */
export function shuffleWords(words, randomFn = Math.random) {
  const shuffled = [...words];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(randomFn() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  return shuffled;
}

/**
 * Scores a finished mock. Blank or missing answers are missed but flagged as blank
 * so callers can avoid recording them as attempts.
 *
 * @param {{ id: string, word: string }[]} words
 * @param {Record<string, unknown> | null | undefined} answers
 * @returns {{ score: number, total: number, results: { id: string, answered: boolean, correct: boolean }[], missedIds: string[], blankIds: string[] }}
 */
export function scoreMock(words, answers) {
  const safeAnswers = answers !== null && typeof answers === 'object' ? answers : {};

  const results = words.map(({ id, word }) => {
    const typed = Object.hasOwn(safeAnswers, id) ? safeAnswers[id] : undefined;
    const answered = !isBlankAnswer(typed);

    return { id, answered, correct: answered && checkAnswer(typed, word) };
  });

  return {
    score: results.filter(({ correct }) => correct).length,
    total: words.length,
    results,
    missedIds: results.filter(({ correct }) => !correct).map(({ id }) => id),
    blankIds: results.filter(({ answered }) => !answered).map(({ id }) => id),
  };
}

/**
 * Runtime audio failure for one Mock prompt (speech exists but playback failed).
 *
 * @returns {{ promptId: string | null }}
 */
export function createAudioFailure() {
  return { promptId: null };
}

/**
 * Records that audio failed for a prompt. A missing prompt is ignored.
 *
 * @param {{ promptId: string | null }} failure
 * @param {string | null | undefined} promptId
 * @returns {{ promptId: string | null }}
 */
export function markAudioFailure(failure, promptId) {
  return typeof promptId === 'string' && promptId !== '' ? { promptId } : { ...failure };
}

/**
 * Forgets any audio failure; called whenever the Mock moves to another prompt.
 *
 * @returns {{ promptId: string | null }}
 */
export function clearAudioFailure() {
  return createAudioFailure();
}

/**
 * Whether the Mock must show the Spanish cue: no speech at all, or playback failed for this prompt.
 *
 * @param {{ supported: boolean, failure: { promptId: string | null }, promptId: string }} input
 * @returns {boolean}
 */
export function shouldShowSpanishCue({ supported, failure, promptId }) {
  return !supported || failure.promptId === promptId;
}

export const STORAGE_KEY = 'spelling-ea-ee:v1';

/**
 * Returns progress with one more mock score (last twenty kept); invalid scores are ignored.
 *
 * @param {{ mockScores: object[] }} progress
 * @param {{ score: number, total: number, completedAt: string }} entry
 * @returns {object}
 */
export function addMockScore(progress, entry) {
  const mockScore = sanitizeMockScore(entry);
  if (mockScore === null) {
    return progress;
  }

  return {
    ...progress,
    mockScores: [...progress.mockScores, mockScore].slice(-MAX_MOCK_SCORES),
  };
}

/**
 * Returns the best stored mock score, or null when no mock has been completed.
 *
 * @param {{ mockScores: { score: number, total: number }[] }} progress
 * @returns {{ score: number, total: number } | null}
 */
export function getBestScore(progress) {
  let best = null;

  for (const { score, total } of progress.mockScores) {
    if (best === null || score / total > best.score / best.total) {
      best = { score, total };
    }
  }

  return best;
}

export function getReviewStatus(stats, now) {
  if (!stats || !isNonNegativeInteger(stats.seen) || stats.seen === 0) return 'new';
  const level = isNonNegativeInteger(stats.level) && stats.level <= 2 ? stats.level : 0;
  const nextReviewAt = sanitizeTimestamp(stats.nextReviewAt);
  const safeNow = sanitizeTimestamp(now);
  if ((level === 0 && stats.wrong > 0) || (nextReviewAt !== null && safeNow !== null && nextReviewAt <= safeNow)) {
    return 'due';
  }
  return level >= 2 ? 'secure' : 'learning';
}

export function getDueWordIds(words, progress, now) {
  return words
    .map(({ id }, index) => ({ id, index, stats: progress.words[id] }))
    .filter(({ stats }) => getReviewStatus(stats, now) === 'due')
    .sort((left, right) => {
      const leftError = left.stats.wrong - left.stats.correct;
      const rightError = right.stats.wrong - right.stats.correct;
      const leftLevel = isNonNegativeInteger(left.stats.level) ? left.stats.level : 0;
      const rightLevel = isNonNegativeInteger(right.stats.level) ? right.stats.level : 0;
      return leftLevel - rightLevel || rightError - leftError || left.index - right.index;
    })
    .map(({ id }) => id);
}

/**
 * Lists words whose mistakes outweigh their successes, most-missed first.
 *
 * @param {{ id: string }[]} words
 * @param {{ words: Record<string, { correct: number, wrong: number }> }} progress
 * @returns {string[]}
 */
export function getWeakWordIds(words, progress) {
  return words
    .map(({ id }, index) => ({ id, index, gap: progress.words[id].wrong - progress.words[id].correct }))
    .filter(({ gap }) => gap > 0)
    .sort((left, right) => right.gap - left.gap || left.index - right.index)
    .map(({ id }) => id);
}

/**
 * Summarises aggregate progress for the home screen.
 *
 * @param {{ id: string }[]} words
 * @param {{ words: Record<string, { seen: number, correct: number, wrong: number }> }} progress
 * @returns {{ total: number, practised: number, mastered: number, weak: number }}
 */
export function summarizeProgress(words, progress) {
  const stats = words.map(({ id }) => progress.words[id]);

  return {
    total: words.length,
    practised: stats.filter(({ seen }) => seen > 0).length,
    mastered: stats.filter(({ level }) => level >= 2).length,
    weak: stats.filter(({ correct, wrong }) => wrong > correct).length,
  };
}

/**
 * Loads progress from a Storage-like object; never throws and never trusts stored data.
 *
 * @param {{ getItem: (key: string) => string | null } | null | undefined} storage
 * @param {{ id: string }[]} words
 * @param {string} key
 * @returns {object}
 */
export function loadProgress(storage, words, key = STORAGE_KEY) {
  let parsed = null;

  try {
    const raw = storage.getItem(key);
    parsed = raw === null ? null : JSON.parse(raw);
  } catch {
    parsed = null;
  }

  return sanitizeProgress(parsed, words);
}

/**
 * Saves the aggregate progress snapshot. Returns false when storage is unavailable.
 *
 * @param {{ setItem: (key: string, value: string) => void } | null | undefined} storage
 * @param {object} progress
 * @param {string} key
 * @returns {boolean}
 */
export function saveProgress(storage, progress, key = STORAGE_KEY) {
  try {
    storage.setItem(key, JSON.stringify(progress));
    return true;
  } catch {
    return false;
  }
}

/**
 * Removes the stored snapshot. Returns false when storage is unavailable.
 *
 * @param {{ removeItem: (key: string) => void } | null | undefined} storage
 * @param {string} key
 * @returns {boolean}
 */
export function clearProgress(storage, key = STORAGE_KEY) {
  try {
    storage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

/**
 * Formats a Date as a local calendar day (YYYY-MM-DD); empty string for invalid dates.
 *
 * @param {Date} date
 * @returns {string}
 */
export function formatLocalDate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return '';
  }

  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/**
 * Maps a daily mission to the view that runs it.
 *
 * @param {{ mode: string, wordIds: string[] }} mission
 * @returns {{ view: 'mock' | 'practice', wordIds: string[] }}
 */
export function getMissionRoute(mission) {
  return {
    view: mission.mode === 'mock' ? 'mock' : 'practice',
    wordIds: [...mission.wordIds],
  };
}

/**
 * Recommends the next non-blocking step after a session or mock.
 *
 * @param {{ score: number, total: number, missedCount: number } | null} summary
 * @returns {{ mode: 'home' | 'review' | 'learn', message: string }}
 */
export function recommendNextStep(summary) {
  const total = summary?.total;
  const missedCount = summary?.missedCount;

  if (!Number.isSafeInteger(total) || total < 1 || !Number.isSafeInteger(missedCount) || missedCount < 1) {
    return {
      mode: 'home',
      message: 'Sin errores. Repite otro día para consolidar lo aprendido.',
    };
  }

  const noun = missedCount === 1 ? 'palabra' : 'palabras';

  if (missedCount * 2 >= total) {
    return {
      mode: 'learn',
      message: `Vuelve a aprender ${missedCount} ${noun} paso a paso.`,
    };
  }

  return {
    mode: 'review',
    message: `Repasa ${missedCount} ${noun} con errores.`,
  };
}

/**
 * Builds a generic, link-free text summary for sharing or copying.
 *
 * @param {{ kind: 'mock' | 'practice', score: number, total: number, best: { score: number, total: number } | null, missedWords: { word: string }[] }} result
 * @returns {string}
 */
export function buildShareText({ kind, score, total, best, missedWords }) {
  const lines = ['Boadilla School · Spelling: ea + ee'];

  lines.push(
    kind === 'mock' ? `Simulacro: ${score}/${total}` : `Práctica: ${score}/${total} a la primera`,
  );

  if (best) {
    lines.push(`Mejor resultado: ${best.score}/${best.total}`);
  }

  if (missedWords.length > 0) {
    lines.push(`Para repasar: ${missedWords.map(({ word }) => word).join(', ')}`);
  }

  return lines.join('\n');
}
