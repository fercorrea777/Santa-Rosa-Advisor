import { NextResponse } from "next/server";
import {
  crearTablasPropias, getEstadoSyncPropio, guardarDatosPropios,
  type StockPropio, type VentaPropia,
} from "@/lib/informes/propios";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Entrada de los datos de la operacion propia (API de Cars), empujados por
 * Hermes.
 *
 * POR QUE PUSH Y NO PULL. Cars no se puede llamar desde aca:
 *  - `/units/list` tarda 44 segundos y devuelve ~5 MB sin paginar (8.671
 *    unidades). Eso no entra en el ciclo de un request.
 *  - Cars responde 401 a los dos endpoints de datos cuando la llamada sale
 *    de un servidor de Vercel, con credenciales que andan perfecto desde la
 *    maquina de Croman (verificado byte a byte, 2026-08-14, ver
 *    PDI PLAINILLA/scripts/sync-cars.sh). No hay razon para apostar a que
 *    este servidor no caiga en la misma regla.
 *  - Las credenciales de Cars no tienen por que vivir en un servidor
 *    publico si el dato ya se puede empujar agregado.
 *
 * Hermes ya sincroniza Cars cada 4 horas para PDI desde esa misma maquina.
 *
 * LO QUE ESTE ENDPOINT NO ACEPTA. El esquema no tiene lugar para Cliente,
 * Email, Telefono, VIN, NroFactura ni Vendedor. No es un olvido: la app no
 * tiene login y esos campos son datos personales de compradores reales y de
 * empleados. El agregado se hace del lado de Hermes; lo crudo no sale de
 * ahi. Cualquier campo de mas que venga en el body se ignora.
 */

const MAX_FILAS = 5_000;
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

function validar(body: {
  ventas?: unknown;
  stock?: unknown;
}): { error: string } | { ventas: VentaPropia[]; stock: StockPropio[] } {
  if (!Array.isArray(body.ventas) || !Array.isArray(body.stock)) {
    return { error: "Se esperaban 'ventas' y 'stock' como arrays" };
  }
  if (body.ventas.length > MAX_FILAS || body.stock.length > MAX_FILAS) {
    return { error: `Máximo ${MAX_FILAS} filas por tabla` };
  }

  const ventas: VentaPropia[] = [];
  for (const [i, r] of body.ventas.entries()) {
    const v = r as Record<string, unknown>;
    const periodo = texto(v.periodo, 7);
    const marca = texto(v.marca);
    const modelo = texto(v.modelo);
    const unidades = entero(v.unidades);
    if (!periodo || !RE_PERIODO.test(periodo)) {
      return { error: `ventas[${i}].periodo debe ser YYYY-MM` };
    }
    if (!marca || !modelo || unidades === null) {
      return { error: `ventas[${i}]: marca, modelo y unidades son obligatorios` };
    }
    ventas.push({ periodo, marca, modelo, unidades });
  }

  const stock: StockPropio[] = [];
  for (const [i, r] of body.stock.entries()) {
    const s = r as Record<string, unknown>;
    const marca = texto(s.marca);
    const modelo = texto(s.modelo);
    const estado = texto(s.estado);
    const unidades = entero(s.unidades);
    const reservadas = entero(s.reservadas);
    if (!marca || !modelo || !estado || unidades === null || reservadas === null) {
      return {
        error: `stock[${i}]: marca, modelo, estado, unidades y reservadas son obligatorios`,
      };
    }
    // El precio es opcional: Cars deja 260 unidades en 0, y ademas trae
    // outliers (una en 1.000.000.000). Se acota a un rango de auto real y
    // lo de afuera entra como null, no como una cifra que nadie va a
    // cuestionar por venir "del sistema".
    const p = s.precio_usd === null || s.precio_usd === undefined ? null : Number(s.precio_usd);
    const precio_usd =
      p !== null && Number.isFinite(p) && p >= 1_000 && p <= 500_000 ? Math.round(p) : null;
    stock.push({ marca, modelo, estado, unidades, reservadas, precio_usd });
  }

  return { ventas, stock };
}

function autorizado(request: Request): boolean {
  const secreto = process.env.HERMES_INGEST_SECRET;
  return !!secreto && request.headers.get("authorization") === `Bearer ${secreto}`;
}

export async function POST(request: Request) {
  if (!autorizado(request)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Body inválido: se esperaba JSON" }, { status: 400 });
  }

  const v = validar(body);
  if ("error" in v) {
    return NextResponse.json({ error: v.error }, { status: 400 });
  }

  try {
    await crearTablasPropias();
    await guardarDatosPropios({
      ventas: v.ventas,
      stock: v.stock,
      detalle:
        typeof body.detalle === "object" && body.detalle !== null
          ? (body.detalle as Record<string, unknown>)
          : {},
    });
  } catch (e) {
    console.error("POST /api/datos-propios:", e);
    return NextResponse.json({ error: "No se pudieron guardar los datos" }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    ventas: v.ventas.length,
    stock: v.stock.length,
    unidades_stock: v.stock.reduce((s, x) => s + x.unidades, 0),
  });
}

/** Estado de la ultima sincronizacion. Autenticado: le sirve a Hermes para
 *  confirmar que su push llego. El panel usa su propia ruta publica. */
export async function GET(request: Request) {
  if (!autorizado(request)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  try {
    await crearTablasPropias();
    return NextResponse.json({ sincronizacion: await getEstadoSyncPropio() });
  } catch (e) {
    console.error("GET /api/datos-propios:", e);
    return NextResponse.json({ error: "No se pudo leer el estado" }, { status: 500 });
  }
}
