// Generated from separately synthesized en-GB-SoniaNeural letter/word segments.
// Values are seconds in audio/spelling-en-gb-v1/*.mp3. Each clip contains
// 0.55 s between letters and 1.25 s of real silence before the final word.
const EMPTY_CUES = Object.freeze({
  letters: Object.freeze([]),
  lastLetterEndAt: 0,
  pauseBeforeWord: 0,
  wordAt: 0,
});

const CUES = Object.freeze({
  easy: Object.freeze({ letters: Object.freeze([0, 0.9509, 1.9083, 2.9084]), lastLetterEndAt: 3.4174, pauseBeforeWord: 1.25, wordAt: 4.6674 }),
  meat: Object.freeze({ letters: Object.freeze([0, 0.9155, 1.8665, 2.8238]), lastLetterEndAt: 3.2515, pauseBeforeWord: 1.25, wordAt: 4.5015 }),
  peanuts: Object.freeze({ letters: Object.freeze([0, 0.9667, 1.9176, 2.875, 3.8026, 4.7796, 5.7573]), lastLetterEndAt: 6.2074, pauseBeforeWord: 1.25, wordAt: 7.4574 }),
  between: Object.freeze({ letters: Object.freeze([0, 0.9536, 1.9045, 2.8822, 4.1214, 5.0723, 6.0232]), lastLetterEndAt: 6.4008, pauseBeforeWord: 1.25, wordAt: 7.6508 }),
  read: Object.freeze({ letters: Object.freeze([0, 1.0213, 1.9722, 2.9296]), lastLetterEndAt: 3.3548, pauseBeforeWord: 1.25, wordAt: 4.6048 }),
  jeans: Object.freeze({ letters: Object.freeze([0, 1.0164, 1.9673, 2.9247, 3.8523]), lastLetterEndAt: 4.3023, pauseBeforeWord: 1.25, wordAt: 5.5523 }),
  heel: Object.freeze({ letters: Object.freeze([0, 1.032, 1.983, 2.9339]), lastLetterEndAt: 3.3248, pauseBeforeWord: 1.25, wordAt: 4.5748 }),
  sweets: Object.freeze({ letters: Object.freeze([0, 1.0001, 2.2393, 3.1902, 4.1411, 5.1188]), lastLetterEndAt: 5.5688, pauseBeforeWord: 1.25, wordAt: 6.8188 }),
  street: Object.freeze({ letters: Object.freeze([0, 1.0001, 1.9778, 2.999, 3.95, 4.9009]), lastLetterEndAt: 5.3285, pauseBeforeWord: 1.25, wordAt: 6.5785 }),
  reach: Object.freeze({ letters: Object.freeze([0, 1.0213, 1.9722, 2.9296, 3.9868]), lastLetterEndAt: 4.4688, pauseBeforeWord: 1.25, wordAt: 5.7188 }),
});

export function getSpellingCues(item) {
  return CUES[item?.id] ?? EMPTY_CUES;
}

export function getSpellingCueIndex(item, currentTime) {
  if (!Number.isFinite(currentTime) || currentTime < 0) {
    return -1;
  }
  const cues = getSpellingCues(item);
  const finalLetterEnd = Number.isFinite(cues.lastLetterEndAt) ? cues.lastLetterEndAt : cues.wordAt;
  if (cues.letters.length === 0 || currentTime >= finalLetterEnd) {
    return -1;
  }

  let active = -1;
  for (let index = 0; index < cues.letters.length; index += 1) {
    if (currentTime < cues.letters[index]) {
      break;
    }
    active = index;
  }
  return active;
}
