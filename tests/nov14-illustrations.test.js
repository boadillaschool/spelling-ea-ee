import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { getWordIllustration } from '../illustrations.js';

// Exact confirmed 2026-11-14 inventory; independent of lessons.js for the asset handoff.
// Scenes authored at 320 × 240 are fitted uniformly into the existing 320 × 200 frame.
const expected = [
  ['skirt', 'falda', 'Falda: una prenda azul de cintura estrecha y bajo ancho continuo, con pliegues y sin mangas ni perneras.'],
  ['bird', 'pájaro', 'Pájaro: un ave pequeña con pico, ala, cola y patas, posada en una rama; unas notas indican que canta.'],
  ['first', 'primero', 'Primero: el niño junto a la puerta abierta está delante de otras dos personas que esperan en una fila tranquila. Una flecha lo señala.'],
  ['birthday', 'cumpleaños', 'Cumpleaños: una tarta con velas decorativas, globos y un regalo, sin cifras ni nombres.'],
  ['thirsty', 'tener sed', 'Tener sed: un niño después de jugar estira el brazo hacia un vaso de agua; tiene una gota de sudor en la frente.'],
  ['shirt', 'camisa', 'Camisa: una prenda verde con cuello, dos mangas cortas y exactamente tres botones en la abertura central.'],
  ['thirteen', 'trece', 'Trece: trece estrellas separadas, en dos filas de cinco y una fila de tres, para poder contarlas.'],
  ['dirty', 'sucio', 'Sucio: un par de botas cubiertas de manchas y salpicaduras de barro, sobre un charco de tierra mojada.'],
  ['said', 'dijo', 'Dijo: una niña habla a otra persona que la escucha; el bocadillo que sale de su boca contiene trazos de voz, sin letras.'],
  ['one', 'uno', 'Uno: una sola manzana roja con su tallo y una hoja, sin más frutas alrededor.'],
];
const newIds = expected.map(([id]) => id);
const previousIds = [
  'easy', 'meat', 'peanuts', 'between', 'read', 'jeans', 'heel', 'sweets', 'street', 'reach',
  'dolphin', 'telephone', 'alphabet', 'trophy', 'photograph', 'elephant', 'pharmacy', 'family', 'friends', 'people',
  'shorts', 'shops', 'shells', 'shoes', 'chops', 'cheese', 'child', 'chess', 'you', 'your',
  'cried', 'tied-up', 'lied', 'night', 'frighten', 'light', 'tights', 'sky', 'fly', 'dry',
  'mice', 'rice', 'fire', 'bike', 'pine', 'five', 'line', 'kite', 'nine', 'slide',
  'smoke', 'home', 'bone', 'phone', 'mule', 'cube', 'tune', 'wake-up', 'came', 'mistake', 'because', 'should',
  'rat', 'gate', 'bed', 'beads', 'pin', 'socks', 'soak',
];
const permittedElements = new Set(['svg', 'title', 'desc', 'g', 'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon']);
const permittedAttributes = new Set([
  'xmlns', 'viewBox', 'role', 'aria-labelledby', 'id', 'd', 'points', 'transform',
  'x', 'y', 'x1', 'x2', 'y1', 'y2', 'width', 'height', 'rx', 'ry', 'cx', 'cy', 'r',
  'fill', 'fill-rule', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'stroke-dasharray', 'opacity',
]);
const palette = new Set([
  'none', '#17324D', '#146B63', '#F2C14E', '#FBF7EE', '#CFE3EC', '#7CAD96', '#BE805C', '#E5B18A',
  '#594235', '#526272', '#477DA6', '#35658C', '#6896B7', '#F1D4A2', '#C8553D', '#B5864F', '#D8D1C4',
]);

function assertHiddenAnswer(text) {
  for (const id of [...previousIds, ...newIds]) {
    assert.doesNotMatch(text, new RegExp(`\\b${id.replaceAll('-', '[- ]')}\\b`, 'i'), `English answer leaked: ${id}`);
  }
}

