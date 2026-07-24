"use client";

import { EchartsAuto } from "@/components/charts/echarts-auto";
import { FUENTE_MONO_EJES, TOOLTIP_BASE, useChartTheme } from "@/lib/chart-theme";
import { formatUnidades } from "@/lib/format";

export interface CapaApilada {
  /** Nombre de la capa (ej. "Combustión", "Híbridos", "Eléctricos"). */
  nombre: string;
  /** Un valor por categoría del eje X, en el mismo orden que `categorias`. */
  datos: number[];
}

/**
 * Barras apiladas (referencia 2026-07, adaptada a ECharts + nuestra paleta,
 * NO reaviz/framer): cada barra suma sus capas al total de esa categoría.
 * Sirve para composición-que-cambia (ej. mix de tecnología por año). Los
 * colores salen de la paleta categórica validada para daltonismo, no se
 * ciclan; la leyenda es propia (HTML) para que herede tipografía/tabular.
 */
export function StackedBarChart({
  categorias,
  series,
  altura = 300,
}: {
  categorias: string[];
  series: CapaApilada[];
  altura?: number;
}) {
  const theme = useChartTheme();

  const option = {
    color: theme.series,
    animationDuration: 700,
    animationEasing: "cubicOut" as const,
    grid: { left: 8, right: 8, top: 8, bottom: 8, containLabel: true },
    tooltip: {
      ...TOOLTIP_BASE,
      trigger: "axis" as const,
      axisPointer: { type: "shadow" as const },
      valueFormatter: (v: number | null) =>
        v === null || v === undefined ? "—" : `${formatUnidades(v)} u.`,
    },
    legend: { show: false },
    xAxis: {
      type: "category" as const,
      data: categorias,
      axisLine: { lineStyle: { color: theme.grid } },
      axisLabel: { color: theme.text, fontSize: 11, fontFamily: FUENTE_MONO_EJES },
    },
    yAxis: {
      type: "value" as const,
      splitLine: { lineStyle: { color: theme.grid } },
      axisLabel: {
        color: theme.text,
        fontSize: 11,
        fontFamily: FUENTE_MONO_EJES,
        formatter: (v: number) => formatUnidades(v),
      },
    },
    series: series.map((s, i) => ({
      name: s.nombre,
      type: "bar" as const,
      stack: "total",
      barMaxWidth: 46,
      // Sólo la capa de arriba (última) redondea el tope de la barra.
      itemStyle: i === series.length - 1
        ? { borderRadius: [5, 5, 0, 0] as [number, number, number, number] }
        : undefined,
      emphasis: { focus: "series" as const },
      data: s.datos,
    })),
  };

  return (
    <div className="flex flex-col gap-4">
      <EchartsAuto option={option} style={{ height: altura, width: "100%" }} notMerge />
      <ul className="flex flex-wrap gap-x-4 gap-y-1.5">
        {series.map((s, i) => (
          <li key={s.nombre} className="flex items-center gap-2 text-xs text-muted-foreground">
            <span
              aria-hidden="true"
              className="size-2.5 shrink-0 rounded-[3px]"
              style={{ backgroundColor: theme.series[i % theme.series.length] }}
            />
            <span className="font-medium text-foreground">{s.nombre}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
