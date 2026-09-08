"use client";

import * as React from "react";
import { EchartsAuto } from "@/components/charts/echarts-auto";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { TOOLTIP_BASE, useChartTheme } from "@/lib/chart-theme";
import { formatUnidades } from "@/lib/format";
import type { ModeloBatalla } from "@/lib/informes/batalla";
import { cn } from "@/lib/utils";

/**
 * El bubble chart del equipo de producto, tal cual lo arma en su Excel
 * (JETOUR_PY_BBCH_*.xlsx), un modelo nuestro por pestaña:
 *
 *  - una burbuja por VERSIÓN rival, en la columna de su marca (el orden de
 *    columnas es el de la planilla), a la altura de su precio de lista, con
 *    el tamaño según el volumen que eligió producto (importaciones o
 *    matriculaciones del año) y su nombre al lado, como en el Excel;
 *  - el eje de precio con el rango que dejó fijado la planilla (5.000 a
 *    38.000 para la X50, 14.000 a 30.000 para la X70…);
 *  - el color de cada marca, el mismo de la planilla (Jetour en rojo);
 *  - al pie de cada columna, el total de la marca ("JETOUR: 110"), que en
 *    el Excel es la fila de burbujitas de abajo;
 *  - debajo, el ranking de versiones por precio con su volumen (el gráfico
 *    de barras de la hoja X50) y la tabla con las medidas.
 *
 * Decisión (07/09/2026): se dibuja lo que dice el Excel; nada se cruza
 * con CADAM ni Datacar. El dueño de la lista de rivales es producto.
 */
export function BatallaModeloChart({
  modelos,
  propias,
}: {
  modelos: ModeloBatalla[];
  /** Marcas del grupo (nombres CADAM), para resaltar las nuestras. */
  propias: string[];
}) {
  // Dos niveles: la marca nuestra (un Excel por marca) y, adentro, sus
  // modelos. Las marcas en el orden en que llegan (Jetour primero).
  const marcasPropias = [...new Set(modelos.map((x) => x.marca_propia))];
  const [marcaSel, setMarcaSel] = React.useState(marcasPropias[0] ?? "");
  const [hojaSel, setHojaSel] = React.useState<string | null>(null);
  // Qué marcas se ven en cada modelo (por hoja, así cambiar de pestaña no
  // pierde lo elegido). Sin entrada = todas.
  const [seleccion, setSeleccion] = React.useState<Record<string, string[]>>({});
  const deLaMarca = modelos.filter((x) => x.marca_propia === (marcasPropias.includes(marcaSel) ? marcaSel : marcasPropias[0]));
  const m = deLaMarca.find((x) => `${x.archivo}|${x.hoja}` === hojaSel) ?? deLaMarca[0];
  if (!m) return null;
  const claveDe = (x: ModeloBatalla) => `${x.archivo}|${x.hoja}`;
  return (
    <div className="flex flex-col gap-4">
      {marcasPropias.length > 1 && (
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Marca propia">
          {marcasPropias.map((marca) => {
            const activa = marca === m.marca_propia;
            const n = modelos.filter((x) => x.marca_propia === marca).length;
            return (
              <button
                key={marca}
                type="button"
                role="tab"
                aria-selected={activa}
                onClick={() => {
                  setMarcaSel(marca);
                  setHojaSel(null);
                }}
                className={cn(
                  "rounded-md border px-3 py-1.5 text-sm font-medium pointer-coarse:min-h-11",
                  activa
                    ? "border-primary bg-primary text-primary-foreground"
                    : "bg-background text-muted-foreground hover:text-foreground"
                )}
              >
                {marca}
                <span className={cn("ml-1.5 text-xs font-normal", activa ? "opacity-80" : "text-muted-foreground")}>
                  {n}
                </span>
              </button>
            );
          })}
        </div>
      )}
      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Modelo">
        {deLaMarca.map((x) => {
          const activa = claveDe(x) === claveDe(m);
          return (
            <button
              key={claveDe(x)}
              type="button"
              role="tab"
              aria-selected={activa}
              onClick={() => setHojaSel(claveDe(x))}
              className={cn(
                "rounded-md border px-3 py-1.5 text-sm pointer-coarse:min-h-11",
                activa
                  ? "border-primary bg-primary/10 text-foreground"
                  : "bg-background text-muted-foreground hover:text-foreground"
              )}
            >
              {x.modelo}
            </button>
          );
        })}
      </div>
      <Batalla
        modelo={m}
        propias={propias}
        visibles={seleccion[m.hoja] ?? m.marcas.map((x) => x.marca)}
        onVisibles={(marcas) => setSeleccion((sel) => ({ ...sel, [m.hoja]: marcas }))}
      />
    </div>
  );
}

