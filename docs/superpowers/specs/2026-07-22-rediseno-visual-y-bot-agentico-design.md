# Rediseño visual "Telemetría 2.0" + Bot agéntico de inteligencia de mercado

Fecha: 2026-07-22

## Contexto

Mercado Automotor PY es la plataforma de inteligencia comercial de Santa Rosa
Paraguay S.A. Hoy tiene 12-13 pantallas sobre datos de CADAM/DNRA (matriculaciones
e importaciones) y un Copiloto que responde preguntas en lenguaje natural
consultando **solo** la base SQLite local, sin acceso a internet.

Este spec cubre dos iniciativas que se ejecutan juntas porque comparten
superficie (el Copiloto) pero son independientes en lo técnico:

1. **Rediseño visual completo** — evolucionar el sistema "Telemetría" ya
   documentado en `DESIGN.md` hacia una versión más pulida ("Telemetría 2.0"),
   sin íconos, sin gráficos genéricos, con librerías reales de charting.
2. **Bot agéntico de inteligencia de mercado** — ampliar el Copiloto para que,
   además de consultar la base interna, pueda salir a buscar información de
   mercado y competencia en internet, ejecutar código de análisis, y generar
   un informe semanal automático de competencia.

**Actualización 2026-07-22 (post-aprobación, antes de implementar Parte 2):**
el chat interactivo sigue con Claude (`claude-opus-4-8`), pero el job semanal
de informes de competencia pasa a usar **GLM-5.2** (Zhipu AI / Z.ai) en vez
de Claude para las 4 llamadas de búsqueda por dimensión — decisión explícita
del usuario, alcance acotado a esa única superficie. Motivo: costo (GLM-5.2
$1.40/$4.40 por 1M tokens vs. Opus 4.8 $5/$25) sobre un volumen de llamadas
que no necesita la latencia/calidad de una conversación interactiva. El
detalle técnico está en la sección "Job semanal" de la Parte 2, más abajo.

## Objetivo

Que el director comercial y su equipo tengan un dashboard que se sienta
premium y profesional (no genérico) y un copiloto que además de responder
sobre los datos ya cargados, ayude a tomar decisiones comerciales con
contexto de mercado y competencia actualizado.

## Fuera de alcance

- No se migra la base de datos interna (`data/cadam.db`, SQLite, empaquetada
  y de solo lectura en runtime) — sigue como está. Solo se agrega una base
  **nueva y separada**, con permisos de escritura, para los informes de
  competencia.
- No se agrega autenticación de usuarios ni multi-tenant — la app sigue de
  uso interno, sin login.
- No se migran los datos de matriculación/importación a ningún formato
  nuevo.
- No se implementa Managed Agents de Anthropic (evaluado como Enfoque C y
  descartado por ahora — ver "Alternativas consideradas").
- No se agrega un framework de testing automatizado nuevo (el repo no tiene
  uno hoy); la verificación es manual (navegador + invocación manual del cron).

---

## Parte 1 — Rediseño visual "Telemetría 2.0"

### Alcance de pantallas

Las 13 pantallas existentes bajo `src/app/`: `page.tsx` (Inicio), `mercado`,
`evolucion`, `rankings`, `segmentos`, `combustibles`, `market-share`,
`brecha`, `inteligencia`, `copiloto`, `calidad-datos`, `cargas`,
`configuracion`. Todas se rediseñan con el mismo sistema.

### Se mantiene del sistema actual

- Tokens en OKLCH (`src/app/globals.css`), incluida la paleta de 8 colores
  categóricos para gráficos (`--chart-1`..`--chart-8`), ya validada contra
  daltonismo con orden fijo no ciclado.
- Tipografía: Nunito Sans (interfaz) + JetBrains Mono (cifras).
- **ECharts** (`echarts` + `echarts-for-react`, ya en `package.json`) como
  motor de todos los gráficos, vía el hook existente `useChartTheme()`
  (`src/lib/chart-theme.ts`) que lee los tokens CSS resueltos. Ningún SVG a
  mano, ninguna librería nueva de charting: la calidad "profesional no
  genérico" viene de usar bien lo que ya hay (tooltips reales, zoom,
  interacción), no de reemplazar la librería.
- Modo oscuro como principal; modo claro como variante técnica fría (no es
  el oscuro invertido).
- `prefers-reduced-motion` respetado globalmente.

### Cambia (desvíos explícitos del `DESIGN.md` actual — aprobados)

