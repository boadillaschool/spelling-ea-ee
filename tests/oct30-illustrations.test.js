import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { getWordIllustration } from '../illustrations.js';

// Confirmed source: the private 2026-10-30 manifest. Keep this contract independent
// of lessons.js so the artwork handoff is verifiable before app integration.
const expected = [
  ['mice', 'ratones', 'Ratones: dos ratones pequeños con orejas redondas, bigotes y colas largas, uno junto al otro.'],
  ['rice', 'arroz', 'Arroz: un cuenco lleno de arroz blanco, con muchos granos alargados visibles.'],
  ['fire', 'fuego', 'Fuego: una llama pequeña sobre leños dentro de una chimenea de ladrillo, detrás de una rejilla protectora.'],
  ['bike', 'bicicleta', 'Bicicleta: dos ruedas unidas por un cuadro verde, con sillín, manillar y pedales.'],
  ['pine', 'pino', 'Pino: un árbol de hojas perennes con copa verde en pisos puntiagudos, tronco marrón y una piña.'],
  ['five', 'cinco', 'Cinco: cinco lápices separados, colocados en una fila para poder contarlos.'],
  ['line', 'línea', 'Línea: un único trazo recto horizontal, con un punto en cada extremo.'],
  ['kite', 'cometa', 'Cometa: un juguete de rombo con cuatro paneles de color, una cola con lazos y un cordel.'],
  ['nine', 'nueve', 'Nueve: nueve estrellas separadas, ordenadas en tres filas de tres para poder contarlas.'],
  ['slide', 'tobogán', 'Tobogán: una escalera con peldaños lleva a una plataforma alta y a una rampa curva para deslizarse.'],
];
const newIds = expected.map(([id]) => id);
const permittedElements = new Set(['svg', 'title', 'desc', 'g', 'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon']);
const permittedAttributes = new Set([
  'xmlns', 'viewBox', 'role', 'aria-labelledby', 'id', 'd', 'points', 'transform',
  'x', 'y', 'x1', 'x2', 'y1', 'y2', 'width', 'height', 'rx', 'ry', 'cx', 'cy', 'r',
  'fill', 'fill-rule', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'stroke-dasharray', 'opacity',
]);
const meaningDetails = {
  mice: [/dos ratones/i, /orejas/i, /colas/i],
  rice: [/cuenco/i, /arroz/i, /granos/i],
  fire: [/llama pequeña/i, /chimenea/i, /rejilla/i],
  bike: [/ruedas/i, /sillín/i, /manillar/i, /pedales/i],
  pine: [/pino/i, /tronco/i, /piña/i],
  five: [/cinco lápices/i, /separados/i],
  line: [/trazo recto/i, /horizontal/i],
  kite: [/cometa/i, /rombo/i, /cola/i, /cordel/i],
  nine: [/nueve estrellas/i, /tres filas de tres/i],
  slide: [/escalera/i, /peldaños/i, /rampa/i],
};

