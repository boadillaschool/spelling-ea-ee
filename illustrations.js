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
  ['dolphin', 'Delfín: animal marino con hocico largo, aleta dorsal y cola, saltando sobre el agua.'],
  ['telephone', 'Teléfono de sobremesa con auricular, botones y cable en espiral.'],
  ['alphabet', 'Abecedario: tres bloques con las formas de sus primeras letras.'],
  ['trophy', 'Trofeo: una copa dorada con dos asas sobre una base.'],
  ['photograph', 'Fotografía en papel de un paisaje soleado, con un borde blanco.'],
  ['elephant', 'Elefante gris de orejas grandes y trompa larga.'],
  ['pharmacy', 'Farmacia con una cruz verde y medicamentos en el escaparate.'],
  ['family', 'Familia: dos personas adultas junto a un niño y una niña en casa.'],
  ['friends', 'Amigos: dos niños de edad parecida comparten una pelota.'],
  ['people', 'Personas de distintas alturas paseando por un parque.'],
  ['shorts', 'Pantalones cortos: dos perneras anchas por encima de las rodillas, con bolsillos y botón.'],
  ['shops', 'Tres tiendas con toldos de rayas y escaparates de fruta, pan y plantas.'],
  ['shells', 'Tres conchas de mar en forma de abanico, con bordes ondulados y surcos.'],
  ['shoes', 'Un par de zapatos verdes con cordones claros y suelas de color crema.'],
  ['chops', 'Dos chuletas cocinadas con huesos largos visibles y marcas de parrilla en un plato.'],
  ['cheese', 'Queso: una cuña amarilla con agujeros redondos y una corteza fina.'],
  ['child', 'Niño o niña: una persona infantil sentada y leyendo un libro abierto.'],
  ['chess', 'Ajedrez: un tablero de casillas claras y oscuras con un rey, una torre y un caballo.'],
  ['you', 'Tú: la persona que escucha, señalada por la mano de quien le habla.'],
  ['your', 'Tu (algo que te pertenece): tu mochila, que sostienes por el asa porque te pertenece.'],
].map(([id, alt]) => [id, Object.freeze({ src: `./images/words/${id}.svg`, alt })]));

export function getWordIllustration(id) {
  return illustrations.get(id) ?? null;
}
