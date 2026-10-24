/**
 * Formatos de cifras y fechas EN CASTELLANO (es-PY).
 *
 * Esto es solo la versión en castellano, para código que escribe texto fijo en
 * castellano (logs, mensajes a máquinas, scripts). TODO lo que se le muestra a
 * una persona usa el formato de SU idioma, y ese sale de `fmt`:
 *
 *   servidor:  `const { fmt } = await getI18n();`        (@/lib/i18n/servidor)
 *   cliente:   `const { fmt } = useI18n();`              (@/lib/i18n/cliente)
 *
 * Los nombres son los mismos que acá (`fmt.formatUnidades`, `fmt.formatPct`…),
 * así que alcanza con destructurarlos de `fmt` en lugar de importarlos de este
 * archivo. Un `formatUnidades` importado de acá en una pantalla muestra `42.328`
 * también a quien eligió inglés, y en inglés eso se lee como 42,328. La
 * implementación, y el porqué de cada formato, está en @/lib/i18n/formatos.
 */
import { I18N_ES } from "./i18n/crear";

export { DESPLAZAMIENTO_PY_MIN, hoyEnAsuncion, nombreDeMarca } from "./i18n/formatos";

const ES = I18N_ES.fmt;

export const formatFechaHora = ES.formatFechaHora;
export const formatFecha = ES.formatFecha;
export const formatUnidades = ES.formatUnidades;
export const decimal = ES.decimal;
export const formatPct = ES.formatPct;
export const formatPuntosPct = ES.formatPuntosPct;
export const formatDecimal = ES.formatDecimal;
export const nombreDeSegmento = ES.nombreDeSegmento;
export const nombreDeGrupo = ES.nombreDeGrupo;
