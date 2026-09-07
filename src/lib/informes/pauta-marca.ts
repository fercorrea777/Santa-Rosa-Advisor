import { getPool } from "./db";

/**
 * Gasto de pauta en Meta por MARCA y mes, empujado por Hermes
 * (advisor-pauta-marca.py). Sirve para una sola pregunta: cuánto cuesta en
 * pauta cada vehículo que vendemos, marca por marca.
 *
 * La marca sale del nombre de la cuenta publicitaria ("GWM Paraguay",
 * "Antonio Ojeda | GWM"): Meta no sabe de marcas. Las cuentas que mezclan
 * dos ("JAC/RENAULT CDE") van a VARIAS y las de usados a RENEW: se muestran
 * en el total, no se reparten a ojo entre marcas.
 *
 * Los leads siguen la regla de siempre: MÁXIMO entre `lead` y
 * `lead_grouped`, nunca la suma (son el mismo lead con dos nombres).
 */

export interface PautaMarca {
  periodo: string; // YYYY-MM
  marca: string;
  gasto_usd: number;
  leads: number;
  /** Cuántas cuentas publicitarias suman en esa fila. */
  cuentas: number;
}

export async function crearTablaPautaMarca(): Promise<void> {
  await getPool().query(`
    create table if not exists pauta_marca (
      periodo        text not null,
      marca          text not null,
      gasto_usd      numeric(12, 2) not null,
      leads          integer not null default 0,
      cuentas        integer not null default 0,
      actualizado_en timestamptz not null default now(),
      primary key (periodo, marca)
    );
  `);
}

export async function guardarPautaMarca(filas: PautaMarca[]): Promise<void> {
  const cliente = await getPool().connect();
  try {
    await cliente.query("begin");
    await cliente.query("delete from pauta_marca");
    for (const f of filas) {
      await cliente.query(
        `insert into pauta_marca (periodo, marca, gasto_usd, leads, cuentas)
         values ($1, $2, $3, $4, $5)`,
        [f.periodo, f.marca, f.gasto_usd, f.leads, f.cuentas]
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

/** [] si nunca hubo push. `gasto_usd` vuelve como número, no como texto. */
export async function getPautaMarca(): Promise<PautaMarca[]> {
  try {
    const { rows } = await getPool().query<PautaMarca & { gasto_usd: string }>(
      `select periodo, marca, gasto_usd, leads, cuentas from pauta_marca`
    );
    return rows.map((r) => ({ ...r, gasto_usd: Number(r.gasto_usd) }));
  } catch {
    return [];
  }
}

/** Cuándo fue el último push, o null: para «Estado de los datos». */
export async function getActualizacionPautaMarca(): Promise<Date | null> {
  try {
    const { rows } = await getPool().query<{ fecha: Date | null }>(
      `select max(actualizado_en) fecha from pauta_marca`
    );
    return rows[0]?.fecha ?? null;
  } catch {
    return null;
  }
}
