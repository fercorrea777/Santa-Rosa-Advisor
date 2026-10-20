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

/**
 * El corte de datos, en criollo: '2026-08' -> 'Ago 2026'.
 *
 * El pie de cada pantalla decía «snapshot 2026-08». «Snapshot» es una palabra
 * de máquina: nombra cómo se guarda el dato, no qué significa. Lo que el
 * lector necesita saber es hasta cuándo llegan los números, y eso se dice
 * «datos hasta Ago 2026».
 */
export function etiquetaCorte(periodo: string | null | undefined): string {
  if (!periodo) return "—";
  const [anio, mes] = periodo.split("-");
  const m = mesCorto(Number(mes));
  return anio && m ? `${m} ${anio}` : periodo;
}

type Corte = { anio: number; mes: number } | null;

/**
 * Hasta dónde llega cada fuente, para la píldora de fuente de cada pantalla.
 *
 * «datos hasta Ago 2026» mentía a medias cuando las dos fuentes no van
 * parejas: en septiembre de 2026 CADAM ya había publicado la importación de
 * agosto y la matriculación llegaba a julio. Croman (15/09/2026): "ponéme
 * nomás una aclaración de que las matriculaciones son hasta julio y que
 * agosto ya tenemos las importaciones". Cuando coinciden vuelve al texto
 * corto de siempre.
 */
export function etiquetaCortes(cobertura: {
  snapshot: string | null;
  matriculacion: { ultimo: Corte };
  importacion: { ultimo: Corte };
}): string {
  const m = cobertura.matriculacion.ultimo;
  const i = cobertura.importacion.ultimo;
  if (m && i && (m.anio !== i.anio || m.mes !== i.mes)) {
    return `matriculaciones hasta ${mesCorto(m.mes)} ${m.anio} · importaciones hasta ${mesCorto(i.mes)} ${i.anio}`;
  }
  return `datos hasta ${etiquetaCorte(cobertura.snapshot)}`;
}

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

/**
 * La aclaración de las pantallas que muestran las dos fuentes, cuando no
 * van parejas. Antes decía siempre «CADAM ya publicó la importación…»: en
 * sep-2026 era cierto, pero en oct-2026 la que iba adelante era la
 * matriculación (septiembre, con la importación en agosto) y el texto
 * afirmaba lo contrario de lo que pasaba.
 */
export function aclaracionCortes(cobertura: Cortes): string | undefined {
  const m = cobertura.matriculacion.ultimo;
  const i = cobertura.importacion.ultimo;
  const adelante = fuenteAdelantada(cobertura);
  if (!m || !i || !adelante) return undefined;
  const conAnio = m.anio !== i.anio;
  const mes = (c: { anio: number; mes: number }) => `${mesCorto(c.mes)}${conAnio ? ` ${c.anio}` : ""}`;
  const [lider, atras] = adelante === "importacion" ? [i, m] : [m, i];
  const varios = orden(lider) - orden(atras) > 1;
  const meses = varios
    ? `${mes({ anio: atras.mes === 12 ? atras.anio + 1 : atras.anio, mes: (atras.mes % 12) + 1 })}–${mes(lider)}`
    : mes(lider);
  const [ya, falta] = adelante === "importacion"
    ? ["la importación", "la matriculación"]
    : ["la matriculación", "la importación"];
  return `Matriculaciones hasta ${mes(m)} · importaciones hasta ${mes(i)}: CADAM ya publicó ${ya} de ${meses}, ${falta} de ${varios ? "esos meses" : "ese mes"} todavía no.`;
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
