"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { formatPct, formatUnidades } from "@/lib/format";
import { useCountUp } from "@/lib/use-count-up";

interface KpiCardProps {
  label: string;
  value: string;
  periodo?: string;
  variacion?: number | null;
  tooltip?: string;
  disponible?: boolean;
  /** Si se pasa, el valor se anima con count-up desde 0 hasta este numero,
   *  formateado segun `formato`. Si no se pasa, se usa `value` tal cual sin
   *  animar — para KPIs de texto (marca, segmento) que no son un conteo.
   *
   *  Es un enum (no una funcion) a proposito: este componente es
   *  "use client" y `value`/`valorAnimado`/etc. suelen venir de un Server
   *  Component (paginas como Inicio) — una funcion no se puede pasar como
   *  prop a traves de ese limite (React no la puede serializar). */
  valorAnimado?: number;
  formato?: "unidades" | "porcentaje";
  /** Serie mensual opcional (12 posiciones, null = sin dato) para dibujar
   *  una sparkline al pie de la tarjeta. Contexto de tendencia de un
   *  vistazo, sin ejes ni tooltip: para el detalle está el gráfico grande. */
  serie?: (number | null)[];
}

const FORMATEADORES: Record<NonNullable<KpiCardProps["formato"]>, (n: number) => string> = {
  unidades: formatUnidades,
  porcentaje: (n) => formatPct(n),
};

export function KpiCard({
  label,
  value,
  periodo,
  variacion,
  tooltip,
  disponible = true,
  valorAnimado,
  formato,
  serie,
}: KpiCardProps) {
  // Se llama siempre (regla de hooks), aunque no se use el resultado: sin
  // valorAnimado, contado queda en 0 y no se muestra en ningun lado.
  const contado = useCountUp(valorAnimado ?? 0);
  const valorMostrado = valorAnimado !== undefined
    ? (formato ? FORMATEADORES[formato](contado) : String(contado))
    : value;
  if (!disponible) {
    return (
      <Card className="w-full gap-2 py-4">
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
    <Card className="group/kpi w-full gap-2 py-4">
      <CardHeader className="flex flex-row items-center justify-between gap-2 px-4">
        <span className="text-[0.7rem] font-semibold uppercase tracking-[0.07em] text-muted-foreground">
          {label}
        </span>
        {tooltip && <InfoTip text={tooltip} />}
      </CardHeader>
      {/* flex-1 + mt-auto en la fila secundaria: en una grilla con tarjetas
          de distinta altura (con y sin sparkline) la línea de contexto queda
          anclada al fondo en todas — sin vacíos asimétricos. */}
      <CardContent className="flex flex-1 flex-col px-4">
        {/* El peso lo fija .metric (700); no agregar font-* aca o lo pisa. */}
        <p className="metric text-[2rem] text-foreground">{valorMostrado}</p>
        <div className="mt-auto flex flex-wrap items-center gap-x-2 gap-y-1 pt-2">
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
        {serie && <Sparkline serie={serie} />}
      </CardContent>
    </Card>
  );
}

/** Mini-tendencia SVG al pie del KPI. Puro y sin dependencias: normaliza los
 *  valores al alto disponible y traza línea + área con el acento. Los meses
 *  sin dato (null) simplemente no aportan punto — igual criterio que los
 *  gráficos grandes: un hueco, nunca un cero inventado. */
function Sparkline({ serie }: { serie: (number | null)[] }) {
  const puntos = serie
    .map((v, i) => ({ v, i }))
    .filter((p): p is { v: number; i: number } => p.v !== null);
  if (puntos.length < 2) return null;

  const W = 100;
  const H = 26;
  const min = Math.min(...puntos.map((p) => p.v));
  const max = Math.max(...puntos.map((p) => p.v));
  const rango = max - min || 1;
  const x = (i: number) => (i / (serie.length - 1)) * W;
  const y = (v: number) => H - 3 - ((v - min) / rango) * (H - 6);
  const linea = puntos.map((p, k) => `${k === 0 ? "M" : "L"}${x(p.i).toFixed(1)} ${y(p.v).toFixed(1)}`).join(" ");
  const area = `${linea} L${x(puntos[puntos.length - 1].i).toFixed(1)} ${H} L${x(puntos[0].i).toFixed(1)} ${H} Z`;
  const ultimo = puntos[puntos.length - 1];

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      className="mt-3 h-7 w-full opacity-90"
    >
      <path d={area} fill="var(--primary)" opacity="0.13" />
      <path d={linea} fill="none" stroke="var(--primary)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
      <circle cx={x(ultimo.i)} cy={y(ultimo.v)} r="2.4" fill="var(--primary)" vectorEffect="non-scaling-stroke" />
    </svg>
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
