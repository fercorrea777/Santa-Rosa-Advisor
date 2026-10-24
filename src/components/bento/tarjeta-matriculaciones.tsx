"use client";

import * as React from "react";
import { Cifra } from "@/components/movimiento/cifra";
import { useI18n } from "@/lib/i18n/cliente";
import { variacionInteranual, type Serie12 } from "@/lib/cadam/panorama-tipos";
import { cn } from "@/lib/utils";
import {
  CambioChip, COLOR_MATRICULACION, EASE, Rotulo, TablaOculta, Tarjeta, techoLindo, tramos, suavizar, trazoDeSerie, useEntrada, useMenosMovimiento, useMontado, useTamano, useTip,
} from "./comun";

export interface PropsMatriculaciones {
  anio: number;
  /** El rango del filtro dentro del año, ya acotado a lo que la fuente publicó. */
  mesDesde: number;
  mesHasta: number;
  /** El filtro pedía más meses de los que CADAM publicó. */
  recorta: boolean;
  sinDatos: boolean;
  valor: number;
  variacion: number | null;
  /** Unidades del mismo período del año anterior. */
  baseValor: number;
  actual: Serie12;
  previa: Serie12;
  /** Lo que significa la cifra y de dónde sale, para el «i». */
  nota: string;
}

const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

/**
 * La tarjeta grande: las matriculaciones del período. Arriba la cifra con su
 * variación; abajo la evolución del año contra el anterior y, debajo, una franja
 * con el cambio de cada mes contra el mismo mes del año pasado (barras hacia
 * arriba si creció, hacia abajo si cayó: la dirección dice el signo, no solo el color).
 */
export function TarjetaMatriculaciones(p: PropsMatriculaciones) {
  const { t, fmt } = useI18n();
  const { formatUnidades, formatPct, etiquetaPeriodo, mesCorto } = fmt;
  const periodo = etiquetaPeriodo(p.anio, p.mesDesde, p.mesHasta);
  const periodoPrevio = etiquetaPeriodo(p.anio - 1, p.mesDesde, p.mesHasta);
  const titulo = p.recorta
    ? t("Matriculaciones (hasta {mes})", { mes: mesCorto(p.mesHasta) })
    : t("Matriculaciones");
  const [raiz, visto] = useEntrada();
  return (
    <Tarjeta ref={raiz} className="flex flex-col md:col-span-2 xl:col-span-7" aria-label={titulo}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <Rotulo>{titulo}</Rotulo>
          <p className="mt-0.5 text-xs text-muted-foreground">{periodo}</p>
        </div>
        <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground" title={p.nota}>
          {t("chapas puestas")}
        </span>
      </div>

      {p.sinDatos ? (
        <p className="mt-6 text-lg font-medium text-muted-foreground">
          {t("{periodo} · todavía sin publicar", { periodo })}
        </p>
      ) : (
        <>
          <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <Cifra como="p" texto={formatUnidades(p.valor)} className="metric text-[2.75rem] text-foreground sm:text-[3.4rem]" />
            {p.variacion !== null && <CambioChip valor={p.variacion} texto={formatPct(p.variacion, { signed: true })} />}
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">
            {t("vs. {periodo}: {n} u.", { periodo: periodoPrevio, n: formatUnidades(p.baseValor) })}
          </p>
        </>
      )}

      <div className="mt-4 min-h-0 flex-1">
        <LineaAnual {...p} activo={visto} />
      </div>
      <FranjaInteranual {...p} activo={visto} />
    </Tarjeta>
  );
}

// ------------------------------------------------------------------ línea del año

