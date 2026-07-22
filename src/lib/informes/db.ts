import { sql } from "@vercel/postgres";

export interface FuenteCitada {
  url: string;
  titulo: string;
  fecha: string;
}

export type DimensionInforme = "precios" | "noticias" | "redes" | "tendencias" | "resumen";

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
