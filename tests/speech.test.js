import test from 'node:test';
import assert from 'node:assert/strict';

import { createSpeaker } from '../speech.js';

class FakeUtterance {
  constructor(text) {
    this.text = text;
    this.lang = '';
    this.voice = null;
    this.rate = 1;
    this.pitch = 0;
    this.volume = 0;
  }
}

function fakeSynth(initialVoices = []) {
  const listeners = new Map();
  const synth = {
    voices: initialVoices,
    calls: [],
    spoken: [],
    paused: false,
    getVoices() {
      return this.voices;
    },
    addEventListener(type, handler) {
      listeners.set(type, handler);
    },
    emit(type) {
      listeners.get(type)?.();
    },
    cancel() {
      this.calls.push('cancel');
    },
    resume() {
      this.calls.push('resume');
    },
    speak(utterance) {
      this.calls.push('speak');
      this.spoken.push(utterance);
    },
  };
  return synth;
}

const voice = (lang) => ({ lang, name: lang });

test('speaker reports unsupported when speechSynthesis or Utterance is missing', () => {
  const statuses = [];
  const speaker = createSpeaker({
    synth: undefined,
    Utterance: undefined,
    onStatus: (status) => statuses.push(status),
  });

  assert.equal(speaker.supported, false);
  assert.equal(speaker.speak('easy'), false);
  assert.deepEqual(statuses, ['unsupported', 'unsupported']);
});

test('speaker cancels prior speech and speaks with British English settings', () => {
  const gb = voice('en-GB');
  const synth = fakeSynth([voice('en-US'), gb]);
  const speaker = createSpeaker({ synth, Utterance: FakeUtterance });

  assert.equal(speaker.speak('meat. We eat meat for lunch. meat.'), true);

  assert.deepEqual(synth.calls, ['cancel', 'speak']);
  const [utterance] = synth.spoken;
  assert.equal(utterance.text, 'meat. We eat meat for lunch. meat.');
  assert.equal(utterance.lang, 'en-GB');
  assert.equal(utterance.voice, gb);
  assert.equal(utterance.rate, 0.82);
  assert.equal(utterance.pitch, 1);
  assert.equal(utterance.volume, 1);
});

test('speaker cancels before every new utterance', () => {
  const synth = fakeSynth([voice('en-GB')]);
  const speaker = createSpeaker({ synth, Utterance: FakeUtterance });

  speaker.speak('one');
  speaker.speak('two');

  assert.deepEqual(synth.calls, ['cancel', 'speak', 'cancel', 'speak']);
});

test('speaker picks up voices that load later via voiceschanged', () => {
  const synth = fakeSynth([]);
  const statuses = [];
  const speaker = createSpeaker({
    synth,
    Utterance: FakeUtterance,
    onStatus: (status) => statuses.push(status),
  });

  assert.equal(speaker.getVoice(), null);

  const gb = voice('en-GB');
  synth.voices = [voice('es-ES'), gb];
  synth.emit('voiceschanged');

  assert.equal(speaker.getVoice(), gb);
  speaker.speak('easy');
  assert.equal(synth.spoken[0].voice, gb);
  assert.equal(statuses.at(-1), 'speaking');
});

test('speaker warns when voices are loaded but none is English, yet still speaks', () => {
  const synth = fakeSynth([voice('es-ES')]);
  const statuses = [];
  const speaker = createSpeaker({
    synth,
    Utterance: FakeUtterance,
    onStatus: (status) => statuses.push(status),
  });

  assert.equal(speaker.speak('easy'), true);
  assert.equal(synth.spoken[0].voice, null);
  assert.equal(synth.spoken[0].lang, 'en-GB');
  assert.ok(statuses.includes('no-english-voice'));
});

test('speaker reports speaking, idle and error from utterance events', () => {
  const synth = fakeSynth([voice('en-GB')]);
  const statuses = [];
  const speaker = createSpeaker({
    synth,
    Utterance: FakeUtterance,
    onStatus: (status) => statuses.push(status),
  });

  speaker.speak('easy');
  const [utterance] = synth.spoken;
  assert.equal(statuses.at(-1), 'speaking');

  utterance.onend();
  assert.equal(statuses.at(-1), 'idle');

  utterance.onerror({ error: 'synthesis-failed' });
  assert.equal(statuses.at(-1), 'error');
});

test('speaker ignores interrupted and cancelled errors caused by its own cancel()', () => {
  const synth = fakeSynth([voice('en-GB')]);
  const statuses = [];
  const speaker = createSpeaker({
    synth,
    Utterance: FakeUtterance,
    onStatus: (status) => statuses.push(status),
  });

  speaker.speak('one');
  const [first] = synth.spoken;
  speaker.speak('two');
  first.onerror({ error: 'interrupted' });
  first.onend();

  assert.equal(statuses.at(-1), 'speaking');
});

test('speaker survives synthesis exceptions and reports an error', () => {
  const synth = fakeSynth([voice('en-GB')]);
  synth.speak = () => {
    throw new Error('boom');
  };
  const statuses = [];
  const speaker = createSpeaker({
    synth,
    Utterance: FakeUtterance,
    onStatus: (status) => statuses.push(status),
  });

  assert.equal(speaker.speak('easy'), false);
  assert.equal(statuses.at(-1), 'error');
});

test('speaker falls back to onvoiceschanged when addEventListener is unavailable', () => {
  const synth = fakeSynth([]);
  delete synth.addEventListener;
  const speaker = createSpeaker({ synth, Utterance: FakeUtterance });

  assert.equal(typeof synth.onvoiceschanged, 'function');
  const gb = voice('en-GB');
  synth.voices = [gb];
  synth.onvoiceschanged();
  assert.equal(speaker.getVoice(), gb);
});

test('speaker.cancel stops speech without throwing when synthesis fails', () => {
  const synth = fakeSynth([voice('en-GB')]);
  const speaker = createSpeaker({ synth, Utterance: FakeUtterance });
  speaker.cancel();
  assert.deepEqual(synth.calls, ['cancel']);

  synth.cancel = () => {
    throw new Error('boom');
  };
  assert.doesNotThrow(() => speaker.cancel());
});

test('speaker reports ready when an English voice is found, clearing earlier warnings', () => {
  const synth = fakeSynth([voice('es-ES')]);
  const statuses = [];
  createSpeaker({
    synth,
    Utterance: FakeUtterance,
    onStatus: (status) => statuses.push(status),
  });
  assert.deepEqual(statuses, ['no-english-voice']);

  synth.voices = [voice('es-ES'), voice('en-US')];
  synth.emit('voiceschanged');
  assert.deepEqual(statuses, ['no-english-voice', 'ready']);
});
