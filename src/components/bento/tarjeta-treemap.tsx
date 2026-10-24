"use client";

import * as React from "react";
import { LogoMarca } from "@/components/dashboard/logo-marca";
import { useI18n } from "@/lib/i18n/cliente";
import { useFiltroUrl } from "@/lib/filtro-url";
import { MARCA_OTRAS, type ItemTreemap } from "@/lib/cadam/panorama-tipos";
import { cn } from "@/lib/utils";
import { claseDeGrupo, CLASE_GRUPO_OTROS, GRUPOS_CON_COLOR } from "./colores";
import { CambioChip, EASE, Rotulo, TablaOculta, Tarjeta, useEntrada, useMenosMovimiento, useMontado, useTamano, useTip } from "./comun";

export interface PropsTreemap {
  items: ItemTreemap[];
  /** Total del mercado de cada período: período del filtro, el mismo del año anterior, y el último mes. */
  totales: number[];
  anio: number;
  mesDesde: number;
  mesHasta: number;
  /** El último mes con dato de la fuente, dentro del rango. */
  mesUltimo: number;
  variacionPeriodo: number | null;
  variacionUltimoMes: number | null;
  fuente: "matriculacion" | "importacion";
}

interface Rect {
  item: ItemTreemap;
  v: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Treemap «squarified»: cada rectángulo con el área de su valor y lo más cuadrado posible. */
function cuadricular(items: { item: ItemTreemap; v: number }[], x: number, y: number, w: number, h: number): Rect[] {
  const total = items.reduce((a, b) => a + b.v, 0) || 1;
  const escala = (w * h) / total;
  const salida: Rect[] = [];
  let resto = items.filter((i) => i.v > 0).map((i) => ({ ...i, a: i.v * escala }));
  const peor = (fila: typeof resto, lado: number) => {
    const s = fila.reduce((a, b) => a + b.a, 0);
    const mx = Math.max(...fila.map((r) => r.a));
    const mn = Math.min(...fila.map((r) => r.a));
    return Math.max((lado * lado * mx) / (s * s), (s * s) / (lado * lado * mn));
  };
  while (resto.length) {
    const lado = Math.min(w, h);
    const fila = [resto[0]];
    let i = 1;
    while (i < resto.length && peor([...fila, resto[i]], lado) <= peor(fila, lado)) fila.push(resto[i++]);
    resto = resto.slice(i);
    const s = fila.reduce((a, b) => a + b.a, 0);
    if (w >= h) {
      const ancho = s / h;
      let cy = y;
      for (const r of fila) {
        const alto = r.a / ancho;
        salida.push({ item: r.item, v: r.v, x, y: cy, w: ancho, h: alto });
        cy += alto;
      }
      x += ancho;
      w -= ancho;
    } else {
      const alto = s / w;
      let cx = x;
      for (const r of fila) {
        const ancho = r.a / alto;
        salida.push({ item: r.item, v: r.v, x: cx, y, w: ancho, h: alto });
        cx += ancho;
      }
      y += alto;
      h -= alto;
    }
  }
  return salida;
}

const HUECO = 4;

/**
 * Cómo se reparte el mercado entre las marcas, con el color del grupo
 * importador al que pertenece cada una (el nuestro, en cian). Tres vistas del
 * mismo mapa —el período del filtro, el mismo período del año anterior y el
 * último mes— con las mismas marcas: al cambiar de una a otra cada rectángulo
 * crece o se achica en su lugar, y es ahí donde se ve quién ganó terreno.
 *
 * Tocar una marca filtra toda la pantalla por ella (como en las tablas).
 */
export function TarjetaTreemap(p: PropsTreemap) {
  const { t, fmt } = useI18n();
  const { formatUnidades, formatPct, etiquetaPeriodo, mesCorto, nombreDeGrupo, nombreDeMarca } = fmt;
  const tip = useTip();
  const [raiz, visto] = useEntrada();
  const montado = useMontado(visto);
  const reducido = useMenosMovimiento();
  const { leer, alternar } = useFiltroUrl();
  const [periodo, setPeriodo] = React.useState(0);
  const [ref, { w: W, h: H }] = useTamano();
  const etiquetaFuente = p.fuente === "importacion" ? t("importaciones") : t("matriculaciones");

  const periodos = [
    { etiqueta: t("Período"), detalle: etiquetaPeriodo(p.anio, p.mesDesde, p.mesHasta), variacion: p.variacionPeriodo },
    { etiqueta: t("Mismo período {previo}", { previo: p.anio - 1 }), detalle: etiquetaPeriodo(p.anio - 1, p.mesDesde, p.mesHasta), variacion: null as number | null },
    { etiqueta: t("Último mes"), detalle: `${mesCorto(p.mesUltimo)} ${p.anio}`, variacion: p.variacionUltimoMes },
  ];
  const total = p.totales[periodo] || 0;
  const rects = React.useMemo(
    () =>
      W && H
        ? cuadricular(
            p.items.map((item) => ({ item, v: item.valores[periodo] ?? 0 })).sort((a, b) => b.v - a.v),
            0, 0, W + HUECO, H + HUECO
          )
        : [],
    [p.items, periodo, W, H]
  );
  const gruposEnUso = new Set(p.items.map((i) => i.grupo));
  const leyenda = GRUPOS_CON_COLOR.filter((g) => gruposEnUso.has(g));
  const hayOtros = p.items.some((i) => claseDeGrupo(i.grupo) === CLASE_GRUPO_OTROS);

  return (
    <Tarjeta ref={raiz} className="flex flex-col md:col-span-2 xl:col-span-8" aria-label={t("Mercado por marca")}>
      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <Rotulo>{t("Mercado por marca · {fuente}", { fuente: etiquetaFuente })}</Rotulo>
          <p className="mt-0.5 text-xs text-muted-foreground">{t("El color es el grupo importador. Tocá una marca para filtrar la pantalla.")}</p>
        </div>
        <ul className="flex flex-wrap gap-x-3.5 gap-y-1.5 text-xs text-muted-foreground" aria-label={t("Grupos")}>
          {leyenda.map((g) => (
            <li key={g} className="inline-flex items-center gap-1.5">
              <i aria-hidden="true" className={cn("bento-g inline-block size-2.5 rounded-[3px]", claseDeGrupo(g))} />
              {nombreDeGrupo(g)}
            </li>
          ))}
          {hayOtros && (
            <li className="inline-flex items-center gap-1.5">
              <i aria-hidden="true" className={cn("bento-g inline-block size-2.5 rounded-[3px]", CLASE_GRUPO_OTROS)} />
              {t("Otros grupos")}
            </li>
          )}
        </ul>
      </div>

      <div className="my-4 grid grid-cols-3 gap-1.5 sm:gap-3">
        {periodos.map((q, i) => (
          <button
            key={q.etiqueta}
            type="button"
            aria-pressed={i === periodo}
            onClick={() => setPeriodo(i)}
            className={cn(
              "rounded-xl px-2.5 py-2 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
              i === periodo ? "bg-muted" : "hover:bg-muted/60"
            )}
          >
            <span className="flex items-center gap-1.5 text-[13px] font-semibold tracking-[-0.01em]">
              <i aria-hidden="true" className={cn("size-1.5 rounded-full transition-colors", i === periodo ? "bg-primary" : "bg-muted-foreground/50")} />
              {q.etiqueta}
            </span>
            <span className="mt-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <span className="font-mono text-lg font-bold leading-none tracking-[-0.03em] tabular-nums sm:text-[1.6rem]">{formatUnidades(p.totales[i] ?? 0)}</span>
              {q.variacion !== null && (
                <CambioChip valor={q.variacion} texto={formatPct(q.variacion, { signed: true })} className="hidden !text-[11px] sm:inline-flex" />
              )}
            </span>
            <span className="mt-1 hidden text-xs text-muted-foreground sm:block">{q.detalle}</span>
          </button>
        ))}
      </div>

      <div ref={ref} className="relative h-[300px] sm:h-[360px]" role="group" aria-label={t("Mercado por marca, {periodo}", { periodo: periodos[periodo].detalle })}>
        {rects.map((r) => {
          const esOtras = r.item.marca === MARCA_OTRAS;
          const ancho = r.w - HUECO;
          const alto = r.h - HUECO;
          const parte = total > 0 ? r.v / total : 0;
          const numero = formatUnidades(r.v);
          // Tamaño de la cifra según lo que entra; si no entra con su porcentaje, va sola.
          let fs = Math.min(26, (ancho - 24 - 56) / (numero.length * 0.62));
          let verPct = true;
          if (fs < 15) {
            verPct = false;
            fs = Math.min(26, (ancho - 24) / (numero.length * 0.62));
          }
          const diminuto = fs < 11 || alto < 52 || ancho < 56;
          const verNombre = ancho >= 78 && alto >= 44;
          const verLogo = !esOtras && ancho >= 118 && alto >= 78;
          const nombre = esOtras ? t("Otras marcas") : nombreDeMarca(r.item.marca);
          const activa = !esOtras && leer("marca") === r.item.marca;
          const mostrar = (x: number, y: number) =>
            tip.mostrar(x, y, {
              titulo: `${periodos[periodo].detalle} · ${esOtras ? t("Otros grupos") : nombreDeGrupo(r.item.grupo)}`,
              filas: [
                { etiqueta: nombre, valor: t("{n} u.", { n: numero }) },
                { etiqueta: t("Participación"), valor: formatPct(parte) },
              ],
            });
          return (
            <button
              key={r.item.marca}
              type="button"
              aria-disabled={esOtras || undefined}
              aria-pressed={esOtras ? undefined : activa}
              aria-label={`${nombre}: ${t("{n} u.", { n: numero })}, ${formatPct(parte)}`}
              onPointerMove={(e) => mostrar(e.clientX, e.clientY)}
              onPointerLeave={() => tip.ocultar()}
              onFocus={(e) => {
                const b = e.currentTarget.getBoundingClientRect();
                mostrar(b.left + b.width / 2, b.top);
              }}
              onBlur={() => tip.ocultar()}
              onClick={() => !esOtras && alternar("marca", r.item.marca)}
              className={cn(
                "bento-g absolute flex flex-col justify-between overflow-hidden rounded-xl p-2.5 text-left outline-none transition-[left,top,width,height,filter,box-shadow] hover:brightness-[1.08] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card motion-reduce:transition-none",
                esOtras ? "cursor-default" : "cursor-pointer",
                claseDeGrupo(r.item.grupo),
                activa && "ring-2 ring-foreground ring-offset-2 ring-offset-card"
              )}
              style={{
                left: montado ? r.x : W / 2,
                top: montado ? r.y : H / 2,
                width: montado ? ancho : 0,
                height: montado ? alto : 0,
                transitionDuration: reducido ? "0ms" : "650ms",
                transitionTimingFunction: EASE,
              }}
            >
              <span className="flex min-w-0 items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.05em]">
                {verLogo && <LogoMarca marca={r.item.marca} tamano="sm" className="size-auto h-6 w-9" />}
                {verNombre && <span className="truncate">{nombre}</span>}
              </span>
              {!diminuto && (
                <span className="flex items-end justify-between gap-1.5">
                  <span className="font-mono font-bold leading-[0.9] tracking-[-0.04em] tabular-nums" style={{ fontSize: fs }}>{numero}</span>
                  {verPct && (
                    <span className="rounded-md bg-black/70 px-1.5 py-0.5 font-mono text-[10px] font-semibold tabular-nums text-white">{formatPct(parte)}</span>
                  )}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <TablaOculta
        titulo={t("Mercado por marca, {periodo}", { periodo: periodos[periodo].detalle })}
        columnas={[t("Marca"), t("Grupo"), t("Unidades"), t("Participación")]}
        filas={[...p.items]
          .sort((a, b) => (b.valores[periodo] ?? 0) - (a.valores[periodo] ?? 0))
          .map((it) => [
            it.marca === MARCA_OTRAS ? t("Otras marcas") : nombreDeMarca(it.marca),
            it.marca === MARCA_OTRAS ? t("Otros grupos") : nombreDeGrupo(it.grupo),
            formatUnidades(it.valores[periodo] ?? 0),
            formatPct(total > 0 ? (it.valores[periodo] ?? 0) / total : 0),
          ])}
      />
    </Tarjeta>
  );
}

