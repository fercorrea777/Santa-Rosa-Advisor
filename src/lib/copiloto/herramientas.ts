import { getDb } from "@/lib/cadam/db";
import { getInformesPorSemana, getInformesRecientes } from "@/lib/informes/db";

/**
 * Las dos herramientas LOCALES del copiloto, en un solo lugar.
 *
 * Estaban embebidas en la route de Anthropic. Se extrajeron para que el
 * motor local (Qwen por Ollama) ejecute EXACTAMENTE el mismo codigo: si
 * la validacion de SQL viviera duplicada, un motor podria terminar con
 * un cinturon de seguridad mas flojo que el otro.
 *
 * Las herramientas server-side de Anthropic (web_search, web_fetch,
 * code_execution) NO estan aca: corren en infraestructura de Anthropic y
 * no tienen equivalente local.
 */

export const MAX_FILAS = 200;

const PROHIBIDAS =
  /\b(insert|update|delete|drop|alter|create|replace|attach|detach|pragma|vacuum|reindex|begin|commit|rollback)\b/i;

export function ejecutarSql(consulta: string): string {
  const limpia = consulta.trim().replace(/;+\s*$/, "");
  if (!/^\s*(select|with)\b/i.test(limpia) || PROHIBIDAS.test(limpia) ||
      limpia.includes(";")) {
    return JSON.stringify({
      error: "Solo se permite una única sentencia SELECT (o WITH ... SELECT).",
    });
  }
  try {
    const filas = getDb().prepare(limpia).all();
    const truncado = filas.length > MAX_FILAS;
    return JSON.stringify({
      filas: truncado ? filas.slice(0, MAX_FILAS) : filas,
      total_filas: filas.length,
      truncado_a: truncado ? MAX_FILAS : undefined,
      nota: truncado
        ? "Resultado truncado: agregá con GROUP BY en vez de pedir filas sueltas."
        : undefined,
    });
  } catch (e) {
    return JSON.stringify({ error: `SQL inválido: ${(e as Error).message}` });
  }
}

export async function leerInformes(input: { semana?: string }): Promise<string> {
  try {
    const filas = input.semana
      ? await getInformesPorSemana(input.semana)
      : await getInformesRecientes(12);
    return JSON.stringify({ informes: filas });
  } catch (e) {
    return JSON.stringify({ error: `No se pudo leer informes: ${(e as Error).message}` });
  }
}

export const DESC_CONSULTAR_BASE =
  "Ejecuta una consulta SQL de SOLO LECTURA (SELECT) sobre la base de " +
  "matriculaciones e importaciones de CADAM. Usala para toda cifra que " +
  "vayas a afirmar sobre el mercado interno. Preferí agregaciones (GROUP " +
  "BY) a filas sueltas; el resultado se trunca a 200 filas.";

export const DESC_SQL_ARG =
  "Una única sentencia SELECT (o WITH ... SELECT). Consultá las " +
  "vistas v_matriculacion, v_importacion, v_importacion_camion, " +
  "v_importacion_nev y carga_log.";

export const DESC_LEER_INFORME =
  "Lee los informes semanales de competencia/mercado ya generados " +
  "(precios, noticias, redes, tendencias globales y resumen ejecutivo). " +
  "Solo lectura. Si no pasás 'semana', trae los últimos 12 informes " +
  "guardados (de cualquier semana/dimensión).";

export const DESC_SEMANA_ARG =
  "Fecha del lunes de la semana a consultar, formato YYYY-MM-DD. Opcional.";
