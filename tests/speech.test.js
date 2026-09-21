import test from 'node:test';
import assert from 'node:assert/strict';

import { createSpeaker } from '../speech.js';
import { WORDS } from '../data.js';
import { getSpeechText } from '../logic.js';

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

// Node has neither HTMLAudioElement nor SpeechSynthesis. Only those platform
// boundaries are faked; all routing, cancellation and statuses use createSpeaker.
function fakeMedia(play = () => Promise.resolve()) {
  const instances = [];
  class AudioCtor {
    constructor(src) {
      this.src = src;
      this.currentTime = 0;
      this.playbackRate = 1;
      this.preservesPitch = false;
      this.paused = true;
      this.calls = [];
      instances.push(this);
    }
    play() {
      this.calls.push('play');
      this.paused = false;
      return play(this);
    }
    pause() {
      this.calls.push('pause');
      this.paused = true;
    }
  }
  return { AudioCtor, instances };
}

test('known curriculum prompts prefer their local MP3 with or without native synthesis', () => {
  for (const synth of [undefined, fakeSynth([voice('en-GB')])]) {
    const { AudioCtor, instances } = fakeMedia();
    const statuses = [];
    const speaker = createSpeaker({ synth, Utterance: FakeUtterance, AudioCtor, onStatus: (s) => statuses.push(s) });
    assert.equal(speaker.supported, true);
    assert.equal(instances.length, 0, 'creating a speaker must not autoplay');

    for (const item of WORDS) {
      assert.equal(speaker.speak(getSpeechText(item)), true, item.id);
      assert.equal(instances.at(-1)?.src, `audio/en-gb-v1/${item.id}.mp3`);
      assert.equal(instances.at(-1).playbackRate, 1, 'clips are already slow');
      assert.deepEqual(instances.at(-1).calls, ['play']);
    }
    assert.equal(instances.length, 10);
    assert.equal(synth?.spoken.length ?? 0, 0);
    assert.equal(statuses.at(-1), 'speaking');
  }
});

test('slow media replay uses 0.8 with pitch preservation and normal replay resets to 1', () => {
  const { AudioCtor, instances } = fakeMedia();
  const speaker = createSpeaker({ AudioCtor });
  const text = getSpeechText(WORDS[0]);

  assert.equal(speaker.speak(text, { slow: true }), true);
  assert.equal(instances[0].playbackRate, 0.8);
  assert.equal(instances[0].preservesPitch, true);
  speaker.speak(text);
  assert.equal(instances[1].playbackRate, 1);
  assert.equal(instances[1].preservesPitch, true);
});

test('replacement and explicit cancel stop prior audio and native speech before another attempt', () => {
  const synth = fakeSynth([voice('en-GB')]);
  const { AudioCtor, instances } = fakeMedia();
  const statuses = [];
  const speaker = createSpeaker({ synth, Utterance: FakeUtterance, AudioCtor, onStatus: (s) => statuses.push(s) });

  speaker.speak('native-only prompt');
  const [utterance] = synth.spoken;
  speaker.speak(getSpeechText(WORDS[0]));
  assert.deepEqual(synth.calls, ['cancel', 'speak', 'cancel']);
  utterance.onend();
  assert.equal(statuses.at(-1), 'speaking');
  instances[0].currentTime = 3;

  speaker.speak(getSpeechText(WORDS[1]));
  assert.equal(instances[0].paused, true);
  assert.equal(instances[0].currentTime, 0);
  assert.deepEqual(instances[0].calls, ['play', 'pause']);
  assert.equal(instances[1].paused, false);
  speaker.speak('another native-only prompt');
  assert.equal(instances[1].paused, true);

  speaker.speak(getSpeechText(WORDS[2]));
  speaker.cancel();
  assert.equal(instances[2].paused, true);
  assert.equal(synth.calls.at(-1), 'cancel');
  assert.equal(statuses.at(-1), 'idle');
});

test('only the active clip can finish playback; ended events after cancellation are ignored', () => {
  const { AudioCtor, instances } = fakeMedia();
  const statuses = [];
  const speaker = createSpeaker({ AudioCtor, onStatus: (s) => statuses.push(s) });
  speaker.speak(getSpeechText(WORDS[0]));
  const firstEnd = instances[0].onended;
  firstEnd?.();
  assert.equal(statuses.at(-1), 'idle');

  speaker.speak(getSpeechText(WORDS[1]));
  const beforeStale = [...statuses];
  firstEnd();
  assert.deepEqual(statuses, beforeStale);
  const secondEnd = instances[1].onended;
  speaker.cancel();
  const afterCancel = [...statuses];
  secondEnd();
  assert.deepEqual(statuses, afterCancel);
  assert.equal(instances[1].paused, true, 'cancel works without synthesis');
});

test('a rejected play promise falls back once to native speech at the requested slow rate', async () => {
  for (const slow of [false, true]) {
    const rejection = Promise.reject(new Error('NotAllowedError: autoplay blocked'));
    rejection.catch(() => {}); // Keep RED focused on the missing fallback, not an unhandled rejection.
    const { AudioCtor, instances } = fakeMedia(() => rejection);
    const synth = fakeSynth([voice('en-GB')]);
    const statuses = [];
    const speaker = createSpeaker({ synth, Utterance: FakeUtterance, AudioCtor, onStatus: (s) => statuses.push(s) });
    const text = getSpeechText(WORDS[4]);

    assert.equal(speaker.speak(text, { slow }), true, 'return the attempted play synchronously');
    await Promise.resolve();
    assert.equal(synth.spoken.length, 1);
    assert.equal(synth.spoken[0].text, text, 'read remains read, never phonetic display text');
    assert.equal(synth.spoken[0].rate, slow ? 0.50 : 0.64);
    assert.equal(instances[0].paused, true);
    assert.equal(statuses.includes('error'), false, 'a working fallback is not a user-facing failure');
    assert.equal(statuses.at(-1), 'speaking');
  }
});

