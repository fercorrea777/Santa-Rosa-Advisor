# Sistema visual — Telemetría

La referencia es un **tablero de instrumentos**, no una web de SaaS: el número
es el protagonista. Desde el rediseño de julio de 2026 la forma es **bento**:
lienzo gris frío, tarjetas blancas de radio generoso con una sombra difusa
corta, y el navy de la marca en el encabezado, el menú lateral y el panel del
acceso.

Register: **product**. La decoración vive en los bordes; nunca encima del dato.

## La escena que manda

Del PRODUCT.md: se usa en dos situaciones a la vez — **notebook a un metro** y
**proyector a cinco metros**, en la reunión del lunes. Por eso:

- Los números van en mono tabular, grandes, con contraste alto (16:1).
- La densidad aguanta de cerca: tablas de 80 filas, paneles con muchas etiquetas.
- El acento marca estado y selección, nunca decora.

El **modo claro es el que se abre por defecto** (oficina con ventana, notebook a
un metro). El oscuro —azul-negro con resplandores fríos— queda como variante
para la sala de reuniones y el proyector. Ninguno es el otro invertido: cada uno
tiene sus propios tokens, y el claro es una variante técnica fría (nada de crema
ni beige).

## Tokens

Todo en OKLCH, en `src/app/globals.css`.

| Rol | Oscuro | Claro |
|---|---|---|
| Fondo | `#070e16` | `oklch(0.968 0.004 250)`, gris frío |
| Panel (`--card`) | `#111a24` | blanco |
| Texto principal | `#f2f6f9` | tinta azulada |
| Texto secundario | `#9fb1bc` | gris azulado |
| Acento (`--primary`) | cian `#00cfe0` | cian oscuro `oklch(0.5 0.13 205)` |
| Marca (`--barra`) | `#13143c` | navy `#1b1c4e` (header, menú, panel del acceso) |

Verde y rojo de **texto chico** (variaciones, deltas) van en el 700 en claro
(`emerald-700`, `rose-700`) y en el 400 en oscuro: el 600 no llega a 4,5:1 a
12–14 px sobre el tinte de la propia chapa. En las cifras grandes (36 px) el 600
alcanza. Sobre la tile `tinta` (navy) las chapas de variación usan tonos claros
(`emerald-300`, `rose-300`).

Contraste medido sobre el panel oscuro: principal **16,1:1**, secundario
**7,9:1**, acento **9,2:1**, destructivo **5,5:1**. Todos por encima de 4,5:1.

> **Deriva corregida el 2026-08-27.** Entre julio y agosto el `--primary` se
> había ido a violeta (`oklch(0.72 0.17 285)`) mientras el borde y el
> resplandor del panel seguían en cian: los dos acentos peleaban y el conjunto
> se leía inconsistente. Se devolvió el acento al cian del spec —
> `oklch(0.78 0.135 205)`, que es exactamente `#00cfe0` y el mismo valor que ya
> usaban `--panel-edge` y `--panel-glow`. Medido de nuevo: **9,20:1** sobre el
> panel (el violeta daba 6,62:1). En claro pasó a `oklch(0.5 0.13 205)`,
> **5,32:1** (el violeta daba 4,59:1). Los chips de categoría
> (`--chip-violet`) **se dejan en violeta a propósito**: son una paleta
> categórica para gráficos, no el acento del sistema.

## La tarjeta (tile bento)

`[data-slot="card"]` en `globals.css`:

- Borde de 1 px apenas visible (`--panel-edge` al 70 %) y `--card-shadow`: la
  elevación la da la sombra, no un marco duro. Sin glow de borde ni bisel (eso
  era el panel HUD de la v1, ya retirado).
- **Radio de 13 px** (`0.8125rem`). Con más, la esquina se come la primera celda
  de las tablas que viven adentro.
- Título de tarjeta en caja baja, negrita y oscuro; el encabezado de **sección**
  (`<Seccion>`) es el que lleva versalitas espaciadas y el filete.
- Tiles teñidas (`tile-azul|verde|ambar|tinta`) para el dato destacado: el
  tinte es la identidad; nunca una franja al costado.

> El componente `Card` **no** lleva `ring-*` ni `rounded-*`: las utilidades de
> Tailwind pisan el `box-shadow`. El estilo lo dueña el CSS.

## Tipografía

| Rol | Familia | Uso |
|---|---|---|
| Interfaz | **Inter** (variable, 100–900, eje `opsz`) | Todo el texto, títulos y etiquetas |
| Cifras | **JetBrains Mono** (700) | Métricas, columnas numéricas |

