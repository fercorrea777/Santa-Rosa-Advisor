"use client";

import { EchartsAuto } from "@/components/charts/echarts-auto";
import { useChartTheme } from "@/lib/chart-theme";
import { formatUnidades } from "@/lib/format";
import { MESES_CORTOS } from "@/lib/periodo";

export interface SerieAnio {
  /** Nombre de la serie. Normalmente el año, pero tambien se usa para
   *  comparar marcas o segmentos entre si (Market Share). */
  anio: number | string;
  /** 12 posiciones (Ene..Dic). null = mes SIN DATO, no cero. */
  valores: (number | null)[];
  punteada?: boolean;
  /** Sufijo para el tooltip, ej. '%'. Por defecto son unidades. */
  unidad?: "unidades" | "porcentaje";
}

/**
 * Evolucion mensual comparando anios.
 *
 * `connectNulls: false` es deliberado: un mes sin datos deja un hueco
 * visible en la linea en vez de unir los puntos vecinos, que sugeriria
 * una continuidad que el dato no tiene (spec sec. 13). El tooltip lo
 * dice explicitamente.
 */
export function SerieAniosChart({
  series,
  tipo = "line",
  altura = 300,
}: {
  series: SerieAnio[];
  tipo?: "line" | "bar";
  altura?: number;
}) {
  const theme = useChartTheme();

  const option = {
    color: theme.series,
    animationDuration: 700,
    animationEasing: "cubicOut" as const,
    grid: { left: 8, right: 8, top: 36, bottom: 24, containLabel: true },
    tooltip: {
      trigger: "axis",
      valueFormatter: (v: number | null) => {
        if (v === null || v === undefined) return "Sin datos";
        return series[0]?.unidad === "porcentaje"
          ? `${v.toFixed(1)}%`
          : formatUnidades(v);
      },
    },
    legend: { top: 0, textStyle: { color: theme.text, fontSize: 12 } },
    xAxis: {
      type: "category",
      data: MESES_CORTOS,
      axisLine: { lineStyle: { color: theme.grid } },
      axisLabel: { color: theme.text, fontSize: 11 },
    },
    yAxis: {
      type: "value",
      splitLine: { lineStyle: { color: theme.grid } },
      axisLabel: {
        color: theme.text,
        fontSize: 11,
        formatter: (v: number) => formatUnidades(v),
      },
    },
    series: series.map((s) => ({
      name: String(s.anio),
      type: tipo,
      smooth: tipo === "line",
      symbolSize: 6,
      // Ver comentario del componente: los huecos NO se conectan.
      connectNulls: false,
      lineStyle: s.punteada ? { width: 2, type: "dashed" } : { width: 3 },
      data: s.valores,
    })),
  };

  return <EchartsAuto option={option} style={{ height: altura, width: "100%" }} notMerge />;
}
