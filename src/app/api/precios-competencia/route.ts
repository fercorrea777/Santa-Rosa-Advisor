import { NextResponse } from "next/server";
import {
  crearTablaPreciosCompetencia, getPreciosCompetencia, guardarPreciosCompetencia,
} from "@/lib/informes/precios-competencia";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Entrada de los precios de la competencia que releva Hermes (catálogo de
 * terceros, hoy Datacar). Mismo cerrojo que /api/datos-propios: Bearer con
 * HERMES_INGEST_SECRET. Solo marca, versión y precio: no hay nada personal
 * en un catálogo público.
 *
 * Body: { fuente: "datacar", precios: [{ marca, version, precio_usd }] }
 */

const MAX_FILAS = 5_000;

function texto(v: unknown, max = 120): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t && t.length <= max ? t : null;
}

function autorizado(request: Request): boolean {
  const secreto = process.env.HERMES_INGEST_SECRET;
  return !!secreto && request.headers.get("authorization") === `Bearer ${secreto}`;
}

export async function POST(request: Request) {
  if (!autorizado(request)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  let body: { fuente?: unknown; precios?: unknown };
  try {
    body = (await request.json()) as { fuente?: unknown; precios?: unknown };
  } catch {
    return NextResponse.json({ error: "Body inválido: se esperaba JSON" }, { status: 400 });
  }
  const fuente = texto(body.fuente, 40);
  if (!fuente || !Array.isArray(body.precios)) {
    return NextResponse.json({ error: "Se esperaban 'fuente' y 'precios' (array)" }, { status: 400 });
  }
  if (body.precios.length > MAX_FILAS) {
    return NextResponse.json({ error: `Máximo ${MAX_FILAS} filas` }, { status: 400 });
  }
  const precios: { marca: string; version: string; precio_usd: number }[] = [];
  for (const [i, r] of body.precios.entries()) {
    const p = r as Record<string, unknown>;
    const marca = texto(p.marca);
    const version = texto(p.version);
    const precio = Number(p.precio_usd);
    // Rango de auto real, como en datos-propios: lo de afuera no entra.
    if (!marca || !version || !Number.isFinite(precio) || precio < 1_000 || precio > 500_000) {
      return NextResponse.json(
        { error: `precios[${i}]: marca, version y precio_usd (1.000–500.000) son obligatorios` },
        { status: 400 }
      );
    }
    precios.push({ marca: marca.toUpperCase(), version: version.toUpperCase(), precio_usd: Math.round(precio) });
  }
  try {
    await crearTablaPreciosCompetencia();
    await guardarPreciosCompetencia(fuente, precios);
  } catch (e) {
    console.error("POST /api/precios-competencia:", e);
    return NextResponse.json({ error: "No se pudieron guardar los precios" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, fuente, precios: precios.length });
}

export async function GET(request: Request) {
  if (!autorizado(request)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const filas = await getPreciosCompetencia();
  const porFuente: Record<string, number> = {};
  for (const f of filas) porFuente[f.fuente] = (porFuente[f.fuente] ?? 0) + 1;
  return NextResponse.json({
    filas: filas.length,
    por_fuente: porFuente,
    actualizado_en: filas[0]?.actualizado_en ?? null,
  });
}