// Restricted parser for this project's authored shape-only SVGs, not a sanitizer.
// A real XML parse and rendered geometry are also recorded in the local handoff.
function readSvg(id) {
  const file = new URL(`../images/words/${id}.svg`, import.meta.url);
  assert.ok(existsSync(file), `Missing illustration: images/words/${id}.svg`);
  const svg = readFileSync(file, 'utf8');
  assert.doesNotMatch(svg, /<!|<\?|&|\bon\w+\s*=|\b(?:href|src|style|font-family)\s*=|url\s*\(/i);
  const nodes = [];
  const stack = [];
  let roots = 0;
  let last = 0;
  for (const match of svg.matchAll(/<(\/)?([\w:-]+)([^<>]*?)(\/?)>/g)) {
    const gap = svg.slice(last, match.index);
    if (!['title', 'desc'].includes(stack.at(-1)?.tag)) assert.equal(gap.trim(), '', 'No visible text or unparsed markup');
    else assert.doesNotMatch(gap, /[<>]/, 'Metadata must be plain Spanish text');
    last = match.index + match[0].length;
    const [, closing, tag, rawAttributes, selfClosing] = match;
    assert.ok(permittedElements.has(tag), `Unexpected SVG element: ${tag}`);
    if (closing) {
      assert.equal(rawAttributes.trim(), '');
      assert.equal(selfClosing, '');
      assert.equal(stack.pop()?.tag, tag, 'Correctly nested XML required');
      continue;
    }
    if (!stack.length) {
      roots++;
      assert.equal(tag, 'svg');
    }
    const attrs = {};
    const remainder = rawAttributes.replace(/\s+([\w:-]+)="([^"<>]*)"/g, (_, name, value) => {
      assert.ok(permittedAttributes.has(name), `Unexpected SVG attribute: ${name}`);
      assert.ok(!Object.hasOwn(attrs, name), `Duplicate XML attribute: ${name}`);
      attrs[name] = value;
      if (name !== 'xmlns') assert.doesNotMatch(value, /https?:|data:|javascript:/i);
      if (['x', 'y', 'x1', 'x2', 'y1', 'y2', 'width', 'height', 'rx', 'ry', 'cx', 'cy', 'r', 'stroke-width', 'opacity'].includes(name)) {
        assert.ok(value.trim() && Number.isFinite(Number(value)), `${name}: finite geometry required`);
        if (['width', 'height', 'rx', 'ry', 'r', 'stroke-width'].includes(name)) assert.ok(Number(value) > 0);
      }
      if (['d', 'points', 'transform'].includes(name)) assert.doesNotMatch(value, /NaN|Infinity|undefined/);
      return '';
    });
    assert.equal(remainder.trim(), '', 'Every attribute must be quoted and allowlisted');
    const node = { tag, attrs, children: [] };
    stack.at(-1)?.children.push(node);
    nodes.push(node);
    if (!selfClosing) stack.push(node);
  }
  assert.equal(svg.slice(last).trim(), '');
  assert.deepEqual(stack, []);
  assert.equal(roots, 1);
  assert.deepEqual(nodes[0].attrs, {
    xmlns: 'http://www.w3.org/2000/svg', viewBox: '0 0 320 200', role: 'img', 'aria-labelledby': 'titulo descripcion',
  });
  const identifiers = nodes.filter(node => node.attrs.id).map(node => node.attrs.id);
  assert.equal(new Set(identifiers).size, identifiers.length, 'XML IDs must be unique');
  const titles = [...svg.matchAll(/<title id="titulo">([^<>]+)<\/title>/g)];
  const descriptions = [...svg.matchAll(/<desc id="descripcion">([^<>]+)<\/desc>/g)];
  assert.equal(titles.length, 1);
  assert.equal(descriptions.length, 1);
  assert.ok(nodes.filter(node => !['svg', 'title', 'desc', 'g'].includes(node.tag)).length >= 3);
  const metadata = `${titles[0][1]} ${descriptions[0][1]}`;
  assertNoEnglishAnswer(metadata);
  return { svg, nodes, metadata };
}

const previousIds = [
  'easy', 'meat', 'peanuts', 'between', 'read', 'jeans', 'heel', 'sweets', 'street', 'reach',
  'dolphin', 'telephone', 'alphabet', 'trophy', 'photograph', 'elephant', 'pharmacy', 'family', 'friends', 'people',
  'shorts', 'shops', 'shells', 'shoes', 'chops', 'cheese', 'child', 'chess', 'you', 'your',
  'cried', 'tied-up', 'lied', 'night', 'frighten', 'light', 'tights', 'sky', 'fly', 'dry',
];

function assertNoEnglishAnswer(text) {
  for (const id of [...previousIds, ...newIds]) {
    assert.doesNotMatch(text, new RegExp(`\\b${id.replaceAll('-', '[- ]')}\\b`, 'i'),
      `Accessible descriptions must not reveal the English answer: ${id}`);
  }
}

test('2026-10-30 canonical IDs resolve to exact immutable local mappings with Spanish alts', () => {
  const sources = new Set();
  for (const [id, cue, alt] of expected) {
    const illustration = getWordIllustration(id);
    assert.ok(illustration, `Missing illustration mapping: ${id}`);
    assert.deepEqual(illustration, { src: `./images/words/${id}.svg`, alt });
    assert.equal(Object.isFrozen(illustration), true);
    assert.equal(getWordIllustration(id), illustration, 'Return the fixed record, not a caller-generated route');
    assert.ok(illustration.alt.toLocaleLowerCase('es').includes(cue), `${id}: missing canonical Spanish cue`);
    assertNoEnglishAnswer(illustration.alt);
    sources.add(illustration.src);
  }
  assert.equal(sources.size, newIds.length);
  const noCoercion = { toString() { throw new Error('Do not turn unknown input into a path'); } };
  for (const input of ['', 'mouse', 'kites', 'MICE', '../mice', 'rice.svg', 'side', 'slide#answer', 'nine?x=1',
    './images/words/bike.svg', 'https://invalid.example/pine.svg', '__proto__', 'constructor',
    null, undefined, 0, ['five'], noCoercion]) assert.equal(getWordIllustration(input), null);
});

test('2026-10-30 adds exactly the confirmed ten illustrations to the unchanged previous inventory', () => {
  const actual = readdirSync(new URL('../images/words/', import.meta.url)).sort();
  const expectedFiles = [...previousIds, ...newIds].map(id => `${id}.svg`).sort();
  const missing = expectedFiles.filter(file => !actual.includes(file));
  assert.deepEqual(missing, [], `Missing confirmed illustrations: ${missing.join(', ')}`);
  assert.deepEqual(actual, expectedFiles, 'No substitutions, unconfirmed illustrations or scratch files');
});

