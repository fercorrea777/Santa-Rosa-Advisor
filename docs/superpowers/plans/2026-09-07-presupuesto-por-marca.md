# Presupuesto 2026 por marca — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** El objetivo de cada marca (presupuesto original del año y plan vigente mes a mes) entra al Advisor solo desde el Excel de Finanzas y se ve en `/operacion`, el inicio, Configuración, Cargas, el Copiloto y el Centro de Inteligencia.

**Architecture:** Un script de Hermes lee el `Budget*.xlsx` de la notebook y hace `POST /api/presupuesto`; la ruta escribe `metas_mensuales` (lo que `/operacion` ya compara) y un bloque `presupuesto` en `parametros.json`. La lógica de cumplimiento vive en funciones puras (`src/lib/informes/presupuesto.ts`); un `resumenPresupuesto` en `tablero.ts` alimenta inicio, Copiloto e Inteligencia con el mismo número.

**Tech Stack:** Next.js 16 App Router (Server Components), TypeScript, ECharts vía `EchartsAuto`, `parametros.json` en el volumen `/datos`, Python 3 + `openpyxl` en Hermes, Playwright para verificar producción.

Spec: `docs/superpowers/specs/2026-09-07-presupuesto-por-marca-design.md`.

## Global Constraints

- Nombres de marca = nombres CADAM tal como están en `marcas_propias` (`GREAT WALL`, `HAVAL`, `LEAPMOTOR`, `JMEV`, `XPENG`…).
- Un grupo presupuestado (`GREAT WALL + HAVAL`, `LEAPMOTOR + JMEV`) lleva su plan **una sola vez**, bajo la primera marca; las otras marcas del grupo quedan en `null` en `metas_mensuales`.
- El Excel manda: la carga pisa lo editado a mano en la grilla. Sin merge.
- Solo unidades. Nada de ventas USD, costo ni margen.
- Las rutas de ingesta de Hermes se agregan a la lista EXACTA de `src/proxy.ts`; si no, 401 «Sesión requerida».
- Credenciales nunca se imprimen: `HERMES_INGEST_SECRET` se lee de `~/.hermes/.env` y no viaja a logs ni a mensajes.
- Cada push va a `master` y despliega (Coolify). Se pushea recién con la verificación local hecha.
- Comandos bash complejos (heredocs, `$(...)`, bucles) los rechaza la guardia del worktree: scripts a archivo y `python3 archivo.py`.
- Sin suite de tests en el repo: verificación con `node` suelto sobre funciones puras, `npx tsc --noEmit`, `npx next build`, preview local y Playwright en producción.

---

## Estructura de archivos

| Archivo | Responsabilidad |
|---|---|
| `src/lib/cadam/config.ts` (modificar) | Tipos `GrupoPresupuesto` / `Presupuesto`, `getPresupuesto(anio)`, `guardarParametros` acepta `presupuesto` |
| `data/parametros.json`, `CADAM/parametros.json` (modificar) | XPENG como marca propia |
| `src/lib/informes/presupuesto.ts` (crear) | Funciones puras: plan del período, cumplimiento, % hecho, ritmo necesario, atrasados, facturado YTD y ritmo de últimos meses |
| `src/app/api/presupuesto/route.ts` (crear) | Ingesta con Bearer, validación todo-o-nada, escritura |
| `src/proxy.ts` (modificar) | `/api/presupuesto` en la lista de ingesta |
| `~/.hermes/scripts/advisor-presupuesto.py` + `.sh` (crear) | Lee el Excel, valida, empuja; estado por mtime+sha256 |
| `~/.hermes/cron/jobs.json` (modificar) | Job horario |
| `src/components/charts/plan-vs-facturado-chart.tsx` (crear) | Barras plan vs facturado por mes, meses cerrados sombreados, línea de referencia |
| `src/app/operacion/page.tsx` (modificar) | Tarjeta «Presupuesto 2026», filas por grupo, columnas nuevas, gráfico |
| `src/lib/informes/tablero.ts` (modificar) | `resumenPresupuesto(anio)` |
| `src/components/dashboard/acciones-semana.tsx` (modificar) | Tarjeta «Atrasados contra el plan» |
| `src/lib/informes/inteligencia-propia.ts` (modificar) | Ítem «Presupuesto 2026» |
| `src/app/api/copiloto/route.ts`, `src/lib/cadam/copiloto-contexto.ts`, `src/app/copiloto/page.tsx` (modificar) | Presupuesto en `que=ventas`, regla de ruteo, pregunta sugerida |
| `src/app/configuracion/page.tsx`, `metas.tsx` (modificar) | Aviso de origen y columna «Presupuesto anual» |
| `src/app/cargas/page.tsx` (modificar) | Fila «Presupuesto 2026 (Excel de Finanzas)» |
| `src/lib/informes/cobertura.ts` (modificar, Task 11) | `LANZAMIENTO` cuenta como en viaje; estados desconocidos se reportan |

---

### Task 1: Tipos, `getPresupuesto`, `guardarParametros` y XPENG

**Files:**
- Modify: `src/lib/cadam/config.ts:19-53` (interfaz `Parametros`, nueva función) y `:98-115` (`guardarParametros`)
- Modify: `data/parametros.json`, `CADAM/parametros.json` (`marcas_propias`)

**Interfaces:**
- Produces: `interface GrupoPresupuesto { marcas: string[]; hoja: string; plan: number[]; presupuesto_anual: number | null }`, `interface Presupuesto { anio; version; archivo; modificado; cargado_en; real_hasta_mes: number | null; total_compilado; grupos: GrupoPresupuesto[] }`, `getPresupuesto(anio: number): Presupuesto | null`, `guardarParametros(cambios: Partial<Pick<Parametros, "metas" | "competidores_clave" | "metas_mensuales" | "presupuesto">>)`.

- [ ] **Step 1: Agregar los tipos y la función a `config.ts`**

Después de `metas_mensuales?: …;` en `Parametros`, agregar:

```ts
  /** Presupuesto del año cargado desde el Excel de Finanzas por Hermes
   *  (POST /api/presupuesto). `grupos` dice qué marcas comparten un plan
   *  (GWM = GREAT WALL + HAVAL); el plan mensual de cada grupo también se
   *  escribe en `metas_mensuales` bajo su primera marca, que es lo que
   *  /operacion compara. El Excel manda: cada carga pisa el bloque entero. */
  presupuesto?: Presupuesto;
```

Antes de `export interface Parametros`, agregar:

```ts
export interface GrupoPresupuesto {
  /** Nombres CADAM. La primera lleva la fila en metas_mensuales. */
  marcas: string[];
  /** Hoja del Excel de la que salió ("Venta Unidades Jetour"). */
  hoja: string;
  /** Plan vigente, 12 enteros (enero a diciembre). */
  plan: number[];
  /** Columna P del Excel: presupuesto original del año. null si no está. */
  presupuesto_anual: number | null;
}

export interface Presupuesto {
  anio: number;
  version: string;
  archivo: string;
  /** mtime del archivo, ISO. */
  modificado: string;
  /** Cuándo lo recibió el Advisor, ISO. */
  cargado_en: string;
  /** Último mes cerrado según el Excel (Hoja1!A3): hasta ahí el plan es el
   *  real. null si el archivo no lo trae. */
  real_hasta_mes: number | null;
  /** Compilado!Total Unidades, para control. */
  total_compilado: number;
  grupos: GrupoPresupuesto[];
}
```

Después de `getMetasMensuales`, agregar:

```ts
/** El presupuesto cargado, solo si es del año pedido: otro año se trata
 *  como ausente, no se prorratea ni se reusa. */
export function getPresupuesto(anio: number): Presupuesto | null {
  const p = getParametros().presupuesto;
  return p && p.anio === anio && Array.isArray(p.grupos) ? p : null;
}
```

En `guardarParametros`, cambiar la firma y agregar la línea:

```ts
export function guardarParametros(
  cambios: Partial<Pick<Parametros, "metas" | "competidores_clave" | "metas_mensuales" | "presupuesto">>
): void {
  …
  if (cambios.metas_mensuales) actual.metas_mensuales = cambios.metas_mensuales;
  if (cambios.presupuesto) actual.presupuesto = cambios.presupuesto;
```

- [ ] **Step 2: XPENG como marca propia**

En `data/parametros.json` y en `CADAM/parametros.json`, agregar al final de `marcas_propias`:

```json
{ "marca_cadam": "XPENG", "grupo": "Xpeng", "submarca": null }
```

Con un script Python en el scratchpad (`json.load` → append si no está → `json.dump(indent=2, ensure_ascii=False)`), no a mano: los dos archivos tienen que quedar idénticos en ese bloque.

- [ ] **Step 3: Verificar**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: sin salida.

Run: `python3 -c "import json; d=json.load(open('data/parametros.json')); print([m['marca_cadam'] for m in d['marcas_propias']])"`
Expected: la lista termina en `'XPENG'`.

- [ ] **Step 4: Commit**

```bash
git add src/lib/cadam/config.ts data/parametros.json CADAM/parametros.json
git commit -m "Presupuesto: tipos en parametros.json y XPENG como marca propia"
```

---

### Task 2: Lógica pura en `src/lib/informes/presupuesto.ts`

**Files:**
- Create: `src/lib/informes/presupuesto.ts`
- Create (scratchpad, no se commitea): `verificar-presupuesto.mjs`

