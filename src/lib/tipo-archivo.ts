import { N_, type T } from "@/lib/i18n/traducir";
import type { I18n } from "@/lib/i18n/crear";

/**
 * El tipo de archivo que detectó la carga, dicho en el idioma de la pantalla.
 *
 * La descripción la escribe el pipeline de ingesta (CADAM/scripts/cadam/detect.py)
 * y está pensada para quien lo mantiene: «matriculaciones row-level
 * (marca/modelo/segmento/tecnologia/importador)». En la pantalla eso son tres
 * palabras de máquina y una lista de columnas — nadie que mire «Calidad de
 * datos» para saber si el informe llegó bien necesita saber qué es row-level.
 *
 * Se traduce acá y no en el pipeline a propósito: cambiar detect.py obligaría
 * a volver a ingerir todo para que las filas viejas se lean bien, y la
 * descripción cruda sigue siendo la correcta del lado de la máquina.
 */
const TRADUCCIONES: [RegExp, string][] = [
  [/^matriculaciones row-level/i, N_("Matriculaciones · detalle por vehículo")],
  [/^importacion row-level/i, N_("Importaciones · detalle por vehículo")],
  [/^importacion de vehiculos de energia nueva/i, N_("Importaciones · híbridos y eléctricos")],
  [/^importacion de camiones/i, N_("Importaciones · camiones y ómnibus")],
  [/^matriculaciones por combustible/i, N_("Matriculaciones · por combustible")],
  [/^matriculaciones por localidad/i, N_("Matriculaciones · por localidad")],
  // Los tipos cortos de la base local ('matriculacion', 'importacion', …).
  [/^matriculacion(es)?$/i, N_("Matriculaciones")],
  [/^importacion(es)?$/i, N_("Importaciones")],
  [/^camion(es)?$/i, N_("Importaciones · camiones y ómnibus")],
  [/^nev$/i, N_("Importaciones · híbridos y eléctricos")],
  [/^movilidad$/i, N_("Matriculaciones · por combustible")],
  [/^localidad(es)?$/i, N_("Matriculaciones · por localidad")],
];

/**
 * Lo mismo, pero dentro de un mensaje.
 *
 * Los hallazgos de la carga los escribe ingest.py como texto libre
 * («Detectado como importacion row-level (marca/modelo/segmento/dimensiones)»)
 * y se guardan así en la base. Traducir la fila entera no alcanza: hay que
 * reemplazar la descripción donde aparezca.
 *
 * EN CASTELLANO el mensaje se muestra tal cual lo escribió el pipeline (con
 * esos reemplazos y nada más). EN INGLÉS se intenta primero reconocer el mensaje
 * entero entre los que escribe el pipeline (ver `traducirMensajeDeCarga`): son
 * texto de la base, pero salen de plantillas fijas con números adentro, así que
 * se pueden decir en inglés sin inventar nada. Un mensaje que no se reconoce
 * queda en castellano, nunca se adivina.
 */
export function mensajeLegible(texto: string | null | undefined, i18n: I18n): string {
  if (!texto) return "";
  const { t } = i18n;
  if (i18n.idioma !== "es") {
    const entero = traducirMensajeDeCarga(texto, t);
    if (entero !== null) return entero;
  }
  return texto
    .replace(/matriculaciones row-level \([^)]*\)/gi, t("matriculaciones con detalle por vehículo"))
    .replace(/importacion(?:es)? row-level \([^)]*\)/gi, t("importaciones con detalle por vehículo"))
    .replace(/\brow-level\b/gi, t("con detalle por vehículo"));
}

export function tipoArchivoLegible(tipo: string | null | undefined, t: T): string {
  if (!tipo) return "—";
  const limpio = tipo.trim();
  for (const [re, texto] of TRADUCCIONES) {
    if (re.test(limpio)) return t(texto);
  }
  // Uno que no está en la tabla: al menos sacarle la jerga y la lista de
  // columnas, en vez de mostrarlo crudo.
  return limpio
    .replace(/\s*row-level\s*/i, ` · ${t("detalle por vehículo")} `)
    .replace(/\s*\([^)]*\)\s*$/, "")
    .trim();
}

// ----------------------------------------------------------------------------
// Los mensajes del pipeline de carga, en inglés (solo se usa con la pantalla en inglés).
//
// Los textos de abajo son los que escribe CADAM/scripts (ingest.py, rowlevel.py, validar.py, complemento*.py)
// tal cual, sin tildes: son la CLAVE para reconocerlos; lo que se muestra sale de `t()`.

