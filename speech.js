import { selectEnglishVoice } from './logic.js';

const SPEECH_LANG = 'en-GB';
const SPEECH_RATE = 0.82;
const SELF_CANCEL_ERRORS = new Set(['interrupted', 'canceled', 'cancelled']);

/**
 * Wraps the Web Speech API so audio is British English, slow, and never throws.
 * Statuses: unsupported | no-english-voice | ready | speaking | idle | error.
 *
 * @param {{ synth?: object, Utterance?: Function, onStatus?: (status: string) => void }} options
 */
export function createSpeaker({ synth, Utterance, onStatus = () => {} } = {}) {
  const supported =
    synth !== undefined &&
    synth !== null &&
    typeof synth.speak === 'function' &&
    typeof Utterance === 'function';

  let voice = null;
  let current = null;

  function refreshVoices() {
    try {
      const voices = synth.getVoices();
      voice = selectEnglishVoice(voices);
      if (voice !== null) {
        onStatus('ready');
      } else if (voices.length > 0) {
        onStatus('no-english-voice');
      }
    } catch {
      voice = null;
    }
  }

  if (!supported) {
    onStatus('unsupported');
  } else {
    refreshVoices();
    if (typeof synth.addEventListener === 'function') {
      synth.addEventListener('voiceschanged', refreshVoices);
    } else {
      synth.onvoiceschanged = refreshVoices;
    }
  }

  function cancel() {
    current = null;
    if (!supported || typeof synth.cancel !== 'function') {
      return;
    }
    try {
      synth.cancel();
    } catch {
      // Cancelling is best effort.
    }
  }

  function speak(text) {
    if (!supported) {
      onStatus('unsupported');
      return false;
    }

    try {
      if (voice === null) {
        refreshVoices();
      }

      cancel();
      if (synth.paused && typeof synth.resume === 'function') {
        synth.resume();
      }

      const utterance = new Utterance(text);
      utterance.lang = SPEECH_LANG;
      utterance.voice = voice;
      utterance.rate = SPEECH_RATE;
      utterance.pitch = 1;
      utterance.volume = 1;
      utterance.onend = () => {
        if (utterance === current) {
          onStatus('idle');
        }
      };
      utterance.onerror = (event) => {
        if (utterance !== current) {
          return;
        }
        onStatus(SELF_CANCEL_ERRORS.has(event?.error) ? 'idle' : 'error');
      };

      current = utterance;
      synth.speak(utterance);
      onStatus('speaking');
      return true;
    } catch {
      current = null;
      onStatus('error');
      return false;
    }
  }

  return {
    supported,
    speak,
    cancel,
    getVoice: () => voice,
  };
}
