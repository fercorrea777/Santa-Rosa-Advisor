"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { EchartsAuto } from "@/components/charts/echarts-auto";
import { TOOLTIP_BASE, useChartTheme } from "@/lib/chart-theme";
import { formatUnidades } from "@/lib/format";
import { SIN_CLASIFICAR } from "@/lib/informes/segmento-version";
import { cn } from "@/lib/utils";

export interface BurbujaPrecio {
  marca: string;
  /** Familia ("X70"). Va al tooltip. */
  familia?: string;
  /** Nombre de la burbuja. `modelo` es el nombre viejo del mismo campo, que
   *  gama-propia sigue usando: ahí la burbuja es un modelo, no una versión. */
  version?: string;
  modelo?: string;
  /** SUV, Pick Up, Automóvil... o SIN_CLASIFICAR. Define la columna cuando
   *  `columna="segmento"`. */
  segmento?: string;
  /** Unidades del período. Define el TAMAÑO de la burbuja. */
  unidades: number;
  precio: number;
  moneda: string;
}

/** Qué agrupa el eje X. `segmento` es el rediseño (bubble-chart);
 *  `marca` es la vista anterior, que gama-propia conserva porque ahí no hay
 *  segmento: sus burbujas son modelos cruzados a mano, no versiones. */
export type ColumnaBurbujas = "segmento" | "marca";

/** Params de URL propios de este gráfico. Se escriben en la URL y no en
 *  estado local por la misma razón que FiltroPeriodo: compartible y
 *  sobrevive al refresh. Nombres distintos de `marca`/`segmento` a
 *  propósito: esos son los filtros de la página (una sola marca, para las
 *  consultas CADAM); estos son multiselección y solo tocan este gráfico. */
const PARAM_MARCAS = "bmarcas";
const PARAM_SEGMENTOS = "bsegmentos";

/**
 * Posicionamiento de la gama propia: eje X = SEGMENTO, eje Y = precio de
 * lista, área = unidades, color = marca.
 *
 * Rediseño 2026-09-03 a pedido de Croman: antes la columna era la marca, así
 * que un SUV de 40k y una pick-up de 40k de la misma marca caían juntos y no
 * se leía contra qué compite cada uno. Con el segmento en X, lo que comparte
 * columna compite entre sí; la marca pasa al color.
 *
 * Reglas que se mantienen del rediseño anterior (skill de dataviz):
 *  - jitter DETERMINISTA dentro de la columna (hash del nombre, no random:
 *    rompería la hidratación SSR);
 *  - anillo de 2px del color de la SUPERFICIE entre burbujas, no borde de
 *    tinta;
 *  - etiquetas SELECTIVAS (la más vendida de cada marca + extremos de
 *    precio), el resto en el tooltip;
 *  - el color sigue a la ENTIDAD, no a su rango: se asigna una vez sobre el
 *    universo completo, y filtrar marcas no repinta a las que quedan.
 *
 * Reglas nuevas:
 *  - los ejes se recalculan con cada filtro, con exactamente 10% de aire
 *    arriba y abajo del dato; los bordes no llevan etiqueta, así los
 *    números que se ven son los ticks redondos de adentro;
 *  - las columnas tienen ancho ∝ √(versiones): la densa se ensancha, la
 *    de dos burbujas no desperdicia un séptimo del gráfico;
 *  - la paleta tiene 8 tonos: las 8 marcas de mayor volumen los llevan y las
 *    demás van en gris neutro. Reusar un tono para la 9ª (lo que pasaba
 *    antes: ZEEKR azul igual que GREAT WALL) es peor que un gris, porque
 *    dos marcas con el mismo color se leen como una sola.
 */
