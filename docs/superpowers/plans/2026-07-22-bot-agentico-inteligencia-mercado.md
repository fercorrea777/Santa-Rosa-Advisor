# Bot agéntico de inteligencia de mercado — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ampliar el Copiloto existente con `web_search`/`web_fetch`/`code_execution` (herramientas server-side nativas de Claude) y agregar un job semanal que genera informes de competencia/mercado, guardados en una base Postgres nueva y separada de la SQLite de solo lectura actual.

**Architecture:** El chat (`/api/copiloto`) suma 3 tools server-side + 1 tool custom de lectura de informes al `toolRunner` ya existente, sin tocar la tool SQL — sigue 100% en Claude (`claude-opus-4-8`). El job semanal es una ruta orquestadora protegida por secreto, disparada por Vercel Cron, que reparte el trabajo en 4 llamadas en paralelo (una por dimensión) para no correr un solo loop largo — **estas 4 llamadas corren en GLM-5.2 (Z.ai)**, no en Claude (decisión del usuario, ver Task 7), con la síntesis final de vuelta en Claude. Todo dato de competencia vive en una tabla Postgres nueva (`informes_competencia`), leíble desde el chat y desde un panel dentro de la pantalla Copiloto.

**Tech Stack:** `@anthropic-ai/sdk` ^0.112.4 (ya instalado — tools `web_search_20260318`/`web_fetch_20260318`/`code_execution_20260521` confirmadas en el paquete, usadas en el chat y en la síntesis final), API de Z.ai/GLM-5.2 vía `fetch` directo (sin SDK — confirmado contra `docs.z.ai/api-reference/llm/chat-completion`, usada solo en el job semanal), `@vercel/postgres` (nueva dependencia), Next.js 16 App Router (Route Handlers), Vercel Cron.

**Nota sobre verificación:** este repo no tiene test runner. Las herramientas server-side de Claude (`web_search`, `web_fetch`) y la API de Z.ai requieren red + credenciales reales (`ANTHROPIC_API_KEY`, `ZAI_API_KEY`) para probarse — no son mockeables sin reescribir la integración, así que no se agrega un framework de test para esto. La verificación es manual: invocaciones directas con `curl`/`fetch` y revisión de las filas escritas en Postgres.

**Prerrequisito de infraestructura (fuera de este plan, hacer antes de la Task 4):** aprovisionar una base Postgres en el dashboard de Vercel (Storage → Postgres, o la integración de Neon) para el proyecto, y traer la variable `POSTGRES_URL` a `.env.local` con `vercel env pull .env.local` (o pegarla a mano). Sin esto, las Tasks 4 en adelante no tienen contra qué conectar.

---

### Task 1: Dependencia Postgres + variables de entorno

**Files:**
- Modify: `package.json`
- Modify: `.env.example`

- [ ] **Step 1: Instalar `@vercel/postgres`**

Run: `npm install @vercel/postgres`
Expected: `package.json` y `package-lock.json` listan la dependencia nueva.

- [ ] **Step 2: Actualizar `.env.example`**

El archivo actual es:

```
# Opcional: por defecto la app ya encuentra la base y la config relativas a
# "../SANTA ROSA COMERCIAL ADVISOR/CADAM/". Solo sobreescribir si se mueve
# esa carpeta o se corre la app desde otro lugar.

# CADAM_DB_PATH=../SANTA ROSA COMERCIAL ADVISOR/CADAM/data/cadam.db
# CADAM_PARAMETROS_PATH=../SANTA ROSA COMERCIAL ADVISOR/CADAM/parametros.json
```

Reemplazar por (agrega la sección del Copiloto y de informes, que hoy no están documentadas):

```
# Opcional: por defecto la app ya encuentra la base y la config relativas a
# "../SANTA ROSA COMERCIAL ADVISOR/CADAM/". Solo sobreescribir si se mueve
# esa carpeta o se corre la app desde otro lugar.

# CADAM_DB_PATH=../SANTA ROSA COMERCIAL ADVISOR/CADAM/data/cadam.db
# CADAM_PARAMETROS_PATH=../SANTA ROSA COMERCIAL ADVISOR/CADAM/parametros.json

# Requerido para el Copiloto (chat interactivo + síntesis final del
# informe semanal).
ANTHROPIC_API_KEY=sk-ant-...

# Requerido para las 4 búsquedas por dimensión del job semanal (no lo usa
# el chat). Cuenta en https://z.ai — modelo glm-5.2.
ZAI_API_KEY=...

# Requerido para los informes de competencia (tabla Postgres nueva,
# separada de la base SQLite de solo lectura). Traer con
# `vercel env pull .env.local` una vez aprovisionada la base en el
# dashboard de Vercel (Storage → Postgres).
POSTGRES_URL=postgres://...

# Requerido para el job semanal: secreto que valida que la ruta
# /api/informes-competencia/generar solo la dispare el cron de Vercel.
# Generar uno propio, ej.: `openssl rand -hex 32`.
CRON_SECRET=...
```

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json .env.example
git commit -m "Agregar @vercel/postgres y documentar variables de entorno del bot"
```

---

### Task 2: Cliente Postgres + helpers de informes

**Files:**
- Create: `src/lib/informes/db.ts`

- [ ] **Step 1: Crear el archivo**

```typescript
import { sql } from "@vercel/postgres";

export interface FuenteCitada {
  url: string;
  titulo: string;
  fecha: string;
}

export type DimensionInforme = "precios" | "noticias" | "redes" | "tendencias" | "resumen";

export interface FilaInforme {
  id: number;
  semana: string; // YYYY-MM-DD (lunes de esa semana)
  dimension: DimensionInforme;
  contenido: string;
  fuentes: FuenteCitada[];
  generado_en: string;
}

/** Crea la tabla si no existe. Se corre una vez desde
 *  scripts/setup-informes-db.mjs, no en cada request. */
export async function crearTablaInformes(): Promise<void> {
  await sql`
    create table if not exists informes_competencia (
      id            bigserial primary key,
      semana        date not null,
      dimension     text not null,
      contenido     text not null,
      fuentes       jsonb not null,
      generado_en   timestamptz not null default now()
    );
  `;
  await sql`
    create index if not exists informes_competencia_semana_dimension_idx
      on informes_competencia (semana, dimension);
  `;
}

export async function guardarInforme(params: {
  semana: string;
  dimension: DimensionInforme;
  contenido: string;
  fuentes: FuenteCitada[];
}): Promise<void> {
  await sql`
    insert into informes_competencia (semana, dimension, contenido, fuentes)
    values (${params.semana}, ${params.dimension}, ${params.contenido}, ${JSON.stringify(params.fuentes)}::jsonb)
  `;
}

