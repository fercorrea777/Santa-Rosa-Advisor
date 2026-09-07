import { NextResponse } from "next/server";
import { guardarBatalla, type Batalla, type ModeloBatalla, type VersionBatalla } from "@/lib/informes/batalla";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Entrada del bubble chart por modelo que Hermes lee del Excel de producto
 * (advisor-batalla.py). Mismo cerrojo que las otras cargas: Bearer con
 * HERMES_INGEST_SECRET. Todo o nada.
 *
 * Body: { archivo, modificado, modelos: [{ hoja, modelo, titulo, periodo,
 *         tamano, eje_precio: {min, max}, marcas: [{marca, color}],
 *         versiones: [{marca, version, medidas, precio, matriculaciones, importaciones}] }] }
 */

const MAX_MODELOS = 40;
const MAX_VERSIONES = 400;

function texto(v: unknown, max = 200): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
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
  const archivo = texto(body.archivo);
  const modificado = texto(body.modificado, 40);
  if (!archivo || !modificado || Number.isNaN(Date.parse(modificado))) {
    return malo("Se esperaban archivo y modificado (fecha ISO)");
  }
  if (!Array.isArray(body.modelos) || !body.modelos.length || body.modelos.length > MAX_MODELOS) {
    return malo(`modelos tiene que ser un array de 1 a ${MAX_MODELOS}`);
  }
  const modelos: ModeloBatalla[] = [];
  let totalVersiones = 0;
  for (const [i, crudo] of body.modelos.entries()) {
    const m = crudo as Record<string, unknown>;
    const modelo = texto(m.modelo, 60);
    if (!modelo) return malo(`modelos[${i}]: falta modelo`);
    const tamano = m.tamano === "matriculaciones" ? "matriculaciones" : "importaciones";
    const eje = (m.eje_precio ?? {}) as Record<string, unknown>;
    const min = eje.min == null ? null : entero(eje.min, 0, 1_000_000);
    const max = eje.max == null ? null : entero(eje.max, 0, 1_000_000);
    if (!Array.isArray(m.versiones) || !m.versiones.length || m.versiones.length > MAX_VERSIONES) {
      return malo(`modelos[${i}] (${modelo}): versiones tiene que ser un array de 1 a ${MAX_VERSIONES}`);
    }
    const versiones: VersionBatalla[] = [];
    for (const [j, vc] of m.versiones.entries()) {
      const v = vc as Record<string, unknown>;
      const marca = texto(v.marca, 60).toUpperCase();
      const version = texto(v.version, 160);
      const precio = entero(v.precio, 1, 1_000_000);
      if (!marca || !version || precio === null) {
        return malo(`modelos[${i}] (${modelo}).versiones[${j}]: marca, version y precio (1–1.000.000) son obligatorios`);
      }
      versiones.push({
        marca, version,
        medidas: texto(v.medidas, 60),
        precio,
        matriculaciones: entero(v.matriculaciones, 0, 100_000) ?? 0,
        importaciones: entero(v.importaciones, 0, 100_000) ?? 0,
      });
    }
    totalVersiones += versiones.length;
    const marcasCrudas = Array.isArray(m.marcas) ? m.marcas : [];
    const marcas = marcasCrudas.map((x) => {
      const y = x as Record<string, unknown>;
      const color = texto(y.color, 6).toUpperCase();
      return { marca: texto(y.marca, 60).toUpperCase(), color: /^[0-9A-F]{6}$/.test(color) ? color : null };
    }).filter((x) => x.marca);
    // Toda marca con versiones tiene que estar en el orden; si falta, al final.
    for (const v of versiones) {
      if (!marcas.some((x) => x.marca === v.marca)) marcas.push({ marca: v.marca, color: null });
    }
    modelos.push({
      hoja: texto(m.hoja, 60) || modelo,
      modelo,
      modelo_celda: texto(m.modelo_celda, 60) || undefined,
      titulo: texto(m.titulo, 80),
      periodo: texto(m.periodo, 40),
      tamano,
      eje_precio: { min, max },
      marcas,
      versiones,
    });
  }
  const batalla: Batalla = { archivo, modificado, cargado_en: new Date().toISOString(), modelos };
  try {
    guardarBatalla(batalla);
  } catch (e) {
    console.error("POST /api/batalla:", e);
    return malo("No se pudo escribir batalla.json en el servidor", 500);
  }
  return NextResponse.json({ ok: true, modelos: modelos.length, versiones: totalVersiones });
}
