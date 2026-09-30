"use client";

import { useState } from "react";
import { EchartsAuto } from "@/components/charts/echarts-auto";
import { FUENTE_MONO_EJES, TOOLTIP_BASE, useChartTheme } from "@/lib/chart-theme";
import { formatPct, formatUnidades } from "@/lib/format";
import type { PuntoRentabilidad } from "@/lib/informes/rentabilidad";
import { cn } from "@/lib/utils";

type EjeX = "ticket" | "margen" | "margenPct";

/** Qué tono de la paleta le toca a cada marca, siempre el mismo. Las ocho de
 *  más volumen del grupo; ZEEKR y XPENG, que venden de a pocas, van a «Otras». */
const ORDEN_COLOR = ["JETOUR", "GREAT WALL", "SOUEAST", "RENAULT", "JAC", "MITSUBISHI", "JMEV", "LEAPMOTOR"];
type Nivel = "version" | "modelo";

const EJES: { valor: EjeX; label: string; nombre: string }[] = [
  { valor: "ticket", label: "Facturación", nombre: "Ticket promedio (US$)" },
  { valor: "margen", label: "Margen", nombre: "Margen promedio por unidad (US$)" },
  { valor: "margenPct", label: "Margen %", nombre: "Margen promedio (% del precio sin IVA)" },
];

/** Los nombres de cada cuadrante, según qué mide el eje X. Arriba = vende
 *  más que el promedio; derecha = deja más que el promedio. */
const CUADRANTES: Record<EjeX, [string, string, string, string]> = {
  ticket: ["Vende, ticket bajo", "Vende, ticket alto", "Ticket bajo, vende poco", "Ticket alto, vende poco"],
  margen: ["Vende, deja poco", "Vende y deja", "Ni vende ni deja", "Deja, vende poco"],
  margenPct: ["Vende, deja poco", "Vende y deja", "Ni vende ni deja", "Deja, vende poco"],
};

/**
 * Dispersión con burbujas de la gama propia: eje Y = unidades facturadas,
 * eje X = ticket, margen por unidad o margen % (a precio de acción), tamaño
 * = facturación de esa versión (unidades × ticket), color = marca.
 *
 * Los CUATRO CUADRANTES los cortan los promedios de lo que se está viendo
 * (pedido de Fernando, 18/09/2026: "dividirse en 4 cuadrantes según los
 * valores filtrados"): el eje X en el promedio PONDERADO por unidades —el
 * ticket o margen medio real de lo facturado, no el promedio de las
 * versiones— y el eje Y en el promedio simple de unidades por burbuja.
 * Cambiar el filtro mueve las líneas.
 *
 * Color: la paleta categórica de la app (8 tonos validados). Con más de
 * ocho marcas las que menos venden se juntan en «Otras», en gris: un
 * noveno tono inventado es lo que la guía de dataviz prohíbe. La etiqueta
 * de cada burbuja (el nombre de la versión) es la identidad de todos
 * modos; el color ayuda a seguir la marca.
 */