**Interfaces:**
- Consumes: nada del repo (tipos estructurales propios, para poder correrlo con `node` suelto).
- Produces:
  - `interface PlanPeriodo { plan: number; planAbiertos: number; abiertos: number; cerrados: number }`
  - `planPeriodo(plan: number[], mesDesde: number, mesHasta: number, realHastaMes: number | null): PlanPeriodo`
  - `cumplimiento(facturadoAbiertos: number, planAbiertos: number, abiertos: number): number | null`
  - `porcentajeHecho(facturadoYtd: number, presupuestoAnual: number | null): number | null`
  - `ritmoNecesario(plan: number[], facturadoYtd: number, ultimoMesCerrado: number): number | null`
  - `interface Atrasado { marcas: string[]; ritmo: number; necesario: number; faltaPorMes: number }`
  - `atrasados(grupos: { marcas: string[]; plan: number[] }[], facturadoYtdDe: (marcas: string[]) => number, ritmoDe: (marcas: string[]) => number, ultimoMesCerrado: number): Atrasado[]`
  - `facturadoEntre(ventas: { periodo: string; marca: string; unidades: number }[], marcas: string[], anio: number, desde: number, hasta: number): number`
  - `ritmoUltimosMeses(ventas, marcas, anio, ultimoMesCerrado, n = 3): number`

- [ ] **Step 1: Escribir el módulo**

```ts
/**
 * Cumplimiento del presupuesto, en funciones puras.
 *
 * Dos números distintos, a propósito (spec 07/09/2026):
 *  - PLAN VIGENTE: el ejercicio de Finanzas mes a mes. En los meses que ya
 *    cerraron (hasta `realHastaMes`) el plan ES el real, así que ahí no hay
 *    cumplimiento que medir: se mide solo sobre los meses abiertos.
 *  - PRESUPUESTO ANUAL: la cifra original del año, sin apertura mensual.
 *    Contra eso se dice "qué parte del año ya se hizo".
 *
 * Sin acceso a datos ni imports del repo: se verifica con `node` suelto.
 */

export interface PlanPeriodo {
  /** Suma del plan en los meses del filtro. */
  plan: number;
  /** Suma del plan solo en los meses ABIERTOS del filtro. */
  planAbiertos: number;
  abiertos: number;
  cerrados: number;
}

const mesValido = (m: number) => Number.isInteger(m) && m >= 1 && m <= 12;

export function planPeriodo(
  plan: number[],
  mesDesde: number,
  mesHasta: number,
  realHastaMes: number | null
): PlanPeriodo {
  const salida: PlanPeriodo = { plan: 0, planAbiertos: 0, abiertos: 0, cerrados: 0 };
  for (let m = mesDesde; m <= mesHasta; m++) {
    if (!mesValido(m)) continue;
    const v = plan[m - 1] ?? 0;
    salida.plan += v;
    if (realHastaMes !== null && m <= realHastaMes) {
      salida.cerrados++;
    } else {
      salida.abiertos++;
      salida.planAbiertos += v;
    }
  }
  return salida;
}

/** facturado / plan sobre los meses abiertos; null si no hay meses abiertos
 *  o el plan abierto es cero (nada contra qué medir). */
export function cumplimiento(
  facturadoAbiertos: number,
  planAbiertos: number,
  abiertos: number
): number | null {
  if (abiertos <= 0 || planAbiertos <= 0) return null;
  return facturadoAbiertos / planAbiertos;
}

export function porcentajeHecho(
  facturadoYtd: number,
  presupuestoAnual: number | null
): number | null {
  if (!presupuestoAnual || presupuestoAnual <= 0) return null;
  return facturadoYtd / presupuestoAnual;
}

/** Autos por mes que hacen falta, en los meses que quedan, para llegar al
 *  total del plan. null si no quedan meses. Nunca negativo: si el plan ya
 *  se cumplió, lo que falta por mes es cero. */
export function ritmoNecesario(
  plan: number[],
  facturadoYtd: number,
  ultimoMesCerrado: number
): number | null {
  const restantes = 12 - ultimoMesCerrado;
  if (restantes <= 0) return null;
  const total = plan.reduce((s, v) => s + (v ?? 0), 0);
  return Math.max(0, (total - facturadoYtd) / restantes);
}

export interface Atrasado {
  marcas: string[];
  /** Autos por mes, últimos meses cerrados. */
  ritmo: number;
  /** Autos por mes que pide el plan para lo que queda. */
  necesario: number;
  faltaPorMes: number;
}

export function atrasados(
  grupos: { marcas: string[]; plan: number[] }[],
  facturadoYtdDe: (marcas: string[]) => number,
  ritmoDe: (marcas: string[]) => number,
  ultimoMesCerrado: number
): Atrasado[] {
  const salida: Atrasado[] = [];
  for (const g of grupos) {
    const necesario = ritmoNecesario(g.plan, facturadoYtdDe(g.marcas), ultimoMesCerrado);
    if (necesario === null) continue;
    const ritmo = ritmoDe(g.marcas);
    if (ritmo < necesario) {
      salida.push({ marcas: g.marcas, ritmo, necesario, faltaPorMes: necesario - ritmo });
    }
  }
  return salida.sort((a, b) => b.faltaPorMes - a.faltaPorMes);
}

/** Unidades facturadas de esas marcas entre dos meses (inclusive) de un
 *  año. `periodo` viene como "AAAA-MM". */
export function facturadoEntre(
  ventas: { periodo: string; marca: string; unidades: number }[],
  marcas: string[],
  anio: number,
  desde: number,
  hasta: number
): number {
  let total = 0;
  for (const v of ventas) {
    if (!marcas.includes(v.marca)) continue;
    const a = Number(v.periodo.slice(0, 4));
    const m = Number(v.periodo.slice(5, 7));
    if (a === anio && m >= desde && m <= hasta) total += v.unidades;
  }
  return total;
}

/** Autos por mes en los últimos `n` meses cerrados (o los que haya si el
 *  año recién empieza). Cero si no hay ningún mes cerrado. */
export function ritmoUltimosMeses(
  ventas: { periodo: string; marca: string; unidades: number }[],
  marcas: string[],
  anio: number,
  ultimoMesCerrado: number,
  n = 3
): number {
  if (ultimoMesCerrado < 1) return 0;
  const desde = Math.max(1, ultimoMesCerrado - n + 1);
  const meses = ultimoMesCerrado - desde + 1;
  return facturadoEntre(ventas, marcas, anio, desde, ultimoMesCerrado) / meses;
}
```

- [ ] **Step 2: Escribir la verificación con `node` suelto** (scratchpad `verificar-presupuesto.mjs`)

```js
import assert from "node:assert/strict";
import {
  atrasados, cumplimiento, facturadoEntre, planPeriodo, porcentajeHecho, ritmoNecesario,
  ritmoUltimosMeses,
} from "<ruta-absoluta-del-worktree>/src/lib/informes/presupuesto.ts";

const plan = [79, 78, 70, 135, 113, 96, 92, 109, 113, 106, 108, 106]; // Jetour v8.3

// Período todo cerrado: no hay cumplimiento que medir.
let p = planPeriodo(plan, 1, 5, 5);
assert.deepEqual(p, { plan: 475, planAbiertos: 0, abiertos: 0, cerrados: 5 });
assert.equal(cumplimiento(475, p.planAbiertos, p.abiertos), null);

// Período mixto: cerrado hasta mayo, filtro ene-jul.
p = planPeriodo(plan, 1, 7, 5);
assert.deepEqual(p, { plan: 663, planAbiertos: 188, abiertos: 2, cerrados: 5 });
assert.equal(cumplimiento(94, 188, 2), 0.5);

// Sin dato de último mes cerrado: todo abierto.
p = planPeriodo(plan, 1, 12, null);
assert.equal(p.abiertos, 12);
assert.equal(p.planAbiertos, 1205);

// Presupuesto anual.
assert.equal(porcentajeHecho(571, 750), 571 / 750);
assert.equal(porcentajeHecho(103, null), null);

// Ritmo necesario: plan 1205, facturado 571 a mayo -> (1205-571)/7.
assert.equal(ritmoNecesario(plan, 571, 5), (1205 - 571) / 7);
assert.equal(ritmoNecesario(plan, 571, 12), null);
assert.equal(ritmoNecesario(plan, 2000, 5), 0);

// Atrasados: ritmo 80 < necesario 90,57 -> atrasado; ritmo 100 no.
const grupos = [
  { marcas: ["JETOUR"], plan },
  { marcas: ["GREAT WALL", "HAVAL"], plan: Array(12).fill(50) },
];
const a = atrasados(grupos, (m) => (m[0] === "JETOUR" ? 571 : 250), (m) => (m[0] === "JETOUR" ? 80 : 100), 5);
assert.equal(a.length, 1);
assert.equal(a[0].marcas[0], "JETOUR");
assert.ok(a[0].faltaPorMes > 10 && a[0].faltaPorMes < 11);

// facturadoEntre y ritmo.
const ventas = [
  { periodo: "2026-03", marca: "JETOUR", unidades: 10 },
  { periodo: "2026-04", marca: "JETOUR", unidades: 20 },
  { periodo: "2026-05", marca: "JETOUR", unidades: 30 },
  { periodo: "2026-05", marca: "HAVAL", unidades: 5 },
  { periodo: "2025-05", marca: "JETOUR", unidades: 99 },
];
assert.equal(facturadoEntre(ventas, ["JETOUR"], 2026, 1, 5), 60);
assert.equal(facturadoEntre(ventas, ["GREAT WALL", "HAVAL"], 2026, 1, 12), 5);
assert.equal(ritmoUltimosMeses(ventas, ["JETOUR"], 2026, 5), 20);
assert.equal(ritmoUltimosMeses(ventas, ["JETOUR"], 2026, 2), 0);
assert.equal(ritmoUltimosMeses(ventas, ["JETOUR"], 2026, 0), 0);
console.log("presupuesto.ts: 20 comprobaciones OK");
```

- [ ] **Step 3: Correrla**

Run: `node <scratchpad>/verificar-presupuesto.mjs` (Node 24 quita los tipos solo; el módulo no importa nada del repo).
Expected: `presupuesto.ts: 20 comprobaciones OK`.

