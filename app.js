import { WORDS } from './data.js';
import { getWordIllustration } from './illustrations.js';
import {
  addMockScore,
  advanceLearn,
  advancePractice,
  buildReviewQueue,
  buildShareText,
  checkAnswer,
  clearAudioFailure,
  clearProgress,
  createAudioFailure,
  createEmptyProgress,
  createLearnState,
  createPracticeState,
  describeHighlightedWord,
  formatLocalDate,
  getBestScore,
  getContextSentence,
  getDailyMission,
  getDueWordIds,
  getMissionRoute,
  getSpeechText,
  getSpellingText,
  getWeakWordIds,
  insertDelayedReview,
  isBlankAnswer,
  loadProgress,
  markAudioFailure,
  recommendNextStep,
  recordAttempt,
  saveProgress,
  scoreMock,
  shouldShowSpanishCue,
  shuffleWords,
  splitByPattern,
  summarizeProgress,
} from './logic.js';
import { planFocus } from './focus-policy.js';
import {
  appendInkPoint,
  clearInk,
  createInkState,
  finishInkStroke,
  startInkStroke,
  undoInkStroke,
} from './ink-pad.js';
import { createSpeaker } from './speech.js';
import { getSpellingCueIndex } from './spelling-timings.js';
import { getAudioLabel, normalizeChildren } from './ui-helpers.js';

const APP_TITLE = 'Boadilla School · Spelling: ea + ee';
const MODULE_TITLE = 'Palabras con ea y ee';
const MODULE_EYEBROW = 'ENGLISH · SPELLING';
const SVG_NS = 'http://www.w3.org/2000/svg';

const MESSAGES = {
  audioUnsupported:
    'Este navegador no puede reproducir audio. Pide a un adulto que te dicte la palabra o usa la pista en español.',
  audioNoVoice: 'No hay una voz en inglés instalada: el audio puede sonar con otro acento.',
  audioError: 'No se pudo reproducir el audio. Comprueba el volumen y pulsa Escuchar otra vez.',
  audioErrorMock: 'No se pudo reproducir el audio. Te mostramos la pista en español.',
  storageUnavailable:
    'Este navegador no permite guardar el progreso. Puedes practicar, pero se perderá al cerrar la página.',
  clearFailed: 'No se pudo borrar el progreso guardado. Inténtalo de nuevo.',
  blank: 'Escribe la palabra antes de comprobar.',
};

const wordsById = new Map(WORDS.map((item) => [item.id, item]));
const toWords = (ids) => ids.map((id) => wordsById.get(id)).filter(Boolean);
const allIds = () => WORDS.map(({ id }) => id);
const plural = (count, one, many) => `${count} ${count === 1 ? one : many}`;

const dom = {
  eyebrow: document.getElementById('eyebrow'),
  title: document.getElementById('screen-title'),
  intro: document.getElementById('module-intro'),
  back: document.getElementById('back'),
  progressStrip: document.getElementById('progress-strip'),
  progressLabel: document.getElementById('progress-label'),
  progress: document.getElementById('progress'),
  main: document.getElementById('main'),
  dock: document.getElementById('dock'),
  feedback: document.getElementById('feedback'),
  audioNote: document.getElementById('audio-note'),
  storageNote: document.getElementById('storage-note'),
  fullscreenToggle: document.getElementById('fullscreen-toggle'),
};

/* ---------- Application state ---------- */

const state = {
  view: 'home',
  nav: 0,
  confirmReset: false,
  familiesOpen: false,
  feedback: null,
  learn: null,
  practice: null,
  notebook: null,
  mock: null,
  results: null,
  shareText: '',
  inputMethod: 'keyboard',
  selectedIds: new Set(allIds()),
};

/* ---------- Storage and progress (aggregate counters only) ---------- */

function getStorage() {
  try {
    return window.localStorage ?? null;
  } catch {
    return null;
  }
}

const storage = getStorage();
let progress = loadProgress(storage, WORDS);

function showStorageNote(available) {
  dom.storageNote.hidden = available;
  dom.storageNote.textContent = available ? '' : MESSAGES.storageUnavailable;
}

function persist() {
  showStorageNote(saveProgress(storage, progress));
}

function record(wordId, wasCorrect) {
  progress = recordAttempt(progress, wordId, wasCorrect, new Date().toISOString());
  persist();
}

/* ---------- Fullscreen and visual viewport ---------- */

function fullscreenElement() {
  return document.fullscreenElement ?? document.webkitFullscreenElement ?? null;
}

function fullscreenRequest() {
  return document.documentElement.requestFullscreen ?? document.documentElement.webkitRequestFullscreen;
}

function fullscreenExit() {
  return document.exitFullscreen ?? document.webkitExitFullscreen;
}

function paintFullscreenToggle() {
  const supported = typeof fullscreenRequest() === 'function';
  const active = fullscreenElement() !== null;
  dom.fullscreenToggle.hidden = !supported;
  dom.fullscreenToggle.setAttribute('aria-pressed', String(active));
  dom.fullscreenToggle.setAttribute('aria-label', active ? 'Salir de pantalla completa' : 'Activar pantalla completa');
  dom.fullscreenToggle.querySelector('span').textContent = active ? 'Salir de pantalla completa' : 'Pantalla completa';
}

async function toggleFullscreen() {
  try {
    if (fullscreenElement() !== null) {
      const exit = fullscreenExit();
      if (typeof exit === 'function') await exit.call(document);
    } else {
      const request = fullscreenRequest();
      if (typeof request === 'function') await request.call(document.documentElement);
    }
  } catch {
    announce('El navegador no ha podido activar la pantalla completa.', 'retry');
  }
  paintFullscreenToggle();
}

let viewportFrame = 0;

function keepAnswerVisible() {
  const answer = document.activeElement?.matches?.('#answer') ? document.activeElement : null;
  if (answer === null) return;
  const target = answer.closest('form') ?? answer;
  cancelAnimationFrame(viewportFrame);
  viewportFrame = requestAnimationFrame(() => {
    const viewport = window.visualViewport;
    const viewportTop = viewport?.offsetTop ?? 0;
    const viewportBottom = viewportTop + (viewport?.height ?? window.innerHeight);
    const margin = 12;
    const box = target.getBoundingClientRect();
    if (box.bottom > viewportBottom - margin) {
      window.scrollBy({ top: box.bottom - viewportBottom + margin, behavior: 'auto' });
    } else if (box.top < viewportTop + margin) {
      window.scrollBy({ top: box.top - viewportTop - margin, behavior: 'auto' });
    }
  });
}

function syncVisualViewport() {
  const viewport = window.visualViewport;
  const viewportHeight = Math.max(1, Math.round(viewport?.height ?? window.innerHeight));
  const viewportTop = Math.max(0, Math.round(viewport?.offsetTop ?? 0));
  const keyboardInset = Math.max(0, Math.round(window.innerHeight - viewportHeight - viewportTop));
  document.documentElement.style.setProperty('--visual-viewport-height', `${viewportHeight}px`);
  document.documentElement.style.setProperty('--keyboard-inset', `${keyboardInset}px`);
  document.body.classList.toggle('keyboard-open', keyboardInset > 80);
  keepAnswerVisible();
}

