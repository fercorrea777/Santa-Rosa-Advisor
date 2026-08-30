import { sql } from "@vercel/postgres";

export interface FuenteCitada {
  url: string;
  titulo: string;
  fecha: string;
}

export type DimensionInforme =
  | "precios" | "noticias" | "redes" | "tendencias" | "resumen"
  // Empujado por Hermes (agente externo, corre local): scan periódico de
  // promociones de competencia, volcado a un vault Obsidian propio. Ver
  // /api/informes-competencia/hermes.
  | "hermes_promos";

/** Lunes de la semana actual (UTC), formato YYYY-MM-DD. Todas las filas de
 *  informes_competencia agrupan por esto, sea cual sea su origen. */
export function lunesDeEstaSemana(): string {
  const hoy = new Date();
  const dia = hoy.getUTCDay(); // 0=domingo
  const offset = dia === 0 ? -6 : 1 - dia; // retrocede al lunes
  const lunes = new Date(hoy);
  lunes.setUTCDate(hoy.getUTCDate() + offset);
  return lunes.toISOString().slice(0, 10);
}

export interface FilaInforme {
  id: number;
  semana: string; // YYYY-MM-DD (lunes de esa semana)
  dimension: DimensionInforme;
  contenido: string;
  fuentes: FuenteCitada[];
  generado_en: string;
}

/** Crea la tabla si no existe. Se corre una vez desde
 *  scripts/setup-informes-db.mjs, no en cada request. */
export async function crearTablaInformes(): Promise<void> {
  await sql`
    create table if not exists informes_competencia (
      id            bigserial primary key,
      semana        date not null,
      dimension     text not null,
      contenido     text not null,
      fuentes       jsonb not null,
      generado_en   timestamptz not null default now()
    );
  `;
  await sql`
    create index if not exists informes_competencia_semana_dimension_idx
      on informes_competencia (semana, dimension);
  `;
}

export async function guardarInforme(params: {
  semana: string;
  dimension: DimensionInforme;
  contenido: string;
  fuentes: FuenteCitada[];
}): Promise<void> {
  await sql`
    insert into informes_competencia (semana, dimension, contenido, fuentes)
    values (${params.semana}, ${params.dimension}, ${params.contenido}, ${JSON.stringify(params.fuentes)}::jsonb)
  `;
}

/** Upsert manual (delete + insert, sin constraint nuevo en la tabla): a
 *  diferencia del cron semanal, Hermes puede empujar varias veces por día.
 *  Sin esto, cada scan se apilaría como fila nueva y en un par de días la
 *  dimension "hermes_promos" desplazaría al resto de `getInformesRecientes`
 *  (usada tanto por el panel como por la tool del Copiloto). Se queda un
 *  solo registro vivo por semana para esta dimension, con el contenido más
 *  reciente. */
export async function guardarInformeHermes(params: { contenido: string }): Promise<void> {
  const semana = lunesDeEstaSemana();
  await sql`
    delete from informes_competencia
    where semana = ${semana} and dimension = 'hermes_promos'
  `;
  await sql`
    insert into informes_competencia (semana, dimension, contenido, fuentes)
    values (${semana}, 'hermes_promos', ${params.contenido}, '[]'::jsonb)
  `;
}

export async function getInformesRecientes(limite = 12): Promise<FilaInforme[]> {
  const { rows } = await sql<FilaInforme>`
    select id, to_char(semana, 'YYYY-MM-DD') as semana, dimension, contenido, fuentes, generado_en
    from informes_competencia
    order by semana desc, dimension asc
    limit ${limite}
  `;
  return rows;
}

export async function getInformesPorSemana(semana: string): Promise<FilaInforme[]> {
  const { rows } = await sql<FilaInforme>`
    select id, to_char(semana, 'YYYY-MM-DD') as semana, dimension, contenido, fuentes, generado_en
    from informes_competencia
    where semana = ${semana}
    order by dimension asc
  `;
  return rows;
}