for (const [id, cue] of expected) {
  test(`${id}: local shape-only SVG has Spanish meaning without exposed English answers`, () => {
    const { metadata, svg } = readSvg(id);
    assert.ok(metadata.toLocaleLowerCase('es').includes(cue));
    for (const meaning of meaningDetails[id]) {
      assert.match(metadata, meaning);
      assert.match(getWordIllustration(id).alt, meaning);
    }
    assert.match(svg, /stroke="#17324D" stroke-width="2\.6" stroke-linecap="round" stroke-linejoin="round"/);
  });
}

test('five means exactly five separate complete pencils, not a numeral or decorative extra', () => {
  const { nodes } = readSvg('five');
  const pencils = nodes.filter(node => node.tag === 'g' && /^lapiz-\d+$/.test(node.attrs.id || ''));
  assert.deepEqual(pencils.map(node => node.attrs.id), ['lapiz-1', 'lapiz-2', 'lapiz-3', 'lapiz-4', 'lapiz-5']);
  const positions = pencils.map(node => {
    const match = /^translate\((\d+) 0\)$/.exec(node.attrs.transform);
    assert.ok(match, 'Separate horizontal placement required');
    const bodies = node.children.filter(child => child.tag === 'rect' && child.attrs.height === '101');
    assert.equal(bodies.length, 1, 'Each pencil has one full-length body');
    assert.equal(node.children.filter(child => child.tag === 'polygon' && child.attrs.points === '0,140 20,140 10,166').length, 1,
      'Each pencil has its own wooden tip');
    return Number(match[1]);
  });
  positions.sort((a, b) => a - b);
  for (let i = 1; i < positions.length; i++) assert.ok(positions[i] - positions[i - 1] >= 30, 'Pencils must not touch');
  assert.equal(nodes.filter(node => node.tag === 'polygon' && node.attrs.points === '0,140 20,140 10,166').length, 5);
});

test('nine means exactly nine five-pointed stars in a spaced three-by-three arrangement', () => {
  const { nodes } = readSvg('nine');
  const stars = nodes.filter(node => node.tag === 'polygon');
  assert.equal(stars.length, 9);
  assert.equal(nodes.filter(node => ['path', 'rect', 'ellipse', 'circle', 'line', 'polyline'].includes(node.tag)).length, 0,
    'No extra decorative objects may alter the count');
  assert.deepEqual(stars.map(node => node.attrs.id), Array.from({ length: 9 }, (_, i) => `estrella-${i + 1}`));
  const locations = stars.map(node => {
    const match = /^translate\((\d+) (\d+)\)$/.exec(node.attrs.transform);
    assert.ok(match);
    const points = node.attrs.points.trim().split(/\s+/).map(pair => pair.split(',').map(Number));
    assert.equal(points.length, 10, 'Five tips and five inner corners');
    assert.ok(points.every(point => point.length === 2 && point.every(Number.isFinite)));
    assert.equal(node.attrs.points, stars[0].attrs.points, 'All nine stars have the same countable silhouette');
    return [Number(match[1]), Number(match[2])];
  });
  assert.equal(new Set(locations.map(([x]) => x)).size, 3);
  assert.equal(new Set(locations.map(([, y]) => y)).size, 3);
  assert.equal(new Set(locations.map(pair => pair.join(','))).size, 9);
});

test('plural mice remain two distinct drawn subjects', () => {
  for (const [id, prefix] of [['mice', 'raton']]) {
    const { nodes } = readSvg(id);
    const subjects = nodes.filter(node => node.tag === 'g' && new RegExp(`^${prefix}-\\d+$`).test(node.attrs.id || ''));
    assert.deepEqual(subjects.map(node => node.attrs.id), [`${prefix}-1`, `${prefix}-2`]);
    assert.ok(subjects.every(node => node.children.length >= 5), 'Both subjects must be actual drawings');
  }
});

test('line is one straight horizontal stroke with two endpoints and no competing strokes', () => {
  const { nodes } = readSvg('line');
  const shapes = nodes.filter(node => !['svg', 'title', 'desc', 'g'].includes(node.tag));
  assert.deepEqual(shapes.map(node => node.tag), ['path', 'circle', 'circle']);
  assert.equal(shapes[0].attrs.d, 'M60 100H260');
  assert.equal(shapes[0].attrs.fill, 'none');
  assert.deepEqual(shapes.slice(1).map(node => [node.attrs.cx, node.attrs.cy]), [['60', '100'], ['260', '100']]);
});

