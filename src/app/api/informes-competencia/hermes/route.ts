import { NextResponse } from "next/server";
import { guardarInformeHermes } from "@/lib/informes/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Tope generoso para un scan de promociones en markdown (los que existen
 *  hoy pesan 2-8 KB). Corta abuso/errores de integración sin arriesgar
 *  contenido legítimo. */
const MAX_CONTENIDO_CHARS = 60_000;

/**
 * Punto de entrada para que Hermes (agente propio, corre local, fuera de
 * este repo) empuje su scan de promociones de competencia — hoy volcado a
 * markdown en su vault Obsidian — hacia la misma tabla que ya alimenta el
 * panel "Informes semanales" del Copiloto y la tool `leer_informe_competencia`.
 * No hay que tocar esos dos consumidores: `getInformesRecientes` no filtra
 * por dimension, así que "hermes_promos" aparece ahí solo con guardar la fila.
 *
 * Secreto propio (HERMES_INGEST_SECRET), separado de CRON_SECRET: son
 * ejecutores distintos (el cron interno de Vercel vs. un proceso externo en
 * otra máquina) y conviene poder rotarlos sin acoplarlos.
 */
export async function POST(request: Request) {
  const secreto = process.env.HERMES_INGEST_SECRET;
  const auth = request.headers.get("authorization");
  if (!secreto || auth !== `Bearer ${secreto}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body inválido: se esperaba JSON" }, { status: 400 });
  }

  const contenido = (body as { contenido?: unknown } | null)?.contenido;
  if (typeof contenido !== "string" || contenido.trim().length === 0) {
    return NextResponse.json({ error: "Falta 'contenido' (string no vacío)" }, { status: 400 });
  }
  if (contenido.length > MAX_CONTENIDO_CHARS) {
    return NextResponse.json(
      { error: `'contenido' supera el máximo de ${MAX_CONTENIDO_CHARS} caracteres` },
      { status: 400 }
    );
  }

  try {
    await guardarInformeHermes({ contenido: contenido.trim() });
  } catch (e) {
    console.error("POST /api/informes-competencia/hermes:", e);
    return NextResponse.json({ error: "No se pudo guardar el informe" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
