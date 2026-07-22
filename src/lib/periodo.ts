import type { Filtro } from "./cadam/mercado";

export const MESES_CORTOS = [
  "Ene", "Feb", "Mar", "Abr", "May", "Jun",
  "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
];

export const MESES_LARGOS = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

export function mesCorto(mes: number): string {
  return MESES_CORTOS[mes - 1] ?? String(mes);
}

/** 'Ene–Jun 2026' | 'Mayo 2026' */
export function etiquetaPeriodo(anio: number, desde: number, hasta: number): string {
  if (desde === hasta) {
    const m = MESES_LARGOS[desde - 1] ?? String(desde);
    return `${m[0].toUpperCase()}${m.slice(1)} ${anio}`;
  }
  return `${mesCorto(desde)}–${mesCorto(hasta)} ${anio}`;
}

export type SearchParams = Record<string, string | string[] | undefined>;

function num(v: string | string[] | undefined): number | undefined {
  const s = Array.isArray(v) ? v[0] : v;
  if (s === undefined) return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

function txt(v: string | string[] | undefined): string | undefined {
  const s = Array.isArray(v) ? v[0] : v;
  return s && s !== "todos" ? s : undefined;
}

/**
 * Lee el filtro de la URL, acotandolo a lo que realmente hay cargado.
 * Por defecto: ultimo anio disponible, de enero al ultimo mes con datos.
 */
export function filtroDesdeUrl(
  sp: SearchParams,
  ultimo: { anio: number; mes: number } | null
): Filtro {
  const anioDefault = ultimo?.anio ?? new Date().getFullYear();
  const anio = num(sp.anio) ?? anioDefault;
  // Solo se limita al mes de cierre cuando se mira el anio del ultimo
  // informe; los anios anteriores estan completos.
  const topeMes = ultimo && anio === ultimo.anio ? ultimo.mes : 12;
  const desde = Math.min(Math.max(num(sp.desde) ?? 1, 1), 12);
  const hasta = Math.min(Math.max(num(sp.hasta) ?? topeMes, desde), 12);
  return {
    anio,
    mesDesde: desde,
    mesHasta: hasta,
    segmento: txt(sp.segmento),
    tecnologia: txt(sp.tecnologia),
    marca: txt(sp.marca),
    empresa: txt(sp.empresa),
    modelo: txt(sp.modelo),
    version: txt(sp.version),
  };
}
