import { getPool } from "./db";

/**
 * Leads de Bitrix por asesor y mes, empujados por Hermes
 * (advisor-leads-asesor.py). Se cruzan con los vehículos que cada asesor
 * factura (Cars) para ver conversión y leads parados.
 *
 * Solo conteos y el nombre del responsable — un empleado. Ningún dato del
 * cliente entra a esta tabla. Cada push reemplaza todo: es una foto del
 * CRM, y Bitrix reasigna leads hacia atrás.
 */

export interface LeadsAsesor {
  periodo: string; // YYYY-MM
  /** MAYÚSCULAS, sin acentos: como normaliza Hermes y como escribe Cars. */
  asesor: string;
  leads: number;
  sin_contacto: number;
  descartados: number;
}

export async function crearTablaLeadsAsesor(): Promise<void> {
  await getPool().query(`
    create table if not exists leads_asesor (
      periodo        text not null,
      asesor         text not null,
      leads          integer not null,
      sin_contacto   integer not null default 0,
      descartados    integer not null default 0,
      actualizado_en timestamptz not null default now(),
      primary key (periodo, asesor)
    );
  `);
}

export async function guardarLeadsAsesor(filas: LeadsAsesor[]): Promise<void> {
  const cliente = await getPool().connect();
  try {
    await cliente.query("begin");
    await cliente.query("delete from leads_asesor");
    for (const f of filas) {
      await cliente.query(
        `insert into leads_asesor (periodo, asesor, leads, sin_contacto, descartados)
         values ($1, $2, $3, $4, $5)`,
        [f.periodo, f.asesor, f.leads, f.sin_contacto, f.descartados]
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
export async function getLeadsAsesor(): Promise<LeadsAsesor[]> {
  try {
    const { rows } = await getPool().query<LeadsAsesor>(
      `select periodo, asesor, leads, sin_contacto, descartados from leads_asesor`
    );
    return rows;
  } catch {
    return [];
  }
}

/** Misma normalización que el pusher: MAYÚSCULAS, sin acentos, un espacio.
 *  Cars ya escribe así; Bitrix no siempre. */
export function normalizarNombre(nombre: string): string {
  return nombre
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}
