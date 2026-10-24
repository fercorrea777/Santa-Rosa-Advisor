"use client";

import * as React from "react";
import { Card } from "@/components/ui/card";
import { useMenosMovimiento } from "@/lib/movimiento";
import { cn } from "@/lib/utils";

/**
 * Piezas compartidas por las tarjetas del Panorama (el bento del Resumen):
 * medir un contenedor, trazar curvas con huecos, el tooltip flotante, el
 * selector de dos o tres opciones y el chip de variación.
 *
 * El bento toma su lenguaje de dos componentes de referencia (un panel de
 * analítica y un tablero de cuentas): tarjetas con una cifra enorme, gráficos
 * de SVG a mano con entrada animada, treemap, radar, ondas, pila de tarjetas.
 * Lo que NO se tomó: datos de relleno que se mueven solos (el «gas» y los
 * «bloques» del original son números aleatorios; acá todo lo que se mueve es un
 * dato real que ya estaba en la pantalla) ni nada que ponga decoración encima del dato.
 */

export const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";

/** Matriculaciones = azul y importaciones = ámbar, en todo el bento. */
export const COLOR_MATRICULACION = "var(--chart-1)";
export const COLOR_IMPORTACION = "var(--chart-4)";

// ---------------------------------------------------------------- medir y montar

/** El ancho y el alto de un contenedor, siguiendo su tamaño. */
export function useTamano<T extends HTMLElement = HTMLDivElement>() {
  const ref = React.useRef<T | null>(null);
  const [tam, setTam] = React.useState({ w: 0, h: 0 });
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      const w = Math.round(e.contentRect.width);
      const h = Math.round(e.contentRect.height);
      setTam((p) => (p.w === w && p.h === h ? p : { w, h }));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, tam] as const;
}

/**
 * false hasta que `activo` es true y pasan dos cuadros: para que lo que entra
 * («crece», «se dibuja») arranque desde su estado inicial y no aparezca ya
 * terminado. `activo` es «la tarjeta ya se ve» (ver useEntrada).
 */
export function useMontado(activo = true): boolean {
  const [on, setOn] = React.useState(false);
  React.useEffect(() => {
    if (!activo) return;
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setOn(true)));
    return () => cancelAnimationFrame(id);
  }, [activo]);
  return on;
}

/**
 * Avisa cuando la tarjeta entra en pantalla (una sola vez). Las tarjetas de
 * abajo del pliegue no animan su gráfico al cargar la página, cuando nadie las
 * ve, sino cuando el scroll las trae. Sin IntersectionObserver, o con una tarjeta
 * ya visible, es true de entrada.
 */
export function useEntrada<T extends HTMLElement = HTMLDivElement>() {
  const ref = React.useRef<T | null>(null);
  const [visto, setVisto] = React.useState(false);
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      const id = requestAnimationFrame(() => setVisto(true));
      return () => cancelAnimationFrame(id);
    }
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setVisto(true);
          io.disconnect();
        }
      },
      { threshold: 0.2 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return [ref, visto] as const;
}

export { useMenosMovimiento };

// ---------------------------------------------------------------- curvas

export type Punto = readonly [number, number];

/** Curva suave (Catmull-Rom convertida a bézier cúbicas) que PASA por cada punto. */
export function suavizar(P: readonly Punto[]): string {
  const n = P.length;
  if (n === 0) return "";
  if (n === 1) return `M${P[0][0]},${P[0][1]}`;
  const g = (i: number) => P[Math.max(0, Math.min(n - 1, i))];
  let d = `M${P[0][0]},${P[0][1]}`;
  for (let i = 0; i < n - 1; i++) {
    const p0 = g(i - 1), p1 = g(i), p2 = g(i + 1), p3 = g(i + 2), k = 0.18;
    d += `C${p1[0] + (p2[0] - p0[0]) * k},${p1[1] + (p2[1] - p0[1]) * k} ${p2[0] - (p3[0] - p1[0]) * k},${p2[1] - (p3[1] - p1[1]) * k} ${p2[0]},${p2[1]}`;
  }
  return d;
}

/**
 * Los tramos continuos de una serie con huecos: una lista de listas de puntos.
 * Un mes sin dato corta la línea en dos; no se une con una recta (sería
 * inventar los meses del medio) ni se baja a cero (sería afirmar que no se vendió
 * nada).
 */
