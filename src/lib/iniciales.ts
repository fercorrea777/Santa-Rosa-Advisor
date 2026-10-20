/**
 * Las iniciales de una persona, para el círculo que se muestra cuando no hay
 * foto. Puro y sin dependencias: lo usan tanto componentes de cliente como de
 * servidor.
 *
 * Primera letra del primer nombre y de la última palabra ("Fernando Correa"
 * → "FC", "Prueba lector (local)" → "PL"). Un solo nombre da una sola letra.
 */
export function iniciales(nombre: string): string {
  const palabras = nombre
    .replace(/\([^)]*\)/g, " ") // "(local)", "(admin)": aclaraciones, no apellidos
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (palabras.length === 0) return "?";
  const primera = palabras[0].charAt(0);
  const ultima = palabras.length > 1 ? palabras[palabras.length - 1].charAt(0) : "";
  return (primera + ultima).toLocaleUpperCase("es");
}

/**
 * Un tono estable por persona para el círculo de iniciales: la misma persona
 * siempre cae en el mismo, y el equipo se reconoce de un vistazo en una lista.
 * Los cuatro tonos son los chips de la paleta (violeta, menta, ámbar, rosa) más
 * el acento; todos ya cumplen contraste en claro y en oscuro (globals.css).
 */
export const TONOS_AVATAR = ["acento", "violeta", "menta", "ambar", "rosa"] as const;
export type TonoAvatar = (typeof TONOS_AVATAR)[number];

export function tonoDe(nombre: string): TonoAvatar {
  let h = 0;
  for (const c of nombre) h = (h * 31 + c.codePointAt(0)!) >>> 0;
  return TONOS_AVATAR[h % TONOS_AVATAR.length];
}