dom.fullscreenToggle.addEventListener('click', toggleFullscreen);
document.addEventListener('fullscreenchange', paintFullscreenToggle);
document.addEventListener('webkitfullscreenchange', paintFullscreenToggle);
document.addEventListener('focusin', (event) => {
  if (event.target?.matches?.('#answer')) {
    requestAnimationFrame(() => {
      syncVisualViewport();
      keepAnswerVisible();
    });
  }
});
window.addEventListener('resize', syncVisualViewport, { passive: true });
window.visualViewport?.addEventListener('resize', syncVisualViewport, { passive: true });
window.visualViewport?.addEventListener('scroll', syncVisualViewport, { passive: true });
paintFullscreenToggle();
syncVisualViewport();

/* ---------- DOM helpers (textContent / createElement only) ---------- */

function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);

  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === null || value === false) {
      continue;
    }
    if (key === 'class') {
      node.className = value;
    } else if (key === 'text') {
      node.textContent = value;
    } else if (key.startsWith('on')) {
      node.addEventListener(key.slice(2), value);
    } else {
      node.setAttribute(key, value === true ? '' : value);
    }
  }

  node.append(...normalizeChildren(children));
  return node;
}

function chevron() {
  const svg = document.createElementNS(SVG_NS, 'svg');
  const path = document.createElementNS(SVG_NS, 'path');
  const svgAttributes = { viewBox: '0 0 16 16', width: '16', height: '16', 'aria-hidden': 'true', focusable: 'false', class: 'icon mode-go' };
  const pathAttributes = { d: 'M6 3l5 5-5 5', fill: 'none', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' };

  for (const [key, value] of Object.entries(svgAttributes)) {
    svg.setAttribute(key, value);
  }
  for (const [key, value] of Object.entries(pathAttributes)) {
    path.setAttribute(key, value);
  }
  svg.append(path);
  return svg;
}

/**
 * Feedback lives next to the work: a persistent sr-only live region announces it,
 * and a visible, non-live slot inside the card shows it.
 */
function paintFeedback() {
  for (const slot of document.querySelectorAll('[data-feedback]')) {
    const feedback = state.feedback;
    slot.textContent = feedback?.message ?? '';
    if (feedback === null) {
      delete slot.dataset.tone;
    } else {
      slot.dataset.tone = feedback.tone;
    }
  }
}

function announce(message = '', tone = 'info') {
  dom.feedback.textContent = message;
  state.feedback = message === '' ? null : { message, tone };
  paintFeedback();
}

const feedbackSlot = ({ reserve = true } = {}) =>
  el('p', { class: reserve ? 'feedback is-reserved' : 'feedback', 'data-feedback': '' });

function button(label, onClick, { kind = 'primary', ...attrs } = {}) {
  const classes = { primary: 'btn', secondary: 'btn btn-secondary', link: 'btn-link', danger: 'btn btn-danger' };
  return el('button', { type: 'button', class: classes[kind], onclick: onClick, ...attrs }, label);
}

/* ---------- Audio ---------- */

let persistentAudioNote = '';
let audioPlayedFor = null;
let activeSpellingId = null;

function handleAudioStatus(status) {
  if (status === 'unsupported') {
    persistentAudioNote = MESSAGES.audioUnsupported;
  } else if (status === 'no-english-voice') {
    persistentAudioNote = MESSAGES.audioNoVoice;
  } else if (status === 'ready') {
    persistentAudioNote = '';
  }

  const mockFailed = status === 'error' && registerMockAudioFailure();
  const note = status === 'error' ? (mockFailed ? MESSAGES.audioErrorMock : MESSAGES.audioError) : persistentAudioNote;
  dom.audioNote.hidden = note === '';
  dom.audioNote.textContent = note;

  const speaking = status === 'speaking';
  for (const node of document.querySelectorAll('[data-audio]')) {
    node.dataset.speaking = String(speaking);
    node.textContent = getAudioLabel({ speaking, played: audioPlayedFor === node.dataset.audio });
  }

  if (activeSpellingId !== null && ['idle', 'error', 'unsupported'].includes(status)) {
    paintSpellingCue(activeSpellingId, -1);
    activeSpellingId = null;
  }
}

function getSpeechSynthesis() {
  try {
    return window.speechSynthesis;
  } catch {
    return undefined;
  }
}

const speaker = createSpeaker({
  synth: getSpeechSynthesis(),
  Utterance: window.SpeechSynthesisUtterance,
  AudioCtor: window.Audio,
  onStatus: handleAudioStatus,
});

function paintSpellingCue(wordId, activeIndex) {
  const panel = document.querySelector(`[data-spelling="${wordId}"]`);
  if (!panel) return;
  for (const [index, letter] of [...panel.querySelectorAll('.spelling-letter')].entries()) {
    letter.dataset.active = String(index === activeIndex);
  }
}

function playWord(item, slow = false) {
  activeSpellingId = null;
  audioPlayedFor = item.id;
  return speaker.speak(getSpeechText(item), { slow });
}

function playSpelling(item, slow = false) {
  const started = speaker.speak(getSpellingText(item), {
    slow,
    onTime: (seconds) => {
      if (activeSpellingId === item.id) {
        paintSpellingCue(item.id, getSpellingCueIndex(item, seconds));
      }
    },
  });
  activeSpellingId = started ? item.id : null;
  paintSpellingCue(item.id, started ? 0 : -1);
  return started;
}

function spellingPanel(item) {
  return el(
    'section',
    { class: 'spelling-panel', 'data-spelling': item.id, 'aria-label': `Deletreo de ${item.word}` },
    el('p', { class: 'spelling-kicker', text: 'Escucha el deletreo' }),
    el(
      'div',
      { class: 'spelling-letters', lang: 'en-GB', 'aria-hidden': 'true' },
      ...item.word.toUpperCase().split('').map((letter) => el('span', { class: 'spelling-letter', 'data-active': 'false', text: letter })),
    ),
    el('p', { class: 'sr-only', lang: 'en-GB', text: getSpellingText(item) }),
    el(
      'div',
      { class: 'spelling-actions', role: 'group', 'aria-label': 'Controles del deletreo' },
      button('Deletrear otra vez', () => playSpelling(item), { kind: 'secondary' }),
      button('Deletrear más despacio', () => playSpelling(item, true), { kind: 'secondary' }),
    ),
  );
}

function audioButton(item) {
  const normal = el(
    'button',
    {
      type: 'button',
      class: 'btn btn-secondary btn-audio',
      'data-audio': item.id,
      'data-speaking': 'false',
      onclick: () => playWord(item),
    },
    getAudioLabel({ speaking: false, played: audioPlayedFor === item.id }),
  );
  const slower = el('button', {
    type: 'button',
    class: 'btn btn-secondary btn-audio-slow',
    'data-audio-slow': item.id,
    'aria-label': 'Escuchar más despacio',
    onclick: () => playWord(item, true),
    text: 'Más despacio',
  });
  return el('div', {
    class: 'audio-controls',
    role: 'group',
    'aria-label': 'Audio en inglés',
  }, normal, slower);
}

/* ---------- Word, cue and form building blocks ---------- */

function wordPicture(item) {
  const illustration = getWordIllustration(item.id);
  const fallback = el('figcaption', { class: 'picture-fallback', hidden: true, text: illustration.alt });
  const image = el('img', {
    src: illustration.src,
    alt: illustration.alt,
    width: 320,
    height: 200,
    loading: 'eager',
    decoding: 'async',
    draggable: 'false',
    onerror: () => {
      image.hidden = true;
      fallback.hidden = false;
    },
  });
  return el('figure', { class: 'word-picture', lang: 'es' }, image, fallback);
}

function wordElement(item) {
  const { before, pattern, after } = splitByPattern(item.word, item.pattern);
  const { word, text } = describeHighlightedWord(item);

  return el(
    'span',
    { class: 'word-group' },
    el(
      'span',
      { class: 'word', lang: 'en', 'aria-hidden': 'true' },
      before !== '' ? el('span', { text: before }) : null,
      el('mark', { class: 'pattern', text: pattern }),
      after !== '' ? el('span', { text: after }) : null,
    ),
    el('span', { class: 'sr-only' }, el('span', { lang: 'en', text: word }), text.slice(word.length)),
  );
}

function sentenceElement(item) {
  return el('p', { class: 'sentence', lang: 'en', text: getContextSentence(item) });
}

function cueElement(item) {
  return el(
    'p',
    { class: 'cue' },
    el('span', { class: 'cue-label', text: 'Pista en español: ' }),
    el('strong', { lang: 'es', text: item.cue }),
  );
}

function stepHeading(text, autofocus = true) {
  return el('h2', { class: 'step-title', tabindex: '-1', 'data-autofocus': autofocus ? '' : null }, text);
}

const stepHelp = (text) => el('p', { class: 'step-help', text });

function answerForm({
  label,
  value = '',
  hint = '',
  onSubmit,
  onInput,
  submitLabel = 'Comprobar',
  secondaryActions = [],
}) {
  const methodHint = state.inputMethod === 'pencil'
    ? 'Activa la escritura a mano del teclado de la tablet y escribe con el lápiz.'
    : 'Escribe la palabra completa, sin autocorrección.';
  const fullHint = hint === '' ? methodHint : `${hint} ${methodHint}`;
  const input = el('input', {
    id: 'answer',
    name: 'answer',
    type: 'text',
    inputmode: 'text',
    autocomplete: 'off',
    autocorrect: 'off',
    autocapitalize: 'none',
    spellcheck: 'false',
    enterkeyhint: 'done',
    maxlength: '30',
    'aria-describedby': 'answer-hint',
    'data-autofocus': '',
    'data-focus-key': 'answer',
    oninput: () => onInput?.(input.value),
  });
  input.value = value;

  const form = el(
    'form',
    {
      id: 'answer-form',
      class: `answer answer-${state.inputMethod}`,
      'data-input-method': state.inputMethod,
      novalidate: true,
      onsubmit: (event) => {
        event.preventDefault();
        onSubmit(input.value);
      },
    },
    el('label', { for: 'answer', text: label }),
    input,
    el('p', { id: 'answer-hint', class: 'hint', text: fullHint }),
    el('div', { class: 'answer-actions' }, ...secondaryActions, submitButton(submitLabel)),
  );

  return { form, input };
}

const submitButton = (label) => el('button', { type: 'submit', form: 'answer-form', class: 'btn' }, label);

/* ---------- Views, focus and rendering ---------- */

const VIEW_TITLES = {
  home: MODULE_TITLE,
  learn: 'Aprender',
  practice: 'Practicar',
  notebook: 'Cuaderno con lápiz',
  review: 'Repasar errores',
  mock: 'Simulacro',
  results: 'Has terminado',
};

function setProgress(value, max, label) {
  dom.progressStrip.hidden = value === null;
  if (value !== null) {
    dom.progress.max = max;
    dom.progress.value = value;
    dom.progressLabel.textContent = label;
  }
}

function setView(main, dockNodes = []) {
  dom.main.replaceChildren(...normalizeChildren(main));
  dom.dock.replaceChildren(...normalizeChildren(dockNodes));
}

function go(view) {
  state.view = view;
  state.nav += 1;
  state.confirmReset = false;
  render();
}

function goHome() {
  speaker.cancel();
  state.learn = null;
  state.practice = null;
  state.notebook = null;
  state.mock = null;
  announce('');
  go('home');
}

/** A screen key changes on genuine navigation or step changes, never on same-step feedback. */
function currentScreenKey() {
  const { view, learn, practice, mock } = state;
  let step = '';

  if (view === 'learn' && learn) {
    step = learn.finished ? 'finished' : `${learn.index}:${learn.machine.phase}`;
  } else if (view === 'practice' && practice) {
    step = practice.queue.length === 0 ? 'empty' : `${practice.index}:${practice.machine.phase}`;
  } else if (view === 'notebook' && state.notebook) {
    step = state.notebook.finished ? 'finished' : `${state.notebook.index}:${state.notebook.revealed ? 'compare' : 'write'}`;
  } else if (view === 'mock' && mock) {
    step = mock.stage === 'review' ? 'review' : `${mock.index}`;
  }

  return `${view}:${state.nav}:${step}`;
}

const findByFocusKey = (key) => [...document.querySelectorAll('[data-focus-key]')].find((node) => node.dataset.focusKey === key);

let lastFocusState = null;

function applyFocus(plan) {
  const screenTarget = () => dom.main.querySelector('[data-autofocus]') || dom.title;

  if (plan.type === 'screen') {
    screenTarget().focus();
    window.scrollTo(0, 0);
  } else if (plan.type === 'confirm-open') {
    (dom.main.querySelector('.confirm [data-autofocus]') || screenTarget()).focus();
  } else if (plan.type === 'confirm-close') {
    (findByFocusKey('reset-open') || screenTarget()).focus();
  } else if (plan.type === 'restore') {
    findByFocusKey(plan.key)?.focus({ preventScroll: true });
  }
}

function render() {
  const viewKey = state.view === 'practice' && state.practice?.kind === 'review' ? 'review' : state.view;
  const isHome = state.view === 'home';
  const activeKey = document.activeElement?.dataset?.focusKey ?? null;

  dom.title.textContent = VIEW_TITLES[viewKey];
  dom.eyebrow.textContent = isHome ? MODULE_EYEBROW : MODULE_TITLE;
  dom.intro.hidden = !isHome;
  document.body.dataset.view = viewKey;
  document.body.dataset.inputMethod = state.inputMethod;
  document.title = isHome ? APP_TITLE : `${VIEW_TITLES[viewKey]} · ${APP_TITLE}`;
  dom.back.hidden = isHome;
  setProgress(null);

  RENDERERS[state.view]();
  paintFeedback();

  const next = { screen: currentScreenKey(), confirm: state.confirmReset };
  const availableKeys = [...document.querySelectorAll('[data-focus-key]')].map((node) => node.dataset.focusKey);
  applyFocus(planFocus({ previous: lastFocusState, next, activeKey, availableKeys }));
  lastFocusState = next;
}

/* ---------- Home ---------- */

function startFromMission(mission) {
  const route = getMissionRoute(mission);
  if (route.view === 'mock') {
    startMock();
  } else {
    startPractice(route.wordIds, 'practice');
  }
}

function resetPanel() {
  if (!state.confirmReset) {
    return el(
      'div',
      { class: 'reset-row' },
      button('Borrar progreso de este dispositivo', () => {
        state.confirmReset = true;
        state.familiesOpen = true;
        render();
      }, { kind: 'link', 'data-focus-key': 'reset-open' }),
    );
  }

  return el(
    'div',
    { class: 'confirm', role: 'group', 'aria-labelledby': 'confirm-text' },
    el('p', { id: 'confirm-text', text: '¿Borrar todo el progreso guardado en este dispositivo?' }),
    el(
      'div',
      { class: 'actions' },
      button('Cancelar', () => {
        state.confirmReset = false;
        render();
      }, { kind: 'secondary', 'data-autofocus': '' }),
      button('Sí, borrar', resetProgress, { kind: 'danger' }),
    ),
  );
}

function familiesPanel() {
  return el(
    'details',
    {
      class: 'families',
      open: state.familiesOpen || state.confirmReset,
      ontoggle: (event) => {
        state.familiesOpen = event.currentTarget.open;
      },
    },
    el('summary', {}, 'Para familias'),
    el(
      'div',
      { class: 'families-body' },
      el('p', { text: 'El progreso se guarda solo en este dispositivo. No se guardan nombres ni respuestas escritas, y no hay cuentas, anuncios ni análisis.' }),
      el('p', { text: 'Al terminar, «Compartir resultado» envía solo la puntuación, las palabras a repasar y la dirección de la app.' }),
      resetPanel(),
    ),
  );
}

function resetProgress() {
  if (!clearProgress(storage)) {
    showStorageNote(false);
    announce(MESSAGES.clearFailed, 'blocking');
    return;
  }

  showStorageNote(true);
  progress = createEmptyProgress(WORDS);
  state.confirmReset = false;
  state.results = null;
  speaker.cancel();
  announce('Progreso borrado.', 'success');
  go('home');
}

function startSelectedPractice() {
  const ids = buildReviewQueue(WORDS, progress).filter(({ id }) => state.selectedIds.has(id)).map(({ id }) => id);
  if (ids.length > 0) startPractice(ids, 'practice');
}

function inputMethodPicker() {
  const options = [
    { value: 'keyboard', label: 'Teclado', detail: 'Escribe con el teclado de la pantalla.' },
    { value: 'pencil', label: 'Lápiz de la tablet', detail: 'Usa la escritura a mano del teclado de la tablet.' },
  ];

  return el(
    'fieldset',
    { class: 'card input-method-card', role: 'radiogroup', 'aria-labelledby': 'input-method-title' },
    el('legend', { id: 'input-method-title', text: 'Cómo quieres escribir' }),
    el('p', { id: 'input-method-help', class: 'muted', text: 'Puedes cambiarlo al volver al inicio.' }),
    el(
      'div',
      { class: 'input-method-options', 'aria-describedby': 'input-method-help' },
      ...options.map((option) =>
        el(
          'label',
          { class: 'input-method-option' },
          el('input', {
            type: 'radio',
            name: 'input-method',
            value: option.value,
            'aria-label': option.label,
            checked: state.inputMethod === option.value,
            onchange: (event) => {
              if (event.currentTarget.checked) state.inputMethod = option.value;
            },
          }),
          el('span', { class: 'input-method-copy' },
            el('strong', { text: option.label }),
            el('small', { text: option.detail }),
          ),
        ),
      ),
    ),
  );
}

function practiceSelectionPanel() {
  const countText = el('p', { id: 'selection-count', class: 'selection-count', role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true' });
  const start = button('', startSelectedPractice, { id: 'start-selection' });
  function updateSelection() {
    const count = state.selectedIds.size;
    countText.textContent = `${count} de ${WORDS.length} ${count === 1 ? 'palabra seleccionada' : 'palabras seleccionadas'}`;
    start.textContent = count === WORDS.length ? `Practicar las ${count} palabras` : `Practicar ${plural(count, 'palabra', 'palabras')}`;
    start.disabled = count === 0;
    const mode = document.getElementById('selected-practice-mode');
    if (mode) mode.disabled = count === 0;
    if (count === 0) {
      start.textContent = 'Elige alguna palabra';
      countText.append(' ', el('span', { text: 'Elige al menos una palabra para empezar.' }));
    }
  }
  function selectAll(selected) {
    state.selectedIds = new Set(selected ? allIds() : []);
    for (const input of panel.querySelectorAll('input')) input.checked = selected;
    updateSelection();
  }
  updateSelection();
  const panel = el(
    'section',
    { class: 'card word-selection', 'aria-labelledby': 'selection-title' },
    el('h2', { id: 'selection-title', text: `Practica tus ${WORDS.length} palabras` }),
    el('p', { id: 'selection-help', text: 'Marca todas o elige solo las que quieras practicar.' }),
    el('div', { class: 'selection-tools' },
      button('Marcar todas', () => selectAll(true), { kind: 'secondary' }),
      button('Quitar todas', () => selectAll(false), { kind: 'secondary' }),
    ),
    el(
      'fieldset',
      { class: 'word-choices', 'aria-describedby': 'selection-help' },
      el('legend', { class: 'sr-only', text: `Lista de ${WORDS.length} palabras` }),
      ...WORDS.map((item) => el(
        'label',
        { class: 'word-option', for: `choose-${item.id}` },
        el('input', {
          type: 'checkbox', id: `choose-${item.id}`, value: item.id, checked: state.selectedIds.has(item.id),
          onchange: (event) => {
            if (event.currentTarget.checked) state.selectedIds.add(item.id);
            else state.selectedIds.delete(item.id);
            updateSelection();
          },
        }),
        el('span', { lang: 'en-GB', text: item.word }),
      )),
    ),
    countText,
    start,
  );
  start.setAttribute('aria-describedby', 'selection-count');
  return panel;
}

function renderHome() {
  const mission = getDailyMission(formatLocalDate(new Date()), progress, WORDS);
  const summary = summarizeProgress(WORDS, progress);
  const dueIds = getDueWordIds(WORDS, progress, new Date().toISOString());
  const weakIds = getWeakWordIds(WORDS, progress);
  const reviewIds = [...new Set([...dueIds, ...weakIds])];
  const isMock = getMissionRoute(mission).view === 'mock';

  const modes = [
    { name: 'Aprender', desc: 'Escucha, mira la palabra y recuérdala.', run: () => startLearn(allIds()) },
    {
      name: 'Practicar',
      desc: 'Escribe las palabras que has marcado arriba.',
      run: startSelectedPractice,
    },
    {
      name: 'Cuaderno con lápiz',
      desc: 'Escribe a mano, compara y decide si coincide.',
      run: () => startNotebook([...state.selectedIds]),
    },
    {
      name: 'Repasar errores',
      desc: reviewIds.length > 0
        ? `${plural(reviewIds.length, 'palabra pendiente', 'palabras pendientes')}, incluidas las que toca recordar hoy.`
        : 'Nada pendiente por ahora. Volverán cuando toque recordarlas.',
      run: () => startPractice(reviewIds, 'review'),
    },
    { name: 'Simulacro tranquilo', desc: '10 palabras con dibujos, sin corregir hasta el final.', run: startMock },
  ];

  const main = [
    feedbackSlot({ reserve: false }),
    inputMethodPicker(),
    practiceSelectionPanel(),
    el(
      'section',
      { class: 'home-section', 'aria-labelledby': 'avance-title' },
      el('h2', { id: 'avance-title', text: 'Tu avance' }),
      el('p', { id: 'avance-line', class: 'avance-line', text: `${summary.practised} de ${summary.total} palabras practicadas` }),
      el('progress', { max: String(summary.total), value: String(summary.practised), 'aria-labelledby': 'avance-line' }),
      el('p', { class: 'muted', text: `${summary.weak} para volver a practicar` }),
    ),
    el(
      'section',
      { class: 'home-section', 'aria-labelledby': 'modes-title' },
      el('h2', { id: 'modes-title', text: 'Otras formas de practicar' }),
      el(
        'ul',
        { class: 'modes' },
        ...modes.map(({ name, desc, run }) =>
          el(
            'li',
            {},
            el(
              'button',
              {
                type: 'button', class: 'mode-row', onclick: run,
                id: name === 'Practicar' ? 'selected-practice-mode' : null,
                disabled: name === 'Practicar' && state.selectedIds.size === 0,
                'aria-describedby': name === 'Practicar' ? 'selection-count' : null,
              },
              el('span', { class: 'mode-name', text: name }),
              el('span', { class: 'mode-desc', text: desc }),
              chevron(),
            ),
          ),
        ),
      ),
    ),
    el(
      'section',
      { class: 'home-section mission', 'aria-labelledby': 'mission-title' },
      el('p', { class: 'eyebrow', text: 'Sugerencia de hoy · Opcional' }),
      el('h2', { id: 'mission-title', text: mission.title }),
      el('p', { class: 'meta', text: `${mission.wordIds.length} de las ${WORDS.length} palabras · Unos ${mission.recommendedMinutes} minutos` }),
      el('p', { text: 'Esta sugerencia usa su propia selección de la misma lista.' }),
      button(isMock ? 'Empezar simulacro' : 'Practicar esta sugerencia', () => startFromMission(mission), { kind: 'secondary' }),
    ),
    familiesPanel(),
  ];

  setView(main);
}

/* ---------- Learn: hear, reveal, identify the family, hide, retrieve once ---------- */

function startLearn(ids) {
  state.learn = { ids, index: 0, machine: createLearnState(), chosen: null };
  announce('');
  go('learn');
  playWord(currentLearnWord());
}

const currentLearnWord = () => wordsById.get(state.learn.ids[state.learn.index]);

function nextLearnWord() {
  speaker.cancel();
  const learn = state.learn;
  announce('');
  if (learn.index + 1 >= learn.ids.length) {
    learn.finished = true;
    render();
    return;
  }
  learn.index += 1;
  learn.machine = createLearnState();
  learn.chosen = null;
  render();
  playWord(currentLearnWord());
}

function chooseFamily(pattern) {
  const item = currentLearnWord();
  const learn = state.learn;
  if (learn.machine.familyKnown) {
    return;
  }

  const correct = pattern === item.pattern;
  learn.chosen = pattern;
  learn.machine = advanceLearn(learn.machine, { type: 'family', correct });
  if (correct) {
    announce(`Sí: las letras resaltadas son ${item.pattern}.`, 'success');
  } else {
    announce('Casi. Mira las letras resaltadas y prueba con la otra familia.', 'retry');
  }
  render();
}

function submitLearn(value) {
  if (isBlankAnswer(value)) {
    announce(MESSAGES.blank, 'info');
    return;
  }

  const learn = state.learn;
  const item = currentLearnWord();
  const correct = checkAnswer(value, item.word);
  learn.machine = advanceLearn(learn.machine, { type: 'answer', correct });
  announce(
    correct ? '¡Bien! La has recordado.' : 'Todavía no. Míralas otra vez con calma y ocúltala de nuevo.',
    correct ? 'success' : 'retry',
  );
  render();
  playSpelling(item);
}

function renderLearn() {
  const learn = state.learn;
  const total = learn.ids.length;

  if (learn.finished) {
    setProgress(total, total, `${total} de ${total} palabras`);
    setView(
      el(
        'section',
        { class: 'card' },
        stepHeading(`Has repasado ${plural(total, 'palabra', 'palabras')}`),
        el('p', { text: 'Ahora practica escribiéndolas sin mirar. Así se fijan mejor.' }),
      ),
      [button('Practicar ahora', () => startPractice(learn.ids, 'practice'))],
    );
    return;
  }

  const item = currentLearnWord();
  const { phase, familyKnown, misses } = learn.machine;
  setProgress(phase === 'done' ? learn.index + 1 : learn.index, total, `Palabra ${learn.index + 1} de ${total}`);

  if (phase === 'listen') {
    setView(
      el(
        'section',
        { class: 'card exercise' },
        stepHeading('Escucha y piensa'),
        stepHelp('¿Cómo crees que se escribe?'),
        el('div', { class: 'stage' }, wordPicture(item), cueElement(item), audioButton(item)),
      ),
      [button('Mostrar la palabra', () => {
        learn.machine = advanceLearn(learn.machine, { type: 'reveal' });
        announce('');
        render();
      })],
    );
    return;
  }

  if (phase === 'reveal') {
    const family = el(
      'div',
      { class: 'family', role: 'group', 'aria-labelledby': 'family-q' },
      el('p', { id: 'family-q', text: familyKnown ? `Familia: ${item.pattern}` : '¿Qué letras están resaltadas?' }),
      el(
        'div',
        { class: 'family-buttons' },
        ...['ea', 'ee'].map((pattern) =>
          el(
            'button',
            {
              type: 'button',
              class: 'chip',
              'data-focus-key': `family-${pattern}`,
              'aria-pressed': String(learn.chosen === pattern),
              'aria-disabled': familyKnown ? 'true' : null,
              onclick: () => chooseFamily(pattern),
            },
            pattern,
          ),
        ),
      ),
    );

    setView(
      el(
        'section',
        { class: 'card exercise' },
        stepHeading(misses > 0 ? 'Míralo otra vez' : 'Mira la palabra'),
        el('div', { class: 'stage' }, wordPicture(item), wordElement(item), sentenceElement(item), audioButton(item)),
        spellingPanel(item),
        family,
        feedbackSlot(),
      ),
      [
        button('Ocultar y escribir', () => {
          learn.machine = advanceLearn(learn.machine, { type: 'hide' });
          announce('');
          render();
        }, { disabled: !familyKnown, 'aria-describedby': familyKnown ? null : 'hide-hint' }),
        familyKnown ? null : el('span', { id: 'hide-hint', class: 'sr-only', text: 'Primero elige la familia de letras.' }),
      ],
    );
    return;
  }

  if (phase === 'retrieve') {
    const { form } = answerForm({ label: 'Escribe la palabra sin mirar', onSubmit: submitLearn });
    setView(
      el(
        'section',
        { class: 'card exercise' },
        stepHeading('Ahora sin mirar', false),
        el('div', { class: 'stage' }, wordPicture(item), cueElement(item), audioButton(item), el('p', { class: 'hidden-word', text: 'La palabra está oculta.' })),
        form,
        feedbackSlot(),
      ),
    );
    return;
  }

  setView(
    el(
      'section',
      { class: 'card exercise' },
      stepHeading('Palabra aprendida'),
      el('div', { class: 'stage' }, wordPicture(item), wordElement(item), sentenceElement(item)),
      spellingPanel(item),
      feedbackSlot(),
    ),
    [button(learn.index + 1 >= total ? 'Terminar' : 'Siguiente palabra', nextLearnWord)],
  );
}

/* ---------- Notebook: freehand practice with local self-assessment ---------- */

let inkResizeObserver = null;

function startNotebook(ids) {
  const safeIds = ids.filter((id) => wordsById.has(id));
  if (safeIds.length === 0) return;
  state.notebook = {
    ids: safeIds,
    index: 0,
    ink: createInkState(),
    revealed: false,
    finished: false,
    correct: 0,
    missedIds: [],
  };
  announce('');
  go('notebook');
  playWord(currentNotebookWord());
}

const currentNotebookWord = () => wordsById.get(state.notebook.ids[state.notebook.index]);

function drawInkCanvas(canvas) {
  const notebook = state.notebook;
  const context = canvas.getContext('2d');
  if (!context || !notebook) return;
  const dpr = Number(canvas.dataset.dpr) || 1;
  const width = canvas.width / dpr;
  const height = canvas.height / dpr;
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  context.clearRect(0, 0, width, height);
  context.lineCap = 'round';
  context.lineJoin = 'round';

  context.strokeStyle = '#d8d1c4';
  context.lineWidth = 1.5;
  for (const fraction of [0.32, 0.62, 0.82]) {
    context.beginPath();
    context.moveTo(16, height * fraction);
    context.lineTo(width - 16, height * fraction);
    context.stroke();
  }

  context.strokeStyle = '#17324d';
  for (const stroke of notebook.ink.strokes) {
    if (stroke.length === 1) {
      const point = stroke[0];
      context.beginPath();
      context.arc(point.x * width, point.y * height, 2.8, 0, Math.PI * 2);
      context.fillStyle = '#17324d';
      context.fill();
      continue;
    }
    for (let index = 1; index < stroke.length; index += 1) {
      const previous = stroke[index - 1];
      const point = stroke[index];
      context.beginPath();
      context.lineWidth = 3.5 + point.pressure * 2.5;
      context.moveTo(previous.x * width, previous.y * height);
      context.lineTo(point.x * width, point.y * height);
      context.stroke();
    }
  }
}

function syncInkControls() {
  const hasInk = (state.notebook?.ink.strokes.length ?? 0) > 0;
  for (const id of ['ink-undo', 'ink-clear']) {
    const control = document.getElementById(id);
    if (control) control.disabled = !hasInk;
  }
}

function mountInkPad(canvas, interactive) {
  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const dpr = Math.min(Math.max(window.devicePixelRatio || 1, 1), 3);
    canvas.dataset.dpr = String(dpr);
    canvas.width = Math.max(1, Math.round(rect.width * dpr));
    canvas.height = Math.max(1, Math.round(rect.height * dpr));
    drawInkCanvas(canvas);
  };
  resize();
  inkResizeObserver?.disconnect();
  if (typeof ResizeObserver === 'function') {
    inkResizeObserver = new ResizeObserver(resize);
    inkResizeObserver.observe(canvas);
  }
  if (!interactive) return;

  const pointFromEvent = (event) => {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) / rect.width,
      y: (event.clientY - rect.top) / rect.height,
      pressure: event.pressure,
    };
  };
  const update = (next) => {
    state.notebook.ink = next;
    drawInkCanvas(canvas);
    syncInkControls();
  };

  canvas.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'touch' && !event.isPrimary) return;
    event.preventDefault();
    canvas.setPointerCapture?.(event.pointerId);
    update(startInkStroke(state.notebook.ink, event.pointerId, pointFromEvent(event)));
  });
  canvas.addEventListener('pointermove', (event) => {
    if (state.notebook?.ink.activePointerId !== event.pointerId) return;
    event.preventDefault();
    const events = typeof event.getCoalescedEvents === 'function' ? event.getCoalescedEvents() : [event];
    let next = state.notebook.ink;
    for (const sample of events) next = appendInkPoint(next, event.pointerId, pointFromEvent(sample));
    update(next);
  });
  const finish = (event) => {
    if (!state.notebook) return;
    update(finishInkStroke(state.notebook.ink, event.pointerId));
  };
  canvas.addEventListener('pointerup', finish);
  canvas.addEventListener('pointercancel', finish);
}

