import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { ALL_WORDS as WORDS } from '../lessons.js';

const permittedElements = new Set([
  'svg', 'title', 'desc', 'g', 'path', 'rect', 'circle', 'ellipse',
  'line', 'polyline', 'polygon',
]);
const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// This is a contract for our own static artwork, not a general SVG sanitizer.
// Meaning and anatomical/spatial accuracy also need visual review.
for (const { id } of WORDS) {
  test(`${id} has a self-contained, unlabelled 320 × 200 illustration`, () => {
    const file = new URL(`../images/words/${id}.svg`, import.meta.url);
    assert.ok(existsSync(file), `Missing illustration: images/words/${id}.svg`);
    const svg = readFileSync(file, 'utf8');

    assert.match(svg, /^\s*<svg\b[^>]*\bxmlns=["']http:\/\/www\.w3\.org\/2000\/svg["']/);
    assert.match(svg, /^\s*<svg\b[^>]*\bviewBox=["']0 0 320 200["']/);
    assert.match(svg, /<\/svg>\s*$/);
    assert.match(svg, /<title(?:\s[^>]*)?>[^<>]+<\/title>/);
    assert.match(svg, /<desc(?:\s[^>]*)?>[^<>]+<\/desc>/);
    assert.ok((svg.match(/<(?:path|rect|circle|ellipse|line|polyline|polygon)\b/g) || []).length >= 3,
      'The illustration must contain actual drawn shapes');

    // A small shape-only vocabulary excludes scripts, foreignObject, external
    // images, embedded styles, filters, animation, fonts, and rendered text.
    for (const [, element] of svg.matchAll(/<\/?([\w:-]+)\b/g)) {
      assert.ok(permittedElements.has(element), `Unexpected SVG element: ${element}`);
    }
    assert.doesNotMatch(svg, /<!|<\?|\bon\w+\s*=|\b(?:href|src|style|font-family)\s*=|url\s*\(/i,
      'Artwork cannot run code, load resources, embed CSS, or depend on fonts');

    const metadata = [...svg.matchAll(/<(?:title|desc)(?:\s[^>]*)?>([^<>]*)<\/(?:title|desc)>/g)]
      .map((match) => match[1]).join(' ');
    for (const { word } of WORDS) {
      assert.doesNotMatch(metadata, new RegExp(`\\b${escapeRegExp(word)}\\b`, 'i'),
        'Spanish metadata must not reveal an English answer');
    }
    const visibleText = svg
      .replace(/<(title|desc)(?:\s[^>]*)?>[^<>]*<\/\1>/g, '')
      .replace(/<[^>]*>/g, '').trim();
    assert.equal(visibleText, '', 'No visible labels or text are allowed');
  });
}