export function BurbujasRentabilidadChart({
  versiones,
  modelos,
  altura = 520,
}: {
  versiones: PuntoRentabilidad[];
  modelos: PuntoRentabilidad[];
  altura?: number;
}) {
  const theme = useChartTheme();
  const [ejeX, setEjeX] = useState<EjeX>("ticket");
  const [nivel, setNivel] = useState<Nivel>("version");
  const puntos = nivel === "version" ? versiones : modelos;

  const controles = (
    <div className="flex flex-wrap items-end gap-x-6 gap-y-2 pb-3">
      <Grupo label="Eje X">
        {EJES.map((e) => (
          <Boton key={e.valor} activo={ejeX === e.valor} onClick={() => setEjeX(e.valor)}>{e.label}</Boton>
        ))}
      </Grupo>
      <Grupo label="Burbujas">
        <Boton activo={nivel === "version"} onClick={() => setNivel("version")}>Versiones</Boton>
        <Boton activo={nivel === "modelo"} onClick={() => setNivel("modelo")}>Modelos</Boton>
      </Grupo>
    </div>
  );

  if (!puntos.length) {
    return (
      <>
        {controles}
        <p className="py-16 text-center text-sm text-muted-foreground">
          Ninguna versión con venta y precio en el filtro.
        </p>
      </>
    );
  }

  const xDe = (p: PuntoRentabilidad): number | null =>
    ejeX === "ticket" ? p.ticket : ejeX === "margen" ? p.margenUnidad : p.margenPct;
  const conX = puntos.filter((p) => xDe(p) !== null);

  // Promedios del filtro: X ponderado por unidades, Y simple por burbuja.
  const totalU = conX.reduce((s, p) => s + p.unidades, 0);
  const xMedio =
    ejeX === "ticket"
      ? conX.reduce((s, p) => s + p.facturacion, 0) / Math.max(totalU, 1)
      : ejeX === "margen"
        ? conX.reduce((s, p) => s + p.margenTotal, 0) / Math.max(totalU, 1)
        : (() => {
            // Mismo cociente que la planilla: margen ÷ precio sin IVA.
            const f = conX.reduce((s, p) => s + p.facturacionSinIva, 0);
            return f > 0 ? conX.reduce((s, p) => s + p.margenTotal, 0) / f : 0;
          })();
  const yMedio = totalU / Math.max(conX.length, 1);

  // Un color FIJO por marca (skill dataviz: el color sigue a la entidad,
  // nunca a su posición): con el orden por volumen, filtrar un segmento
  // cambiaba el color de las marcas que quedaban. Las ocho de más venta del
  // grupo tienen su tono; el resto va junto en «Otras», en gris.
  const presentes = new Set(conX.map((p) => p.marca));
  const conColor = ORDEN_COLOR.filter((m) => presentes.has(m));
  const otras = [...presentes].filter((m) => !ORDEN_COLOR.includes(m)).sort();
  const nombreOtras = otras.length ? `Otras (${otras.join(", ")})` : null;
  const serieDe = (marca: string) => (conColor.includes(marca) ? marca : (nombreOtras as string));
  const colorDe = (serie: string) => {
    const i = ORDEN_COLOR.indexOf(serie);
    return i >= 0 ? theme.series[i % theme.series.length] : theme.text;
  };

  const maxF = Math.max(...conX.map((p) => p.facturacion), 1);
  const MIN_PX = 5;
  const MAX_PX = 28;
  const radio = (f: number) => MIN_PX + (MAX_PX - MIN_PX) * Math.sqrt(Math.max(f, 0) / maxF);

  const fmtX = (v: number) => (ejeX === "margenPct" ? formatPct(v) : formatUnidades(Math.round(v)));
  const series = [...conColor, ...(nombreOtras ? [nombreOtras] : [])].map((nombre) => ({
    name: nombre,
    type: "scatter" as const,
    // El color va TAMBIÉN en la serie: la leyenda lo toma de acá. Puesto
    // solo en cada burbuja, la leyenda mostraba la paleta por defecto de
    // ECharts y no coincidía con las burbujas (30/09/2026).
    color: colorDe(nombre),
    data: conX
      .filter((p) => serieDe(p.marca) === nombre)
      .map((p) => ({
        value: [xDe(p) as number, p.unidades, p.facturacion],
        name: p.nombre,
        punto: p,
        itemStyle: {
          color: colorDe(nombre),
          opacity: 0.85,
          // Anillo del color de la superficie: separa burbujas que se tocan
          // sin sumar tinta que no es dato (skill dataviz).
          borderColor: theme.card,
          borderWidth: 2,
        },
      })),
    symbolSize: (val: number[]) => radio(val[2]) * 2,
    // Etiqueta de datos (Fernando): el nombre al lado de cada burbuja; las
    // que se pisan se esconden solas y quedan en el tooltip.
    label: {
      show: true,
      position: "right" as const,
      distance: 4,
      color: theme.etiqueta,
      fontSize: 10,
      formatter: (p: { name: string }) => p.name,
    },
    labelLayout: { hideOverlap: true },
    emphasis: { focus: "series" as const, itemStyle: { opacity: 1 } },
  }));

  const xMin = Math.min(0, ...conX.map((p) => xDe(p) as number));
  const [q1, q2, q3, q4] = CUADRANTES[ejeX];
  const etiquetaLinea = {
    show: true,
    position: "end" as const,
    color: theme.text,
    fontSize: 10,
    fontFamily: FUENTE_MONO_EJES,
  };
  // Las líneas y los rótulos de cuadrante van en una serie propia, vacía:
  // si vivieran en la serie de una marca, apagar esa marca en la leyenda
  // se los llevaría.
  const guias = {
    name: "__guias",
    type: "scatter" as const,
    data: [] as never[],
    silent: true,
    markLine: {
      silent: true,
      symbol: "none" as const,
      lineStyle: { color: theme.axis, type: "solid" as const, width: 1, opacity: 0.7 },
      data: [
        { xAxis: xMedio, label: { ...etiquetaLinea, formatter: `prom. ${fmtX(xMedio)}` } },
        // Adentro del área: al final de la línea, contra el borde derecho,
        // la etiqueta quedaba cortada.
        { yAxis: yMedio, label: { ...etiquetaLinea, position: "insideEndTop" as const, formatter: `prom. ${formatUnidades(Math.round(yMedio))} u.` } },
        ...(xMin < 0
          ? [{ xAxis: 0, lineStyle: { type: "dashed" as const, opacity: 0.5 }, label: { ...etiquetaLinea, formatter: "0" } }]
          : []),
      ],
    },
    markArea: {
      silent: true,
      itemStyle: { color: "transparent" },
      label: { color: theme.text, fontSize: 10, opacity: 0.8 },
      data: [
        [{ name: q1, xAxis: "min", yAxis: yMedio, label: { position: "insideTopLeft" as const } }, { xAxis: xMedio, yAxis: "max" }],
        [{ name: q2, xAxis: xMedio, yAxis: yMedio, label: { position: "insideTopRight" as const } }, { xAxis: "max", yAxis: "max" }],
        [{ name: q3, xAxis: "min", yAxis: "min", label: { position: "insideBottomLeft" as const } }, { xAxis: xMedio, yAxis: yMedio }],
        [{ name: q4, xAxis: xMedio, yAxis: "min", label: { position: "insideBottomRight" as const } }, { xAxis: "max", yAxis: yMedio }],
      ],
    },
  };

  const option = {
    animationDuration: 600,
    animationEasing: "cubicOut" as const,
    grid: { left: 64, right: 32, top: 56, bottom: 48 },
    legend: {
      top: 0,
      type: "scroll" as const,
      textStyle: { color: theme.text, fontSize: 11 },
      data: series.map((s) => s.name),
    },
    tooltip: {
      ...TOOLTIP_BASE,
      trigger: "item" as const,
      formatter: (p: { seriesName: string; data: { punto: PuntoRentabilidad } }) => {
        const d = p.data.punto;
        return (
          `<b>${d.marca}</b> · ${d.nombre}` +
          (d.aproximado && d.detalle ? `<br/><span style="opacity:.7">Cars: ${d.detalle}</span>` : d.detalle ? `<br/><span style="opacity:.7">${d.detalle}</span>` : "") +
          `<br/><b>${formatUnidades(d.unidades)} u.</b> facturadas` +
          `<br/>Ticket US$ ${formatUnidades(Math.round(d.ticket))} · margen US$ ${formatUnidades(Math.round(d.margenUnidad))}` +
          (d.margenPct !== null ? ` (${formatPct(d.margenPct)})` : "") +
          `<br/>Facturación US$ ${formatUnidades(Math.round(d.facturacion))} · margen total US$ ${formatUnidades(Math.round(d.margenTotal))}`
        );
      },
    },
    xAxis: {
      type: "value" as const,
      name: EJES.find((e) => e.valor === ejeX)?.nombre,
      nameLocation: "middle" as const,
      nameGap: 30,
      nameTextStyle: { color: theme.text, fontSize: 11 },
      min: xMin < 0 ? undefined : 0,
      axisLabel: { color: theme.text, fontSize: 11, fontFamily: FUENTE_MONO_EJES, formatter: fmtX },
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { show: false },
    },
    yAxis: {
      type: "value" as const,
      name: "Unidades facturadas",
      nameTextStyle: { color: theme.text, fontSize: 11, align: "left" as const },
      min: 0,
      axisLabel: { color: theme.text, fontSize: 11, fontFamily: FUENTE_MONO_EJES, formatter: (v: number) => formatUnidades(v) },
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: theme.grid, width: 1 } },
    },
    series: [...series, guias],
  };

  return (
    <>
      {controles}
      <EchartsAuto option={option} notMerge style={{ height: altura, width: "100%" }} />
      <p className="pt-2 text-[11px] text-muted-foreground">
        Tamaño de la burbuja = facturación de esa {nivel === "version" ? "versión" : "familia"} (unidades × ticket).
        Las líneas cortan en el promedio de lo filtrado: el eje X ponderado por unidades, el eje Y por burbuja.
        {nombreOtras && <> Las marcas con menos venta van juntas en «Otras».</>}
      </p>
    </>
  );
}

function Grupo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      <div className="flex flex-wrap gap-1">{children}</div>
    </div>
  );
}

function Boton({ activo, onClick, children }: { activo: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      className={cn(
        "h-8 rounded-md px-3 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
        activo ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
      )}
    >
      {children}
    </button>
  );
}