function notebookCanvas(item, interactive) {
  return el('canvas', {
    class: 'ink-pad',
    'data-ink-pad': '',
    role: 'img',
    'aria-label': interactive
      ? 'Área de escritura a mano. La palabra sigue oculta.'
      : `Tu escritura de ${item.word} para comparar`,
    'aria-describedby': 'ink-help',
    'data-readonly': String(!interactive),
  });
}

function compareNotebook() {
  const item = currentNotebookWord();
  state.notebook.revealed = true;
  announce('Compara tu escritura con la palabra.', 'info');
  render();
  playSpelling(item);
}

function assessNotebook(wasCorrect) {
  const notebook = state.notebook;
  const item = currentNotebookWord();
  record(item.id, wasCorrect);
  if (wasCorrect) {
    notebook.correct += 1;
    if (notebook.index + 1 >= notebook.ids.length) {
      notebook.finished = true;
      announce('Cuaderno terminado.', 'success');
      render();
      return;
    }
    notebook.index += 1;
  } else if (!notebook.missedIds.includes(item.id)) {
    notebook.missedIds.push(item.id);
  }
  notebook.ink = clearInk(notebook.ink);
  notebook.revealed = false;
  announce(wasCorrect ? 'Siguiente palabra.' : 'Vamos a intentarla otra vez sin mirar.', wasCorrect ? 'success' : 'retry');
  render();
  playWord(currentNotebookWord());
}

