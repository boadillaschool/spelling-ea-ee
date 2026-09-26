# Boadilla School · Weekly spelling lists

A small, static, mobile-first spelling app. The front page lets families choose a dated ten-word list, with the same learning, writing, notebook, review and mock activities for each list.

- **25 September 2026 — ea / ee:** `easy`, `meat`, `peanuts`, `between`, `read` (present /riːd/), `jeans`, `heel`, `sweets`, `street`, `reach`.
- **2 October 2026 — ph / f:** `dolphin`, `telephone`, `alphabet`, `trophy`, `photograph`, `elephant`, `pharmacy`, `family`, `friends`, `people`.

`people` is an extra spelling word, not an example of either pattern. Its learning flow skips the pattern-choice step. Both `ph` groups are highlighted in `photograph`.

## Public address and publication

**https://boadillaschool.github.io/spelling/** is the stable public address for every weekly list.

Source code and tests stay in the independent `boadillaschool/spelling-ea-ee` repository. The portal repository `boadillaschool/boadillaschool.github.io` hosts a generated, runtime-only copy in `spelling/`. Do not edit that copy by hand.

For each release, with both repositories checked out locally:

1. Update and test this source repository; commit the reviewed changes with the neutral project identity.
2. Run `node scripts/export-pages.mjs ../boadillaschool.github.io/spelling` (adjust the portal checkout path). It copies only the allowlisted modules, static shell and assets for all registered words; never development tooling or private files.
3. Review and commit the portal's generated `spelling/` changes, publish its `main` branch, and verify the actual Pages URL and asset bytes.
4. Only once `/spelling/` works, publish this source repository's `main` branch. Its old Pages URL redirects to the new path; lesson dates are preserved, unrelated URL parameters and fragments are dropped.
5. Keep both repositories and histories. Future lesson changes must also be exported to the portal, not just pushed here.

The origin and all existing lesson storage keys remain unchanged. Moving between the two paths therefore uses the same local progress in the same browser; no learner data is copied or uploaded. The redirect runs only on the exact legacy path, never on `/spelling/` or the local development root.

## Dated routes and separate progress

- The root page is the list chooser. `?list=2026-09-25` and `?list=2026-10-02` open the corresponding lists; unknown IDs return to the chooser.
- **Inicio** returns to the current lesson. **Elegir otra lista** opens the front page; links, reload and browser Back/Forward use ordinary same-origin navigation.
- Each list keeps its own aggregate progress. The first list retains the original `spelling-ea-ee:v1` storage key, so existing work is not lost. The new list uses `spelling-ea-ee:list:2026-10-02:v1`.
- Reset clears only the current list. Sharing includes the list date and its canonical link, without unrelated query parameters.
- Curriculum metadata is in `lessons.js`; the original inventory remains unchanged in `data.js`. No source photographs or identifying school/child information are published.

The interface is in Spanish (aimed at 2º de Primaria); the audio is British English.

## Clear, slower audio

- Each word has a bundled British English MP3: word, pause, example sentence, pause, word.
- Sentences are synthesized more slowly than isolated words; all devices play the same prepared pronunciation.
- **Más despacio** replays the clip at ×0.8 with pitch preservation. Normal playback is already deliberately paced for learning.
- `read` uses the present-tense /riːd/ sound. See [audio provenance](audio/README.md) for the voice, pacing and generation details.
- Clips load from this site's own `audio/en-gb-v1/` directory, not a third-party speech API. They work without installed browser voices.
- If a clip cannot play, Web Speech is the fallback: prefer `en-GB`, rate 0.64 (or 0.50 for the slower pronunciation replay). Spelling feedback uses the deliberately slower rates 0.45 and 0.32. Voice quality depends on the device.
- Replaying or changing the prompt cancels earlier audio; finishing learning or opening the mock review also stops playback.

## Post-answer spelling and handwriting

- After a retrieval attempt, a separate bundled British-English clip spells the word with naturally synthesized letter segments and real pauses, highlights the active letter, waits 1.25 seconds after the final letter, then repeats the whole word. The prepared clip plays at its natural ×1 rate; **Deletrear más despacio** uses the mild ×0.8 rate. Practice and the mock never request spelling audio before the answer is submitted.
- **Deletrear otra vez** and **Deletrear más despacio** are available only in teaching or feedback states.
- **Teclado** and **Lápiz de la tablet** both keep a native text input, so Android's handwriting keyboard can supply text that the app checks normally.
- **Cuaderno con lápiz** is a local freehand canvas with pressure-aware pointer strokes, high-DPI rendering, undo, clear, compare and self-assessment. Keyboard and switch users can choose **Comparar** without drawing. It deliberately does not claim handwriting recognition; raw ink is never saved.
- After **Comparar**, **Volver a escribir (opcional)** offers a separate copy area with the model visible: freehand pencil by default, or a native keyboard field with **Comprobar copia**. The original attempt remains unchanged. Copying is never required to continue and does not count as recall or change progress; self-assessment still refers to the first attempt.
- Copy drafts and ink stay in memory only. Retrying, advancing, finishing, going home, changing lists or leaving the page discards them, including cached Back navigation.
- The optional fullscreen control is explicit and progressively enhanced. Answer fields and their submit buttons stay in one form, with `visualViewport` handling for software keyboards.

