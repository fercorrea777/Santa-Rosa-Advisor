"use client";

import ReactECharts from "echarts-for-react";
import { useChartTheme } from "@/lib/chart-theme";
import { formatUnidades } from "@/lib/format";

export interface Porcion {
  nombre: string;
  valor: number;
}

/** Distribucion (dona) de una dimension. Ordena por tamano y agrupa la
 *  cola en "Otros" para que la leyenda sea legible. */
export function DistribucionChart({
  datos,
  maximo = 8,
  altura = 260,
}: {
  datos: Porcion[];
  maximo?: number;
  altura?: number;
}) {
  const theme = useChartTheme();
  const ordenados = [...datos].sort((a, b) => b.valor - a.valor);
  const visibles = ordenados.slice(0, maximo);
  const resto = ordenados.slice(maximo);
  if (resto.length) {
    visibles.push({
      nombre: `Otros (${resto.length})`,
      valor: resto.reduce((s, d) => s + d.valor, 0),
    });
  }

  const option = {
    color: [...theme.series, theme.axis],
    tooltip: {
      trigger: "item",
      formatter: (p: { name: string; value: number; percent: number }) =>
        `${p.name}<br/><b>${formatUnidades(p.value)}</b> u. · ${p.percent}%`,
    },
    legend: {
      type: "scroll",
      orient: "vertical",
      right: 0,
      top: "middle",
      textStyle: { color: theme.text, fontSize: 11 },
    },
    series: [
      {
        type: "pie",
        radius: ["45%", "72%"],
        center: ["32%", "50%"],
        avoidLabelOverlap: true,
        itemStyle: { borderColor: "transparent", borderWidth: 2 },
        label: { show: false },
        data: visibles.map((d) => ({ name: d.nombre, value: d.valor })),
      },
    ],
  };

  if (!datos.length) {
    return (
      <p className="py-16 text-center text-sm text-muted-foreground">
        Sin datos para este filtro.
      </p>
    );
  }

  return <ReactECharts option={option} style={{ height: altura, width: "100%" }} notMerge />;
}
