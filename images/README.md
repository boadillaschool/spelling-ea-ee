# Ilustraciones de vocabulario

Diez dibujos vectoriales originales creados expresamente para este proyecto con
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

Comprobación sin dependencias: `node --test tests/illustration-assets.test.js`.
La prueba recorre los IDs reales de `data.js` y comprueba el contrato de activos;
la claridad de cada significado requiere además revisión visual. En particular,
«fácil» es una idea abstracta: el puzle es un ejemplo, no sustituye la pista verbal.
Las láminas de revisión y los registros de pruebas se mantienen fuera del repositorio.
