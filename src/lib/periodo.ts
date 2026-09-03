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

/**
 * Años que deben dibujarse en los graficos de serie.
 *
 * Param `anios` en la URL, separados por coma: `?anios=2023,2024,2026`.
 *
 * ES ADITIVO A PROPOSITO. No reemplaza a `anio`, que sigue mandando en los
 * KPIs y en toda comparacion "contra el mismo periodo del año anterior".
 * Mezclar las dos cosas —que el selector de años tambien moviera el periodo
 * de los KPIs— haria que elegir un año viejo para verlo en la serie cambiara
 * en silencio todas las cifras de arriba. Aca se elige QUE SE DIBUJA, no
 * sobre que se calcula.
 *
 * Sin el param, el comportamiento de siempre: el año del filtro y el
 * anterior. Se acotan a los años que existen y se ordenan, asi la leyenda
 * del grafico no depende del orden en que se tildaron.
 */
export function aniosDeSerie(
  sp: SearchParams,
  anioActual: number,
  disponibles: number[]
): number[] {
  const crudo = Array.isArray(sp.anios) ? sp.anios[0] : sp.anios;
  if (!crudo) {
    return [anioActual - 1, anioActual].filter((a) => disponibles.includes(a));
  }
  const pedidos = crudo
    .split(",")
    .map((x) => Number(x.trim()))
    .filter((n) => Number.isInteger(n) && disponibles.includes(n));
  // Si el filtro deja la lista vacia (año que no existe, param manipulado)
  // se cae al default en vez de devolver un grafico en blanco.
  return pedidos.length
    ? [...new Set(pedidos)].sort((a, b) => a - b)
    : [anioActual - 1, anioActual].filter((a) => disponibles.includes(a));
}