function LineaAnual({ anio, mesDesde, mesHasta, actual, previa, activo }: PropsMatriculaciones & { activo: boolean }) {
  const { t, fmt } = useI18n();
  const { formatUnidades, formatPct, mesCorto, mesesLargos } = fmt;
  const tip = useTip();
  const montado = useMontado(activo);
  const reducido = useMenosMovimiento();
  const [ref, { w: W, h: alto }] = useTamano();
  const [hover, setHover] = React.useState<number | null>(null);
  const id = React.useId().replace(/:/g, "");
  const H = Math.max(168, alto);
  const izq = 6, der = 44, arriba = 10, abajo = 24;

  const max = Math.max(1, ...actual.filter((v): v is number => v !== null), ...previa.filter((v): v is number => v !== null));
  const techo = techoLindo(max);
  const paso = (W - izq - der) / 11;
  const x = (i: number) => izq + i * paso;
  const y = (v: number) => arriba + (1 - v / techo) * (H - arriba - abajo);
  const dActual = W ? trazoDeSerie(actual, x, y) : "";
  const dPrevia = W ? trazoDeSerie(previa, x, y) : "";
  const tramosActual = W ? tramos(actual, x, y) : [];
  const ultimo = tramosActual.length ? tramosActual[tramosActual.length - 1].at(-1) : undefined;
  const base = y(0);
  const area = tramosActual
    .map((tr) => `${suavizar(tr)}L${tr[tr.length - 1][0]},${base}L${tr[0][0]},${base}Z`)
    .join(" ");
  const interanual = variacionInteranual(actual, previa);
  const ticks = [0.25, 0.5, 0.75, 1];

  const mover = (e: React.PointerEvent<SVGRectElement>) => {
    const r = e.currentTarget.ownerSVGElement!.getBoundingClientRect();
    const i = Math.max(0, Math.min(11, Math.round((e.clientX - r.left - izq) / paso)));
    setHover(i);
    const filas = [];
    if (actual[i] !== null) filas.push({ etiqueta: String(anio), valor: t("{n} u.", { n: formatUnidades(actual[i]!) }), color: COLOR_MATRICULACION });
    if (previa[i] !== null) filas.push({ etiqueta: String(anio - 1), valor: t("{n} u.", { n: formatUnidades(previa[i]!) }), color: "var(--muted-foreground)" });
    if (interanual[i] !== null) filas.push({ etiqueta: t("Variación"), valor: formatPct(interanual[i], { signed: true }) });
    if (!filas.length) return tip.ocultar();
    tip.mostrar(r.left + x(i), r.top + (actual[i] !== null ? y(actual[i]!) : y(previa[i]!)), { titulo: cap(mesesLargos[i]), filas });
  };

  return (
    <div ref={ref} className="relative h-full min-h-[168px] w-full">
      {W > 0 && (
        <svg width={W} height={H} className="block overflow-visible" role="img" aria-label={t("Matriculaciones por mes, {anio} contra {previo}", { anio, previo: anio - 1 })}>
          <defs>
            <linearGradient id={`${id}a`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" style={{ stopColor: COLOR_MATRICULACION, stopOpacity: 0.24 }} />
              <stop offset="1" style={{ stopColor: COLOR_MATRICULACION, stopOpacity: 0 }} />
            </linearGradient>
          </defs>
          {/* Los meses que componen la cifra de arriba. */}
          <rect
            x={x(mesDesde - 1) - paso / 2} y={arriba - 4}
            width={Math.max(paso, (mesHasta - mesDesde + 1) * paso)} height={H - arriba - abajo + 4}
            rx={6} style={{ fill: "color-mix(in oklab, var(--chart-1) 9%, transparent)" }}
          />
          {ticks.map((k) => (
            <g key={k}>
              <line x1={izq} x2={W - der + 8} y1={y(techo * k)} y2={y(techo * k)} className="stroke-border" strokeWidth={1} />
              <text x={W - 2} y={y(techo * k) + 3.5} textAnchor="end" fontSize={10} className="fill-muted-foreground" style={{ fontFamily: "var(--font-mono)" }}>
                {formatUnidades(techo * k)}
              </text>
            </g>
          ))}
          <line x1={izq} x2={W - der + 8} y1={base} y2={base} className="stroke-border" strokeWidth={1} />
          {Array.from({ length: 12 }, (_, i) => (
            <text key={i} x={x(i)} y={H - 6} textAnchor="middle" fontSize={10} className={cn("fill-muted-foreground", W < 360 && i % 2 === 1 && "hidden")}>
              {mesCorto(i + 1)}
            </text>
          ))}
          {dPrevia && (
            <path d={dPrevia} fill="none" strokeWidth={1.75} strokeDasharray="5 5" strokeLinecap="round" className="stroke-muted-foreground" opacity={0.75} />
          )}
          {area && <path d={area} fill={`url(#${id}a)`} style={{ opacity: montado || reducido ? 1 : 0, transition: reducido ? "none" : "opacity 900ms ease 500ms" }} />}
          {dActual && (
            <path
              d={dActual} fill="none" strokeWidth={2.75} strokeLinecap="round" strokeLinejoin="round" pathLength={1}
              style={{ stroke: COLOR_MATRICULACION, strokeDasharray: 1, strokeDashoffset: montado || reducido ? 0 : 1, transition: reducido ? "none" : `stroke-dashoffset 1300ms ${EASE} 150ms` }}
            />
          )}
          {ultimo && <circle cx={ultimo[0]} cy={ultimo[1]} r={4.5} strokeWidth={2.5} className="stroke-card" style={{ fill: COLOR_MATRICULACION }} />}
          {hover !== null && (
            <g>
              <line x1={x(hover)} x2={x(hover)} y1={arriba} y2={base} className="stroke-muted-foreground/60" strokeWidth={1} />
              {previa[hover] !== null && <circle cx={x(hover)} cy={y(previa[hover]!)} r={4} strokeWidth={2} className="fill-muted-foreground stroke-card" />}
              {actual[hover] !== null && <circle cx={x(hover)} cy={y(actual[hover]!)} r={4.5} strokeWidth={2.5} className="stroke-card" style={{ fill: COLOR_MATRICULACION }} />}
            </g>
          )}
          <rect x={0} y={0} width={W} height={H} fill="transparent" onPointerMove={mover} onPointerLeave={() => { setHover(null); tip.ocultar(); }} />
        </svg>
      )}
      <TablaOculta
        titulo={t("Matriculaciones por mes, {anio} contra {previo}", { anio, previo: anio - 1 })}
        columnas={[t("Mes"), String(anio), String(anio - 1)]}
        filas={Array.from({ length: 12 }, (_, i) => [
          mesCorto(i + 1),
          actual[i] === null ? "—" : formatUnidades(actual[i]!),
          previa[i] === null ? "—" : formatUnidades(previa[i]!),
        ])}
      />
    </div>
  );
}

// ------------------------------------------------------------------ franja interanual

function FranjaInteranual({ anio, mesDesde, mesHasta, actual, previa, activo }: PropsMatriculaciones & { activo: boolean }) {
  const { t, fmt } = useI18n();
  const { formatUnidades, formatPct, mesCorto, mesesLargos } = fmt;
  const tip = useTip();
  const montado = useMontado(activo);
  const reducido = useMenosMovimiento();
  const yoy = variacionInteranual(actual, previa);
  const maximo = Math.max(0.01, ...yoy.map((v) => Math.abs(v ?? 0)));
  const hayAlgo = yoy.some((v) => v !== null);
  if (!hayAlgo) return null;
  const MITAD = 26; // px por lado del eje

  const mostrar = (i: number, el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    tip.mostrar(r.left + r.width / 2, r.top, {
      titulo: `${cap(mesesLargos[i])} ${anio}`,
      filas: [
        { etiqueta: t("contra {previo}", { previo: anio - 1 }), valor: formatPct(yoy[i], { signed: true }) },
        { etiqueta: String(anio), valor: t("{n} u.", { n: formatUnidades(actual[i]!) }) },
        { etiqueta: String(anio - 1), valor: t("{n} u.", { n: formatUnidades(previa[i]!) }) },
      ],
    });
  };

  return (
    <div className="mt-2">
      <p className="mb-1.5 text-[11px] text-muted-foreground">
        {t("Cada barra es un mes contra el mismo mes de {previo}.", { previo: anio - 1 })}
      </p>
      <div className="relative flex items-center gap-[3px]" style={{ height: MITAD * 2 }} onPointerLeave={() => tip.ocultar()}>
        <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-1/2 h-px bg-border" />
        {Array.from({ length: 12 }, (_, i) => {
          const v = yoy[i];
          const enRango = i + 1 >= mesDesde && i + 1 <= mesHasta;
          if (v === null) {
            return <span key={i} aria-hidden="true" className="relative z-10 flex-1" />;
          }
          const alto = Math.max(4, (Math.abs(v) / maximo) * MITAD);
          const sube = v >= 0;
          return (
            <button
              key={i}
              type="button"
              aria-label={`${cap(mesesLargos[i])} ${anio}: ${formatPct(v, { signed: true })}`}
              onPointerEnter={(e) => mostrar(i, e.currentTarget)}
              onFocus={(e) => mostrar(i, e.currentTarget)}
              onBlur={() => tip.ocultar()}
              className="group relative z-10 h-full flex-1 outline-none"
            >
              <span
                aria-hidden="true"
                className={cn(
                  "absolute inset-x-0 rounded-[3px] transition-[height,opacity] group-focus-visible:ring-2 group-focus-visible:ring-ring",
                  sube ? "bg-emerald-600 dark:bg-emerald-400" : "bg-rose-600 dark:bg-rose-400",
                  enRango ? "opacity-90" : "opacity-35",
                  "group-hover:opacity-100"
                )}
                style={{
                  height: montado || reducido ? alto : 3,
                  ...(sube ? { bottom: "50%" } : { top: "50%" }),
                  transitionDuration: reducido ? "0ms" : "800ms",
                  transitionDelay: reducido ? "0ms" : `${i * 35}ms`,
                  transitionTimingFunction: EASE,
                }}
              />
            </button>
          );
        })}
      </div>
      <div aria-hidden="true" className="mt-1 flex justify-between text-[10px] text-muted-foreground">
        <span>{mesCorto(1)}</span>
        <span>{mesCorto(12)}</span>
      </div>
    </div>
  );
}