1. **Panel HUD.** La muesca recortada (`clip-path` en la esquina inferior
   derecha) que hoy es la seña de identidad del componente `Card`
   (`[data-slot="card"]` en `globals.css`) se reemplaza por **radios suaves +
   glow selectivo**, según la dirección "C · Híbrido Telemetría 2.0"
   aprobada en el companion visual. Se documenta como cambio intencional de
   identidad, no como bug.
2. **Motion de entrada.** `DESIGN.md` dice hoy "sin secuencias de entrada al
   cargar la página". Se habilita motion de entrada corto (150-400ms):
   paneles con aparición escalonada, cifras con efecto count-up, líneas y
   áreas de gráficos que se dibujan al montar. Se mantiene `prefers-reduced-
   motion` como corte total. Motion de estado/feedback (hover, focus,
   selección de filtro) sigue en 150-250ms como hoy.

### Sin íconos

`lucide-react` se usa hoy en el sidebar, en `src/components/copiloto/chat.tsx`
(íconos `Bot`, `Loader2`, `Send`, `User`) y en botones sueltos. Se audita el
repo completo y se reemplaza todo uso decorativo por tipografía, badges de
texto o iniciales — consistente con el mockup aprobado. Se deja `lucide-react`
en `package.json` solo si algún ícono resulta genuinamente funcional y no
decorativo (a confirmar caso por caso durante la implementación); si no
queda ningún uso, se remueve la dependencia.

### Botones, inputs, tablas

Estados hover/focus/active más ricos y consistentes en `src/components/ui/*`
(shadcn). Radios y espaciados coherentes con el nuevo lenguaje de panel.

### Documentación

Al terminar la implementación de esta parte, se actualiza `DESIGN.md` para
que documente el sistema "Telemetría 2.0" (panel con radios, motion de
entrada habilitado, ausencia de íconos) en vez del sistema anterior.

---

## Parte 2 — Bot agéntico de inteligencia de mercado

### Arquitectura general

Dos superficies, un solo Copiloto:

```
┌─────────────────────────────┐        ┌──────────────────────────────┐
│  Chat (bajo demanda)         │        │  Job semanal (programado)    │
│  /api/copiloto               │        │  Vercel Cron → orquestador   │
│                              │        │                              │
│  Claude (claude-opus-4-8)    │        │  4 llamadas en paralelo,     │
│  + tools:                    │        │  una por dimensión, cada una │
│   - consultar_base (SQL)     │        │  GLM-5.2 (Z.ai) + su tool    │
│   - web_search               │        │  nativa web_search           │
│   - web_fetch                │        │                              │
│   - code_execution           │        │  (sin web_fetch: Z.ai no     │
│   - leer_informe_competencia │◄───────┤  tiene tool equivalente)     │
└─────────────────────────────┘        │  Escriben a Postgres         │
                                        │  (informes_competencia)      │
                                        │  + síntesis final (Claude)   │
                                        └──────────────────────────────┘
```

Dos proveedores de modelo distintos, cada uno donde rinde mejor: Claude para
el chat (tools nativas ricas — SQL + web + código en un solo `toolRunner`,
calidad conversacional) y GLM-5.2 para el job semanal (mismo patrón de
búsqueda×4 en paralelo, mucho más barato, sin necesitar `code_execution` ni
la profundidad de `web_fetch` que ese caso de uso no requiere). El paso de
síntesis final del informe semanal (Parte 2, Job semanal, paso 4) se queda en
Claude — es una sola llamada corta sin tools, y mantenerla en un solo
proveedor simplifica el manejo de errores/reintentos de esa función.

La base SQLite (`data/cadam.db`) sigue siendo de **solo lectura** en runtime
(viaja empaquetada con el deploy). Los informes de competencia necesitan
escritura persistente, así que van a una base **nueva y separada**: Postgres
gestionado (Vercel Postgres, mismo dashboard que ya usan — sin sumar
proveedores nuevos, respetando la decisión de mantener todo en Vercel).

### Chat extendido (`/api/copiloto/route.ts`)

Se mantiene intacto el `toolRunner` actual (`client.beta.messages.toolRunner`,
modelo `claude-opus-4-8`, `thinking: adaptive`) y la tool `consultar_base` tal
cual está (doble cinturón: conexión readonly + regex allowlist de SELECT).

Se suman 4 tools:

| Tool | Tipo (confirmado en `@anthropic-ai/sdk` instalado, `^0.112.4`) | Uso |
|---|---|---|
| `web_search` | `web_search_20260318` | Búsqueda web para preguntas de mercado/competencia |
| `web_fetch` | `web_fetch_20260318` | Traer contenido de una URL puntual citada por el usuario o encontrada por `web_search` |
| `code_execution` | `code_execution_20260521` | Análisis ad-hoc (cálculos, proyecciones, exports) que el SQL solo no resuelve. Corre en sandbox aislado de Anthropic, sin red — no hay riesgo de exfiltración de datos internos a través de esta tool. |
| `leer_informe_competencia` | Custom (mismo patrón que `consultar_base`) | Solo lectura sobre la tabla `informes_competencia` (ver esquema abajo) |

