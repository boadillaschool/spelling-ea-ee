# Ilustraciones de vocabulario

Treinta dibujos vectoriales originales creados expresamente para este proyecto con
formas y trazados SVG, con asistencia de IA. No proceden de bancos de imágenes,
fotografías, emojis, fuentes de iconos ni servicios externos de imágenes;
no contienen materiales de terceros.
Los personajes son ficticios y no representan a personas identificables.

## Procedencia y uso

Son recursos propios creados para Boadilla School: su publicación en esta
aplicación no depende de permisos, atribuciones ni licencias de imágenes de
terceros. No se ha añadido una licencia de reutilización independiente a estos
archivos; hacer público el código no equivale a declarar los dibujos de dominio
público.

## Contenido y accesibilidad

Todos usan `viewBox="0 0 320 200"`, fondo transparente, contornos finos redondeados
y colores planos. Paleta común: tinta `#17324D`, verde `#146B63`, amarillo
`#F2C14E` y crema `#FBF7EE`, con azules vaqueros y tonos naturales. No hay texto
visible ni respuestas inglesas en los SVG. Los elementos `title` y `desc` están
en español; al usar `<img>`, la interfaz debe proporcionar su propio `alt`.

| Archivo en `words/` | Significado representado |
| --- | --- |
| `easy.svg` | Fácil: puzle resuelto de solo dos piezas y una marca de visto bueno. |
| `meat.svg` | Carne: filete cocinado en un plato, sin sangre. |
| `peanuts.svg` | Cacahuetes: cáscaras con cintura y textura reticulada, junto a granos pelados. |
| `between.svg` | Entre: pelota en el hueco entre dos cajas apoyadas en el mismo suelo. |
| `read.svg` | Leer: persona mirando las páginas de un libro abierto que sostiene. |
| `jeans.svg` | Vaqueros: pantalón largo azul, con bolsillos, trabillas y costuras. |
| `heel.svg` | Talón: zona posterior e inferior del pie descalzo, destacada con círculo y llamada. |
| `sweets.svg` | Dulces: caramelos envueltos dentro y fuera de un tarro. |
| `street.svg` | Calle: calzada entre aceras y casas, con paso de peatones. |
| `reach.svg` | Alcanzar: persona con los pies en el suelo que estira el brazo hacia una pelota en una estantería. |
| `dolphin.svg` | Delfín con hocico, aleta dorsal y cola sobre las olas. |
| `telephone.svg` | Teléfono de sobremesa con auricular y cable. |
| `alphabet.svg` | Formas de las primeras letras, trazadas como vectores en bloques. |
| `trophy.svg` | Copa dorada con asas y base. |
| `photograph.svg` | Fotografía de un paisaje con borde de papel. |
| `elephant.svg` | Elefante con orejas grandes, patas y trompa. |
| `pharmacy.svg` | Tienda con cruz verde y medicamentos, sin letrero escrito. |
| `family.svg` | Dos personas adultas y dos pequeñas reunidas en casa. |
| `friends.svg` | Dos niños comparten una pelota. |
| `people.svg` | Personas de distintas alturas en un parque. |
| `shorts.svg` | Pantalones cortos: perneras anchas por encima de las rodillas, con bolsillos y botón. |
| `shops.svg` | Tres tiendas distintas con toldos y escaparates de fruta, pan y plantas. |
| `shells.svg` | Tres conchas marinas separadas, con bordes ondulados y surcos en abanico. |
| `shoes.svg` | Un par de zapatos verdes con cordones y suelas claras. |
| `chops.svg` | Dos chuletas cocinadas separadas, con huesos de costilla curvos y marcas de parrilla, sin sangre. |
| `cheese.svg` | Una cuña de queso amarillo con agujeros y corteza fina. |
| `child.svg` | Una persona infantil sentada y leyendo un libro abierto, sin identidad real. |
| `chess.svg` | Un tablero de ajedrez de ocho por ocho casillas, con rey, torre y caballo reconocibles. |
| `you.svg` | Tú: la mano de quien habla señala a la persona interlocutora. |
| `your.svg` | Tu mochila: la persona interlocutora sostiene su mochila por el asa y otra mano señala ese objeto. |

Las diez últimas ilustraciones corresponden al inventario confirmado del
16/10/2026. Los plurales se representan visualmente: tres tiendas, tres conchas,
un par de zapatos y dos chuletas. «Tú» y «tu» usan una escena relacionada
pero un referente distinto: se señala a la persona en «tú» y a la mochila que
le pertenece en «tu mochila». La posesión y la interlocución son ideas que
requieren también la pista verbal en español; un dibujo aislado no las define
por completo. No se han usado nombres, fotografías personales ni material
manuscrito del alumnado.

Comprobación sin dependencias adicionales:
`node --test tests/illustration-assets.test.js tests/illustrations.test.js tests/sh-ch-illustrations.test.js`.
La prueba general recorre los IDs de `lessons.js`; la regresión del 16/10/2026
verifica, independientemente del registro de lecciones, el inventario exacto
anterior más las diez nuevas imágenes, el contrato XML de formas, los metadatos
y los textos alternativos sin respuestas inglesas. También comprueba que solo
los IDs autorizados resuelven a rutas locales y que «tú» y «tu» no se confunden.
La claridad de cada significado requiere además revisión visual. En particular,
«fácil» es una idea abstracta: el puzle es un ejemplo, no sustituye la pista verbal.
Las láminas de revisión y los registros de pruebas se mantienen fuera del repositorio.
