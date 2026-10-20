import { cn } from "@/lib/utils";
import { formatPct } from "@/lib/format";

/**
 * Las dos celdas que repiten todos los rankings: la variación contra el año
 * pasado y el cambio de puesto. Viven acá (y no dentro de TablaRanking) para
 * que la tabla de grupos y la de marcas digan lo mismo del mismo modo.
 */

export function Variacion({ v, entrante }: { v: number | null; entrante: boolean }) {
  if (v === null) {
    return (
      <span className="text-muted-foreground">
        {entrante ? "Nuevo" : "—"}
      </span>
    );
  }
  const up = v > 0, down = v < 0;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5",
        up && "text-emerald-700 dark:text-emerald-400",
        down && "text-rose-700 dark:text-rose-400"
      )}
    >
      <span aria-hidden="true">{up ? "▲" : down ? "▼" : "–"}</span>
      {formatPct(v, { signed: true })}
    </span>
  );
}

export function CambioPosicion({
  cambio, anterior,
}: { cambio: number | null; anterior: number | null }) {
  if (cambio === null || anterior === null) {
    return <span className="text-muted-foreground">—</span>;
  }
  if (cambio === 0) {
    return <span className="text-muted-foreground">=</span>;
  }
  const sube = cambio > 0;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5",
        sube ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400"
      )}
      title={`Posición anterior: ${anterior}`}
    >
      <span aria-hidden="true">{sube ? "▲" : "▼"}</span>
      {Math.abs(cambio)}
    </span>
  );
}