/** Los mensajes que el pipeline escribe siempre igual. */
const MENSAJES_FIJOS: string[] = [
  N_("Modelos con mas de una clasificacion 'Tipo cadam' en el mismo mes; se tomo la mas frecuente"),
  N_("Filas descartadas por fecha vacia o ilegible"),
  N_("Filas con unidades vacias, computadas como 0"),
  N_("Filas con unidades negativas"),
  N_("Filas sin segmento en el origen (Grupo='NDA'); se muestran como dato no disponible, no como un segmento mas"),
  N_("Filas reclasificadas por correccion manual de tecnologia"),
  N_("Filas con TIPO GRAL='NO' (sin clasificar en el origen)"),
  N_("Filas sin fecha o de total descartadas (incluye la fila 'Localidades' que trae el archivo)"),
  N_("Filas de matriculacion con la misma clave, sumadas"),
  N_("Filas de importacion con la misma clave, sumadas"),
  N_("Filas de NEV con la misma clave, sumadas"),
  N_("Filas de camiones con la misma clave, sumadas"),
  N_("Filas de movilidad con la misma clave, sumadas"),
  N_("Filas de localidad con la misma clave, sumadas"),
];

/** «Detectado como …»: la descripción de la firma de columnas (detect.py). */
const DESCRIPCIONES: [RegExp, string][] = [
  [/^matriculaciones row-level/i, N_("matriculaciones con detalle por vehículo")],
  [/^importacion row-level/i, N_("importaciones con detalle por vehículo")],
  [/^importacion de vehiculos de energia nueva/i, N_("importacion de vehiculos de energia nueva (EV/HEV/PHEV)")],
  [/^importacion de camiones/i, N_("importacion de camiones y omnibus")],
  [/^matriculaciones por combustible/i, N_("matriculaciones por combustible (nafta/gasoil/flex/hibrido/electrico)")],
  [/^matriculaciones por localidad/i, N_("matriculaciones por localidad")],
];

const tipoDe = (palabra: string, t: T) => (palabra === "Matriculacion" ? t("Matriculacion") : t("Importacion"));

/** «6 meses comparables» / «1 mes comparables» (el pipeline no concuerda el plural). */
const alcanceDe = (n: string, t: T) => (n === "1" ? t("1 mes comparables") : t("{n} meses comparables", { n }));

/** «4 versiones (12 vehiculos)», con sus singulares. */
function versionesDe(n: string, u: string, t: T): string {
  const versiones = n === "1" ? t("1 version") : t("{n} versiones", { n });
  const vehiculos = u === "1" ? t("1 vehiculo") : t("{u} vehiculos", { u });
  return t("{versiones} ({vehiculos})", { versiones, vehiculos });
}

/** Las aclaraciones que `complemento_movilidad.py` pega después de «… en el mes mas cercano». */
function notaDeMovilidad(nota: string, t: T): string {
  let m = /^(\d+) versiones? \(([\d,]+) vehiculos?\) tenian mas de una combinacion en ese mes y se tomo la de mas unidades$/.exec(nota);
  if (m) return t("{cuantas} tenian mas de una combinacion en ese mes y se tomo la de mas unidades", { cuantas: versionesDe(m[1], m[2], t) });
  m = /^(\d+) versiones? \(([\d,]+) vehiculos?\) que el detalle no tiene escritas igual tomaron segmento e importador de su modelo, y la tecnologia de su nombre o de su combustible$/.exec(nota);
  if (m) return t("{cuantas} que el detalle no tiene escritas igual tomaron segmento e importador de su modelo, y la tecnologia de su nombre o de su combustible", { cuantas: versionesDe(m[1], m[2], t) });
  m = /^(\d+) versiones? \(([\d,]+) vehiculos?\) sin modelo reconocible quedan sin segmento ni importador$/.exec(nota);
  if (m) return t("{cuantas} sin modelo reconocible quedan sin segmento ni importador", { cuantas: versionesDe(m[1], m[2], t) });
  return nota;
}

/**
 * El mensaje entero del pipeline en inglés, o null si no es uno de los conocidos.
 * Los números, las marcas y los nombres de archivo van tal cual vienen.
 */
