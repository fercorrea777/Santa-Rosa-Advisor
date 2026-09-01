import {
  DESC_CONSULTAR_BASE,
  DESC_LEER_INFORME,
  DESC_SEMANA_ARG,
  DESC_SQL_ARG,
  ejecutarSql,
  leerInformes,
} from "./herramientas";

/**
 * Motor local: Qwen 3.8 27B servido por Ollama en el servidor propio.
 *
 * Por que no se reusa el SDK de Anthropic: Ollama expone una API
 * compatible con OpenAI, no con Anthropic. El toolRunner de Anthropic
 * (que da el bucle de herramientas gratis) no sirve contra este
 * endpoint, asi que el bucle esta escrito a mano aca abajo.
 *
 * Por que fetch y no el SDK de OpenAI: el bucle son ~40 lineas y el
 * proyecto no tiene hoy esa dependencia. No vale sumar un paquete para
 * esto.
 *
 * DIFERENCIA IMPORTANTE CON EL MOTOR CLAUDE: aca solo existen las dos
 * herramientas locales (SQL e informes). web_search, web_fetch y
 * code_execution son herramientas server-side de Anthropic y no tienen
 * equivalente en Ollama, asi que con este motor el copiloto NO puede
 * buscar en internet ni ejecutar codigo. El system prompt se ajusta
 * abajo para que el modelo no prometa lo que no puede hacer.
 */

const TIMEOUT_MS = Number(process.env.QWEN_TIMEOUT_MS ?? 300_000);
const MAX_ITERACIONES = 6;

export function qwenConfigurado(): boolean {
  return Boolean(process.env.QWEN_BASE_URL && process.env.QWEN_MODEL);
}

interface MensajeChat {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: LlamadaHerramienta[];
  tool_call_id?: string;
}

interface LlamadaHerramienta {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

const HERRAMIENTAS = [
  {
    type: "function" as const,
    function: {
      name: "consultar_base",
      description: DESC_CONSULTAR_BASE,
      parameters: {
        type: "object",
        properties: { sql: { type: "string", description: DESC_SQL_ARG } },
        required: ["sql"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "leer_informe_competencia",
      description: DESC_LEER_INFORME,
      parameters: {
        type: "object",
        properties: { semana: { type: "string", description: DESC_SEMANA_ARG } },
      },
    },
  },
];

/** Aviso que se agrega al system para que el modelo no ofrezca lo que no tiene. */
const SIN_INTERNET = `

## Límite de este motor
Estás corriendo en el modelo local del servidor. NO tenés acceso a
internet ni a ejecución de código: no dispones de web_search, web_fetch
ni code_execution. Respondé solo con la base interna (consultar_base) y
los informes ya guardados (leer_informe_competencia). Si te preguntan
algo que requiere internet, decilo explícitamente en vez de inventar.`;

async function correrHerramienta(llamada: LlamadaHerramienta): Promise<string> {
  let args: Record<string, unknown> = {};
  try {
    args = JSON.parse(llamada.function.arguments || "{}");
  } catch {
    return JSON.stringify({ error: "Argumentos no son JSON válido." });
  }
  if (llamada.function.name === "consultar_base") {
    return ejecutarSql(String(args.sql ?? ""));
  }
  if (llamada.function.name === "leer_informe_competencia") {
    return leerInformes(args as { semana?: string });
  }
  return JSON.stringify({ error: `Herramienta desconocida: ${llamada.function.name}` });
}

async function pedir(mensajes: MensajeChat[]): Promise<MensajeChat> {
  const base = process.env.QWEN_BASE_URL!.replace(/\/+$/, "");
  const control = new AbortController();
  const reloj = setTimeout(() => control.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(process.env.QWEN_API_KEY
          ? { Authorization: `Bearer ${process.env.QWEN_API_KEY}` }
          : {}),
      },
      body: JSON.stringify({
        model: process.env.QWEN_MODEL,
        messages: mensajes,
        tools: HERRAMIENTAS,
        max_tokens: 4000,
      }),
      signal: control.signal,
    });
    if (!res.ok) {
      const cuerpo = await res.text().catch(() => "");
      throw new Error(`Ollama respondió ${res.status}: ${cuerpo.slice(0, 300)}`);
    }
    const data = await res.json();
    const msg = data?.choices?.[0]?.message;
    if (!msg) throw new Error("Respuesta sin choices[0].message.");
    return msg as MensajeChat;
  } finally {
    clearTimeout(reloj);
  }
}

export async function responderConQwen(
  system: string,
  turnos: { role: "user" | "assistant"; content: string }[]
): Promise<{ respuesta: string; truncada: boolean }> {
  const mensajes: MensajeChat[] = [
    { role: "system", content: system + SIN_INTERNET },
    ...turnos.map((t) => ({ role: t.role, content: t.content })),
  ];

  for (let i = 0; i < MAX_ITERACIONES; i++) {
    const msg = await pedir(mensajes);
    const llamadas = msg.tool_calls ?? [];

    if (!llamadas.length) {
      return { respuesta: (msg.content ?? "").trim(), truncada: false };
    }

    // El mensaje del asistente con las tool_calls tiene que volver al
    // historial ANTES de los resultados, o el modelo pierde el hilo.
    mensajes.push({ role: "assistant", content: msg.content ?? null, tool_calls: llamadas });
    for (const llamada of llamadas) {
      mensajes.push({
        role: "tool",
        tool_call_id: llamada.id,
        content: await correrHerramienta(llamada),
      });
    }
  }

  // Se agotaron las vueltas: pedimos un cierre sin herramientas en vez
  // de devolver vacio.
  const cierre = await pedir([
    ...mensajes,
    {
      role: "user",
      content:
        "Se agotaron las consultas disponibles. Respondé ahora con lo que " +
        "ya obtuviste, aclarando qué quedó sin verificar.",
    },
  ]);
  return { respuesta: (cierre.content ?? "").trim(), truncada: true };
}
