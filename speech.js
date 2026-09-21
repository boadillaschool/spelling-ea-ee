import { WORDS } from './data.js';
import { getSpeechText, selectEnglishVoice } from './logic.js';

const SPEECH_LANG = 'en-GB';
const SPEECH_RATE = 0.64;
const SELF_CANCEL_ERRORS = new Set(['interrupted', 'canceled', 'cancelled']);
// Only exact curriculum prompts can select media. Caller text is never a URL.
const CLIPS = new Map(WORDS.map((item) => [getSpeechText(item), `audio/en-gb-v1/${item.id}.mp3`]));

/**
 * Prefers bundled British English clips, with slow Web Speech as a fallback.
 * Statuses: unsupported | no-english-voice | ready | speaking | idle | error.
 *
 * @param {{ synth?: object, Utterance?: Function, AudioCtor?: Function, onStatus?: (status: string) => void }} options
 */
export function createSpeaker({ synth, Utterance, AudioCtor, onStatus = () => {} } = {}) {
  const speechSupported =
    synth !== undefined &&
    synth !== null &&
    typeof synth.speak === 'function' &&
    typeof Utterance === 'function';
  const mediaSupported = typeof AudioCtor === 'function';
  const supported = speechSupported || mediaSupported;

  let voice = null;
  let current = null;

  function refreshVoices(report = !mediaSupported) {
    try {
      const voices = synth.getVoices();
      voice = selectEnglishVoice(voices);
      if (report && voice !== null) {
        onStatus('ready');
      } else if (report && voices.length > 0) {
        onStatus('no-english-voice');
      }
    } catch {
      voice = null;
    }
  }

  if (!supported) {
    onStatus('unsupported');
  } else if (mediaSupported) {
    onStatus('ready');
  }
  if (speechSupported) {
    refreshVoices();
    const voicesChanged = () => refreshVoices();
    if (typeof synth.addEventListener === 'function') {
      synth.addEventListener('voiceschanged', voicesChanged);
    } else {
      synth.onvoiceschanged = voicesChanged;
    }
  }

  function cancel() {
    const previous = current;
    current = null;
    if (typeof previous?.pause === 'function') {
      try {
        previous.pause();
        previous.currentTime = 0;
      } catch {
        // Media may not have loaded enough to seek yet.
      }
    }
    if (previous !== null) {
      onStatus('idle');
    }
    if (!speechSupported || typeof synth.cancel !== 'function') {
      return;
    }
    try {
      synth.cancel();
    } catch {
      // Cancelling is best effort.
    }
  }

  function speak(text, { slow = false } = {}) {
    if (!supported) {
      onStatus('unsupported');
      return false;
    }

    try {
      const clip = mediaSupported && CLIPS.get(text);
      if (clip) {
        cancel();
        onStatus('ready');
        const audio = new AudioCtor(clip);
        audio.playbackRate = slow ? 0.8 : 1;
        audio.preservesPitch = true;
        current = audio;
        audio.onended = () => {
          if (current === audio) {
            current = null;
            onStatus('idle');
          }
        };
        const fallback = () => {
          if (current === audio) {
            cancel();
            speakNative(text, slow);
          }
        };
        audio.onerror = fallback;
        const attempt = audio.play();
        attempt?.catch(fallback);
        onStatus('speaking');
        return true;
      }
      cancel();
      return speakNative(text, slow);
    } catch {
      cancel();
      return speakNative(text, slow);
    }
  }

  function speakNative(text, slow) {
    try {
      if (voice === null) {
        refreshVoices(true);
      }

      if (synth.paused && typeof synth.resume === 'function') {
        synth.resume();
      }

      const utterance = new Utterance(text);
      utterance.lang = SPEECH_LANG;
      utterance.voice = voice;
      utterance.rate = slow ? 0.50 : SPEECH_RATE;
      utterance.pitch = 1;
      utterance.volume = 1;
      utterance.onend = () => {
        if (utterance === current) {
          current = null;
          onStatus('idle');
        }
      };
      utterance.onerror = (event) => {
        if (utterance !== current) {
          return;
        }
        current = null;
        onStatus(SELF_CANCEL_ERRORS.has(event?.error) ? 'idle' : 'error');
      };

      current = utterance;
      synth.speak(utterance);
      if (current === utterance) {
        onStatus('speaking');
      }
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
