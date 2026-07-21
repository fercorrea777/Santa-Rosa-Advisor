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
