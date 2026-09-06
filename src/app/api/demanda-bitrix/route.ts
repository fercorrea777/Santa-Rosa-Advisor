import { NextResponse } from "next/server";
import {
  crearTablaDemandaBitrix, guardarDemandaBitrix, type DemandaBitrix, type EstadoDemanda, type OrigenDemanda,
} from "@/lib/informes/demanda-bitrix";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Entrada de la demanda de Bitrix por marca y modelo (Hermes,
 * advisor-demanda-bitrix.py): leads y negocios por mes, con estado
 * (abierto / ganado / perdido) y motivo de pérdida. Mismo cerrojo que
 * /api/datos-propios: Bearer con HERMES_INGEST_SECRET. Está en la lista de
 * rutas de ingesta de proxy.ts — sin eso, 401 "Sesión requerida" aunque el
 * secreto sea válido.
 *
 * Body: { demanda: [{ periodo, origen, marca, modelo, estado, motivo, cantidad }], detalle }
 */

const MAX_FILAS = 20_000;
const RE_PERIODO = /^\d{4}-(0[1-9]|1[0-2])$/;
const ORIGENES = new Set<OrigenDemanda>(["lead", "negocio"]);
const ESTADOS = new Set<EstadoDemanda>(["abierto", "ganado", "perdido"]);

function texto(v: unknown, max = 120): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length <= max ? t : null;
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
  let body: { demanda?: unknown };
  try {
    body = (await request.json()) as { demanda?: unknown };
  } catch {
    return NextResponse.json({ error: "Body inválido: se esperaba JSON" }, { status: 400 });
  }
  if (!Array.isArray(body.demanda)) {
    return NextResponse.json({ error: "Se esperaba 'demanda' como array" }, { status: 400 });
  }
  if (body.demanda.length > MAX_FILAS) {
    return NextResponse.json({ error: `Máximo ${MAX_FILAS} filas` }, { status: 400 });
  }
  const filas: DemandaBitrix[] = [];
  for (const [i, r] of body.demanda.entries()) {
    const d = r as Record<string, unknown>;
    const periodo = texto(d.periodo, 7);
    const origen = texto(d.origen, 10) as OrigenDemanda | null;
    const marca = texto(d.marca);
    const modelo = texto(d.modelo ?? "");
    const estado = texto(d.estado, 10) as EstadoDemanda | null;
    const motivo = texto(d.motivo ?? "");
    const cantidad = entero(d.cantidad);
    if (!periodo || !RE_PERIODO.test(periodo) || !origen || !ORIGENES.has(origen) || !marca ||
        modelo === null || !estado || !ESTADOS.has(estado) || motivo === null || cantidad === null) {
      return NextResponse.json(
        { error: `demanda[${i}]: periodo YYYY-MM, origen lead|negocio, marca, estado abierto|ganado|perdido, cantidad entera` },
        { status: 400 }
      );
    }
    filas.push({
      periodo, origen, marca: marca.toUpperCase(), modelo: modelo.toUpperCase(), estado, motivo, cantidad,
    });
  }
  try {
    await crearTablaDemandaBitrix();
    await guardarDemandaBitrix(filas);
  } catch (e) {
    console.error("POST /api/demanda-bitrix:", e);
    return NextResponse.json({ error: "No se pudo guardar la demanda" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, filas: filas.length });
}
