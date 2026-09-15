/**
 * Búsqueda y lectura en internet para el Copiloto.
 *
 * POR QUÉ EXISTE. Con Gemma sobre Ollama se perdieron web_search y
 * web_fetch, que eran tools servidas por Anthropic. Croman (15/09/2026):
 * "si no encuentra lo que se le pregunte que pueda buscar en internet".
 * Esto las reemplaza con dos herramientas LOCALES que corren en el propio
 * servidor: buscar en DuckDuckGo (la versión HTML, sin JavaScript ni clave)
 * y leer una página como texto.
 *
 * ORDEN DE USO. El system prompt lo deja claro: primero los datos propios
 * (CADAM, Cars, Hermes); internet solo para lo que no está ahí —una
 * noticia, un lanzamiento, un dato de otro mercado— y siempre citando la
 * URL. Nada de lo que vuelve de acá es una cifra del mercado paraguayo: esas
 * salen de consultar_base y punto.
 *
 * LÍMITES. DuckDuckGo HTML no tiene API ni garantías: si cambia el marcado,
 * `buscar` devuelve cero resultados y el modelo lo dice, no inventa. Las
 * páginas se leen con timeout corto y se recortan a texto plano: una
 * página entera no entra en el contexto de Gemma (num_ctx chico, ver
 * ollama.ts).
 */

const UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36 SantaRosaAdvisor/1.0";
const TIMEOUT_MS = 12_000;
const MAX_RESULTADOS = 8;
/** Lo que se le entrega al modelo de una página. Más que esto desplaza la
 *  pregunta y las reglas fuera del contexto. */
const MAX_CHARS_PAGINA = 6_000;
const MAX_BYTES_PAGINA = 2_000_000;

export interface ResultadoBusqueda {
  titulo: string;
  url: string;
  resumen: string;
}

function conTimeout(ms: number): AbortSignal {
  const c = new AbortController();
  setTimeout(() => c.abort(), ms).unref?.();
  return c.signal;
}

// Las entidades con nombre que aparecen en páginas en castellano. Las
// numéricas (&#233; / &#x00e9;) se resuelven aparte.
const ENTIDADES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  aacute: "á", eacute: "é", iacute: "í", oacute: "ó", uacute: "ú", ntilde: "ñ", uuml: "ü",
  Aacute: "Á", Eacute: "É", Iacute: "Í", Oacute: "Ó", Uacute: "Ú", Ntilde: "Ñ", Uuml: "Ü",
  iquest: "¿", iexcl: "¡", ndash: "–", mdash: "—", laquo: "«", raquo: "»",
  ldquo: "\u201c", rdquo: "\u201d", lsquo: "\u2018", rsquo: "\u2019", hellip: "…",
  copy: "©", reg: "®", trade: "™", euro: "€", deg: "°", middot: "·", bull: "•",
};

function desentidad(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&([a-zA-Z]+);/g, (m, nombre) => ENTIDADES[nombre] ?? m)
    .replace(/&#39;/g, "'");
}

function sinEtiquetas(html: string): string {
  return desentidad(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

/** DuckDuckGo envuelve el destino en /l/?uddg=<url codificada>. */
function urlReal(href: string): string {
  const m = /[?&]uddg=([^&]+)/.exec(href);
  if (m) {
    try { return decodeURIComponent(m[1]); } catch { /* se deja como vino */ }
  }
  if (href.startsWith("//")) return `https:${href}`;
  return href;
}

export async function buscar(consulta: string): Promise<ResultadoBusqueda[]> {
  const q = consulta.trim().slice(0, 200);
  if (!q) return [];
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}&kl=py-es`;
  const r = await fetch(url, {
    headers: { "User-Agent": UA, "Accept-Language": "es-PY,es;q=0.9" },
    signal: conTimeout(TIMEOUT_MS),
  });
  if (!r.ok) throw new Error(`DuckDuckGo respondió ${r.status}`);
  const html = await r.text();

  // Cada resultado: <a class="result__a" href="…">título</a> … <a class="result__snippet" …>resumen</a>
  const salida: ResultadoBusqueda[] = [];
  const bloques = html.split(/class="result\b/).slice(1);
  for (const b of bloques) {
    const a = /class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/.exec(b);
    if (!a) continue;
    const s = /class="result__snippet"[^>]*>([\s\S]*?)<\/a>/.exec(b);
    const destino = urlReal(desentidad(a[1]));
    if (!/^https?:\/\//.test(destino)) continue;
    salida.push({
      titulo: sinEtiquetas(a[2]).slice(0, 160),
      url: destino,
      resumen: s ? sinEtiquetas(s[1]).slice(0, 300) : "",
    });
    if (salida.length >= MAX_RESULTADOS) break;
  }
  return salida;
}

/** Texto plano de una página, recortado. Sin scripts, estilos ni menús
 *  (nav/header/footer se sacan antes de aplanar). */
export async function leerPagina(url: string): Promise<{ titulo: string; texto: string; recortado: boolean }> {
  let destino: URL;
  try {
    destino = new URL(url);
  } catch {
    throw new Error("URL inválida");
  }
  if (!/^https?:$/.test(destino.protocol)) throw new Error("Solo http(s)");
  // Nada de la red interna: esto lo pide un modelo con una URL que puede
  // venir de un resultado de búsqueda, no de una persona.
  if (/^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|0\.|\[::1\])/.test(destino.hostname)) {
    throw new Error("Dirección no permitida");
  }
  const r = await fetch(destino, {
    headers: { "User-Agent": UA, "Accept-Language": "es-PY,es;q=0.9" },
    signal: conTimeout(TIMEOUT_MS),
    redirect: "follow",
  });
  if (!r.ok) throw new Error(`La página respondió ${r.status}`);
  const tipo = r.headers.get("content-type") ?? "";
  if (!/text\/html|text\/plain|application\/xhtml/.test(tipo)) {
    throw new Error(`No es una página de texto (${tipo.split(";")[0] || "tipo desconocido"})`);
  }
  const crudo = await r.arrayBuffer();
  const html = new TextDecoder("utf-8").decode(crudo.slice(0, MAX_BYTES_PAGINA));

  const titulo = sinEtiquetas(/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? "").slice(0, 160);
  let cuerpo = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<(nav|header|footer|aside)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");
  // Saltos de línea donde el HTML tiene bloques, para que el texto conserve
  // algo de estructura (párrafos, celdas).
  cuerpo = cuerpo.replace(/<\/(p|div|li|tr|h[1-6]|br|td|th|section|article)>/gi, "\n");
  const texto = desentidad(cuerpo.replace(/<[^>]+>/g, " "))
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
  return {
    titulo,
    texto: texto.slice(0, MAX_CHARS_PAGINA),
    recortado: texto.length > MAX_CHARS_PAGINA,
  };
}
