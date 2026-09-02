import Anthropic from "@anthropic-ai/sdk";
import { betaTool } from "@anthropic-ai/sdk/helpers/beta/json-schema";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/cadam/db";
import { armarSystemPrompt } from "@/lib/cadam/copiloto-contexto";
import { getInformesPorSemana, getInformesRecientes } from "@/lib/informes/db";
import {
  getDocumentoConocimiento, getIndiceConocimiento,
} from "@/lib/informes/conocimiento";
import {
  getEstadoSyncPropio, getStockPropio, getVentasPropias,
} from "@/lib/informes/propios";

/**
 * Copiloto de inteligencia comercial.
 *
 * Claude responde preguntas en lenguaje natural con dos tipos de fuente:
 * - consultar_base: SQL de solo lectura sobre la MISMA base SQLite que
 *   alimenta los dashboards. Es la unica fuente de verdad para cifras de
 *   matriculacion/importacion.
 * - web_search / web_fetch / code_execution: herramientas server-side de
 *   Anthropic para informacion externa de mercado/competencia y analisis
 *   ad-hoc. code_execution corre en un sandbox aislado sin acceso a la
 *   base interna ni a la red mas alla de lo que la propia tool necesita.
 * - leer_informe_competencia: lectura de los informes semanales generados
 *   por el job programado (ver /api/informes-competencia/generar).
 *
 * Seguridad de consultar_base (sin cambios):
 * - La conexion de la app ya se abre con { readonly: true } (db.ts), y
 *   ademas se valida que el texto sea UNA unica sentencia SELECT/WITH
 *   (sin PRAGMA/ATTACH/etc.). Doble cinturon.
 * - El resultado se trunca a 200 filas: si Claude necesita mas, tiene
 *   que agregar (GROUP BY), que es lo que corresponde.
 */

export const runtime = "nodejs";
// La respuesta depende de la base y del historial: nunca cachear.
export const dynamic = "force-dynamic";

const MAX_FILAS = 200;
const MAX_TURNOS = 40; // historial maximo que aceptamos del cliente
// Mas alto que antes (era 8): con mas herramientas disponibles (SQL + web +
// codigo) una pregunta puede necesitar mas pasos de ida y vuelta.
const MAX_ITERACIONES = 12;

const PROHIBIDAS =
  /\b(insert|update|delete|drop|alter|create|replace|attach|detach|pragma|vacuum|reindex|begin|commit|rollback)\b/i;