const esPropia = (marca: string, propias: string[]) => {
  const n = marca.toUpperCase();
  return propias.includes(n) || (n === "GWM" && propias.includes("GREAT WALL"));
};

function Batalla({
  modelo: m,
  propias,
  visibles,
  onVisibles,
}: {
  modelo: ModeloBatalla;
  propias: string[];
  /** Marcas que se dibujan. Las demás quedan fuera del gráfico, del
   *  ranking y de la tabla; el tamaño de las burbujas no cambia (la escala
   *  es del modelo entero), así se puede comparar antes y después. */
  visibles: string[];
  onVisibles: (marcas: string[]) => void;
}) {
  const theme = useChartTheme();
  const todasLasMarcas = m.marcas.map((x) => x.marca);
  const marcas = todasLasMarcas.filter((x) => visibles.includes(x));
  const indice = new Map(marcas.map((x, k) => [x, k]));
  const versiones = m.versiones.filter((v) => visibles.includes(v.marca));
  const nuestras = todasLasMarcas.filter((x) => esPropia(x, propias));
  const alternar = (marca: string) => {
    const siguiente = visibles.includes(marca)
      ? visibles.filter((x) => x !== marca)
      : [...visibles, marca];
    // Nunca cero: un gráfico vacío no es un estado que alguien pida.
    if (siguiente.length) onVisibles(todasLasMarcas.filter((x) => siguiente.includes(x)));
  };
  const volumen = (v: { importaciones: number; matriculaciones: number }) =>
    m.tamano === "matriculaciones" ? v.matriculaciones : v.importaciones;
  const etiquetaVolumen = m.tamano === "matriculaciones" ? "matriculaciones" : "importaciones";
  const colorDe = (marca: string) => {
    const c = m.marcas.find((x) => x.marca === marca)?.color;
    if (c) return `#${c}`;
    // Sin color en la planilla: uno de la paleta, estable por posición en la
    // planilla (no en el filtro: sacar una marca no repinta a las demás).
    return theme.series[Math.max(0, todasLasMarcas.indexOf(marca)) % theme.series.length];
  };
  const totalPorMarca = new Map<string, number>();
  for (const v of m.versiones) {
    totalPorMarca.set(v.marca, (totalPorMarca.get(v.marca) ?? 0) + volumen(v));
  }
  const maxVol = Math.max(1, ...m.versiones.map(volumen));
  // El área de la burbuja sigue al volumen (de ahí el sqrt), como en Excel,
  // que escala por área. Piso de 6px para que una versión sin volumen se vea.
  const radio = (vol: number) => (vol > 0 ? 8 + 44 * Math.sqrt(vol / maxVol) : 6);
  // Varias versiones de una marca comparten columna: se corren un poco a
  // los costados, en orden fijo, para que no se tapen del todo.
  const desplazamientos = [0, -0.22, 0.22, -0.11, 0.11, -0.3, 0.3, -0.05, 0.05];
  const vistas = new Map<string, number>();
  const puntos = versiones.map((v) => {
    const k = vistas.get(v.marca) ?? 0;
    vistas.set(v.marca, k + 1);
    const vol = volumen(v);
    return {
      value: [(indice.get(v.marca) ?? 0) + desplazamientos[k % desplazamientos.length], v.precio, vol],
      name: v.version,
      marca: v.marca,
      medidas: v.medidas,
      matriculaciones: v.matriculaciones,
      importaciones: v.importaciones,
      symbolSize: radio(vol) * 2,
      itemStyle: {
        color: colorDe(v.marca),
        opacity: esPropia(v.marca, propias) ? 0.95 : 0.7,
        borderColor: theme.card,
        borderWidth: 2,
      },
    };
  });
  const precios = m.versiones.map((v) => v.precio);
  const yMin = m.eje_precio.min ?? Math.floor((Math.min(...precios) * 0.9) / 1000) * 1000;
  const yMax = m.eje_precio.max ?? Math.ceil((Math.max(...precios) * 1.1) / 1000) * 1000;

  const option = {
    animationDuration: 500,
    grid: { left: 64, right: 120, top: 20, bottom: 56 },
    tooltip: {
      ...TOOLTIP_BASE,
      trigger: "item",
      formatter: (p: {
        name: string;
        data: { marca: string; medidas: string; matriculaciones: number; importaciones: number; value: number[] };
      }) =>
        `<b>${p.data.marca}</b> · ${p.name}<br/>` +
        `US$ ${formatUnidades(p.data.value[1])}` +
        (p.data.medidas ? ` · ${p.data.medidas}` : "") +
        `<br/>${formatUnidades(p.data.importaciones)} import. · ${formatUnidades(p.data.matriculaciones)} matric.`,
    },
    xAxis: {
      type: "value" as const,
      min: -0.6,
      max: marcas.length - 0.4,
      interval: 1,
      axisLabel: {
        color: theme.text,
        fontSize: 10,
        fontWeight: "bold" as const,
        lineHeight: 14,
        interval: 0,
        customValues: marcas.map((_, k) => k),
        // Dos renglones: la marca y, abajo, su total — la fila de burbujitas
        // del pie del Excel ("Jetour:110"). En un renglón, catorce columnas
        // se pisaban.
        formatter: (v: number) => {
          const marca = marcas[Math.round(v)];
          return marca ? `${marca}\n${formatUnidades(totalPorMarca.get(marca) ?? 0)}` : "";
        },
      },
      axisLine: { lineStyle: { color: theme.grid } },
      axisTick: { show: false },
      splitLine: { show: true, lineStyle: { color: theme.grid, type: "dashed" as const } },
    },
    yAxis: {
      type: "value" as const,
      min: yMin,
      max: yMax,
      axisLabel: { color: theme.text, fontSize: 11, formatter: (v: number) => `${Math.round(v / 1000)}k` },
      // Sin esto el eje se dibuja en x = 0, o sea atravesando la primera
      // columna de marcas.
      axisLine: { onZero: false, lineStyle: { color: theme.grid } },
      splitLine: { lineStyle: { color: theme.grid } },
    },
    series: [
      {
        type: "scatter" as const,
        data: puntos,
        label: {
          show: true,
          position: "right" as const,
          color: theme.text,
          fontSize: 9,
          formatter: (p: { name: string; value: number[] }) =>
            `${p.name}${p.value[2] ? ` · ${formatUnidades(p.value[2])}` : ""}`,
        },
        labelLayout: { moveOverlap: "shiftY" as const },
        emphasis: { focus: "self" as const, label: { fontWeight: "bold" as const } },
      },
    ],
  };

  // Ranking por precio, de mayor a menor, con el volumen al lado: es el
  // gráfico de barras de la hoja X50.
  const ranking = [...versiones].sort((a, b) => b.precio - a.precio);
  const optionRanking = {
    animationDuration: 500,
    grid: { left: 4, right: 110, top: 8, bottom: 24, containLabel: true },
    tooltip: { ...TOOLTIP_BASE, trigger: "item" },
    xAxis: {
      type: "value" as const,
      axisLabel: { color: theme.text, fontSize: 10, formatter: (v: number) => `${Math.round(v / 1000)}k` },
      splitLine: { lineStyle: { color: theme.grid } },
    },
    yAxis: {
      type: "category" as const,
      inverse: true,
      data: ranking.map((v) => `${v.version}`),
      axisLabel: { color: theme.text, fontSize: 10, width: 260, overflow: "truncate" as const },
      axisTick: { show: false },
      axisLine: { show: false },
    },
    series: [
      {
        type: "bar" as const,
        data: ranking.map((v) => ({
          value: v.precio,
          name: v.version,
          marca: v.marca,
          itemStyle: { color: colorDe(v.marca), borderRadius: [0, 4, 4, 0] },
          vol: volumen(v),
        })),
        barMaxWidth: 16,
        label: {
          show: true,
          position: "right" as const,
          color: theme.text,
          fontSize: 10,
          formatter: (p: { value: number; data: { vol: number } }) =>
            `US$ ${formatUnidades(p.value)} · ${formatUnidades(p.data.vol)}`,
        },
      },
    ],
  };

  const filas = [...versiones].sort(
    (a, b) => (indice.get(a.marca) ?? 0) - (indice.get(b.marca) ?? 0) || a.precio - b.precio
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-1.5" aria-label="Marcas en este gráfico">
        <span className="mr-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Marcas en este gráfico
        </span>
        <button
          type="button"
          onClick={() => onVisibles(todasLasMarcas)}
          className="rounded-md border px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground pointer-coarse:min-h-9"
        >
          Todas
        </button>
        {nuestras.length > 0 && (
          <button
            type="button"
            onClick={() => onVisibles(nuestras)}
            title="Deja solo las marcas del grupo; después tocá las del mercado con las que querés comparar."
            className="rounded-md border px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground pointer-coarse:min-h-9"
          >
            Nuestras
          </button>
        )}
        <span className="mx-1 h-4 w-px bg-border" aria-hidden="true" />
        {todasLasMarcas.map((marca) => {
          const activa = visibles.includes(marca);
          const propia = esPropia(marca, propias);
          return (
            <button
              key={marca}
              type="button"
              aria-pressed={activa}
              onClick={() => alternar(marca)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs pointer-coarse:min-h-9",
                activa ? "bg-background text-foreground" : "bg-muted/40 text-muted-foreground line-through",
                propia && activa && "border-primary/60 font-medium"
              )}
            >
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ background: colorDe(marca), opacity: activa ? 1 : 0.35 }}
              />
              {marca}
              {propia && <span className="text-[10px] text-primary">nuestra</span>}
            </button>
          );
        })}
      </div>
      <Card>
        <CardHeader>
          <CardTitle>
            {m.modelo} — {m.titulo || "Bubble chart"}
            {m.periodo ? ` · ${m.periodo}` : ""}
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Una burbuja por versión rival, en la columna de su marca · eje Y = precio de
            lista (US$) · tamaño = {etiquetaVolumen} del período · al pie de cada columna, el
            total de la marca.{" "}
            {marcas.length < todasLasMarcas.length
              ? `Se muestran ${marcas.length} de ${todasLasMarcas.length} marcas (${versiones.length} de ${m.versiones.length} versiones). `
              : ""}
            Es el gráfico del equipo de producto, tal cual está en su
            planilla{m.archivo ? ` «${m.archivo}»` : ""} (hoja «{m.hoja}»
            {m.modelo_celda && m.modelo_celda.toUpperCase() !== m.modelo.toUpperCase()
              ? `, que en su celda de modelo dice «${m.modelo_celda}»`
              : ""}
            ).
          </p>
        </CardHeader>
        <CardContent>
          <EchartsAuto option={option} style={{ height: 520, width: "100%" }} notMerge />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Ranking por precio</CardTitle>
            <p className="text-xs text-muted-foreground">
              Todas las versiones de la batalla, de la más cara a la más barata, con su
              volumen ({etiquetaVolumen}).
            </p>
          </CardHeader>
          <CardContent>
            <EchartsAuto
              option={optionRanking}
              style={{ height: Math.max(220, 22 * ranking.length + 50), width: "100%" }}
              notMerge
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Las versiones, con sus medidas</CardTitle>
            <p className="text-xs text-muted-foreground">
              Largo × ancho × alto en mm, como las anota producto. Las nuestras resaltadas.
            </p>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Marca</TableHead>
                  <TableHead>Versión</TableHead>
                  <TableHead nota="largo × ancho × alto, en mm">Medidas</TableHead>
                  <TableHead className="text-right" nota="el de la planilla de producto">Precio</TableHead>
                  <TableHead className="text-right" nota="unidades que sacaron chapa">Matric.</TableHead>
                  <TableHead className="text-right" nota="unidades que entraron al país">Import.</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filas.map((v, k) => (
                  <TableRow
                    key={`${v.marca}|${v.version}|${k}`}
                    className={cn(esPropia(v.marca, propias) && "bg-primary/5")}
                  >
                    <TableCell className="whitespace-nowrap font-medium">
                      <span
                        className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full align-middle"
                        style={{ background: colorDe(v.marca) }}
                      />
                      {v.marca}
                    </TableCell>
                    <TableCell className="text-xs">{v.version}</TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{v.medidas || "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">US$ {formatUnidades(v.precio)}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {v.matriculaciones ? formatUnidades(v.matriculaciones) : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {v.importaciones ? formatUnidades(v.importaciones) : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
