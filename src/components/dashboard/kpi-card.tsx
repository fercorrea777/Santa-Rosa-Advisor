"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/cliente";
import { Cifra } from "@/components/movimiento/cifra";
import { IconBrecha, IconEvolucion, IconMarketShare, IconSegmentos } from "@/components/icons";

// Mapa de key serializable -> componente, resuelto DENTRO de este Client
// Component. KpiCard vive en páginas Server (Inicio) — pasarle el
// componente de ícono directamente como prop rompe con "Functions cannot
// be passed directly to Client Components" (ya nos pasó una vez con
// formatearAnimado; el mismo límite aplica a cualquier función/componente).
const CHIP_ICONOS = {
  segmentos: IconSegmentos,
  evolucion: IconEvolucion,
  "market-share": IconMarketShare,
  brecha: IconBrecha,
} as const;
type ChipIconoKey = keyof typeof CHIP_ICONOS;

interface KpiCardProps {
  label: string;
  value: string;
  periodo?: string;
  variacion?: number | null;
  /** Cambio en PUNTOS PORCENTUALES (0,004 = «+0,4 pp»), para las cifras que ya
   *  son un porcentaje: la participación sube o baja en puntos, no «en %». Se
   *  usa en lugar de `variacion`; si vienen las dos, manda `variacion`. */
  variacionPp?: number | null;
  tooltip?: string;
  disponible?: boolean;
  /** Número crudo, formateado acá según `formato`. Es de antes de que
   *  <Cifra> supiera contar a partir del texto formateado: hoy `value` solo
   *  ya cuenta igual, y esto queda como atajo para no formatear en la
   *  página. Las dos vías terminan en la misma cifra animada.
   *
   *  Es un enum (no una funcion) a proposito: este componente es
   *  "use client" y `value`/`valorAnimado`/etc. suelen venir de un Server
   *  Component (paginas como Inicio) — una funcion no se puede pasar como
   *  prop a traves de ese limite (React no la puede serializar). */
  valorAnimado?: number;
  formato?: "unidades" | "porcentaje";
  /** Serie mensual opcional (12 posiciones, null = sin dato) para dibujar
   *  una sparkline al pie de la tarjeta. Contexto de tendencia de un
   *  vistazo, sin ejes ni tooltip: para el detalle está el gráfico grande. */
  serie?: (number | null)[];
  /** Tinte bento por familia de dato (ver globals.css): azul matriculación,
   *  verde importación, ámbar tecnología, tinta para el destacado. Sin tono
   *  la tile queda blanca/neutra. */
  tono?: "azul" | "verde" | "ambar" | "tinta";
  /** Chip de ícono (referencia 2026-07): cuadrado de color pastel con un
   *  ícono del set propio, para las tiles que NO llevan `tono` (tile
   *  blanca) — un tile ya teñido no necesita chip encima. */
  chipIcono?: ChipIconoKey;
  chipTono?: "violet" | "mint" | "amber" | "pink";
}

