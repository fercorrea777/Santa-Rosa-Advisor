import { NextResponse } from "next/server";
import {
  crearTablaConocimiento, getIndiceConocimiento, guardarConocimiento,
} from "@/lib/informes/conocimiento";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Entrada de la base de conocimiento de competencia que mantiene Hermes.
 *
 * Hermes ya venia generando esta inteligencia (benchmark de precios, battle
 * cards, scan diario de promociones, playbook de pauta) y la dejaba en un
 * vault Obsidian que el dashboard no veia. Esto es el puente: Hermes empuja
 * el lote entero y el Copiloto lo lee con `leer_conocimiento_competencia`.
 *
 * Comparte secreto con /api/informes-competencia/hermes (HERMES_INGEST_SECRET,
 * ya cargado en produccion): es el mismo ejecutor externo, y dos secretos
 * para el mismo proceso solo agregan una cosa mas que se puede desincronizar.
 *
 * Se empuja el LOTE COMPLETO, no documentos sueltos: la transaccion de
 * `guardarConocimiento` garantiza que el Copiloto nunca vea medio vault
 * actualizado (benchmark nuevo, battle cards viejas) sin que nada lo delate.
 *
 * Con `reemplazar_todo: true` el lote ES el inventario: lo que no venga se
 * borra. Es lo que manda el cron de Hermes, que siempre empuja su manifiesto
 * entero — sin eso, un documento que Croman saque del manifiesto se quedaria
 * para siempre y el Copiloto lo seguiria citando como vigente. Es opt-in
 * para que un push parcial no pueda vaciar la base por descuido.
 */

/** Los archivos del vault hoy pesan 4-15 KB. 80k caracteres deja aire de
 *  sobra para que crezcan y corta un error de integracion antes de que
 *  llene la base. */
const MAX_CHARS_DOC = 80_000;
const MAX_DOCS = 30;
/** Tope del lote entero, por si alguien manda 30 documentos de 79k. */
const MAX_CHARS_LOTE = 400_000;
/** Clave: la usa el Copiloto para pedir el documento, y viaja en JSON. Se
 *  acota a un slug para que no entre nada raro por ahi. */
const RE_CLAVE = /^[a-z0-9][a-z0-9_-]{0,63}$/;

interface DocEntrada {
  clave?: unknown;
  titulo?: unknown;
  contenido?: unknown;
  origen?: unknown;
  fechado_en?: unknown;
}

function validar(docs: DocEntrada[]): { error: string } | { ok: true } {
  if (!Array.isArray(docs) || docs.length === 0) {
    return { error: "Falta 'documentos' (array no vacío)" };
  }
  if (docs.length > MAX_DOCS) {
    return { error: `Máximo ${MAX_DOCS} documentos por lote` };
  }
  let total = 0;
  const vistas = new Set<string>();
  for (const [i, d] of docs.entries()) {
    const donde = `documentos[${i}]`;
    if (typeof d?.clave !== "string" || !RE_CLAVE.test(d.clave)) {
      return {
        error: `${donde}.clave inválida: minúsculas, dígitos, '-' o '_', hasta 64 caracteres`,
      };
    }
    if (vistas.has(d.clave)) {
      // Dos documentos con la misma clave en un lote: el segundo pisaria al
      // primero en silencio dentro de la misma transaccion.
      return { error: `${donde}.clave duplicada en el lote: '${d.clave}'` };
    }
    vistas.add(d.clave);
    if (typeof d.titulo !== "string" || !d.titulo.trim()) {
      return { error: `${donde}.titulo es obligatorio` };
    }
    if (typeof d.contenido !== "string" || !d.contenido.trim()) {
      return { error: `${donde}.contenido es obligatorio` };
    }
    if (d.contenido.length > MAX_CHARS_DOC) {
      return { error: `${donde}.contenido supera ${MAX_CHARS_DOC} caracteres` };
    }
    if (d.origen !== undefined && typeof d.origen !== "string") {
      return { error: `${donde}.origen debe ser texto` };
    }
    if (
      d.fechado_en !== undefined &&
      d.fechado_en !== null &&
      !(typeof d.fechado_en === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d.fechado_en))
    ) {
      return { error: `${donde}.fechado_en debe ser YYYY-MM-DD` };
    }
    total += d.contenido.length;
  }
  if (total > MAX_CHARS_LOTE) {
    return { error: `El lote supera ${MAX_CHARS_LOTE} caracteres en total` };
  }
  return { ok: true };
}

function autorizado(request: Request): boolean {
  const secreto = process.env.HERMES_INGEST_SECRET;
  return !!secreto && request.headers.get("authorization") === `Bearer ${secreto}`;
}

export async function POST(request: Request) {
  if (!autorizado(request)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body inválido: se esperaba JSON" }, { status: 400 });
  }

  const cuerpo = body as { documentos?: DocEntrada[]; reemplazar_todo?: unknown } | null;
  const docs = cuerpo?.documentos ?? [];
  // Explicito y opt-in: quien empuje un lote PARCIAL (una prueba, un script
  // nuevo) no puede borrar el resto del conocimiento por descuido.
  const reemplazarTodo = cuerpo?.reemplazar_todo === true;
  const v = validar(docs);
  if ("error" in v) {
    return NextResponse.json({ error: v.error }, { status: 400 });
  }

  try {
    // Idempotente y barato: evita que el primer push contra una base limpia
    // falle por tabla inexistente y obligue a correr el script a mano.
    await crearTablaConocimiento();
    await guardarConocimiento(
      docs.map((d) => ({
        clave: d.clave as string,
        titulo: (d.titulo as string).trim(),
        contenido: (d.contenido as string).trim(),
        origen: typeof d.origen === "string" ? d.origen : "hermes",
        fechado_en: typeof d.fechado_en === "string" ? d.fechado_en : null,
      })),
      { reemplazarTodo }
    );
  } catch (e) {
    console.error("POST /api/conocimiento-competencia:", e);
    return NextResponse.json({ error: "No se pudo guardar el conocimiento" }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    guardados: docs.length,
    reemplazo_total: reemplazarTodo,
    claves: docs.map((d) => d.clave),
  });
}

/**
 * Indice de lo que hay cargado. Sirve para que Hermes verifique que su push
 * llego sin tener que abrir la base, y para el panel del dashboard.
 * Devuelve SOLO metadatos: el contenido se lee por la tool del Copiloto.
 */
export async function GET(request: Request) {
  if (!autorizado(request)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  try {
    await crearTablaConocimiento();
    return NextResponse.json({ documentos: await getIndiceConocimiento() });
  } catch (e) {
    console.error("GET /api/conocimiento-competencia:", e);
    return NextResponse.json({ error: "No se pudo leer el índice" }, { status: 500 });
  }
}
