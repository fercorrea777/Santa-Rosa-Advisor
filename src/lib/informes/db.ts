import { Pool } from "pg";

/**
 * Driver: `pg`, no `@vercel/postgres`.
 *
 * Este modulo nacio en Vercel, donde `@vercel/postgres` hablaba con una base
 * Neon. Al mudarse el dashboard a un Postgres propio (Coolify), ese paquete
 * dejo de servir: usa el driver serverless de Neon y RECHAZA una connection
 * string comun con 'invalid_connection_string ... meant to be used with a
 * direct connection'. No es configurable — es otro protocolo. `pg` es el
 * driver estandar y habla TCP con cualquier Postgres.
 */

// Pool unico por proceso. En dev, Next recarga este modulo en cada cambio:
// sin cachearlo en globalThis se abriria un pool nuevo por recarga hasta
// agotar las conexiones de la base.
const globalParaPool = globalThis as unknown as { poolInformes?: Pool };

/** Exportado para conocimiento.ts: es el MISMO Postgres y el mismo pool.
 *  Abrir un segundo pool desde el otro modulo duplicaria las conexiones
 *  contra la misma base sin ninguna ganancia. */
export function getPool(): Pool {
  if (!globalParaPool.poolInformes) {
    const connectionString = process.env.POSTGRES_URL;
    if (!connectionString) {
      throw new Error("Falta POSTGRES_URL");
    }
    globalParaPool.poolInformes = new Pool({
      connectionString,
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    });
  }
  return globalParaPool.poolInformes;
}

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
  const pool = getPool();
  await pool.query(`
    create table if not exists informes_competencia (
      id            bigserial primary key,
      semana        date not null,
      dimension     text not null,
      contenido     text not null,
      fuentes       jsonb not null,
      generado_en   timestamptz not null default now()
    );
  `);
  await pool.query(`
    create index if not exists informes_competencia_semana_dimension_idx
      on informes_competencia (semana, dimension);
  `);
}

export async function guardarInforme(params: {
  semana: string;
  dimension: DimensionInforme;
  contenido: string;
  fuentes: FuenteCitada[];
}): Promise<void> {
  await getPool().query(
    `insert into informes_competencia (semana, dimension, contenido, fuentes)
     values ($1, $2, $3, $4::jsonb)`,
    [params.semana, params.dimension, params.contenido, JSON.stringify(params.fuentes)]
  );
}

/** Upsert manual (delete + insert, sin constraint nuevo en la tabla): a
 *  diferencia del cron semanal, Hermes puede empujar varias veces por día.
 *  Sin esto, cada scan se apilaría como fila nueva y en un par de días la
 *  dimension "hermes_promos" desplazaría al resto de `getInformesRecientes`
 *  (usada tanto por el panel como por la tool del Copiloto). Se queda un
 *  solo registro vivo por semana para esta dimension, con el contenido más
 *  reciente.
 *
 *  Va en una transaccion: si el insert fallara despues del delete, sin esto
 *  quedaria borrado el informe de la semana y ninguno nuevo en su lugar. */
export async function guardarInformeHermes(params: { contenido: string }): Promise<void> {
  const semana = lunesDeEstaSemana();
  const cliente = await getPool().connect();
  try {
    await cliente.query("begin");
    await cliente.query(
      `delete from informes_competencia
       where semana = $1 and dimension = 'hermes_promos'`,
      [semana]
    );
    await cliente.query(
      `insert into informes_competencia (semana, dimension, contenido, fuentes)
       values ($1, 'hermes_promos', $2, '[]'::jsonb)`,
      [semana, params.contenido]
    );
    await cliente.query("commit");
  } catch (e) {
    await cliente.query("rollback");
    throw e;
  } finally {
    cliente.release();
  }
}

export async function getInformesRecientes(limite = 12): Promise<FilaInforme[]> {
  const { rows } = await getPool().query<FilaInforme>(
    `select id, to_char(semana, 'YYYY-MM-DD') as semana, dimension, contenido,
            fuentes, generado_en
     from informes_competencia
     order by semana desc, dimension asc
     limit $1`,
    [limite]
  );
  return rows;
}

export async function getInformesPorSemana(semana: string): Promise<FilaInforme[]> {
  const { rows } = await getPool().query<FilaInforme>(
    `select id, to_char(semana, 'YYYY-MM-DD') as semana, dimension, contenido,
            fuentes, generado_en
     from informes_competencia
     where semana = $1
     order by dimension asc`,
    [semana]
  );
  return rows;
}
