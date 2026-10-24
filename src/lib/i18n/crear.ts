import { crearFormatos, type Formatos } from "./formatos";
import type { Idioma } from "./idioma";
import { crearTraductor, type Catalogo, type T, type TR } from "./traducir";

/**
 * Lo que necesita cualquier pantalla para hablar en el idioma elegido: el
 * traductor de frases (`t`, `tr`) y los formatos de cifras y fechas (`fmt`).
 *
 * Se obtiene así:
 *  - Server Component / página / acción / ruta de API:
 *      `const { t, tr, fmt } = await getI18n();`           (lib/i18n/servidor)
 *  - Componente de cliente:
 *      `const { t, tr, fmt } = useI18n();`                 (lib/i18n/cliente)
 *  - Una función de apoyo que arma texto (lib/…): recibe `i18n: I18n` (o solo
 *    `t` y `fmt`) como parámetro. NUNCA lee el idioma por su cuenta: en el
 *    servidor no hay un "idioma actual" global, hay uno por pedido.
 */
export interface I18n {
  idioma: Idioma;
  locale: string;
  t: T;
  tr: TR;
  fmt: Formatos;
}

export function crearI18n(idioma: Idioma, catalogo: Catalogo | null): I18n {
  const { t, tr } = crearTraductor(idioma, catalogo);
  const fmt = crearFormatos(idioma, t);
  return { idioma, locale: fmt.locale, t, tr, fmt };
}

/** El castellano sin catálogo: lo que ve quien nunca tocó el selector. Sirve
 *  de valor por defecto del contexto del cliente y para el código de texto
 *  fijo en castellano (logs, mensajes a máquinas, el modelo del Copiloto). */
export const I18N_ES: I18n = crearI18n("es", null);
