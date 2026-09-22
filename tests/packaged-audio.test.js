import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { WORDS } from '../data.js';

test('every curriculum word ships a nonempty local MP3 pronunciation clip', async () => {
  const folder = new URL('../audio/en-gb-v1/', import.meta.url);
  for (const { id } of WORDS) {
    const bytes = await readFile(new URL(`${id}.mp3`, folder));
    assert.ok(bytes.length > 8000, `${id} must contain real audio, not a placeholder`);
    assert.ok(
      bytes.subarray(0, 3).toString('ascii') === 'ID3' ||
        (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0),
      `${id} must have an MP3 header`,
    );
  }
  const files = (await readdir(folder)).filter((name) => name.endsWith('.mp3')).sort();
  assert.deepEqual(files, WORDS.map(({ id }) => `${id}.mp3`).sort());
});

test('every curriculum word ships a paced local MP3 spelling clip', async () => {
  const folder = new URL('../audio/spelling-en-gb-v1/', import.meta.url);
  for (const { id } of WORDS) {
    const bytes = await readFile(new URL(`${id}.mp3`, folder));
    assert.ok(bytes.length > 8000, `${id} spelling must contain real audio`);
    assert.ok(
      bytes.subarray(0, 3).toString('ascii') === 'ID3' ||
        (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0),
      `${id} spelling must have an MP3 header`,
    );
  }
  const files = (await readdir(folder)).filter((name) => name.endsWith('.mp3')).sort();
  assert.deepEqual(files, WORDS.map(({ id }) => `${id}.mp3`).sort());
});