export async function getInformesRecientes(limite = 12): Promise<FilaInforme[]> {
  const { rows } = await sql<FilaInforme>`
    select id, to_char(semana, 'YYYY-MM-DD') as semana, dimension, contenido, fuentes, generado_en
    from informes_competencia
    order by semana desc, dimension asc
    limit ${limite}
  `;
  return rows;
}

export async function getInformesPorSemana(semana: string): Promise<FilaInforme[]> {
  const { rows } = await sql<FilaInforme>`
    select id, to_char(semana, 'YYYY-MM-DD') as semana, dimension, contenido, fuentes, generado_en
    from informes_competencia
    where semana = ${semana}
    order by dimension asc
  `;
  return rows;
}
```

- [ ] **Step 2: Verificar que compila**

Run: `npx tsc --noEmit`
Expected: sin errores (asumiendo que la Task 1 ya instaló `@vercel/postgres`).

- [ ] **Step 3: Commit**

```bash
git add src/lib/informes/db.ts
git commit -m "Agregar cliente Postgres y helpers de informes_competencia"
```

---

### Task 3: Script de setup de la tabla

**Files:**
- Create: `scripts/setup-informes-db.mjs`
- Modify: `package.json`

- [ ] **Step 1: Crear el script**

```javascript
#!/usr/bin/env node
import { sql } from "@vercel/postgres";

