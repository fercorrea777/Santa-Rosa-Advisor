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

/**
 * Cuanto conocimiento de Hermes entra en una llamada. El vault son ~69 KB:
 * mandarlo entero reventaria el num_ctx de 16k con el que corre Gemma (ver
 * ollama.ts) y el modelo perderia el principio de la conversacion sin avisar.
 *
 * El tope es POR LLAMADA, no por documento, y por eso son dos numeros. Con un
 * tope fijo por documento, el benchmark (9.066 caracteres) se cortaba por 66
 * caracteres contra un limite de 9.000 — justo el final, que es donde suelen
 * estar las tablas. Ahora un documento solo puede usar hasta 12.000 y el
 * conjunto hasta 26.000, asi que el caso comun (benchmark + promociones =
 * 16 KB) entra COMPLETO y solo se recorta cuando de verdad no cabe.
 */
const MAX_DOCS = 3;
const MAX_CHARS_DOC = 12_000;
const MAX_CHARS_TOTAL = 26_000;

/** Anota que fuente se uso, para poder mostrarselo al que pregunta. Un
 *  gerente que ve "salio del benchmark del 03/08" confia distinto que uno
 *  que lee un parrafo sin procedencia. */
type Anotar = (fuente: string) => void;
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

const tConsultarBase = (anotar: Anotar): HerramientaLocal => ({
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
  ejecutar: (input) => {
    anotar("CADAM / DNRA — matriculación e importación");
    return ejecutarSql((input as { sql: string }).sql);
  },
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

const tLeerInformeCompetencia = (anotar: Anotar): HerramientaLocal => ({
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
  ejecutar: (input) => {
    anotar("Informes semanales de competencia");
    return leerInformes(input as { semana?: string });
  },
});

/**
 * Base de conocimiento que empuja Hermes (benchmark de precios de
 * competencia, battle cards, scan diario de promociones, playbook de pauta).
 *
 * ABRE VARIOS DOCUMENTOS DE UNA. Antes era un documento por llamada y el
 * indice se pedia aparte, o sea tres saltos para contestar "JETOUR contra
 * CHERY": indice -> benchmark -> promociones. Gemma no los daba: pedia el
 * indice y contestaba "te recomiendo revisar la clave benchmark", con los
 * datos ahi al lado. Ahora el indice ya viaja en el system prompt y esta
 * tool acepta hasta MAX_DOCS claves juntas, asi que el mismo caso se
 * resuelve en UN salto. Menos saltos, menos lugares donde el modelo se
 * baja a mitad de camino.
 *
 * Sigue aceptando 'clave' suelta: el modelo la inventa igual por costumbre
 * del formato viejo, y rechazarsela solo gastaria una iteracion.
 */
async function leerConocimiento(
  input: { clave?: string; claves?: string[] },
  anotar: Anotar
): Promise<string> {
  const pedidas = [
    ...(input.clave ? [input.clave] : []),
    ...(Array.isArray(input.claves) ? input.claves : []),
  ]
    .map((c) => String(c).trim())
    .filter(Boolean);

  try {
    const indice = await getIndiceConocimiento();

    if (!indice.length) {
      return JSON.stringify({
        error: "La base de conocimiento está vacía: Hermes no empujó nada todavía.",
        instruccion:
          "Decí que no hay precios ni promociones cargados. No los estimes.",
      });
    }
    if (!pedidas.length) {
      // Sin claves no hay nada que leer. Se devuelve el indice igual —pero
      // como error, no como paso valido— porque el prompt ya se lo dio y
      // repetir el viaje es justo lo que se quiso eliminar.
      return JSON.stringify({
        error: "Faltó 'claves'. El índice ya está en tu contexto, no hace falta pedirlo.",
        claves_disponibles: indice.map((d) => d.clave),
        instruccion: "Volvé a llamar con claves: ['benchmark','promociones'].",
      });
    }

    const validas = new Set(indice.map((d) => d.clave));
    const desconocidas = pedidas.filter((c) => !validas.has(c));
    const aLeer = pedidas.filter((c) => validas.has(c)).slice(0, MAX_DOCS);

    const documentos = [];
    let presupuesto = MAX_CHARS_TOTAL;
    for (const clave of aLeer) {
      const doc = await getDocumentoConocimiento(clave);
      if (!doc) continue;
      const tope = Math.min(MAX_CHARS_DOC, presupuesto);
      const recortado = doc.contenido.length > tope;
      const contenido = recortado ? doc.contenido.slice(0, tope) : doc.contenido;
      presupuesto -= contenido.length;
      documentos.push({
        clave: doc.clave,
        titulo: doc.titulo,
        fecha_del_dato: doc.fechado_en,
        empujado_por_hermes: doc.actualizado_en,
        origen: doc.origen,
        contenido,
        recortado: recortado
          ? `RECORTADO: se muestran ${tope} caracteres de ${doc.contenido.length}. ` +
            `Si lo que buscabas podría estar en la parte que falta, decilo.`
          : undefined,
      });
      const fecha = doc.fechado_en ? String(doc.fechado_en).slice(0, 10) : null;
      anotar(`Hermes · ${doc.titulo}${fecha ? ` (dato del ${fecha})` : ""}`);
    }

    return JSON.stringify({
      documentos,
      claves_inexistentes: desconocidas.length ? desconocidas : undefined,
      ignoradas_por_tope: pedidas.length > MAX_DOCS
        ? `Se piden hasta ${MAX_DOCS} por llamada; pedí el resto en otra.`
        : undefined,
      instruccion:
        "Contestá con estos datos. Si algo que te preguntaron no figura acá, " +
        "decilo explícitamente en vez de mandar al usuario a buscarlo.",
    });
  } catch (e) {
    return JSON.stringify({
      error: `No se pudo leer el conocimiento: ${(e as Error).message}`,
    });
  }
}

const tLeerConocimientoCompetencia = (anotar: Anotar): HerramientaLocal => ({
  nombre: "leer_conocimiento_competencia",
  descripcion:
    "Abre los documentos de competencia que mantiene Hermes (agente propio) " +
    "y actualiza por cron: benchmark de PRECIOS de la competencia, battle " +
    "cards modelo contra modelo, scan diario de promociones de las webs " +
    "rivales, playbook de pauta y buyer personas. Es la única fuente de " +
    "precios y promociones de la competencia que tenés — CADAM no los trae y " +
    "no hay internet. EL ÍNDICE DE CLAVES YA ESTÁ EN TU SYSTEM PROMPT: no " +
    "la llames vacía para verlo. Pasá 'claves' con los documentos que " +
    "necesites (hasta 3 juntos, ej. ['benchmark','promociones']) y te " +
    "devuelve el contenido completo con su fecha. Citá esa fecha: parte del " +
    "material se releva a mano y puede tener semanas.",
  parametros: {
    type: "object",
    properties: {
      claves: {
        type: "array",
        items: { type: "string" },
        description:
          "Claves a leer, del índice que ya tenés (hasta 3). Ej.: ['benchmark','promociones'].",
      },
      clave: {
        type: "string",
        description: "Una sola clave. Preferí 'claves' para pedir varias de una.",
      },
    },
    additionalProperties: false,
  },
  ejecutar: (input) =>
    leerConocimiento(input as { clave?: string; claves?: string[] }, anotar),
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

const tLeerOperacion = (anotar: Anotar): HerramientaLocal => ({
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
  ejecutar: (input) => {
    anotar("Cars (DMS propio) — facturación y stock");
    return leerOperacionPropia(input as { que?: string });
  },
});

/**
 * Las cuatro herramientas, creadas POR PREGUNTA para que el registro de
 * fuentes no se mezcle entre pedidos concurrentes. Con consts de modulo, dos
 * gerentes preguntando a la vez se veian las fuentes del otro.
 */
function crearHerramientas(): {
  herramientas: HerramientaLocal[];
  fuentes: string[];
} {
  const fuentes: string[] = [];
  const anotar: Anotar = (f) => {
    if (!fuentes.includes(f)) fuentes.push(f);
  };
  return {
    herramientas: [
      tConsultarBase(anotar),
      tLeerInformeCompetencia(anotar),
      tLeerConocimientoCompetencia(anotar),
      tLeerOperacion(anotar),
    ],
    fuentes,
  };
}

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
    // El indice de Hermes VIAJA EN EL PROMPT (ver copiloto-contexto.ts): sin
    // eso el modelo gasta un salto en descubrir que documentos existen, y ahi
    // es donde se bajaba. Si Postgres no contesta se sigue igual, con el
    // indice vacio: el prompt lo declara vacio y el modelo dice que no hay
    // precios cargados, que es mejor que quedarse sin Copiloto entero.
    let conocimiento: Awaited<ReturnType<typeof getIndiceConocimiento>> = [];
    try {
      conocimiento = await getIndiceConocimiento();
    } catch (e) {
      console.error("Copiloto: no se pudo leer el índice de Hermes:", e);
    }

    const { herramientas, fuentes } = crearHerramientas();
    const r = await responderConGemma({
      // `conWeb: false`: con Ollama no existen web_search ni code_execution,
      // y prometerselas al modelo solo lo lleva a inventar busquedas.
      system: armarSystemPrompt({ conWeb: false, conocimiento }),
      turnos: turnos.slice(-MAX_TURNOS),
      herramientas,
    });
    return NextResponse.json({
      respuesta: r.respuesta,
      // De donde salio. Se muestra debajo de la respuesta: una cifra sin
      // procedencia no sirve para decidir, y el que pregunta no tiene forma
      // de saber si el modelo miro los datos o los invento.
      fuentes,
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
