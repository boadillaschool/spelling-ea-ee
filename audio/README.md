# British English audio

These twenty MP3 files are bundled with the application and served from the same origin: ten pronunciation clips in `en-gb-v1/` and ten post-answer spelling clips in `spelling-en-gb-v1/`. No text or learner data is sent to a speech service during ordinary playback.

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

The sentences follow `getContextSentence` in `logic.js`. For `read`, the sentence is **I read every day.**, in the present tense. The generation-only homophone **reed** forces /riːd/ in every segment; the learner always sees the correct spelling **read**.

Recordings contain only the fixed lesson vocabulary and generic example sentences. They do not contain names, personal information, or learner responses. They are generated synthetic speech, not recordings of a person participating in the app.

If a recording cannot be played, the application can fall back to slower browser speech and ultimately the existing visual help. The files are fetched on demand; the app does not promise offline availability before they have been loaded.
