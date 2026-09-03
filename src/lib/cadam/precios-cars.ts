import { getDb } from "@/lib/cadam/db";
import { getMarcasPropiasSet } from "@/lib/cadam/config";
import { getPool } from "@/lib/informes/db";
import type { Filtro } from "@/lib/cadam/mercado";
import type { ModeloConPrecio } from "@/lib/cadam/precios";

/**
 * Precios de la gama propia tomados del STOCK DE CARS, no de una lista a mano.
 *
 * POR QUE EXISTE
 * --------------
 * "Gama propia" cruza las unidades de CADAM con un precio. El precio venia de
 * `precio_modelo`, una tabla que se llenaba subiendo un Excel con
 * `ingest_precios.py`, una vez por periodo. Al 03/09/2026 nadie lo habia
 * subido nunca: la pantalla llevaba meses mostrando un instructivo en lugar
 * de datos, y pedia a mano un dato que el sistema YA TIENE — el API de Cars
 * trae 122 versiones con precio de lista y se sincroniza solo cada 4 horas.
 *
 * Un dato que hay que cargar a mano cada mes es un dato que va a estar viejo.
 *
 * EL PROBLEMA DEL NOMBRE, Y COMO SE RESUELVE
 * ------------------------------------------
 * Las dos fuentes escriben distinto el mismo auto:
 *
 *   CADAM (DNRA)          Cars (DMS)
 *   "TANK 400"            modelo "TANK",   version "TANK 400 PHEV 4WD"
 *   "T2"                  modelo "TRAVELLER", version "T2 PHEV"
 *   "NUEVO KWID ZEN 1.0"  modelo "KWID",   version "NUEVO KWID ZEN 1.0"
 *   "X70PLUS 1.5 GLX6DCT" modelo "X70",    version "X70PLUS 1.5 GLX-6DCT"
 *
 * Un join por igualdad cubre el 39% de las unidades. Lo que funciona:
 *
 *  1. Del lado de Cars se indexan TRES claves por fila — el modelo, la
 *     version completa y el primer token de la version. La tercera es la que
 *     rescata a Jetour: Cars guarda la familia ("TRAVELLER") y el nombre que
 *     usa la DNRA vive en la version ("T2 PHEV"). Son 242 unidades.
 *  2. Se puntua por SOLAPAMIENTO de palabras, no por contencion estricta.
 *     Con contencion, "TANK 400" no matcheaba "TANK 400 PHEV 4WD" (le sobran
 *     dos palabras) y caia en la familia "TANK", cuyo minimo es el TANK 300:
 *     $39.990 en vez de $48.990. El precio salia plausible y equivocado, que
 *     es la peor combinacion posible en un grafico de posicionamiento.
 *  3. El PRIMER token tiene que coincidir. Sin eso "H6" matchea cualquier
 *     cosa que lleve un 6.
 *
 * Con eso el cruce cubre el 93,1% de las unidades del grupo. Lo que queda
 * afuera son camiones (Fuso, Canter, chasis JAC): Cars no les pone precio de
 * lista porque se cotizan. Esos modelos se listan aparte, no se ocultan.
 *
 * NO SE PARTEN LETRAS DE DIGITOS. Se probo normalizar "X70PLUS" a "X70 PLUS"
 * separando letra de numero, y arruina el dato: "T2" pasa a ser ["T","2"], el
 * prefijo de version queda en "T", y T1 y T2 de Jetour terminan con EL MISMO
 * precio. Para ese caso se compara la forma pegada, que no depende de donde
 * cada fuente puso el espacio.
 */

/** Palabras de un nombre de modelo. Se corta por separadores y nada mas: ver
 *  el comentario de arriba sobre por que no se separan letras de digitos. */
function tokens(s: string): string[] {
  return String(s).toUpperCase().split(/[\s\-/.]+/).filter(Boolean);
}

interface Candidato {
  tokens: string[];
  precio: number;
}

/** true si todas las palabras buscadas aparecen, en orden, en el nombre. */
function contiene(nombre: string[], buscados: string[]): boolean {
  let i = 0;
  for (const t of buscados) {
    const j = nombre.indexOf(t, i);
    if (j === -1) return false;
    i = j + 1;
  }
  return true;
}

/** "X70PLUS 1.5 GLX6DCT" contra "X70 PLUS": pegando los dos lados, uno
 *  contiene al otro sin importar donde cada fuente puso el espacio. */
function contienePegado(nombre: string[], buscados: string[]): boolean {
  return buscados.length > 1 && nombre.join("").includes(buscados.join(""));
}