export function BurbujasPrecioChart({
  datos,
  altura = 520,
  columna = "segmento",
}: {
  datos: BurbujaPrecio[];
  altura?: number;
  columna?: ColumnaBurbujas;
}) {
  const theme = useChartTheme();
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const porSegmento = columna === "segmento";
  /** La columna de cada burbuja: su segmento, o su marca en la vista vieja. */
  const colDe = (d: BurbujaPrecio) =>
    porSegmento ? (d.segmento ?? SIN_CLASIFICAR) : d.marca;

  // --- universo (independiente del filtro): define orden y color -----------
  const volMarca = new Map<string, number>();
  const volSeg = new Map<string, number>();
  for (const d of datos) {
    volMarca.set(d.marca, (volMarca.get(d.marca) ?? 0) + d.unidades);
    volSeg.set(colDe(d), (volSeg.get(colDe(d)) ?? 0) + d.unidades);
  }
  const marcasTodas = [...volMarca.entries()].sort((a, b) => b[1] - a[1]).map(([m]) => m);
  const segmentosTodos = ordenarSegmentos([...volSeg.entries()]);
  const colorDe = (marca: string) => {
    const i = marcasTodas.indexOf(marca);
    return i >= 0 && i < theme.series.length ? theme.series[i] : theme.axis;
  };

  // --- selección, leída de la URL. Sin param = todas. ------------------------
  const leer = (param: string, todos: string[]) => {
    const crudo = sp.get(param);
    if (!crudo) return todos;
    const puestos = crudo.split(",").filter((v) => todos.includes(v));
    return puestos.length ? puestos : todos;
  };
  const marcasSel = leer(PARAM_MARCAS, marcasTodas);
  // En la vista por marca la columna YA es la marca: un segundo filtro sería
  // el mismo control dos veces.
  const segmentosSel = porSegmento ? leer(PARAM_SEGMENTOS, segmentosTodos) : segmentosTodos;

  const escribir = React.useCallback(
    (param: string, valores: string[], todos: string[]) => {
      const p = new URLSearchParams(sp.toString());
      // Todas puestas = sin param: la URL limpia es el estado por defecto.
      if (valores.length === todos.length) p.delete(param);
      else p.set(param, valores.join(","));
      router.replace(`${pathname}?${p.toString()}`, { scroll: false });
    },
    [pathname, router, sp]
  );
  const alternar = (param: string, actual: string[], todos: string[], v: string) => {
    const siguiente = actual.includes(v) ? actual.filter((x) => x !== v) : [...actual, v];
    // Nunca cero: un gráfico vacío no es un estado que alguien pida.
    if (!siguiente.length) return;
    escribir(param, todos.filter((x) => siguiente.includes(x)), todos);
  };

  if (!datos.length) {
    return (
      <p className="py-16 text-center text-sm text-muted-foreground">
        Ningún modelo propio con ventas tiene precio en la lista cargada.
      </p>
    );
  }

  // --- datos filtrados ---------------------------------------------------------
  const visibles = datos.filter(
    (d) => marcasSel.includes(d.marca) && segmentosSel.includes(colDe(d))
  );

  const chips = (
    <div className="flex flex-col gap-2">
      <FilaChips label="Marcas en este gráfico">
        {marcasTodas.map((m) => (
          <Chip
            key={m}
            puesto={marcasSel.includes(m)}
            onClick={() => alternar(PARAM_MARCAS, marcasSel, marcasTodas, m)}
            swatch={colorDe(m)}
          >
            {m}
          </Chip>
        ))}
      </FilaChips>
      {porSegmento && (
        <FilaChips label="Segmentos en este gráfico">
          {segmentosTodos.map((s) => (
            <Chip
              key={s}
              puesto={segmentosSel.includes(s)}
              onClick={() => alternar(PARAM_SEGMENTOS, segmentosSel, segmentosTodos, s)}
            >
              {s}
            </Chip>
          ))}
        </FilaChips>
      )}
      <p className="text-xs text-muted-foreground">
        {visibles.length} versiones ·{" "}
        {formatUnidades(visibles.reduce((s, d) => s + d.unidades, 0))} u. facturadas en el
        período{marcasTodas.length > theme.series.length
          ? ` · en gris, las marcas fuera de las ${theme.series.length} de mayor volumen`
          : ""}
      </p>
    </div>
  );

  if (!visibles.length) {
    return (
      <div className="flex flex-col gap-3">
        {chips}
        <p className="py-16 text-center text-sm text-muted-foreground">
          Ninguna versión cumple las dos selecciones a la vez. Prendé otra marca u
          otro segmento.
        </p>
      </div>
    );
  }

  // --- eje X: los segmentos que quedaron, por volumen --------------------------
  const volSegVis = new Map<string, number>();
  for (const d of visibles) volSegVis.set(colDe(d), (volSegVis.get(colDe(d)) ?? 0) + d.unidades);
  const segmentos = ordenarSegmentos([...volSegVis.entries()]);

  // Ancho de columna ∝ √(versiones que caen ahí). SUV junta 65 versiones y
  // Furgón 2: con columnas iguales la primera es una mancha y la segunda un
  // desierto. El eje X es numérico y cada columna ocupa [x, x + ancho).
  const nPorCol = new Map<string, number>();
  for (const d of visibles) nPorCol.set(colDe(d), (nPorCol.get(colDe(d)) ?? 0) + 1);
  const maxN = Math.max(1, ...nPorCol.values());
  const ancho = new Map(
    segmentos.map((s) => [s, 1 + 2 * Math.sqrt((nPorCol.get(s) ?? 1) / maxN)] as const)
  );
  const centro = new Map<string, number>();
  let acumulado = 0;
  for (const s of segmentos) {
    const w = ancho.get(s) ?? 1;
    centro.set(s, acumulado + w / 2);
    acumulado += w;
  }
  const anchoTotal = acumulado;
  const segmentoEn = (x: number) =>
    segmentos.find((s) => Math.abs((centro.get(s) ?? -1) - x) < 1e-6);

  // Jitter determinista en [-0.42, 0.42] del ancho de SU columna.
  const jitter = (nombre: string) => {
    let h = 0;
    for (let i = 0; i < nombre.length; i++) h = (h * 31 + nombre.charCodeAt(i)) | 0;
    return (((h >>> 0) % 1000) / 1000 - 0.5) * 0.84;
  };

  // Área ∝ unidades. El tope se recalcula sobre lo visible: al filtrar a una
  // marca chica, sus burbujas vuelven a tener tamaño legible.
  const maxU = Math.max(1, ...visibles.map((d) => d.unidades));
  const MIN_R = 4;
  const MAX_R = 16;
  const radio = (u: number) => MIN_R + (MAX_R - MIN_R) * Math.sqrt(u / maxU);

  // --- eje Y: 10% de aire arriba y abajo, al tick redondo ------------------------
  const precios = visibles.map((d) => d.precio);
  const minP = Math.min(...precios);
  const maxP = Math.max(...precios);
  const rango = maxP - minP;
  // Exactamente 10% del rango de aire a cada lado. Los bordes del eje no
  // llevan etiqueta (serían 5,9k y 79,1k): lo que se lee son los ticks
  // redondos de adentro, que ECharts elige solo.
  const aire = (rango > 0 ? rango : maxP) * 0.1;
  const pisoY = Math.max(0, minP - aire);
  const techoY = maxP + aire;

  // --- etiquetas selectivas: la más vendida de cada marca + extremos ----------------
  const etiquetadas = new Set<string>();
  for (const m of marcasTodas) {
    const top = visibles
      .filter((d) => d.marca === m)
      .sort((a, b) => b.unidades - a.unidades)[0];
    if (top && top.unidades > 0) etiquetadas.add(clave(top));
  }
  etiquetadas.add(clave([...visibles].sort((a, b) => b.precio - a.precio)[0]));
  etiquetadas.add(clave([...visibles].sort((a, b) => a.precio - b.precio)[0]));

  const recortar = (n: string, max = 18) =>
    n.length <= max ? n : `${n.slice(0, max - 1).trimEnd()}…`;

  const puntos = visibles.map((d) => ({
    value: [
      (centro.get(colDe(d)) ?? 0) + jitter(nombreDe(d)) * (ancho.get(colDe(d)) ?? 1),
      d.precio,
      d.unidades,
    ],
    name: nombreDe(d),
    marca: d.marca,
    familia: d.familia,
    segmento: porSegmento ? colDe(d) : undefined,
    moneda: d.moneda,
    itemStyle: {
      color: colorDe(d.marca),
      opacity: 0.82,
      borderColor: theme.card,
      borderWidth: 2,
    },
    label: etiquetadas.has(clave(d))
      ? {
          show: true,
          position: "right" as const,
          distance: 4,
          color: theme.text,
          fontSize: 10,
          // Halo del color de la superficie: en la columna SUV la etiqueta
          // cae sobre otras burbujas y sin esto se leía "50 LUXURY".
          backgroundColor: theme.card,
          padding: [1, 3],
          borderRadius: 2,
          formatter: () => recortar(nombreDe(d)),
        }
      : { show: false },
  }));

  const unidadesTotal = visibles.reduce((s, d) => s + d.unidades, 0);
  const ponderado =
    visibles.reduce((s, d) => s + d.precio * d.unidades, 0) / (unidadesTotal || 1);

  const fmtK = (v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v));

  const option = {
    animationDuration: 500,
    animationEasing: "cubicOut" as const,
    // top: 28 deja lugar al nombre del eje Y, que containLabel no cuenta;
    // bottom: 44 a las etiquetas X de dos renglones, que containLabel mide
    // como si fueran de uno y las recortaba por la mitad.
    grid: { left: 8, right: 96, top: 28, bottom: 44, containLabel: true },
    tooltip: {
      ...TOOLTIP_BASE,
      trigger: "item",
      formatter: (p: {
        name: string;
        value: number[];
        data: { marca: string; familia?: string; segmento?: string; moneda: string };
      }) => {
        const contexto = [
          p.data.segmento,
          p.data.familia && p.data.familia !== p.name ? `familia ${p.data.familia}` : null,
        ]
          .filter(Boolean)
          .join(" · ");
        return (
          `<b>${p.data.marca}</b> · ${p.name}<br/>` +
          (contexto ? `${contexto}<br/>` : "") +
          `${p.data.moneda} ${p.value[1].toLocaleString("es-PY")}<br/>` +
          `${formatUnidades(p.value[2])} u. en el período`
        );
      },
    },
    xAxis: {
      type: "value" as const,
      min: 0,
      max: anchoTotal,
      axisLabel: {
        // Una etiqueta por columna, en su centro. Con `interval` los ticks
        // caían en medios enteros y NINGUNA etiqueta se dibujaba: es el bug
        // que dejaba el eje X mudo en la versión anterior.
        customValues: segmentos.map((s) => centro.get(s) ?? 0),
        // Dos renglones: el segmento y cuánto se vendió ahí. Es la etiqueta
        // de dato del eje X — la columna dice su volumen sin ir al tooltip.
        formatter: (v: number) => {
          const s = segmentoEn(v);
          return s ? `{seg|${s}}\n{u|${formatUnidades(volSegVis.get(s) ?? 0)} u.}` : "";
        },
        rich: {
          seg: { color: theme.primary, fontSize: 11, fontWeight: "bold" as const, lineHeight: 16 },
          u: { color: theme.text, fontSize: 10, lineHeight: 14 },
        },
      },
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { show: false },
    },
    yAxis: {
      type: "value" as const,
      min: pisoY,
      max: techoY,
      // Sin esto, sobre 70k de rango ECharts elegía ticks cada 20k: tres
      // líneas para leer precios que se deciden de a 5k.
      splitNumber: 7,
      name: `Precio de lista (${visibles[0].moneda})`,
      nameTextStyle: { color: theme.text, fontSize: 11, align: "left" as const },
      axisLabel: {
        color: theme.text,
        fontSize: 11,
        formatter: fmtK,
        showMinLabel: false,
        showMaxLabel: false,
      },
      splitLine: { lineStyle: { color: theme.grid, width: 1 } },
    },
    series: [
      {
        type: "scatter" as const,
        symbolSize: (val: number[]) => radio(val[2]) * 2,
        data: puntos,
        labelLayout: { hideOverlap: true },
        emphasis: {
          focus: "self" as const,
          itemStyle: { opacity: 1, shadowBlur: 8, shadowColor: "oklch(0.2 0.05 260 / 30%)" },
        },
        markLine: {
          silent: true,
          symbol: "none" as const,
          lineStyle: { color: theme.text, type: "dashed" as const, width: 1, opacity: 0.6 },
          label: {
            show: true,
            position: "insideEndTop" as const,
            formatter: `Ponderado ${fmtK(Math.round(ponderado))}`,
            color: theme.text,
            fontSize: 10,
          },
          data: [{ yAxis: ponderado }],
        },
      },
    ],
  };

  return (
    <div className="flex flex-col gap-3">
      {chips}
      {/* notMerge: al filtrar, las burbujas que salen tienen que DESAPARECER;
          con merge ECharts las deja dibujadas con los datos viejos. */}
      <EchartsAuto option={option} notMerge style={{ height: altura, width: "100%" }} />
    </div>
  );
}