function renderNotebook() {
  const notebook = state.notebook;
  const total = notebook.ids.length;
  inkResizeObserver?.disconnect();

  if (notebook.finished) {
    setProgress(total, total, `${total} de ${total} palabras`);
    setView(
      el(
        'section',
        { class: 'card notebook-finished' },
        stepHeading('Cuaderno terminado'),
        el('p', { class: 'result-summary', text: `${notebook.correct} de ${total} palabras marcadas como bien escritas` }),
        el('p', { text: notebook.missedIds.length > 0 ? 'Las palabras que costaron quedan preparadas para repasar.' : 'Has comparado todas las palabras con calma.' }),
      ),
      [button('Volver al inicio', goHome)],
    );
    return;
  }

  const item = currentNotebookWord();
  setProgress(notebook.index, total, `Palabra ${notebook.index + 1} de ${total}`);
  const canvas = notebookCanvas(item, !notebook.revealed);
  const stage = el(
    'div',
    { class: 'stage notebook-stage' },
    wordPicture(item),
    cueElement(item),
    audioButton(item),
  );

  if (notebook.revealed) {
    setView(
      el(
        'section',
        { class: 'card exercise notebook-card' },
        stepHeading('Compara con calma'),
        stage,
        el('p', { id: 'ink-help', class: 'ink-help', text: 'Tu escritura no se guarda ni se envía.' }),
        canvas,
        el('div', { class: 'notebook-answer' }, wordElement(item), sentenceElement(item)),
        spellingPanel(item),
        feedbackSlot(),
      ),
      [
        button('Necesito otra vuelta', () => assessNotebook(false), { kind: 'secondary' }),
        button('La he escrito bien', () => assessNotebook(true)),
      ],
    );
    mountInkPad(canvas, false);
    return;
  }

  const hasInk = notebook.ink.strokes.length > 0;
  const undo = button('Deshacer', () => {
    notebook.ink = undoInkStroke(notebook.ink);
    drawInkCanvas(canvas);
    syncInkControls();
  }, { kind: 'secondary', id: 'ink-undo', disabled: !hasInk });
  const clear = button('Borrar', () => {
    notebook.ink = clearInk(notebook.ink);
    drawInkCanvas(canvas);
    syncInkControls();
  }, { kind: 'secondary', id: 'ink-clear', disabled: !hasInk });

  setView(
    el(
      'section',
      { class: 'card exercise notebook-card' },
      stepHeading('Escribe a mano', false),
      stepHelp('Escucha la palabra y escríbela con el lápiz. Después compárala.'),
      stage,
      el('p', { id: 'ink-help', class: 'ink-help', text: 'Escribe dentro de la pauta. El dibujo se queda solo en esta pantalla. Con teclado o conmutador, puedes comparar sin dibujar.' }),
      canvas,
      el('div', { class: 'ink-tools' }, undo, clear),
      feedbackSlot(),
    ),
    [button('Comparar', compareNotebook, { id: 'ink-compare' })],
  );
  mountInkPad(canvas, true);
}

