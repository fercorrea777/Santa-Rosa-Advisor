"use client";

import * as React from "react";
import Link from "next/link";
import { Cifra } from "@/components/movimiento/cifra";
import { useI18n } from "@/lib/i18n/cliente";
import type { Serie12 } from "@/lib/cadam/panorama-tipos";
import { cn } from "@/lib/utils";
import { CambioChip, EASE, Rotulo, TablaOculta, Tarjeta, useEntrada, useMenosMovimiento, useMontado, useTip } from "./comun";

export interface PropsParticipacion {
  anio: number;
  mesDesde: number;
  mesHasta: number;
  /** Participación de nuestras marcas en el período (0–1); null = no hay datos en el filtro. */
  participacion: number | null;
  /** Diferencia contra el mismo período del año anterior, en PUNTOS (0,012 = +1,2 pp). */
  cambioPp: number | null | undefined;
  unidadesPropias: number;
  unidadesMercado: number;
  /** Participación mes a mes del año del filtro y del anterior. */
  mensual: Serie12;
  mensualPrevia: Serie12;
  /** Dónde está el grupo Santa Rosa entre todos los grupos (importadores). */
  grupo: { puesto: number; de: number; puestoAntes: number | null } | null;
  /** Qué marcas cuentan como nuestras, para el «i». */
  nota: string;
  /** Matriculaciones o importaciones, según la fuente elegida arriba. */
  fuente: "matriculacion" | "importacion";
}

const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

/**
 * Nuestra participación, en la tarjeta de acento (el cian de la marca como
 * relleno: es lo nuestro y se ve de lejos). La cifra grande, cuánto cambió en
 * puntos, el puesto del grupo entre los importadores y la participación de cada
 * mes del año con una marca en el valor del mismo mes del año anterior.
 */
