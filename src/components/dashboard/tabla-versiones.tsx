import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatPct, formatPuntosPct, formatUnidades } from "@/lib/format";
import type { FilaRanking } from "@/lib/cadam/mercado";

/**
 * Ranking de versiones con el share de los dos períodos y su diferencia en
 * puntos porcentuales.
 *
 * Por qué el Δ va en PUNTOS y no en % de variación: entre 2025 y 2026 el
 * mercado creció 54%, así que las unidades de un período no son comparables
 * con las del otro — un modelo puede vender más y aun así perder terreno. El
 * share sí es comparable, y su diferencia en pp es la única lectura honesta
 * de "ganó o cedió posición".
 */
export function TablaVersiones({
  filas,
  limite = 50,
}: {
  filas: FilaRanking[];
  limite?: number;
}) {
  const visibles = filas.slice(0, limite);
  if (!visibles.length) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Sin versiones para este filtro.
      </p>
    );
  }

  // La barra se escala contra el mayor movimiento absoluto de lo que se
  // muestra, no contra un máximo fijo: si el período fue tranquilo, igual se
  // ven las diferencias relativas.
  const maxDelta = Math.max(
    ...visibles.map((f) => Math.abs(f.deltaShare ?? 0)),
    0.0001
  );

  // El total sale del share, NO de sumar las filas: el ranking viene con
  // LIMIT, así que sumar lo que se ve daría un número menor al mercado y el
  // pie diría "100%" al lado de un total que no lo es. Se despeja del share
  // de la primera fila con dato, que ya viene calculado contra el total real.
  const conShare = filas.find((f) => f.participacion > 0);
  const totalU = conShare ? Math.round(conShare.unidades / conShare.participacion) : 0;
  const conShareAnt = filas.find((f) => f.participacionAnterior > 0);
  const totalAnt = conShareAnt
    ? Math.round(conShareAnt.unidadesAnterior / conShareAnt.participacionAnterior)
    : 0;

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10 text-right">#</TableHead>
            <TableHead>Versión</TableHead>
            <TableHead>Modelo</TableHead>
            <TableHead>Marca</TableHead>
            <TableHead className="text-right">Unidades</TableHead>
            <TableHead className="text-right">Share</TableHead>
            <TableHead className="text-right">Año ant.</TableHead>
            <TableHead className="text-right">Share ant.</TableHead>
            <TableHead className="w-36 text-right">Δ share</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {visibles.map((f) => {
            const d = f.deltaShare;
            const ancho = d === null ? 0 : (Math.abs(d) / maxDelta) * 50;
            return (
              <TableRow
                key={f.clave}
                className={cn(f.esPropia && "bg-primary/5")}
              >
                <TableCell className="text-right tabular-nums text-muted-foreground">
                  {f.posicion}
                </TableCell>
                <TableCell className={cn("min-w-64", f.esPropia && "font-semibold")}>
                  {f.clave}
                </TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground">
                  {f.modelo ?? "—"}
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  <span className={cn(f.esPropia && "font-semibold text-primary")}>
                    {f.marca}
                  </span>
                  {f.esPropia && (
                    <Badge variant="outline" className="ml-1.5 text-[10px] font-normal">
                      propia
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatUnidades(f.unidades)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatPct(f.participacion)}
                </TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">
                  {f.unidadesAnterior ? formatUnidades(f.unidadesAnterior) : "—"}
                </TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">
                  {f.unidadesAnterior ? formatPct(f.participacionAnterior) : "—"}
                </TableCell>
                <TableCell className="text-right">
                  {d === null ? (
                    <span className="text-muted-foreground">—</span>
                  ) : (
                    // Barra divergente desde el centro: a la derecha ganó
                    // share, a la izquierda cedió. El signo del número
                    // acompaña al color — el color no es el único canal.
                    <span className="flex items-center justify-end gap-2">
                      <span className="relative h-2.5 w-14 shrink-0 rounded-sm bg-muted">
                        <span
                          className={cn(
                            "absolute top-0 h-full",
                            d >= 0
                              ? "left-1/2 rounded-r-sm bg-emerald-500/80"
                              : "right-1/2 rounded-l-sm bg-rose-500/80"
                          )}
                          style={{ width: `${ancho}%` }}
                        />
                      </span>
                      <span
                        className={cn(
                          "w-16 tabular-nums",
                          d > 0 && "text-emerald-600 dark:text-emerald-400",
                          d < 0 && "text-rose-600 dark:text-rose-400"
                        )}
                      >
                        {formatPuntosPct(d)}
                      </span>
                    </span>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
          <TableRow className="border-t-2 font-semibold">
            <TableCell />
            <TableCell>Total del mercado</TableCell>
            <TableCell />
            <TableCell />
            <TableCell className="text-right tabular-nums">
              {formatUnidades(totalU)}
            </TableCell>
            <TableCell className="text-right tabular-nums">100%</TableCell>
            <TableCell className="text-right tabular-nums">
              {totalAnt ? formatUnidades(totalAnt) : "—"}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {totalAnt ? "100%" : "—"}
            </TableCell>
            <TableCell />
          </TableRow>
        </TableBody>
      </Table>
      {filas.length > limite && (
        <p className="pt-2 text-xs text-muted-foreground">
          Mostrando las {limite} primeras de {filas.length}. El total de arriba
          es de todas.
        </p>
      )}
    </div>
  );
}
