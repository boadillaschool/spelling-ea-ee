import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { getWordIllustration } from '../illustrations.js';

// Confirmed 2026-11-13 source: seven new drawings; pine, you and your are reused.
// Independent of lessons.js so this asset handoff can be tested before integration.
const newIds = ['rat', 'gate', 'bed', 'beads', 'pin', 'socks', 'soak'];
const reusedIds = ['pine', 'you', 'your'];
const expected = [
  ['soak', 'poner en remojo', 'Poner en remojo: un paño está sumergido en el agua de un recipiente transparente, con pliegues visibles y ondas de agua a su alrededor.'],
  ['socks', 'calcetines', 'Calcetines: un par de calcetines verdes separados, con puños de canalé claros, talones y punteras amarillos.'],
  ['pin', 'alfiler', 'Alfiler: un alfiler recto con una cabeza redonda roja, una varilla metálica fina y una punta afilada.'],
  ['beads', 'cuentas de collar', 'Cuentas de collar: varias cuentas redondas de colores tienen agujeros visibles por los que pasa una cuerda curvada.'],
  ['bed', 'cama', 'Cama: una cama vacía con cabecero de madera, almohada clara, colchón y manta verde, apoyada sobre sus patas.'],
  ['gate', 'puerta de jardín', 'Puerta de jardín: una puerta de listones verdes entre dos postes, con bisagras y pestillo, da paso a un sendero entre plantas.'],
  ['rat', 'rata', 'Rata: una rata gris de cuerpo robusto, orejas pequeñas, hocico alargado, bigotes y cola larga y curvada.'],
];
const allowedElements = new Set(['svg', 'title', 'desc', 'g', 'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon']);
const allowedAttributes = new Set([
  'xmlns', 'viewBox', 'role', 'aria-labelledby', 'id', 'd', 'points', 'transform',
  'x', 'y', 'x1', 'x2', 'y1', 'y2', 'width', 'height', 'rx', 'ry', 'cx', 'cy', 'r',
  'fill', 'fill-rule', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'stroke-dasharray', 'opacity',
]);
const palette = new Set(['none', '#17324D', '#146B63', '#F2C14E', '#FBF7EE', '#CFE3EC', '#D8DDE2', '#E6E9EB', '#BE805C', '#E5B18A', '#94A6B3', '#7CAD96', '#B5864F', '#D8D1C4', '#C8553D', '#F1D4A2']);

function assertHiddenAnswer(text) {
  for (const id of [...newIds, ...reusedIds]) {
    assert.doesNotMatch(text, new RegExp(`\\b${id}\\b`, 'i'), `English answer leaked: ${id}`);
  }
}

// Restricted contract parser for these authored shape-only drawings, not a sanitizer.
// Full XML parsing and raster/meaning inspection are separate handoff checks.
function readSvg(id) {
  const file = new URL(`../images/words/${id}.svg`, import.meta.url);
  assert.ok(existsSync(file), `Missing illustration: ${id}`);
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
    assert.ok(allowedElements.has(tag), `Unexpected SVG element: ${tag}`);
    if (closing) {
      assert.equal(rawAttributes.trim(), '');
      assert.equal(selfClosing, '');
      assert.equal(stack.pop()?.tag, tag, 'Correctly nested XML required');
      continue;
    }
    if (!stack.length) { roots++; assert.equal(tag, 'svg'); }
    const attrs = {};
    const remainder = rawAttributes.replace(/\s+([\w:-]+)="([^"<>]*)"/g, (_, name, value) => {
      assert.ok(allowedAttributes.has(name), `Unexpected SVG attribute: ${name}`);
      assert.ok(!Object.hasOwn(attrs, name), `Duplicate XML attribute: ${name}`);
      attrs[name] = value;
      if (name !== 'xmlns') assert.doesNotMatch(value, /https?:|data:|javascript:/i);
      if (['fill', 'stroke'].includes(name)) assert.ok(palette.has(value), `Use the existing palette: ${value}`);
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
  const ids = nodes.filter(node => node.attrs.id).map(node => node.attrs.id);
  assert.equal(new Set(ids).size, ids.length, 'IDs must be unique');
  const title = [...svg.matchAll(/<title id="titulo">([^<>]+)<\/title>/g)];
  const desc = [...svg.matchAll(/<desc id="descripcion">([^<>]+)<\/desc>/g)];
  assert.equal(title.length, 1);
  assert.equal(desc.length, 1);
  const metadata = `${title[0][1]} ${desc[0][1]}`;
  assertHiddenAnswer(metadata);
  assert.ok(nodes.filter(node => !['svg', 'g', 'title', 'desc'].includes(node.tag)).length >= 3);
  assert.match(svg, /stroke="#17324D" stroke-width="2\.6" stroke-linecap="round" stroke-linejoin="round"/);
  return { svg, nodes, metadata };
}