// Restricted contract parser for authored shape-only SVG; not a general sanitizer.
// A real XML parse and visual review are required separately in the handoff.
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
    if (['title', 'desc'].includes(stack.at(-1)?.tag)) assert.doesNotMatch(gap, /[<>]/);
    else assert.equal(gap.trim(), '', 'No visible text or unparsed markup');
    last = match.index + match[0].length;
    const [, closing, tag, rawAttributes, selfClosing] = match;
    assert.ok(permittedElements.has(tag), `Unexpected SVG element: ${tag}`);
    if (closing) {
      assert.equal(rawAttributes.trim(), '');
      assert.equal(selfClosing, '');
      assert.equal(stack.pop()?.tag, tag, 'Correctly nested XML required');
      continue;
    }
    if (!stack.length) { roots++; assert.equal(tag, 'svg'); }
    const attrs = {};
    const remainder = rawAttributes.replace(/\s+([\w:-]+)="([^"<>]*)"/g, (_, name, value) => {
      assert.ok(permittedAttributes.has(name), `Unexpected SVG attribute: ${name}`);
      assert.ok(!Object.hasOwn(attrs, name), `Duplicate XML attribute: ${name}`);
      attrs[name] = value;
      if (name !== 'xmlns') assert.doesNotMatch(value, /https?:|data:|javascript:/i);
      if (['fill', 'stroke'].includes(name)) assert.ok(palette.has(value), `Use the established palette: ${value}`);
      if (['x', 'y', 'x1', 'x2', 'y1', 'y2', 'width', 'height', 'rx', 'ry', 'cx', 'cy', 'r', 'stroke-width', 'opacity'].includes(name)) {
        assert.ok(value.trim() && Number.isFinite(Number(value)), `${name}: finite geometry required`);
        if (['width', 'height', 'rx', 'ry', 'r', 'stroke-width'].includes(name)) assert.ok(Number(value) > 0);
        if (name === 'opacity') assert.ok(Number(value) >= 0 && Number(value) <= 1);
      }
      if (['d', 'points', 'transform'].includes(name)) assert.doesNotMatch(value, /NaN|Infinity|undefined/);
      return '';
    });
    assert.equal(remainder.trim(), '', 'All attributes must be quoted and allowlisted');
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
  assert.equal(nodes[0].children.find(node => node.tag === 'g').attrs.transform, 'translate(26.666667 0) scale(0.833333333)', 'Fit the entire drawing without cropping or nonuniform stretching');
  const ids = nodes.filter(node => node.attrs.id).map(node => node.attrs.id);
  assert.equal(new Set(ids).size, ids.length, 'XML IDs must be unique');
  const titles = [...svg.matchAll(/<title id="titulo">([^<>]+)<\/title>/g)];
  const descriptions = [...svg.matchAll(/<desc id="descripcion">([^<>]+)<\/desc>/g)];
  assert.equal(titles.length, 1);
  assert.equal(descriptions.length, 1);
  const metadata = `${titles[0][1]} ${descriptions[0][1]}`;
  assertHiddenAnswer(metadata);
  assert.ok(nodes.filter(node => !['svg', 'g', 'title', 'desc'].includes(node.tag)).length >= 3);
  assert.match(svg, /stroke="#17324D" stroke-width="2\.6" stroke-linecap="round" stroke-linejoin="round"/);
  return { svg, nodes, metadata };
}

for (const [id, cue, alt] of expected) {
  test(`${id}: complete safe drawing and immutable Spanish meaning mapping without spelling leakage`, () => {
    const { metadata } = readSvg(id);
    const illustration = getWordIllustration(id);
    assert.ok(illustration, `Missing illustration mapping: ${id}`);
    assert.deepEqual(illustration, { src: `./images/words/${id}.svg`, alt });
    assert.equal(Object.isFrozen(illustration), true);
    assert.equal(getWordIllustration(id), illustration);
    assert.ok(alt.toLocaleLowerCase('es').includes(cue));
    assert.ok(metadata.toLocaleLowerCase('es').includes(cue));
    assertHiddenAnswer(alt);
  });
}