export function tramos(valores: readonly (number | null)[], x: (i: number) => number, y: (v: number) => number): Punto[][] {
  const salida: Punto[][] = [];
  let actual: Punto[] = [];
  valores.forEach((v, i) => {
    if (v === null) {
      if (actual.length) salida.push(actual);
      actual = [];
    } else actual.push([x(i), y(v)]);
  });
  if (actual.length) salida.push(actual);
  return salida;
}

/** El `d` de una serie con huecos: cada tramo suavizado, unidos con «M». */
export function trazoDeSerie(valores: readonly (number | null)[], x: (i: number) => number, y: (v: number) => number): string {
  return tramos(valores, x, y).map(suavizar).join(" ");
}

/** Un techo «lindo» para un eje: 1, 1,2, 1,5, 2, 2,5, 3, 4, 5, 6, 8 o 10 por una potencia de diez. */
export function techoLindo(max: number): number {
  if (max <= 0) return 1;
  const exp = 10 ** Math.floor(Math.log10(max));
  const m = max / exp;
  const paso = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].find((x) => m <= x) ?? 10;
  return paso * exp;
}

// ---------------------------------------------------------------- tooltip

export interface FilaTip {
  etiqueta: string;
  valor: string;
  color?: string;
}
export interface Tip {
  titulo: string;
  filas: FilaTip[];
}
interface ApiTip {
  mostrar: (x: number, y: number, tip: Tip) => void;
  ocultar: () => void;
}
const ContextoTip = React.createContext<ApiTip>({ mostrar: () => {}, ocultar: () => {} });
export const useTip = () => React.useContext(ContextoTip);

/** El proveedor y el globo del tooltip, uno solo para todas las tarjetas. */
export function ProveedorTip({ children }: { children: React.ReactNode }) {
  const [tip, setTip] = React.useState<(Tip & { x: number; y: number }) | null>(null);
  const [pos, setPos] = React.useState({ l: 0, t: 0 });
  const caja = React.useRef<HTMLDivElement | null>(null);
  const api = React.useMemo<ApiTip>(
    () => ({ mostrar: (x, y, t) => setTip({ ...t, x, y }), ocultar: () => setTip(null) }),
    []
  );
  React.useLayoutEffect(() => {
    if (!tip || !caja.current) return;
    const r = caja.current.getBoundingClientRect();
    let l = tip.x + 14;
    let t = tip.y - r.height - 12;
    if (l + r.width > window.innerWidth - 8) l = tip.x - r.width - 14;
    if (t < 8) t = tip.y + 16;
    setPos({ l, t });
  }, [tip]);
  return (
    <ContextoTip.Provider value={api}>
      {children}
      <div
        ref={caja}
        role="tooltip"
        aria-hidden={!tip}
        className={cn(
          "pointer-events-none fixed z-50 whitespace-nowrap rounded-[10px] border border-border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-[0_8px_24px_-12px_oklch(0.2_0.05_260/35%)] transition-opacity duration-150",
          tip ? "opacity-100" : "opacity-0"
        )}
        style={{ left: pos.l, top: pos.t }}
      >
        {tip && (
          <>
            <div className="mb-1 font-medium text-muted-foreground">{tip.titulo}</div>
            {tip.filas.map((f) => (
              <div key={f.etiqueta} className="flex items-center justify-between gap-4">
                <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                  {f.color && <i aria-hidden="true" className="inline-block size-2 rounded-[2px]" style={{ background: f.color }} />}
                  {f.etiqueta}
                </span>
                <b className="font-mono font-semibold tabular-nums">{f.valor}</b>
              </div>
            ))}
          </>
        )}
      </div>
    </ContextoTip.Provider>
  );
}

// ---------------------------------------------------------------- tarjeta y rótulos

/**
 * La tarjeta del bento: la misma del resto del tablero (borde, sombra y radio
 * los pone globals.css sobre `data-slot="card"`), con el aire del bento y
 * sin el relleno vertical que trae `Card`. Entra con la cascada de la página.
 */
export function Tarjeta({
  className,
  children,
  ...rest
}: React.ComponentProps<typeof Card>) {
  return (
    <Card className={cn("min-w-0 gap-0 px-5 py-5 sm:px-6", className)} {...rest}>
      {children}
    </Card>
  );
}

