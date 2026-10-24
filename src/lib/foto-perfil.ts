import type { T } from "@/lib/i18n/traducir";

/**
 * Reglas de la foto de perfil, en un solo lugar para que el cliente (que recorta
 * y comprime) y el servidor (que valida) hablen de lo mismo.
 *
 * EL SERVIDOR NO CONFÍA EN EL NAVEGADOR. El recorte lo hace el navegador, pero
 * la ruta de subida la puede llamar cualquiera con una sesión, así que cada
 * regla se vuelve a comprobar acá: solo JPEG (lo que el navegador produce con
 * `canvas.toBlob`), con los bytes de un JPEG de verdad, de tamaño y medidas
 * acotados. No se acepta SVG, HTML ni nada que un navegador pueda interpretar
 * como otra cosa: lo único que sale de esta ruta es `image/jpeg`.
 */

/** Ruta de la API de la foto propia (GET, PUT, DELETE). */
export const URL_FOTO = "/api/mi-cuenta/foto";

export const TIPO_FOTO = "image/jpeg";
/** Lo que el recorte produce (384 px, calidad .86) pesa entre 20 y 60 KB: 200 KB
 *  es holgura de sobra y corta cualquier intento de subir otra cosa. */
export const MAX_BYTES_FOTO = 200 * 1024;
/** Lado del cuadrado que exporta el recorte. */
export const LADO_FOTO = 384;
export const LADO_MIN = 96;
export const LADO_MAX = 1024;

/**
 * Lee el ancho y el alto de un JPEG recorriendo sus segmentos hasta el
 * encabezado de imagen (SOF). Devuelve null si no es un JPEG bien formado.
 */
export function medirJpeg(b: Uint8Array): { ancho: number; alto: number } | null {
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) return null;
  let i = 2;
  while (i + 3 < b.length) {
    if (b[i] !== 0xff) return null;
    // Relleno: puede haber varios 0xFF seguidos antes del marcador.
    while (b[i + 1] === 0xff && i + 2 < b.length) i++;
    const marcador = b[i + 1];
    i += 2;
    // Fin de imagen o inicio del barrido sin haber visto el SOF: no hay medidas.
    if (marcador === 0xd9 || marcador === 0xda) return null;
    // Marcadores sin longitud: TEM y los reinicios RST0 a RST7.
    if (marcador === 0x01 || (marcador >= 0xd0 && marcador <= 0xd7)) continue;
    if (i + 2 > b.length) return null;
    const largo = (b[i] << 8) | b[i + 1];
    if (largo < 2 || i + largo > b.length) return null;
    // SOF0..SOF15, salvo DHT (C4), JPG (C8) y DAC (CC), que no son encabezados de imagen.
    const esSof = marcador >= 0xc0 && marcador <= 0xcf && marcador !== 0xc4 && marcador !== 0xc8 && marcador !== 0xcc;
    if (esSof) {
      if (largo < 8) return null;
      const alto = (b[i + 3] << 8) | b[i + 4];
      const ancho = (b[i + 5] << 8) | b[i + 6];
      return { ancho, alto };
    }
    i += largo;
  }
  return null;
}

export type ResultadoValidacion = { ok: true } | { ok: false; motivo: string };

/** `t` es el traductor del pedido: el motivo vuelve a la pantalla en el idioma de quien subió la foto. */
export function validarFoto(b: Uint8Array, t: T): ResultadoValidacion {
  if (b.length === 0) return { ok: false, motivo: t("La imagen llegó vacía.") };
  if (b.length > MAX_BYTES_FOTO) {
    return { ok: false, motivo: t("La imagen es demasiado pesada.") };
  }
  const medidas = medirJpeg(b);
  // El JPEG tiene que terminar con su marcador de fin (FF D9): un archivo
  // cortado o con basura pegada no pasa.
  const cierra = b.length >= 2 && b[b.length - 2] === 0xff && b[b.length - 1] === 0xd9;
  if (!medidas || !cierra) return { ok: false, motivo: t("El archivo no es una imagen JPEG válida.") };
  const { ancho, alto } = medidas;
  if (ancho < LADO_MIN || alto < LADO_MIN) return { ok: false, motivo: t("La imagen es demasiado chica.") };
  if (ancho > LADO_MAX || alto > LADO_MAX) return { ok: false, motivo: t("La imagen es demasiado grande.") };
  return { ok: true };
}
