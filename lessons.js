import { WORDS } from './data.js';

const PH_F_WORDS = Object.freeze([
  { id: 'dolphin', word: 'dolphin', pattern: 'ph', cue: 'delfín', sentence: 'The dolphin jumps out of the water.' },
  { id: 'telephone', word: 'telephone', pattern: 'ph', cue: 'teléfono', sentence: 'The telephone is ringing.' },
  { id: 'alphabet', word: 'alphabet', pattern: 'ph', cue: 'abecedario', sentence: 'I know the letters of the alphabet.' },
  { id: 'trophy', word: 'trophy', pattern: 'ph', cue: 'trofeo', sentence: 'Our team won a trophy.' },
  { id: 'photograph', word: 'photograph', pattern: 'ph', cue: 'fotografía', sentence: 'This photograph shows a sunny day.' },
  { id: 'elephant', word: 'elephant', pattern: 'ph', cue: 'elefante', sentence: 'The elephant has a long trunk.' },
  { id: 'pharmacy', word: 'pharmacy', pattern: 'ph', cue: 'farmacia', sentence: 'We buy medicine at the pharmacy.' },
  { id: 'family', word: 'family', pattern: 'f', cue: 'familia', sentence: 'My family eats dinner together.' },
  { id: 'friends', word: 'friends', pattern: 'f', cue: 'amigos', sentence: 'My friends play with me.' },
  { id: 'people', word: 'people', pattern: '', cue: 'personas', sentence: 'The people are walking in the park.' },
].map(Object.freeze));

const SH_CH_WORDS = Object.freeze([
  { id: 'shorts', word: 'shorts', pattern: 'sh', cue: 'pantalones cortos', sentence: 'I wear shorts on a sunny day.' },
  { id: 'shops', word: 'shops', pattern: 'sh', cue: 'tiendas', sentence: 'There are three shops on this street.' },
  { id: 'shells', word: 'shells', pattern: 'sh', cue: 'conchas', sentence: 'We found shells on the beach.' },
  { id: 'shoes', word: 'shoes', pattern: 'sh', cue: 'zapatos', sentence: 'I put on my shoes.' },
  { id: 'chops', word: 'chops', pattern: 'ch', cue: 'chuletas', sentence: 'There are two chops on the plate.' },
  { id: 'cheese', word: 'cheese', pattern: 'ch', cue: 'queso', sentence: 'I like cheese in my sandwich.' },
  { id: 'child', word: 'child', pattern: 'ch', cue: 'niño o niña', sentence: 'The child is reading a book.' },
  { id: 'chess', word: 'chess', pattern: 'ch', cue: 'ajedrez', sentence: 'We play chess together.' },
  { id: 'you', word: 'you', pattern: '', cue: 'tú', sentence: 'You are my friend.' },
  { id: 'your', word: 'your', pattern: '', cue: 'tu (algo que te pertenece)', sentence: 'This is your bag.' },
].map(Object.freeze));

export const LESSONS = Object.freeze([
  Object.freeze({
    id: '2026-09-25', date: 'Viernes 25 de septiembre de 2026', shortDate: '25/09/2026',
    title: 'Palabras con ea y ee', patterns: Object.freeze(['ea', 'ee']),
    intro: 'Las letras ea y ee suenan igual, pero se escriben distinto: ea en «meat» y ee en «street».',
    words: WORDS, storageKey: 'spelling-ea-ee:v1',
  }),
  Object.freeze({
    id: '2026-10-02', date: 'Viernes 2 de octubre de 2026', shortDate: '02/10/2026',
    title: 'Palabras con ph y f', patterns: Object.freeze(['ph', 'f']),
    intro: 'Las letras ph suenan como f: ph en «dolphin» y f en «family». También practicamos «people», una palabra especial.',
    words: PH_F_WORDS, storageKey: 'spelling-ea-ee:list:2026-10-02:v1',
  }),
  Object.freeze({
    id: '2026-10-16', date: 'Viernes 16 de octubre de 2026', shortDate: '16/10/2026',
    title: 'Palabras con sh y ch', patterns: Object.freeze(['sh', 'ch']),
    intro: 'Escucha la diferencia entre sh en «shorts» y ch en «chess». También practicamos «you» y «your», dos palabras especiales.',
    words: SH_CH_WORDS, storageKey: 'spelling-ea-ee:list:2026-10-16:v1',
  }),
]);

export const ALL_WORDS = Object.freeze(LESSONS.flatMap(lesson => lesson.words));

export function getLesson(search) {
  const id = new URLSearchParams(search).get('list');
  return LESSONS.find(lesson => lesson.id === id) ?? null;
}

export function getLessonHref(lesson) {
  return `./?list=${encodeURIComponent(lesson.id)}`;
}