- [ ] **Step 4: tsc y commit**

Run: `npx tsc --noEmit -p tsconfig.json` → sin salida.

```bash
git add src/lib/informes/presupuesto.ts
git commit -m "Presupuesto: cumplimiento, % hecho y atrasados en funciones puras"
```

---

### Task 3: Ruta `POST /api/presupuesto` y lista del proxy

**Files:**
- Create: `src/app/api/presupuesto/route.ts`
- Modify: `src/proxy.ts:55-61` (lista `RUTAS_INGESTA` o como se llame el array con `/api/datos-propios`)

**Interfaces:**
- Consumes: `Presupuesto`, `GrupoPresupuesto`, `getParametros`, `guardarParametros`, `getMarcasPropiasSet` de `@/lib/cadam/config`.
- Produces: `POST /api/presupuesto` → 200 `{ ok, anio, version, grupos, plan_total, presupuesto_total }`; 400/401/500 `{ error }`.

- [ ] **Step 1: Escribir la ruta**

```ts
import { NextResponse } from "next/server";
import {
  getMarcasPropiasSet, getParametros, guardarParametros,
  type GrupoPresupuesto, type Presupuesto,
} from "@/lib/cadam/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Entrada del presupuesto por marca que Hermes lee del Excel de Finanzas
 * (advisor-presupuesto.py). Mismo cerrojo que /api/datos-propios: Bearer
 * con HERMES_INGEST_SECRET. Todo o nada: una fila mala rechaza la carga
 * entera, porque una meta a medias es peor que la anterior.
 *
 * Escribe dos cosas en parametros.json: `metas_mensuales[anio]` (lo que
 * /operacion y la grilla de Configuración ya usan) y el bloque
 * `presupuesto` (grupos, presupuesto anual, versión, fechas). El Excel
 * manda: lo editado a mano en la grilla se pisa acá.
 */

const MAX_GRUPOS = 20;
const MAX_UNIDADES = 100_000;

function texto(v: unknown, max = 200): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t && t.length <= max ? t : null;
}

function entero(v: unknown, min: number, max: number): number | null {
  const n = Number(v);
  return Number.isInteger(n) && n >= min && n <= max ? n : null;
}

function autorizado(request: Request): boolean {
  const secreto = process.env.HERMES_INGEST_SECRET;
  return !!secreto && request.headers.get("authorization") === `Bearer ${secreto}`;
}

const malo = (error: string, status = 400) => NextResponse.json({ error }, { status });

export async function POST(request: Request) {
  if (!autorizado(request)) return malo("No autorizado", 401);
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return malo("Body inválido: se esperaba JSON");
  }

  const anio = entero(body.anio, 2020, 2100);
  const version = texto(body.version);
  const archivo = texto(body.archivo);
  const modificado = texto(body.modificado, 40);
  const totalCompilado = entero(body.total_compilado, 0, 10 * MAX_UNIDADES);
  const realHastaMes = body.real_hasta_mes === null ? null : entero(body.real_hasta_mes, 1, 12);
  if (!anio || !version || !archivo || !modificado || totalCompilado === null) {
    return malo("Se esperaban anio, version, archivo, modificado y total_compilado");
  }
  if (realHastaMes === undefined || (body.real_hasta_mes !== null && realHastaMes === null)) {
    return malo("real_hasta_mes tiene que ser 1–12 o null");
  }
  if (Number.isNaN(Date.parse(modificado))) return malo("modificado no es una fecha ISO");
  if (!Array.isArray(body.grupos) || !body.grupos.length || body.grupos.length > MAX_GRUPOS) {
    return malo(`grupos tiene que ser un array de 1 a ${MAX_GRUPOS}`);
  }

  const propias = getMarcasPropiasSet();
  const vistas = new Set<string>();
  const grupos: GrupoPresupuesto[] = [];
  for (const [i, crudo] of body.grupos.entries()) {
    const g = crudo as Record<string, unknown>;
    if (!Array.isArray(g.marcas) || !g.marcas.length || g.marcas.length > 4) {
      return malo(`grupos[${i}]: marcas tiene que ser un array de 1 a 4`);
    }
    const marcas: string[] = [];
    for (const m of g.marcas) {
      const nombre = texto(m, 60)?.toUpperCase();
      if (!nombre) return malo(`grupos[${i}]: marca vacía`);
      if (!propias.has(nombre)) {
        return malo(`grupos[${i}]: "${nombre}" no está en marcas_propias de parametros.json`);
      }
      if (vistas.has(nombre)) return malo(`grupos[${i}]: "${nombre}" aparece en dos grupos`);
      vistas.add(nombre);
      marcas.push(nombre);
    }
    const hoja = texto(g.hoja) ?? marcas.join(" + ");
    if (!Array.isArray(g.plan) || g.plan.length !== 12) {
      return malo(`grupos[${i}]: plan tiene que tener exactamente 12 meses`);
    }
    const plan: number[] = [];
    for (const [j, v] of g.plan.entries()) {
      const n = entero(v, 0, MAX_UNIDADES);
      if (n === null) return malo(`grupos[${i}].plan[${j}]: "${String(v)}" no es un entero 0–${MAX_UNIDADES}`);
      plan.push(n);
    }
    const presupuestoAnual =
      g.presupuesto_anual === null || g.presupuesto_anual === undefined
        ? null
        : entero(g.presupuesto_anual, 0, MAX_UNIDADES);
    if (presupuestoAnual === null && g.presupuesto_anual != null) {
      return malo(`grupos[${i}]: presupuesto_anual tiene que ser entero 0–${MAX_UNIDADES} o null`);
    }
    grupos.push({ marcas, hoja, plan, presupuesto_anual: presupuestoAnual });
  }

  const presupuesto: Presupuesto = {
    anio, version, archivo, modificado,
    cargado_en: new Date().toISOString(),
    real_hasta_mes: realHastaMes,
    total_compilado: totalCompilado,
    grupos,
  };
  // El plan de cada grupo va UNA vez, bajo su primera marca; las otras
  // quedan en null. Así la grilla y /operacion no cuentan una meta dos veces.
  const metasAnio: Record<string, (number | null)[]> = {};
  for (const g of grupos) {
    metasAnio[g.marcas[0]] = g.plan;
    for (const m of g.marcas.slice(1)) metasAnio[m] = Array(12).fill(null);
  }
  try {
    const actual = getParametros().metas_mensuales ?? {};
    guardarParametros({
      metas_mensuales: { ...actual, [String(anio)]: metasAnio },
      presupuesto,
    });
  } catch (e) {
    console.error("POST /api/presupuesto:", e);
    return malo("No se pudo escribir parametros.json en el servidor", 500);
  }
  return NextResponse.json({
    ok: true, anio, version, grupos: grupos.length,
    plan_total: grupos.reduce((s, g) => s + g.plan.reduce((a, b) => a + b, 0), 0),
    presupuesto_total: grupos.reduce((s, g) => s + (g.presupuesto_anual ?? 0), 0),
  });
}
```

- [ ] **Step 2: Agregar `"/api/presupuesto"` a la lista exacta de `src/proxy.ts`** (junto a `"/api/demanda-bitrix"`).

- [ ] **Step 3: Verificar contra el dev server**

Crear `.env.local` (está en `.gitignore`) con `HERMES_INGEST_SECRET=prueba-local`. Levantar el preview. Con un script Python en el scratchpad que haga `urllib.request` a `http://localhost:<puerto>/api/presupuesto`:
- Sin Bearer → 401.
- Con Bearer y `grupos: [{ marcas: ["NOEXISTE"], … }]` → 400 nombrando la marca.
- Con Bearer y el cuerpo de ejemplo del spec (JETOUR, GREAT WALL+HAVAL, RENAULT) → 200 con `grupos: 3`, y `data/parametros.json` queda con `presupuesto` y `metas_mensuales["2026"]` (JETOUR con 12 números, HAVAL con 12 null).

Después de la prueba, restaurar `data/parametros.json` (`git checkout data/parametros.json`) para no commitear datos de prueba.

- [ ] **Step 4: tsc, build y commit**

```bash
git add src/app/api/presupuesto/route.ts src/proxy.ts
git commit -m "Presupuesto: ruta de ingesta desde Hermes"
```

---

### Task 4: Script de Hermes `advisor-presupuesto.py` + `.sh`

**Files:**
- Create: `~/.hermes/scripts/advisor-presupuesto.py`
- Create: `~/.hermes/scripts/advisor-presupuesto.sh`

**Interfaces:**
- Produces: el JSON del spec §4.1 hacia `POST https://advisor.santarosa.lat/api/presupuesto`. Estado en `~/.hermes/state/advisor-presupuesto.json`.

- [ ] **Step 1: Escribir el script**

