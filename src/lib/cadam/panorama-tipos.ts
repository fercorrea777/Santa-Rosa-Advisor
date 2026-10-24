/**
 * Lo del Panorama que también necesitan las tarjetas (componentes de cliente):
 * los tipos de lo que llega de la página, un par de constantes y las cuentas
 * puras. Va aparte de panorama.ts a propósito: ese archivo habla con la base
 * de datos (mercado.ts → node:fs) y un componente de cliente que lo importara
 * arrastraría la base al navegador y rompería el build.
 */

/** Doce posiciones (enero a diciembre); `null` = ese mes no está en la fuente. */
export type Serie12 = (number | null)[];

export interface ItemTreemap {
  /** El nombre de la marca como viene de CADAM, o «OTRAS» para el resto. */
  marca: string;
  /** El grupo (importador) al que pertenece, en la clave de grupos.ts. */
  grupo: string;
  /** Unidades de la marca en cada período, en el mismo orden que `periodos`. */
  valores: number[];
}

export interface TreemapMarcas {
  items: ItemTreemap[];
  /** Total del mercado de cada período (la suma de TODAS las marcas, no solo las dibujadas). */
  totales: number[];
}

/** Las marcas que se dibujan por separado; el resto va junto en «OTRAS». Más de
 *  esto son rectángulos que no entran con su nombre ni su cifra. */
export const MARCAS_EN_TREEMAP = 22;
export const MARCA_OTRAS = "OTRAS";

export interface MarcaPropia {
  marca: string;
  unidades: number;
  /** Participación en el mercado del filtro (0–1). */
  participacion: number;
  /** Puesto en el ranking de marcas del filtro. */
  posicion: number;
  /** Variación de unidades contra el período del año anterior; null = no vendía. */
  variacion: number | null;
  unidadesAnterior: number;
}

export interface AnioEstacional {
  anio: number;
  /** Doce meses; `null` donde no hay dato (el año en curso llega hasta el último mes publicado). */
  valores: Serie12;
  /** Último mes con dato; 12 en un año completo. */
  hasta: number;
  total: number;
  /** Promedio de los meses con dato. */
  promedio: number;
  pico: { mes: number; valor: number } | null;
  valle: { mes: number; valor: number } | null;
  /** Unidades de cada trimestre; null si al trimestre le falta algún mes. */
  trimestres: (number | null)[];
}

/** Variación porcentual mes contra mes del año anterior (0,12 = +12 %); null si falta alguno de los dos. */
export function variacionInteranual(actual: Serie12, previa: Serie12): (number | null)[] {
  return actual.map((v, i) => {
    const p = previa[i];
    return v !== null && p !== null && p > 0 ? v / p - 1 : null;
  });
}
