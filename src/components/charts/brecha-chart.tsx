"use client";

import { EchartsAuto } from "@/components/charts/echarts-auto";
import {
  etiquetaValor, FUENTE_MONO_EJES, TOOLTIP_BASE, useChartTheme,
} from "@/lib/chart-theme";
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
    animationDuration: 700,
    animationEasing: "cubicOut" as const,
    // Aire arriba: la etiqueta de la barra más alta se dibuja por encima.
    grid: { left: 8, right: 8, top: 48, bottom: 24, containLabel: true },
    tooltip: {
      ...TOOLTIP_BASE,
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
        fontFamily: FUENTE_MONO_EJES,
        formatter: (v: number) => formatUnidades(v),
      },
    },
    series: [
      {
        name: "Diferencia (import. − matric.)",
        type: "bar",
        data: diferencia,
        // SIN `opacity`. Estaba en 0.55 para que las dos líneas se leyeran por
        // encima, pero diluir el color contra el panel lo saca de la paleta
        // validada: medido sobre `--card` oscuro, `--chart-4` da 5,71:1 solo y
        // 2,57:1 compuesto al 55% — por debajo del piso de 3:1 que declara el
        // DESIGN.md para los tonos de gráfico. Y visualmente el ámbar se
        // convertía en un marrón sucio que no es ningún token del sistema.
        //
        // Las líneas igual quedan arriba: van después en `series`, y ECharts
        // dibuja en ese orden. La separación se logra con el z, no bajándole
        // el contraste al dato.
        itemStyle: { borderRadius: [4, 4, 0, 0] },
        barMaxWidth: 28,
        // Si dos barras vecinas quedan muy juntas, se descarta la etiqueta
        // que chocaría en vez de dibujar las dos encimadas.
        labelLayout: { hideOverlap: true },
        // La cifra va SOLO en la barra, no en las dos líneas. Con las tres
        // etiquetadas las tres se pisan entre sí en cada mes, y la barra es
        // el sujeto de este gráfico: las líneas son de dónde sale.
        label: etiquetaValor(theme, { formatter: formatUnidades }),
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

  // Sin notMerge: las 3 series son fijas, el merge por defecto tween-ea
  // valor viejo -> nuevo en vez de replayear la entrada en cada filtro.
  return <EchartsAuto option={option} style={{ height: altura, width: "100%" }} />;
}