```python
#!/usr/bin/env python3
"""Lee el Budget de Finanzas (Excel) y empuja al Advisor el plan por marca.

Uso:
    advisor-presupuesto.py              # empuja si el archivo cambió
    advisor-presupuesto.py --dry-run    # muestra la tabla y no manda
    advisor-presupuesto.py --force      # empuja aunque no haya cambiado

Busca el `Budget*.xlsx` más nuevo en ~/Escritorio/DASHBOARD FERNANDO/. Lee,
de cada hoja `Venta(s) Unidades <marca>`, la fila `Volumen`: doce meses
(C..N) y el presupuesto anual original (P). Controla que la suma de todas
las hojas cierre con `Compilado!Total Unidades`; si no cierra, no empuja.

Mismo cerrojo que advisor-datos-propios.py: HERMES_INGEST_SECRET en
~/.hermes/.env. Solo viajan unidades: nada de ventas, costos ni márgenes.
"""
from __future__ import annotations

import hashlib
import json
import os
import re
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

import openpyxl

ENDPOINT = "https://advisor.santarosa.lat/api/presupuesto"
# Cloudflare rechaza el User-Agent por defecto de urllib con 403 "error code: 1010".
UA = "hermes-advisor/1.0 (+https://advisor.santarosa.lat)"
HERMES_ENV = Path.home() / ".hermes" / ".env"
CARPETA = Path.home() / "Escritorio" / "DASHBOARD FERNANDO"
ESTADO = Path.home() / ".hermes" / "state" / "advisor-presupuesto.json"
ANIO = 2026

# Hoja del Excel -> marcas del Advisor (nombres CADAM). Renew va con [] :
# se lee para el control contra Compilado y no se empuja (usados, Cars no
# los manda por marca y mes).
HOJAS: dict[str, list[str]] = {
    "Venta Unidades Jetour": ["JETOUR"],
    "Ventas Unidades GWM": ["GREAT WALL", "HAVAL"],
    "Ventas Unidades Mistubishi": ["MITSUBISHI"],
    "Ventas Unidades Leap Y JMEV": ["LEAPMOTOR", "JMEV"],
    "Ventas Unidades JAC": ["JAC"],
    "Ventas Unidades SOUEAST": ["SOUEAST"],
    "Ventas Unidades ZEEKR": ["ZEEKR"],
    "Venta Unidades Renault PY": ["RENAULT"],
    "Ventas Unidades XPENG": ["XPENG"],
    "Ventas Unidades Renew": [],
}
COL_MESES = list(range(3, 15))  # C..N
COL_PRESUPUESTO = 16            # P
FILAS_A_BUSCAR = 40


def secreto() -> str:
    if HERMES_ENV.exists():
        for l in HERMES_ENV.read_text(encoding="utf-8", errors="replace").splitlines():
            if l.startswith("HERMES_INGEST_SECRET="):
                return l.split("=", 1)[1].strip().strip('"').strip("'")
    s = os.environ.get("HERMES_INGEST_SECRET")
    if not s:
        raise SystemExit("🚨 Falta HERMES_INGEST_SECRET en ~/.hermes/.env")
    return s


def archivo_mas_nuevo() -> Path | None:
    candidatos = [
        p for p in CARPETA.glob("Budget*.xlsx") if not p.name.startswith("~$")
    ]
    if not candidatos:
        return None
    return max(candidatos, key=lambda p: p.stat().st_mtime)


def sha256(p: Path) -> str:
    h = hashlib.sha256()
    with p.open("rb") as f:
        for bloque in iter(lambda: f.read(1 << 20), b""):
            h.update(bloque)
    return h.hexdigest()


def leer_estado() -> dict:
    try:
        return json.loads(ESTADO.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}


def entero(v: object) -> int:
    if v is None or v == "":
        return 0
    n = float(v)
    if n < 0 or abs(n - round(n)) > 1e-6:
        raise ValueError(f"{v!r} no es un entero >= 0")
    return int(round(n))


def fila_volumen(ws) -> int:
    for fila in range(1, FILAS_A_BUSCAR + 1):
        if str(ws.cell(row=fila, column=1).value or "").strip().lower() == "volumen":
            return fila
    raise SystemExit(f"🚨 La hoja {ws.title!r} no tiene fila 'Volumen' en las primeras {FILAS_A_BUSCAR}.")


def leer_hoja(ws) -> tuple[list[int], int | None]:
    f = fila_volumen(ws)
    try:
        plan = [entero(ws.cell(row=f, column=c).value) for c in COL_MESES]
    except ValueError as e:
        raise SystemExit(f"🚨 {ws.title!r}, fila {f}: {e}")
    crudo = ws.cell(row=f, column=COL_PRESUPUESTO).value
    presupuesto = None if crudo is None or crudo == "" else entero(crudo)
    return plan, presupuesto


def total_compilado(wb) -> int:
    ws = wb["Compilado"]
    for fila in range(1, FILAS_A_BUSCAR + 1):
        if str(ws.cell(row=fila, column=1).value or "").strip().lower() == "total unidades":
            return entero(ws.cell(row=fila, column=COL_PRESUPUESTO).value)
    raise SystemExit("🚨 Compilado no tiene fila 'Total Unidades'.")


def real_hasta_mes(wb) -> int | None:
    try:
        v = wb["Hoja1"].cell(row=3, column=1).value
    except KeyError:
        return None
    return v.month if isinstance(v, datetime) else None


def version_de(nombre: str) -> str:
    m = re.search(r"EJERCICIO\s+(.+?)\.xlsx$", nombre, re.IGNORECASE)
    return m.group(1).strip() if m else nombre


def armar(archivo: Path) -> dict:
    wb = openpyxl.load_workbook(archivo, data_only=True, read_only=True)
    faltan = [h for h in HOJAS if h not in wb.sheetnames]
    if faltan:
        raise SystemExit(f"🚨 Faltan hojas en {archivo.name}: {', '.join(faltan)}")
    grupos = []
    suma = 0
    for hoja, marcas in HOJAS.items():
        plan, presupuesto = leer_hoja(wb[hoja])
        suma += sum(plan)
        if marcas:
            grupos.append({"marcas": marcas, "hoja": hoja, "plan": plan, "presupuesto_anual": presupuesto})
    control = total_compilado(wb)
    if suma != control:
        raise SystemExit(
            f"🚨 Las hojas suman {suma} y Compilado dice {control} (diferencia {suma - control}): "
            "archivo a medio guardar o una hoja nueva. No se empuja."
        )
    mtime = datetime.fromtimestamp(archivo.stat().st_mtime, tz=timezone.utc).astimezone()
    return {
        "anio": ANIO,
        "version": version_de(archivo.name),
        "archivo": archivo.name,
        "modificado": mtime.isoformat(timespec="seconds"),
        "real_hasta_mes": real_hasta_mes(wb),
        "total_compilado": control,
        "grupos": grupos,
    }


def mostrar(cuerpo: dict) -> None:
    print(f"{cuerpo['archivo']} · versión {cuerpo['version']} · modificado {cuerpo['modificado']}")
    print(f"real hasta mes {cuerpo['real_hasta_mes']} · control Compilado {cuerpo['total_compilado']}")
    print(f"{'grupo':22s} {'plan':>5s} {'ppto':>5s}  meses")
    for g in cuerpo["grupos"]:
        nombre = " + ".join(g["marcas"])
        ppto = g["presupuesto_anual"] if g["presupuesto_anual"] is not None else "—"
        print(f"{nombre:22s} {sum(g['plan']):5d} {str(ppto):>5s}  {' '.join(f'{v:3d}' for v in g['plan'])}")
    print(f"{'total':22s} {sum(sum(g['plan']) for g in cuerpo['grupos']):5d}")


def pedir(cuerpo: dict, clave: str) -> dict:
    datos = json.dumps(cuerpo).encode("utf-8")
    req = urllib.request.Request(ENDPOINT, data=datos, method="POST")
    req.add_header("Authorization", f"Bearer {clave}")
    req.add_header("User-Agent", UA)
    req.add_header("Content-Type", "application/json")
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.loads(r.read().decode("utf-8"))


def main() -> int:
    dry = "--dry-run" in sys.argv
    force = "--force" in sys.argv
    archivo = archivo_mas_nuevo()
    if archivo is None:
        print(f"sin archivo Budget*.xlsx en {CARPETA}")
        return 0
    estado = leer_estado()
    huella = sha256(archivo)
    mtime = archivo.stat().st_mtime
    if not dry and not force and estado.get("sha256") == huella and estado.get("mtime") == mtime:
        print(f"sin cambios: {archivo.name} ya se empujó el {estado.get('empujado_en')}")
        return 0
    cuerpo = armar(archivo)
    mostrar(cuerpo)
    if dry:
        return 0
    clave = secreto()
    try:
        r = pedir(cuerpo, clave)
    except urllib.error.HTTPError as e:
        detalle = e.read().decode("utf-8", "replace")[:300]
        raise SystemExit(f"🚨 El Advisor rechazó el push (HTTP {e.code}): {detalle}")
    except (urllib.error.URLError, TimeoutError, OSError) as e:
        raise SystemExit(f"🚨 No se pudo contactar el Advisor: {e}")
    ESTADO.parent.mkdir(parents=True, exist_ok=True)
    ESTADO.write_text(json.dumps({
        "archivo": archivo.name, "mtime": mtime, "sha256": huella,
        "version": cuerpo["version"],
        "empujado_en": datetime.now().astimezone().isoformat(timespec="seconds"),
    }, indent=2), encoding="utf-8")
    print(f"📊 Presupuesto {r.get('version')} cargado en el Advisor: {r.get('grupos')} grupos, "
          f"plan {r.get('plan_total')} u., presupuesto {r.get('presupuesto_total')} u.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 2: El wrapper `advisor-presupuesto.sh`** (mismo esqueleto que `advisor-datos-propios.sh`: carga `~/.hermes/.env`, corre el `.py` con `"$@"`, sale 0 aunque el push falle porque el estado no se guardó y la próxima corrida reintenta). `chmod +x` a los dos.

- [ ] **Step 3: Dry-run contra el archivo real**

Run: `python3 ~/.hermes/scripts/advisor-presupuesto.py --dry-run`
Expected: versión `VF 8.3`, real hasta mes `5`, control `3873`, 9 grupos, total 3.587 (3.873 menos los 286 de Renew), presupuestos 750/650/200/120/250/200/30/—/—.

- [ ] **Step 4: Probar el push contra el dev server** cambiando `ENDPOINT` por variable de entorno opcional: agregar al script `ENDPOINT = os.environ.get("ADVISOR_PRESUPUESTO_ENDPOINT", "https://advisor.santarosa.lat/api/presupuesto")` y correr con `ADVISOR_PRESUPUESTO_ENDPOINT=http://localhost:<puerto>/api/presupuesto HERMES_INGEST_SECRET=prueba-local python3 … --force`. Expected: `📊 Presupuesto VF 8.3 cargado…: 9 grupos, plan 3587 u., presupuesto 2200 u.`. Después, `git checkout data/parametros.json`.

