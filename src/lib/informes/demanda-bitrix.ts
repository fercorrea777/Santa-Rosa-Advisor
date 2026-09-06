import { getPool } from "./db";

/**
 * Demanda de Bitrix por marca y modelo: cuántos leads y negocios se
 * abrieron, cuántos siguen abiertos, cuántos se ganaron y cuántos se
 * perdieron — y POR QUÉ se perdieron. Lo empuja Hermes
 * (advisor-demanda-bitrix.py), agregado antes de salir de su máquina.
 *
 * DOS ORÍGENES, PORQUE BITRIX LOS USA DISTINTO. Los leads son la masa
 * (30.000 al año) y traen la marca de interés, pero no tienen campo de
 * modelo: el modelo se deduce del título, de la campaña o del formulario
 * cuando lo nombran, y cuando no, queda vacío — no se adivina. Los
 * negocios son pocos (cientos) pero llevan el producto del catálogo
 * (versión) y una etapa de pérdida con motivo: Precio, Falta de stock,
 * Competencia, Demora en respuesta, Producto, Rechazado por banco,
 * Financiación propia.
 *
 * Solo conteos. Ningún dato del cliente entra a esta tabla. Cada push
 * reemplaza todo: es una foto del CRM, y Bitrix reclasifica hacia atrás.
 */

export type OrigenDemanda = "lead" | "negocio";
export type EstadoDemanda = "abierto" | "ganado" | "perdido";

export interface DemandaBitrix {
  periodo: string; // YYYY-MM de creación
  origen: OrigenDemanda;
  /** Como la escribe CADAM ("GREAT WALL", "JETOUR") o "SIN MARCA". */
  marca: string;
  /** Familia ("T2", "L200") o "" cuando Bitrix no lo dice. */
  modelo: string;
  estado: EstadoDemanda;
  /** Motivo de pérdida tal como lo nombra Bitrix, o "" si no aplica. */
  motivo: string;
  cantidad: number;
}

export async function crearTablaDemandaBitrix(): Promise<void> {
  await getPool().query(`
    create table if not exists demanda_bitrix (
      periodo        text not null,
      origen         text not null,
      marca          text not null,
      modelo         text not null default '',
      estado         text not null,
      motivo         text not null default '',
      cantidad       integer not null,
      actualizado_en timestamptz not null default now(),
      primary key (periodo, origen, marca, modelo, estado, motivo)
    );
  `);
}

export async function guardarDemandaBitrix(filas: DemandaBitrix[]): Promise<void> {
  const cliente = await getPool().connect();
  try {
    await cliente.query("begin");
    await cliente.query("delete from demanda_bitrix");
    for (const f of filas) {
      await cliente.query(
        `insert into demanda_bitrix (periodo, origen, marca, modelo, estado, motivo, cantidad)
         values ($1, $2, $3, $4, $5, $6, $7)
         on conflict (periodo, origen, marca, modelo, estado, motivo)
         do update set cantidad = demanda_bitrix.cantidad + excluded.cantidad`,
        [f.periodo, f.origen, f.marca, f.modelo, f.estado, f.motivo, f.cantidad]
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

/** [] si nunca hubo push (la tabla no existe todavía). */
export async function getDemandaBitrix(): Promise<DemandaBitrix[]> {
  try {
    const { rows } = await getPool().query<DemandaBitrix>(
      `select periodo, origen, marca, modelo, estado, motivo, cantidad from demanda_bitrix`
    );
    return rows;
  } catch {
    return [];
  }
}

/** Cuándo fue el último push, o null. */
export async function getActualizacionDemandaBitrix(): Promise<Date | null> {
  try {
    const { rows } = await getPool().query<{ fecha: Date | null }>(
      `select max(actualizado_en) fecha from demanda_bitrix`
    );
    return rows[0]?.fecha ?? null;
  } catch {
    return null;
  }
}