El par sans + mono es un contraste real (grotesca vs. monoespaciada), no dos
sans parecidas; y los dígitos de JetBrains Mono se distinguen entre sí a
distancia, que es lo que hace falta cuando esto se proyecta.

Inter se carga **variable con el eje de tamaño óptico** (`axes: ["opsz"]` en
`layout.tsx`): el navegador lo aplica solo (`font-optical-sizing: auto`), así el
cuerpo de tabla usa el corte de texto y los títulos el corte «Display», más
cerrado, sin cargar una segunda familia. Consecuencias que hay que conocer:

- **Es ~10 % más ancha que Archivo** en etiquetas cortas. Por eso el menú lateral
  pasó de 15 a 16,5 rem (con 15 rem «Combustibles y tecnologías» se cortaba). Si
  se agrega una etiqueta de menú, medir la holgura con el menú abierto.
- **No sumar tracking negativo a los títulos.** El cierre ya lo trae `opsz`:
  `tracking-tight` (−0,025 em) hacía que las letras de un titular en negrita se
  tocaran, así que el token quedó en −0,015 em y el título de página va en 700,
  no en 800.
- **Los gráficos (ECharts) dibujan en canvas**, y un canvas ignora una fuente
  escrita con `var()`: hasta octubre de 2026 todos los ejes salían en la
  `sans-serif` del sistema. Ahora `chart-theme.ts` usa los nombres reales
  (`FUENTE_SANS_GRAFICOS`, `FUENTE_MONO_EJES`) y `EchartsAuto` repinta cuando las
  fuentes terminan de cargar. Si se cambia una familia en `layout.tsx`, hay que
  cambiarla también ahí.

> Historial: Nunito Sans → Inter (2026-07-23) → Archivo (2026-08-27) → Inter
> (2026-10-24, pedido de Croman: «mejorar la fuente, usar la familia de Inter»).
> Archivo se había elegido porque Inter se veía anónima; la decisión se revirtió
> por pedido, y la presencia que daba Archivo la dan ahora el peso y el eje `opsz`.

> Los tokens `--font-sans` / `--font-mono` en `@theme inline` deben apuntar a
> `var(--font-geist-sans)` / `var(--font-geist-mono)`, que es lo que inyecta
> `next/font` en `<html>`. Si se dejan auto-referenciados (`--font-sans:
> var(--font-sans)`) el token queda inválido y **todo cae a Times New Roman**.

## Fondo

**Sin cuadrícula.** Se descartó la retícula tipo papel milimetrado: dibujaba
celdas que competían con las tablas y los gráficos, que ya son celdas.

En su lugar, atmósfera: dos resplandores fríos muy abiertos (cian arriba a la
izquierda, azul profundo abajo a la derecha) que dan profundidad, y encima una
trama diagonal de 3px al 3,5% que se lee como textura de señal.

## Gráficos

Ocho tonos categóricos en orden **fijo, nunca ciclado**: el orden es el
mecanismo de seguridad para daltonismo, no una decisión estética.

Validados con el script del skill `dataviz` contra **las dos superficies**:
`#111a24` en oscuro y `#ffffff` en claro. Banda de luminosidad, piso de croma,
separación CVD, piso de visión normal y contraste ≥3:1 — **todos pasan en
ambas**.

> **Corregido el 2026-09-03.** Hasta esa fecha la validación se había corrido
> **solo contra el panel oscuro**, y este documento lo afirmaba como si
> cubriera todo. Contra el panel blanco, tres tonos estaban por debajo del piso
> de 3:1 y no se distinguían del fondo: rosa `#e87ba4` (2,69), ámbar `#eda100`
> (**2,17**) y verde `#1baf7a` (2,82). Se les bajó **solo la luminosidad en
> OKLCH**, conservando tono y croma — oscurecer en RGB corre el tono y hunde el
> croma, que tiene piso propio. Quedaron `#d9739a`, `#c78700` y `#19a774`, los
> tres en 3,05–3,07.
>
> Efecto lateral que hay que conocer: la separación **tritán** del par
> verde↔ámbar bajó de 5,8 a 3,9 (el modo oscuro ya estaba en 5,4). El validador
> pasa porque gatilla sobre protan (9,0), y el par se sostiene con la
> codificación secundaria que estos gráficos ya tienen — leyenda y cifra
> dibujada sobre la marca.

Al cambiar cualquier color de panel hay que **volver a correr el validador en
los dos modos**, porque el resultado depende de la superficie sobre la que se
dibuja. El comando está en el skill `dataviz`:
`node scripts/validate_palette.js "<los 8 hex>" --mode light --surface "#ffffff"`.