test('a media load error falls back only once even when play later rejects or ended is queued', async () => {
  let rejectPlay;
  const attempt = new Promise((_, reject) => { rejectPlay = reject; });
  const { AudioCtor, instances } = fakeMedia(() => attempt);
  const synth = fakeSynth([voice('en-GB')]);
  const statuses = [];
  const speaker = createSpeaker({ synth, Utterance: FakeUtterance, AudioCtor, onStatus: (s) => statuses.push(s) });
  speaker.speak(getSpeechText(WORDS[1]));
  const failed = instances[0];
  const ended = failed.onended;
  const loadError = failed.onerror;
  loadError?.({ code: 4 }); // Unsupported source / HTTP 404.
  assert.equal(synth.spoken.length, 1);
  assert.equal(failed.paused, true);

  const afterFallback = [...statuses];
  loadError();
  ended();
  rejectPlay(new Error('NotSupportedError'));
  await Promise.resolve();
  assert.equal(synth.spoken.length, 1);
  assert.deepEqual(statuses, afterFallback);
});

test('synchronous media construction or play failures use native fallback instead of throwing', () => {
  const throwingMedia = fakeMedia(() => { throw new Error('play failed'); });
  const unavailableAudio = class { constructor() { throw new Error('audio unavailable'); } };
  for (const AudioCtor of [throwingMedia.AudioCtor, unavailableAudio]) {
    const synth = fakeSynth([voice('en-GB')]);
    const statuses = [];
    const speaker = createSpeaker({ synth, Utterance: FakeUtterance, AudioCtor, onStatus: (s) => statuses.push(s) });
    assert.equal(speaker.speak(getSpeechText(WORDS[0])), true);
    assert.equal(synth.spoken.length, 1);
    assert.equal(statuses.at(-1), 'speaking');
    assert.equal(statuses.includes('error'), false);
  }
  assert.equal(throwingMedia.instances[0].paused, true);
});

test('working clips suppress native voice warnings, including late voice events and a later retry', () => {
  const synth = fakeSynth([voice('es-ES')]);
  const { AudioCtor, instances } = fakeMedia();
  const statuses = [];
  const speaker = createSpeaker({ synth, Utterance: FakeUtterance, AudioCtor, onStatus: (s) => statuses.push(s) });
  assert.deepEqual(statuses, ['ready']);
  const text = getSpeechText(WORDS[0]);
  speaker.speak(text);
  synth.emit('voiceschanged');
  assert.equal(statuses.at(-1), 'speaking');
  assert.equal(statuses.includes('no-english-voice'), false);

  instances[0].onerror();
  assert.ok(statuses.includes('no-english-voice'), 'the warning still applies to a native fallback');
  const beforeRetry = statuses.length;
  speaker.speak(text);
  assert.ok(statuses.slice(beforeRetry).includes('ready'), 'a new clip attempt clears the old native warning');
  synth.voices = [voice('en-GB')];
  const beforeVoices = [...statuses];
  synth.emit('voiceschanged');
  assert.deepEqual(statuses, beforeVoices, 'voice discovery must not end the active clip UI');
  assert.equal(speaker.getVoice().lang, 'en-GB');
});

test('failure of both audio paths reports one lasting error without retries', async () => {
  for (const failure of ['missing', 'throw', 'event', 'sync-event']) {
    const { AudioCtor, instances } = fakeMedia(() => Promise.reject(new Error('media unavailable')));
    const synth = failure === 'missing' ? undefined : fakeSynth([voice('en-GB')]);
    if (failure === 'throw') synth.speak = () => { throw new Error('synthesis unavailable'); };
    if (failure === 'sync-event') synth.speak = (u) => u.onerror({ error: 'synthesis-failed' });
    const statuses = [];
    const speaker = createSpeaker({ synth, Utterance: FakeUtterance, AudioCtor, onStatus: (s) => statuses.push(s) });
    assert.equal(speaker.speak(getSpeechText(WORDS[0])), true);
    await Promise.resolve();
    if (failure === 'event') synth.spoken[0].onerror({ error: 'synthesis-failed' });
    assert.equal(statuses.at(-1), 'error', failure);
    assert.equal(instances[0].paused, true);
    const afterFailure = [...statuses];
    instances[0].onended();
    instances[0].onerror();
    synth?.spoken[0]?.onend();
    synth?.spoken[0]?.onerror({ error: 'synthesis-failed' });
    await Promise.resolve();
    assert.deepEqual(statuses, afterFailure, failure);
    assert.equal(statuses.filter((s) => s === 'error').length, 1);
    assert.equal(instances.length, 1, 'no MP3 retry loop');
  }
});

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
  assert.equal(utterance.rate, 0.64);
  assert.equal(utterance.pitch, 1);
  assert.equal(utterance.volume, 1);
});

test('speaker offers an extra-slow native replay without changing pitch', () => {
  const synth = fakeSynth([voice('en-GB')]);
  const speaker = createSpeaker({ synth, Utterance: FakeUtterance });

  assert.equal(speaker.speak('easy', { slow: true }), true);
  assert.equal(synth.spoken[0].rate, 0.50);
  assert.equal(synth.spoken[0].lang, 'en-GB');
  assert.equal(synth.spoken[0].pitch, 1);
  speaker.speak('easy');
  assert.equal(synth.spoken[1].rate, 0.64);
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

  speaker.speak('another prompt');
  synth.spoken[1].onerror({ error: 'synthesis-failed' });
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