## Delayed and spaced review

- A word missed in practice returns once after up to two intervening prompts. The repeat does not inflate the original denominator or first-try score.
- Local progress distinguishes new, learning, due and secure words. A word becomes secure only after clean recall on separate days; a later due date or any miss returns it to review.
- Existing version-1 local progress is sanitized and migrated conservatively: historical aggregates can seed learning, but never secure mastery.

## Choose from the ten-word list

- The home screen leads with **Practica tus 10 palabras** and the complete, unchanged vocabulary list.
- All ten native checkboxes are selected on arrival. Tap a word, **Marcar todas**, or **Quitar todas** to choose a smaller set.
- A live counter and the main practice button show the exact selection size. With no words selected, practice is disabled and explains what to do.
- Both home practice buttons use only the checked words, once each, keeping the existing review priority. The list is hidden during spelling practice.
- The choice survives returning home in the same page session; reloading starts with all ten again. Changing the selection writes nothing to storage.
- **Aprender** and **Simulacro** still cover all ten words. The daily mission is a secondary, explicitly optional suggestion with its own clearly labeled subset.

## Meaning illustrations

- Each word in both lists has its own original, local SVG illustration, shown with the active word throughout learning, practice, error review and mock questions.
- The drawings explain the meaning, not the spelling: there are no English answers written inside the pictures or their Spanish alternative text.
- Relational words use scenes: a ball between two boxes, a person reaching for a shelf, and a simple two-piece puzzle for `easy`. The `heel` illustration identifies the back of a bare foot.
- Images load from `images/words/` on the same origin. No stock-image service, third-party request, tracking or remote font is involved.
- Explicit dimensions reserve space before loading. Compact images leave room for the task, with smaller pictures on short screens.
- If an image fails to load, its Spanish meaning description appears instead; answering and audio keep working.
- See [image provenance and usage](images/README.md).

## Modes

- **Aprender**: active recall. Hear the word, reveal the spelling with the current lesson pattern highlighted, identify the family (except the extra word `people`), hide it, then type it once.
- **Practicar**: select from the ten-word list, then type each chosen word you hear. After a first mistake you can retry; after a second one the spelling is revealed, hidden again, and must be typed correctly once. A miss returns later in the same session for delayed retrieval.
- **Cuaderno con lápiz**: write each selected word freely on a local canvas, compare it with the model and self-assess without OCR.
- **Repasar errores**: the same flow, combining active errors with words whose spaced-review date has arrived.
- **Simulacro**: the ten words exactly once in random order, with meaning illustrations but no revealed spelling or corrections until you submit. If speech is unsupported, or playback fails for a prompt, the Spanish cue is shown as a fallback for that prompt.
- **Resultado** (`Has terminado`): score, best mock score, words to revisit, a suggested next step, and sharing with the app URL (Web Share, clipboard, or manual copy).

## Privacy

- No analytics, trackers, remote fonts, CDNs, API calls or service workers.
- Only aggregate counters, spaced-review timestamps/levels and mock scores are stored in `localStorage` under separate lesson keys, preserving the original `spelling-ea-ee:v1` key. The current schema is version 2 and migrates valid version-1 snapshots in place. Typed answers, names and canvas strokes are never stored.
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
npm run check:weekly
npm run check:rewrite
PORTAL_ROOT=../boadillaschool.github.io npm run check:migration
npm run check:browser
npm run check:illustrations
npm run check:learning
npm run check:responsive
BROWSER_ENGINE=firefox npm run check:smoke
BROWSER_ENGINE=webkit npm run check:smoke
```

The checks serve the app locally, exercise all-ten and subset sessions, keyboard selection, empty selection, storage isolation, mobile layouts, 200% text size and project-path routing. Evidence goes to the system temporary directory, never this repository. Set `BASE` to test a deployment, `QA_OUT` to choose an evidence directory, `BROWSER_ENGINE` to `chromium`, `firefox` or `webkit`, or `AXE_SOURCE` to an installed `axe-core/axe.min.js` file for additional WCAG checks. `PLAYWRIGHT_MODULE` and `BROWSER_PATH` can point to existing developer-tool installations.

## Files

| File | Purpose |
| --- | --- |
| `index.html`, `styles.css` | Static shell (Boadilla School lockup) and the visual system: palette, type and spacing tokens |
| `app.js` | UI state machine and rendering (`textContent`/`createElement` only) |
| `logic.js` | Pure, tested logic: validation, progress, transitions, mock scoring, summaries |
| `ui-helpers.js` | Small pure UI helpers: nullish-safe child lists, audio button label |
| `focus-policy.js` | Pure focus policy: focus moves on screen/step changes, not on same-step feedback |
| `speech.js`, `spelling-timings.js` | Bundled word/spelling playback, cancellation, letter cues and slower en-GB Web Speech fallback |
| `audio/en-gb-v1/`, `audio/spelling-en-gb-v1/` | Ten pronunciation clips and ten paced spelling clips, all same-origin |
| `ink-pad.js` | Pure local freehand-stroke state, normalization, undo and clear logic |
| `illustrations.js`, `images/words/` | Fixed word-to-image metadata, Spanish alt text and ten original meaning illustrations |
| `data.js` | The ten words with cues and sentences |
| `tests/` | Unit tests |
