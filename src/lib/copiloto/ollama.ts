/**
 * Cliente del Copiloto contra Ollama (Gemma 4), por la API compatible con
 * OpenAI que expone en /v1/chat/completions.
 *
 * POR QUE NO SE USA UN SDK. `fetch` alcanza: es una sola llamada POST con un
 * bucle de herramientas escrito a mano. Agregar el SDK de OpenAI para eso
 * traeria una dependencia mas para mantener y no ahorraria nada.
 *
 * QUE SE PIERDE FRENTE A ANTHROPIC. Las tools `web_search`, `web_fetch` y
 * `code_execution` son SERVIDAS POR ANTHROPIC: corren en su infraestructura,
 * no son cosa del modelo. Ollama no tiene equivalente, asi que con Gemma el
 * Copiloto queda sin buscar en la web ni ejecutar codigo. Conserva las cuatro
 * herramientas locales, que son las que leen nuestros datos — y desde que
 * entraron el conocimiento de Hermes y la operacion de Cars, eso cubre casi
 * todo lo que se le pregunta.
 *
 * LIMITES MEDIDOS EN EL SERVIDOR (RTX 5070, 12 GB de VRAM, 02/09/2026):
 *   gemma4:26b            256k de contexto, 18 GB  -> 14 min sin responder
 *   gemma4-hermes-128k    131k de contexto, 9,6 GB -> 15 min sin responder
 *   gemma4-hermes:latest  131k declarado,  3,3 GB  -> 5,6 s, y llama tools
 *
 * O sea que el modelo con MAS contexto en el papel es el que no corre: 12 GB
 * de VRAM no alcanzan ni para el de 9,6. El unico viable es el chico, y el
 * contexto util lo fija `num_ctx` (ver COPILOTO_CTX): pedir 128k reventaria
 * la placa igual, porque el KV cache crece con el contexto, no con el modelo.
 */

export interface HerramientaLocal {
  nombre: string;
  descripcion: string;
  parametros: Record<string, unknown>;
  ejecutar: (input: Record<string, unknown>) => Promise<string> | string;
}

interface MensajeChat {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: LlamadaTool[];
  tool_call_id?: string;
}

