"use client";

import * as React from "react";
import { Cifra } from "@/components/movimiento/cifra";
import { useI18n } from "@/lib/i18n/cliente";
import type { Serie12 } from "@/lib/cadam/panorama-tipos";
import { cn } from "@/lib/utils";
import {
  CambioChip, COLOR_IMPORTACION, COLOR_MATRICULACION, Rotulo, TablaOculta, Tarjeta, tramos, suavizar, useEntrada, useMenosMovimiento, useTamano, useTip,
} from "./comun";

export interface PropsImportaciones {
  anio: number;
  mesDesde: number;
  mesHasta: number;
  recorta: boolean;
  sinDatos: boolean;
  valor: number;
  variacion: number | null;
  baseValor: number;
  impActual: Serie12;
  impPrevia: Serie12;
  matActual: Serie12;
  matPrevia: Serie12;
  /** Importación menos matriculación sobre el tramo que tienen las dos fuentes; null = no hay tramo común. */
  diferencia: { valor: number; sobraImportacion: boolean; periodo: string | null } | null;
  nota: string;
  notaDiferencia: string;
}

const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

/**
 * Importaciones y lo que se importó de más o de menos que lo que ya se
 * matriculó. Debajo, el gráfico de ondas: arriba lo que entra al país
 * (importación), abajo lo que sale a la calle (matriculación), mes a mes, con
 * el año anterior más tenue. Las dos mitades comparten escala: una onda que
 * sube más que la otra es un mes que entró más de lo que se vendió.
 */
export function TarjetaImportaciones(p: PropsImportaciones) {
  const { t, fmt } = useI18n();
  const { formatUnidades, formatPct, etiquetaPeriodo, mesCorto } = fmt;
  const periodo = etiquetaPeriodo(p.anio, p.mesDesde, p.mesHasta);
  const periodoPrevio = etiquetaPeriodo(p.anio - 1, p.mesDesde, p.mesHasta);
  const titulo = p.recorta ? t("Importaciones (hasta {mes})", { mes: mesCorto(p.mesHasta) }) : t("Importaciones");
  const [raiz, visto] = useEntrada();
  return (
    <Tarjeta ref={raiz} className="flex flex-col md:col-span-2 xl:col-span-5" aria-label={titulo}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <Rotulo>{titulo}</Rotulo>
          <p className="mt-0.5 text-xs text-muted-foreground">{t("{periodo} · livianos", { periodo })}</p>
        </div>
        <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground" title={p.nota}>
          {t("entran al país")}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div>
          {p.sinDatos ? (
            <p className="text-lg font-medium text-muted-foreground">{t("{periodo} · todavía sin publicar", { periodo })}</p>
          ) : (
            <>
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <Cifra como="p" texto={formatUnidades(p.valor)} className="metric text-[2.5rem] text-foreground sm:text-[3rem]" />
                {p.variacion !== null && <CambioChip valor={p.variacion} texto={formatPct(p.variacion, { signed: true })} />}
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">
                {t("vs. {periodo}: {n} u.", { periodo: periodoPrevio, n: formatUnidades(p.baseValor) })}
              </p>
            </>
          )}
        </div>
        <div className="min-w-0 text-right" title={p.notaDiferencia}>
          <p className="text-[11px] font-medium uppercase tracking-[0.07em] text-muted-foreground">{t("Diferencia import. − matric.")}</p>
          {p.diferencia ? (
            <>
              <Cifra como="p" texto={formatUnidades(Math.abs(p.diferencia.valor))} className="metric mt-1 text-[1.6rem] text-foreground" />
              <p className="mt-1 text-xs text-muted-foreground">
                {p.diferencia.sobraImportacion ? t("importación por encima") : t("matriculación por encima")}
                {p.diferencia.periodo ? ` · ${p.diferencia.periodo}` : ""}
              </p>
            </>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">{t("las dos fuentes no tienen este período")}</p>
          )}
        </div>
      </div>

      <div className="mt-4 min-h-0 flex-1">
        <Ondas {...p} activo={visto} />
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <i aria-hidden="true" className="h-0.5 w-4 rounded-sm" style={{ background: COLOR_IMPORTACION }} />
          {t("Importaciones (arriba)")}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <i aria-hidden="true" className="h-0.5 w-4 rounded-sm" style={{ background: COLOR_MATRICULACION }} />
          {t("Matriculaciones (abajo)")}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <i aria-hidden="true" className="h-0.5 w-4 rounded-sm bg-muted-foreground/50" />
          {t("{previo}, más tenue", { previo: p.anio - 1 })}
        </span>
      </div>
    </Tarjeta>
  );
}

