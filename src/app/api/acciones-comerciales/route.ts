import { NextResponse } from "next/server";
import {
  CAMPOS_NUMERICOS, guardarAcciones,
  type AccionVersion, type AccionesMes, type HojaAcciones,
} from "@/lib/informes/acciones";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Entrada de las acciones comerciales del mes, que Hermes lee del Excel de
 * Fernando (advisor-acciones.py). Mismo cerrojo que /api/batalla: Bearer
 * con HERMES_INGEST_SECRET. Todo o nada: una hoja mala rechaza el push
 * entero, porque una acción a medias es peor que la del mes pasado.
 *
 * Un push = UN mes. Se guarda bajo su "AAAA-MM" y los meses anteriores
 * quedan; volver a mandar el mismo mes lo reemplaza.
 *
 * Body: { archivo, modificado, mes, titulo, hojas: [{ marca, hoja,
 *         columnas, versiones: [{ version, marca, segmento, …números…,
 *         pvp_texto, bono_texto, observaciones }], totales, notas }] }
 */

const MAX_HOJAS = 30;
const MAX_VERSIONES = 200;
const MAX_NOTAS = 60;
const MAX_NUMERO = 10_000_000;

function texto(v: unknown, max = 200): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t.slice(0, max) : null;
}

function numero(v: unknown): number | null | undefined {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) && Math.abs(n) <= MAX_NUMERO ? n : undefined;
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
  const mes = texto(body.mes, 7);
  if (!archivo || !modificado || Number.isNaN(Date.parse(modificado))) {
    return malo("Se esperaban archivo y modificado (fecha ISO)");
  }
  if (!mes || !/^\d{4}-(0[1-9]|1[0-2])$/.test(mes)) return malo("mes tiene que ser AAAA-MM");
  if (!Array.isArray(body.hojas) || !body.hojas.length || body.hojas.length > MAX_HOJAS) {
    return malo(`hojas tiene que ser un array de 1 a ${MAX_HOJAS}`);
  }

  const hojas: HojaAcciones[] = [];
  let totalVersiones = 0;
  for (const [i, crudo] of body.hojas.entries()) {
    const h = crudo as Record<string, unknown>;
    const marca = texto(h.marca, 60)?.toUpperCase();
    if (!marca) return malo(`hojas[${i}]: falta marca`);
    if (hojas.some((x) => x.marca === marca)) return malo(`hojas[${i}]: ${marca} viene dos veces`);
    if (!Array.isArray(h.versiones) || !h.versiones.length || h.versiones.length > MAX_VERSIONES) {
      return malo(`hojas[${i}] (${marca}): versiones tiene que ser un array de 1 a ${MAX_VERSIONES}`);
    }
    const versiones: AccionVersion[] = [];
    for (const [j, vc] of h.versiones.entries()) {
      const v = vc as Record<string, unknown>;
      const version = texto(v.version, 160);
      if (!version) return malo(`hojas[${i}] (${marca}).versiones[${j}]: falta version`);
      const salida: Partial<AccionVersion> = {
        marca,
        version,
        segmento: texto(v.segmento, 40)?.toUpperCase() ?? null,
        pvp_texto: texto(v.pvp_texto, 80),
        bono_texto: texto(v.bono_texto, 300),
        observaciones: texto(v.observaciones, 400),
      };
      for (const campo of CAMPOS_NUMERICOS) {
        const n = numero(v[campo]);
        if (n === undefined) {
          return malo(`hojas[${i}] (${marca}).versiones[${j}] (${version}): ${campo} = "${String(v[campo])}" no es un número válido`);
        }
        (salida as Record<string, unknown>)[campo] = n;
      }
      versiones.push(salida as AccionVersion);
    }
    totalVersiones += versiones.length;

    const t = (h.totales ?? {}) as Record<string, unknown>;
    const totales: HojaAcciones["totales"] = {};
    for (const campo of ["stock", "en_viaje", "wholesale_nipon", "stock_final", "bono"] as const) {
      const n = numero(t[campo]);
      if (n === undefined) return malo(`hojas[${i}] (${marca}).totales.${campo} no es un número válido`);
      if (n !== null) totales[campo] = n;
    }
    const obsTot = texto(t.observaciones, 300);
    if (obsTot) totales.observaciones = obsTot;

    const notas = (Array.isArray(h.notas) ? h.notas : [])
      .map((n) => texto(n, 400))
      .filter((n): n is string => !!n)
      .slice(0, MAX_NOTAS);
    const columnas = (Array.isArray(h.columnas) ? h.columnas : [])
      .map((c) => texto(c, 40))
      .filter((c): c is string => !!c)
      .slice(0, 60);

    hojas.push({ marca, hoja: texto(h.hoja, 60) ?? marca, columnas, versiones, totales, notas });
  }

  const acciones: AccionesMes = {
    archivo, modificado, mes,
    titulo: texto(body.titulo, 120) ?? `Acciones comerciales ${mes}`,
    cargado_en: new Date().toISOString(),
    hojas,
  };
  try {
    guardarAcciones(acciones);
  } catch (e) {
    console.error("POST /api/acciones-comerciales:", e);
    return malo("No se pudo escribir acciones-comerciales.json en el servidor", 500);
  }
  return NextResponse.json({ ok: true, mes, marcas: hojas.length, versiones: totalVersiones });
}
