const vocabulary = [
  {
    id: 'easy',
    word: 'easy',
    pattern: 'ea',
    cue: 'fácil',
    sentence: 'This spelling game is easy.',
  },
  {
    id: 'meat',
    word: 'meat',
    pattern: 'ea',
    cue: 'carne',
    sentence: 'We eat meat for lunch.',
  },
  {
    id: 'peanuts',
    word: 'peanuts',
    pattern: 'ea',
    cue: 'cacahuetes',
    sentence: 'The peanuts are in a bowl.',
  },
  {
    id: 'between',
    word: 'between',
    pattern: 'ee',
    cue: 'entre',
    sentence: 'The ball is between the boxes.',
  },
  {
    id: 'read',
    word: 'read',
    pattern: 'ea',
    cue: 'leer',
    sentence: 'I read a book every night.',
  },
  {
    id: 'jeans',
    word: 'jeans',
    pattern: 'ea',
    cue: 'vaqueros',
    sentence: 'She is wearing blue jeans.',
  },
  {
    id: 'heel',
    word: 'heel',
    pattern: 'ee',
    cue: 'talón',
    sentence: 'Your heel is at the back of your foot.',
  },
  {
    id: 'sweets',
    word: 'sweets',
    pattern: 'ee',
    cue: 'dulces',
    sentence: 'The sweets are in the jar.',
  },
  {
    id: 'street',
    word: 'street',
    pattern: 'ee',
    cue: 'calle',
    sentence: 'We cross the street safely.',
  },
  {
    id: 'reach',
    word: 'reach',
    pattern: 'ea',
    cue: 'alcanzar',
    sentence: 'I can reach the shelf.',
  },
];

export const WORDS = Object.freeze(vocabulary.map((item) => Object.freeze(item)));
