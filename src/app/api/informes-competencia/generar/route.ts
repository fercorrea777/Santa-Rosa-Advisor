import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { getParametros } from "@/lib/cadam/config";
import { guardarInforme, type DimensionInforme, type FuenteCitada } from "@/lib/informes/db";

/**
 * Genera el informe semanal de competencia/mercado. Disparado por Vercel
 * Cron (ver vercel.json), protegido con CRON_SECRET: sin el header
 * correcto, 401. Reparte el trabajo en 4 llamadas en paralelo (una por
 * dimension) para no correr un solo loop largo que arriesgue el limite de
 * duracion de la funcion serverless.
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
      "las marcas propias del grupo. Para cada hallazgo relevante, citá " +
      "la fuente (URL) y la fecha. Cerrá con un resumen de 3-5 puntos.",
  },
  {
    id: "noticias",
    prompt:
      "Buscá noticias y lanzamientos recientes del sector automotor " +
      "paraguayo y regional relevantes para estas marcas. Citá fuente y " +
      "fecha de cada nota. Cerrá con un resumen de 3-5 puntos.",
  },
  {
    id: "redes",
    prompt:
      "Buscá menciones y actividad reciente en redes sociales sobre estas " +
      "marcas de competencia. Citá fuente y fecha. Si la búsqueda no " +
      "encuentra señal útil, decilo explícitamente en vez de forzar una " +
      "conclusión. Cerrá con un resumen de 3-5 puntos.",
  },
  {
    id: "tendencias",
    prompt:
      "Buscá tendencias globales del sector automotor relevantes para " +
      "este mercado: vehículos eléctricos/híbridos, cadena de suministro, " +
      "expansión de marcas chinas en Latinoamérica. Citá fuente y fecha. " +
      "Cerrá con un resumen de 3-5 puntos.",
  },
];

const MAX_ITERACIONES_DIMENSION = 6;

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

async function correrDimension(
  client: Anthropic,
  dimension: { id: DimensionInforme; prompt: string }
): Promise<{ id: DimensionInforme; contenido: string; fuentes: FuenteCitada[] }> {
  const final = await client.beta.messages.toolRunner({
    model: "claude-opus-4-8",
    max_tokens: 4000,
    max_iterations: MAX_ITERACIONES_DIMENSION,
    thinking: { type: "adaptive" },
    system: `Sos un analista de inteligencia comercial para Santa Rosa Paraguay S.A. ${contextoMarcas()} Respondé en español, con evidencia citada (fuente + fecha) para cada afirmación.`,
    tools: [
      { type: "web_search_20260318", name: "web_search" },
      { type: "web_fetch_20260318", name: "web_fetch" },
    ],
    messages: [{ role: "user", content: dimension.prompt }],
  });

  const texto = final.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();

  const fuentes: FuenteCitada[] = final.content
    .filter((b): b is Anthropic.Beta.BetaWebSearchToolResultBlock => b.type === "web_search_tool_result")
    .flatMap((b) => (Array.isArray(b.content) ? b.content : []))
    .map((r) => ({ url: r.url, titulo: r.title, fecha: r.page_age ?? "" }));

  return { id: dimension.id, contenido: texto, fuentes };
}

export async function POST(request: Request) {
  const secreto = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secreto || auth !== `Bearer ${secreto}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "Falta ANTHROPIC_API_KEY" }, { status: 500 });
  }

  const client = new Anthropic();
  const semana = lunesDeEstaSemana();

  const resultados = await Promise.allSettled(
    DIMENSIONES.map((d) => correrDimension(client, d))
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
