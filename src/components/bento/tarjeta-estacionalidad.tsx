"use client";

import * as React from "react";
import { Cifra } from "@/components/movimiento/cifra";
import { useI18n } from "@/lib/i18n/cliente";
import type { AnioEstacional } from "@/lib/cadam/panorama-tipos";
import { COLOR_MATRICULACION, Rotulo, Selector, TablaOculta, Tarjeta, suavizar, useEntrada, useMenosMovimiento, useTamano, useTip, type Punto } from "./comun";

export interface PropsEstacionalidad {
  /** De más viejo a más nuevo. */
  anios: AnioEstacional[];
}

const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

/** Curva suave y CERRADA por los puntos (el radar de un año completo): la última une con la primera. */
function suavizarCerrada(P: readonly Punto[]): string {
  const n = P.length;
  if (n < 3) return suavizar(P);
  const g = (i: number) => P[((i % n) + n) % n];
  let d = `M${P[0][0]},${P[0][1]}`;
  for (let i = 0; i < n; i++) {
    const p0 = g(i - 1), p1 = g(i), p2 = g(i + 1), p3 = g(i + 2), k = 0.18;
    d += `C${p1[0] + (p2[0] - p0[0]) * k},${p1[1] + (p2[1] - p0[1]) * k} ${p2[0] - (p3[0] - p1[0]) * k},${p2[1] - (p3[1] - p1[1]) * k} ${p2[0]},${p2[1]}`;
  }
  return d + "Z";
}

/**
 * La estacionalidad: la forma del año. Cada eje es un mes y la distancia al
 * centro, las unidades; todos los años comparten la misma escala, así que al
 * cambiar de año el dibujo crece o se encoge de verdad. La curva pasa por los
 * puntos reales (no es un ajuste): en un año a medias solo se dibujan los meses
 * publicados.
 */