async function main() {
  await sql`
    create table if not exists informes_competencia (
      id            bigserial primary key,
      semana        date not null,
      dimension     text not null,
      contenido     text not null,
      fuentes       jsonb not null,
      generado_en   timestamptz not null default now()
    );
  `;
  await sql`
    create index if not exists informes_competencia_semana_dimension_idx
      on informes_competencia (semana, dimension);
  `;
  console.log("Tabla informes_competencia lista.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 2: Agregar el script a `package.json`**

En la sección `"scripts"` de `package.json`, agregar (después de `"sync-datos"`):

```json
    "setup-informes-db": "node scripts/setup-informes-db.mjs"
```

- [ ] **Step 3: Correr el script (requiere `POSTGRES_URL` en `.env.local`, ver prerrequisito al inicio de este plan)**

Run: `npm run setup-informes-db`
Expected: imprime "Tabla informes_competencia lista." sin errores. Si falla con error de conexión, confirmar que `POSTGRES_URL` está en `.env.local` y apunta a una base Postgres real y accesible.

- [ ] **Step 4: Commit**

```bash
git add scripts/setup-informes-db.mjs package.json
git commit -m "Agregar script de setup de la tabla informes_competencia"
```

---

### Task 4: Extender `/api/copiloto` con las tools nuevas

**Files:**
- Modify: `src/app/api/copiloto/route.ts`

- [ ] **Step 1: Reemplazar el archivo completo**

El archivo actual (182 líneas) se reemplaza por esta versión, que agrega `web_search`, `web_fetch`, `code_execution` y una tool custom `leer_informe_competencia`, sin tocar `consultar_base`:

```typescript
import Anthropic from "@anthropic-ai/sdk";
import { betaTool } from "@anthropic-ai/sdk/helpers/beta/json-schema";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/cadam/db";
import { armarSystemPrompt } from "@/lib/cadam/copiloto-contexto";
import { getInformesPorSemana, getInformesRecientes } from "@/lib/informes/db";

/**
 * Copiloto de inteligencia comercial.
 *
 * Claude responde preguntas en lenguaje natural con dos tipos de fuente:
 * - consultar_base: SQL de solo lectura sobre la MISMA base SQLite que
 *   alimenta los dashboards. Es la unica fuente de verdad para cifras de
 *   matriculacion/importacion.
 * - web_search / web_fetch / code_execution: herramientas server-side de
 *   Anthropic para informacion externa de mercado/competencia y analisis
 *   ad-hoc. code_execution corre en un sandbox aislado sin acceso a la
 *   base interna ni a la red mas alla de lo que la propia tool necesita.
 * - leer_informe_competencia: lectura de los informes semanales generados
 *   por el job programado (ver /api/informes-competencia/generar).
 *
 * Seguridad de consultar_base (sin cambios):
 * - La conexion de la app ya se abre con { readonly: true } (db.ts), y
 *   ademas se valida que el texto sea UNA unica sentencia SELECT/WITH
 *   (sin PRAGMA/ATTACH/etc.). Doble cinturon.
 * - El resultado se trunca a 200 filas: si Claude necesita mas, tiene
 *   que agregar (GROUP BY), que es lo que corresponde.
 */

export const runtime = "nodejs";
// La respuesta depende de la base y del historial: nunca cachear.
export const dynamic = "force-dynamic";

const MAX_FILAS = 200;
const MAX_TURNOS = 40; // historial maximo que aceptamos del cliente
// Mas alto que antes (era 8): con mas herramientas disponibles (SQL + web +
// codigo) una pregunta puede necesitar mas pasos de ida y vuelta.
const MAX_ITERACIONES = 12;

const PROHIBIDAS =
  /\b(insert|update|delete|drop|alter|create|replace|attach|detach|pragma|vacuum|reindex|begin|commit|rollback)\b/i;

function ejecutarSql(consulta: string): string {
  const limpia = consulta.trim().replace(/;+\s*$/, "");
  if (!/^\s*(select|with)\b/i.test(limpia) || PROHIBIDAS.test(limpia) ||
      limpia.includes(";")) {
    return JSON.stringify({
      error: "Solo se permite una única sentencia SELECT (o WITH ... SELECT).",
    });
  }
  try {
    const filas = getDb().prepare(limpia).all();
    const truncado = filas.length > MAX_FILAS;
    return JSON.stringify({
      filas: truncado ? filas.slice(0, MAX_FILAS) : filas,
      total_filas: filas.length,
      truncado_a: truncado ? MAX_FILAS : undefined,
      nota: truncado
        ? "Resultado truncado: agregá con GROUP BY en vez de pedir filas sueltas."
        : undefined,
    });
  } catch (e) {
    return JSON.stringify({ error: `SQL inválido: ${(e as Error).message}` });
  }
}

const consultarBase = betaTool({
  name: "consultar_base",
  description:
    "Ejecuta una consulta SQL de SOLO LECTURA (SELECT) sobre la base de " +
    "matriculaciones e importaciones de CADAM. Usala para toda cifra que " +
    "vayas a afirmar sobre el mercado interno. Preferí agregaciones (GROUP " +
    "BY) a filas sueltas; el resultado se trunca a 200 filas.",
  inputSchema: {
    type: "object",
    properties: {
      sql: {
        type: "string",
        description:
          "Una única sentencia SELECT (o WITH ... SELECT). Consultá las " +
          "vistas v_matriculacion, v_importacion, v_importacion_camion, " +
          "v_importacion_nev y carga_log.",
      },
    },
    required: ["sql"],
    additionalProperties: false,
  },
  run: (input) => ejecutarSql((input as { sql: string }).sql),
});

async function leerInformes(input: { semana?: string }): Promise<string> {
  try {
    const filas = input.semana
      ? await getInformesPorSemana(input.semana)
      : await getInformesRecientes(12);
    return JSON.stringify({ informes: filas });
  } catch (e) {
    return JSON.stringify({ error: `No se pudo leer informes: ${(e as Error).message}` });
  }
}

const leerInformeCompetencia = betaTool({
  name: "leer_informe_competencia",
  description:
    "Lee los informes semanales de competencia/mercado ya generados " +
    "(precios, noticias, redes, tendencias globales y resumen ejecutivo). " +
    "Solo lectura. Si no pasás 'semana', trae los últimos 12 informes " +
    "guardados (de cualquier semana/dimensión).",
  inputSchema: {
    type: "object",
    properties: {
      semana: {
        type: "string",
        description: "Fecha del lunes de la semana a consultar, formato YYYY-MM-DD. Opcional.",
      },
    },
    additionalProperties: false,
  },
  run: (input) => leerInformes(input as { semana?: string }),
});

interface TurnoCliente {
  role: "user" | "assistant";
  content: string;
}

export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      {
        error:
          "Falta ANTHROPIC_API_KEY en .env.local de la app. " +
          "Agregala y reiniciá el servidor.",
      },
      { status: 500 }
    );
  }

  let turnos: TurnoCliente[];
  try {
    const body = await request.json();
    turnos = (body?.mensajes ?? []) as TurnoCliente[];
    if (!Array.isArray(turnos) || !turnos.length) throw new Error("vacío");
    if (
      !turnos.every(
        (t) =>
          (t.role === "user" || t.role === "assistant") &&
          typeof t.content === "string" &&
          t.content.length > 0 &&
          t.content.length < 8000
      )
    ) {
      throw new Error("formato");
    }
  } catch {
    return NextResponse.json(
      { error: "Cuerpo inválido: se espera { mensajes: [{role, content}] }." },
      { status: 400 }
    );
  }

  const client = new Anthropic();

  try {
    const final = await client.beta.messages.toolRunner({
      model: "claude-opus-4-8",
      max_tokens: 8000,
      max_iterations: MAX_ITERACIONES,
      thinking: { type: "adaptive" },
      // El system es estable (el estado variable va al final del texto):
      // se cachea entre preguntas de la misma sesion y entre usuarios.
      system: [
        {
          type: "text",
          text: armarSystemPrompt(),
          cache_control: { type: "ephemeral" },
        },
      ],
      tools: [
        consultarBase,
        leerInformeCompetencia,
        { type: "web_search_20260318", name: "web_search" },
        { type: "web_fetch_20260318", name: "web_fetch" },
        { type: "code_execution_20260521", name: "code_execution" },
      ],
      messages: turnos.slice(-MAX_TURNOS).map((t) => ({
        role: t.role,
        content: t.content,
      })),
    });

    if (final.stop_reason === "refusal") {
      return NextResponse.json({
        respuesta:
          "No puedo responder esa consulta. Reformulala sobre los datos del mercado.",
      });
    }

    const texto = final.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();

    return NextResponse.json({
      respuesta: texto || "No obtuve respuesta. Probá reformular la pregunta.",
      truncada: final.stop_reason === "max_tokens",
    });
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) {
      return NextResponse.json(
        { error: "La clave de API no es válida. Revisá ANTHROPIC_API_KEY." },
        { status: 500 }
      );
    }
    if (e instanceof Anthropic.RateLimitError) {
      return NextResponse.json(
        { error: "Límite de uso de la API alcanzado. Esperá un momento y reintentá." },
        { status: 429 }
      );
    }
    if (e instanceof Anthropic.APIError) {
      return NextResponse.json(
        { error: `Error de la API de Claude (${e.status}): ${e.message}` },
        { status: 502 }
      );
    }
    throw e;
  }
}
```

- [ ] **Step 2: Verificar que compila**

Run: `npx tsc --noEmit`
Expected: sin errores (asumiendo que la Task 2 ya creó `src/lib/informes/db.ts`).

- [ ] **Step 3: Commit**

```bash
git add src/app/api/copiloto/route.ts
git commit -m "Copiloto: sumar web_search/web_fetch/code_execution/leer_informe_competencia"
```

---

### Task 5: Reescribir el system prompt del Copiloto

**Files:**
- Modify: `src/lib/cadam/copiloto-contexto.ts`

- [ ] **Step 1: Reemplazar el archivo completo**

```typescript
import { getCobertura } from "./mercado";
import { getParametros } from "./config";

/**
 * Contexto que recibe el copiloto: esquema real de la base y las reglas
 * del dominio que las pantallas ya respetan, mas la separacion entre
 * datos internos (SQL, unica fuente de verdad) e informacion externa de
 * mercado/competencia (tools web + informes guardados, siempre citada).
 *
 * El texto es estable a proposito (sin timestamps): es el prefijo
 * cacheado del prompt. Lo variable (snapshot, cobertura) va al final.
 */

const ESQUEMA = `
## Esquema de la base interna (SQLite, vía consultar_base)

La app consulta SIEMPRE las vistas v_* (el snapshot activo). Las tablas
base tienen ademas la columna "snapshot" con cargas historicas.

### v_matriculacion — vehiculos patentados (fuente: DNRA via CADAM)
  anio INTEGER, mes INTEGER (1-12)
  marca TEXT            -- normalizada, ej. 'TOYOTA', 'GREAT WALL'
  modelo TEXT           -- tal como lo escribe la DNRA, grafias ya unificadas
  segmento TEXT         -- 'SUV','Pick Up','Automovil','City car','Furgon',
                        --  'Minibus','Camion','Omnibus','Sin clasificar'
  tecnologia TEXT       -- 'ICE','MHEV','HEV','PHEV','REEV','EV'
  empresa TEXT          -- importador/representante, ej. 'SANTA ROSA','GARDEN'
  unidades INTEGER

### v_importacion — vehiculos LIVIANOS importados (aduana)
  anio, mes, marca, modelo, unidades
  segmento TEXT         -- mismo canonico que arriba
  tipo_detalle TEXT     -- 'SUV C', 'PICK UP MEDIANO', 'AUTO B', ...
  tipo_cadam TEXT       -- clasificacion fina de CADAM
  origen TEXT           -- SOLO 'CHINA' u 'OTROS' (es un flag, no el pais)
  largo, ancho, alto INTEGER  -- dimensiones en mm (pueden ser NULL)
  -- NO tiene tecnologia ni empresa.

### v_importacion_camion — camiones y omnibus importados
  anio, mes, marca, modelo, tipo, unidades

### v_importacion_nev — detalle de tecnologia de importados (EV/HEV/PHEV)
  anio, mes, marca, modelo, tecnologia, unidades
  -- ¡SUBCONJUNTO de v_importacion! NUNCA sumarlo a totales.

### carga_log — hallazgos de calidad de la ultima carga
  snapshot, archivo, nivel ('info'|'aviso'|'error'), categoria, mensaje, n

### snapshots / archivos — trazabilidad de cargas
`;

const REGLAS = `
## Reglas del dominio para datos internos (NO negociables)

1. NUNCA inventes cifras internas. Todo numero de matriculacion/
   importacion que menciones debe salir de una consulta SQL que hayas
   ejecutado con consultar_base en esta conversacion. Si no hay datos
   suficientes, decilo: "informacion insuficiente".
2. v_importacion_nev es un SUBCONJUNTO de v_importacion. Jamas los sumes:
   v_importacion da el VOLUMEN, v_importacion_nev el detalle de tecnologia.
3. Al comparar importacion vs matriculacion, exclui camiones y omnibus de
   la matriculacion (segmento NOT IN ('Camion','Omnibus')): la base de
   importacion es solo de livianos. La brecha resultante es una SEÑAL
   orientativa, NUNCA stock real (hay desfasajes, reexportaciones,
   registros tardios).
4. Tecnologias: MHEV, HEV, PHEV, REEV y EV son categorias DISTINTAS, no
   las agrupes salvo que el usuario lo pida (y aun asi mostra el detalle).
   ICE incluye nafta y diesel sin distincion (la fuente no los separa).
5. El segmento NO existe antes de 2024 en matriculacion (viene 'Sin
   clasificar'): un analisis por segmento de 2022-2023 no es posible.
6. Falta febrero 2022 en matriculacion (hueco real del origen). Un mes
   sin datos NO es cero.
7. Al comparar periodos usa solo los meses presentes en AMBOS: un anio
   parcial contra uno completo da una caida falsa.
8. Variaciones porcentuales sobre bases menores a ~30 unidades no
   significan nada; mostrá las unidades absolutas en esos casos.
9. Una marca puede crecer en unidades Y perder participacion si el
   mercado crecio mas rapido. Distingui siempre ambas cosas.
10. No hay datos de version, motor, transmision ni traccion en ninguna
    fuente interna. El campo 'origen' NO es el pais (solo CHINA/OTROS).

## Reglas para informacion externa (web_search, web_fetch, informes)

11. Toda cifra o afirmacion que NO salga de consultar_base (precios de
    competencia, noticias, tendencias, redes sociales) es informacion
    EXTERNA: citá siempre la fuente (dominio o medio) y la fecha del dato.
    Nunca la presentes con la misma certeza que una cifra de CADAM/DNRA —
    es información de mercado, no un dato interno verificado.
12. Nunca mezcles una cifra externa con una interna en la misma frase sin
    dejar clara cuál es cuál (ej. no digas "vendimos X% más que Toyota"
    mezclando matriculaciones propias verificadas con una cifra de venta
    de Toyota tomada de una nota de prensa sin más chequeo).
13. leer_informe_competencia te da los informes semanales ya generados
    (precios/noticias/redes/tendencias). Preferila a una búsqueda nueva
    cuando la pregunta es sobre "esta semana" o "el último informe": es
    más rápida y ya viene con fuentes citadas.
14. code_execution es para cálculos o transformaciones que el SQL solo no
    resuelve (proyecciones, cruces entre datos internos ya consultados y
    contexto externo, generar un export). No lo uses para acceder a datos:
    no tiene conexión a la base ni a la red salvo lo que la propia tool
    necesita.

## Como responder

- En español, tono ejecutivo (hablas con el equipo comercial de un
  importador automotor paraguayo). Anda al grano.
- Cita las cifras internas con su periodo: "3.463 u. en ene-jun 2026".
  Cita las cifras externas con su fuente: "según [medio], en [fecha]".
- Usa pocas consultas y bien pensadas (agrega con GROUP BY, no pidas
  filas sueltas). Maximo ~5 consultas de SQL por pregunta.
- Si la pregunta es ambigua respecto del periodo, asumi el acumulado del
  anio en curso y aclaralo en la respuesta.
- Cuando el resultado sea una tabla, usa una tabla markdown compacta.
- Si detectas algo relevante que el usuario no pregunto (una anomalia,
  un riesgo), mencionalo en una linea al final, sin desarrollarlo.
`;

export function armarSystemPrompt(): string {
  const parametros = getParametros();
  const cobertura = getCobertura();

  const propias = parametros.marcas_propias
    .map((m) => m.marca_cadam)
    .join(", ");
  const competidores = parametros.competidores_clave.join(", ");

  // Parte variable al FINAL, para no invalidar el prefijo cacheado.
  const estado = `
## Estado actual de la base

- Snapshot activo: ${cobertura.snapshot ?? "ninguno"} (cargado ${cobertura.fechaIngesta ?? "—"})
- Matriculacion: años ${cobertura.matriculacion.anios.join(", ")}, último mes ${cobertura.matriculacion.ultimo ? `${cobertura.matriculacion.ultimo.anio}-${String(cobertura.matriculacion.ultimo.mes).padStart(2, "0")}` : "—"}
- Importacion: años ${cobertura.importacion.anios.join(", ")}, último mes ${cobertura.importacion.ultimo ? `${cobertura.importacion.ultimo.anio}-${String(cobertura.importacion.ultimo.mes).padStart(2, "0")}` : "—"}
- Marcas propias (Santa Rosa): ${propias}
- Competidores clave (watchlist de mercado): ${competidores}
`;

  return (
    `Sos el copiloto de inteligencia comercial de Santa Rosa Paraguay S.A. ` +
    `dentro de su aplicacion del mercado automotor paraguayo. Tenes dos ` +
    `tipos de fuente: la base interna de CADAM/DNRA (via consultar_base, ` +
    `la UNICA fuente de verdad para cifras propias del mercado paraguayo) ` +
    `y herramientas de busqueda/lectura externa (web_search, web_fetch, ` +
    `code_execution, leer_informe_competencia) para contexto de mercado y ` +
    `competencia. No mezcles ambas sin aclarar cual es cual.\n` +
    ESQUEMA +
    REGLAS +
    estado
  );
}
```

- [ ] **Step 2: Verificar que compila**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/lib/cadam/copiloto-contexto.ts
git commit -m "Copiloto: system prompt distingue datos internos vs. externos"
```

---

### Task 6: Verificación manual del chat extendido

**Files:** ninguno (solo verificación, requiere `ANTHROPIC_API_KEY` real)

- [ ] **Step 1: Pregunta solo-SQL**

Run: `npm run dev`, abrir `/copiloto`, preguntar: "¿Cómo viene JETOUR contra CHERY este año?"
Expected: responde con cifras citadas por período, sin usar `web_search`/`web_fetch` (verificable si se loguea la respuesta cruda, o simplemente por el contenido: cifras con formato "X u. en período").

- [ ] **Step 2: Pregunta solo-web**

Preguntar: "¿Qué noticias recientes hay sobre BYD en Paraguay?"
Expected: responde citando fuente (dominio/medio) y fecha para cada afirmación, sin presentarlas como cifras oficiales de CADAM.

- [ ] **Step 3: Pregunta mixta**

Preguntar: "¿Cómo viene nuestra participación de mercado este año, y hay algo en la prensa sobre nuestros competidores directos?"
Expected: la respuesta separa claramente la parte con cifras internas (citadas con período) de la parte con información externa (citada con fuente/fecha), sin mezclarlas en la misma afirmación.

- [ ] **Step 4: Confirmar que las reglas de dominio siguen respetadas**

Preguntar: "Dame el market share por segmento en 2022"
Expected: el copiloto aclara que el segmento no existe antes de 2024 (regla 5), no inventa una cifra.

---

### Task 7: Ruta orquestadora del job semanal (GLM-5.2 para las 4 dimensiones, Claude para el resumen)

**Decisión (2026-07-22, ver spec Parte 2 "Job semanal"):** las 4 llamadas de
búsqueda por dimensión corren en **GLM-5.2 (Z.ai)**, no en Claude — más
barato para este volumen, sin necesitar `code_execution` (que este caso no
usa) y aceptando no tener `web_fetch` (Z.ai no tiene tool equivalente; las
dimensiones quedan con búsqueda, no con lectura profunda de una página). El
paso de síntesis final se queda en Claude (una llamada corta sin tools).

**Files:**
- Create: `src/lib/informes/glm-client.ts`
- Create: `src/app/api/informes-competencia/generar/route.ts`

- [ ] **Step 1: Crear el cliente de Z.ai**

API confirmada contra `docs.z.ai/api-reference/llm/chat-completion`
(2026-07-22): base URL, auth, esquema de `tools` y el tipo nativo
`web_search`. **No confirmado** por la documentación pública: si
`function.arguments` en `tool_calls` viene como string JSON o como objeto ya
parseado — este cliente tolera ambos casos. Tampoco hay un campo de citación
estructurado documentado, por eso las fuentes se piden por instrucción en el
prompt (Step 2) y se parsean del texto, no de un campo de la respuesta.

```typescript
const ZAI_URL = "https://api.z.ai/api/paas/v4/chat/completions";

export interface ZaiMensaje {
  role: "system" | "user" | "assistant";
  content: string;
}

interface ZaiToolCallFuncion {
  name: string;
  arguments: string | Record<string, unknown>;
}

interface ZaiToolCall {
  id: string;
  type: "function";
  function: ZaiToolCallFuncion;
}

interface ZaiChoice {
  message: {
    content: string | null;
    tool_calls?: ZaiToolCall[];
  };
}

interface ZaiRespuesta {
  choices: ZaiChoice[];
}

/**
 * Llama a GLM-5.2 con la tool nativa web_search habilitada. No se declara
 * ningun tool de tipo "function" (esta ruta no necesita ejecutar codigo del
 * lado del cliente), asi que no se espera un loop de tool-use manual: la
 * busqueda la ejecuta Z.ai del lado del servidor y el texto final ya viene
 * con el resultado incorporado, igual que las tools nativas de Claude.
 */
export async function llamarGlmConBusqueda(
  mensajes: ZaiMensaje[],
  maxTokens: number
): Promise<string> {
  const apiKey = process.env.ZAI_API_KEY;
  if (!apiKey) throw new Error("Falta ZAI_API_KEY");

  const res = await fetch(ZAI_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "glm-5.2",
      messages: mensajes,
      max_tokens: maxTokens,
      tool_choice: "auto",
      tools: [
        {
          type: "web_search",
          web_search: {
            enable: true,
            search_engine: "search_pro_jina",
            count: 10,
            search_recency_filter: "noLimit",
          },
        },
      ],
    }),
  });

  if (!res.ok) {
    throw new Error(`Z.ai API error ${res.status}: ${await res.text()}`);
  }

  const data: ZaiRespuesta = await res.json();
  const mensaje = data.choices[0]?.message;
  if (!mensaje) throw new Error("Respuesta de Z.ai sin choices");

  // No se le da ningun tool "function", asi que no debería pedir ejecutar
  // ninguno — si igual lo hace, no hay como resolverlo (no hay handler) y
  // se trata como error explicito en vez de devolver un texto vacio.
  if (mensaje.tool_calls && mensaje.tool_calls.length > 0) {
    throw new Error(
      `Z.ai devolvió tool_calls inesperados (${mensaje.tool_calls.map((t) => t.function.name).join(", ")}) sin tools tipo function declaradas`
    );
  }

  return (mensaje.content ?? "").trim();
}
```

- [ ] **Step 2: Verificar que compila**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Commit el cliente**

```bash
git add src/lib/informes/glm-client.ts
git commit -m "Agregar cliente GLM-5.2 (Z.ai) para el job semanal"
```

- [ ] **Step 4: Crear la ruta orquestadora**

```typescript
import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { getParametros } from "@/lib/cadam/config";
import { llamarGlmConBusqueda } from "@/lib/informes/glm-client";
import { guardarInforme, type DimensionInforme, type FuenteCitada } from "@/lib/informes/db";

