import { NextResponse } from "next/server";
import {
  crearTablaPautaMarca, guardarPautaMarca, type PautaMarca,
} from "@/lib/informes/pauta-marca";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Entrada del gasto de pauta en Meta por marca y mes (Hermes,
 * advisor-pauta-marca.py). Bearer con HERMES_INGEST_SECRET, y la ruta está
 * en la lista de ingesta de proxy.ts.
 *
 * Body: { pauta: [{ periodo, marca, gasto_usd, leads, cuentas }], detalle }
 */

const MAX_FILAS = 5_000;
const RE_PERIODO = /^\d{4}-(0[1-9]|1[0-2])$/;

function texto(v: unknown, max = 60): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t && t.length <= max ? t : null;
}

function entero(v: unknown): number | null {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isInteger(n) && n >= 0 && n < 100_000_000 ? n : null;
}

function autorizado(request: Request): boolean {
  const secreto = process.env.HERMES_INGEST_SECRET;
  return !!secreto && request.headers.get("authorization") === `Bearer ${secreto}`;
}

export async function POST(request: Request) {
  if (!autorizado(request)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  let body: { pauta?: unknown };
  try {
    body = (await request.json()) as { pauta?: unknown };
  } catch {
    return NextResponse.json({ error: "Body inválido: se esperaba JSON" }, { status: 400 });
  }
  if (!Array.isArray(body.pauta)) {
    return NextResponse.json({ error: "Se esperaba 'pauta' como array" }, { status: 400 });
  }
  if (body.pauta.length > MAX_FILAS) {
    return NextResponse.json({ error: `Máximo ${MAX_FILAS} filas` }, { status: 400 });
  }
  const filas: PautaMarca[] = [];
  for (const [i, r] of body.pauta.entries()) {
    const p = r as Record<string, unknown>;
    const periodo = texto(p.periodo, 7);
    const marca = texto(p.marca);
    const gasto = Number(p.gasto_usd);
    const leads = entero(p.leads ?? 0);
    const cuentas = entero(p.cuentas ?? 0);
    if (!periodo || !RE_PERIODO.test(periodo) || !marca || !Number.isFinite(gasto) || gasto < 0 ||
        gasto > 10_000_000 || leads === null || cuentas === null) {
      return NextResponse.json({ error: `pauta[${i}]: periodo YYYY-MM, marca, gasto_usd y conteos` }, { status: 400 });
    }
    filas.push({ periodo, marca: marca.toUpperCase(), gasto_usd: Math.round(gasto * 100) / 100, leads, cuentas });
  }
  try {
    await crearTablaPautaMarca();
    await guardarPautaMarca(filas);
  } catch (e) {
    console.error("POST /api/pauta-marca:", e);
    return NextResponse.json({ error: "No se pudo guardar la pauta" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, filas: filas.length });
}