/* ---------- Practice and Review ---------- */

function startPractice(ids, kind) {
  state.practice = {
    kind,
    queue: ids.map((id) => ({ id, delayed: false })),
    originalTotal: ids.length,
    index: 0,
    machine: createPracticeState(),
    clean: 0,
    missedIds: [],
  };
  announce('');
  go('practice');
  if (ids.length > 0) {
    playWord(currentPracticeWord());
  }
}

const currentPracticeEntry = () => state.practice.queue[state.practice.index];
const currentPracticeWord = () => wordsById.get(currentPracticeEntry().id);

function nextPracticeWord() {
  const practice = state.practice;
  announce('');
  if (practice.index + 1 >= practice.queue.length) {
    finishPractice();
    return;
  }
  practice.index += 1;
  practice.machine = createPracticeState();
  render();
  playWord(currentPracticeWord());
}

function submitPractice(value) {
  if (isBlankAnswer(value)) {
    announce(MESSAGES.blank, 'info');
    return;
  }

  const practice = state.practice;
  const entry = currentPracticeEntry();
  const item = currentPracticeWord();
  const before = practice.machine;
  const correct = checkAnswer(value, item.word);
  const after = advancePractice(before, { type: 'answer', correct });

  if (!correct && before.errors === 0) {
    record(item.id, false);
    if (!practice.missedIds.includes(item.id)) practice.missedIds.push(item.id);
    practice.queue = insertDelayedReview(practice.queue, practice.index, 2);
  }
  if (correct && after.errors === 0) {
    record(item.id, true);
    if (!entry.delayed) practice.clean += 1;
  }

  practice.machine = after;

  if (after.phase === 'done') {
    announce(
      after.errors === 0 ? '¡Correcto!' : 'Bien hecho. Esta palabra volverá al repaso.',
      'success',
    );
  } else if (after.phase === 'retry') {
    announce('Casi. Escúchala otra vez e inténtalo de nuevo.', 'retry');
    playWord(item);
  } else {
    announce('Mira cómo se escribe, escúchala y luego ocúltala para escribirla.', 'retry');
    playWord(item);
  }

  render();
  if (after.phase === 'done' || after.phase === 'reveal') {
    playSpelling(item);
  }
}