export function TarjetaEstacionalidad({ anios }: PropsEstacionalidad) {
  const { t, fmt } = useI18n();
  const { formatUnidades, mesCorto, mesesLargos } = fmt;
  const tip = useTip();
  const reducido = useMenosMovimiento();
  const [raiz, visto] = useEntrada();
  const [i, setI] = React.useState(Math.max(0, anios.length - 1));
  const sel = anios[Math.min(i, anios.length - 1)];
  const conDato = sel ? sel.valores.filter((v) => v !== null).length : 0;
  const [ref, { w }] = useTamano();
  const [hover, setHover] = React.useState<number | null>(null);
  const linea = React.useRef<SVGPathElement | null>(null);
  const relleno = React.useRef<SVGPathElement | null>(null);
  const mostrado = React.useRef<(number | null)[]>(Array(12).fill(0));

  const S = Math.max(0, Math.min(w, 380));
  const R = S / 2 - 34;
  const C = S / 2;
  const interior = R * 0.2;
  const max = Math.max(1, ...anios.flatMap((a) => a.valores.filter((v): v is number => v !== null)));
  const angulo = (k: number) => -Math.PI / 2 + (k / 12) * Math.PI * 2;
  const punto = React.useCallback(
    (k: number, v: number): Punto => {
      const r = interior + (v / max) * (R - interior);
      return [C + Math.cos(angulo(k)) * r, C + Math.sin(angulo(k)) * r];
    },
    [C, R, interior, max]
  );

  const dibujar = React.useCallback(
    (valores: (number | null)[]) => {
      const completo = valores.every((v) => v !== null);
      let d: string;
      let a: string;
      if (completo) {
        d = suavizarCerrada(valores.map((v, k) => punto(k, v as number)));
        a = d;
      } else {
        const tr: Punto[][] = [];
        let actual: Punto[] = [];
        valores.forEach((v, k) => {
          if (v === null) {
            if (actual.length) tr.push(actual);
            actual = [];
          } else actual.push(punto(k, v));
        });
        if (actual.length) tr.push(actual);
        d = tr.map(suavizar).join(" ");
        a = tr.map((q) => `${suavizar(q)}L${C},${C}Z`).join(" ");
      }
      linea.current?.setAttribute("d", d);
      relleno.current?.setAttribute("d", a);
    },
    [punto, C]
  );

  // Al cambiar de año el dibujo se mueve del anterior al nuevo (una sola vez).
  React.useEffect(() => {
    if (!S || !sel || !visto) return;
    const hacia = sel.valores;
    const desde = mostrado.current.map((v, k) => (v === null ? (hacia[k] === null ? null : 0) : v));
    if (reducido) {
      mostrado.current = [...hacia];
      dibujar(hacia);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const cuadro = (ahora: number) => {
      const k = Math.min(1, (ahora - t0) / 800);
      const e = 1 - Math.pow(1 - k, 3);
      const actual = hacia.map((v, j) => (v === null ? null : (desde[j] ?? 0) + (v - (desde[j] ?? 0)) * e));
      mostrado.current = actual;
      dibujar(actual);
      if (k < 1) raf = requestAnimationFrame(cuadro);
    };
    raf = requestAnimationFrame(cuadro);
    return () => cancelAnimationFrame(raf);
  }, [sel, S, visto, dibujar, reducido]);

  if (!sel) return null;

  const mover = (e: React.PointerEvent<SVGRectElement>) => {
    const r = e.currentTarget.ownerSVGElement!.getBoundingClientRect();
    const x = e.clientX - r.left - C;
    const y = e.clientY - r.top - C;
    if (Math.hypot(x, y) < interior * 0.6) {
      setHover(null);
      tip.ocultar();
      return;
    }
    let a = Math.atan2(y, x) + Math.PI / 2;
    if (a < 0) a += Math.PI * 2;
    const k = Math.round((a / (Math.PI * 2)) * 12) % 12;
    setHover(k);
    const v = sel.valores[k];
    if (v === null) return tip.ocultar();
    const p = punto(k, v);
    tip.mostrar(r.left + p[0], r.top + p[1], {
      titulo: `${cap(mesesLargos[k])} ${sel.anio}`,
      filas: [
        { etiqueta: t("Unidades"), valor: formatUnidades(v), color: COLOR_MATRICULACION },
        { etiqueta: t("Contra el promedio del año"), valor: `${v >= sel.promedio ? "+" : ""}${fmt.decimal(((v / sel.promedio) - 1) * 100, 0)}%` },
      ],
    });
  };
  const hp = hover !== null && sel.valores[hover] !== null ? punto(hover, sel.valores[hover]!) : null;
  const parcial = sel.hasta < 12;

  return (
    <Tarjeta ref={raiz} className="md:col-span-2 xl:col-span-8" aria-label={t("Estacionalidad")}>
      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <Rotulo>{t("Estacionalidad de las matriculaciones")}</Rotulo>
          <p className="mt-0.5 text-xs text-muted-foreground">{t("Qué meses del año se vende más. Misma escala para todos los años.")}</p>
        </div>
        <Selector etiqueta={t("Año")} opciones={anios.map((a) => String(a.anio))} valor={Math.min(i, anios.length - 1)} onCambio={setI} />
      </div>

      <div className="mt-4 flex flex-col items-center gap-6 lg:flex-row lg:items-center lg:gap-10">
        <div ref={ref} className="mx-auto w-full max-w-[380px] shrink-0 lg:mx-0" style={{ height: S || 300 }}>
          {S > 0 && (
            <svg width={S} height={S} className="mx-auto block" role="img" aria-label={t("Matriculaciones por mes, {anio}", { anio: sel.anio })}>
              {[1 / 3, 2 / 3, 1].map((k) => (
                <circle key={k} cx={C} cy={C} r={interior + k * (R - interior)} fill="none" className="stroke-border" strokeWidth={1} />
              ))}
              <text x={C + 5} y={C - R + 12} fontSize={9.5} className="fill-muted-foreground" style={{ fontFamily: "var(--font-mono)" }}>
                {formatUnidades(max)}
              </text>
              {Array.from({ length: 12 }, (_, k) => (
                <g key={k}>
                  <line x1={C + Math.cos(angulo(k)) * interior} y1={C + Math.sin(angulo(k)) * interior} x2={C + Math.cos(angulo(k)) * R} y2={C + Math.sin(angulo(k)) * R} className="stroke-border" strokeWidth={1} />
                  <text x={C + Math.cos(angulo(k)) * (R + 17)} y={C + Math.sin(angulo(k)) * (R + 17)} textAnchor="middle" dominantBaseline="central" fontSize={11} className="fill-muted-foreground">
                    {mesCorto(k + 1)}
                  </text>
                </g>
              ))}
              <path ref={relleno} style={{ fill: COLOR_MATRICULACION, fillOpacity: 0.16 }} />
              <path ref={linea} fill="none" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" style={{ stroke: COLOR_MATRICULACION }} />
              <circle cx={C} cy={C} r={interior} className="fill-card stroke-border" strokeWidth={1} />
              <text x={C} y={C} textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={700} className="fill-foreground" style={{ fontFamily: "var(--font-mono)" }}>
                {sel.anio}
              </text>
              {hp && <circle cx={hp[0]} cy={hp[1]} r={4.5} strokeWidth={2.5} className="stroke-card" style={{ fill: COLOR_MATRICULACION }} />}
              <rect width={S} height={S} fill="transparent" onPointerMove={mover} onPointerLeave={() => { setHover(null); tip.ocultar(); }} />
            </svg>
          )}
          <TablaOculta
            titulo={t("Matriculaciones por mes, {anio}", { anio: sel.anio })}
            columnas={[t("Mes"), t("Unidades")]}
            filas={sel.valores.map((v, k) => [mesCorto(k + 1), v === null ? "—" : formatUnidades(v)])}
          />
        </div>

        <div className="grid w-full min-w-0 flex-1 grid-cols-2 gap-x-6 gap-y-5">
          {sel.pico && (
            <Dato titulo={t("Mes pico")} valor={formatUnidades(sel.pico.valor)} nota={cap(mesesLargos[sel.pico.mes - 1])} />
          )}
          {sel.valle && (
            <Dato titulo={t("Mes más bajo")} valor={formatUnidades(sel.valle.valor)} nota={cap(mesesLargos[sel.valle.mes - 1])} />
          )}
          <Dato titulo={t("Promedio mensual")} valor={formatUnidades(Math.round(sel.promedio))} nota={conDato === 1 ? t("1 mes con dato") : t("{n} meses con dato", { n: conDato })} />
          <Dato titulo={parcial ? t("Total hasta {mes}", { mes: mesCorto(sel.hasta) }) : t("Total del año")} valor={formatUnidades(sel.total)} nota={String(sel.anio)} />
          <div className="col-span-2 border-t border-border pt-3">
            {sel.trimestres.map((q, k) => (
              <div key={k} className="flex items-center justify-between border-b border-border/60 py-2 text-sm last:border-b-0">
                <span className="text-muted-foreground">{t("Trimestre {n}", { n: k + 1 })} <span className="text-xs">({mesCorto(k * 3 + 1)}–{mesCorto(k * 3 + 3)})</span></span>
                <span className="font-mono font-semibold tabular-nums">{q === null ? "—" : formatUnidades(q)}</span>
              </div>
            ))}
            {parcial && (
              <p className="mt-2 text-xs text-muted-foreground">
                {t("{anio} llega hasta {mes}: los meses que faltan no se dibujan ni se cuentan.", { anio: sel.anio, mes: cap(mesesLargos[sel.hasta - 1]) })}
              </p>
            )}
          </div>
        </div>
      </div>
    </Tarjeta>
  );
}

function Dato({ titulo, valor, nota }: { titulo: string; valor: string; nota: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[13px] text-muted-foreground">{titulo}</p>
      <Cifra como="p" texto={valor} className="metric mt-1.5 text-[1.7rem] text-foreground" />
      <p className="mt-1 truncate text-xs text-muted-foreground">{nota}</p>
    </div>
  );
}