// ------------------------------------------------------------------ ondas

interface SerieOnda {
  valores: Serie12;
  /** -1: sobre el eje (importaciones). +1: bajo el eje (matriculaciones). */
  dir: -1 | 1;
  color: string;
  actual: boolean;
}

function Ondas({ anio, impActual, impPrevia, matActual, matPrevia, activo }: PropsImportaciones & { activo: boolean }) {
  const { t, fmt } = useI18n();
  const { formatUnidades, mesCorto, mesesLargos } = fmt;
  const tip = useTip();
  const reducido = useMenosMovimiento();
  const [ref, { w: W, h: alto }] = useTamano();
  const [hover, setHover] = React.useState<number | null>(null);
  const caminos = React.useRef<(SVGPathElement | null)[]>([]);
  const areas = React.useRef<(SVGPathElement | null)[]>([]);
  const id = React.useId().replace(/:/g, "");
  const H = Math.max(190, alto);
  const izq = 8, der = 8, abajo = 20;
  const mitad = (H - abajo) / 2;
  const amp = mitad - 8;

  const series = React.useMemo<SerieOnda[]>(
    () => [
      { valores: impPrevia, dir: -1, color: COLOR_IMPORTACION, actual: false },
      { valores: matPrevia, dir: 1, color: COLOR_MATRICULACION, actual: false },
      { valores: impActual, dir: -1, color: COLOR_IMPORTACION, actual: true },
      { valores: matActual, dir: 1, color: COLOR_MATRICULACION, actual: true },
    ],
    [impActual, impPrevia, matActual, matPrevia]
  );
  const max = Math.max(
    1,
    ...series.flatMap((s) => s.valores.filter((v): v is number => v !== null))
  );
  const paso = (W - izq - der) / 11;
  const x = React.useCallback((i: number) => izq + i * paso, [paso]);

  // Entrada: las ondas crecen desde el eje hasta su altura. Termina y se apaga
  // (nada respira ni se mueve solo después): un dato no debe cambiar de altura
  // mientras se lo mira.
  React.useEffect(() => {
    if (!W || !activo) return;
    let raf = 0;
    const t0 = performance.now();
    const dibujar = (g: number) => {
      series.forEach((s, j) => {
        const y = (v: number) => mitad + s.dir * (2 + (v / max) * amp * g);
        const partes = tramos(s.valores, x, y);
        const d = partes.map(suavizar).join(" ");
        caminos.current[j]?.setAttribute("d", d);
        if (s.actual) {
          const eje = mitad;
          areas.current[j]?.setAttribute(
            "d",
            partes.map((tr) => `${suavizar(tr)}L${tr[tr.length - 1][0]},${eje}L${tr[0][0]},${eje}Z`).join(" ")
          );
        }
      });
    };
    if (reducido) {
      dibujar(1);
      return;
    }
    const cuadro = (ahora: number) => {
      const k = Math.min(1, (ahora - t0) / 1200);
      dibujar(1 - Math.pow(1 - k, 3));
      if (k < 1) raf = requestAnimationFrame(cuadro);
    };
    raf = requestAnimationFrame(cuadro);
    return () => cancelAnimationFrame(raf);
  }, [W, activo, series, max, amp, mitad, x, reducido]);

  const mover = (e: React.PointerEvent<SVGRectElement>) => {
    const r = e.currentTarget.ownerSVGElement!.getBoundingClientRect();
    const i = Math.max(0, Math.min(11, Math.round((e.clientX - r.left - izq) / paso)));
    setHover(i);
    const f = (v: number | null) => (v === null ? "—" : t("{n} u.", { n: formatUnidades(v) }));
    tip.mostrar(r.left + x(i), r.top + 14, {
      titulo: cap(mesesLargos[i]),
      filas: [
        { etiqueta: t("Importaciones {anio}", { anio }), valor: f(impActual[i]), color: COLOR_IMPORTACION },
        { etiqueta: t("Matriculaciones {anio}", { anio }), valor: f(matActual[i]), color: COLOR_MATRICULACION },
        { etiqueta: t("Importaciones {anio}", { anio: anio - 1 }), valor: f(impPrevia[i]) },
        { etiqueta: t("Matriculaciones {anio}", { anio: anio - 1 }), valor: f(matPrevia[i]) },
      ],
    });
  };

  return (
    <div ref={ref} className="relative h-full min-h-[190px] w-full">
      {W > 0 && (
        <svg width={W} height={H} className="block" role="img" aria-label={t("Importaciones y matriculaciones por mes, {anio} y {previo}", { anio, previo: anio - 1 })}>
          <defs>
            {[COLOR_IMPORTACION, COLOR_MATRICULACION].map((c, k) => (
              <linearGradient key={c} id={`${id}g${k}`} x1="0" x2="0" y1={k === 0 ? "1" : "0"} y2={k === 0 ? "0" : "1"}>
                {/* y1 es el lado del eje: ahí el relleno es más fuerte y se va apagando hacia la cresta. */}
                <stop offset="0" style={{ stopColor: c, stopOpacity: 0.22 }} />
                <stop offset="1" style={{ stopColor: c, stopOpacity: 0 }} />
              </linearGradient>
            ))}
          </defs>
          <line x1={izq} x2={W - der} y1={mitad} y2={mitad} className="stroke-border" strokeWidth={1} />
          {Array.from({ length: 12 }, (_, i) => (
            <text key={i} x={x(i)} y={H - 6} textAnchor="middle" fontSize={10} className={cn("fill-muted-foreground", W < 360 && i % 2 === 1 && "hidden")}>
              {mesCorto(i + 1)}
            </text>
          ))}
          {series.map((s, j) =>
            s.actual ? (
              <path key={`a${j}`} ref={(el) => { areas.current[j] = el; }} fill={`url(#${id}g${s.dir === -1 ? 0 : 1})`} />
            ) : null
          )}
          {series.map((s, j) => (
            <path
              key={j}
              ref={(el) => { caminos.current[j] = el; }}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={s.actual ? 2.5 : 1.6}
              opacity={s.actual ? 1 : 0.5}
              style={{ stroke: s.color }}
              strokeDasharray={s.actual ? undefined : "4 4"}
            />
          ))}
          {hover !== null && (
            <g>
              <line x1={x(hover)} x2={x(hover)} y1={4} y2={H - abajo} className="stroke-muted-foreground/60" strokeWidth={1} />
              {series
                .filter((s) => s.actual && s.valores[hover] !== null)
                .map((s) => (
                  <circle key={s.dir} cx={x(hover)} cy={mitad + s.dir * (2 + (s.valores[hover]! / max) * amp)} r={4.5} strokeWidth={2.5} className="stroke-card" style={{ fill: s.color }} />
                ))}
            </g>
          )}
          <rect x={0} y={0} width={W} height={H} fill="transparent" onPointerMove={mover} onPointerLeave={() => { setHover(null); tip.ocultar(); }} />
        </svg>
      )}
      <TablaOculta
        titulo={t("Importaciones y matriculaciones por mes, {anio} y {previo}", { anio, previo: anio - 1 })}
        columnas={[t("Mes"), t("Importaciones {anio}", { anio }), t("Matriculaciones {anio}", { anio }), t("Importaciones {anio}", { anio: anio - 1 }), t("Matriculaciones {anio}", { anio: anio - 1 })]}
        filas={Array.from({ length: 12 }, (_, i) => [
          mesCorto(i + 1),
          ...[impActual[i], matActual[i], impPrevia[i], matPrevia[i]].map((v) => (v === null ? "—" : formatUnidades(v))),
        ])}
      />
    </div>
  );
}