export function KpiCard({
  label,
  value,
  periodo,
  variacion,
  variacionPp,
  tooltip,
  disponible = true,
  valorAnimado,
  formato,
  serie,
  tono,
  chipIcono,
  chipTono,
}: KpiCardProps) {
  const { t, fmt } = useI18n();
  const { formatPct, formatPuntosPct, formatUnidades } = fmt;
  const FORMATEADORES: Record<NonNullable<KpiCardProps["formato"]>, (n: number) => string> = {
    unidades: formatUnidades,
    porcentaje: (n) => formatPct(n),
  };
  const ChipIcono = chipIcono ? CHIP_ICONOS[chipIcono] : undefined;
  // El conteo lo hace <Cifra> sobre el texto final: acá solo se decide qué
  // texto es.
  const valorMostrado = valorAnimado !== undefined
    ? (formato ? FORMATEADORES[formato](valorAnimado) : String(valorAnimado))
    : value;
  if (!disponible) {
    return (
      <Card className="w-full gap-2 py-4">
        <CardHeader className="flex flex-row items-center justify-between gap-2 px-4">
          <span className="text-[0.7rem] font-semibold uppercase tracking-[0.07em] text-muted-foreground">
            {label}
          </span>
          {tooltip && <InfoTip text={tooltip} />}
        </CardHeader>
        <CardContent className="px-4">
          <p className="text-lg font-medium text-muted-foreground">{t("Sin datos cargados")}</p>
          <p className="text-xs text-muted-foreground">{t("Pendiente de ingesta")}</p>
        </CardContent>
      </Card>
    );
  }

  // Un solo chip de cambio: porcentaje (unidades) o puntos (participación).
  const textoCambio =
    variacion !== undefined && variacion !== null
      ? formatPct(variacion, { signed: true })
      : variacionPp !== undefined && variacionPp !== null
        ? formatPuntosPct(variacionPp)
        : null;
  const valorCambio = variacion ?? variacionPp ?? 0;
  // Menos de 0,05 de cambio se muestra como «+0,0»: ni sube ni baja, y el
  // verde o el rojo ahí serían una señal que el dato no tiene.
  const plano = Math.abs(valorCambio) < 0.0005;
  const isUp = !plano && valorCambio > 0;
  const isDown = !plano && valorCambio < 0;
  const sinBase = variacion === null || (variacion === undefined && variacionPp === null);

  return (
    <Card className={cn("group/kpi w-full gap-2 py-4", tono && `tile-${tono}`)}>
      {/* sm:min-h reserva dos renglones de rótulo: con uno de una línea y otro
          de dos en la misma fila, las cifras quedaban a alturas distintas y
          no se comparaban de un vistazo. */}
      <CardHeader className="flex flex-row items-start justify-between gap-2 px-4 sm:min-h-[2.4rem]">
        <div className="flex min-w-0 items-center gap-3">
          {ChipIcono && (
            <span className={`chip-${chipTono ?? "violet"}`}>
              <ChipIcono size={18} />
            </span>
          )}
          <span className="min-w-0 text-[0.7rem] font-semibold uppercase leading-[1.35] tracking-[0.07em] text-muted-foreground">
            {label}
          </span>
        </div>
        {tooltip && <InfoTip text={tooltip} />}
      </CardHeader>
      {/* flex-1 + mt-auto en la fila secundaria: en una grilla con tarjetas
          de distinta altura (con y sin sparkline) la línea de contexto queda
          anclada al fondo en todas — sin vacíos asimétricos. */}
      <CardContent className="flex flex-1 flex-col px-4">
        {/* El peso lo fija .metric (700); no agregar font-* aca o lo pisa. */}
        <Cifra como="p" texto={valorMostrado} className="metric text-[2rem] text-foreground" />
        <div className="mt-auto flex flex-wrap items-center gap-x-2 gap-y-1 pt-2">
          {textoCambio !== null ? (
            <span
              className={cn(
                // Fondo tenue del propio color: la variacion se lee de lejos
                // sin que el numero principal pierda protagonismo. El texto va
                // en el 700 y no en el 600: a 12 px sobre el tinte, el 600 del
                // verde no llega a 4,5:1.
                "inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-xs font-semibold tabular-nums",
                // Sobre la tile tinta (navy) el 700 se pierde: ahí van los tonos claros.
                // Sobre una tile teñida (azul, verde, ámbar) el 700 daba 3,9:1: el 800.
                isUp && (tono === "tinta"
                  ? "bg-emerald-400/15 text-emerald-300"
                  : tono
                    ? "bg-emerald-700/12 text-emerald-800 dark:bg-emerald-500/12 dark:text-emerald-400"
                    : "bg-emerald-500/12 text-emerald-700 dark:text-emerald-400"),
                isDown && (tono === "tinta"
                  ? "bg-rose-400/15 text-rose-300"
                  : tono
                    ? "bg-rose-700/12 text-rose-800 dark:bg-rose-500/12 dark:text-rose-400"
                    : "bg-rose-500/12 text-rose-700 dark:text-rose-400"),
                !isUp && !isDown && (tono === "tinta" ? "bg-white/10 text-white/70" : "bg-muted text-muted-foreground")
              )}
            >
              <span aria-hidden="true">{isUp ? "▲" : isDown ? "▼" : "–"}</span>
              {textoCambio}
            </span>
          ) : sinBase ? (
            <span className="text-xs text-muted-foreground">{t("Sin base comparativa")}</span>
          ) : null}
          {periodo && <span className="text-xs text-muted-foreground">{periodo}</span>}
        </div>
        {serie && <Sparkline serie={serie} />}
      </CardContent>
    </Card>
  );
}

/** Mini-tendencia SVG al pie del KPI. Puro y sin dependencias: normaliza los
 *  valores al alto disponible y traza línea + área con el acento. Los meses
 *  sin dato (null) simplemente no aportan punto — igual criterio que los
 *  gráficos grandes: un hueco, nunca un cero inventado. */
function Sparkline({ serie }: { serie: (number | null)[] }) {
  const puntos = serie
    .map((v, i) => ({ v, i }))
    .filter((p): p is { v: number; i: number } => p.v !== null);
  if (puntos.length < 2) return null;

  const W = 100;
  const H = 26;
  const min = Math.min(...puntos.map((p) => p.v));
  const max = Math.max(...puntos.map((p) => p.v));
  const rango = max - min || 1;
  const x = (i: number) => (i / (serie.length - 1)) * W;
  const y = (v: number) => H - 3 - ((v - min) / rango) * (H - 6);
  const linea = puntos.map((p, k) => `${k === 0 ? "M" : "L"}${x(p.i).toFixed(1)} ${y(p.v).toFixed(1)}`).join(" ");
  const area = `${linea} L${x(puntos[puntos.length - 1].i).toFixed(1)} ${H} L${x(puntos[0].i).toFixed(1)} ${H} Z`;
  const ultimo = puntos[puntos.length - 1];

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      className="mt-3 h-7 w-full opacity-90"
    >
      <path d={area} fill="var(--sparkline-color, var(--primary))" opacity="0.13" />
      <path d={linea} fill="none" stroke="var(--sparkline-color, var(--primary))" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
      <circle cx={x(ultimo.i)} cy={y(ultimo.v)} r="2.4" fill="var(--sparkline-color, var(--primary))" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function InfoTip({ text }: { text: string }) {
  return (
    <Tooltip>
      {/* El circulo visible se queda en 14px (asi lee la cabecera de la
          card, no hay lugar para un botón de 44px sin romper la densidad).
          El area tocable si tiene que llegar a 44x44 — la agranda un
          pseudo-elemento invisible, no el circulo. aria-label repite el
          contenido del tooltip: sin esto un lector de pantalla solo
          anuncia "botón, signo de interrogación". */}
      <TooltipTrigger
        aria-label={text}
        className="relative flex size-3.5 shrink-0 items-center justify-center rounded-full border border-muted-foreground/60 bg-transparent p-0 text-[9px] font-bold leading-none text-muted-foreground before:absolute before:-inset-[15px] before:content-['']"
      >
        ?
      </TooltipTrigger>
      <TooltipContent className="max-w-64 text-xs">{text}</TooltipContent>
    </Tooltip>
  );
}