function ejecutarSql(consulta: string): string {
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

const consultarBase = betaTool({
  name: "consultar_base",
  description:
    "Ejecuta una consulta SQL de SOLO LECTURA (SELECT) sobre la base de " +
    "matriculaciones e importaciones de CADAM. Usala para toda cifra que " +
    "vayas a afirmar sobre el mercado interno. Preferí agregaciones (GROUP " +
    "BY) a filas sueltas; el resultado se trunca a 200 filas.",
  inputSchema: {
    type: "object",
    properties: {
      sql: {
        type: "string",
        description:
          "Una única sentencia SELECT (o WITH ... SELECT). Consultá las " +
          "vistas v_matriculacion, v_importacion, v_importacion_camion, " +
          "v_importacion_nev y carga_log.",
      },
    },
    required: ["sql"],
    additionalProperties: false,
  },
  run: (input) => ejecutarSql((input as { sql: string }).sql),
});

async function leerInformes(input: { semana?: string }): Promise<string> {
  try {
    const filas = input.semana
      ? await getInformesPorSemana(input.semana)
      : await getInformesRecientes(12);
    return JSON.stringify({ informes: filas });
  } catch (e) {
    return JSON.stringify({ error: `No se pudo leer informes: ${(e as Error).message}` });
  }
}

const leerInformeCompetencia = betaTool({
  name: "leer_informe_competencia",
  description:
    "Lee los informes semanales de competencia/mercado ya generados " +
    "(precios, noticias, redes, tendencias globales y resumen ejecutivo). " +
    "Solo lectura. Si no pasás 'semana', trae los últimos 12 informes " +
    "guardados (de cualquier semana/dimensión).",
  inputSchema: {
    type: "object",
    properties: {
      semana: {
        type: "string",
        description: "Fecha del lunes de la semana a consultar, formato YYYY-MM-DD. Opcional.",
      },
    },
    additionalProperties: false,
  },
  run: (input) => leerInformes(input as { semana?: string }),
});

/**
 * Base de conocimiento que empuja Hermes (benchmark de precios de
 * competencia, battle cards, scan diario de promociones, playbook de pauta).
 *
 * Dos pasos a proposito — indice primero, documento despues. El vault entero
 * son ~60 KB de markdown: meterlo en el system prompt lo pagaria CADA
 * pregunta, incluidas las que no hablan de competencia. Asi el modelo ve un
 * indice de una linea por documento y abre solo el que necesita.
 */
async function leerConocimiento(input: { clave?: string }): Promise<string> {
  try {
    if (!input.clave) {
      const indice = await getIndiceConocimiento();
      return JSON.stringify({
        documentos: indice,
        nota: indice.length
          ? "Volvé a llamar con 'clave' para leer el contenido de uno."
          : "Hermes todavía no empujó nada. No inventes: decí que no hay conocimiento cargado.",
      });
    }
    const doc = await getDocumentoConocimiento(input.clave);
    if (!doc) {
      const indice = await getIndiceConocimiento();
      return JSON.stringify({
        error: `No existe el documento '${input.clave}'`,
        claves_disponibles: indice.map((d) => d.clave),
      });
    }
    return JSON.stringify({ documento: doc });
  } catch (e) {
    return JSON.stringify({
      error: `No se pudo leer el conocimiento: ${(e as Error).message}`,
    });
  }
}

const leerConocimientoCompetencia = betaTool({
  name: "leer_conocimiento_competencia",
  description:
    "Base de conocimiento de competencia que mantiene Hermes (agente propio) " +
    "y actualiza por cron: benchmark de PRECIOS de la competencia, battle " +
    "cards modelo contra modelo, scan diario de promociones de las webs " +
    "rivales, playbook de pauta y buyer personas. Es la única fuente interna " +
    "de precios y promociones de la competencia — CADAM no los trae. " +
    "Llamala SIN argumentos para ver el índice (clave, título y cuándo se " +
    "actualizó cada documento) y después con 'clave' para leer uno. " +
    "Mirá siempre la fecha: parte de este material se releva a mano y puede " +
    "tener semanas.",
  inputSchema: {
    type: "object",
    properties: {
      clave: {
        type: "string",
        description:
          "Clave del documento a leer, sacada del índice. Omitila para pedir el índice.",
      },
    },
    additionalProperties: false,
  },
  run: (input) => leerConocimiento(input as { clave?: string }),
});

/**
 * Operacion propia (API de Cars): facturacion y stock de la casa.
 *
 * Va como tool y no dentro de consultar_base porque vive en Postgres, no en
 * la SQLite de CADAM. El modelo tiene que poder cruzar las dos —"facturamos
 * X, se matricularon Y"— y para eso necesita las dos fuentes por separado,
 * con la advertencia de que NO miden lo mismo.
 */
async function leerOperacionPropia(input: { que?: string }): Promise<string> {
  try {
    const [ventas, stock, sync] = await Promise.all([
      getVentasPropias(),
      getStockPropio(),
      getEstadoSyncPropio(),
    ]);
    const aviso =
      "Cars cuenta FACTURAS (cuándo emitimos la factura); CADAM cuenta " +
      "MATRICULACIONES (cuándo la DNRA registró el vehículo). Son eventos " +
      "distintos y en distinto momento: no los presentes como el mismo dato " +
      "ni restes uno del otro como si la diferencia fuera un error. Acá NO " +
      "hay importes: los que devuelve Cars son inconsistentes y se " +
      "descartaron a propósito — si te preguntan facturación en dinero, " +
      "decí que no está disponible en vez de estimarla.";
    if (input.que === "stock") {
      return JSON.stringify({ stock, sincronizado: sync?.actualizado_en, aviso });
    }
    if (input.que === "ventas") {
      return JSON.stringify({ ventas, sincronizado: sync?.actualizado_en, aviso });
    }
    return JSON.stringify({ ventas, stock, sincronizado: sync?.actualizado_en, aviso });
  } catch (e) {
    return JSON.stringify({
      error: `No se pudo leer la operación propia: ${(e as Error).message}`,
    });
  }
}

const leerOperacion = betaTool({
  name: "leer_operacion_propia",
  description:
    "Datos de la operación de Santa Rosa que salen del API de Cars (el DMS " +
    "de la casa), no de CADAM: unidades FACTURADAS por mes/marca/modelo, y " +
    "el STOCK actual por marca/modelo/estado con su precio de lista en " +
    "dólares. Usala para preguntas sobre cómo vamos NOSOTROS (cuánto " +
    "vendimos, qué tenemos, cuánto stock queda de un modelo). Ojo: factura " +
    "no es matriculación, y no hay importes de facturación disponibles.",
  inputSchema: {
    type: "object",
    properties: {
      que: {
        type: "string",
        enum: ["ventas", "stock", "todo"],
        description:
          "Acotá a 'ventas' o 'stock' cuando alcance: 'todo' devuelve ~1.000 filas.",
      },
    },
    additionalProperties: false,
  },
  run: (input) => leerOperacionPropia(input as { que?: string }),
});

interface TurnoCliente {
  role: "user" | "assistant";
  content: string;
}

export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      {
        error:
          "Falta ANTHROPIC_API_KEY en .env.local de la app. " +
          "Agregala y reiniciá el servidor.",
      },
      { status: 500 }
    );
  }

  let turnos: TurnoCliente[];
  try {
    const body = await request.json();
    turnos = (body?.mensajes ?? []) as TurnoCliente[];
    if (!Array.isArray(turnos) || !turnos.length) throw new Error("vacío");
    if (
      !turnos.every(
        (t) =>
          (t.role === "user" || t.role === "assistant") &&
          typeof t.content === "string" &&
          t.content.length > 0 &&
          t.content.length < 8000
      )
    ) {
      throw new Error("formato");
    }
  } catch {
    return NextResponse.json(
      { error: "Cuerpo inválido: se espera { mensajes: [{role, content}] }." },
      { status: 400 }
    );
  }

  const client = new Anthropic();

  try {
    const final = await client.beta.messages.toolRunner({
      model: "claude-opus-4-8",
      max_tokens: 8000,
      max_iterations: MAX_ITERACIONES,
      thinking: { type: "adaptive" },
      // El system es estable (el estado variable va al final del texto):
      // se cachea entre preguntas de la misma sesion y entre usuarios.
      system: [
        {
          type: "text",
          text: armarSystemPrompt(),
          cache_control: { type: "ephemeral" },
        },
      ],
      tools: [
        consultarBase,
        leerInformeCompetencia,
        leerConocimientoCompetencia,
        leerOperacion,
        { type: "web_search_20260318", name: "web_search" },
        { type: "web_fetch_20260318", name: "web_fetch" },
        { type: "code_execution_20260521", name: "code_execution" },
      ],
      messages: turnos.slice(-MAX_TURNOS).map((t) => ({
        role: t.role,
        content: t.content,
      })),
    });

    if (final.stop_reason === "refusal") {
      return NextResponse.json({
        respuesta:
          "No puedo responder esa consulta. Reformulala sobre los datos del mercado.",
      });
    }

    const texto = final.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();

    return NextResponse.json({
      respuesta: texto || "No obtuve respuesta. Probá reformular la pregunta.",
      truncada: final.stop_reason === "max_tokens",
    });
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) {
      return NextResponse.json(
        { error: "La clave de API no es válida. Revisá ANTHROPIC_API_KEY." },
        { status: 500 }
      );
    }
    if (e instanceof Anthropic.RateLimitError) {
      return NextResponse.json(
        { error: "Límite de uso de la API alcanzado. Esperá un momento y reintentá." },
        { status: 429 }
      );
    }
    if (e instanceof Anthropic.APIError) {
      return NextResponse.json(
        { error: `Error de la API de Claude (${e.status}): ${e.message}` },
        { status: 502 }
      );
    }
    throw e;
  }
}
