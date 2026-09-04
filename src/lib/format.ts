/**
 * Zona horaria de TODO lo que muestre fecha u hora. El contenedor de
 * producción corre en UTC (TZ vacío): sin esto, `toLocaleString("es-PY")`
 * mostraba "15:42" para una sincronización de las 12:42 — y a las 23:30 de
 * Asunción, `toLocaleDateString` ya decía mañana. Paraguay es UTC−3 fijo
 * desde octubre de 2024 (sin horario de verano), pero se usa el nombre IANA
 * y no el offset: si alguna vez vuelve el cambio de hora, esto lo sigue.
 */
export const ZONA_HORARIA = "America/Asuncion";

function aFecha(v: string | number | Date | null | undefined): Date | null {
  if (v === null || v === undefined || v === "") return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "04/09/2026 12:42", en hora de Asunción. "—" si no hay fecha. */
export function formatFechaHora(v: string | number | Date | null | undefined): string {
  const d = aFecha(v);
  if (!d) return "—";
  return new Intl.DateTimeFormat("es-PY", {
    timeZone: ZONA_HORARIA,
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: false,
  })
    .format(d)
    .replace(", ", " ");
}

/** "04/09/2026", en hora de Asunción. "—" si no hay fecha. */
export function formatFecha(v: string | number | Date | null | undefined): string {
  const d = aFecha(v);
  if (!d) return "—";
  return new Intl.DateTimeFormat("es-PY", {
    timeZone: ZONA_HORARIA, day: "2-digit", month: "2-digit", year: "numeric",
  }).format(d);
}

/** "2026-09-04": la fecha de HOY en Asunción, para cálculos y claves.
 *  `toISOString().slice(0, 10)` daba la de UTC, que de 21:00 a 24:00 es la
 *  de mañana. en-CA es el locale que formatea como ISO. */
export function hoyEnAsuncion(ahora: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA_HORARIA, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(ahora);
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