/**
 * Genera el informe semanal de competencia/mercado. Disparado por Vercel
 * Cron (ver vercel.json), protegido con CRON_SECRET: sin el header
 * correcto, 401. Reparte el trabajo en 4 llamadas en paralelo (una por
 * dimension, en GLM-5.2) para no correr un solo loop largo que arriesgue el
 * limite de duracion de la funcion serverless. La sintesis final queda en
 * Claude (una llamada corta, sin tools).
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const DIMENSIONES: { id: DimensionInforme; prompt: string }[] = [
  {
    id: "precios",
    prompt:
      "Buscá precios y listas de modelos publicados por concesionarios/" +
      "marcas en Paraguay para las marcas de competencia y compará contra " +
      "las marcas propias del grupo. Para cada hallazgo relevante, mencioná " +
      "la fuente y la fecha. Cerrá con un resumen de 3-5 puntos.",
  },
  {
    id: "noticias",
    prompt:
      "Buscá noticias y lanzamientos recientes del sector automotor " +
      "paraguayo y regional relevantes para estas marcas. Mencioná fuente y " +
      "fecha de cada nota. Cerrá con un resumen de 3-5 puntos.",
  },
  {
    id: "redes",
    prompt:
      "Buscá menciones y actividad reciente en redes sociales sobre estas " +
      "marcas de competencia. Mencioná fuente y fecha. Si la búsqueda no " +
      "encuentra señal útil, decilo explícitamente en vez de forzar una " +
      "conclusión. Cerrá con un resumen de 3-5 puntos.",
  },
  {
    id: "tendencias",
    prompt:
      "Buscá tendencias globales del sector automotor relevantes para " +
      "este mercado: vehículos eléctricos/híbridos, cadena de suministro, " +
      "expansión de marcas chinas en Latinoamérica. Mencioná fuente y " +
      "fecha. Cerrá con un resumen de 3-5 puntos.",
  },
];

// Instrucción de formato para poder parsear las fuentes del texto: Z.ai no
// documenta un campo de citación estructurado, así que se pide como bloque
// al final de la respuesta.
const INSTRUCCION_FUENTES =
  "\n\nAl terminar tu respuesta, agregá un bloque de código ```json con un " +
  'array de las fuentes que usaste, formato exacto: [{"url":"...",' +
  '"titulo":"...","fecha":"YYYY-MM-DD o vacío si no la sabés"}]. Si no ' +
  "usaste ninguna fuente, poné un array vacío [].";

function lunesDeEstaSemana(): string {
  const hoy = new Date();
  const dia = hoy.getUTCDay(); // 0=domingo
  const offset = dia === 0 ? -6 : 1 - dia; // retrocede al lunes
  const lunes = new Date(hoy);
  lunes.setUTCDate(hoy.getUTCDate() + offset);
  return lunes.toISOString().slice(0, 10);
}

function contextoMarcas(): string {
  const p = getParametros();
  const propias = p.marcas_propias.map((m) => m.marca_cadam).join(", ");
  const competidores = p.competidores_clave.join(", ");
  return (
    `Marcas propias de Santa Rosa Paraguay: ${propias}.\n` +
    `Marcas competidoras a vigilar: ${competidores}.\n` +
    `Mercado: automotor paraguayo.`
  );
}

/** Separa el bloque ```json de fuentes del final del texto y lo parsea.
 *  Si no aparece o no parsea, devuelve fuentes vacías y deja el texto
 *  entero como contenido (no se pierde el informe por un bloque mal
 *  formado). */
