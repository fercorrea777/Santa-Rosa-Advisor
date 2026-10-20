import { cn } from "@/lib/utils";
import { formatPct } from "@/lib/format";

/**
 * Las celdas que repiten todos los rankings: la variación contra el año
 * pasado, el cambio de puesto y la parte/puesto en el mercado entero. Viven acá
 * (y no dentro de TablaRanking) para que la tabla de grupos y la de marcas
 * digan lo mismo del mismo modo.
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

/**
 * La participación en el mercado ENTERO y el puesto que se ocupa en él, en dos
 * renglones: arriba la parte («2,2%»), que es lo que se compara de una fila a
 * otra; abajo el puesto («#11»). Van juntas en una columna y no en dos porque
 * con las medidas del filtro al lado la tabla de modelos pasaba de 1138 px y
 * se desbordaba en un monitor de 1440; es el mismo patrón que ya usa «Part.»
 * del ranking por grupo con su variación en puntos debajo.
 */
export function ParteYPuesto({
  parte, puesto,
}: { parte: number | null | undefined; puesto: number | null | undefined }) {
  return (
    <>
      <span className="block">{parte == null ? "—" : formatPct(parte)}</span>
      <span className="block text-[11px] text-muted-foreground">
        {puesto ? (
          <>
            <span aria-hidden="true">#{puesto}</span>
            <span className="sr-only">puesto {puesto}</span>
          </>
        ) : (
          "—"
        )}
      </span>
    </>
  );
}