test('beads are plural pierced pieces threaded along a visible string', () => {
  const { nodes } = readSvg('beads');
  const string = nodes.find(node => node.attrs.id === 'cuerda');
  assert.ok(string && string.tag === 'path' && string.attrs.fill === 'none');
  const beads = nodes.filter(node => /^cuenta-\d+$/.test(node.attrs.id || ''));
  assert.ok(beads.length >= 5, 'Several distinct beads, not a single pendant');
  for (const bead of beads) {
    const circles = bead.children.filter(node => node.tag === 'circle');
    assert.equal(circles.length, 2, 'Each bead must have an outer body and a visible inner hole');
    const [outer, hole] = circles;
    assert.equal(outer.attrs.cx, hole.attrs.cx);
    assert.equal(outer.attrs.cy, hole.attrs.cy);
    assert.ok(Number(outer.attrs.r) >= Number(hole.attrs.r) * 2);
    assert.equal(hole.attrs.fill, '#FBF7EE');
    assert.ok(bead.children.some(node => node.tag === 'line'), 'String visible through the hole');
  }
});

test('pin is one straight shaft with a round head and a point, not a clasp', () => {
  const { nodes, metadata } = readSvg('pin');
  const shaft = nodes.filter(node => node.attrs.id === 'varilla');
  const head = nodes.filter(node => node.attrs.id === 'cabeza');
  assert.equal(shaft.length, 1);
  assert.equal(shaft[0].tag, 'path');
  assert.match(shaft[0].attrs.d, /^[MLZ\d\s.,-]+$/, 'A straight pointed shaft, not a loop');
  assert.equal(head.length, 1);
  assert.equal(head[0].tag, 'circle');
  assert.match(metadata, /recto/i);
  assert.match(metadata, /cabeza redonda/i);
  assert.match(metadata, /punta/i);
  assert.doesNotMatch(metadata, /imperdible/i);
});

test('socks shows exactly two separate complete socks, not joined tights', () => {
  const { nodes, metadata } = readSvg('socks');
  const socks = nodes.filter(node => /^calcetin-\d+$/.test(node.attrs.id || ''));
  assert.deepEqual(socks.map(node => node.attrs.id), ['calcetin-1', 'calcetin-2']);
  for (const sock of socks) {
    assert.ok(sock.children.filter(node => node.tag === 'path').length >= 3, 'Each sock needs its own body, heel and toe');
    assert.ok(sock.children.some(node => node.tag === 'rect'), 'Each sock has a cuff');
  }
  assert.match(metadata, /par de calcetines/i);
  assert.match(metadata, /separados/i);
});

test('soak places a folded cloth inside a water-filled container, with water over it', () => {
  const { nodes, metadata } = readSvg('soak');
  const container = nodes.find(node => node.attrs.id === 'recipiente');
  const water = nodes.find(node => node.attrs.id === 'agua');
  const cloth = nodes.find(node => node.attrs.id === 'pano-sumergido');
  const frontWater = nodes.find(node => node.attrs.id === 'agua-delante');
  assert.ok(container && water && cloth && frontWater);
  assert.ok(cloth.children.length >= 3, 'Recognizable fabric with folds, not only a flat rectangle');
  assert.ok(nodes.indexOf(frontWater) > nodes.indexOf(cloth), 'Water must overlay the submerged fabric');
  assert.ok(Number(frontWater.attrs.opacity) > 0 && Number(frontWater.attrs.opacity) < 1, 'Cloth remains visible through water');
  for (const detail of [/paño/i, /sumergido/i, /recipiente/i, /agua/i, /pliegues/i]) assert.match(metadata, detail);
  assert.doesNotMatch(metadata, /lluvia|nubes|tormenta/i);
});

for (const [id, cue, alt] of expected) {
  test(`${id}: fixed local drawing conveys the confirmed meaning without revealing spelling`, () => {
    const illustration = getWordIllustration(id);
    assert.ok(illustration, `Missing illustration mapping: ${id}`);
    assert.deepEqual(illustration, { src: `./images/words/${id}.svg`, alt });
    assert.equal(Object.isFrozen(illustration), true);
    assert.equal(getWordIllustration(id), illustration);
    assert.ok(alt.toLocaleLowerCase('es').includes(cue));
    assertHiddenAnswer(alt);
    const { metadata } = readSvg(id);
    assert.ok(metadata.toLocaleLowerCase('es').includes(cue));
  });
}
