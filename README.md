# Boadilla School · Spelling: ea + ee

The first app of the **Boadilla School** family of educational apps: a small, static, mobile-first spelling practice app for ten English words with the `ea` and `ee` patterns:
`easy`, `meat`, `peanuts`, `between`, `read` (present /riːd/), `jeans`, `heel`, `sweets`, `street`, `reach`.

The interface is in Spanish (aimed at 2º de Primaria); the audio is British English.

## Modes

- **Aprender**: active recall. Hear the word, reveal the spelling with only `ea`/`ee` highlighted, identify the family, hide it, then type it once.
- **Practicar**: type the word you hear. After a first mistake you can retry; after a second one the spelling is revealed, hidden again, and must be typed correctly once.
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

## Files

| File | Purpose |
| --- | --- |
| `index.html`, `styles.css` | Static shell (Boadilla School lockup) and the visual system: palette, type and spacing tokens |
| `app.js` | UI state machine and rendering (`textContent`/`createElement` only) |
| `logic.js` | Pure, tested logic: validation, progress, transitions, mock scoring, summaries |
| `ui-helpers.js` | Small pure UI helpers: nullish-safe child lists, audio button label |
| `focus-policy.js` | Pure focus policy: focus moves on screen/step changes, not on same-step feedback |
| `speech.js` | Web Speech wrapper: en-GB voice selection, rate 0.82, safe fallbacks |
| `data.js` | The ten words with cues and sentences |
| `tests/` | Unit tests |
