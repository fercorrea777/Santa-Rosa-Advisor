"use client";

import ReactECharts from "echarts-for-react";
import { useChartTheme } from "@/lib/chart-theme";
import { formatUnidades } from "@/lib/format";

/**
 * Importaciones vs matriculaciones, mes a mes.
 *
 * Las tres series comparten UN SOLO eje: son todas unidades, asi que un
 * segundo eje solo distorsionaria la comparacion. La diferencia se dibuja
 * como barra para que se lea como saldo del mes y no como una tercera
 * curva de volumen.
 */
export function BrechaChart({
  meses,
  importaciones,
  matriculaciones,
  diferencia,
  altura = 320,
}: {
  meses: string[];
  importaciones: (number | null)[];
  matriculaciones: (number | null)[];
  diferencia: (number | null)[];
  altura?: number;
}) {
  const theme = useChartTheme();

  const option = {
    // El orden sigue al de `series`: barra de diferencia, importaciones,
    // matriculaciones.
    color: [theme.series[3], theme.series[0], theme.series[1]],
    grid: { left: 8, right: 8, top: 36, bottom: 24, containLabel: true },
    tooltip: {
      trigger: "axis",
      valueFormatter: (v: number | null) =>
        v === null || v === undefined ? "Sin datos" : formatUnidades(v),
    },
    legend: { top: 0, textStyle: { color: theme.text, fontSize: 12 } },
    xAxis: {
      type: "category",
      data: meses,
      axisLine: { lineStyle: { color: theme.grid } },
      axisLabel: { color: theme.text, fontSize: 11 },
    },
    yAxis: {
      type: "value",
      splitLine: { lineStyle: { color: theme.grid } },
      axisLabel: {
        color: theme.text, fontSize: 11,
        formatter: (v: number) => formatUnidades(v),
      },
    },
    series: [
      {
        name: "Diferencia (import. − matric.)",
        type: "bar",
        data: diferencia,
        itemStyle: { borderRadius: [4, 4, 0, 0], opacity: 0.55 },
        barMaxWidth: 28,
      },
      {
        name: "Importaciones",
        type: "line",
        smooth: true,
        symbolSize: 7,
        connectNulls: false,
        lineStyle: { width: 3 },
        data: importaciones,
      },
      {
        name: "Matriculaciones",
        type: "line",
        smooth: true,
        symbolSize: 7,
        connectNulls: false,
        lineStyle: { width: 3 },
        data: matriculaciones,
      },
    ],
  };

  return <ReactECharts option={option} style={{ height: altura, width: "100%" }} notMerge />;
}