function extraerFuentes(textoCompleto: string): { contenido: string; fuentes: FuenteCitada[] } {
  const match = textoCompleto.match(/```json\s*([\s\S]*?)\s*```\s*$/);
  if (!match) return { contenido: textoCompleto, fuentes: [] };

  const contenido = textoCompleto.slice(0, match.index).trim();
  try {
    const parsed = JSON.parse(match[1]);
    if (!Array.isArray(parsed)) return { contenido, fuentes: [] };
    const fuentes: FuenteCitada[] = parsed
      .filter((f): f is Record<string, unknown> => typeof f === "object" && f !== null)
      .map((f) => ({
        url: typeof f.url === "string" ? f.url : "",
        titulo: typeof f.titulo === "string" ? f.titulo : "",
        fecha: typeof f.fecha === "string" ? f.fecha : "",
      }))
      .filter((f) => f.url !== "");
    return { contenido, fuentes };
  } catch {
    return { contenido, fuentes: [] };
  }
}

async function correrDimension(
  dimension: { id: DimensionInforme; prompt: string }
): Promise<{ id: DimensionInforme; contenido: string; fuentes: FuenteCitada[] }> {
  const textoCompleto = await llamarGlmConBusqueda(
    [
      {
        role: "system",
        content: `Sos un analista de inteligencia comercial para Santa Rosa Paraguay S.A. ${contextoMarcas()} Respondé en español, con evidencia (fuente + fecha) para cada afirmación.`,
      },
      { role: "user", content: dimension.prompt + INSTRUCCION_FUENTES },
    ],
    4000
  );

  const { contenido, fuentes } = extraerFuentes(textoCompleto);
  return { id: dimension.id, contenido, fuentes };
}

