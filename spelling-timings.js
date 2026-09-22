// Generated from en-GB-SoniaNeural WordBoundary offsets. Values are seconds
// relative to the first spoken letter in audio/spelling-en-gb-v1/*.mp3.
const EMPTY_CUES = Object.freeze({ letters: Object.freeze([]), wordAt: 0 });

const CUES = Object.freeze({
  easy: Object.freeze({ letters: Object.freeze([0, 0.3594, 0.7032, 1.0782]), wordAt: 1.5313 }),
  meat: Object.freeze({ letters: Object.freeze([0, 0.4063, 0.8125, 1.125]), wordAt: 1.5 }),
  peanuts: Object.freeze({ letters: Object.freeze([0, 0.4532, 0.8438, 1.1875, 1.5313, 1.875, 2.2657]), wordAt: 2.5938 }),
  between: Object.freeze({ letters: Object.freeze([0, 0.3906, 0.7187, 1.1094, 1.7969, 2.2187, 2.6562]), wordAt: 3.6531 }),
  read: Object.freeze({ letters: Object.freeze([0, 0.5313, 1.0625, 1.5]), wordAt: 1.9063 }),
  jeans: Object.freeze({ letters: Object.freeze([0, 0.4844, 0.8594, 1.1875, 1.5156]), wordAt: 1.8438 }),
  heel: Object.freeze({ letters: Object.freeze([0, 0.5625, 0.9375, 1.3594]), wordAt: 1.6719 }),
  sweets: Object.freeze({ letters: Object.freeze([0, 0.3907, 1.0782, 1.5157, 1.875, 2.2969]), wordAt: 2.6094 }),
  street: Object.freeze({ letters: Object.freeze([0, 0.4375, 0.9219, 1.3438, 1.7969, 2.1406]), wordAt: 2.5 }),
  reach: Object.freeze({ letters: Object.freeze([0, 0.375, 0.7969, 1.1563, 1.7657]), wordAt: 2.1563 }),
});

export function getSpellingCues(item) {
  return CUES[item?.id] ?? EMPTY_CUES;
}

export function getSpellingCueIndex(item, currentTime) {
  if (!Number.isFinite(currentTime) || currentTime < 0) {
    return -1;
  }
  const cues = getSpellingCues(item);
  if (cues.letters.length === 0 || currentTime >= cues.wordAt) {
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
