"use client";

import * as React from "react";
import { LogoMarca } from "@/components/dashboard/logo-marca";
import { useI18n } from "@/lib/i18n/cliente";
import { useFiltroUrl } from "@/lib/filtro-url";
import type { MarcaPropia } from "@/lib/cadam/panorama-tipos";
import { cn } from "@/lib/utils";
import { caraDeMarca } from "./colores";
import { CambioChip, EASE, Rotulo, Tarjeta, useEntrada, useMenosMovimiento, useMontado, useTamano } from "./comun";

export interface PropsMarcas {
  marcas: MarcaPropia[];
  /** Cuántas marcas nuestras vendieron en el período (puede ser más que las que se dibujan). */
  totalConVentas: number;
  fuente: "matriculacion" | "importacion";
  periodoPrevio: string;
}

const PEEK = 44;
const PROPORCION = 0.56;

/**
 * Nuestras marcas como una pila de tarjetas: la que más vende al frente y las
 * demás asomando atrás. Un clic trae una al frente y el panel de abajo dice lo
 * suyo (unidades, participación, puesto, variación); desde ahí se filtra toda la
 * pantalla por esa marca. Nada se mueve solo: la pila solo cambia cuando la
 * tocás.
 */
export function TarjetaMarcas({ marcas, totalConVentas, fuente, periodoPrevio }: PropsMarcas) {
  const { t, fmt } = useI18n();
  const { formatUnidades, formatPct, nombreDeMarca } = fmt;
  const [raiz, visto] = useEntrada();
  const montado = useMontado(visto);
  const reducido = useMenosMovimiento();
  const { leer, alternar } = useFiltroUrl();
  const [ref, { w }] = useTamano();
  // De atrás para adelante: el último es el que se ve entero.
  const [orden, setOrden] = React.useState(() => marcas.map((m) => m.marca).reverse());
  // Si el filtro cambia las marcas, la pila se arma de nuevo con las nuevas.
  const clave = marcas.map((m) => m.marca).join("|");
  const [claveVista, setClaveVista] = React.useState(clave);
  if (claveVista !== clave) {
    setClaveVista(clave);
    setOrden(marcas.map((m) => m.marca).reverse());
  }

  const porMarca = new Map(marcas.map((m) => [m.marca, m]));
  // En el cuadro en que cambia el filtro, `orden` todavía es el de antes (se corrige en el re-render que React
  // hace enseguida): solo se dibujan las marcas que existen ahora.
  const pila = orden.filter((m) => porMarca.has(m));
  const profundidad = Math.max(0, pila.length - 1);
  const alto = Math.round(Math.max(150, w * PROPORCION));
  const frente = porMarca.get(pila[pila.length - 1]);
  const filtrada = frente ? leer("marca") === frente.marca : false;

  return (
    <Tarjeta ref={raiz} className="flex flex-col md:col-span-1 xl:col-span-4" aria-label={t("Nuestras marcas")}>
      <div className="flex items-start justify-between gap-3">
        <Rotulo>{t("Nuestras marcas")}</Rotulo>
        {totalConVentas > 0 && (
          <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
            {marcas.length < totalConVentas
              ? t("{n} de {total}", { n: marcas.length, total: totalConVentas })
              : t("{n} marcas", { n: totalConVentas })}
          </span>
        )}
      </div>

      {!frente ? (
        <p className="mt-6 text-sm text-muted-foreground">{t("Ninguna de nuestras marcas vendió en este filtro.")}</p>
      ) : (
        <>
          <p className="mt-0.5 text-xs text-muted-foreground">{t("Tocá una tarjeta para traerla al frente.")}</p>
          <div ref={ref} className="relative mb-4 mt-4" style={{ height: profundidad * PEEK + alto }}>
            {pila.map((marca, pos) => {
              const m = porMarca.get(marca)!;
              const desdeFrente = pila.length - 1 - pos;
              const esFrente = desdeFrente === 0;
              return (
                <button
                  key={marca}
                  type="button"
                  aria-pressed={esFrente}
                  aria-label={
                    esFrente
                      ? t("{marca}, al frente", { marca: nombreDeMarca(marca) })
                      : t("Traer {marca} al frente", { marca: nombreDeMarca(marca) })
                  }
                  onClick={() => !esFrente && setOrden((o) => [...o.filter((x) => x !== marca), marca])}
                  className={cn(
                    "absolute left-0 right-0 block rounded-[14px] p-0 text-left text-white outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card",
                    esFrente ? "cursor-default" : "cursor-pointer"
                  )}
                  style={{
                    top: (profundidad - desdeFrente) * PEEK,
                    height: alto,
                    zIndex: pos + 1,
                    transform: `scale(${1 - desdeFrente * 0.04}) translateY(${montado || reducido ? 0 : 18}px)`,
                    transformOrigin: "top center",
                    opacity: montado || reducido ? 1 : 0,
                    background: caraDeMarca(marca),
                    boxShadow: "0 -8px 22px -14px oklch(0 0 0 / 0.7), inset 0 1px 0 oklch(1 0 0 / 0.22), inset 0 0 0 1px oklch(1 0 0 / 0.1)",
                    transition: reducido
                      ? "none"
                      : `top 560ms ${EASE}, transform 560ms ${EASE}, opacity 450ms ease ${pos * 80}ms`,
                  }}
                >
                  <span className="absolute inset-0 flex flex-col justify-between p-3.5">
                    <span className="flex items-center justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-2.5">
                        <LogoMarca marca={marca} tamano="sm" />
                        <span className="truncate text-[13px] font-bold tracking-wide">{nombreDeMarca(marca)}</span>
                      </span>
                      <span className="shrink-0 font-mono text-xs font-semibold tabular-nums" title={t("Puesto en el ranking de marcas")}>
                        #{m.posicion}
                      </span>
                    </span>
                    <span className="flex items-end justify-between gap-2">
                      <span className="font-mono text-[1.65rem] font-bold leading-none tracking-[-0.03em] tabular-nums">
                        {formatUnidades(m.unidades)}
                        <span className="ml-1 text-xs font-medium opacity-80">{t("u.")}</span>
                      </span>
                      <span className="rounded-full bg-white/15 px-2 py-0.5 font-mono text-xs font-semibold tabular-nums">
                        {formatPct(m.participacion)}
                      </span>
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-auto rounded-xl border border-border bg-muted/40 p-3 pt-3" aria-live="polite">
            <div className="flex items-center justify-between gap-3">
              <p className="min-w-0 truncate text-sm font-semibold">{nombreDeMarca(frente.marca)}</p>
              {frente.variacion !== null ? (
                <CambioChip valor={frente.variacion} texto={formatPct(frente.variacion, { signed: true })} />
              ) : (
                <span className="text-xs text-muted-foreground">{t("Nueva en el período")}</span>
              )}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {fuente === "importacion"
                ? t("{participacion} de las importaciones · puesto #{puesto}", { participacion: formatPct(frente.participacion), puesto: frente.posicion })
                : t("{participacion} de las matriculaciones · puesto #{puesto}", { participacion: formatPct(frente.participacion), puesto: frente.posicion })}
              {frente.variacion !== null && ` · ${t("vs. {periodo}: {n} u.", { periodo: periodoPrevio, n: formatUnidades(frente.unidadesAnterior) })}`}
            </p>
            <button
              type="button"
              onClick={() => alternar("marca", frente.marca)}
              aria-pressed={filtrada}
              className="mt-2.5 inline-flex h-8 w-full items-center justify-center rounded-lg border border-border bg-card text-xs font-semibold outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:h-11"
            >
              {filtrada ? t("Quitar el filtro de {marca}", { marca: nombreDeMarca(frente.marca) }) : t("Filtrar la pantalla por {marca}", { marca: nombreDeMarca(frente.marca) })}
            </button>
          </div>
        </>
      )}
    </Tarjeta>
  );
}
