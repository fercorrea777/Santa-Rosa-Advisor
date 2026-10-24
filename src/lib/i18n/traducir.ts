import * as React from "react";
import type { Idioma } from "./idioma";

/**
 * El traductor: `t("texto en castellano")` devuelve ese texto o su traducción.
 *
 * POR QUÉ EL TEXTO EN CASTELLANO ES LA CLAVE. El tablero está escrito en
 * castellano y cada pantalla tiene cientos de frases largas con su contexto
 * («Hacé clic en una barra para filtrar toda la página por ese segmento»).
 * Con claves tipo `rankings.nota.filtro` habría que inventar y mantener tres mil
 * nombres, y leer el código obligaría a abrir un JSON para saber qué dice la
 * pantalla. Con el texto como clave el código se sigue leyendo igual, una frase
 * sin traducir se ve en castellano (nunca una clave rota) y el inglés vive en
 * un catálogo aparte (catalogo/en*.ts) que un script compara con el código
 * (scripts/i18n.mjs): qué frases faltan y cuáles quedaron huérfanas.
 *
 * REGLAS DE LA CLAVE
 *  - Una sola línea, con los espacios simples: la misma frase que vería quien
 *    lee. (JSX parte los textos largos en varias líneas y colapsa los espacios;
 *    la clave es la frase ya colapsada.)
 *  - Lo variable va entre llaves y se pasa aparte: `t("Mostrando {n} de {total}.",
 *    { n, total })`. Los valores van YA formateados (números con fmt.*), porque
 *    el traductor no sabe si «42328» es una cifra o un código.
 *  - Lo que no cambia con el idioma (marcas, siglas, nombres propios, el
 *    contenido que viene de los datos) NO se traduce.
 *
 * TEXTO CON NEGRITA O CÓDIGO ADENTRO: `tr()`, que devuelve un nodo de React y
 * entiende `<b>…</b>`, `<i>…</i>`, `<code>…</code>` y `<br/>`, más las etiquetas
 * que se le pasen. Lo de adentro de una etiqueta se traduce junto con la frase:
 * partirla en pedazos obligaría al inglés a tener el mismo orden de palabras.
 */

export type Catalogo = Readonly<Record<string, string>>;
export type Vars = Readonly<Record<string, string | number>>;
export type T = (es: string, vars?: Vars) => string;
export type Etiquetas = Readonly<Record<string, (hijos: React.ReactNode) => React.ReactNode>>;
export type TR = (es: string, vars?: Vars, etiquetas?: Etiquetas) => React.ReactNode;

/**
 * Marca un texto que se traduce MÁS TARDE, donde se muestre.
 *
 * Los textos que viven en una constante del módulo (la lista de pantallas del
 * menú, los nombres de las clases de vehículo…) no tienen un `t` a mano: el
 * idioma recién se sabe al dibujar. `N_("Rankings")` devuelve el mismo texto
 * sin tocarlo, y le avisa al script de extracción que esa frase hay que
 * traducirla; en el punto donde se muestra se hace `t(item.label)`.
 */
export const N_ = <S extends string>(texto: S): S => texto;

function interpolar(texto: string, vars?: Vars): string {
  if (!vars) return texto;
  return texto.replace(/\{(\w+)\}/g, (marca, nombre: string) =>
    Object.prototype.hasOwnProperty.call(vars, nombre) ? String(vars[nombre]) : marca
  );
}

// -------------------------------------------------------------- texto con etiquetas

type Nodo =
  | { tipo: "texto"; valor: string }
  | { tipo: "br" }
  | { tipo: "etiqueta"; nombre: string; hijos: Nodo[] };

const ETIQUETA = /<(\/?)([a-zA-Z][\w-]*)\s*(\/?)>/g;