test('new routes are allowlisted IDs, not arbitrary paths or coerced user input', () => {
  const noCoercion = { toString() { throw new Error('Do not coerce caller input'); } };
  for (const id of newIds) {
    assert.ok(getWordIllustration(id), `Canonical route missing: ${id}`);
    for (const invalid of [id.toUpperCase(), `../${id}`, `${id}.svg`, `${id}?x=1`, `${id}#answer`, ` ${id}`, `${id}/`,
      `./images/words/${id}.svg`, `https://invalid.example/${id}.svg`, [id]]) {
      assert.equal(getWordIllustration(invalid), null);
    }
  }
  for (const invalid of ['', '__proto__', 'constructor', 'toString', null, undefined, 0, 1, true, noCoercion]) {
    assert.equal(getWordIllustration(invalid), null);
  }
});

test('only the ten confirmed assets extend the prior 69 SVG inventory', () => {
  const actual = readdirSync(new URL('../images/words/', import.meta.url)).sort();
  assert.deepEqual(actual, [...previousIds, ...newIds].map(id => `${id}.svg`).sort());
});

test('thirteen is exactly 13 separate five-pointed stars in rows of 5, 5 and 3', () => {
  const { nodes } = readSvg('thirteen');
  const shapes = nodes.filter(node => !['svg', 'g', 'title', 'desc'].includes(node.tag));
  assert.equal(shapes.length, 13, 'No extra decorations may alter the count');
  assert.ok(shapes.every(node => node.tag === 'polygon'));
  assert.deepEqual(shapes.map(node => node.attrs.id), Array.from({ length: 13 }, (_, i) => `estrella-${i + 1}`));
  const boxes = shapes.map(node => {
    const location = /^translate\((\d+) (\d+)\)$/.exec(node.attrs.transform);
    assert.ok(location, 'Each star needs a separate visible location');
    const [x, y] = location.slice(1).map(Number);
    const points = node.attrs.points.trim().split(/\s+/).map(pair => pair.split(',').map(Number));
    assert.equal(points.length, 10, 'Five outer tips and five inner corners');
    assert.ok(points.every(point => point.length === 2 && point.every(Number.isFinite)));
    assert.equal(node.attrs.points, shapes[0].attrs.points, 'Equal countable silhouettes');
    assert.equal(node.attrs.fill, '#F2C14E');
    return { x, y, left: x + Math.min(...points.map(p => p[0])), right: x + Math.max(...points.map(p => p[0])),
      top: y + Math.min(...points.map(p => p[1])), bottom: y + Math.max(...points.map(p => p[1])) };
  });
  const rows = [...new Set(boxes.map(box => box.y))].sort((a, b) => a - b);
  assert.deepEqual(rows.map(y => boxes.filter(box => box.y === y).length), [5, 5, 3]);
  for (const [i, box] of boxes.entries()) {
    assert.ok(box.left >= 8 && box.right <= 312 && box.top >= 8 && box.bottom <= 232, 'No clipped stars');
    for (const other of boxes.slice(i + 1)) {
      assert.ok(box.right + 8 <= other.left || other.right + 8 <= box.left || box.bottom + 8 <= other.top || other.bottom + 8 <= box.top,
        'Stars must remain individually countable with visible gaps');
    }
  }
});

test('one has exactly one complete apple with a stem and leaf, without extra fruit', () => {
  const { nodes } = readSvg('one');
  const apples = nodes.filter(node => node.tag === 'g' && /^manzana(?:-\d+)?$/.test(node.attrs.id || ''));
  assert.equal(apples.length, 1);
  const apple = apples[0];
  const bodies = nodes.filter(node => node.attrs.fill === '#C8553D');
  assert.equal(bodies.length, 1, 'Exactly one red fruit body');
  assert.ok(apple.children.includes(bodies[0]));
  assert.equal(bodies[0].tag, 'path');
  assert.match(bodies[0].attrs.d, /Z$/);
  for (const detail of ['tallo', 'hoja']) assert.ok(apple.children.some(node => node.attrs.id === detail));
  const shapes = nodes.filter(node => !['svg', 'g', 'title', 'desc'].includes(node.tag));
  assert.ok(shapes.every(node => apple.children.includes(node)), 'No additional objects outside the single fruit');
});

