// Original, same-origin illustrations. No learner text or remote image requests.
const illustrations = new Map([
  ['easy', 'Fácil: un puzle sencillo de solo dos piezas que encajan.'],
  ['meat', 'Carne: un filete servido en un plato.'],
  ['peanuts', 'Cacahuetes con su cáscara estrecha en el centro y algunos granos pelados.'],
  ['between', 'Entre: una pelota en medio de dos cajas, una a cada lado.'],
  ['read', 'Leer: una persona mirando las páginas de un libro abierto.'],
  ['jeans', 'Vaqueros: un pantalón largo azul con bolsillos y costuras.'],
  ['heel', 'Talón: la parte de atrás de un pie descalzo, señalada con un círculo.'],
  ['sweets', 'Dulces: caramelos de colores con sus envoltorios.'],
  ['street', 'Calle entre edificios, con aceras y un paso de peatones.'],
  ['reach', 'Alcanzar: una persona estira el brazo hacia una estantería.'],
].map(([id, alt]) => [id, Object.freeze({ src: `./images/words/${id}.svg`, alt })]));

export function getWordIllustration(id) {
  return illustrations.get(id) ?? null;
}
