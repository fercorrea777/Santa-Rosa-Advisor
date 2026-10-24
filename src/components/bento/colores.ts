/**
 * Los colores del bento. El criterio es el de DESIGN.md: el color sigue a la
 * ENTIDAD y no a su posición en una lista, así que cada grupo y cada marca
 * tiene siempre el suyo.
 *
 *  - Matriculaciones = azul y importaciones = ámbar (`--chart-1` / `--chart-4`).
 *  - Lo nuestro (Santa Rosa y sus marcas) = el cian de la marca (`--primary`).
 *  - Cada grupo importador del treemap, un tono de la paleta de ocho (validada
 *    contra el panel claro y el oscuro, ver DESIGN.md); los grupos chicos y el
 *    resto, en gris. Las clases `bento-g-*` están en globals.css: ahí también
 *    está el color de la letra de cada una, que cambia con el tema para que
 *    todas pasen 4,5:1 sobre su rectángulo.
 */

/** Grupo (clave de grupos.ts) → clase de color del rectángulo del treemap. */
const CLASE_POR_GRUPO: Record<string, string> = {
  "SANTA ROSA": "bento-g-sr",
  GARDEN: "bento-g-1",
  TOYOTOSHI: "bento-g-2",
  DIESA: "bento-g-3",
  AUTOMOTOR: "bento-g-4",
  CHACOMER: "bento-g-5",
  CONDOR: "bento-g-6",
};
export const CLASE_GRUPO_OTROS = "bento-g-otros";

export function claseDeGrupo(grupo: string): string {
  return CLASE_POR_GRUPO[grupo] ?? CLASE_GRUPO_OTROS;
}

/** Los grupos que llevan color propio, en el orden de la leyenda. El resto va junto, en gris. */
export const GRUPOS_CON_COLOR = Object.keys(CLASE_POR_GRUPO);

// ---------------------------------------------------------------- marcas propias

/** El tono (grados OKLCH) de la cara de la tarjeta de cada marca nuestra. */
const TONO_POR_MARCA: Record<string, number> = {
  JETOUR: 245,
  "GREAT WALL": 150,
  MITSUBISHI: 25,
  RENAULT: 85,
  SOUEAST: 305,
  JAC: 205,
  LEAPMOTOR: 160,
  ZEEKR: 350,
  JMEV: 115,
  XPENG: 275,
};
const TONOS_DE_RESPALDO = [245, 25, 150, 305, 85, 205, 350, 115];

/** El tono de una marca: el fijo si lo tiene, y si no uno estable por su nombre. */
export function tonoDeMarca(marca: string): number {
  const fijo = TONO_POR_MARCA[marca];
  if (fijo !== undefined) return fijo;
  let h = 0;
  for (const c of marca) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return TONOS_DE_RESPALDO[h % TONOS_DE_RESPALDO.length];
}

/** La cara de la tarjeta: un degradado oscuro del tono de la marca (la letra va en blanco, ≥7:1). */
export function caraDeMarca(marca: string): string {
  const h = tonoDeMarca(marca);
  return `linear-gradient(145deg, oklch(0.43 0.13 ${h}) 0%, oklch(0.3 0.1 ${(h + 18) % 360}) 100%)`;
}
