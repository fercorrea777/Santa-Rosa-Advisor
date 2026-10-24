# Idiomas del Advisor (castellano / inglés)

El tablero se puede leer en castellano (el idioma de origen, el de siempre) y en
inglés. El selector «ES | EN» está en la barra de marca y en las pantallas de
acceso; recuerda la elección en la cookie `advisor_idioma` (un año). Sin cookie:
castellano.

**Regla de oro:** el castellano no cambia. Traducir una pantalla es envolver sus
textos, y la pantalla en castellano tiene que quedar *idéntica*, letra por letra.

## Cómo está armado

| Pieza | Dónde | Qué hace |
|---|---|---|
| `t("frase")`, `tr("frase <b>x</b>")` | `traducir.ts` | Devuelve la frase o su traducción. La CLAVE es la frase en castellano. |
| `fmt.formatUnidades(n)`, `fmt.formatPct(v)`… | `formatos.ts` | Cifras, porcentajes, fechas, meses y segmentos según el idioma (`42.328` ↔ `42,328`). |
| `getI18n()` | `servidor.ts` | En el servidor: `const { t, tr, fmt, idioma } = await getI18n();` |
| `useI18n()` | `cliente.tsx` | En un componente de cliente: `const { t, tr, fmt, idioma } = useI18n();` |
| `N_("frase")` | `traducir.ts` | Marca una frase de una constante de módulo para traducirla donde se muestre. |
| `catalogo/en-*.ts` | | El inglés: `{ "frase en castellano": "English phrase" }`. |
| `scripts/i18n.mjs` | raíz | Compara el código con el catálogo y busca castellano sin envolver. |

El inglés se busca por la frase en castellano. Si una frase todavía no está en el
catálogo se ve en castellano (la pantalla se lee entera, nunca con claves rotas).

## Cómo se escribe una pantalla

**Servidor** (página, layout, componente async, acción, ruta de API):

```tsx
export default async function Pagina() {
  const { t, tr, fmt } = await getI18n();
  const { formatUnidades, formatPct, etiquetaPeriodo, mesCorto } = fmt; // mismos nombres de siempre
  return <PageHeader titulo={t("Resumen del mercado")} descripcion={t("Mostrando {n} de {total}.", { n: formatUnidades(3), total: formatUnidades(10) })} />;
}
```

Un componente de servidor que no era `async` pasa a serlo (`export async function X()`), o recibe `t`/`fmt` por props
desde quien lo llama. NO se llama a `useI18n()` en el servidor (no hay contexto).

**Cliente** (`"use client"`):

```tsx
const { t, fmt } = useI18n();
<button aria-label={t("Cerrar menú")}>…</button>
```

**Función de apoyo** (`lib/…`) que arma texto: recibe lo que necesita por parámetro,
`(…, i18n: I18n)` o `(…, t: T, fmt: Formatos)`. Nunca lee el idioma por su cuenta: en
el servidor no hay un «idioma actual» global (varios pedidos en distintos idiomas
conviven en el mismo proceso).

## Reglas de las frases

1. **Una frase entera por `t()`**, con su puntuación. Nada de armar oraciones con pedazos
   (`t("Hay") + n + t("marcas")`): el inglés tiene otro orden de palabras.
2. **Lo variable va entre llaves** y se pasa aparte: `t("{n} marcas · {periodo}", { n, periodo })`.
   Los valores van YA formateados (`fmt.formatUnidades(n)`, `fmt.formatPct(p)`).
   Nada de plantillas con `${}` dentro de `t()`.
3. **La clave es una sola línea con espacios simples.** En JSX, el texto largo se escribe como
   `{t("la frase entera en una línea")}` (puede ser larga; el código de este repo ya tiene líneas largas).
   Una clave puede partirse en varias líneas con `+` entre literales: `t("primera parte " + "segunda parte")`.