interface LlamadaTool {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

export interface ResultadoCopiloto {
  respuesta: string;
  /** Herramientas que se llegaron a ejecutar, para poder explicar de dónde
   *  salió la respuesta si hace falta depurar. */
  herramientasUsadas: string[];
  /** true si se corto por tope de iteraciones y la respuesta puede estar
   *  incompleta. */
  truncada: boolean;
}

/**
 * Donde vive Ollama visto DESDE ADENTRO del contenedor.
 *
 * No es 127.0.0.1: eso es el propio contenedor, y Ollama corre en el host.
 * Medido el 02/09/2026 desde el contenedor de produccion:
 *
 *   127.0.0.1            ECONNREFUSED
 *   host.docker.internal ENOTFOUND      (Docker en Linux no la crea sola)
 *   172.17.0.1           timeout        (bridge por defecto, no es la nuestra)
 *   10.0.1.1             OK, 9 modelos  <- gateway de la red 'coolify'
 *
 * Se prueban en orden y se recuerda la que contesta. La lista existe porque
 * ese 10.0.1.1 lo asigna Docker al crear la red: si algun dia Coolify la
 * recrea con otro rango, el Copiloto se arregla solo en vez de quedar mudo.
 * COPILOTO_OLLAMA_URL saltea todo el mecanismo.
 */
const CANDIDATOS = [
  "http://10.0.1.1:11434",
  "http://172.17.0.1:11434",
  "http://host.docker.internal:11434",
  "http://127.0.0.1:11434",
];

let baseResuelta: string | null = process.env.COPILOTO_OLLAMA_URL ?? null;

async function resolverBase(): Promise<string> {
  if (baseResuelta) return baseResuelta;
  for (const url of CANDIDATOS) {
    try {
      const r = await fetch(`${url}/api/tags`, { signal: AbortSignal.timeout(2500) });
      if (r.ok) {
        baseResuelta = url;
        return url;
      }
    } catch {
      // Siguiente candidato. El error de cada intento no aporta nada: lo que
      // importa es si alguno contesta, y si no contesta ninguno el mensaje
      // final ya nombra la lista completa.
    }
  }
  throw new Error(
    `No se encontró Ollama en ninguna de estas direcciones: ${CANDIDATOS.join(", ")}. ` +
      `Definí COPILOTO_OLLAMA_URL si está en otra.`
  );
}
const MODELO = process.env.COPILOTO_MODELO ?? "gemma4-hermes:latest";
/** Contexto pedido a Ollama. NO es el que declara el modelo: es el que entra
 *  en la placa. El KV cache crece con esto, asi que subirlo sin medir tira el
 *  modelo a CPU y multiplica por cien el tiempo de respuesta. */
const CTX = Number(process.env.COPILOTO_CTX ?? 16384);
/** Ollama descarga el modelo tras 5 minutos ocioso por defecto, y volver a
 *  cargarlo desde cero es lo que hacia fallar la primera pregunta del dia.
 *  Media hora cubre una sesion de trabajo entera. */
const KEEP_ALIVE = process.env.COPILOTO_KEEP_ALIVE ?? "30m";
const MAX_ITERACIONES = 8;
/** Cargar el modelo en frio puede tardar minutos. El `fetch` de Node corta a
 *  los 300 s por su cuenta (UND_ERR_HEADERS_TIMEOUT) sin importar el
 *  AbortSignal, asi que el tope real lo pone el runtime; esto es para que el
 *  nuestro no sea el que corta antes. */
const TIMEOUT_MS = Number(process.env.COPILOTO_TIMEOUT_MS ?? 280_000);

export function modeloCopiloto(): string {
  return MODELO;
}

async function llamar(
  mensajes: MensajeChat[],
  herramientas: HerramientaLocal[]
): Promise<{ mensaje: MensajeChat } | { error: string }> {
  let r: Response;
  let base: string;
  try {
    base = await resolverBase();
  } catch (e) {
    return { error: (e as Error).message };
  }
  try {
    r = await fetch(`${base}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      body: JSON.stringify({
        model: MODELO,
        messages: mensajes,
        // `temperature: 0` no es capricho: este copiloto reporta cifras. Que
        // la misma pregunta dé la misma respuesta importa más que la prosa.
        temperature: 0,
        stream: false,
        keep_alive: KEEP_ALIVE,
        options: { num_ctx: CTX },
        tools: herramientas.map((h) => ({
          type: "function",
          function: {
            name: h.nombre,
            description: h.descripcion,
            parameters: h.parametros,
          },
        })),
      }),
    });
  } catch (e) {
    const err = e as Error;
    if (err.name === "TimeoutError" || err.message.includes("HEADERS_TIMEOUT")) {
      return {
        error:
          "El modelo no respondió a tiempo. Suele pasar en la primera pregunta " +
          "después de un rato, mientras se carga en la placa. Probá de nuevo.",
      };
    }
    return { error: `No se pudo contactar al modelo (${MODELO}): ${err.message}` };
  }

  if (!r.ok) {
    const detalle = (await r.text()).slice(0, 300);
    return { error: `El modelo respondió ${r.status}: ${detalle}` };
  }

  const json = (await r.json()) as {
    choices?: { message?: MensajeChat }[];
  };
  const mensaje = json.choices?.[0]?.message;
  if (!mensaje) return { error: "El modelo devolvió una respuesta vacía." };
  return { mensaje };
}

/**
 * Bucle de herramientas. El SDK de Anthropic traia esto hecho (toolRunner);
 * con Ollama hay que escribirlo, que son veinte lineas.
 */
export async function responderConGemma(params: {
  system: string;
  turnos: { role: "user" | "assistant"; content: string }[];
  herramientas: HerramientaLocal[];
}): Promise<ResultadoCopiloto> {
  const mensajes: MensajeChat[] = [
    { role: "system", content: params.system },
    ...params.turnos.map((t) => ({ role: t.role, content: t.content })),
  ];
  const porNombre = new Map(params.herramientas.map((h) => [h.nombre, h]));
  const usadas: string[] = [];

  for (let i = 0; i < MAX_ITERACIONES; i++) {
    const r = await llamar(mensajes, params.herramientas);
    if ("error" in r) {
      return { respuesta: r.error, herramientasUsadas: usadas, truncada: false };
    }
    const m = r.mensaje;

    if (!m.tool_calls?.length) {
      return {
        respuesta: (m.content ?? "").trim() || "No obtuve respuesta. Probá reformular.",
        herramientasUsadas: usadas,
        truncada: false,
      };
    }

    mensajes.push(m);
    for (const tc of m.tool_calls) {
      const h = porNombre.get(tc.function.name);
      if (!h) {
        mensajes.push({
          role: "tool",
          tool_call_id: tc.id,
          content: JSON.stringify({ error: `No existe la herramienta ${tc.function.name}` }),
        });
        continue;
      }
      let entrada: Record<string, unknown> = {};
      try {
        entrada = tc.function.arguments ? JSON.parse(tc.function.arguments) : {};
      } catch {
        // Un modelo de 8B a veces devuelve argumentos que no son JSON válido.
        // Se le informa en vez de romper: con el error a la vista suele
        // corregirlo en la iteración siguiente.
        mensajes.push({
          role: "tool",
          tool_call_id: tc.id,
          content: JSON.stringify({
            error: "Los argumentos no son JSON válido. Mandá un objeto JSON.",
          }),
        });
        continue;
      }
      usadas.push(h.nombre);
      let salida: string;
      try {
        salida = await h.ejecutar(entrada);
      } catch (e) {
        salida = JSON.stringify({ error: (e as Error).message });
      }
      mensajes.push({ role: "tool", tool_call_id: tc.id, content: salida });
    }
  }

  return {
    respuesta:
      "Me quedé sin pasos antes de llegar a una respuesta. Probá una pregunta " +
      "más acotada (una marca, un período).",
    herramientasUsadas: usadas,
    truncada: true,
  };
}