export function TarjetaParticipacion(p: PropsParticipacion) {
  const { t, fmt } = useI18n();
  const { formatUnidades, formatPct, formatPuntosPct, mesCorto, mesesLargos } = fmt;
  const tip = useTip();
  const [raiz, visto] = useEntrada();
  const montado = useMontado(visto);
  const reducido = useMenosMovimiento();
  const valores = [...p.mensual, ...p.mensualPrevia].filter((v): v is number => v !== null);
  const techo = Math.max(0.01, ...valores) * 1.15;
  const sube = p.grupo && p.grupo.puestoAntes !== null ? p.grupo.puestoAntes - p.grupo.puesto : null;

  const mostrar = (i: number, el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    tip.mostrar(r.left + r.width / 2, r.top, {
      titulo: `${cap(mesesLargos[i])} ${p.anio}`,
      filas: [
        { etiqueta: String(p.anio), valor: p.mensual[i] === null ? "—" : formatPct(p.mensual[i]) },
        { etiqueta: String(p.anio - 1), valor: p.mensualPrevia[i] === null ? "—" : formatPct(p.mensualPrevia[i]) },
      ],
    });
  };

  return (
    <Tarjeta ref={raiz} className="tile-acento flex flex-col md:col-span-1 xl:col-span-4" aria-label={t("Participación marcas propias")}>
      <div className="flex items-start justify-between gap-3">
        <Rotulo className="!text-inherit">{t("Participación marcas propias")}</Rotulo>
        <span className="rounded-full bg-black/20 px-2 py-0.5 text-[11px] font-medium dark:bg-white/20" title={p.nota}>
          {t("las nuestras")}
        </span>
      </div>

      {p.participacion === null ? (
        <p className="mt-6 text-lg font-medium">{t("Sin datos en este filtro")}</p>
      ) : (
        <>
          <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <Cifra como="p" texto={formatPct(p.participacion)} className="metric text-[3.4rem] !text-inherit sm:text-[4rem]" />
            {p.cambioPp !== undefined && p.cambioPp !== null && (
              <CambioChip sobreColor valor={p.cambioPp} texto={formatPuntosPct(p.cambioPp)} />
            )}
          </div>
          <p className="mt-1.5 text-xs">
            {p.fuente === "importacion"
              ? t("{propias} u. de {mercado} importaciones", { propias: formatUnidades(p.unidadesPropias), mercado: formatUnidades(p.unidadesMercado) })
              : t("{propias} u. de {mercado} matriculaciones", { propias: formatUnidades(p.unidadesPropias), mercado: formatUnidades(p.unidadesMercado) })}
          </p>
        </>
      )}

      {p.grupo && (
        <div className="mt-4 rounded-xl bg-black/[0.2] p-3 text-sm dark:bg-black/[0.1]">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-[12px] font-medium">{t("Puesto del grupo")}</span>
            <span className="font-mono text-lg font-bold tabular-nums">
              #{p.grupo.puesto}
              <span className="text-xs font-medium"> {t("de {n} grupos", { n: p.grupo.de })}</span>
            </span>
          </div>
          {sube !== null && (
            <p className="mt-0.5 text-right text-[11px]">
              {sube === 0
                ? t("igual que hace un año (#{antes})", { antes: p.grupo.puestoAntes! })
                : sube > 0
                  ? t("▲ {n} desde #{antes} hace un año", { n: sube, antes: p.grupo.puestoAntes! })
                  : t("▼ {n} desde #{antes} hace un año", { n: -sube, antes: p.grupo.puestoAntes! })}
            </p>
          )}
        </div>
      )}

      <div className="mt-4 flex min-h-0 flex-1 flex-col pt-1">
        <p className="mb-2 flex items-center justify-between text-[11px]">
          <span>{t("Participación mes a mes, {anio}", { anio: p.anio })}</span>
          <span className="inline-flex items-center gap-1.5">
            <i aria-hidden="true" className="inline-block h-0.5 w-3 rounded-sm bg-current opacity-70" />
            {p.anio - 1}
          </span>
        </p>
        <div className="flex min-h-24 flex-1 items-end gap-[3px]" onPointerLeave={() => tip.ocultar()}>
          {Array.from({ length: 12 }, (_, i) => {
            const v = p.mensual[i];
            const previo = p.mensualPrevia[i];
            const enRango = i + 1 >= p.mesDesde && i + 1 <= p.mesHasta;
            return (
              <button
                key={i}
                type="button"
                disabled={v === null && previo === null}
                aria-label={`${cap(mesesLargos[i])}: ${v === null ? "—" : formatPct(v)}`}
                onPointerEnter={(e) => mostrar(i, e.currentTarget)}
                onFocus={(e) => mostrar(i, e.currentTarget)}
                onBlur={() => tip.ocultar()}
                className="group relative h-full flex-1 outline-none disabled:cursor-default"
              >
                {v !== null && (
                  <span
                    aria-hidden="true"
                    className={cn(
                      "absolute inset-x-0 bottom-0 rounded-t-[4px] bg-current transition-[height,opacity] group-focus-visible:ring-2 group-focus-visible:ring-current",
                      enRango ? "opacity-90" : "opacity-45",
                      "group-hover:opacity-100"
                    )}
                    style={{
                      height: montado || reducido ? `${Math.max(3, (v / techo) * 100)}%` : "3%",
                      transitionDuration: reducido ? "0ms" : "850ms",
                      transitionDelay: reducido ? "0ms" : `${i * 40}ms`,
                      transitionTimingFunction: EASE,
                    }}
                  />
                )}
                {previo !== null && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-[-1px] h-0.5 rounded-sm bg-current opacity-70"
                    style={{ bottom: `calc(${(previo / techo) * 100}% - 1px)` }}
                  />
                )}
              </button>
            );
          })}
        </div>
        <div aria-hidden="true" className="mt-1 flex justify-between text-[10px]">
          <span>{mesCorto(1)}</span>
          <span>{mesCorto(12)}</span>
        </div>
        <TablaOculta
          titulo={t("Participación mes a mes, {anio}", { anio: p.anio })}
          columnas={[t("Mes"), String(p.anio), String(p.anio - 1)]}
          filas={Array.from({ length: 12 }, (_, i) => [
            mesCorto(i + 1),
            p.mensual[i] === null ? "—" : formatPct(p.mensual[i]),
            p.mensualPrevia[i] === null ? "—" : formatPct(p.mensualPrevia[i]),
          ])}
        />
        <Link
          href="/market-share"
          className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-xl bg-white/90 py-2.5 text-sm font-semibold text-[oklch(0.3_0.08_215)] outline-none transition-transform hover:bg-white focus-visible:ring-2 focus-visible:ring-white active:scale-[0.98] dark:bg-[oklch(0.2_0.04_250)] dark:text-[var(--primary)] dark:hover:bg-[oklch(0.24_0.04_250)]"
        >
          {t("Ver market share")} <span aria-hidden="true">→</span>
        </Link>
      </div>
    </Tarjeta>
  );
}