function elegirPrecio(nombre: string[], candidatos: Candidato[]): number | null {
  const puntuados = candidatos
    .map((c) => ({
      ...c,
      comunes: c.tokens.filter((t) => nombre.includes(t)).length,
      pega: contienePegado(nombre, c.tokens),
    }))
    .filter(
      (c) =>
        (c.tokens[0] === nombre[0] && c.comunes > 0) ||
        c.pega ||
        contiene(nombre, c.tokens)
    )
    // Gana el que comparte mas palabras. A igualdad, el mas barato: es el
    // "desde" de la familia, que es lo que corresponde cuando CADAM agrupo
    // varias versiones bajo un solo nombre.
    .sort((a, b) => b.comunes - a.comunes || a.precio - b.precio);
  return puntuados[0]?.precio ?? null;
}

export interface GamaPropiaCars {
  conPrecio: ModeloConPrecio[];
  sinPrecio: { marca: string; modelo: string; unidades: number }[];
  /** Cuando Cars sincronizo por ultima vez. Se muestra: un precio sin fecha
   *  no se puede llevar a una reunion. */
  sincronizado: string | null;
  /** null cuando no se pudo leer Cars (Postgres caido, por ejemplo). La
   *  pantalla lo dice en vez de mostrar una gama vacia como si no vendieramos. */
  error: string | null;
}

export async function getGamaPropiaDesdeCars(f: Filtro): Promise<GamaPropiaCars> {
  const propias = [...getMarcasPropiasSet()];
  const vacio: GamaPropiaCars = {
    conPrecio: [], sinPrecio: [], sincronizado: null, error: null,
  };
  if (!propias.length) return vacio;

  // Unidades del periodo, por marca y modelo (CADAM, SQLite).
  const marcasIn = propias.map(() => "?").join(",");
  const ventas = getDb()
    .prepare(
      `SELECT marca, modelo_base modelo, SUM(unidades) unidades
       FROM v_matriculacion
       WHERE anio = ? AND mes BETWEEN ? AND ? AND marca IN (${marcasIn})
       GROUP BY marca, modelo_base
       HAVING unidades > 0
       ORDER BY unidades DESC`
    )
    .all(f.anio, f.mesDesde, f.mesHasta, ...propias) as {
    marca: string; modelo: string; unidades: number;
  }[];
  if (!ventas.length) return vacio;

  // Precios del stock (Cars, Postgres).
  let filas: { marca: string; modelo: string; version: string; precio: number }[];
  let sincronizado: string | null = null;
  try {
    const pool = getPool();
    const r = await pool.query<{ marca: string; modelo: string; version: string; precio: number }>(
      `select marca, modelo, version, min(precio_usd)::int precio
       from stock_propio
       where marca = any($1) and precio_usd is not null and precio_usd > 5000
       group by marca, modelo, version`,
      [propias]
    );
    filas = r.rows;
  } catch (e) {
    return { ...vacio, error: (e as Error).message };
  }

  // LA FECHA DE SINCRONIZACION VA EN SU PROPIO try, Y NO ES NEGOCIABLE.
  // Estaba adentro del anterior, y con el nombre de tabla equivocado
  // (`sync_propio` en vez de `sincronizacion_propia`): la consulta tiraba, el
  // catch devolvia el estado de error, y la pantalla quedaba vacia en
  // produccion POR UN TIMESTAMP DECORATIVO, con los 122 precios ya leidos y
  // descartados. Un dato cosmetico nunca puede tumbar al dato principal.
  try {
    const s = await getPool().query<{ t: string }>(
      `select max(actualizado_en)::text t from sincronizacion_propia`
    );
    sincronizado = s.rows[0]?.t ?? null;
  } catch {
    sincronizado = null; // se muestra sin fecha; los precios siguen estando
  }

  // Indice por marca: modelo, version completa y primer token de la version.
  const porMarca = new Map<string, Candidato[]>();
  const agregar = (marca: string, nombre: string, precio: number) => {
    const t = tokens(nombre);
    if (!t.length) return;
    const lista = porMarca.get(marca) ?? [];
    const clave = t.join(" ");
    const ya = lista.find((x) => x.tokens.join(" ") === clave);
    if (ya) ya.precio = Math.min(ya.precio, precio);
    else lista.push({ tokens: t, precio });
    porMarca.set(marca, lista);
  };
  for (const f2 of filas) {
    agregar(f2.marca, f2.modelo, f2.precio);
    agregar(f2.marca, f2.version, f2.precio);
    const tv = tokens(f2.version);
    if (tv.length > 1) agregar(f2.marca, tv[0], f2.precio);
  }

  const conPrecio: ModeloConPrecio[] = [];
  const sinPrecio: { marca: string; modelo: string; unidades: number }[] = [];
  const periodo = `${f.anio}-${String(f.mesHasta).padStart(2, "0")}`;
  for (const v of ventas) {
    const precio = elegirPrecio(tokens(v.modelo), porMarca.get(v.marca) ?? []);
    if (precio === null) sinPrecio.push(v);
    else
      conPrecio.push({
        marca: v.marca, modelo: v.modelo, unidades: v.unidades,
        precio, moneda: "USD", periodoPrecio: periodo,
      });
  }
  return { conPrecio, sinPrecio, sincronizado, error: null };
}
