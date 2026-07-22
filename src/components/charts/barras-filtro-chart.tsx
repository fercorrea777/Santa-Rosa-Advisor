"use client";

import { EchartsAuto } from "@/components/charts/echarts-auto";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useChartTheme } from "@/lib/chart-theme";
import { formatUnidades } from "@/lib/format";

export interface Barra {
  nombre: string;
  valor: number;
}

/**
 * Barras horizontales que FUNCIONAN COMO FILTRO: al hacer clic en una
 * barra se escribe `?{param}=<valor>` en la URL y toda la pagina se
 * recalcula con ese corte. Clic en la barra ya activa = quitar el filtro.
 *
 * La barra activa queda resaltada y las demas se atenuan, para que se
 * vea que hay un filtro aplicado.
 */
export function BarrasFiltroChart({
  datos,
  param = "segmento",
  altura = 260,
}: {
  datos: Barra[];
  param?: string;
  altura?: number;
}) {
  const theme = useChartTheme();
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const activo = sp.get(param);

  const ordenados = [...datos].sort((a, b) => a.valor - b.valor); // asc: ECharts pinta de abajo hacia arriba

  const onClick = (p: { name?: string }) => {
    if (!p.name) return;
    const q = new URLSearchParams(sp.toString());
    if (activo === p.name) q.delete(param);
    else q.set(param, p.name);
    router.replace(`${pathname}?${q.toString()}`, { scroll: false });
  };

  const option = {
    animationDuration: 600,
    animationEasing: "cubicOut" as const,
    grid: { left: 8, right: 48, top: 8, bottom: 8, containLabel: true },
    tooltip: {
      trigger: "item",
      formatter: (p: { name: string; value: number }) =>
        `${p.name}<br/><b>${formatUnidades(p.value)}</b> u.<br/>` +
        `<span style="font-size:11px;opacity:.75">${activo === p.name ? "Clic para quitar el filtro" : "Clic para filtrar"}</span>`,
    },
    xAxis: {
      type: "value",
      splitLine: { lineStyle: { color: theme.grid } },
      axisLabel: { color: theme.text, fontSize: 11, formatter: (v: number) => formatUnidades(v) },
    },
    yAxis: {
      type: "category",
      data: ordenados.map((d) => d.nombre),
      axisLine: { lineStyle: { color: theme.grid } },
      axisLabel: { color: theme.text, fontSize: 11 },
    },
    series: [
      {
        type: "bar",
        barMaxWidth: 22,
        cursor: "pointer",
        itemStyle: {
          borderRadius: [0, 4, 4, 0],
          // Degradado horizontal en las barras vivas: cuerpo pleno que se
          // enciende hacia la punta. Las filtradas-fuera quedan en gris plano.
          color: (p: { name: string }) =>
            !activo || p.name === activo
              ? {
                  type: "linear" as const,
                  x: 0, y: 0, x2: 1, y2: 0,
                  colorStops: [
                    { offset: 0, color: `${theme.series[0]}99` },
                    { offset: 1, color: theme.series[0] },
                  ],
                }
              : theme.grid,
        },
        emphasis: { itemStyle: { color: theme.series[1] } },
        label: {
          show: true,
          position: "right",
          color: theme.text,
          fontSize: 11,
          formatter: (p: { value: number }) => formatUnidades(p.value),
        },
        data: ordenados.map((d) => d.valor),
      },
    ],
  };

  if (!datos.length) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        Sin datos para este filtro.
      </p>
    );
  }

  return (
    <EchartsAuto
      option={option}
      style={{ height: altura, width: "100%" }}
      notMerge
      onEvents={{ click: onClick }}
    />
  );
}