### El Panorama del Resumen (`components/bento/`)

Seis tarjetas arriba de `/mercado`, con **datos reales** (los mismos del resto de
la pantalla, con los mismos filtros), dibujadas a mano en SVG y no con ECharts:
comparten un solo tooltip y una sola animación de entrada, y se pueden leer con
la precisión de un píxel. Orden: matriculaciones (línea del año contra el
anterior + franja de variación interanual), importaciones (ondas espejadas:
importación arriba, matriculación abajo), mercado por marca (treemap), la
participación de las marcas propias, nuestras marcas (pila de tarjetas) y la
estacionalidad (radar).

- **Color = qué es, no cuánto**: matriculaciones `--chart-1` (azul), importaciones
  `--chart-4` (ámbar), lo propio `--primary` (cian). El treemap pinta por **grupo
  importador** (`bento-g-*`, contraste verificado en claro y oscuro) y cada marca
  propia lleva su matiz en OKLCH.
- La franja interanual **diverge desde una línea cero**, y la subida/bajada lleva
  ▲/▼ además del color. Nada depende solo del tono.
- **Nada es "en vivo"**: no hay datos que parpadeen ni cifras inventadas. Las
  tarjetas animan **una sola vez, cuando entran en pantalla** (`useEntrada`), y
  con `prefers-reduced-motion` aparecen ya dibujadas.
- Cada gráfico tiene su **tabla oculta** (`sr-only`) con los mismos números. Las
  barras mensuales (franja interanual y participación) y los recuadros del
  treemap se alcanzan con Tab y muestran el mismo tooltip; la línea, las ondas y
  el radar solo responden al puntero, y su dato completo está en la tabla.
- Un clic en una marca del treemap o de la pila **filtra la pantalla** por esa
  marca (el mismo `?marca=` de siempre); clic de nuevo, la quita.

## Números: el formato sigue al idioma

En español (el idioma por defecto): miles con punto (`42.328`), decimales con
coma (`12,1 %`, `+1,8 pp`). Un `+49.8%` junto a un `42.328` se lee como cuarenta
y nueve mil. En inglés cambia **todo junto**: `42,328`, `12.1%`, `+1.8 pp`,
fechas `Sep 4, 2026`, hora de 24 h. Nunca se mezclan los dos en una pantalla.

Todo número y fecha pasa por `fmt` (`getI18n()` en el servidor, `useI18n()` en el
cliente), que lleva los mismos nombres de siempre: `formatUnidades`, `formatPct`,
`formatPuntosPct`, `formatDecimal`/`decimal`, `formatFecha(Hora)`. `src/lib/
format.ts` quedó como atajo en español para los scripts y las rutas que no
conocen al usuario; una pantalla nunca lo importa (`node scripts/i18n.mjs
--estricto` lo marca). `<Cifra>` entiende la coma o el punto según el idioma al
animar. Los CSV que se exportan quedan con punto: son para máquinas.

Los segmentos llegan de CADAM sin tilde (`CAMION`, `OMNIBUS`) y así viajan por
la URL; para **mostrarlos** se pasan por `nombreDeSegmento` (Camión / Truck,
Ómnibus / Bus, Furgón / Van, Minibús / Minibus, Automóvil / Passenger car).

## Idioma: español e inglés

Selector **ES | EN** en la barra de arriba, junto al tema. Guarda la cookie
`advisor_idioma` (un año) y recarga el servidor: el HTML ya llega en el idioma
elegido, sin parpadeo. El español es el default y su texto es la **clave** del
catálogo: `t("Matriculaciones")`, `tr("Hay <b>{n}</b> marcas")` para texto con
etiquetas, `N_("…")` para constantes de módulo que se traducen al mostrarlas. Lo
que falta en el catálogo inglés se muestra en español, nunca vacío.

- Las reglas, el glosario (matriculación = registration, chapa = plate,
  participación = share…) y los patrones están en `src/lib/i18n/LEEME.md`.
- `node scripts/i18n.mjs` mide la cobertura y `--estricto` falla si queda texto
  sin envolver o sin traducir: correrlo antes de subir.
- **No se traduce** lo que viene de los datos: nombres de marca y modelo, las
  planillas de Finanzas y de Producto, y los informes de competencia ya generados
  (se guardan en la base en el idioma en que se escribieron).
- Los textos más largos en inglés (y en español) no pueden romper la tarjeta: se
  prueba cada pantalla en los dos idiomas a 390 px.