`web_search` y `web_fetch` aceptan `allowed_domains`/`blocked_domains`; en el
chat bajo demanda se dejan **sin restricción** (el usuario puede preguntar
sobre cualquier fuente). El acotamiento por dominio se usa solo en el job
semanal para las dimensiones donde tiene sentido (ver abajo).

### System prompt (`src/lib/cadam/copiloto-contexto.ts`)

Hoy dice literalmente "No tenés acceso a internet ni a ninguna otra fuente:
solo esta base." Se reescribe para declarar la separación de fuentes:

- **SQL (`consultar_base`)** sigue siendo la única fuente de verdad para
  cifras de matriculación/importación de Santa Rosa y del mercado general
  paraguayo. La regla existente "nunca inventes cifras: todo número debe
  salir de una consulta SQL ejecutada" se mantiene sin cambios para este
  dominio.
- **Tools web (`web_search`, `web_fetch`) e informes guardados
  (`leer_informe_competencia`)** son la fuente para información externa:
  precios de competencia, noticias del sector, tendencias globales. Toda
  afirmación basada en estas fuentes debe citar **fuente y fecha** en la
  respuesta, y nunca se presenta con el mismo nivel de certeza que una cifra
  oficial de CADAM/DNRA — son información de mercado, no verdad verificada
  internamente.
- Se agrega al prompt el uso de `code_execution` para análisis que
  combinen datos internos (ya extraídos vía SQL) con contexto externo.

Las 10 reglas de dominio existentes (v_importacion_nev es subconjunto de
v_importacion, tecnologías no se agrupan, segmento no existe antes de 2024,
etc.) se mantienen sin cambios.

### Watchlist de competencia

Ya existe en `data/parametros.json` (leído por `src/lib/cadam/config.ts` vía
`getParametros()`):

- `competidores_clave`: TOYOTA, CHEVROLET, KIA, HYUNDAI, CHERY, MG, GEELY,
  BYD, CHANGAN.
- `marcas_propias`: las 10 marcas del grupo Santa Rosa (Jetour, GWM/Haval,
  JAC, Dongfeng, Soueast, Renault, Mitsubishi, Leapmotor, Zeekr, JMEV).

El job semanal y el system prompt reutilizan esta config **tal cual existe**
— no se crea una lista nueva. Si el equipo comercial la actualiza, el bot
sigue el cambio automáticamente.

### Job semanal (fan-out) — corre en GLM-5.2, no en Claude

**Disparo:** Vercel Cron (`vercel.json` → `crons`), domingo a la noche
(horario Paraguay), para que el informe esté fresco en la reunión del lunes
(alineado con el uso real descrito en `PRODUCT.md`).

