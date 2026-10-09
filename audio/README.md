# British English audio

Each curriculum word has a bundled pronunciation clip in `en-gb-v1/` and a post-answer spelling clip in `spelling-en-gb-v1/`, served from the same origin. The earlier ea/ee and ph/f audio and timings are preserved; sh/ch and two special words are added for 16/10/2026. No text or learner data is sent to a speech service during ordinary playback.

## Voice and pacing

- Synthesized stock voice: `en-GB-SoniaNeural` (British English).
- Word segments: synthesis rate `-25%`.
- Example sentences: synthesis rate `-35%`.
- Each recording contains the word, a 700 ms added pause, the contextual sentence, an 850 ms added pause, and the word again.
- Files are mono MP3, 24 kHz, 96 kb/s.
- Playback at `1` uses this deliberately slow recording. The **Más despacio** control plays it at `0.8`, preserving pitch where supported by the browser.

## Post-answer spelling clips

- The same `en-GB-SoniaNeural` voice synthesizes each English letter separately at `-10%` and the complete word at `-20%`. `read` uses the generation-only homophone `reed` for /riːd/.
- Each clip contains 550 ms of real silence between letter segments and 1.25 seconds of real silence after the final letter before the complete word. This avoids the distorted sound caused by aggressively slowing one continuous recording.
- Default spelling playback uses the prepared recording at `1`; **Deletrear más despacio** uses the mild `0.8` rate with pitch preservation where supported.
- The authored segment offsets, final-letter end and pre-word pause live in `spelling-timings.js`; they drive the visible highlight and clear it during the final pause.
- Spelling prompts are mapped from exact curriculum strings to fixed relative paths; caller-provided text never becomes an asset URL.
- The app requests these clips only in teaching/reveal feedback or after an answer, and only after final submission in the simulacro.

The original ea/ee sentences follow `getContextSentence` in `logic.js`. For `read`, the sentence is **I read every day.**, in the present tense. The generation-only homophone **reed** forces /riːd/ in every segment; the learner always sees the correct spelling **read**.

## Weekly ph/f audio — 02/10/2026

The ten additional IDs and sentences below are the exact confirmed lesson. This asset-only addition does not change curriculum data, playback mappings or application code. The pronunciation clips use the word at `-25%`, 0.70 s of added silence, the exact sentence at `-35%`, 0.85 s of added silence and the same word again. Spelling uses separately synthesized uppercase English letter names at `-10%`, 0.55 s PCM silence between letters, then 1.25 s PCM silence and the whole word at `-20%`. All new speech uses `en-GB-SoniaNeural`; no phonetic substitutions are used for this list.

| ID | Exact example sentence |
| --- | --- |
| dolphin | The dolphin jumps out of the water. |
| telephone | The telephone is ringing. |
| alphabet | I know the letters of the alphabet. |
| trophy | Our team won a trophy. |
| photograph | This photograph shows a sunny day. |
| elephant | The elephant has a long trunk. |
| pharmacy | We buy medicine at the pharmacy. |
| family | My family eats dinner together. |
| friends | My friends play with me. |
| people | The people are walking in the park. |

Generation uses Edge TTS 7.2.8 and FFmpeg 8.1. Existing matching letter-name source segments are reused; new source speech is generated only for missing letters, the new words and their exact sentences. Sources are decoded to mono 24 kHz PCM and trimmed only at the leading/trailing edges (forward trim, reverse, forward trim, reverse), retaining internal pauses. Exact PCM gaps are inserted, cue offsets are derived from sample counts, and each final clip is encoded once as 96 kb/s MP3 without identifying metadata.

Validation: all twenty new clips decode successfully and have the expected codec, channel count, sample rate and bit rate. FFmpeg `silencedetect=noise=-45dB:d=0.9` confirms the pre-word interval in all ten spelling binaries, within codec tolerance of 1.25 s; non-silent signal is independently required after `wordAt`. Original ea/ee binaries and cue entries are preserved. These checks establish playable assets and actual silence, not human listening or a physical-device test.

Recordings contain only the fixed lesson vocabulary and generic example sentences. They do not contain names, personal information, or learner responses. They are generated synthetic speech, not recordings of a person participating in the app.

## Weekly sh/ch audio — 16/10/2026

The new lesson adds the exact words below, using the same stock British voice `en-GB-SoniaNeural`. Pronunciation uses word segments at `-25%`, a 0.70 s PCM gap, the exact sentence at `-35%`, a 0.85 s PCM gap and the word again. Spelling uses uppercase letter names at `-10%`, 0.55 s PCM gaps between letters, a 1.25 s PCM gap before the final word at `-20%`. No phonetic substitutions are used. The forty earlier recordings and their cue entries are unchanged.

| ID | Exact example sentence |
| --- | --- |
| shorts | I wear shorts on a sunny day. |
| shops | There are three shops on this street. |
| shells | We found shells on the beach. |
| shoes | I put on my shoes. |
| chops | There are two chops on the plate. |
| cheese | I like cheese in my sandwich. |
| child | The child is reading a book. |
| chess | We play chess together. |
| you | You are my friend. |
| your | This is your bag. |

Generated with `edge-tts` 7.2.7, FFmpeg 7.0.2 (`imageio-ffmpeg` 0.6.0), and independently inspected with FFprobe 8.1. Sources are decoded to mono 24 kHz signed 16-bit PCM and edge-trimmed forwards and backwards, retaining internal pauses. Each final clip is encoded once as mono 24 kHz / 96 kbps MP3 with metadata stripped. The new `spelling-timings.js` entries are derived from the actual integer PCM frame counts.

All twenty new recordings fully decode. All ten spelling binaries contain a detected silent interval covering the authored pre-word pause and non-silent final-word audio after `wordAt`. Nineteen clips decode to the exact authored frame count; the `your` spelling clip has an additional 43 quiet codec-tail frames (1.79 ms, -84.26 dBFS), with no missing frames or changed cues. These technical checks do not claim human listening or physical-device testing. Only fixed generic words and sentences were sent for synthesis; no personal recording or learner response was uploaded.

If a recording cannot be played, the application can fall back to slower browser speech and ultimately the existing visual help. The files are fetched on demand; the app does not promise offline availability before they have been loaded.
