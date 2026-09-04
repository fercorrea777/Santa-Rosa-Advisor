/**
 * Zona horaria de TODO lo que muestre fecha u hora: Paraguay, UTC−3 FIJO.
 *
 * Por qué un desplazamiento fijo y no `timeZone: "America/Asuncion"`: el
 * contenedor de producción corre en UTC (TZ vacío), y el Node de adentro
 * trae una tabla de zonas horarias vieja que para Asunción en septiembre
 * todavía aplica UTC−4 —el horario de invierno que Paraguay abolió en
 * octubre de 2024 (UTC−3 todo el año)—. Con el nombre IANA, la sincronización
 * de las 14:25 salía como "13:25": una hora mal, pero al revés que antes
 * (con la zona del servidor salía "17:25"). El offset fijo no depende de qué
 * tabla tenga el runtime. Si Paraguay volviera a cambiar la hora, se cambia
 * este número y nada más.
 */
export const DESPLAZAMIENTO_PY_MIN = -3 * 60;

function aFecha(v: string | number | Date | null | undefined): Date | null {
  if (v === null || v === undefined || v === "") return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** El mismo instante corrido al huso paraguayo, para formatearlo "en UTC". */
function enParaguay(d: Date): Date {
  return new Date(d.getTime() + DESPLAZAMIENTO_PY_MIN * 60_000);
}

/** "04/09/2026 12:42", en hora de Paraguay. "—" si no hay fecha. */
export function formatFechaHora(v: string | number | Date | null | undefined): string {
  const d = aFecha(v);
  if (!d) return "—";
  return new Intl.DateTimeFormat("es-PY", {
    timeZone: "UTC",
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: false,
  })
    .format(enParaguay(d))
    .replace(", ", " ");
}

/** "04/09/2026", en hora de Paraguay. "—" si no hay fecha. */
export function formatFecha(v: string | number | Date | null | undefined): string {
  const d = aFecha(v);
  if (!d) return "—";
  return new Intl.DateTimeFormat("es-PY", {
    timeZone: "UTC", day: "2-digit", month: "2-digit", year: "numeric",
  }).format(enParaguay(d));
}

/** "2026-09-04": la fecha de HOY en Paraguay, para cálculos y claves.
 *  `toISOString().slice(0, 10)` daba la de UTC, que de 21:00 a 24:00 es la
 *  de mañana. Como el instante ya viene corrido, el ISO en UTC es la fecha
 *  local. */
export function hoyEnAsuncion(ahora: Date = new Date()): string {
  return enParaguay(ahora).toISOString().slice(0, 10);
}

export function formatUnidades(n: number): string {
  return new Intl.NumberFormat("es-PY", { maximumFractionDigits: 0 }).format(n);
}

export function formatPct(v: number | null, opts?: { signed?: boolean }): string {
  if (v === null || !Number.isFinite(v)) return "—";
  const pct = v * 100;
  const sign = opts?.signed && pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)}%`;
}

export function formatPuntosPct(v: number): string {
  const sign = v > 0 ? "+" : "";
  return `${sign}${(v * 100).toFixed(1)} pp`;
}
