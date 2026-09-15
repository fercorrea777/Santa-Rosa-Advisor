import { NextResponse } from "next/server";
import {
  DIMENSIONES_HERMES, guardarInformeHermes, type DimensionInforme, type FuenteCitada,
} from "@/lib/informes/db";

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

  // Dimension: lista cerrada. Sin ella, promociones (lo unico que existia
  // cuando se escribio esto; asi el push viejo sigue andando).
  const dimRaw = (body as { dimension?: unknown }).dimension;
  const dimension: DimensionInforme =
    typeof dimRaw === "string" && (DIMENSIONES_HERMES as string[]).includes(dimRaw)
      ? (dimRaw as DimensionInforme)
      : "hermes_promos";
  if (dimRaw !== undefined && dimension !== dimRaw) {
    return NextResponse.json(
      { error: `'dimension' invalida; validas: ${DIMENSIONES_HERMES.join(", ")}` },
      { status: 400 }
    );
  }

  // Fuentes: hasta 50, cada una con url; titulo y fecha opcionales.
  const fuentesRaw = (body as { fuentes?: unknown }).fuentes;
  const fuentes: FuenteCitada[] = Array.isArray(fuentesRaw)
    ? fuentesRaw
        .filter((f): f is { url: string; titulo?: string; fecha?: string } =>
          !!f && typeof f === "object" && typeof (f as { url?: unknown }).url === "string")
        .slice(0, 50)
        .map((f) => ({
          url: f.url.slice(0, 500),
          titulo: typeof f.titulo === "string" ? f.titulo.slice(0, 200) : "",
          fecha: typeof f.fecha === "string" ? f.fecha.slice(0, 40) : "",
        }))
    : [];

  // Semana: un lunes YYYY-MM-DD. Sin ella, la actual.
  const semanaRaw = (body as { semana?: unknown }).semana;
  let semana: string | undefined;
  if (semanaRaw !== undefined) {
    if (typeof semanaRaw !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(semanaRaw)) {
      return NextResponse.json({ error: "'semana' debe ser YYYY-MM-DD" }, { status: 400 });
    }
    const d = new Date(`${semanaRaw}T00:00:00Z`);
    if (Number.isNaN(d.getTime()) || d.getUTCDay() !== 1) {
      return NextResponse.json({ error: "'semana' debe ser un lunes" }, { status: 400 });
    }
    semana = semanaRaw;
  }

  try {
    await guardarInformeHermes({ contenido: contenido.trim(), dimension, fuentes, semana });
  } catch (e) {
    console.error("POST /api/informes-competencia/hermes:", e);
    return NextResponse.json({ error: "No se pudo guardar el informe" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, dimension, semana: semana ?? null });
}
