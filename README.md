# Boadilla School · Spelling: ea + ee

The first app of the **Boadilla School** family of educational apps: a small, static, mobile-first spelling practice app for ten English words with the `ea` and `ee` patterns:
`easy`, `meat`, `peanuts`, `between`, `read` (present /riːd/), `jeans`, `heel`, `sweets`, `street`, `reach`.

The interface is in Spanish (aimed at 2º de Primaria); the audio is British English.

## Clear, slower audio

- Each word has a bundled British English MP3: word, pause, example sentence, pause, word.
- Sentences are synthesized more slowly than isolated words; all devices play the same prepared pronunciation.
- **Más despacio** replays the clip at ×0.8 with pitch preservation. Normal playback is already deliberately paced for learning.
- `read` uses the present-tense /riːd/ sound. See [audio provenance](audio/README.md) for the voice, pacing and generation details.
- Clips load from this site's own `audio/en-gb-v1/` directory, not a third-party speech API. They work without installed browser voices.
- If a clip cannot play, Web Speech is the fallback: prefer `en-GB`, rate 0.64 (or 0.50 for the slower replay). Its voice quality depends on the device.
- Replaying or changing the prompt cancels earlier audio; finishing learning or opening the mock review also stops playback.

## Choose from the ten-word list

- The home screen leads with **Practica tus 10 palabras** and the complete, unchanged vocabulary list.
- All ten native checkboxes are selected on arrival. Tap a word, **Marcar todas**, or **Quitar todas** to choose a smaller set.
- A live counter and the main practice button show the exact selection size. With no words selected, practice is disabled and explains what to do.
- Both home practice buttons use only the checked words, once each, keeping the existing review priority. The list is hidden during spelling practice.
- The choice survives returning home in the same page session; reloading starts with all ten again. Changing the selection writes nothing to storage.
- **Aprender** and **Simulacro** still cover all ten words. The daily mission is a secondary, explicitly optional suggestion with its own clearly labeled subset.

## Modes

- **Aprender**: active recall. Hear the word, reveal the spelling with only `ea`/`ee` highlighted, identify the family, hide it, then type it once.
- **Practicar**: select from the ten-word list, then type each chosen word you hear. After a first mistake you can retry; after a second one the spelling is revealed, hidden again, and must be typed correctly once.
- **Repasar errores**: the same flow, limited to words that need more work.
- **Simulacro**: the ten words exactly once in random order, with no hints or feedback until you submit. If speech is unsupported, or playback fails for a prompt, the Spanish cue is shown as a fallback for that prompt.
- **Resultado** (`Has terminado`): score, best mock score, words to revisit, a suggested next step, and sharing with the app URL (Web Share, clipboard, or manual copy).

## Privacy

- No analytics, trackers, remote fonts, CDNs, API calls or service workers.
- Only aggregate counters, mistake counts and mock scores are stored in `localStorage` under `spelling-ea-ee:v1`. Typed answers and names are never stored.
- The page ships a restrictive Content-Security-Policy, a `no-referrer` policy, `noindex` metadata and a `robots.txt` that disallows crawling.
- The app keeps working if `localStorage`, `speechSynthesis`, Web Share or the clipboard are unavailable.

## Run locally

There is no build step and there are no dependencies. Serve the folder with any static server, for example:

```sh
python -m http.server 8000
```

Then open `localhost:8000` in a browser. All asset and module URLs are relative, so the app also works from a project sub-path such as GitHub Pages.

## Tests

```sh
npm test        # Node built-in test runner
npm run check   # syntax check of the JavaScript modules
```

Optional browser checks require Playwright as developer tooling only:

```sh
npm install --no-save --package-lock=false playwright
npx playwright install chromium
npm run check:browser
```

The check serves the app locally, exercises all-ten and subset sessions, keyboard selection, empty selection, storage isolation, mobile layouts and 200% text size. Evidence goes to the system temporary directory, never this repository. Set `BASE` to test a deployment, `QA_OUT` to choose an evidence directory, or `AXE_SOURCE` to an installed `axe-core/axe.min.js` file for additional WCAG checks. `PLAYWRIGHT_MODULE` and `BROWSER_PATH` can point to existing developer-tool installations.

## Files

| File | Purpose |
| --- | --- |
| `index.html`, `styles.css` | Static shell (Boadilla School lockup) and the visual system: palette, type and spacing tokens |
| `app.js` | UI state machine and rendering (`textContent`/`createElement` only) |
| `logic.js` | Pure, tested logic: validation, progress, transitions, mock scoring, summaries |
| `ui-helpers.js` | Small pure UI helpers: nullish-safe child lists, audio button label |
| `focus-policy.js` | Pure focus policy: focus moves on screen/step changes, not on same-step feedback |
| `speech.js` | Bundled audio playback, cancellation, and slower en-GB Web Speech fallback |
| `audio/en-gb-v1/` | Ten same-origin British English pronunciation clips |
| `data.js` | The ten words with cues and sentences |
| `tests/` | Unit tests |