4. **Texto con negrita, cursiva, código o salto de línea**: `tr("Hacé clic en <b>una barra</b> para filtrar.")`.
   Entiende `<b>`, `<i>`, `<code>`, `<br/>` y las etiquetas que se le pasen como tercer argumento
   (`{ a: (h) => <Link href="…">{h}</Link> }`). El inglés conserva las MISMAS etiquetas
   (`Click <b>a bar</b> to filter.`), en el orden que pida su gramática.
5. **Plurales**: dos frases (`t("1 marca")` / `t("{n} marcas", { n })`), elegidas en el código. No se arma «marca(s)».
6. **Texto que vive en una constante del módulo** (listas de columnas, etiquetas de gráficos, opciones de un
   selector): se marca con `N_("…")` donde se define y se traduce donde se MUESTRA con `t(x.label)`:

   ```ts
   const COLUMNAS = [{ id: "u", label: N_("Unidades") }, { id: "p", label: N_("Participación") }];
   // …
   {COLUMNAS.map((c) => <th key={c.id}>{t(c.label)}</th>)}
   ```
   Sin `N_`, el script de cobertura no ve esa frase y el inglés nunca la tendrá.
7. **Una frase que viaja como prop** (título, nota, tooltip) se traduce en el servidor antes de pasarla.
8. **Atributos que se leen o se muestran** (`aria-label`, `title`, `placeholder`, `alt`, textos de `<option>`)
   también se traducen.
9. **Cifras y fechas: siempre por `fmt`.** Nunca `toLocaleString`, `Intl.*` suelto, `toFixed` + `.replace(".", ",")`
   ni `new Date().toLocaleDateString(...)`: en inglés mostrarían `42.328` (que se lee 42,3). Meses: `fmt.mesCorto(m)`,
   `fmt.mesesCortos`, `fmt.mesesLargos`. Períodos: `fmt.etiquetaPeriodo(...)`. Segmentos: `fmt.nombreDeSegmento(s)`.
   Marcas: `fmt.nombreDeMarca(m)`. Grupos: `fmt.nombreDeGrupo(g)`. Gráficos de ECharts: los formateadores
   del `option` usan el `fmt` del componente.
   Los CSV exportados siguen con punto decimal y sin miles, en los dos idiomas (son para máquinas).
10. **No se importan `formatUnidades`, `formatPct`, `mesCorto`, `etiquetaPeriodo`… de `@/lib/format` ni de
    `@/lib/periodo` en código que muestre algo a una persona**: esas son las versiones en castellano. Se
    destructuran de `fmt`.

## Lo que NO se traduce

- Marcas, modelos, versiones, siglas (SUV, ICE, HEV, PHEV, BEV, CADAM, DNRA, FOB, CIF, IVA…), nombres propios y
  nombres de personas, usuarios, correos.
- Lo que viene de los datos: el texto de la planilla de acciones comerciales, notas de las bases, nombres de
  segmentos como CLAVE (el valor del filtro y de la URL sigue siendo el de la base; solo se traduce al mostrarlo
  con `fmt.nombreDeSegmento`).
- Claves de objetos, nombres de campos, rutas, parámetros de URL, ids, clases CSS, `console.*`, mensajes de error
  técnicos que nadie lee.
- El prompt que se le manda a un modelo (Claude, Ollama): se queda en castellano; solo se le AGREGA la instrucción
  de responder en el idioma elegido, y las frases que se le muestran a la persona (errores, estados) sí se traducen.
- Un texto que es castellano a propósito se marca para el script con `// i18n-ignore` (misma línea o la anterior),
  o `// i18n-ignore-start` … `// i18n-ignore-end` para un tramo, o `/* i18n-ignore-file */` para un archivo entero.
  Cada excepción es una decisión que se ve en el código: usarlas con medida.

## El inglés