## Barra de filtros pegajosa

Se pega a 64 px del borde (8 px de aire bajo el header de 56). El fondo y la
sombra aparecen **solo cuando está pegada** (`scroll-state(stuck: top)`:
`.pegada-fondo`, `.pegada-sombra`): en su lugar se funde con el lienzo, que en
oscuro no es plano. Sin soporte, un velo casi opaco con desenfoque. Lo que
gobierna solo los gráficos (los años de las series) **no va en la barra**: vive
en el encabezado de la sección que cambia (`<Seccion accion={…}>`), porque en la
barra parece un filtro más y no mueve ninguna cifra.

## Menú lateral, perfil y búsqueda

- El menú se **pliega** a 72 px (cookie `advisor_menu`, que el servidor lee para
  dibujarlo plegado desde el primer cuadro) y tiene búsqueda de pantallas
  (Ctrl K, `paleta-comandos`, con alias de `ALIAS_NAV` en `lib/nav.ts`).
- Arriba lleva la **tarjeta de perfil**: foto (o iniciales), nombre, rol y
  salir. Lleva a `/mi-cuenta`, donde cada persona sube su foto (recortador
  cuadrado, JPEG de 384 px, validado en el servidor) y cambia su clave.
- Íconos: set **propio** de línea (`components/icons.tsx`, sin librería externa),
  siempre con `aria-hidden` y el rótulo en texto al lado.

## Acceso y el globito

`/entrar`, `/entrar/olvide` y `/restablecer` comparten el marco `MarcoAcceso`:
panel navy ilustrado a la izquierda (nunca cambia de tema) y a la derecha el
globito, el título y el formulario (sigue el tema). En el celular solo el
formulario, con el logo arriba.

**El globito** (`ui/globito.tsx`) es la mascota: una esfera con cara que mira el
campo que se llena (`useCampoConFoco`, leído del documento porque el `autoFocus`
llega antes de hidratar), se tapa los ojos con una clave oculta, piensa mientras
se envía, se sacude si el acceso falla y salta si salió bien. También es la cara
del Copiloto. Es **decorativo** (`aria-hidden`): nada de lo que expresa deja de
estar en texto (el error lleva su `role="alert"`). Con `prefers-reduced-motion`
no flota, no parpadea ni sigue el puntero, pero la cara sí cambia: es
información.

**Favicon**: el monograma del logo de Santa Rosa (`icon.svg`, `favicon.ico` de
16/32/48 px y `apple-icon.png`), navy sobre blanco.

## Prohibiciones que este proyecto respeta

- **Nada de franjas de color al costado** de tarjetas, filas o avisos. La
  divergencia en Market Share se marca con tinte de fondo + glifo de texto;
  los ítems del Centro de Inteligencia con un bloque tenue.
- Sin texto con degradado.
- Sin glassmorphism decorativo (el glow del panel es tenue y con propósito).
- Sin "eyebrow" en versalitas encima de cada sección: las versalitas se usan
  solo en títulos de panel y etiquetas de campo, que es su función real.
- **Sin librería de íconos externa.** `lucide-react` se removió (Telemetría
  2.0). Hay un set propio y chico de íconos de línea (`components/icons.tsx`) para
  menú, KPIs y búsqueda; el estado se comunica además con tipografía, glifos
  Unicode (▲ ▼ ⚠ ✓ ✕ · i ?) y texto — nunca solo con color ni con un SVG
  decorativo suelto.

## Motion

Dos capas:

- **Estado y feedback** (hover, focus, selección de filtro): 150–250 ms, sin
  cambios respecto a la v1.
- **Entrada** (Telemetría 2.0, desvío intencional de la v1): paneles con
  aparición escalonada y revelado al scroll (GSAP, `components/movimiento/
  pagina.tsx`: toda `page.tsx` va envuelta en `<Pagina>`; `data-revelar` es el
  opt-in para lo que no es tarjeta ni sección), cifras de KPI con count-up
  (`<Cifra>`, GSAP: 900 ms desde cero, 280 ms al cambiar un filtro: el ojo ya
  está en el número), y los gráficos de ECharts con animación de
  entrada nativa (`animationDuration`/`animationEasing` en el `option`, sin
  librería nueva).

`prefers-reduced-motion` está cubierto globalmente en `globals.css` para toda
animación CSS; `<Cifra>` lo respeta explícitamente (salta
directo al valor final). Los gráficos de ECharts no leen el media
query automáticamente — limitación conocida, no bloqueante.