function traducirMensajeDeCarga(texto: string, t: T): string | null {
  if (MENSAJES_FIJOS.includes(texto)) return t(texto);

  let m = /^Detectado como (.+)$/.exec(texto);
  if (m) {
    const d = DESCRIPCIONES.find(([re]) => re.test(m![1]));
    return t("Detectado como {desc}", { desc: d ? t(d[1]) : m[1] });
  }

  m = /^(Matriculacion|Importacion) (\d{4}) \((\d+) mes(?:es)? comparables\): ([\d,]+) unidades, coincide exacto con el informe oficial de CADAM$/.exec(texto);
  if (m) {
    return t("{tipo} {anio} ({alcance}): {u} unidades, coincide exacto con el informe oficial de CADAM", {
      tipo: tipoDe(m[1], t), anio: m[2], alcance: alcanceDe(m[3], t), u: m[4],
    });
  }

  m = /^(Matriculacion|Importacion) (\d{4}) \((\d+) mes(?:es)? comparables\): row-level ([\d,]+) vs informe oficial ([\d,]+) \(diferencia ([^)]+)\)$/.exec(texto);
  if (m) {
    return t("{tipo} {anio} ({alcance}): row-level {a} vs informe oficial {b} (diferencia {d})", {
      tipo: tipoDe(m[1], t), anio: m[2], alcance: alcanceDe(m[3], t), a: m[4], b: m[5], d: m[6],
    });
  }

  m = /^(Matriculacion|Importacion): meses sin datos dentro del rango (\S+): (.+)$/.exec(texto);
  if (m) {
    return t("{tipo}: meses sin datos dentro del rango {rango}: {meses}", { tipo: tipoDe(m[1], t), rango: m[2], meses: m[3] });
  }

  m = /^(Matriculacion|Importacion): unidades sin segmento en el origen \((.+)\)\. Se muestran como dato no disponible, no se reparten entre los demas segmentos\.$/.exec(texto);
  if (m) {
    return t("{tipo}: unidades sin segmento en el origen ({detalle}). Se muestran como dato no disponible, no se reparten entre los demas segmentos.", {
      tipo: tipoDe(m[1], t), detalle: m[2],
    });
  }

  m = /^Marca\/mes donde 'import nev' supera a 'base importacion'\. Estas unidades NO se suman al total de importaciones \(el NEV es un subconjunto\)\. Marcas: (.+)$/.exec(texto);
  if (m) {
    return t("Marca/mes donde 'import nev' supera a 'base importacion'. Estas unidades NO se suman al total de importaciones (el NEV es un subconjunto). Marcas: {marcas}", { marcas: m[1] });
  }

  m = /^Modelos con varias grafias en el origen \(espacios, guiones, barras o puntos\) unificados a la mas frecuente\. Ej\.: (.+)$/.exec(texto);
  if (m) {
    return t("Modelos con varias grafias en el origen (espacios, guiones, barras o puntos) unificados a la mas frecuente. Ej.: {ejemplos}", { ejemplos: m[1] });
  }

  m = /^Modelo separado de version usando el catalogo de importacion: (\d+) de (\d+) filas identificadas\. Las (\d+) restantes \(([\d,]+) unidades\) muestran la version completa en el ranking de modelos, en vez de adivinar el corte\.$/.exec(texto);
  if (m) {
    return t("Modelo separado de version usando el catalogo de importacion: {a} de {b} filas identificadas. Las {c} restantes ({u} unidades) muestran la version completa en el ranking de modelos, en vez de adivinar el corte.", {
      a: m[1], b: m[2], c: m[3], u: m[4],
    });
  }

  m = /^Valores de (TIPO|MOVILIDAD) no reconocidos: (.+)$/.exec(texto);
  if (m) return t("Valores de {columna} no reconocidos: {valores}", { columna: m[1], valores: m[2] });

  m = /^Informe estadistico de CADAM \((\d+) hojas\); lo procesa ingest_cadam\.py, no este pipeline$/.exec(texto);
  if (m) return t("Informe estadistico de CADAM ({n} hojas); lo procesa ingest_cadam.py, no este pipeline", { n: m[1] });

  m = /^No se pudo abrir el archivo: (.+)$/.exec(texto);
  if (m) return t("No se pudo abrir el archivo: {motivo}", { motivo: m[1] });

  m = /^No coincide con ninguna estructura conocida\. Columnas del archivo: (.+)\. Falta\(n\) para la firma mas parecida: (.+)$/.exec(texto);
  if (m) {
    return t("No coincide con ninguna estructura conocida. Columnas del archivo: {columnas}. Falta(n) para la firma mas parecida: {faltan}", {
      columnas: m[1], faltan: m[2],
    });
  }

  m = /^El control '(.+)' fallo: (.+)$/.exec(texto);
  if (m) return t("El control '{nombre}' fallo: {motivo}", { nombre: m[1], motivo: m[2] });

  // Cuando el detalle por vehículo de la importación todavía no llegó (complemento.py).
  m = /^Importacion (.+?): el detalle por vehiculo todavia no llego y se completo desde el Cuadro 8 del informe estadistico de CADAM \(([\d,]+) vehiculos livianos en (\d+) modelos(?:, ([\d,]+) camiones y omnibus)?\)\. Tiene marca, modelo, segmento y tipo, pero no origen ni medidas\. Se reemplaza solo cuando entre el archivo de detalle\.$/.exec(texto);
  if (m) {
    const vars = { meses: m[1], livianos: m[2], modelos: m[3], camiones: m[4] ?? "" };
    return m[4] === undefined
      ? t("Importacion {meses}: el detalle por vehiculo todavia no llego y se completo desde el Cuadro 8 del informe estadistico de CADAM ({livianos} vehiculos livianos en {modelos} modelos). Tiene marca, modelo, segmento y tipo, pero no origen ni medidas. Se reemplaza solo cuando entre el archivo de detalle.", vars)
      : t("Importacion {meses}: el detalle por vehiculo todavia no llego y se completo desde el Cuadro 8 del informe estadistico de CADAM ({livianos} vehiculos livianos en {modelos} modelos, {camiones} camiones y omnibus). Tiene marca, modelo, segmento y tipo, pero no origen ni medidas. Se reemplaza solo cuando entre el archivo de detalle.", vars);
  }

  // Cuando el detalle de matriculación no trae el mes y se completa con el archivo por combustible (complemento_movilidad.py).
  m = /^Matriculacion (.+?): el detalle de CADAM \(matriculaciones\.xlsx\) no trae (ese mes|esos meses) y se completo desde el archivo por combustible \(([\d,]+) vehiculos en (\d+) versiones\), que en los (\d+) meses que tienen los dos coincide exacto\. Segmento, tecnologia e importador se copiaron de la misma version en el mes mas cercano(?:\. (.+?))?\. Se reemplaza solo cuando el detalle traiga el mes\.$/.exec(texto);
  if (m) {
    const notas = m[6] ? m[6].split("; ").map((n) => notaDeMovilidad(n, t)).join("; ") : "";
    const vars = {
      meses: m[1],
      cuando: m[2] === "ese mes" ? t("ese mes") : t("esos meses"),
      u: m[3], v: m[4], c: m[5], notas,
    };
    return notas
      ? t("Matriculacion {meses}: el detalle de CADAM (matriculaciones.xlsx) no trae {cuando} y se completo desde el archivo por combustible ({u} vehiculos en {v} versiones), que en los {c} meses que tienen los dos coincide exacto. Segmento, tecnologia e importador se copiaron de la misma version en el mes mas cercano. {notas}. Se reemplaza solo cuando el detalle traiga el mes.", vars)
      : t("Matriculacion {meses}: el detalle de CADAM (matriculaciones.xlsx) no trae {cuando} y se completo desde el archivo por combustible ({u} vehiculos en {v} versiones), que en los {c} meses que tienen los dos coincide exacto. Segmento, tecnologia e importador se copiaron de la misma version en el mes mas cercano. Se reemplaza solo cuando el detalle traiga el mes.", vars);
  }

  // … y cuando no se pudo completar (complemento_movilidad.py).
  m = /^Matriculacion (.+?): el detalle no trae el mes y el archivo por combustible si, pero no se completo porque en (\d+) de (\d+) meses en comun los totales no coinciden \(ej\. (\S+): detalle ([\d,]+), combustible ([\d,]+)\)\.$/.exec(texto);
  if (m) {
    return t("Matriculacion {meses}: el detalle no trae el mes y el archivo por combustible si, pero no se completo porque en {n} de {total} meses en comun los totales no coinciden (ej. {ejemplo}: detalle {detalle}, combustible {combustible}).", {
      meses: m[1], n: m[2], total: m[3], ejemplo: m[4], detalle: m[5], combustible: m[6],
    });
  }
  m = /^Matriculacion (.+?): el detalle no trae el mes y el archivo por combustible si, pero no se completo porque no hay ningun mes en comun para comprobar que sean el mismo dato\.$/.exec(texto);
  if (m) {
    return t("Matriculacion {meses}: el detalle no trae el mes y el archivo por combustible si, pero no se completo porque no hay ningun mes en comun para comprobar que sean el mismo dato.", { meses: m[1] });
  }

  return null;
}
