"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { formatPct } from "@/lib/format";
import { useCountUp } from "@/lib/use-count-up";

interface KpiCardProps {
  label: string;
  value: string;
  periodo?: string;
  variacion?: number | null;
  tooltip?: string;
  disponible?: boolean;
  /** Si se pasa, el valor se anima con count-up desde 0 hasta este numero
   *  y `formatearAnimado` decide como se muestra en cada frame. Si no se
   *  pasa, se usa `value` tal cual sin animar — para KPIs de texto (marca,
   *  segmento) que no son un conteo. */
  valorAnimado?: number;
  formatearAnimado?: (n: number) => string;
}

export function KpiCard({
  label,
  value,
  periodo,
  variacion,
  tooltip,
  disponible = true,
  valorAnimado,
  formatearAnimado,
}: KpiCardProps) {
  // Se llama siempre (regla de hooks), aunque no se use el resultado: sin
  // valorAnimado, contado queda en 0 y no se muestra en ningun lado.
  const contado = useCountUp(valorAnimado ?? 0);
  const valorMostrado = valorAnimado !== undefined
    ? (formatearAnimado ? formatearAnimado(contado) : String(contado))
    : value;
  if (!disponible) {
    return (
      <Card className="gap-2 py-4">
        <CardHeader className="flex flex-row items-center justify-between gap-2 px-4">
          <span className="text-[0.7rem] font-semibold uppercase tracking-[0.07em] text-muted-foreground">
            {label}
          </span>
          {tooltip && <InfoTip text={tooltip} />}
        </CardHeader>
        <CardContent className="px-4">
          <p className="text-lg font-medium text-muted-foreground">Sin datos cargados</p>
          <p className="text-xs text-muted-foreground/70">Pendiente de ingesta</p>
        </CardContent>
      </Card>
    );
  }

  const isUp = (variacion ?? 0) > 0;
  const isDown = (variacion ?? 0) < 0;

  return (
    <Card className="group/kpi gap-2 py-4">
      <CardHeader className="flex flex-row items-center justify-between gap-2 px-4">
        <span className="text-[0.7rem] font-semibold uppercase tracking-[0.07em] text-muted-foreground">
          {label}
        </span>
        {tooltip && <InfoTip text={tooltip} />}
      </CardHeader>
      <CardContent className="px-4">
        {/* El peso lo fija .metric (700); no agregar font-* aca o lo pisa. */}
        <p className="metric text-[1.75rem] text-foreground">{valorMostrado}</p>
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
          {variacion !== undefined && variacion !== null ? (
            <span
              className={cn(
                // Fondo tenue del propio color: la variacion se lee de lejos
                // sin que el numero principal pierda protagonismo.
                "inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-xs font-semibold tabular-nums",
                isUp && "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400",
                isDown && "bg-rose-500/12 text-rose-600 dark:text-rose-400",
                !isUp && !isDown && "bg-muted text-muted-foreground"
              )}
            >
              <span aria-hidden="true">{isUp ? "▲" : isDown ? "▼" : "–"}</span>
              {formatPct(variacion, { signed: true })}
            </span>
          ) : variacion === null ? (
            <span className="text-xs text-muted-foreground">Sin base comparativa</span>
          ) : null}
          {periodo && <span className="text-xs text-muted-foreground">{periodo}</span>}
        </div>
      </CardContent>
    </Card>
  );
}

function InfoTip({ text }: { text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger className="flex size-3.5 shrink-0 items-center justify-center rounded-full border border-muted-foreground/40 bg-transparent p-0 text-[9px] font-bold leading-none text-muted-foreground/70">
        ?
      </TooltipTrigger>
      <TooltipContent className="max-w-64 text-xs">{text}</TooltipContent>
    </Tooltip>
  );
}