function finishPractice() {
  const practice = state.practice;
  const total = practice.originalTotal;
  speaker.cancel();
  showResults({
    kind: 'practice',
    score: practice.clean,
    total,
    missedIds: [...practice.missedIds],
  });
}

function renderPractice() {
  const practice = state.practice;
  const total = practice.queue.length;

  if (total === 0) {
    setView(
      el(
        'section',
        { class: 'card' },
        stepHeading('No hay errores pendientes'),
        el('p', { text: 'Cuando falles una palabra aparecerá aquí para repasarla.' }),
      ),
      [button('Practicar', () => startPractice(buildReviewQueue(WORDS, progress).map(({ id }) => id), 'practice'))],
    );
    return;
  }

  const item = currentPracticeWord();
  const entry = currentPracticeEntry();
  const repeatNote = entry.delayed
    ? el('p', { class: 'review-return', text: 'Esta palabra vuelve ahora para reforzarla.' })
    : null;
  const { phase, errors } = practice.machine;
  setProgress(phase === 'done' ? practice.index + 1 : practice.index, total, `Palabra ${practice.index + 1} de ${total}`);

  if (phase === 'reveal') {
    setView(
      el(
        'section',
        { class: 'card exercise' },
        stepHeading('Míralo despacio'),
        repeatNote,
        el('div', { class: 'stage' }, wordPicture(item), wordElement(item), sentenceElement(item), audioButton(item)),
        spellingPanel(item),
        feedbackSlot(),
      ),
      [button('Ocultar y escribir', () => {
        practice.machine = advancePractice(practice.machine, { type: 'hide' });
        announce('Ahora escríbela sin mirar.', 'info');
        render();
      })],
    );
    return;
  }

  if (phase === 'done') {
    setView(
      el(
        'section',
        { class: 'card exercise' },
        stepHeading(errors === 0 ? 'Palabra correcta' : 'Palabra para repasar'),
        repeatNote,
        el('div', { class: 'stage' }, wordPicture(item), wordElement(item), sentenceElement(item)),
        spellingPanel(item),
        feedbackSlot(),
      ),
      [button(practice.index + 1 >= total ? 'Ver resumen' : 'Siguiente palabra', nextPracticeWord)],
    );
    return;
  }

  const headings = { first: 'Escucha y escribe', retry: 'Prueba otra vez', retrieve: 'Ahora sin mirar' };
  const helps = {
    first: 'Escucha la palabra y escríbela.',
    retry: 'Escúchala otra vez e inténtalo con calma.',
    retrieve: 'Escríbela sin mirar.',
  };
  const { form } = answerForm({ label: 'Escribe la palabra', onSubmit: submitPractice });
  setView(
    el(
      'section',
      { class: 'card exercise' },
      stepHeading(entry.delayed && phase === 'first' ? '¿La recuerdas ahora?' : headings[phase], false),
      stepHelp(entry.delayed && phase === 'first' ? 'Ha pasado un poco de tiempo. Escúchala y recupérala sin mirar.' : helps[phase]),
      repeatNote,
      el('div', { class: 'stage' }, wordPicture(item), cueElement(item), audioButton(item), el('p', { class: 'hidden-word', text: 'La palabra está oculta.' })),
      form,
      feedbackSlot(),
    ),
  );
}

