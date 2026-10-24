/**
 * Los idiomas del Advisor y la cookie que dice cuál se está usando.
 *
 * El castellano es el idioma de ORIGEN: el texto de cada pantalla está escrito
 * en castellano en el código y el inglés es una traducción que se busca por ese
 * mismo texto (ver traducir.ts). Sin cookie (o con una que no se entiende), el
 * idioma es el castellano: es lo que veía todo el equipo antes del selector y
 * no se cambia nada a quien no lo toca.
 *
 * Este archivo es puro (nada de React ni de Next) para poder usarlo igual en el
 * servidor, en el cliente, en la puerta (proxy.ts) y en los scripts de prueba.
 */

export const IDIOMAS = ["es", "en"] as const;
export type Idioma = (typeof IDIOMAS)[number];

export const IDIOMA_POR_DEFECTO: Idioma = "es";

/** La cookie que recuerda el idioma elegido (un año). La escribe la acción
 *  `cambiarIdioma` y la leen el layout y cada pantalla en el servidor. */
export const COOKIE_IDIOMA = "advisor_idioma";

/** El `locale` de Intl para cada idioma. Es-PY y no es-ES: los miles con punto
 *  y los decimales con coma son los de Paraguay, y es lo que lleva el tablero
 *  desde siempre. Inglés de Estados Unidos: coma de miles, punto decimal. */
export const LOCALE: Record<Idioma, string> = { es: "es-PY", en: "en-US" };

/** Cada idioma escrito en SU idioma: así se ve igual desde cualquiera de los dos. */
export const NOMBRE_IDIOMA: Record<Idioma, string> = { es: "Español", en: "English" }; // i18n-ignore

export function esIdioma(v: unknown): v is Idioma {
  return v === "es" || v === "en";
}

/** Lo que diga la cookie, o el castellano si no dice nada entendible. */
export function idiomaDe(v: string | null | undefined): Idioma {
  return esIdioma(v) ? v : IDIOMA_POR_DEFECTO;
}
