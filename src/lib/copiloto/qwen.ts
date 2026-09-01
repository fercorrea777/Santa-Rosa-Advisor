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

/**
 * Cuanto se queda el modelo cargado en la GPU despues de responder.
 *
 * El proxy del servidor inyecta keep_alive=30m por default, pensado para
 * el modelo chico del bot de ventas. Para un modelo de 27B eso es
 * peligroso: no entra entero en los 12 GB de la placa, asi que mientras
 * sigue cargado deja sin lugar al bot. El 2026-09-01 eso trabo Ollama y
 * el bot dejo de responder.
 *
 * Mandarlo explicitamente pisa el default del proxy (usa setdefault).
 * Valor mas corto = el bot sufre menos, pero cada pregunta paga la
 * recarga del modelo (minutos). Subilo solo si el copiloto local pasa a
 * tener GPU propia.
 */
const KEEP_ALIVE = process.env.QWEN_KEEP_ALIVE ?? "5m";

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

/** Pedazo de tool_call tal como llega en un delta de streaming. */
interface DeltaLlamada {
  index?: number;
  id?: string;
  function?: { name?: string; arguments?: string };
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

/**
 * Una vuelta contra el modelo, en modo streaming.
 *
 * El streaming NO es para mostrar el texto de a poco (la respuesta se
 * junta entera y se devuelve como JSON): es para que la conexion no se
 * muera. El fetch de Node (undici) corta a los 300 s si el servidor no
 * mando todavia los headers, y ese limite no se puede subir desde el
 * fetch estandar. Con stream:false Ollama no manda nada hasta terminar,
 * asi que toda respuesta que tarde mas de 5 min fallaba con "fetch
 * failed" — y en este modelo, con el prompt grande del copiloto, eso
 * pasa seguido. Con stream:true los headers llegan de inmediato y el
 * unico limite real pasa a ser QWEN_TIMEOUT_MS.
 */
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
        stream: true,
        keep_alive: KEEP_ALIVE,
      }),
      signal: control.signal,
    });
    if (!res.ok) {
      const cuerpo = await res.text().catch(() => "");
      throw new Error(`Ollama respondió ${res.status}: ${cuerpo.slice(0, 300)}`);
    }
    if (!res.body) throw new Error("Respuesta sin cuerpo.");
    return await juntarStream(res.body);
  } finally {
    clearTimeout(reloj);
  }
}

/**
 * Rearma el mensaje completo a partir de los deltas SSE.
 *
 * Las tool_calls llegan partidas: el nombre en un delta y los argumentos
 * de a pedacitos en los siguientes, todos identificados por "index".
 * Por eso se acumulan en un mapa por index y recien al final se ordenan.
 */
async function juntarStream(cuerpo: ReadableStream<Uint8Array>): Promise<MensajeChat> {
  const lector = cuerpo.getReader();
  const decoder = new TextDecoder();
  let pendiente = "";
  let texto = "";
  const porIndice = new Map<number, LlamadaHerramienta>();

  for (;;) {
    const { done, value } = await lector.read();
    if (done) break;
    pendiente += decoder.decode(value, { stream: true });

    // SSE: eventos separados por linea en blanco; nos alcanza con procesar
    // linea a linea y guardar la ultima si quedo cortada.
    const lineas = pendiente.split("\n");
    pendiente = lineas.pop() ?? "";

    for (const linea of lineas) {
      const limpia = linea.trim();
      if (!limpia.startsWith("data:")) continue;
      const carga = limpia.slice(5).trim();
      if (!carga || carga === "[DONE]") continue;

      let evento: {
        choices?: { delta?: { content?: string; tool_calls?: DeltaLlamada[] } }[];
      };
      try {
        evento = JSON.parse(carga);
      } catch {
        continue; // fragmento incompleto o linea de keep-alive
      }

      const delta = evento.choices?.[0]?.delta;
      if (!delta) continue;
      if (delta.content) texto += delta.content;

      for (const tc of delta.tool_calls ?? []) {
        const i = tc.index ?? 0;
        const acumulada = porIndice.get(i) ?? {
          id: "", type: "function" as const, function: { name: "", arguments: "" },
        };
        if (tc.id) acumulada.id = tc.id;
        if (tc.function?.name) acumulada.function.name = tc.function.name;
        if (tc.function?.arguments) acumulada.function.arguments += tc.function.arguments;
        porIndice.set(i, acumulada);
      }
    }
  }

  const llamadas = [...porIndice.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([i, ll]) => ({ ...ll, id: ll.id || `call_${i}` }));

  return {
    role: "assistant",
    content: texto || null,
    ...(llamadas.length ? { tool_calls: llamadas } : {}),
  };
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
