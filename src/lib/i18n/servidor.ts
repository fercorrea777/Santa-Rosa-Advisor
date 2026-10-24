import { cache } from "react";
import { cookies } from "next/headers";
import { crearI18n, type I18n } from "./crear";
import { COOKIE_IDIOMA, idiomaDe, type Idioma } from "./idioma";
import type { Catalogo } from "./traducir";

/**
 * El idioma de ESTE pedido, para páginas, layouts, acciones y rutas de API.
 *
 * Sale de la cookie `advisor_idioma`. Con `cache()` se lee una sola vez por
 * pedido aunque lo pidan el layout, la página y diez componentes. No hay un
 * "idioma actual" global en el servidor (varios pedidos en idiomas distintos
 * conviven en el mismo proceso): quien necesita el idioma lo pide acá y se lo
 * pasa a lo que llama.
 */
export const getIdioma = cache(async (): Promise<Idioma> => {
  const almacen = await cookies();
  return idiomaDe(almacen.get(COOKIE_IDIOMA)?.value);
});

/** El catálogo completo en inglés. Import dinámico: quien lee en castellano
 *  (casi todos los pedidos) no carga ni parsea las miles de frases. */
async function catalogoEn(): Promise<Catalogo> {
  return (await import("./catalogo/en")).default;
}

/** `const { t, tr, fmt, idioma } = await getI18n();` al principio de cada
 *  pantalla del servidor. Ver crear.ts. */
export const getI18n = cache(async (): Promise<I18n> => {
  const idioma = await getIdioma();
  return crearI18n(idioma, idioma === "en" ? await catalogoEn() : null);
});

/**
 * Lo que se manda al navegador para que los componentes de cliente traduzcan:
 * solo las frases que esos componentes usan (generado por `npm run i18n`, ver
 * scripts/i18n.mjs), no el catálogo entero, y NADA en castellano (null: el
 * texto de origen ya está en el código).
 */
export async function getMensajesCliente(idioma: Idioma): Promise<Catalogo | null> {
  if (idioma !== "en") return null;
  return (await import("./catalogo/en-cliente.generated")).default;
}
