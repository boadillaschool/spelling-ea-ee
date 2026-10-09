import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { getWordIllustration } from '../illustrations.js';

// Confirmed 2026-10-16 source inventory. Independent of the lesson registry so
// artwork can be verified before that lesson is integrated into the application.
const newIds = [
  'shorts', 'shops', 'shells', 'shoes', 'chops',
  'cheese', 'child', 'chess', 'you', 'your',
];
const previousIds = [
  'easy', 'meat', 'peanuts', 'between', 'read', 'jeans', 'heel', 'sweets', 'street', 'reach',
  'dolphin', 'telephone', 'alphabet', 'trophy', 'photograph', 'elephant', 'pharmacy', 'family', 'friends', 'people',
];

// Exact old-plus-new inventory: a substitute word or an unrelated asset is not
// acceptable merely because the total number of drawings is correct.
test('2026-10-16 adds exactly the ten confirmed illustrations and preserves the previous inventory', () => {
  const actual = readdirSync(new URL('../images/words/', import.meta.url)).sort();
  const expected = [...previousIds, ...newIds].map(id => `${id}.svg`).sort();
  const missing = expected.filter(file => !actual.includes(file));
  assert.deepEqual(missing, [], `Missing illustrations: ${missing.join(', ')}`);
  assert.deepEqual(actual, expected, 'Unexpected illustration outside the confirmed inventories');
});

const meanings = {
  shorts: [/pantalones cortos/i],
  shops: [/tres tiendas/i],
  shells: [/tres conchas/i],
  shoes: [/par de zapatos/i],
  chops: [/dos chuletas/i],
  cheese: [/queso/i],
  child: [/niño o niña/i, /leyendo/i],
  chess: [/ajedrez/i, /tablero/i],
  you: [/tú/i, /persona/i, /señalad[ao]/i],
  your: [/tu mochila/i, /te pertenece/i],
};
const permittedElements = new Set([
  'svg', 'title', 'desc', 'g', 'path', 'rect', 'circle', 'ellipse',
  'line', 'polyline', 'polygon',
]);
const permittedAttributes = new Set([
  'xmlns', 'viewBox', 'role', 'aria-labelledby', 'id',
  'd', 'points', 'transform', 'x', 'y', 'x1', 'x2', 'y1', 'y2',
  'width', 'height', 'rx', 'ry', 'cx', 'cy', 'r', 'fill', 'fill-rule',
  'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'stroke-dasharray', 'opacity',
]);

function assertHiddenAnswerSafe(text) {
  for (const word of [...previousIds, ...newIds]) {
    assert.doesNotMatch(text, new RegExp(`\\b${word}\\b`, 'i'),
      `Spanish accessible descriptions must not reveal the English answer: ${word}`);
  }
}