No hay commit de repo en esta tarea (los scripts viven en `~/.hermes/scripts`, fuera del repo).

---

### Task 5: `/operacion`: tarjeta, filas por grupo y columnas

**Files:**
- Modify: `src/app/operacion/page.tsx` — imports (`:1-30`), bloque de metas (`:179-232`), tabla (`:841-1004`), tarjeta «Meta del período» (`:610-628`).

**Interfaces:**
- Consumes: `getPresupuesto`, `planPeriodo`, `cumplimiento`, `porcentajeHecho`, `facturadoEntre`, `ritmoUltimosMeses`.
- Produces: `filas[]` con `{ clave, etiqueta, marcas, facturado, matriculado, share, stock, reservadas, mesesStock, meta, metaAbiertos, facturadoAbiertos, abiertos, metaAnio, presupuestoAnual, facturadoYtd, hecho, proyeccion, pauta, esGrupo }`; `mesCerrado`, `presupuesto`, `hayPresupuesto` para Task 6.

- [ ] **Step 1: Imports**

```ts
import { getAsesoresMayoristasSet, getMetasMensuales, getParametros, getPresupuesto } from "@/lib/cadam/config";
import {
  cumplimiento, facturadoEntre, planPeriodo, porcentajeHecho, ritmoUltimosMeses,
} from "@/lib/informes/presupuesto";
import { PlanVsFacturadoChart } from "@/components/charts/plan-vs-facturado-chart";
```

- [ ] **Step 2: Reemplazar el bloque de metas y las filas** (desde `// --- metas:` hasta el `.sort((a, b) => b.facturado - a.facturado);` de `filas`)

```ts
  // --- metas: plan vigente por marca y mes (Excel de Finanzas vía Hermes, o
  // la grilla de Configuración) y presupuesto anual original -------------
  const metasAnio = getMetasMensuales(f.anio);
  const hayMetas = Object.keys(metasAnio).length > 0;
  const presupuesto = getPresupuesto(f.anio);
  const hayPresupuesto = presupuesto !== null;
  const realHastaMes = presupuesto?.real_hasta_mes ?? null;
  const enMeses = (periodoTxt: string, anio: number, desde: number, hasta: number) => {
    const [a, m] = periodoTxt.split("-").map(Number);
    return a === anio && m >= desde && m <= hasta;
  };
  // Siempre sobre TODAS las facturas, no las filtradas por marca: una fila
  // de grupo (GREAT WALL + HAVAL) suma sus marcas aunque el filtro sea una.
  const sumaMeses = (marcas: string[], anio: number, desde: number, hasta: number) =>
    facturadoEntre(ventasCrudas, marcas, anio, desde, hasta);
  const hoyIso = hoyEnAsuncion();
  const mesCerrado = Number(hoyIso.slice(5, 7)) - 1;
  const proyectar = f.anio === Number(hoyIso.slice(0, 4)) && mesCerrado >= 1;
  const proyeccionDe = (marcas: string[]): number | null => {
    if (!proyectar) return null;
    const ytd = sumaMeses(marcas, f.anio, 1, mesCerrado);
    const lyYtd = sumaMeses(marcas, f.anio - 1, 1, mesCerrado);
    const lyResto = sumaMeses(marcas, f.anio - 1, mesCerrado + 1, 12);
    if (lyYtd > 0 && lyResto > 0) return Math.round(ytd + lyResto * (ytd / lyYtd));
    return Math.round(ytd + (ytd / mesCerrado) * (12 - mesCerrado));
  };
  // Hasta dónde llega el "YTD" del presupuesto: el último mes cerrado del
  // año en curso, o el año entero si el filtro es un año cerrado.
  const hastaYtd = proyectar ? mesCerrado : 12;

  // --- pauta de Meta por marca … (sin cambios)

  // --- unidades de la tabla: un GRUPO presupuestado (GWM = GREAT WALL +
  // HAVAL, LEAPMOTOR + JMEV) es una fila, así lo presupuesta Finanzas; las
  // marcas sin grupo, una fila cada una. Con el filtro de marca puesto se
  // muestra solo la fila que la contiene.
  const meses = f.mesHasta - f.mesDesde + 1;
  const marcasConDatos = [...new Set([
    ...facturasPeriodo.map((v) => v.marca),
    ...matricPorMarca.keys(),
    ...stockPorMarca.keys(),
  ])];
  const esPropia = (m: string) => propias.includes(m);
  const grupos: { marcas: string[]; plan: number[] | null; presupuestoAnual: number | null }[] = [];
  const enGrupo = new Set<string>();
  for (const g of presupuesto?.grupos ?? []) {
    grupos.push({ marcas: g.marcas, plan: g.plan, presupuestoAnual: g.presupuesto_anual });
    for (const m of g.marcas) enGrupo.add(m);
  }
  for (const m of marcasConDatos) {
    if (esPropia(m) && !enGrupo.has(m)) {
      grupos.push({ marcas: [m], plan: metasAnio[m]?.some((v) => v !== null) ? metasAnio[m].map((v) => v ?? 0) : null, presupuestoAnual: null });
    }
  }
  // Matriculaciones y stock por marca, sin el filtro de marca, para sumar
  // grupos enteros. `matricPorMarca` y `stockPorMarca` sí están filtrados.
  const matricTodas = new Map(
    (cadamDisponible ? getRankingMarcas("matriculacion", { ...fCadam, marca: undefined }) : [])
      .filter((r) => propias.includes(r.marca))
      .map((r) => [r.marca, r.unidades])
  );
  const stockTodas = new Map<string, { total: number; reservadas: number }>();
  for (const s of stockCrudo) {
    const x = stockTodas.get(s.marca) ?? { total: 0, reservadas: 0 };
    x.total += s.unidades;
    x.reservadas += s.reservadas;
    stockTodas.set(s.marca, x);
  }
  const filas = grupos
    .filter((g) => !f.marca || g.marcas.includes(f.marca))
    .map((g) => {
      const facturado = sumaMeses(g.marcas, f.anio, f.mesDesde, f.mesHasta);
      const matriculado = g.marcas.reduce((s, m) => s + (matricTodas.get(m) ?? 0), 0);
      const st = g.marcas.reduce(
        (acc, m) => {
          const x = stockTodas.get(m);
          return x ? { total: acc.total + x.total, reservadas: acc.reservadas + x.reservadas } : acc;
        },
        { total: 0, reservadas: 0 }
      );
      const ritmo = meses > 0 ? facturado / meses : 0;
      const pp = g.plan ? planPeriodo(g.plan, f.mesDesde, f.mesHasta, realHastaMes) : null;
      const facturadoAbiertos = pp
        ? facturado - (realHastaMes ? sumaMeses(g.marcas, f.anio, f.mesDesde, Math.min(realHastaMes, f.mesHasta)) : 0)
        : 0;
      const facturadoYtd = sumaMeses(g.marcas, f.anio, 1, hastaYtd);
      return {
        clave: g.marcas.join("+"),
        etiqueta: g.marcas.join(" + "),
        marcas: g.marcas,
        esGrupo: g.marcas.length > 1,
        facturado,
        matriculado,
        share: mercado ? matriculado / mercado : 0,
        stock: st.total,
        reservadas: st.reservadas,
        mesesStock: ritmo >= RITMO_MINIMO ? st.total / ritmo : null,
        meta: pp?.plan ?? 0,
        abiertos: pp?.abiertos ?? 0,
        cumplimiento: pp ? cumplimiento(facturadoAbiertos, pp.planAbiertos, pp.abiertos) : null,
        metaAnio: g.plan ? g.plan.reduce((s, v) => s + v, 0) : 0,
        presupuestoAnual: g.presupuestoAnual,
        facturadoYtd,
        hecho: porcentajeHecho(facturadoYtd, g.presupuestoAnual),
        proyeccion: proyeccionDe(g.marcas),
        pauta: g.marcas.reduce((s, m) => s + pautaDe(m), 0),
      };
    })
    .sort((a, b) => b.facturado - a.facturado);
  const marcas = marcasConDatos;
```

Y donde estaba `const metaTotal = …`, reemplazar por lo que usa la tarjeta:

```ts
  const conPresupuesto = filas.filter((r) => r.presupuestoAnual);
  const presupuestoTotal = conPresupuesto.reduce((s, r) => s + (r.presupuestoAnual ?? 0), 0);
  const hechoTotal = porcentajeHecho(conPresupuesto.reduce((s, r) => s + r.facturadoYtd, 0), presupuestoTotal);
  const planTotalAnio = filas.reduce((s, r) => s + r.metaAnio, 0);
  const metaTotal = filas.reduce((s, r) => s + r.meta, 0);
  const facturadoYtdTotal = filas.reduce((s, r) => s + r.facturadoYtd, 0);
```

`ajenas` sigue igual (`marcas.filter((m) => !esPropia(m))`).

- [ ] **Step 3: Tarjeta**

Reemplazar la `KpiCard` «Meta del período»:

