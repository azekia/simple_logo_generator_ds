# Simple Logo Generator · DS

Aplicación web sin dependencias que genera logotipos tipográficos en **SVG** y **PNG**
directamente en el navegador. Todo el proceso ocurre en local: no se sube ninguna
imagen ni ningún dato a ningún servidor.

## Cómo ejecutarla

1. Abre la carpeta `simple_logo_generator_ds` en VS Code.
2. Pulsa **Go Live** (extensión *Live Server*) o abre `index.html` con Live Server.
3. El navegador mostrará la aplicación en `http://127.0.0.1:5500/simple_logo_generator_ds/`
   (el puerto depende de tu configuración de Live Server).

No hay que instalar nada ni compilar: son tres archivos estáticos (`index.html`,
`styles.css`, `app.js`).

## Qué hace

A partir de:

- un **texto** (por defecto `zenon`),
- una **tipografía** (por defecto `Gilroy Extrabold`; admite cualquier familia de
  Google Fonts, por ejemplo `Montserrat`, `Poppins` o `Montserrat ExtraBold`),
- un **color de letra** y un **color de fondo** (selectores RGB + hexadecimal),
- un **peso** de 100 a 900 (por defecto «Auto», que usa el peso indicado en el
  nombre de la tipografía; por ejemplo «Extrabold» = 800),
- un **kerning** (de −20 % a +50 %, en % del tamaño de la letra),
- un **padding** (de 0 % a 50 %, en % de la altura del texto),

al pulsar **Generar Logos** se crean 44 archivos, agrupados en cuatro bloques:

| Bloque | Variantes |
| --- | --- |
| Texto completo · recortado | SVG transparente · color; PNG 80 px y 400 px con fondo transparente; PNG 80 px y 400 px con el color de fondo; SVG negro; PNG 80 y 400 negro transparente; SVG blanco; PNG 80 y 400 blanco transparente |
| Texto completo · cuadrado | Las mismas 11 variantes, con ancho = alto = el mayor del recorte |
| Letra inicial · recortada | Las mismas 11 variantes, solo con el primer carácter |
| Letra inicial · cuadrada | Las mismas 11 variantes cuadradas, solo con el primer carácter |

Cada tarjeta muestra una vista previa y un enlace **Descargar** con el nombre de
archivo ya preparado. El botón **Descargar todos** crea en el navegador un único
ZIP (`<texto>-logos.zip`) con todos los logos generados; **Limpiar** elimina los
logos del DOM y libera las URLs temporales.

## Detalles técnicos

- **Recorte real**: el tamaño del lienzo (PNG) y el `viewBox` (SVG) se calculan con
  `CanvasRenderingContext2D.measureText()` (`actualBoundingBoxLeft/Right/Ascent/Descent`),
  de modo que la imagen contiene solo la tinta de los glifos, sin márgenes extra
  (salvo el padding que indique el usuario).
- **Kerning**: se aplica como `letter-spacing` proporcional al tamaño de fuente
  (`10 %` = `0.1 em`). En el SVG se usa el atributo `letter-spacing` y en el canvas
  `CanvasRenderingContext2D.letterSpacing`, de forma que ambos formatos coinciden.
- **Peso**: el selector permite forzar un peso concreto (100–900). Con «Auto» se usa
  el que indica el nombre de la tipografía. Si una familia de Google Fonts no tiene
  ese peso, se usa el disponible y la interfaz lo avisa; con fuentes locales el
  navegador aplica la cara más cercana.
- **Padding**: es un porcentaje de la altura del texto y se aplica por igual en los
  cuatro lados. En los PNG el alto sigue siendo exactamente 80/400 px: el texto se
  reduce y el margen ocupa el resto (en las variantes con fondo, el color de fondo
  llena toda la imagen). En los SVG amplía el `viewBox`.
- **PNG a 80 y 400 px de alto**: se escala la fuente para que la altura de la tinta
  sea exactamente la pedida (descontado el padding); la anchura resulta del texto.
- **Versiones cuadradas**: por cada variante recortada se genera otra con
  `ancho = alto = max(ancho, alto)` del recorte. El contenido se centra; en los PNG
  el fondo (si lo hay) llena todo el cuadrado y en los SVG el `viewBox` es cuadrado.
- **Límite de las versiones cuadradas**: si el lado del cuadrado supera los 12.000 px
  (textos muy anchos), se omiten las variantes PNG cuadradas de 400 px para no
  desbordar el canvas del navegador. El resto se genera igualmente y la interfaz
  avisa de cuántas se han omitido.
- **SVG autónomo**: cuando la tipografía procede de Google Fonts y el navegador
  puede descargar el archivo, cada SVG incluye la fuente en un `@font-face` con el
  binario (woff2/woff/ttf/otf) en base64, así se ve igual en cualquier equipo. Si el
  archivo no se puede descargar, el SVG referencia la familia por nombre, la vista
  previa sigue usando la fuente cargada y la interfaz lo avisa.
- **Vista previa fiel**: los SVG se insertan en línea en la página, por lo que la
  previsualización usa exactamente la tipografía cargada, aunque el SVG se haya
  generado sin fuente incrustada.
- **Carga de fuentes**: primero se comprueba si la familia está instalada en el
  equipo; si no, se registra la hoja CSS2 de Google Fonts con un `<link>` (las hojas
  externas no están sujetas a CORS) y se valida que la fuente se aplica midiendo
  texto. Después se descarga la cara `latin` (woff2/woff/ttf/otf) para embeberla; si
  esa descarga no fuese posible, el logo se genera igualmente usando la familia ya
  cargada.
- **Sin errores CORS**: no se hace `fetch` del CSS de Google hasta que la familia ha
  cargado correctamente, así que una familia inexistente no bloquea al resto ni
  ensucia la consola con errores de CORS.
- **Gilroy**: no está en Google Fonts. Si está instalada en el equipo se usa la copia
  local; si no, se intenta **Montserrat ExtraBold** desde Google Fonts y, cuando no
  hay conexión, la tipografía del sistema. La interfaz avisa del resultado.
- **ZIP sin dependencias**: «Descargar todos» construye el ZIP en el navegador con
  JavaScript puro (método *store*, sin compresión, con CRC32), incluye únicamente los
  archivos realmente generados y lo descarga con un nombre como `zenon-logos.zip`.
- **Sin memoria acumulada**: cada generación revoca las URLs de objeto anteriores.
- **Límites**: el texto admite hasta 40 caracteres, suficiente para logotipos y para
  mantener los PNG dentro de los límites seguros del canvas.

## Estructura

```
simple_logo_generator_ds/
├── index.html   Interfaz
├── styles.css   Estilos
├── app.js       Lógica de fuentes, recorte y generación
└── README.md
```
