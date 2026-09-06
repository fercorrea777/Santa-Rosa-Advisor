import { NextResponse } from "next/server";
import {
  crearTablaLeadsAsesor, guardarLeadsAsesor, type LeadsAsesor,
} from "@/lib/informes/leads-asesor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Entrada de los leads de Bitrix por asesor y mes (Hermes,
 * advisor-leads-asesor.py). Mismo cerrojo que /api/datos-propios: Bearer
 * con HERMES_INGEST_SECRET. Está en la lista de rutas de ingesta de
 * proxy.ts — sin eso, 401 "Sesión requerida" aunque el secreto sea válido.
 *
 * Body: { leads: [{ periodo, asesor, leads, sin_contacto, descartados }], detalle }
 */

const MAX_FILAS = 10_000;
const RE_PERIODO = /^\d{4}-(0[1-9]|1[0-2])$/;

function texto(v: unknown, max = 120): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t && t.length <= max ? t : null;
}

function entero(v: unknown): number | null {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isInteger(n) && n >= 0 && n < 10_000_000 ? n : null;
}

function autorizado(request: Request): boolean {
  const secreto = process.env.HERMES_INGEST_SECRET;
  return !!secreto && request.headers.get("authorization") === `Bearer ${secreto}`;
}

export async function POST(request: Request) {
  if (!autorizado(request)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  let body: { leads?: unknown };
  try {
    body = (await request.json()) as { leads?: unknown };
  } catch {
    return NextResponse.json({ error: "Body inválido: se esperaba JSON" }, { status: 400 });
  }
  if (!Array.isArray(body.leads)) {
    return NextResponse.json({ error: "Se esperaba 'leads' como array" }, { status: 400 });
  }
  if (body.leads.length > MAX_FILAS) {
    return NextResponse.json({ error: `Máximo ${MAX_FILAS} filas` }, { status: 400 });
  }
  const filas: LeadsAsesor[] = [];
  for (const [i, r] of body.leads.entries()) {
    const l = r as Record<string, unknown>;
    const periodo = texto(l.periodo, 7);
    const asesor = texto(l.asesor);
    const leads = entero(l.leads);
    const sin_contacto = entero(l.sin_contacto ?? 0);
    const descartados = entero(l.descartados ?? 0);
    if (!periodo || !RE_PERIODO.test(periodo) || !asesor || leads === null ||
        sin_contacto === null || descartados === null) {
      return NextResponse.json({ error: `leads[${i}]: periodo YYYY-MM, asesor y conteos enteros` }, { status: 400 });
    }
    filas.push({ periodo, asesor: asesor.toUpperCase(), leads, sin_contacto, descartados });
  }
  try {
    await crearTablaLeadsAsesor();
    await guardarLeadsAsesor(filas);
  } catch (e) {
    console.error("POST /api/leads-asesor:", e);
    return NextResponse.json({ error: "No se pudieron guardar los leads" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, filas: filas.length });
}