```tsx
        <KpiCard
          label={hayPresupuesto ? `Presupuesto ${f.anio}` : "Meta del período"}
          value={
            hayPresupuesto && hechoTotal !== null
              ? formatPct(hechoTotal)
              : hayMetas && metaTotal
                ? formatPct(totalFacturas / metaTotal)
                : "—"
          }
          valorAnimado={
            hayPresupuesto && hechoTotal !== null
              ? hechoTotal
              : hayMetas && metaTotal
                ? totalFacturas / metaTotal
                : undefined
          }
          formato="porcentaje"
          periodo={
            hayPresupuesto
              ? `plan ${presupuesto.version}: ${formatUnidades(planTotalAnio)} · facturado a ${proyectar ? mesCorto(mesCerrado) : "dic"}: ${formatUnidades(facturadoYtdTotal)}`
              : hayMetas && metaTotal
                ? `${formatUnidades(totalFacturas)} de ${formatUnidades(metaTotal)} · ${periodo}`
                : "Sin metas cargadas"
          }
          tooltip={
            hayPresupuesto
              ? `Qué parte del presupuesto original del año (${formatUnidades(presupuestoTotal)} u., marcas con presupuesto) ya se facturó. El plan vigente es el ejercicio de Finanzas mes a mes.`
              : hayMetas
                ? "Vehículos facturados contra la meta cargada en Configuración para estos meses."
                : "Cargá metas por marca y mes en Configuración para ver el cumplimiento acá."
          }
          tono="tinta"
        />
```

- [ ] **Step 4: Tabla**

Encabezados (reemplazar el bloque `{hayMetas && (<>…</>)}` del `TableHeader`):

```tsx
                {hayMetas && (
                  <>
                    <TableHead className="text-right whitespace-nowrap">Plan (período)</TableHead>
                    <TableHead className="text-right">Cumplimiento</TableHead>
                  </>
                )}
                {hayPresupuesto && (
                  <>
                    <TableHead className="text-right whitespace-nowrap">Presupuesto anual</TableHead>
                    <TableHead className="text-right whitespace-nowrap">% hecho</TableHead>
                  </>
                )}
                {hayMetas && (
                  <TableHead className="text-right whitespace-nowrap">Proyección / plan año</TableHead>
                )}
```

Celdas (reemplazar el bloque `{hayMetas && (<>…</>)}` de cada fila; la primera celda pasa a mostrar `r.etiqueta` con la nota de grupo):

```tsx
                  <TableCell className="font-medium">
                    {r.etiqueta}
                    {r.esGrupo && (
                      <span className="block text-[11px] font-normal text-muted-foreground">
                        meta conjunta: así la presupuesta Finanzas
                      </span>
                    )}
                  </TableCell>
                  …
                  {hayMetas && (
                    <>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {r.meta ? formatUnidades(r.meta) : "—"}
                        {r.meta && r.abiertos === 0 ? (
                          <span className="block text-[11px]">cerrado</span>
                        ) : null}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "text-right tabular-nums font-medium",
                          r.cumplimiento !== null && r.cumplimiento < 0.85 && "text-rose-600 dark:text-rose-400",
                          r.cumplimiento !== null && r.cumplimiento >= 1 && "text-emerald-700 dark:text-emerald-400"
                        )}
                        title={
                          r.meta && r.abiertos === 0
                            ? "Todos los meses del filtro ya cerraron: ahí el plan es el real."
                            : undefined
                        }
                      >
                        {r.cumplimiento !== null ? formatPct(r.cumplimiento) : "—"}
                      </TableCell>
                    </>
                  )}
                  {hayPresupuesto && (
                    <>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {r.presupuestoAnual ? formatUnidades(r.presupuestoAnual) : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-medium">
                        {r.hecho !== null ? formatPct(r.hecho) : "—"}
                      </TableCell>
                    </>
                  )}
                  {hayMetas && (
                    <TableCell className="text-right tabular-nums text-muted-foreground whitespace-nowrap">
                      {r.proyeccion !== null && r.metaAnio
                        ? `${formatUnidades(r.proyeccion)} / ${formatUnidades(r.metaAnio)}`
                        : r.proyeccion !== null
                          ? formatUnidades(r.proyeccion)
                          : "—"}
                    </TableCell>
                  )}
```

La fila «Otras marcas» suma dos guiones más cuando `hayPresupuesto`. `key={r.clave}`.

Nota de la tarjeta (reemplazar el ternario `{hayMetas ? … : …}`):

```tsx
            {hayPresupuesto
              ? ` El plan es el ejercicio de Finanzas (${presupuesto.version}, archivo del ${formatFechaHora(presupuesto.modificado).slice(0, 10)}); hasta ${realHastaMes ? mesCorto(realHastaMes) : "—"} el plan es el real, así que el cumplimiento se mide solo sobre los meses siguientes. El presupuesto anual es la cifra original del año, sin apertura mensual. La proyección de cierre toma lo facturado hasta el último mes cerrado y le suma lo que el año pasado se vendió en los meses que faltan, al ritmo de este año.`
              : hayMetas
                ? " La meta sale de Configuración; la proyección de cierre de año toma lo facturado hasta el último mes cerrado y le suma lo que el año pasado se vendió en los meses que faltan, al ritmo de este año."
                : " Cargá metas por marca y mes en Configuración y acá aparecen la meta, el cumplimiento y la proyección de cierre de año."}
```

- [ ] **Step 5: tsc, build, commit**

```bash
git add src/app/operacion/page.tsx
git commit -m "Operación: presupuesto anual, plan vigente y filas por grupo presupuestado"
```

(El build pasa recién con Task 6 si el import del gráfico ya está; hacer Task 5 y 6 en el mismo commit si hace falta.)

---

### Task 6: Gráfico «Plan vs. facturado, mes a mes»

**Files:**
- Create: `src/components/charts/plan-vs-facturado-chart.tsx`
- Modify: `src/app/operacion/page.tsx` (debajo de la tabla «Marca por marca»)

**Interfaces:**
- Produces: `PlanVsFacturadoChart({ meses: { mes: number; plan: number; facturado: number; cerrado: boolean }[]; referenciaMensual: number | null; altura?: number })`.

- [ ] **Step 1: El componente**

```tsx
"use client";

import { EchartsAuto } from "@/components/charts/echarts-auto";
import { TOOLTIP_BASE, useChartTheme } from "@/lib/chart-theme";
import { formatUnidades } from "@/lib/format";
import { mesCorto } from "@/lib/periodo";

export interface MesPlan {
  mes: number;
  plan: number;
  facturado: number;
  /** true hasta el último mes cerrado del Excel: ahí el plan ES el real. */
  cerrado: boolean;
}

/**
 * Plan vigente (gris) contra facturado (color) por mes. Los meses cerrados
 * van con fondo tenue y rótulo «cerrado»: en esos el plan es el real y las
 * dos barras miden lo mismo, así que no hay cumplimiento que leer. La línea
 * punteada es el presupuesto anual dividido doce: una referencia visual,
 * no un objetivo mensual —Finanzas no presupuestó por mes—.
 */
export function PlanVsFacturadoChart({
  meses,
  referenciaMensual,
  altura = 300,
}: {
  meses: MesPlan[];
  referenciaMensual: number | null;
  altura?: number;
}) {
  const theme = useChartTheme();
  const cerrados = meses.filter((m) => m.cerrado);
  const option = {
    animationDuration: 500,
    grid: { left: 48, right: 16, top: 28, bottom: 32 },
    tooltip: {
      ...TOOLTIP_BASE,
      trigger: "axis",
      formatter: (ps: { dataIndex: number }[]) => {
        const m = meses[ps[0]?.dataIndex ?? 0];
        if (!m) return "";
        const dif = m.facturado - m.plan;
        return (
          `<b>${mesCorto(m.mes)}</b>${m.cerrado ? " · cerrado (el plan es el real)" : ""}<br/>` +
          `plan ${formatUnidades(m.plan)} · facturado ${formatUnidades(m.facturado)}` +
          (m.cerrado ? "" : `<br/>diferencia <b>${dif >= 0 ? "+" : ""}${formatUnidades(dif)}</b>`)
        );
      },
    },
    legend: { top: 0, textStyle: { color: theme.text, fontSize: 11 } },
    xAxis: {
      type: "category" as const,
      data: meses.map((m) => mesCorto(m.mes)),
      axisLabel: { color: theme.text, fontSize: 11 },
      axisLine: { lineStyle: { color: theme.grid } },
      axisTick: { show: false },
    },
    yAxis: {
      type: "value" as const,
      axisLabel: { color: theme.text, fontSize: 11, formatter: (v: number) => formatUnidades(v) },
      splitLine: { lineStyle: { color: theme.grid } },
    },
    series: [
      {
        name: "Plan vigente",
        type: "bar" as const,
        data: meses.map((m) => m.plan),
        itemStyle: { color: theme.axis, borderRadius: [4, 4, 0, 0] },
        barGap: "10%",
        markArea: cerrados.length
          ? {
              silent: true,
              itemStyle: { color: theme.text, opacity: 0.06 },
              label: { show: true, position: "insideTop" as const, color: theme.text, fontSize: 10, formatter: "cerrado" },
              data: [[{ xAxis: mesCorto(cerrados[0].mes) }, { xAxis: mesCorto(cerrados[cerrados.length - 1].mes) }]],
            }
          : undefined,
        markLine:
          referenciaMensual !== null
            ? {
                silent: true,
                symbol: "none",
                lineStyle: { type: "dashed" as const, color: theme.text, width: 1 },
                label: { position: "end" as const, color: theme.text, fontSize: 10, formatter: "ppto ÷ 12" },
                data: [{ yAxis: Math.round(referenciaMensual) }],
              }
            : undefined,
      },
      {
        name: "Facturado (Cars)",
        type: "bar" as const,
        data: meses.map((m) => m.facturado),
        itemStyle: { color: theme.primary, borderRadius: [4, 4, 0, 0] },
      },
    ],
  };
  return <EchartsAuto option={option} style={{ height: altura, width: "100%" }} notMerge />;
}
```

- [ ] **Step 2: Los datos, en la página** (después de `filas`)

