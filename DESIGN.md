# Sistema visual — Telemetría

La referencia es un **tablero de instrumentos**, no una web de SaaS. Superficie
azul-negra, retícula tenue de fondo, paneles con borde luminoso y una esquina
recortada, y el número como protagonista.

Register: **product**. La decoración vive en los bordes; nunca encima del dato.

## La escena que manda

Del PRODUCT.md: se usa en dos situaciones a la vez — **notebook a un metro** y
**proyector a cinco metros**, en la reunión del lunes. Por eso:

- Los números van en mono tabular, grandes, con contraste alto (16:1).
- La densidad aguanta de cerca: tablas de 80 filas, paneles con muchas etiquetas.
- El acento marca estado y selección, nunca decora.

El **modo oscuro es el principal**. El claro no es el mismo tema invertido: es
una variante técnica fría (nada de crema ni beige) para oficina con ventana.

## Tokens

Todo en OKLCH, en `src/app/globals.css`.

| Rol | Oscuro | Claro |
|---|---|---|
| Fondo | `#070e16` | casi blanco frío |
| Panel (`--card`) | `#111a24` | blanco |
| Texto principal | `#f2f6f9` | tinta azulada |
| Texto secundario | `#9fb1bc` | gris azulado |
| Acento (`--primary`) | cian `#00cfe0` | cian oscuro |

Contraste medido sobre el panel oscuro: principal **16,1:1**, secundario
**7,9:1**, acento **9,2:1**, destructivo **5,5:1**. Todos por encima de 4,5:1.

## El panel HUD

`[data-slot="card"]` en `globals.css`:

- Borde luminoso cian a 1px (`box-shadow`, no `border`, para no alterar el
  layout) más un `inset` superior que simula el bisel.
- **Muesca en la esquina inferior derecha** vía `clip-path`, con una diagonal
  en `::after` para que se lea como bisel y no como error de render.
- Glow radial suave desde la esquina superior izquierda, solo en oscuro.
- Título en versalitas espaciadas, como etiqueta de instrumento.

> El componente `Card` **no** lleva `ring-*` ni `rounded-*`: las utilidades de
> Tailwind pisan el `box-shadow` del panel. El estilo lo dueña el CSS.

## Retícula de fondo

Dos gradientes de 1px cada 44px sobre el `body`, a 7% de opacidad. Se percibe
como textura, no como cuadrícula, y no compite con el dato.

## Gráficos

Ocho tonos categóricos en orden **fijo, nunca ciclado**: el orden es el
mecanismo de seguridad para daltonismo, no una decisión estética.

Validados con el script del skill `dataviz` contra la superficie real de los
paneles (`#111a24`): banda de luminosidad, piso de croma, separación CVD y piso
de visión normal — **todos pasan**, con contraste ≥3:1 contra el panel.

Al cambiar cualquier color de panel hay que **volver a correr el validador**,
porque el resultado depende de la superficie sobre la que se dibuja.

## Prohibiciones que este proyecto respeta

- **Nada de franjas de color al costado** de tarjetas, filas o avisos. La
  divergencia en Market Share se marca con tinte de fondo + ícono; los ítems
  del Centro de Inteligencia con un bloque tenue.
- Sin texto con degradado.
- Sin glassmorphism decorativo (el glow del panel es tenue y con propósito).
- Sin "eyebrow" en versalitas encima de cada sección: las versalitas se usan
  solo en títulos de panel y etiquetas de campo, que es su función real.

## Motion

150–250 ms, solo para estado y feedback. Sin secuencias de entrada al cargar la
página: el usuario viene con una pregunta, no a ver una animación.
`prefers-reduced-motion` está cubierto globalmente en `globals.css`.
