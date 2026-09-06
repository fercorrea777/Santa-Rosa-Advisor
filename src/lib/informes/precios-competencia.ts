import { getPool } from "./db";

/**
 * Precios de lista de la COMPETENCIA, por versión, empujados por Hermes.
 *
 * De dónde salen: las marcas casi no publican precio en su propio sitio
 * (CHERY: cero, con navegador real, en 10 páginas). Datacar publica un
 * catálogo 0km con precio por versión para 13 marcas. No es lista oficial,
 * y por eso cada fila lleva `fuente`: la pantalla lo dice. Lo que le da
 * crédito: para NISSAN —la única que sí publica— coincide exactamente con
 * el precio oficial.
 *
 * Para qué: el mapa segmento × banda de precio (mercado contra nosotros) y
 * el precio relativo de cada versión nuestra contra su banda. Sin esto,
 * CADAM da unidades pero ningún precio de terceros.
 *
 * Cada push reemplaza TODAS las filas de esa fuente: el catálogo es una
 * foto, no un histórico. Lo que Datacar deja de listar deja de estar.
 */

export interface PrecioCompetencia {
  marca: string;
  version: string;
  precio_usd: number;
  /** "datacar" hoy. Nunca se mezcla con la lista propia de Cars. */
  fuente: string;
  actualizado_en: string;
}

export async function crearTablaPreciosCompetencia(): Promise<void> {
  await getPool().query(`
    create table if not exists precio_competencia (
      marca          text not null,
      version        text not null,
      precio_usd     integer not null,
      fuente         text not null,
      actualizado_en timestamptz not null default now(),
      primary key (marca, version, fuente)
    );
  `);
}

export async function guardarPreciosCompetencia(
  fuente: string,
  precios: { marca: string; version: string; precio_usd: number }[]
): Promise<void> {
  const cliente = await getPool().connect();
  try {
    await cliente.query("begin");
    await cliente.query("delete from precio_competencia where fuente = $1", [fuente]);
    for (const p of precios) {
      await cliente.query(
        `insert into precio_competencia (marca, version, precio_usd, fuente)
         values ($1, $2, $3, $4)
         on conflict (marca, version, fuente) do update
           set precio_usd = excluded.precio_usd, actualizado_en = now()`,
        [p.marca, p.version, p.precio_usd, fuente]
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

/** Todas las filas. [] si la tabla no existe todavía (nunca hubo push). */
export async function getPreciosCompetencia(): Promise<PrecioCompetencia[]> {
  try {
    const { rows } = await getPool().query<PrecioCompetencia & { actualizado_en: Date }>(
      `select marca, version, precio_usd, fuente, actualizado_en
       from precio_competencia order by marca, precio_usd`
    );
    return rows.map((r) => ({ ...r, actualizado_en: new Date(r.actualizado_en).toISOString() }));
  } catch {
    return [];
  }
}