/* ---------- Mock: ten shuffled words, no feedback until the end ---------- */

function startMock() {
  state.mock = {
    order: shuffleWords(WORDS),
    index: 0,
    answers: {},
    stage: 'question',
    backToReview: false,
    audioFailure: createAudioFailure(),
  };
  announce('');
  go('mock');
  playWord(state.mock.order[0]);
}

function moveMock(index) {
  const mock = state.mock;
  announce('');
  mock.index = index;
  mock.stage = 'question';
  mock.audioFailure = clearAudioFailure();
  render();
  playWord(mock.order[index]);
}

function nextMock() {
  const mock = state.mock;
  if (mock.backToReview || mock.index + 1 >= mock.order.length) {
    speaker.cancel();
    mock.stage = 'review';
    mock.backToReview = false;
    announce('');
    render();
    return;
  }
  moveMock(mock.index + 1);
}

function submitMock() {
  const mock = state.mock;
  const result = scoreMock(mock.order, mock.answers);
  const stamp = new Date().toISOString();

  for (const { id, answered, correct } of result.results) {
    if (answered) {
      progress = recordAttempt(progress, id, correct, stamp);
    }
  }
  progress = addMockScore(progress, { score: result.score, total: result.total, completedAt: stamp });
  persist();

  speaker.cancel();
  state.mock = null;
  showResults({ kind: 'mock', score: result.score, total: result.total, missedIds: result.missedIds });
}