test('the skirt has an unbroken flared hem while the shirt has a collar and exactly three buttons', () => {
  const skirt = readSvg('skirt');
  const shirt = readSvg('shirt');
  const silhouette = skirt.nodes.find(node => node.attrs.id === 'tela');
  assert.equal(silhouette?.tag, 'path');
  assert.match(silhouette.attrs.d, /Q160 218 73 198Z$/, 'Continuous curved hem, not two trouser legs');
  assert.ok(skirt.nodes.some(node => node.attrs.id === 'cintura'));
  assert.doesNotMatch(skirt.metadata, /camisa|camiseta/i);
  const buttons = shirt.nodes.filter(node => /^boton-\d+$/.test(node.attrs.id || ''));
  assert.equal(buttons.length, 3);
  assert.ok(buttons.every(node => node.tag === 'circle' && node.attrs.cx === '160'));
  assert.equal(new Set(buttons.map(node => node.attrs.cy)).size, 3);
  assert.equal(shirt.nodes.filter(node => /^cuello-\d+$/.test(node.attrs.id || '')).length, 2);
  assert.doesNotMatch(shirt.metadata, /falda/i);
});

test('first identifies the front person at an open door in a calm stationary queue', () => {
  const { nodes, metadata } = readSvg('first');
  const people = nodes.filter(node => /^persona-\d+$/.test(node.attrs.id || ''));
  assert.equal(people.length, 3);
  const positions = people.map(node => {
    assert.ok(node.children.length >= 6, 'Each queue member must be drawn, not an empty group');
    const transform = /^translate\((\d+) 0\)$/.exec(node.attrs.transform);
    assert.ok(transform);
    return Number(transform[1]);
  });
  assert.ok(positions[0] < positions[1] && positions[1] < positions[2]);
  assert.ok(positions[1] - positions[0] > 50 && positions[2] - positions[1] > 50, 'A non-overlapping queue');
  assert.ok(nodes.some(node => node.attrs.id === 'puerta-abierta' && node.tag === 'path'));
  const arrow = nodes.find(node => node.attrs.id === 'indicador');
  assert.equal(arrow?.tag, 'path');
  assert.match(metadata, /primero.*puerta abierta/i);
  assert.match(metadata, /fila tranquila/i);
  assert.doesNotMatch(metadata, /carrera|ganador|podio|premio/i);
});

test('thirsty reaches toward actual water and dirty has two mud-covered boots', () => {
  const thirsty = readSvg('thirsty');
  for (const detail of ['brazo-extendido', 'vaso', 'agua', 'sudor']) {
    assert.ok(thirsty.nodes.some(node => node.attrs.id === detail && node.tag === 'path'), `Missing visible detail: ${detail}`);
  }
  assert.match(thirsty.metadata, /estira el brazo.*vaso de agua/i);
  const dirty = readSvg('dirty');
  const boots = dirty.nodes.filter(node => /^bota-\d+$/.test(node.attrs.id || ''));
  assert.equal(boots.length, 2);
  for (const boot of boots) {
    assert.ok(boot.children.filter(node => /^mancha-/.test(node.attrs.id || '')).length >= 2, 'Each boot visibly carries mud');
    assert.ok(boot.children.some(node => node.tag === 'path' && node.attrs.fill === '#146B63'));
  }
  assert.ok(dirty.nodes.some(node => node.attrs.id === 'charco'));
});

test('said shows a speaker, listener and speech bubble with voice strokes but no spelling text', () => {
  const { nodes, metadata } = readSvg('said');
  for (const id of ['hablante', 'oyente']) {
    const person = nodes.find(node => node.attrs.id === id);
    assert.equal(person?.tag, 'g');
    assert.ok(person.children.length >= 6);
  }
  const bubble = nodes.find(node => node.attrs.id === 'bocadillo');
  assert.equal(bubble?.tag, 'path');
  assert.match(bubble.attrs.d, /L119 106L128 82/, 'Speech bubble has a tail directed toward the speaker');
  assert.equal(nodes.filter(node => /^voz-\d+$/.test(node.attrs.id || '')).length, 3);
  assert.match(metadata, /dijo/i);
  assert.match(metadata, /escucha/i);
});
