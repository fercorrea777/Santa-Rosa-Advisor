import Anthropic from "@anthropic-ai/sdk";
import { betaTool } from "@anthropic-ai/sdk/helpers/beta/json-schema";
import { NextResponse } from "next/server";
import { armarSystemPrompt } from "@/lib/cadam/copiloto-contexto";
import {
  DESC_CONSULTAR_BASE,
  DESC_LEER_INFORME,
  DESC_SEMANA_ARG,
  DESC_SQL_ARG,
  ejecutarSql,
  leerInformes,
} from "@/lib/copiloto/herramientas";
import { qwenConfigurado, responderConQwen } from "@/lib/copiloto/qwen";

/**
 * Copiloto de inteligencia comercial.
 *
 * Tiene DOS motores, elegidos por el campo "motor" del cuerpo:
 * - "claude" (default): Anthropic, con las 5 herramientas.
 * - "qwen": el modelo local del servidor por Ollama. Solo las 2
 *   herramientas locales (sin internet ni ejecucion de codigo) y bastante
 *   mas lento. Ver src/lib/copiloto/qwen.ts.
 * Si el cliente no manda "motor", se usa claude: el comportamiento de
 * produccion no cambia.
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

const MAX_TURNOS = 40; // historial maximo que aceptamos del cliente
// Mas alto que antes (era 8): con mas herramientas disponibles (SQL + web +
// codigo) una pregunta puede necesitar mas pasos de ida y vuelta.
const MAX_ITERACIONES = 12;

const consultarBase = betaTool({
  name: "consultar_base",
  description: DESC_CONSULTAR_BASE,
  inputSchema: {
    type: "object",
    properties: {
      sql: {
        type: "string",
        description: DESC_SQL_ARG,
      },
    },
    required: ["sql"],
    additionalProperties: false,
  },
  run: (input) => ejecutarSql((input as { sql: string }).sql),
});

const leerInformeCompetencia = betaTool({
  name: "leer_informe_competencia",
  description: DESC_LEER_INFORME,
  inputSchema: {
    type: "object",
    properties: {
      semana: {
        type: "string",
        description: DESC_SEMANA_ARG,
      },
    },
    additionalProperties: false,
  },
  run: (input) => leerInformes(input as { semana?: string }),
});

interface TurnoCliente {
  role: "user" | "assistant";
  content: string;
}

/**
 * Motor de lenguaje a usar.
 * - "claude": Anthropic. Es el DEFAULT y el unico con web/codigo.
 * - "qwen":   modelo local del servidor (Ollama). Sin internet, mas lento.
 * Si el cliente no manda nada, se usa claude: la produccion no cambia.
 */
type Motor = "claude" | "qwen";

export async function POST(request: Request) {
  let turnos: TurnoCliente[];
  let motor: Motor = "claude";
  try {
    const body = await request.json();
    if (body?.motor === "qwen") motor = "qwen";
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

  // ---- Motor local (Qwen por Ollama) --------------------------------
  if (motor === "qwen") {
    if (!qwenConfigurado()) {
      return NextResponse.json(
        {
          error:
            "El motor local no está configurado: faltan QWEN_BASE_URL y/o " +
            "QWEN_MODEL en las variables de entorno de la app.",
        },
        { status: 500 }
      );
    }
    try {
      const { respuesta, truncada } = await responderConQwen(
        armarSystemPrompt(),
        turnos.slice(-MAX_TURNOS)
      );
      return NextResponse.json({
        respuesta: respuesta || "No obtuve respuesta. Probá reformular la pregunta.",
        truncada,
        motor: "qwen",
      });
    } catch (e) {
      const msg = (e as Error).message || "";
      // AbortError = se agoto QWEN_TIMEOUT_MS. Es el caso frecuente: el
      // modelo local es lento y puede no llegar a tiempo.
      const porTiempo = (e as Error).name === "AbortError";
      return NextResponse.json(
        {
          error: porTiempo
            ? "El modelo local tardó demasiado y se cortó la consulta. " +
              "Probá una pregunta más corta o usá Claude."
            : `Error del modelo local: ${msg.slice(0, 300)}`,
        },
        { status: 504 }
      );
    }
  }

  // ---- Motor Anthropic (default) ------------------------------------
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
      motor: "claude",
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