export async function POST(request: Request) {
  const secreto = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secreto || auth !== `Bearer ${secreto}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!process.env.ZAI_API_KEY) {
    return NextResponse.json({ error: "Falta ZAI_API_KEY" }, { status: 500 });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "Falta ANTHROPIC_API_KEY" }, { status: 500 });
  }

  const semana = lunesDeEstaSemana();

  const resultados = await Promise.allSettled(
    DIMENSIONES.map((d) => correrDimension(d))
  );

  const ok: { id: DimensionInforme; contenido: string; fuentes: FuenteCitada[] }[] = [];
  const fallidas: string[] = [];
  for (let i = 0; i < resultados.length; i++) {
    const r = resultados[i];
    if (r.status === "fulfilled") {
      ok.push(r.value);
      await guardarInforme({
        semana,
        dimension: r.value.id,
        contenido: r.value.contenido,
        fuentes: r.value.fuentes,
      });
    } else {
      fallidas.push(DIMENSIONES[i].id);
    }
  }

  if (ok.length > 0) {
    const cuerpoResumen = ok.map((r) => `### ${r.id}\n${r.contenido}`).join("\n\n");
    const client = new Anthropic();
    const resumenFinal = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 2000,
      thinking: { type: "adaptive" },
      messages: [
        {
          role: "user",
          content:
            `Resumí en un informe ejecutivo breve (5-8 puntos) estas ` +
            `${ok.length} secciones de inteligencia de mercado de la semana, ` +
            `para el equipo comercial de Santa Rosa Paraguay:\n\n${cuerpoResumen}`,
        },
      ],
    });
    const textoResumen = resumenFinal.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
    const fuentesResumen = ok.flatMap((r) => r.fuentes);
    await guardarInforme({ semana, dimension: "resumen", contenido: textoResumen, fuentes: fuentesResumen });
  }

  return NextResponse.json({
    semana,
    generadas: ok.map((r) => r.id),
    fallidas,
  });
}
```

- [ ] **Step 5: Verificar que compila**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/informes-competencia/generar/route.ts
git commit -m "Agregar ruta orquestadora del informe semanal (GLM-5.2 por dimensión + síntesis en Claude)"
```