/** El rótulo de una tarjeta: caja baja, apagado; arriba de la cifra. */
export function Rotulo({ children, className }: { children: React.ReactNode; className?: string }) {
  return <h3 className={cn("text-[13px] font-medium leading-snug tracking-[-0.01em] text-muted-foreground", className)}>{children}</h3>;
}

/**
 * El chip de variación: flecha + porcentaje (o puntos). El color acompaña a la
 * flecha y nunca es lo único que dice «sube» o «baja» (DESIGN.md: verde y rojo
 * de texto chico van en el 700 en claro y el 400 en oscuro).
 */
export function CambioChip({
  texto,
  valor,
  className,
  sobreColor = false,
}: {
  texto: string;
  /** Solo el signo importa: >0 sube, <0 baja, 0 o null queda neutro. */
  valor: number | null;
  className?: string;
  /** Sobre un fondo de color (la tarjeta de acento): texto claro en vez de verde/rojo. */
  sobreColor?: boolean;
}) {
  const plano = valor === null || Math.abs(valor) < 0.0005;
  const sube = !plano && valor! > 0;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[13px] font-semibold tabular-nums",
        sobreColor
          ? "bg-black/20 text-inherit dark:bg-white/20"
          : plano
            ? "bg-muted text-muted-foreground"
            : sube
              ? "bg-emerald-500/15 text-emerald-800 dark:text-emerald-400"
              : "bg-rose-500/15 text-rose-800 dark:text-rose-400",
        className
      )}
    >
      <span aria-hidden="true">{plano ? "–" : sube ? "▲" : "▼"}</span>
      {texto}
    </span>
  );
}

// ---------------------------------------------------------------- selector

/**
 * Selector de dos a cuatro opciones, con una pastilla que se desliza de una a
 * otra. Es un grupo de botones con `aria-pressed`: lo que cambia es el contenido
 * de la tarjeta, no una navegación.
 */
export function Selector({
  opciones,
  valor,
  onCambio,
  etiqueta,
  className,
}: {
  opciones: string[];
  valor: number;
  onCambio: (i: number) => void;
  etiqueta: string;
  className?: string;
}) {
  const refs = React.useRef<(HTMLButtonElement | null)[]>([]);
  const [pastilla, setPastilla] = React.useState({ x: 0, w: 0 });
  React.useLayoutEffect(() => {
    const b = refs.current[valor];
    if (b) setPastilla({ x: b.offsetLeft, w: b.offsetWidth });
  }, [valor, opciones]);
  return (
    <div
      role="group"
      aria-label={etiqueta}
      className={cn("relative inline-grid h-8 auto-cols-fr grid-flow-col rounded-[10px] bg-muted p-0.5 pointer-coarse:h-11", className)}
    >
      <span
        aria-hidden="true"
        className="absolute bottom-0.5 left-0.5 top-0.5 rounded-lg bg-background shadow-sm ring-1 ring-border transition-[transform,width] duration-300 motion-reduce:transition-none"
        style={{ width: pastilla.w, transform: `translateX(${pastilla.x - 2}px)`, transitionTimingFunction: EASE }}
      />
      {opciones.map((o, i) => (
        <button
          key={o}
          ref={(el) => {
            refs.current[i] = el;
          }}
          type="button"
          aria-pressed={i === valor}
          onClick={() => onCambio(i)}
          className={cn(
            "relative z-10 whitespace-nowrap rounded-lg px-3 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
            i === valor ? "text-foreground" : "text-muted-foreground hover:text-foreground"
          )}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

/** Tabla solo para lectores de pantalla: lo que el gráfico dibuja, en texto. */
export function TablaOculta({
  titulo,
  columnas,
  filas,
}: {
  titulo: string;
  columnas: string[];
  filas: (string | number)[][];
}) {
  // El `sr-only` va en un div y no en la tabla: una tabla ignora el ancho de
  // 1px y el overflow, así que sus celdas ensanchaban el área desplazable de la
  // tarjeta (invisible, pero real) y el recorte no las contenía.
  return (
    <div className="sr-only">
      <table>
        <caption>{titulo}</caption>
        <thead>
          <tr>
            {columnas.map((c) => (
              <th key={c} scope="col">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((f, i) => (
            <tr key={i}>
              {f.map((c, j) => (j === 0 ? <th key={j} scope="row">{c}</th> : <td key={j}>{c}</td>))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
