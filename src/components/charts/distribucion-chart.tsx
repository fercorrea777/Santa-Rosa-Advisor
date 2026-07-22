"use client";

import ReactECharts from "echarts-for-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useChartTheme } from "@/lib/chart-theme";
import { formatUnidades } from "@/lib/format";

export interface Porcion {
  nombre: string;
  valor: number;
}

/**
 * Distribucion (dona) con etiquetas de valor y porcentaje, y clic como
 * filtro: al tocar una porcion se escribe `?{param}=<valor>` en la URL y
 * toda la pagina se recalcula. Otro clic sobre la misma porcion lo quita.
 *
 * Solo se etiquetan las porciones que superan `minLabel` (3% por
 * defecto): poner un numero sobre cada tajada hace la dona ilegible
 * cuando hay cola larga. Las chicas siguen visibles en la leyenda y en el
 * tooltip.
 *
 * El centro muestra el total, o el detalle de la porcion filtrada cuando
 * hay una activa.
 */
export function DistribucionChart({
  datos,
  param,
  maximo = 8,
  altura = 280,
  minLabel = 0.03,
}: {
  datos: Porcion[];
  /** Si se pasa, la dona filtra por este parametro de la URL. */
  param?: string;
  maximo?: number;
  altura?: number;
  minLabel?: number;
}) {
  const theme = useChartTheme();
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const activo = param ? sp.get(param) : null;

  const ordenados = [...datos].sort((a, b) => b.valor - a.valor);
  const visibles = ordenados.slice(0, maximo);
  const resto = ordenados.slice(maximo);
  if (resto.length) {
    visibles.push({
      nombre: `Otros (${resto.length})`,
      valor: resto.reduce((s, d) => s + d.valor, 0),
    });
  }
  const total = visibles.reduce((s, d) => s + d.valor, 0) || 1;

  const onClick = (p: { name?: string }) => {
    if (!param || !p.name || p.name.startsWith("Otros (")) return;
    const q = new URLSearchParams(sp.toString());
    if (activo === p.name) q.delete(param);
    else q.set(param, p.name);
    router.replace(`${pathname}?${q.toString()}`, { scroll: false });
  };

  const seleccion = activo ? visibles.find((d) => d.nombre === activo) : undefined;

  const option = {
    color: [...theme.series, theme.axis],
    tooltip: {
      trigger: "item",
      formatter: (p: { name: string; value: number; percent: number }) =>
        `${p.name}<br/><b>${formatUnidades(p.value)}</b> u. · <b>${p.percent}%</b>` +
        (param
          ? `<br/><span style="font-size:11px;opacity:.75">${
              activo === p.name ? "Clic para quitar el filtro" : "Clic para filtrar"
            }</span>`
          : ""),
    },
    legend: {
      type: "scroll",
      orient: "vertical",
      right: 0,
      top: "middle",
      itemWidth: 10,
      itemHeight: 10,
      textStyle: { color: theme.text, fontSize: 11 },
      formatter: (nombre: string) => {
        const d = visibles.find((v) => v.nombre === nombre);
        if (!d) return nombre;
        return `${nombre}  ${((d.valor / total) * 100).toFixed(1)}%`;
      },
    },
    graphic: {
      type: "text",
      left: "29%",
      top: "middle",
      style: {
        text: seleccion
          ? `${seleccion.nombre}\n${formatUnidades(seleccion.valor)} u.\n${((seleccion.valor / total) * 100).toFixed(1)}%`
          : `Total\n${formatUnidades(total)} u.`,
        textAlign: "center",
        fill: theme.text,
        fontSize: 12,
        lineHeight: 17,
      },
    },
    series: [
      {
        type: "pie",
        radius: ["48%", "72%"],
        center: ["30%", "50%"],
        avoidLabelOverlap: true,
        cursor: param ? "pointer" : "default",
        itemStyle: {
          borderColor: "transparent",
          borderWidth: 2,
          // Cuando hay filtro activo, las demas se atenuan para que se vea
          // cual esta seleccionada.
          opacity: 1,
        },
        label: {
          show: true,
          position: "outside",
          color: theme.text,
          fontSize: 11,
          formatter: (p: { name: string; value: number; percent: number }) =>
            p.percent / 100 >= minLabel
              ? `${formatUnidades(p.value)}\n${p.percent}%`
              : "",
        },
        labelLine: {
          show: true,
          length: 8,
          length2: 8,
          lineStyle: { color: theme.grid },
        },
        emphasis: {
          scale: true,
          scaleSize: 6,
          label: { fontWeight: "bold" },
        },
        data: visibles.map((d) => ({
          name: d.nombre,
          value: d.valor,
          // Atenuar las no seleccionadas hace evidente que hay un filtro.
          itemStyle: activo && d.nombre !== activo ? { opacity: 0.28 } : undefined,
        })),
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

  return (
    <ReactECharts
      option={option}
      style={{ height: altura, width: "100%" }}
      notMerge
      onEvents={param ? { click: onClick } : undefined}
    />
  );
}
