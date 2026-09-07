"use client";

import { EchartsAuto } from "@/components/charts/echarts-auto";
import { TOOLTIP_BASE, useChartTheme } from "@/lib/chart-theme";
import { formatUnidades } from "@/lib/format";
import { mesCorto } from "@/lib/periodo";

export interface MesPlan {
  mes: number;
  plan: number;
  facturado: number;
  /** true hasta el último mes cerrado del Excel: ahí el plan ES el real. */
  cerrado: boolean;
}

/**
 * Plan vigente (gris) contra facturado (color) por mes. Los meses cerrados
 * van con fondo tenue y rótulo «cerrado»: en esos el plan es el real y las
 * dos barras miden lo mismo, así que no hay cumplimiento que leer. La línea
 * punteada es el presupuesto anual dividido doce: una referencia visual,
 * no un objetivo mensual —Finanzas no presupuestó por mes—.
 */
export function PlanVsFacturadoChart({
  meses,
  referenciaMensual,
  altura = 300,
  etiquetaPlan = "Plan vigente",
  etiquetaReal = "Facturado (Cars)",
}: {
  meses: MesPlan[];
  referenciaMensual: number | null;
  altura?: number;
  /** Nombres de las dos series en la leyenda: para los canales el real no
   *  es de Cars sino de Finanzas, y el plan es un objetivo puro. */
  etiquetaPlan?: string;
  etiquetaReal?: string;
}) {
  const theme = useChartTheme();
  const cerrados = meses.filter((m) => m.cerrado);
  const option = {
    animationDuration: 500,
    grid: { left: 48, right: 56, top: 32, bottom: 32 },
    tooltip: {
      ...TOOLTIP_BASE,
      trigger: "axis",
      formatter: (ps: { dataIndex: number }[]) => {
        const m = meses[ps[0]?.dataIndex ?? 0];
        if (!m) return "";
        const dif = m.facturado - m.plan;
        return (
          `<b>${mesCorto(m.mes)}</b>${m.cerrado ? " · cerrado (el plan es el real)" : ""}<br/>` +
          `plan ${formatUnidades(m.plan)} · facturado ${formatUnidades(m.facturado)}` +
          (m.cerrado ? "" : `<br/>diferencia <b>${dif >= 0 ? "+" : ""}${formatUnidades(dif)}</b>`)
        );
      },
    },
    legend: { top: 0, textStyle: { color: theme.text, fontSize: 11 } },
    xAxis: {
      type: "category" as const,
      data: meses.map((m) => mesCorto(m.mes)),
      axisLabel: { color: theme.text, fontSize: 11 },
      axisLine: { lineStyle: { color: theme.grid } },
      axisTick: { show: false },
    },
    yAxis: {
      type: "value" as const,
      axisLabel: { color: theme.text, fontSize: 11, formatter: (v: number) => formatUnidades(v) },
      splitLine: { lineStyle: { color: theme.grid } },
    },
    series: [
      {
        name: etiquetaPlan,
        type: "bar" as const,
        data: meses.map((m) => m.plan),
        itemStyle: { color: theme.axis, borderRadius: [4, 4, 0, 0] },
        barGap: "10%",
        markArea: cerrados.length
          ? {
              silent: true,
              itemStyle: { color: theme.text, opacity: 0.06 },
              label: {
                show: true,
                position: "insideTop" as const,
                color: theme.text,
                fontSize: 10,
                formatter: "cerrado",
              },
              data: [
                [
                  { xAxis: mesCorto(cerrados[0].mes) },
                  { xAxis: mesCorto(cerrados[cerrados.length - 1].mes) },
                ],
              ],
            }
          : undefined,
        markLine:
          referenciaMensual !== null
            ? {
                silent: true,
                symbol: "none",
                lineStyle: { type: "dashed" as const, color: theme.text, width: 1 },
                label: {
                  position: "end" as const,
                  color: theme.text,
                  fontSize: 10,
                  formatter: "ppto ÷ 12",
                },
                data: [{ yAxis: Math.round(referenciaMensual) }],
              }
            : undefined,
      },
      {
        name: etiquetaReal,
        type: "bar" as const,
        data: meses.map((m) => m.facturado),
        itemStyle: { color: theme.primary, borderRadius: [4, 4, 0, 0] },
      },
    ],
  };
  return <EchartsAuto option={option} style={{ height: altura, width: "100%" }} notMerge />;
}