Profesional y directo, de inteligencia comercial para el mercado automotor. Inglés de EE. UU. (color, center).
Sentence case en rótulos y botones («Market overview», no «Market Overview»); los encabezados de tabla ya salen en
mayúsculas por CSS, no se escriben en mayúsculas. Nada de calcos literales: «poner la chapa» es *register a vehicle*, no
«put the plate». Los imperativos con voseo («Hacé clic», «Tocá», «Elegí») son imperativos normales en inglés
(«Click», «Tap», «Choose»). Las comillas «…» del castellano son “…” en inglés; `·`, `—`, `…` se conservan.
Más corto es mejor donde hay poco lugar (menú, encabezados de tabla, botones, chips de filtro).

### Glosario (usar siempre estas equivalencias)

| Castellano | English |
|---|---|
| matriculación / matriculaciones | registration / registrations |
| chapa, «poner la chapa», «sacar chapa» | plate; to register a vehicle; to get registered |
| importación / importaciones | import / imports |
| unidades; «u.» | units; «units» (en tablas, «u.» → «units» si hay lugar, si no «u.») |
| participación; «Part.» | share; «Share» (market share = «market share») |
| puesto, posición, «Pos.» | rank; position (el cambio de puesto: «Rank Δ» en columnas muy angostas) |
| marca / marca propia / marcas propias | brand / own brand / own brands |
| grupo (importador) | group (importer group) |
| importador / representante | importer / distributor |
| modelo / versión | model / trim (versión = «trim» o «version»; usar «version» si la pantalla ya lo usa así) |
| segmento | segment |
| tecnología / combustible | powertrain / fuel (la columna «Tecnología»: «Powertrain») |
| mismo período del año anterior | same period last year |
| variación; «Var.» | change; «Chg.» (variación interanual: «YoY change») |
| mes a mes | month by month |
| acumulado | year to date / cumulative (según el caso) |
| stock | stock |
| en tránsito | in transit |
| facturación / facturado | invoicing / invoiced |
| presupuesto / plan | budget / plan |
| cumplimiento | attainment (de presupuesto: «budget attainment») |
| asesor / vendedor | advisor / salesperson (en Santa Rosa «asesor» = *sales advisor*) |
| rivales / competencia | rivals / competition |
| gama | range (lineup) |
| precio de lista | list price |
| descuento / bono / mecánica (de una promo) | discount / bonus / mechanics (promo mechanics) |
| margen / ticket | margin / ticket (ticket = average invoice) |
| playa (de vehículos) | yard |
| aduana | customs |
| pedir stock / empujar con promo | order stock / push with a promo |
| «Acciones de la semana» | This week's actions |
| tablero / panel | dashboard |
| Copiloto | Copilot |
| «Centro de Inteligencia» | Intelligence center |
| filtro / «Quitar el filtro» | filter / Clear filters |
| «datos hasta {mes}» | data through {month} |
| sin dato / «—» | no data / «—» |
| livianos / pesados | light vehicles / heavy vehicles |
| camión / ómnibus / furgón / pick up | truck / bus / van / pickup |

## Verificar

```bash
node scripts/i18n.mjs                                    # resumen: frases sin traducir, huérfanas, castellano sin envolver
node scripts/i18n.mjs --sin-envolver src/app/rankings    # línea por línea lo que falta envolver en esa carpeta
node scripts/i18n.mjs --todas src/app/rankings           # TODAS las frases usadas sin entrada en el catálogo
node scripts/i18n.mjs --generar                          # reescribe catalogo/en.ts y en-cliente.generated.ts (hacerlo antes de probar el inglés en un componente de cliente)
npx tsc --noEmit -p .                                    # tipos
npx eslint <archivos>                                    # estilo
```

Después de editar el catálogo, el servidor de desarrollo recarga solo. Pantalla en inglés: poner la cookie
`advisor_idioma=en` (o usar el selector «EN»).

El castellano tiene que quedar idéntico: se compara una instantánea del texto de la pantalla antes y después
(`comparar.py`, ver el pedido de cada tarea); cualquier diferencia es un error de la conversión.
