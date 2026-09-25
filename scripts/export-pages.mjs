import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { ALL_WORDS } from '../lessons.js';

const root = fileURLToPath(new URL('../', import.meta.url));
export const SITE_FILES = Object.freeze([...new Set([
  '.nojekyll', 'robots.txt', 'index.html', 'styles.css', 'site-routing.js',
  'app.js', 'data.js', 'lessons.js', 'logic.js', 'speech.js', 'illustrations.js',
  'ink-pad.js', 'ui-helpers.js', 'focus-policy.js', 'spelling-timings.js',
  ...ALL_WORDS.flatMap(({ id }) => [
    `audio/en-gb-v1/${id}.mp3`, `audio/spelling-en-gb-v1/${id}.mp3`, `images/words/${id}.svg`,
  ]),
])]);

// Export public runtime files only. Source, tests, tooling and history stay here.
export async function exportSite(destination) {
  const output = path.resolve(destination);
  if (path.basename(output) !== 'spelling' || output.startsWith(root)) {
    throw new Error('Export to a separate portal checkout, in its spelling directory.');
  }
  // Read everything first so a missing asset cannot create a partial export.
  const assets = await Promise.all(SITE_FILES.map(file => fs.readFile(path.join(root, file))));
  for (const [index, file] of SITE_FILES.entries()) {
    const target = path.join(output, file);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, assets[index]);
  }
  return [...SITE_FILES];
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  if (!process.argv[2]) throw new Error('Usage: node scripts/export-pages.mjs ../portal/spelling');
  const files = await exportSite(process.argv[2]);
  console.log(`Exported ${files.length} public runtime files to spelling/.`);
}