```ts
  const mesesPlan = hayPresupuesto
    ? Array.from({ length: 12 }, (_, i) => {
        const mes = i + 1;
        const conPlan = filas.filter((r) => r.metaAnio > 0);
        return {
          mes,
          plan: conPlan.reduce((s, r) => s + (grupos.find((g) => g.marcas.join("+") === r.clave)?.plan?.[i] ?? 0), 0),
          facturado: conPlan.reduce((s, r) => s + sumaMeses(r.marcas, f.anio, mes, mes), 0),
          cerrado: realHastaMes !== null && mes <= realHastaMes,
        };
      })
    : [];
  const referenciaMensual = presupuestoTotal > 0 ? presupuestoTotal / 12 : null;
```

(Si es más claro, guardar `plan` en cada fila —`plan: g.plan`— y leerlo de ahí en vez de `grupos.find`.)

- [ ] **Step 3: La tarjeta**, debajo de la Card de la tabla, dentro de la misma `Seccion`:

```tsx
      {hayPresupuesto && (
        <Card>
          <CardHeader>
            <CardTitle>Plan vs. facturado, mes a mes — {f.anio}{f.marca ? ` · ${filas[0]?.etiqueta ?? f.marca}` : ""}</CardTitle>
            <p className="text-xs text-muted-foreground">
              Barras: el plan vigente ({presupuesto.version}) y lo facturado en Cars, por mes.
              Los meses sombreados ya cerraron en el Excel: ahí el plan es el real. La línea
              punteada es el presupuesto anual dividido doce, solo como referencia —Finanzas
              no presupuestó por mes—.
            </p>
          </CardHeader>
          <CardContent>
            <PlanVsFacturadoChart meses={mesesPlan} referenciaMensual={referenciaMensual} />
          </CardContent>
        </Card>
      )}
```

- [ ] **Step 4: tsc, build, commit**

```bash
git add src/components/charts/plan-vs-facturado-chart.tsx src/app/operacion/page.tsx
git commit -m "Operación: plan vs facturado mes a mes"
```

---

### Task 7: `resumenPresupuesto`, tarjeta del inicio, Inteligencia y Copiloto

**Files:**
- Modify: `src/lib/informes/tablero.ts` (nuevo `resumenPresupuesto`), `src/components/dashboard/acciones-semana.tsx`, `src/lib/informes/inteligencia-propia.ts`, `src/app/api/copiloto/route.ts:286-347,355-369`, `src/lib/cadam/copiloto-contexto.ts:103-104`, `src/app/copiloto/page.tsx:34-39`.

**Interfaces:**
- Produces: `resumenPresupuesto(anio = anioActual())` → `null` si no hay presupuesto del año o no hay facturas; si no:
  `{ anio, version, archivo, modificado, cargadoEn, realHastaMes, ultimoMesCerrado, planTotal, presupuestoTotal, facturadoYtd, hechoTotal, grupos: [{ marcas, etiqueta, planAnio, presupuestoAnual, facturadoYtd, hecho, planAbiertosYtd, facturadoAbiertosYtd, cumplimientoYtd, ritmo, necesario, atrasado }], atrasados: Atrasado[], nota }`.

- [ ] **Step 1: `resumenPresupuesto` en `tablero.ts`**

Imports nuevos: `getPresupuesto` de `@/lib/cadam/config`; `atrasados, cumplimiento, facturadoEntre, planPeriodo, porcentajeHecho, ritmoNecesario, ritmoUltimosMeses` de `./presupuesto`.

```ts
// ---------------------------------------------------------- presupuesto

export async function resumenPresupuesto(anio = anioActual()) {
  const p = getPresupuesto(anio);
  if (!p) return null;
  const ventas = (await getVentasPropias()).filter((v) => enAnio(v.periodo, anio));
  if (!ventas.length) return null;
  const hoy = hoyEnAsuncion();
  const ultimoMesCerrado = Number(hoy.slice(0, 4)) === anio ? Number(hoy.slice(5, 7)) - 1 : 12;
  const grupos = p.grupos.map((g) => {
    const facturadoYtd = facturadoEntre(ventas, g.marcas, anio, 1, ultimoMesCerrado);
    const pp = planPeriodo(g.plan, 1, ultimoMesCerrado, p.real_hasta_mes);
    const facturadoAbiertos = p.real_hasta_mes
      ? facturadoYtd - facturadoEntre(ventas, g.marcas, anio, 1, Math.min(p.real_hasta_mes, ultimoMesCerrado))
      : facturadoYtd;
    const ritmo = redondear(ritmoUltimosMeses(ventas, g.marcas, anio, ultimoMesCerrado));
    const necesario = ritmoNecesario(g.plan, facturadoYtd, ultimoMesCerrado);
    return {
      marcas: g.marcas,
      etiqueta: g.marcas.join(" + "),
      planAnio: g.plan.reduce((s, v) => s + v, 0),
      presupuestoAnual: g.presupuesto_anual,
      facturadoYtd,
      hecho: porcentajeHecho(facturadoYtd, g.presupuesto_anual),
      planAbiertosYtd: pp.planAbiertos,
      facturadoAbiertosYtd: facturadoAbiertos,
      cumplimientoYtd: cumplimiento(facturadoAbiertos, pp.planAbiertos, pp.abiertos),
      ritmo,
      necesario: necesario === null ? null : redondear(necesario),
      atrasado: necesario !== null && ritmo < necesario,
    };
  });
  const lista = atrasados(
    p.grupos,
    (marcas) => facturadoEntre(ventas, marcas, anio, 1, ultimoMesCerrado),
    (marcas) => ritmoUltimosMeses(ventas, marcas, anio, ultimoMesCerrado),
    ultimoMesCerrado
  ).map((a) => ({ ...a, ritmo: redondear(a.ritmo), necesario: redondear(a.necesario), faltaPorMes: redondear(a.faltaPorMes) }));
  const conPpto = grupos.filter((g) => g.presupuestoAnual);
  const presupuestoTotal = conPpto.reduce((s, g) => s + (g.presupuestoAnual ?? 0), 0);
  return {
    anio, version: p.version, archivo: p.archivo, modificado: p.modificado, cargadoEn: p.cargado_en,
    realHastaMes: p.real_hasta_mes, ultimoMesCerrado,
    planTotal: grupos.reduce((s, g) => s + g.planAnio, 0),
    presupuestoTotal,
    facturadoYtd: grupos.reduce((s, g) => s + g.facturadoYtd, 0),
    hechoTotal: porcentajeHecho(conPpto.reduce((s, g) => s + g.facturadoYtd, 0), presupuestoTotal),
    grupos,
    atrasados: lista,
    nota:
      `Plan vigente = ejercicio de Finanzas ${p.version} mes a mes; hasta el mes ${p.real_hasta_mes ?? "—"} el plan ` +
      "es el real, por eso el cumplimiento se mide solo sobre los meses siguientes. Presupuesto anual = cifra " +
      "original del año, sin apertura mensual (Renault y Xpeng no la tienen). Facturado = vehículos de Cars " +
      "hasta el último mes cerrado. 'Atrasado' = el ritmo de los últimos tres meses cerrados no alcanza el que " +
      "pide el plan para lo que queda del año. Un grupo (GREAT WALL + HAVAL) es una sola meta.",
  };
}
```

- [ ] **Step 2: Tarjeta en `acciones-semana.tsx`**

Import `resumenPresupuesto` de `@/lib/informes/tablero`. Dentro del componente, después de `acciones`:

```ts
  let presupuesto: Awaited<ReturnType<typeof resumenPresupuesto>> = null;
  try {
    presupuesto = await resumenPresupuesto();
  } catch {
    presupuesto = null;
  }
```

Grid: `xl:grid-cols-5` → `lg:grid-cols-3 xl:grid-cols-6`. Tarjeta nueva, al final:

```tsx
        <TarjetaAccion
          titulo="Atrasados contra el plan"
          numero={presupuesto ? presupuesto.atrasados.length : null}
          unidad="marcas"
          vacio={presupuesto ? "Todas las marcas al ritmo del plan." : "Sin presupuesto cargado: lo carga Hermes desde el Excel de Finanzas."}
          frase={
            presupuesto
              ? `van más lento que lo que pide el plan ${presupuesto.version} para lo que queda del año.`
              : "van más lento que el plan del año."
          }
          items={presupuesto?.atrasados.slice(0, 3).map((a) => `${a.marcas.join(" + ")} · falta ${coma(a.faltaPorMes)}/mes`) ?? []}
          href={presupuesto ? "/operacion#marcas" : "/cargas"}
          tono="rojo"
        />
```

Y en `/operacion`, la `Seccion` «Marca por marca» recibe `id="marcas"`.

- [ ] **Step 3: Ítem en `inteligencia-propia.ts`**

Import `resumenPresupuesto`. Después del bloque de Cars (mismo `try`), antes de las advertencias:

```ts
  // ------------------------------------------------ presupuesto (Excel de Finanzas)
  try {
    const pr = await resumenPresupuesto(anio);
    if (pr) {
      const periodo = `Plan ${pr.version} · facturado a ${mesCorto(pr.ultimoMesCerrado)} ${anio} (Cars)`;
      if (pr.hechoTotal !== null) {
        resumen.push(`Presupuesto ${anio}: ${pct(pr.hechoTotal)} hecho a ${mesCorto(pr.ultimoMesCerrado)} (${u(pr.facturadoYtd)} facturados; plan vigente ${u(pr.planTotal)}).`);
      }
      if (pr.atrasados.length) {
        items.push({
          tipo: "riesgo",
          titulo: `${pr.atrasados.length} ${pr.atrasados.length === 1 ? "marca va" : "marcas van"} por debajo del ritmo que pide el plan ${anio}`,
          motivo: "El ritmo de los últimos tres meses cerrados no alcanza el que hace falta para llegar al plan del año en los meses que quedan.",
          evidencia: pr.atrasados.slice(0, 4).map((a) => `${a.marcas.join(" + ")}: ${coma(a.ritmo)}/mes, pide ${coma(a.necesario)}`).join(" · "),
          prioridad: pr.atrasados.some((a) => a.faltaPorMes >= 10) ? "alta" : "media",
          impacto: "Plan comercial",
          periodo,
        });
      }
    }
  } catch (e) {
    advertencias.push(`Presupuesto: ${(e as Error).message}`);
  }
```