---

### Task 8: Ruta de lectura para la UI

**Files:**
- Create: `src/app/api/informes-competencia/route.ts`

- [ ] **Step 1: Crear el archivo**

```typescript
import { NextResponse } from "next/server";
import { getInformesRecientes } from "@/lib/informes/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Lectura de los últimos informes generados, para el panel dentro de la
 *  pantalla Copiloto. Sin autenticación, igual que el resto de la app
 *  (uso interno, sin login). Solo lectura. */
export async function GET() {
  try {
    const informes = await getInformesRecientes(12);
    return NextResponse.json({ informes });
  } catch (e) {
    return NextResponse.json(
      { error: `No se pudieron leer los informes: ${(e as Error).message}` },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Verificar que compila**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/informes-competencia/route.ts
git commit -m "Agregar ruta GET de lectura de informes para la UI"
```

---

### Task 9: Configuración del cron en `vercel.json`

**Files:**
- Create: `vercel.json`

- [ ] **Step 1: Crear el archivo**

No existe `vercel.json` en la raíz del repo hoy. Crearlo con:

```json
{
  "crons": [
    {
      "path": "/api/informes-competencia/generar",
      "schedule": "0 3 * * 1"
    }
  ]
}
```

Nota: Vercel Cron corre en UTC. `"0 3 * * 1"` es lunes 03:00 UTC — aproximadamente domingo a la noche / lunes muy temprano en hora de Paraguay (UTC-3/UTC-4 según horario de verano). Ajustar el minuto/hora si el equipo comercial prefiere otro momento exacto; Vercel Cron no acepta zona horaria, solo UTC.

- [ ] **Step 2: Verificar que Vercel Cron manda el header esperado**

Vercel agrega automáticamente `Authorization: Bearer $CRON_SECRET` a las invocaciones de cron cuando `CRON_SECRET` está configurado como variable de entorno del proyecto en el dashboard de Vercel — no hace falta código adicional de nuestro lado más allá de leer `process.env.CRON_SECRET` (ya hecho en la Task 7). Confirmar en el dashboard de Vercel, después del deploy, que la variable `CRON_SECRET` está seteada en Production con el mismo valor que se generó en la Task 1.

- [ ] **Step 3: Commit**

```bash
git add vercel.json
git commit -m "Agregar Vercel Cron para el informe semanal de competencia"
```

---

### Task 10: Panel de informes dentro de la pantalla Copiloto

**Files:**
- Create: `src/components/copiloto/informes-panel.tsx`
- Modify: `src/app/copiloto/page.tsx`

- [ ] **Step 1: Crear el panel**

```typescript
"use client";

import * as React from "react";
import type { FilaInforme } from "@/lib/informes/db";

const ETIQUETA_DIMENSION: Record<string, string> = {
  precios: "Precios y modelos",
  noticias: "Noticias y lanzamientos",
  redes: "Redes sociales",
  tendencias: "Tendencias globales",
  resumen: "Resumen ejecutivo",
};

export function InformesPanel() {
  const [informes, setInformes] = React.useState<FilaInforme[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    fetch("/api/informes-competencia")
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else setInformes(data.informes);
      })
      .catch(() => setError("No se pudo contactar al servidor."));
  }, []);

  if (error) {
    return <p className="p-4 text-sm text-muted-foreground">{error}</p>;
  }
  if (informes === null) {
    return <p className="p-4 text-sm text-muted-foreground">Cargando informes…</p>;
  }
  if (informes.length === 0) {
    return (
      <p className="p-4 text-sm text-muted-foreground">
        Todavía no se generó ningún informe semanal. Se genera automáticamente
        cada semana; también se puede disparar a mano desde el dashboard de
        Vercel (Cron Jobs).
      </p>
    );
  }

  const porSemana = new Map<string, FilaInforme[]>();
  for (const i of informes) {
    porSemana.set(i.semana, [...(porSemana.get(i.semana) ?? []), i]);
  }

  return (
    <div className="flex flex-col gap-4 overflow-y-auto p-1">
      {[...porSemana.entries()].map(([semana, filas]) => (
        <div key={semana} className="flex flex-col gap-2 rounded-lg border bg-card p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Semana del {semana}
          </p>
          {filas.map((f) => (
            <details key={f.id} className="group">
              <summary className="cursor-pointer text-sm font-medium">
                {ETIQUETA_DIMENSION[f.dimension] ?? f.dimension}
              </summary>
              <div className="mt-2 flex flex-col gap-2 whitespace-pre-wrap text-sm text-muted-foreground">
                {f.contenido}
                {f.fuentes.length > 0 && (
                  <ul className="flex flex-col gap-1 text-xs">
                    {f.fuentes.map((s, i) => (
                      <li key={i}>
                        <a href={s.url} target="_blank" rel="noreferrer" className="underline">
                          {s.titulo || s.url}
                        </a>
                        {s.fecha && <span> · {s.fecha}</span>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </details>
          ))}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Verificar que compila**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Commit el panel**

```bash
git add src/components/copiloto/informes-panel.tsx
git commit -m "Agregar panel de informes semanales (UI de lectura)"
```

- [ ] **Step 4: Integrar en la pantalla Copiloto con pestañas**

El archivo actual `src/app/copiloto/page.tsx` es:

```typescript
import { NotaDato, PageHeader } from "@/components/dashboard/page-header";
import { ChatCopiloto } from "@/components/copiloto/chat";
import { getCobertura } from "@/lib/cadam/mercado";