for (const id of newIds) {
  test(`${id}: shape-only SVG XML preserves Spanish meaning without exposing answers`, () => {
    const file = new URL(`../images/words/${id}.svg`, import.meta.url);
    assert.ok(existsSync(file), `Missing illustration: images/words/${id}.svg`);
    const svg = readFileSync(file, 'utf8');
    assert.match(svg, /^<svg\b[^>]*xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
    assert.match(svg, /^<svg\b[^>]*viewBox="0 0 320 200"/);
    assert.match(svg, /^<svg\b[^>]*role="img"[^>]*aria-labelledby="titulo descripcion"/);
    assert.match(svg, /<\/svg>\s*$/);
    assert.doesNotMatch(svg, /<!|<\?|&|\bon\w+\s*=|\b(?:href|src|style|font-family)\s*=|url\s*\(/i,
      'No entities, code, embedded styles, fonts or external resources');

    // Restricted XML contract for authored shapes, not a general sanitizer.
    // Check balanced elements and consume every quoted, allowlisted attribute.
    const stack = [];
    let roots = 0;
    let shapes = 0;
    for (const match of svg.matchAll(/<(\/)?([\w:-]+)([^<>]*?)(\/?)>/g)) {
      const [, closing, tag, rawAttributes, selfClosing] = match;
      assert.ok(permittedElements.has(tag), `Unexpected SVG element: ${tag}`);
      if (closing) {
        assert.equal(rawAttributes.trim(), '');
        assert.equal(selfClosing, '');
        assert.equal(stack.pop(), tag, 'SVG elements must be correctly nested');
        continue;
      }
      if (stack.length === 0) {
        roots++;
        assert.equal(tag, 'svg');
      }
      const seen = new Set();
      const remainder = rawAttributes.replace(/\s+([\w:-]+)="([^"<>]*)"/g, (_, name, value) => {
        assert.ok(permittedAttributes.has(name), `Unexpected SVG attribute: ${name}`);
        assert.ok(!seen.has(name), `Duplicate XML attribute: ${name}`);
        seen.add(name);
        if (name !== 'xmlns') assert.doesNotMatch(value, /https?:|data:|javascript:/i);
        return '';
      });
      assert.equal(remainder.trim(), '', 'All XML attributes must be quoted and valid');
      if (!['svg', 'title', 'desc', 'g'].includes(tag)) shapes++;
      if (!selfClosing) stack.push(tag);
    }
    assert.deepEqual(stack, [], 'SVG elements must close');
    assert.equal(roots, 1, 'SVG must have exactly one root');
    assert.ok(shapes >= 3, 'The illustration must contain actual drawn shapes');

    const titles = [...svg.matchAll(/<title id="titulo">([^<>]+)<\/title>/g)];
    const descriptions = [...svg.matchAll(/<desc id="descripcion">([^<>]+)<\/desc>/g)];
    assert.equal(titles.length, 1, 'One Spanish title must match aria-labelledby');
    assert.equal(descriptions.length, 1, 'One Spanish description must match aria-labelledby');
    const metadata = `${titles[0][1]} ${descriptions[0][1]}`;
    for (const meaning of meanings[id]) assert.match(metadata, meaning, `${id}: wrong intended meaning`);
    assertHiddenAnswerSafe(metadata);
    const visibleText = svg.replace(/<(title|desc)\b[^>]*>[^<>]*<\/\1>/g, '')
      .replace(/<[^>]*>/g, '').trim();
    assert.equal(visibleText, '', 'No rendered labels, captions or answers are allowed');
  });
}

test('the ten new IDs resolve to fixed, immutable local illustrations with answer-safe Spanish alts', () => {
  const sources = new Set();
  for (const id of newIds) {
    const illustration = getWordIllustration(id);
    assert.ok(illustration, `Missing illustration mapping: ${id}`);
    assert.deepEqual(Object.keys(illustration).sort(), ['alt', 'src']);
    assert.equal(illustration.src, `./images/words/${id}.svg`);
    assert.equal(Object.isFrozen(illustration), true);
    assert.equal(getWordIllustration(id), illustration, 'Return the allowlisted record, not a generated route');
    assert.ok(illustration.alt.length > 25, `${id}: meaningful Spanish description required`);
    for (const meaning of meanings[id]) assert.match(illustration.alt, meaning, `${id}: wrong alt meaning`);
    assertHiddenAnswerSafe(illustration.alt);
    sources.add(illustration.src);
  }
  assert.equal(sources.size, newIds.length);
});

test('person and possession stay distinguishable in Spanish accessible descriptions', () => {
  const person = getWordIllustration('you');
  const possession = getWordIllustration('your');
  assert.ok(person && possession, 'Missing person/possession illustration mappings');
  assert.match(person.alt, /^Tú:/);
  assert.match(person.alt, /persona.*señalada/i);
  assert.doesNotMatch(person.alt, /mochila/i);
  assert.match(possession.alt, /^Tu \(algo que te pertenece\):/);
  assert.match(possession.alt, /mochila/i);
  assert.doesNotMatch(possession.alt, /tú/i, 'Possessive tu is unaccented');
  assert.notEqual(person.src, possession.src);
});

test('unknown IDs and caller-supplied paths never become illustration URLs', () => {
  const noCoercion = { toString() { throw new Error('Never coerce an unknown ID to a filename'); } };
  for (const value of [
    '', 'unknown', 'short', 'shop', 'shell', 'shoe', 'chop', 'children',
    '../you', '../../your', 'YOU', 'you.svg', './images/words/you.svg',
    'you?answer=yes', 'your#label', 'https://invalid.example/you.svg',
    '__proto__', 'constructor', null, undefined, 0, ['you'], noCoercion,
  ]) assert.equal(getWordIllustration(value), null);
});