function parsear(plantilla: string): Nodo[] {
  const raiz: Nodo[] = [];
  const pila: { nombre: string; hijos: Nodo[] }[] = [];
  const actual = () => (pila.length ? pila[pila.length - 1].hijos : raiz);
  let desde = 0;
  ETIQUETA.lastIndex = 0;
  for (let m = ETIQUETA.exec(plantilla); m; m = ETIQUETA.exec(plantilla)) {
    if (m.index > desde) actual().push({ tipo: "texto", valor: plantilla.slice(desde, m.index) });
    desde = m.index + m[0].length;
    const [, cierra, nombre, autocierre] = m;
    if (nombre === "br" || autocierre) {
      actual().push(nombre === "br" ? { tipo: "br" } : { tipo: "etiqueta", nombre, hijos: [] });
    } else if (!cierra) {
      pila.push({ nombre, hijos: [] });
    } else if (pila.length && pila[pila.length - 1].nombre === nombre) {
      const hecho = pila.pop()!;
      actual().push({ tipo: "etiqueta", nombre, hijos: hecho.hijos });
    } else {
      // Cierre sin apertura: se deja como texto, no se pierde nada.
      actual().push({ tipo: "texto", valor: m[0] });
    }
  }
  if (desde < plantilla.length) actual().push({ tipo: "texto", valor: plantilla.slice(desde) });
  // Aperturas que nunca cerraron: vuelven a ser texto.
  while (pila.length) {
    const sinCerrar = pila.pop()!;
    const destino = actual();
    destino.push({ tipo: "texto", valor: `<${sinCerrar.nombre}>` }, ...sinCerrar.hijos);
  }
  return raiz;
}

const ETIQUETAS_POR_DEFECTO: Etiquetas = {
  b: (h) => React.createElement("strong", null, h),
  strong: (h) => React.createElement("strong", null, h),
  i: (h) => React.createElement("em", null, h),
  em: (h) => React.createElement("em", null, h),
  code: (h) => React.createElement("code", null, h),
};

function aReact(nodos: Nodo[], vars: Vars | undefined, etiquetas: Etiquetas | undefined): React.ReactNode[] {
  return nodos.map((n, i) => {
    if (n.tipo === "texto") return interpolar(n.valor, vars);
    if (n.tipo === "br") return React.createElement("br", { key: i });
    const fn = etiquetas?.[n.nombre] ?? ETIQUETAS_POR_DEFECTO[n.nombre];
    const hijos = aReact(n.hijos, vars, etiquetas);
    if (!fn) {
      // Etiqueta que nadie definió: se muestra tal cual, no se la come.
      return React.createElement(React.Fragment, { key: i }, `<${n.nombre}>`, ...hijos, `</${n.nombre}>`);
    }
    return React.createElement(React.Fragment, { key: i }, fn(React.createElement(React.Fragment, null, ...hijos)));
  });
}

// -------------------------------------------------------------- el traductor

/**
 * Arma `t` y `tr` para un idioma. Con el castellano (o sin catálogo) devuelven
 * el texto de origen; con el inglés lo buscan en el catálogo y, si la frase
 * todavía no está, caen al castellano: una pantalla a medio traducir se lee
 * entera, no con huecos.
 */
export function crearTraductor(idioma: Idioma, catalogo: Catalogo | null): { t: T; tr: TR } {
  const buscar = (es: string): string => {
    if (idioma === "es" || !catalogo) return es;
    const directo = catalogo[es];
    if (directo !== undefined) return directo;
    // Por si la clave quedó con espacios dobles o saltos de línea del JSX.
    const limpio = es.replace(/\s+/g, " ").trim();
    return catalogo[limpio] ?? es;
  };
  const t: T = (es, vars) => interpolar(buscar(es), vars);
  const tr: TR = (es, vars, etiquetas) => {
    const plantilla = buscar(es);
    const nodos = parsear(plantilla);
    // Sin ninguna etiqueta es texto plano: se devuelve la cadena y listo.
    if (nodos.every((n) => n.tipo === "texto")) return interpolar(plantilla, vars);
    return React.createElement(React.Fragment, null, ...aReact(nodos, vars, etiquetas));
  };
  return { t, tr };
}
