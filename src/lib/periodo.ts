import type { Filtro } from "./cadam/mercado";
import { I18N_ES } from "./i18n/crear";

/**
 * Lo que escribe una frase o un nombre de mes (mesCorto, etiquetaPeriodo,
 * etiquetaCortes, aclaracionCortes…) vive ahora en @/lib/i18n/formatos, porque
 * cambia con el idioma. Acá quedan las versiones en CASTELLANO, para código de
 * texto fijo; una pantalla usa `fmt` de getI18n()/useI18n() y destructura de ahí
 * los mismos nombres. Lo que sigue en este archivo (filtroDesdeUrl, corteComun,
 * aniosDeSerie…) no lleva texto y es igual en todos los idiomas.
 */
const ES = I18N_ES.fmt;

export const MESES_CORTOS = ES.mesesCortos;
export const MESES_LARGOS = ES.mesesLargos;
export const mesCorto = ES.mesCorto;
export const etiquetaCorte = ES.etiquetaCorte;
export const etiquetaCortes = ES.etiquetaCortes;
export const aclaracionCortes = ES.aclaracionCortes;
export const etiquetaPeriodo = ES.etiquetaPeriodo;

type Corte = { anio: number; mes: number } | null;

type Cortes = { matriculacion: { ultimo: Corte }; importacion: { ultimo: Corte } };

const orden = (c: { anio: number; mes: number }) => c.anio * 12 + c.mes;

/** La fuente que llega más lejos, o null si van parejas (o falta una). */
export function fuenteAdelantada(cobertura: Cortes): "matriculacion" | "importacion" | null {
  const m = cobertura.matriculacion.ultimo;
  const i = cobertura.importacion.ultimo;
  if (!m || !i || orden(m) === orden(i)) return null;
  return orden(i) > orden(m) ? "importacion" : "matriculacion";
}

/**
 * El último mes que tienen LAS DOS fuentes: hasta ahí se puede restar
 * importación menos matriculación sin inventar stock con un mes que una de
 * las dos todavía no publicó.
 */
export function corteComun(cobertura: Cortes): Corte {
  const m = cobertura.matriculacion.ultimo;
  const i = cobertura.importacion.ultimo;
  if (!m || !i) return m ?? i;
  return orden(m) <= orden(i) ? m : i;
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
  // El tope vale tambien para un `desde`/`hasta` que viene en la URL: al
  // cambiar de fuente el filtro viaja con el enlace, y un «hasta=9» elegido
  // mirando matriculaciones llegaba a importaciones (que terminan en agosto)
  // y el rotulo decia «Ene–Sep» sobre ocho meses de datos.
  const desde = Math.min(Math.max(num(sp.desde) ?? 1, 1), topeMes);
  const hasta = Math.min(Math.max(num(sp.hasta) ?? topeMes, desde), topeMes);
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
