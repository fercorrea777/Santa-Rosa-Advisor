import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { getParametros } from "@/lib/cadam/config";
import { llamarGlmConBusqueda } from "@/lib/informes/glm-client";
import { guardarInforme, type DimensionInforme, type FuenteCitada } from "@/lib/informes/db";

/**
 * Genera el informe semanal de competencia/mercado. Disparado por Vercel
 * Cron (ver vercel.json), protegido con CRON_SECRET: sin el header
 * correcto, 401. Reparte el trabajo en 4 llamadas en paralelo (una por
 * dimension, en GLM-5.2) para no correr un solo loop largo que arriesgue el
 * limite de duracion de la funcion serverless. La sintesis final queda en
 * Claude (una llamada corta, sin tools).
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const DIMENSIONES: { id: DimensionInforme; prompt: string }[] = [
  {
    id: "precios",
    prompt:
      "Buscá precios y listas de modelos publicados por concesionarios/" +
      "marcas en Paraguay para las marcas de competencia y compará contra " +
      "las marcas propias del grupo. Para cada hallazgo relevante, mencioná " +
      "la fuente y la fecha. Cerrá con un resumen de 3-5 puntos.",
  },
  {
    id: "noticias",
    prompt:
      "Buscá noticias y lanzamientos recientes del sector automotor " +
      "paraguayo y regional relevantes para estas marcas. Mencioná fuente y " +
      "fecha de cada nota. Cerrá con un resumen de 3-5 puntos.",
  },
  {
    id: "redes",
    prompt:
      "Buscá menciones y actividad reciente en redes sociales sobre estas " +
      "marcas de competencia. Mencioná fuente y fecha. Si la búsqueda no " +
      "encuentra señal útil, decilo explícitamente en vez de forzar una " +
      "conclusión. Cerrá con un resumen de 3-5 puntos.",
  },
  {
    id: "tendencias",
    prompt:
      "Buscá tendencias globales del sector automotor relevantes para " +
      "este mercado: vehículos eléctricos/híbridos, cadena de suministro, " +
      "expansión de marcas chinas en Latinoamérica. Mencioná fuente y " +
      "fecha. Cerrá con un resumen de 3-5 puntos.",
  },
];

// Instrucción de formato para poder parsear las fuentes del texto: Z.ai no
// documenta un campo de citación estructurado, así que se pide como bloque
// al final de la respuesta.
const INSTRUCCION_FUENTES =
  "\n\nAl terminar tu respuesta, agregá un bloque de código ```json con un " +
  'array de las fuentes que usaste, formato exacto: [{"url":"...",' +
  '"titulo":"...","fecha":"YYYY-MM-DD o vacío si no la sabés"}]. Si no ' +
  "usaste ninguna fuente, poné un array vacío [].";

function lunesDeEstaSemana(): string {
  const hoy = new Date();
  const dia = hoy.getUTCDay(); // 0=domingo
  const offset = dia === 0 ? -6 : 1 - dia; // retrocede al lunes
  const lunes = new Date(hoy);
  lunes.setUTCDate(hoy.getUTCDate() + offset);
  return lunes.toISOString().slice(0, 10);
}

function contextoMarcas(): string {
  const p = getParametros();
  const propias = p.marcas_propias.map((m) => m.marca_cadam).join(", ");
  const competidores = p.competidores_clave.join(", ");
  return (
    `Marcas propias de Santa Rosa Paraguay: ${propias}.\n` +
    `Marcas competidoras a vigilar: ${competidores}.\n` +
    `Mercado: automotor paraguayo.`
  );
}

/** Separa el bloque ```json de fuentes del final del texto y lo parsea.
 *  Si no aparece o no parsea, devuelve fuentes vacías y deja el texto
 *  entero como contenido (no se pierde el informe por un bloque mal
 *  formado). */
function extraerFuentes(textoCompleto: string): { contenido: string; fuentes: FuenteCitada[] } {
  const match = textoCompleto.match(/```json\s*([\s\S]*?)\s*```\s*$/);
  if (!match) return { contenido: textoCompleto, fuentes: [] };

  const contenido = textoCompleto.slice(0, match.index).trim();
  try {
    const parsed = JSON.parse(match[1]);
    if (!Array.isArray(parsed)) return { contenido, fuentes: [] };
    const fuentes: FuenteCitada[] = parsed
      .filter((f): f is Record<string, unknown> => typeof f === "object" && f !== null)
      .map((f) => ({
        url: typeof f.url === "string" ? f.url : "",
        titulo: typeof f.titulo === "string" ? f.titulo : "",
        fecha: typeof f.fecha === "string" ? f.fecha : "",
      }))
      .filter((f) => f.url !== "");
    return { contenido, fuentes };
  } catch {
    return { contenido, fuentes: [] };
  }
}

async function correrDimension(
  dimension: { id: DimensionInforme; prompt: string }
): Promise<{ id: DimensionInforme; contenido: string; fuentes: FuenteCitada[] }> {
  const textoCompleto = await llamarGlmConBusqueda(
    [
      {
        role: "system",
        content: `Sos un analista de inteligencia comercial para Santa Rosa Paraguay S.A. ${contextoMarcas()} Respondé en español, con evidencia (fuente + fecha) para cada afirmación.`,
      },
      { role: "user", content: dimension.prompt + INSTRUCCION_FUENTES },
    ],
    4000
  );

  const { contenido, fuentes } = extraerFuentes(textoCompleto);
  return { id: dimension.id, contenido, fuentes };
}

export async function POST(request: Request) {
  const secreto = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secreto || auth !== `Bearer ${secreto}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!process.env.ZAI_API_KEY) {
    return NextResponse.json({ error: "Falta ZAI_API_KEY" }, { status: 500 });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "Falta ANTHROPIC_API_KEY" }, { status: 500 });
  }

  const semana = lunesDeEstaSemana();

  const resultados = await Promise.allSettled(
    DIMENSIONES.map((d) => correrDimension(d))
  );

  const ok: { id: DimensionInforme; contenido: string; fuentes: FuenteCitada[] }[] = [];
  const fallidas: string[] = [];
  for (let i = 0; i < resultados.length; i++) {
    const r = resultados[i];
    if (r.status === "fulfilled") {
      ok.push(r.value);
      await guardarInforme({
        semana,
        dimension: r.value.id,
        contenido: r.value.contenido,
        fuentes: r.value.fuentes,
      });
    } else {
      fallidas.push(DIMENSIONES[i].id);
    }
  }

  if (ok.length > 0) {
    const cuerpoResumen = ok.map((r) => `### ${r.id}\n${r.contenido}`).join("\n\n");
    const client = new Anthropic();
    const resumenFinal = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 2000,
      thinking: { type: "adaptive" },
      messages: [
        {
          role: "user",
          content:
            `Resumí en un informe ejecutivo breve (5-8 puntos) estas ` +
            `${ok.length} secciones de inteligencia de mercado de la semana, ` +
            `para el equipo comercial de Santa Rosa Paraguay:\n\n${cuerpoResumen}`,
        },
      ],
    });
    const textoResumen = resumenFinal.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
    const fuentesResumen = ok.flatMap((r) => r.fuentes);
    await guardarInforme({ semana, dimension: "resumen", contenido: textoResumen, fuentes: fuentesResumen });
  }

  return NextResponse.json({
    semana,
    generadas: ok.map((r) => r.id),
    fallidas,
  });
}