export default function CopilotoPage() {
  const cobertura = getCobertura();
  const sinClave = !process.env.ANTHROPIC_API_KEY;

  return (
    <div className="flex h-full flex-col gap-5">
      <PageHeader
        titulo="Copiloto"
        descripcion="Preguntale a los datos en lenguaje natural. Responde consultando la misma base que los dashboards y cita las cifras."
        fuente={`Fuente: CADAM / DNRA · snapshot ${cobertura.snapshot ?? "—"} · sin acceso a internet.`}
      />

      {sinClave ? (
        <NotaDato>
          Falta configurar <code>ANTHROPIC_API_KEY</code> en el archivo{" "}
          <code>.env.local</code> de la app. Agregala y reiniciá el servidor
          para habilitar el copiloto.
        </NotaDato>
      ) : (
        <ChatCopiloto
          sugerencias={[
            "¿Cómo viene JETOUR contra CHERY este año?",
            "¿Qué pasó en mayo 2026? Fue un mes rarísimo",
            "Top 5 modelos PHEV y quién los importa",
            "¿En qué segmentos estamos más débiles?",
            "¿Quién ganó y quién perdió market share este año?",
          ]}
        />
      )}
    </div>
  );
}
```

Reemplazar por (agrega pestañas Chat/Informes con el componente `Tabs` ya existente en el repo, y actualiza la descripción de la fuente que ya no es cierta — el copiloto ahora sí sale a internet):

```typescript
import { NotaDato, PageHeader } from "@/components/dashboard/page-header";
import { ChatCopiloto } from "@/components/copiloto/chat";
import { InformesPanel } from "@/components/copiloto/informes-panel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getCobertura } from "@/lib/cadam/mercado";

export default function CopilotoPage() {
  const cobertura = getCobertura();
  const sinClave = !process.env.ANTHROPIC_API_KEY;

  return (
    <div className="flex h-full flex-col gap-5">
      <PageHeader
        titulo="Copiloto"
        descripcion="Preguntale a los datos en lenguaje natural. Cita las cifras internas por período y las de mercado/competencia por fuente y fecha."
        fuente={`Fuente interna: CADAM / DNRA · snapshot ${cobertura.snapshot ?? "—"}. Fuente externa: búsqueda web citada.`}
      />

      {sinClave ? (
        <NotaDato>
          Falta configurar <code>ANTHROPIC_API_KEY</code> en el archivo{" "}
          <code>.env.local</code> de la app. Agregala y reiniciá el servidor
          para habilitar el copiloto.
        </NotaDato>
      ) : (
        <Tabs defaultValue="chat" className="flex min-h-0 flex-1 flex-col gap-3">
          <TabsList>
            <TabsTrigger value="chat">Chat</TabsTrigger>
            <TabsTrigger value="informes">Informes semanales</TabsTrigger>
          </TabsList>
          <TabsContent value="chat" className="flex min-h-0 flex-1 flex-col">
            <ChatCopiloto
              sugerencias={[
                "¿Cómo viene JETOUR contra CHERY este año?",
                "¿Qué pasó en mayo 2026? Fue un mes rarísimo",
                "Top 5 modelos PHEV y quién los importa",
                "¿En qué segmentos estamos más débiles?",
                "¿Quién ganó y quién perdió market share este año?",
                "¿Qué dice el último informe de competencia sobre precios?",
              ]}
            />
          </TabsContent>
          <TabsContent value="informes" className="min-h-0 flex-1">
            <InformesPanel />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Verificar manualmente**

Run: `npm run dev`, abrir `/copiloto`.
Expected: dos pestañas, "Chat" (comportamiento igual a antes) e "Informes semanales" (muestra "Todavía no se generó ningún informe" si la tabla está vacía, sin errores en consola).

- [ ] **Step 6: Commit**

```bash
git add src/app/copiloto/page.tsx
git commit -m "Copiloto: agregar pestaña de informes semanales"
```

---

### Task 11: Verificación end-to-end del job semanal

**Files:** ninguno (solo verificación, requiere `ANTHROPIC_API_KEY`, `ZAI_API_KEY`, `POSTGRES_URL` y `CRON_SECRET` reales en `.env.local`)

**Nota sobre `ZAI_API_KEY`:** esta es la primera corrida real contra GLM-5.2
— además de confirmar que las 4 dimensiones se guardan, prestar atención a
si el bloque \`\`\`json de fuentes al final de cada respuesta parsea bien
(ver `extraerFuentes` en la Task 7). Si el modelo no sigue el formato pedido
de forma consistente, `fuentes` va a quedar vacío para esa dimensión — no es
un error fatal (el informe se guarda igual, solo sin links), pero es la
señal de que el prompt de instrucción de fuentes necesita ajuste.

- [ ] **Step 1: Confirmar que la ruta rechaza sin secreto**

Run: `npm run dev`, en otra terminal:
```bash
curl -i -X POST http://localhost:3000/api/informes-competencia/generar
```
Expected: `HTTP/1.1 401` con `{"error":"No autorizado"}`.

- [ ] **Step 2: Confirmar que la ruta rechaza con secreto incorrecto**

```bash
curl -i -X POST http://localhost:3000/api/informes-competencia/generar \
  -H "Authorization: Bearer secreto-incorrecto"
```
Expected: `401` igual que el Step 1.

- [ ] **Step 3: Invocar con el secreto correcto**

```bash
curl -i -X POST http://localhost:3000/api/informes-competencia/generar \
  -H "Authorization: Bearer $CRON_SECRET"
```
(sustituir `$CRON_SECRET` por el valor real de `.env.local`, o exportarlo antes: `export CRON_SECRET=...`)

Expected: `200`, con un JSON `{"semana": "YYYY-MM-DD", "generadas": [...], "fallidas": [...]}`. Puede tardar 1-3 minutos (4 llamadas con búsqueda web en paralelo + síntesis). Si `fallidas` no está vacío, revisar los logs del servidor para esa dimensión — no es necesariamente un blocker si es solo la dimensión "redes" (marcada en el spec como la más frágil).

- [ ] **Step 4: Verificar las filas en Postgres**

Run (con `POSTGRES_URL` en el entorno, usando el cliente `psql` o cualquier GUI de Postgres):
```sql
select semana, dimension, length(contenido) as largo, jsonb_array_length(fuentes) as n_fuentes, generado_en
from informes_competencia
order by generado_en desc
limit 10;
```
Expected: 4-5 filas nuevas (una por dimensión que haya tenido éxito, más la fila `resumen` si al menos una dimensión generó contenido), con `contenido` no vacío y `fuentes` con al menos algunas URLs (salvo que la búsqueda genuinamente no haya encontrado nada, cubierto por el prompt de la dimensión "redes").

- [ ] **Step 5: Verificar la UI**

Abrir `/copiloto` → pestaña "Informes semanales".
Expected: aparece una sección "Semana del YYYY-MM-DD" con las dimensiones generadas, cada una expandible (`<details>`) mostrando el contenido y las fuentes citadas como links.

- [ ] **Step 6: Confirmar en el chat que `leer_informe_competencia` los encuentra**

En la pestaña "Chat", preguntar: "¿Qué dice el último informe de competencia sobre precios?"
Expected: la respuesta usa el contenido recién generado (verificable porque coincide con lo guardado en Postgres), sin volver a salir a buscar en la web para esa pregunta.
