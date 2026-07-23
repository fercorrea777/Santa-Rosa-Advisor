"use client";

import { EchartsAuto } from "@/components/charts/echarts-auto";
import { TOOLTIP_BASE, useChartTheme } from "@/lib/chart-theme";
import { formatUnidades, formatPct } from "@/lib/format";

export interface SegmentoDonut {
  nombre: string;
  valor: number;
}

/**
 * Anillo con total al centro + leyenda a un costado (referencia 2026-07:
 * patrón "Tasks by Status"). El centro nunca es decorativo: siempre el
 * número real que suma el 100% del anillo, para que el total no quede
 * escondido detrás de las porciones.
 */
export function DonutChart({
  datos,
  altura = 220,
}: {
  datos: SegmentoDonut[];
  altura?: number;
}) {
  const theme = useChartTheme();
  const total = datos.reduce((s, d) => s + d.valor, 0);

  const option = {
    animationDuration: 700,
    animationEasing: "cubicOut" as const,
    tooltip: {
      ...TOOLTIP_BASE,
      trigger: "item" as const,
      formatter: (p: { name: string; value: number; percent: number }) =>
        `${p.name}<br/><b>${formatUnidades(p.value)}</b> u. · ${p.percent}%`,
    },
    legend: { show: false },
    series: [
      {
        type: "pie" as const,
        radius: ["62%", "88%"],
        avoidLabelOverlap: false,
        color: theme.series,
        label: { show: false },
        labelLine: { show: false },
        emphasis: {
          scale: true,
          scaleSize: 4,
          itemStyle: { shadowBlur: 12, shadowColor: "oklch(0.2 0.05 260 / 25%)" },
        },
        itemStyle: {
          borderColor: theme.card,
          borderWidth: 2,
        },
        data: datos.map((d) => ({ name: d.nombre, value: d.valor })),
      },
    ],
  };

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <div className="relative shrink-0" style={{ width: altura, height: altura }}>
        <EchartsAuto option={option} style={{ height: altura, width: altura }} notMerge />
        {/* Total al centro: overlay HTML, no texto de ECharts — así hereda
            tipografía/tabular-nums del resto de la app sin pelear con el
            canvas. pointer-events-none para no tapar el hover del anillo. */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="metric text-2xl text-foreground">{formatUnidades(total)}</span>
          <span className="text-[0.65rem] font-medium uppercase tracking-wide text-muted-foreground">
            Total
          </span>
        </div>
      </div>
      <ul className="flex flex-1 flex-col gap-2.5">
        {datos.map((d, i) => (
          <li key={d.nombre} className="flex items-center gap-2.5 text-sm">
            <span
              aria-hidden="true"
              className="size-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: theme.series[i % theme.series.length] }}
            />
            <span className="min-w-0 flex-1 truncate font-medium text-foreground">{d.nombre}</span>
            <span className="shrink-0 tabular-nums text-muted-foreground">
              {formatUnidades(d.valor)} · {formatPct(total ? d.valor / total : 0)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
