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

## El panel HUD (Telemetría 2.0)

`[data-slot="card"]` en `globals.css`:

- Borde luminoso cian a 1px (`box-shadow`, no `border`, para no alterar el
  layout) más un `inset` superior que simula el bisel.
- **Radio suave** (`0.875rem`) en las 4 esquinas — reemplaza la muesca
  recortada de la v1 (era `clip-path` en la esquina inferior derecha).
- Glow radial suave desde la esquina superior izquierda, solo en oscuro.
- Título en versalitas espaciadas, como etiqueta de instrumento.

> El componente `Card` **no** lleva `ring-*` ni `rounded-*`: las utilidades de
> Tailwind pisan el `box-shadow` del panel. El estilo lo dueña el CSS.

## Tipografía

| Rol | Familia | Uso |
|---|---|---|
| Interfaz | **Nunito Sans** (400/600/700/800) | Todo el texto, títulos y etiquetas |
| Cifras | **JetBrains Mono** (700) | Métricas, columnas numéricas |

Nunito Sans es geométrica de terminaciones redondeadas y x-height alta — la
referencia que eligió el usuario. El par sans + mono es un contraste real
(geométrica vs. monoespaciada), no dos sans parecidas; y los dígitos de
JetBrains Mono se distinguen entre sí a distancia, que es lo que hace falta
cuando esto se proyecta.

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
- **Sin librería de íconos.** `lucide-react` se removió (Telemetría 2.0): la
  interfaz comunica estado con tipografía, glifos Unicode (▲ ▼ ⚠ ✓ ✕ · i ?) y
  texto — nunca con SVGs decorativos.

## Motion

Dos capas:

- **Estado y feedback** (hover, focus, selección de filtro): 150–250 ms, sin
  cambios respecto a la v1.
- **Entrada** (Telemetría 2.0, desvío intencional de la v1): paneles con
  aparición escalonada (`.reveal` + `.reveal-d1`..`.reveal-d6`, 420 ms,
  `cubic-bezier(0.16, 0.84, 0.44, 1)`), cifras de KPI con count-up
  (`useCountUp`, 900 ms), y los 4 gráficos de ECharts con animación de
  entrada nativa (`animationDuration`/`animationEasing` en el `option`, sin
  librería nueva).

`prefers-reduced-motion` está cubierto globalmente en `globals.css` para toda
animación CSS (incluida `.reveal`); `useCountUp` lo respeta explícitamente
(salta directo al valor final). Los gráficos de ECharts no leen el media
query automáticamente — limitación conocida, no bloqueante.
