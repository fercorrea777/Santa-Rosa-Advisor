const ZAI_URL = "https://api.z.ai/api/paas/v4/chat/completions";

export interface ZaiMensaje {
  role: "system" | "user" | "assistant";
  content: string;
}

interface ZaiToolCallFuncion {
  name: string;
  arguments: string | Record<string, unknown>;
}

interface ZaiToolCall {
  id: string;
  type: "function";
  function: ZaiToolCallFuncion;
}

interface ZaiChoice {
  message: {
    content: string | null;
    tool_calls?: ZaiToolCall[];
  };
}

interface ZaiRespuesta {
  choices: ZaiChoice[];
}

/**
 * Llama a GLM-5.2 con la tool nativa web_search habilitada. No se declara
 * ningun tool de tipo "function" (esta ruta no necesita ejecutar codigo del
 * lado del cliente), asi que no se espera un loop de tool-use manual: la
 * busqueda la ejecuta Z.ai del lado del servidor y el texto final ya viene
 * con el resultado incorporado, igual que las tools nativas de Claude.
 */
export async function llamarGlmConBusqueda(
  mensajes: ZaiMensaje[],
  maxTokens: number
): Promise<string> {
  const apiKey = process.env.ZAI_API_KEY;
  if (!apiKey) throw new Error("Falta ZAI_API_KEY");

  const res = await fetch(ZAI_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "glm-5.2",
      messages: mensajes,
      max_tokens: maxTokens,
      tool_choice: "auto",
      tools: [
        {
          type: "web_search",
          web_search: {
            enable: true,
            search_engine: "search_pro_jina",
            count: 10,
            search_recency_filter: "noLimit",
          },
        },
      ],
    }),
  });

  if (!res.ok) {
    throw new Error(`Z.ai API error ${res.status}: ${await res.text()}`);
  }

  const data: ZaiRespuesta = await res.json();
  const mensaje = data.choices[0]?.message;
  if (!mensaje) throw new Error("Respuesta de Z.ai sin choices");

  // No se le da ningun tool "function", asi que no debería pedir ejecutar
  // ninguno — si igual lo hace, no hay como resolverlo (no hay handler) y
  // se trata como error explicito en vez de devolver un texto vacio.
  if (mensaje.tool_calls && mensaje.tool_calls.length > 0) {
    throw new Error(
      `Z.ai devolvió tool_calls inesperados (${mensaje.tool_calls.map((t) => t.function.name).join(", ")}) sin tools tipo function declaradas`
    );
  }

  return (mensaje.content ?? "").trim();
}