/** Nombre de la burbuja: `version` (bubble-chart) o `modelo` (gama-propia). */
function nombreDe(d: { version?: string; modelo?: string }) {
  return d.version ?? d.modelo ?? "";
}

function clave(d: { marca: string; version?: string; modelo?: string }) {
  return `${d.marca}|${nombreDe(d)}`;
}

/** Por volumen, y "Sin clasificar" siempre al final: no es un segmento, es
 *  lo que no se pudo cruzar, y no tiene que competir por el primer lugar. */
function ordenarSegmentos(entradas: [string, number][]): string[] {
  return entradas
    .sort((a, b) => {
      if (a[0] === SIN_CLASIFICAR) return 1;
      if (b[0] === SIN_CLASIFICAR) return -1;
      return b[1] - a[1];
    })
    .map(([s]) => s);
}

function FilaChips({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <div className="flex flex-wrap items-center gap-1">{children}</div>
    </div>
  );
}

/** Mismo chip que "Años en el gráfico" en FiltroPeriodo. Con `swatch`,
 *  lleva el color de la serie: la fila de marcas es también la leyenda. */
function Chip({
  puesto,
  onClick,
  swatch,
  children,
}: {
  puesto: boolean;
  onClick: () => void;
  swatch?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={puesto}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-colors pointer-coarse:min-h-9 pointer-coarse:px-3",
        puesto
          ? "bg-primary text-primary-foreground"
          : "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground"
      )}
    >
      {swatch && (
        <span
          aria-hidden="true"
          className={cn("inline-block size-2.5 rounded-full", !puesto && "opacity-40")}
          style={{ backgroundColor: swatch }}
        />
      )}
      {children}
    </button>
  );
}