/** The Spanish cue shows when speech is unsupported or playback failed for this prompt. */
function mockCue() {
  const mock = state.mock;
  const item = mock.order[mock.index];
  const show = shouldShowSpanishCue({ supported: speaker.supported, failure: mock.audioFailure, promptId: item.id });
  return show ? cueElement(item) : null;
}

/** Records a runtime audio failure for the current Mock prompt. Returns true when it applied. */
function registerMockAudioFailure() {
  const mock = state.mock;
  if (state.view !== 'mock' || mock === null || mock.stage !== 'question') {
    return false;
  }

  mock.audioFailure = markAudioFailure(mock.audioFailure, mock.order[mock.index].id);
  document.querySelector('[data-cue-slot]')?.replaceChildren(...normalizeChildren(mockCue()));
  return true;
}

function renderMock() {
  const mock = state.mock;
  const total = mock.order.length;

  if (mock.stage === 'review') {
    setProgress(total, total, `${total} de ${total} palabras`);
    const unanswered = mock.order.filter(({ id }) => isBlankAnswer(mock.answers[id])).length;

    setView(
      el(
        'section',
        { class: 'card' },
        stepHeading('Revisa antes de entregar'),
        el('p', {
          text:
            unanswered > 0
              ? `Te faltan ${plural(unanswered, 'palabra', 'palabras')} por responder. Puedes cambiarlas o entregar así.`
              : 'Has respondido las 10 palabras. Puedes cambiar alguna o entregar.',
        }),
        el(
          'ol',
          { class: 'review-list' },
          ...mock.order.map(({ id }, index) =>
            el(
              'li',
              {},
              el('span', { text: `Palabra ${index + 1}: ${isBlankAnswer(mock.answers[id]) ? 'sin responder' : 'respondida'}` }),
              button('Cambiar', () => {
                mock.backToReview = true;
                moveMock(index);
              }, { kind: 'secondary', 'aria-label': `Cambiar la palabra ${index + 1}` }),
            ),
          ),
        ),
      ),
      [button('Entregar simulacro', submitMock)],
    );
    return;
  }

  const item = mock.order[mock.index];
  const last = mock.index + 1 >= total;
  setProgress(mock.index + 1, total, `Palabra ${mock.index + 1} de ${total}`);

  const { form } = answerForm({
    label: `Escribe la palabra ${mock.index + 1}`,
    value: mock.answers[item.id] ?? '',
    hint: 'El dibujo ayuda con el significado. Corregimos al final.',
    onSubmit: nextMock,
    onInput: (value) => {
      mock.answers[item.id] = value;
    },
    submitLabel: mock.backToReview ? 'Volver a la revisión' : last ? 'Revisar respuestas' : 'Siguiente',
    secondaryActions: [
      button('Anterior', () => moveMock(mock.index - 1), {
        kind: 'secondary',
        disabled: mock.index === 0,
      }),
    ],
  });

  setView(
    el(
      'section',
      { class: 'card exercise' },
      stepHeading('Escucha y escribe', false),
      stepHelp('Escucha cada palabra y escríbela.'),
      el('div', { class: 'stage' }, wordPicture(item), el('div', { class: 'cue-slot', 'data-cue-slot': '' }, mockCue()), audioButton(item)),
      form,
    ),
  );
}

/* ---------- Results ---------- */

function showResults({ kind, score, total, missedIds }) {
  const best = kind === 'mock' ? getBestScore(progress) : null;
  const missedWords = toWords(missedIds);
  state.results = { kind, score, total, missedIds, missedWords, best };
  state.shareText = buildShareText({ kind, score, total, best, missedWords });
  announce('');
  go('results');
}

async function shareResults(fallbackArea) {
  const text = state.shareText;
  const url = `${window.location.origin}${window.location.pathname}`;
  const copyText = `${text}\n${url}`;

  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ title: APP_TITLE, text, url });
      announce('Resultado y enlace compartidos.', 'success');
      return;
    } catch (error) {
      if (error?.name === 'AbortError') {
        return;
      }
    }
  }

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(copyText);
      announce('Resultado y enlace copiados al portapapeles.', 'success');
      return;
    }
  } catch {
    // Fall through to the manual-copy text box.
  }

  const area = el('textarea', { id: 'share-text', readonly: true, rows: '5' });
  area.value = copyText;
  fallbackArea.replaceChildren(el('label', { for: 'share-text', text: 'Copia este texto para compartirlo:' }), area);
  area.focus();
  area.select();
  announce('No se pudo compartir automáticamente. Copia el texto de abajo.', 'info');
}

function renderResults() {
  const { kind, score, total, missedWords, missedIds, best } = state.results;
  const step = recommendNextStep({ score, total, missedCount: missedIds.length });
  const shareArea = el('div', { class: 'share-fallback' });

  const actions = {
    home: () => button('Volver al inicio', goHome),
    review: () => button('Repasar errores', () => startPractice(missedIds, 'review')),
    learn: () => button('Aprender esas palabras', () => startLearn(missedIds)),
  };

  setView([
    el(
      'section',
      { class: 'card result-card', 'aria-labelledby': 'result-kind' },
      el('p', { id: 'result-kind', class: 'result-kind', text: kind === 'mock' ? 'Simulacro' : 'Práctica' }),
      el('p', {
        class: 'result-summary',
        text: `${score} de ${total} palabras bien${kind === 'mock' ? '' : ' a la primera'}`,
      }),
      best ? el('p', { class: 'muted', text: `Mejor resultado: ${best.score}/${best.total}` }) : null,
      el('h2', { class: 'step-title', text: 'Palabras para volver a mirar' }),
      missedWords.length > 0
        ? el(
            'ul',
            { class: 'result-list' },
            ...missedWords.map((item) =>
              el(
                'li',
                { 'data-spelling': item.id },
                el(
                  'span',
                  { class: 'result-word spelling-letters spelling-letters-compact', lang: 'en-GB', 'aria-label': item.word },
                  ...item.word.toUpperCase().split('').map((letter) =>
                    el('span', { class: 'spelling-letter', 'data-active': 'false', 'aria-hidden': 'true', text: letter }),
                  ),
                ),
                el('span', { class: 'muted', lang: 'es', text: item.cue }),
                button('Deletrear', () => playSpelling(item), {
                  kind: 'secondary',
                  'aria-label': `Deletrear ${item.word}`,
                }),
              ),
            ),
          )
        : el('p', { text: 'Ninguna. ¡Sin errores!' }),
      feedbackSlot({ reserve: false }),
    ),
    el(
      'div',
      { class: 'next-step' },
      el('p', { text: step.message }),
      actions[step.mode](),
    ),
    el(
      'div',
      { class: 'share-block' },
      button('Compartir resultado', () => shareResults(shareArea), { kind: 'secondary' }),
      shareArea,
    ),
    familiesPanel(),
  ]);
}

/* ---------- Boot ---------- */

const RENDERERS = {
  home: renderHome,
  learn: renderLearn,
  practice: renderPractice,
  notebook: renderNotebook,
  mock: renderMock,
  results: renderResults,
};

dom.back.addEventListener('click', goHome);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    speaker.cancel();
  }
});
window.addEventListener('pagehide', () => speaker.cancel());

showStorageNote(storage !== null);
render();
