import { getPool } from "./db";

/**
 * Base de conocimiento de competencia que empuja Hermes (agente propio, corre
 * en la PC de Croman, fuera de este repo).
 *
 * POR QUE UNA TABLA APARTE Y NO `informes_competencia`
 * ---------------------------------------------------
 * Son dos cosas distintas aunque las dos hablen de competencia:
 *
 *  - `informes_competencia` es una SERIE SEMANAL. Cada fila es el informe de
 *    esa semana y tiene sentido leerlo en orden cronologico.
 *  - esto es un ESTADO ACTUAL. El benchmark de precios no es "el benchmark de
 *    esta semana": es el benchmark, y cuando cambia se pisa. Guardarlo como
 *    fila semanal le haria creer al Copiloto que hay un benchmark nuevo cada
 *    lunes, y ademas inundaria `getInformesRecientes(12)` — que no filtra por
 *    dimension — dejando fuera a los informes semanales de verdad, tanto en
 *    el panel como en la tool del Copiloto.
 *
 * Upsert por `clave`: un documento vivo por clave, con la fecha de la ultima
 * vez que Hermes lo empujo.
 */

export interface DocumentoConocimiento {
  clave: string;
  titulo: string;
  contenido: string;
  /** De donde salio (ruta del vault, script, URL). Para poder auditar. */
  origen: string;
  /** Fecha que declara el propio documento, si la trae (frontmatter de
   *  Obsidian). Distinta de `actualizado_en`, que es cuando llego aca: un
   *  benchmark de agosto empujado hoy sigue siendo de agosto. */
  fechado_en: string | null;
  actualizado_en: string;
}

/** Fila del indice: todo menos el contenido. Es lo que ve el Copiloto antes
 *  de decidir que documento abrir — mandarle los 60 KB de golpe en cada
 *  pregunta seria tirar contexto a la basura. */
export interface EntradaIndice {
  clave: string;
  titulo: string;
  origen: string;
  fechado_en: string | null;
  actualizado_en: string;
  caracteres: number;
}

export async function crearTablaConocimiento(): Promise<void> {
  const pool = getPool();
  await pool.query(`
    create table if not exists conocimiento_competencia (
      clave          text primary key,
      titulo         text not null,
      contenido      text not null,
      origen         text not null,
      fechado_en     date,
      actualizado_en timestamptz not null default now()
    );
  `);
}

export async function guardarConocimiento(
  docs: { clave: string; titulo: string; contenido: string; origen: string; fechado_en?: string | null }[]
): Promise<void> {
  if (!docs.length) return;
  const cliente = await getPool().connect();
  try {
    // Una transaccion para todo el lote: Hermes empuja el vault entero de una,
    // y media base de conocimiento actualizada es peor que ninguna — el
    // Copiloto cruzaria un benchmark nuevo con battle cards viejas sin que
    // nada lo delate.
    await cliente.query("begin");
    for (const d of docs) {
      await cliente.query(
        `insert into conocimiento_competencia
           (clave, titulo, contenido, origen, fechado_en, actualizado_en)
         values ($1, $2, $3, $4, $5::date, now())
         on conflict (clave) do update set
           titulo = excluded.titulo,
           contenido = excluded.contenido,
           origen = excluded.origen,
           fechado_en = excluded.fechado_en,
           actualizado_en = now()`,
        [d.clave, d.titulo, d.contenido, d.origen, d.fechado_en || null]
      );
    }
    await cliente.query("commit");
  } catch (e) {
    await cliente.query("rollback");
    throw e;
  } finally {
    cliente.release();
  }
}

export async function getIndiceConocimiento(): Promise<EntradaIndice[]> {
  const { rows } = await getPool().query<EntradaIndice>(
    `select clave, titulo, origen,
            to_char(fechado_en, 'YYYY-MM-DD') as fechado_en,
            actualizado_en,
            length(contenido) as caracteres
     from conocimiento_competencia
     order by actualizado_en desc`
  );
  return rows;
}

export async function getDocumentoConocimiento(
  clave: string
): Promise<DocumentoConocimiento | null> {
  const { rows } = await getPool().query<DocumentoConocimiento>(
    `select clave, titulo, contenido, origen,
            to_char(fechado_en, 'YYYY-MM-DD') as fechado_en,
            actualizado_en
     from conocimiento_competencia
     where clave = $1`,
    [clave]
  );
  return rows[0] ?? null;
}