(Verificar los valores válidos de `Item.tipo` en `src/lib/cadam/inteligencia.ts` antes; si «riesgo» no existe, usar el que usa el ítem de asesores parados.)

- [ ] **Step 4: Copiloto**

`route.ts`: importar `resumenPresupuesto`; en `leerOperacionPropia`, dentro de `if (input.que === "ventas")` y en el `todo`, agregar `presupuesto: await resumenPresupuesto(anio)` al JSON. En la descripción de la tool, después de «API de Cars)», agregar: «— trae también el presupuesto del año por marca: plan vigente, presupuesto anual, % hecho y qué marcas van atrasadas —». En `copiloto-contexto.ts`, la línea `"cuanto facturamos", "cuantos vendimos" -> que='ventas';` pasa a `"cuanto facturamos", "cuantos vendimos", "presupuesto", "objetivo", "meta", "plan", "cumplimiento", "atrasadas" -> que='ventas' (trae el presupuesto por marca);`. En `copiloto/page.tsx`, agregar la sugerencia `"¿Qué marcas van atrasadas contra el presupuesto 2026?"` después de la de pauta.

- [ ] **Step 5: tsc, build, commit**

```bash
git add src/lib/informes/tablero.ts src/components/dashboard/acciones-semana.tsx src/lib/informes/inteligencia-propia.ts src/app/api/copiloto/route.ts src/lib/cadam/copiloto-contexto.ts src/app/copiloto/page.tsx src/app/operacion/page.tsx
git commit -m "Presupuesto en el inicio, el Centro de Inteligencia y el Copiloto"
```

---

### Task 8: Configuración y Cargas

**Files:**
- Modify: `src/app/configuracion/page.tsx` (pasar `presupuesto`), `src/app/configuracion/metas.tsx` (aviso + columna)
- Modify: `src/app/cargas/page.tsx` (fila nueva)

- [ ] **Step 1: `metas.tsx`**

Prop nueva `presupuesto?: { version: string; archivo: string; modificado: string; cargado_en: string; anual: Record<string, number | null> } | null` (`anual` = `presupuesto_anual` por primera marca de cada grupo). Arriba de la grilla, si hay presupuesto:

```tsx
          {presupuesto && (
            <p className="rounded-md border border-amber-300/60 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-200">
              Cargado desde <em>{presupuesto.archivo}</em> (archivo del {presupuesto.modificado.slice(0, 10)},
              cargado el {presupuesto.cargado_en.slice(0, 16).replace("T", " ")}, versión {presupuesto.version}).
              Lo que edites acá lo pisa la próxima carga del Excel.
            </p>
          )}
```

Columna «Ppto. anual» (solo lectura) después de «Año», con `presupuesto.anual[m]` o «—»; en la fila Total, la suma.

- [ ] **Step 2: `configuracion/page.tsx`**: `const presupuesto = getPresupuesto(anioMetas);` y pasar `presupuesto={presupuesto ? { version, archivo, modificado, cargado_en, anual: Object.fromEntries(presupuesto.grupos.map((g) => [g.marcas[0], g.presupuesto_anual])) } : null}`.

- [ ] **Step 3: `cargas/page.tsx`**: importar `getPresupuesto` y `mesCorto`; `const presupuesto = getPresupuesto(Number(new Date().getFullYear()))` (mejor: `anioActual` de tablero o `hoyEnAsuncion`). Fila:

```ts
    {
      nombre: `Presupuesto ${presupuesto?.anio ?? anio} (Excel de Finanzas)`,
      detalle: presupuesto
        ? `Plan ${presupuesto.version} · ${presupuesto.grupos.length} marcas/grupos · real hasta ${presupuesto.real_hasta_mes ? mesCorto(presupuesto.real_hasta_mes) : "—"} · plan ${formatUnidades(planTotal)} u. · presupuesto ${formatUnidades(pptoTotal)} u. Renew (usados) y los canales CDE y Wholesale no entran todavía.`
        : "Nunca cargado. Lo carga advisor-presupuesto.sh (Hermes, notebook) desde el Budget de Finanzas.",
      cadencia: "cuando Finanzas cambia el Excel (el cron mira cada hora)",
      actualizado: presupuesto ? new Date(presupuesto.cargado_en) : null,
      tibioH: 24 * 45,
      frioH: 24 * 90,
      motor: "advisor-presupuesto.sh (Hermes, notebook)",
    },
```

- [ ] **Step 4: tsc, build, commit**

```bash
git add src/app/configuracion/page.tsx src/app/configuracion/metas.tsx src/app/cargas/page.tsx
git commit -m "Configuración y Cargas: de dónde salió el presupuesto"
```

---

### Task 9: Verificación local con datos de prueba

- [ ] **Step 1:** Con `.env.local` (`HERMES_INGEST_SECRET=prueba-local`) y el preview levantado, correr el script de Task 4 contra el dev server (`--force`). Sin Postgres local no hay facturas: `/operacion` muestra su estado vacío. Para ver la tabla hace falta Cars → se verifica en producción (Task 10). Lo que SÍ se verifica local:
  - `/configuracion`: aviso ámbar con `VF 8.3`, columna «Ppto. anual» (JETOUR 750, GREAT WALL 650, HAVAL —, RENAULT —).
  - `/cargas`: fila «Presupuesto 2026 (Excel de Finanzas)» con «hace minutos».
  - `/copiloto`: la pregunta sugerida nueva en la lista.
  - Inicio: la tarjeta «Atrasados contra el plan» con «Sin datos» (sin Cars) o el conteo.
  - `read_console_messages` sin errores.
- [ ] **Step 2:** `git checkout data/parametros.json` y borrar `.env.local`. `npx tsc --noEmit` y `npx next build` limpios.

---

### Task 10: Producción

- [ ] **Step 1:** XPENG en el `parametros.json` de producción, editado EN el servidor (no `scp` del archivo local: pisaría lo que la app ya escribió ahí). Con un script Python copiado por `scp` a `/tmp` del servidor y corrido por `ssh`: `json.load('/home/santarosa/datos-advisor/parametros.json')` → agregar XPENG si falta → escribir con tmp+rename. La app relee por mtime, sin reinicio.
- [ ] **Step 2:** `git fetch && git rebase origin/master && git push` (va a `master`). `poll-deploy.sh` hasta `DEPLOY LISTO`.
- [ ] **Step 3:** `python3 ~/.hermes/scripts/advisor-presupuesto.py --force` → `📊 Presupuesto VF 8.3 cargado…`.
- [ ] **Step 4:** Playwright (cookie de `cookie.txt`, viewport 1500×1000): capturas de `/operacion` (tarjeta, tabla con filas de grupo, gráfico), `/operacion?marca=JETOUR`, inicio (tarjeta), `/configuracion`, `/cargas`, `/inteligencia`. Consulta al Copiloto por `POST /api/copiloto` con «¿Qué marcas van atrasadas contra el presupuesto 2026?» y leer que cite el plan y los atrasados. Cero errores de consola.
- [ ] **Step 5:** Cron: agregar el job a `~/.hermes/cron/jobs.json` (`Advisor · Presupuesto (Excel Finanzas)`, `advisor-presupuesto.sh`, `no_agent: true`, `0 * * * *`) con un script Python que edite el JSON (id = 12 hex al azar como los otros). Verificar con `hermes cron list` o leyendo el archivo.
- [ ] **Step 6:** Guardia en `actualizar-datos-advisor.sh`: antes del `scp` de `parametros.json`, si el remoto tiene `presupuesto` o `metas_mensuales` y el local no, abortar con mensaje (evita pisar lo que carga Hermes). Y memoria nueva: `presupuesto-desde-excel.md`.

---

### Task 11: Estados de stock según la regla de press-semanal (pedido de Croman, 07/09)

**Files:**
- Modify: `src/lib/informes/cobertura.ts:36-37` y donde se clasifica el estado; `src/app/operacion/page.tsx` (aviso de estados desconocidos, sección «Stock»).

Regla: en piso = DESPACHADO, SIN DESPACHAR, CONSIGNADO, DISPONIBLE, STOCK CDE; en viaje = EN VIAJE, LANZAMIENTO; excluidos = TEST DRIVE, NO DISPONIBLE, CORTESÍA; un estado no listado se reporta, no se descarta.

- [ ] **Step 1:** `EN_VIAJE = new Set(["EN VIAJE", "LANZAMIENTO"])`; `EN_PISO = new Set(["DESPACHADO", "SIN DESPACHAR", "CONSIGNADO", "DISPONIBLE", "STOCK CDE"])`; exportar `estadosDesconocidos(stock: StockPropio[]): string[]` = estados que no están en ninguno de los tres conjuntos (siguen contando como en piso, como hoy). Actualizar el comentario de definiciones.
- [ ] **Step 2:** En `/operacion`, sección «Stock», si `estadosDesconocidos(stockCrudo).length`, una `NotaDato`: «Estados de Cars que la regla no conoce: X, Y (cuentan como en piso hasta que alguien los clasifique en cobertura.ts)».
- [ ] **Step 3:** tsc, build, commit `"Stock: LANZAMIENTO cuenta como en viaje; estados desconocidos se avisan"`. Push y verificación en producción con el resto.
