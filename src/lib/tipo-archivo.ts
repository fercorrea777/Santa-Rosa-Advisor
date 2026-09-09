/**
 * El tipo de archivo que detectó la carga, dicho en castellano.
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
  [/^matriculaciones row-level/i, "Matriculaciones · detalle por vehículo"],
  [/^importacion row-level/i, "Importaciones · detalle por vehículo"],
  [/^importacion de vehiculos de energia nueva/i, "Importaciones · híbridos y eléctricos"],
  [/^importacion de camiones/i, "Importaciones · camiones y ómnibus"],
  [/^matriculaciones por combustible/i, "Matriculaciones · por combustible"],
  [/^matriculaciones por localidad/i, "Matriculaciones · por localidad"],
  // Los tipos cortos de la base local ('matriculacion', 'importacion', …).
  [/^matriculacion(es)?$/i, "Matriculaciones"],
  [/^importacion(es)?$/i, "Importaciones"],
  [/^camion(es)?$/i, "Importaciones · camiones y ómnibus"],
  [/^nev$/i, "Importaciones · híbridos y eléctricos"],
  [/^movilidad$/i, "Matriculaciones · por combustible"],
  [/^localidad(es)?$/i, "Matriculaciones · por localidad"],
];

/**
 * Lo mismo, pero dentro de un mensaje.
 *
 * Los hallazgos de la carga los escribe ingest.py como texto libre
 * («Detectado como importacion row-level (marca/modelo/segmento/dimensiones)»)
 * y se guardan así en la base. Traducir la fila entera no alcanza: hay que
 * reemplazar la descripción donde aparezca.
 */
export function mensajeLegible(texto: string | null | undefined): string {
  if (!texto) return "";
  return texto
    .replace(/matriculaciones row-level \([^)]*\)/gi, "matriculaciones con detalle por vehículo")
    .replace(/importacion(?:es)? row-level \([^)]*\)/gi, "importaciones con detalle por vehículo")
    .replace(/\brow-level\b/gi, "con detalle por vehículo");
}

export function tipoArchivoLegible(tipo: string | null | undefined): string {
  if (!tipo) return "—";
  const limpio = tipo.trim();
  for (const [re, texto] of TRADUCCIONES) {
    if (re.test(limpio)) return texto;
  }
  // Uno que no está en la tabla: al menos sacarle la jerga y la lista de
  // columnas, en vez de mostrarlo crudo.
  return limpio
    .replace(/\s*row-level\s*/i, " · detalle por vehículo ")
    .replace(/\s*\([^)]*\)\s*$/, "")
    .trim();
}
