/**
 * Cumplimiento del presupuesto, en funciones puras.
 *
 * Dos números distintos, a propósito (spec 07/09/2026):
 *  - PLAN VIGENTE: el ejercicio de Finanzas mes a mes. En los meses que ya
 *    cerraron (hasta `realHastaMes`) el plan ES el real, así que ahí no hay
 *    cumplimiento que medir: se mide solo sobre los meses abiertos.
 *  - PRESUPUESTO ANUAL: la cifra original del año, sin apertura mensual.
 *    Contra eso se dice "qué parte del año ya se hizo".
 *
 * Sin acceso a datos ni imports del repo: se verifica con `node` suelto
 * (Node 24 quita los tipos solo) sobre casos fijos.
 */

export interface PlanPeriodo {
  /** Suma del plan en los meses del filtro. */
  plan: number;
  /** Suma del plan solo en los meses ABIERTOS del filtro. */
  planAbiertos: number;
  abiertos: number;
  cerrados: number;
}

const mesValido = (m: number) => Number.isInteger(m) && m >= 1 && m <= 12;

export function planPeriodo(
  plan: number[],
  mesDesde: number,
  mesHasta: number,
  realHastaMes: number | null
): PlanPeriodo {
  const salida: PlanPeriodo = { plan: 0, planAbiertos: 0, abiertos: 0, cerrados: 0 };
  for (let m = mesDesde; m <= mesHasta; m++) {
    if (!mesValido(m)) continue;
    const v = plan[m - 1] ?? 0;
    salida.plan += v;
    if (realHastaMes !== null && m <= realHastaMes) {
      salida.cerrados++;
    } else {
      salida.abiertos++;
      salida.planAbiertos += v;
    }
  }
  return salida;
}

/** facturado / plan sobre los meses abiertos; null si no hay meses abiertos
 *  o el plan abierto es cero (nada contra qué medir). */
export function cumplimiento(
  facturadoAbiertos: number,
  planAbiertos: number,
  abiertos: number
): number | null {
  if (abiertos <= 0 || planAbiertos <= 0) return null;
  return facturadoAbiertos / planAbiertos;
}

export function porcentajeHecho(
  facturadoYtd: number,
  presupuestoAnual: number | null
): number | null {
  if (!presupuestoAnual || presupuestoAnual <= 0) return null;
  return facturadoYtd / presupuestoAnual;
}

/** Autos por mes que hacen falta, en los meses que quedan, para llegar al
 *  total del plan. null si no quedan meses. Nunca negativo: si el plan ya
 *  se cumplió, lo que falta por mes es cero. */
export function ritmoNecesario(
  plan: number[],
  facturadoYtd: number,
  ultimoMesCerrado: number
): number | null {
  const restantes = 12 - ultimoMesCerrado;
  if (restantes <= 0) return null;
  const total = plan.reduce((s, v) => s + (v ?? 0), 0);
  return Math.max(0, (total - facturadoYtd) / restantes);
}

export interface Atrasado {
  marcas: string[];
  /** Autos por mes, últimos meses cerrados. */
  ritmo: number;
  /** Autos por mes que pide el plan para lo que queda. */
  necesario: number;
  faltaPorMes: number;
}

export function atrasados(
  grupos: { marcas: string[]; plan: number[] }[],
  facturadoYtdDe: (marcas: string[]) => number,
  ritmoDe: (marcas: string[]) => number,
  ultimoMesCerrado: number
): Atrasado[] {
  const salida: Atrasado[] = [];
  for (const g of grupos) {
    const necesario = ritmoNecesario(g.plan, facturadoYtdDe(g.marcas), ultimoMesCerrado);
    if (necesario === null) continue;
    const ritmo = ritmoDe(g.marcas);
    if (ritmo < necesario) {
      salida.push({ marcas: g.marcas, ritmo, necesario, faltaPorMes: necesario - ritmo });
    }
  }
  return salida.sort((a, b) => b.faltaPorMes - a.faltaPorMes);
}

/** Unidades facturadas de esas marcas entre dos meses (inclusive) de un
 *  año. `periodo` viene como "AAAA-MM". */
export function facturadoEntre(
  ventas: { periodo: string; marca: string; unidades: number }[],
  marcas: string[],
  anio: number,
  desde: number,
  hasta: number
): number {
  let total = 0;
  for (const v of ventas) {
    if (!marcas.includes(v.marca)) continue;
    const a = Number(v.periodo.slice(0, 4));
    const m = Number(v.periodo.slice(5, 7));
    if (a === anio && m >= desde && m <= hasta) total += v.unidades;
  }
  return total;
}

/** Autos por mes en los últimos `n` meses cerrados (o los que haya si el
 *  año recién empieza). Cero si no hay ningún mes cerrado. */
export function ritmoUltimosMeses(
  ventas: { periodo: string; marca: string; unidades: number }[],
  marcas: string[],
  anio: number,
  ultimoMesCerrado: number,
  n = 3
): number {
  if (ultimoMesCerrado < 1) return 0;
  const desde = Math.max(1, ultimoMesCerrado - n + 1);
  const meses = ultimoMesCerrado - desde + 1;
  return facturadoEntre(ventas, marcas, anio, desde, ultimoMesCerrado) / meses;
}