**Proveedor:** [Z.ai](https://z.ai) (Zhipu AI), modelo `glm-5.2`. API propia,
**compatible con el formato OpenAI, no con el de Anthropic** — no se reutiliza
`@anthropic-ai/sdk` para esta parte. Confirmado contra la documentación
oficial (`docs.z.ai/api-reference/llm/chat-completion`, 2026-07-22):

- Base URL: `https://api.z.ai/api/paas/v4/chat/completions`
- Auth: header `Authorization: Bearer $ZAI_API_KEY`
- Tools van en un array `tools` de nivel superior, con `type` ∈
  `"function" | "web_search" | "retrieval"`. La búsqueda web es una tool
  **nativa del lado de Z.ai** (no hay que ejecutarla nosotros), declarada así:
  ```json
  { "type": "web_search",
    "web_search": { "enable": true, "search_engine": "search_pro_jina",
                     "count": 10, "search_recency_filter": "noLimit" } }
  ```
- **No existe un tipo `code_execution`** en la API de Z.ai (solo los tres de
  arriba) — no es un problema para este caso: el job semanal nunca necesitó
  `code_execution` (esa tool es exclusiva del chat interactivo, que sigue en
  Claude).
- **No existe un tipo equivalente a `web_fetch`** (traer el contenido
  completo de una URL puntual) — gap real y aceptado: las 4 dimensiones
  quedan con búsqueda (snippets + URLs), sin la profundidad de leer una
  página completa. Si más adelante hace falta, es una mejora incremental
  aislada a esta ruta, no bloquea el resto del bot.
- Sin helper tipo `toolRunner`: hay que escribir el loop de tool-use a mano
  (una request, si vuelve con `tool_calls` resolverlos y reenviar, si no,
  tomar el texto final). Dado que `web_search` es una tool servidor-a-servidor
  (Z.ai la ejecuta y devuelve el resultado ya incorporado a la respuesta,
  igual que las tools nativas de Claude), en la práctica alcanza con **una
  sola request** por dimensión — no hace falta el loop multi-turno completo,
  pero el código debe tolerar que sí aparezca un `tool_calls` de tipo
  `function` si el modelo decide usar alguno (no debería, ya que no se le da
  ningún tool `function` en este caso, solo `web_search`).
- Las fuentes citadas (para la columna `fuentes` de Postgres) se piden **por
  instrucción en el prompt** (pedirle al modelo que cierre su respuesta con
  un bloque ` ```json ` con `[{url, titulo, fecha}]`) y se parsean del texto,
  en vez de depender de un campo de citación estructurado de la API que no
  está confirmado en la documentación disponible. Ver "Riesgos y supuestos
  abiertos" — esto necesita una corrida real (con `ZAI_API_KEY` válida) para
  confirmar que el modelo sigue el formato pedido de manera confiable.

**Ruta orquestadora** (nueva, ej. `src/app/api/informes-competencia/generar/route.ts`):
1. Valida el header que Vercel Cron manda automáticamente (`Authorization:
   Bearer $CRON_SECRET`, variable de entorno) — sin esto, 401. La ruta no es
   invocable públicamente.
2. Lanza en paralelo 4 llamadas a GLM-5.2, una por dimensión:
   - **Precios y listas de modelos** — `web_search` sobre sitios de
     concesionarios/marcas en Paraguay, comparando contra `marcas_propias`.
   - **Noticias y lanzamientos del sector** — `web_search` sobre medios
     especializados (Paraguay y regional).
   - **Redes sociales / reputación** — `web_search` sobre menciones y
     actividad de las marcas de `competidores_clave`. Dimensión más costosa
     y frágil (cobertura de redes sociales vía búsqueda web es limitada); si
     en la práctica da resultados pobres, se puede acotar o quitar sin tocar
     las otras 3.
   - **Tendencias globales del sector automotor** — `web_search` sobre EVs,
     cadena de suministro, expansión de marcas chinas en LatAm.
3. Cada resultado se guarda como una fila en `informes_competencia`.
4. Un paso final (llamada corta, sin tools, **en Claude** —
   `client.messages.create` con `claude-opus-4-8`, sin tools) lee las 4 filas
   de la semana y redacta un resumen ejecutivo, guardado con
   `dimension = 'resumen'`.

**Restricción de tiempo (Vercel):** las funciones de Vercel tienen límite de
duración por invocación (varía según plan). Correr las 4 dimensiones en
paralelo (no en serie) es lo que mantiene el job dentro de ese límite. Si el
plan actual no alcanza, la alternativa es que la ruta orquestadora solo
dispare las 4 sub-invocaciones (fire-and-forget hacia 4 rutas propias) en vez
de esperarlas — a definir en el plan de implementación según el plan de
Vercel real del proyecto.

### Esquema de datos nuevo (Postgres)

Base nueva y separada de `data/cadam.db` (que sigue de solo lectura). Un
proveedor Postgres gestionado en el ecosistema Vercel (Vercel
Postgres/Neon vía integración nativa del dashboard).

```sql
create table informes_competencia (
  id            bigserial primary key,
  semana        date not null,        -- lunes de la semana que cubre
  dimension     text not null,        -- 'precios' | 'noticias' | 'redes' |
                                       -- 'tendencias' | 'resumen'
  contenido     text not null,        -- markdown
  fuentes       jsonb not null,       -- [{url, titulo, fecha}, ...]
  generado_en   timestamptz not null default now()
);
create index on informes_competencia (semana, dimension);
```

### UI del informe

Vive **dentro de la pantalla Copiloto existente** (`src/app/copiloto/page.tsx`
+ `src/components/copiloto/chat.tsx`), no en una sección nueva del menú —
decisión ya tomada. Se agrega una pestaña o panel lateral "Informes" que
lista los informes semanales guardados (por fecha), navegables sin pasar por
el chat. El chat, además, puede citarlos vía `leer_informe_competencia`
cuando se le pregunta puntualmente ("¿qué pasó esta semana con Toyota?").

---

## Parte 3 — Guardrails y seguridad

- **SQL:** mismo doble cinturón que ya existe hoy (conexión `readonly`,
  regex que solo permite `SELECT`/`WITH`, sin `;` múltiples) — sin cambios.
- **Cron:** la ruta orquestadora valida el secreto que Vercel Cron envía;
  cualquier request sin ese header o con el secreto incorrecto devuelve 401.
- **Límites duros de ingeniería** (no confundir con presupuesto en dinero,
  que el usuario definió sin techo): `max_iterations` bajo por dimensión en
  el job semanal, tamaño máximo de contenido guardado por fila.
- **Scraping:** solo páginas públicas (listas de precios publicadas, prensa
  pública) — sin credenciales, sin bypass de login ni captcha. Es
  información pública estándar de inteligencia comercial competitiva, no
  requiere autorización especial.
- **Separación de certeza:** una cifra de competencia obtenida por
  `web_search` nunca se presenta con el mismo peso que una cifra de CADAM —
  se mantiene el principio ya vigente de "nunca inventar datos", extendido a
  no hacer pasar una estimación externa por un dato interno verificado.
- **`code_execution`:** corre en el sandbox aislado de Anthropic (sin acceso
  a red ni a la base de datos interna) — no hay superficie de exfiltración
  de datos internos a través de esta tool.
- **`ZAI_API_KEY`:** secreto nuevo (además de `ANTHROPIC_API_KEY`,
  `POSTGRES_URL`, `CRON_SECRET`), solo usado por la ruta orquestadora del
  job semanal — nunca llega al cliente ni al chat interactivo.

## Parte 4 — Testing / verificación

- **Visual:** revisión manual en navegador de cada pantalla rediseñada, modo
  claro y oscuro, responsive, y con `prefers-reduced-motion` activado —
  siguiendo la práctica ya usada en este mismo proceso de diseño
  (Playwright para capturas).
- **Chat:** preguntas de prueba que toquen (a) solo SQL, (b) solo tools web,
  (c) mixtas — confirmar que toda cifra externa cita fuente y fecha, y que
  las reglas de dominio existentes (10 reglas no negociables) siguen
  respetándose.
- **Job semanal:** invocación manual de la ruta orquestadora (con el secreto
  correcto) antes de confiar en la ejecución programada real; revisar que
  las 4 filas + el resumen queden bien escritas en Postgres.
- El repo no tiene test runner automatizado hoy (no hay Jest/Vitest/Playwright
  como dependencia de test); no se agrega un framework nuevo en este
  trabajo salvo pedido explícito — la verificación queda manual, igual que
  el resto del proyecto.

## Alternativas consideradas y descartadas

- **Enfoque A (loop único extendido):** una sola llamada semanal cubriendo
  las 4 dimensiones. Más simple, pero con riesgo real de timeout de Vercel
  y de que un fallo a mitad del loop tire todo el informe. Descartado a
  favor del fan-out (Enfoque B).
- **Enfoque C (Managed Agents de Anthropic):** elimina el problema de
  timeout de raíz (corre en infraestructura de Anthropic), pero es
  superficie beta y un salto de paradigma (agentes/sesiones/entornos/
  deployments) sobre lo que hoy es un endpoint simple de Messages API.
  Queda como opción a futuro si el alcance del bot crece mucho más.

## Riesgos y supuestos abiertos

- Se asume que el plan de Vercel del proyecto permite suficiente duración de
  función para las 4 llamadas en paralelo del job semanal; si no, se ajusta
  a fire-and-forget (ver Parte 2) durante la implementación.
- La dimensión "redes sociales / reputación" es la más costosa y frágil
  (cobertura de redes sociales vía búsqueda web es limitada); se implementa
  igual que las otras 3, pero puede necesitar ajuste de alcance después de la
  primera corrida real.
- No hay techo de gasto de API definido por el usuario; se implementan
  límites de iteración por ingeniería (no por costo) como guardrail contra
  loops descontrolados, no como control de presupuesto.
- **GLM-5.2 (Z.ai):** la documentación pública confirma la forma del request
  (base URL, auth, esquema de `tools`, tipo `web_search`), pero NO confirma
  con certeza el formato exacto de citación de fuentes en la respuesta ni si
  el campo `function.arguments` en `tool_calls` viene como string JSON (como
  en OpenAI) o como objeto ya parseado (como se ve en un ejemplo de la
  documentación). El diseño pide las fuentes por instrucción en el prompt
  (bloque \`\`\`json al final) para no depender de eso, y el parseo de
  `arguments` debe tolerar ambos casos. **Esto se termina de confirmar recién
  en la primera corrida real** con una `ZAI_API_KEY` válida — no hay forma de
  verificarlo sin credenciales reales, igual que ya pasa con
  `ANTHROPIC_API_KEY`/`POSTGRES_URL` en el resto de este documento.
