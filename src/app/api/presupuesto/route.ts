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
 *
 * Body: { anio, version, archivo, modificado, real_hasta_mes, total_compilado,
 *         grupos: [{ marcas: [...], hoja, plan: [12], presupuesto_anual }] }
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
  if (!anio || !version || !archivo || !modificado || totalCompilado === null) {
    return malo("Se esperaban anio, version, archivo, modificado y total_compilado");
  }
  if (Number.isNaN(Date.parse(modificado))) return malo("modificado no es una fecha ISO");
  let realHastaMes: number | null = null;
  if (body.real_hasta_mes !== null && body.real_hasta_mes !== undefined) {
    realHastaMes = entero(body.real_hasta_mes, 1, 12);
    if (realHastaMes === null) return malo("real_hasta_mes tiene que ser 1–12 o null");
  }
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
      if (n === null) {
        return malo(`grupos[${i}].plan[${j}]: "${String(v)}" no es un entero 0–${MAX_UNIDADES}`);
      }
      plan.push(n);
    }
    let presupuestoAnual: number | null = null;
    if (g.presupuesto_anual !== null && g.presupuesto_anual !== undefined) {
      presupuestoAnual = entero(g.presupuesto_anual, 0, MAX_UNIDADES);
      if (presupuestoAnual === null) {
        return malo(`grupos[${i}]: presupuesto_anual tiene que ser entero 0–${MAX_UNIDADES} o null`);
      }
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
