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
import {
  modeloCopiloto, responderConGemma, type HerramientaLocal,
} from "@/lib/copiloto/ollama";

/**
 * Copiloto de inteligencia comercial.
 *
 * PROVEEDOR: Gemma 4 sobre el Ollama del propio servidor, NO la API de
 * Anthropic (cambio del 02/09/2026). El motivo inmediato fue que la
 * ANTHROPIC_API_KEY de produccion tenia un placeholder de Ollama pegado
 * encima y el Copiloto llevaba dias respondiendo "clave no valida" a todo.
 * El motivo de fondo es que el modelo corre en la casa y no se paga por
 * pregunta. Ver src/lib/copiloto/ollama.ts para los limites medidos.
 *
 * SE PERDIERON web_search, web_fetch y code_execution: son tools SERVIDAS
 * por Anthropic, no del modelo, y Ollama no tiene equivalente. Quedan las
 * cuatro locales, que son las que leen nuestros datos.
 *
 * El modelo responde preguntas en lenguaje natural con estas fuentes:
 * - consultar_base: SQL de solo lectura sobre la MISMA base SQLite que
 *   alimenta los dashboards. Es la unica fuente de verdad para cifras de
 *   matriculacion/importacion.
 * - leer_informe_competencia: informes semanales ya generados.
 * - leer_conocimiento_competencia: lo que releva Hermes (precios y
 *   promociones de competencia).
 * - leer_operacion_propia: nuestra facturacion y stock (API de Cars).
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
// El tope de iteraciones del bucle de herramientas vive ahora en
// src/lib/copiloto/ollama.ts, junto al bucle que lo usa.

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

const consultarBase: HerramientaLocal = {
  nombre: "consultar_base",
  descripcion:
    "Ejecuta una consulta SQL de SOLO LECTURA (SELECT) sobre la base de " +
    "matriculaciones e importaciones de CADAM. Usala para toda cifra que " +
    "vayas a afirmar sobre el mercado interno. Preferí agregaciones (GROUP " +
    "BY) a filas sueltas; el resultado se trunca a 200 filas.",
  parametros: {
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
  ejecutar: (input) => ejecutarSql((input as { sql: string }).sql),
};

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

const leerInformeCompetencia: HerramientaLocal = {
  nombre: "leer_informe_competencia",
  descripcion:
    "Lee los informes semanales de competencia/mercado ya generados " +
    "(precios, noticias, redes, tendencias globales y resumen ejecutivo). " +
    "Solo lectura. Si no pasás 'semana', trae los últimos 12 informes " +
    "guardados (de cualquier semana/dimensión).",
  parametros: {
    type: "object",
    properties: {
      semana: {
        type: "string",
        description: "Fecha del lunes de la semana a consultar, formato YYYY-MM-DD. Opcional.",
      },
    },
    additionalProperties: false,
  },
  ejecutar: (input) => leerInformes(input as { semana?: string }),
};

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

const leerConocimientoCompetencia: HerramientaLocal = {
  nombre: "leer_conocimiento_competencia",
  descripcion:
    "Base de conocimiento de competencia que mantiene Hermes (agente propio) " +
    "y actualiza por cron: benchmark de PRECIOS de la competencia, battle " +
    "cards modelo contra modelo, scan diario de promociones de las webs " +
    "rivales, playbook de pauta y buyer personas. Es la única fuente interna " +
    "de precios y promociones de la competencia — CADAM no los trae. " +
    "Llamala SIN argumentos para ver el índice (clave, título y cuándo se " +
    "actualizó cada documento) y después con 'clave' para leer uno. " +
    "Mirá siempre la fecha: parte de este material se releva a mano y puede " +
    "tener semanas.",
  parametros: {
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
  ejecutar: (input) => leerConocimiento(input as { clave?: string }),
};

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

const leerOperacion: HerramientaLocal = {
  nombre: "leer_operacion_propia",
  descripcion:
    "Datos de la operación de Santa Rosa que salen del API de Cars (el DMS " +
    "de la casa), no de CADAM: unidades FACTURADAS por mes/marca/modelo, y " +
    "el STOCK actual por marca/modelo/estado con su precio de lista en " +
    "dólares. Usala para preguntas sobre cómo vamos NOSOTROS (cuánto " +
    "vendimos, qué tenemos, cuánto stock queda de un modelo). Ojo: factura " +
    "no es matriculación, y no hay importes de facturación disponibles.",
  parametros: {
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
  ejecutar: (input) => leerOperacionPropia(input as { que?: string }),
};

interface TurnoCliente {
  role: "user" | "assistant";
  content: string;
}

export async function POST(request: Request) {
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

  try {
    const r = await responderConGemma({
      // `conWeb: false`: con Ollama no existen web_search ni code_execution,
      // y prometerselas al modelo solo lo lleva a inventar busquedas.
      system: armarSystemPrompt({ conWeb: false }),
      turnos: turnos.slice(-MAX_TURNOS),
      herramientas: [
        consultarBase,
        leerInformeCompetencia,
        leerConocimientoCompetencia,
        leerOperacion,
      ],
    });
    return NextResponse.json({
      respuesta: r.respuesta,
      truncada: r.truncada,
      modelo: modeloCopiloto(),
    });
  } catch (e) {
    console.error("POST /api/copiloto:", e);
    return NextResponse.json(
      { error: `El copiloto falló: ${(e as Error).message}` },
      { status: 500 }
    );
  }
}
