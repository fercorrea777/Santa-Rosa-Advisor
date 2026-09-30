"use client";

import * as React from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useFiltroUrl } from "@/lib/filtro-url";
import { cn } from "@/lib/utils";

export interface Vista {
  valor: string;
  label: string;
  /** Una línea: qué pregunta contesta esa pestaña. Sale como tooltip. */
  pista?: string;
}

/**
 * Pestañas de una pantalla larga: cada una contesta UNA pregunta.
 *
 * Nace de «Nuestra operación» (30/09/2026, Croman: "todo el dashboard me
 * parece muy desordenado"): eran nueve secciones y 13.000 px en una sola
 * tira — pedido de stock, plan, demanda, sucursales y asesores uno abajo del
 * otro. Partida en pestañas, cada vista entra en dos o tres pantallas.
 *
 * La pestaña vive en la URL (`?vista=`) como los filtros, así el enlace
 * lleva a la misma vista; pero NO es un filtro: «Quitar filtros» no la
 * cuenta ni la borra (ver NO_SON_FILTROS en lib/filtro-url.ts).
 *
 * Son enlaces de verdad —se abren en otra pestaña del navegador, se
 * copian— y el clic común va por la misma transición que los filtros: la
 * vista de antes queda en pantalla hasta que llega la nueva, en vez de la
 * ruedita de carga.
 *
 * `anclas`: enlaces viejos del tipo `/operacion#pedido` apuntan a una
 * sección que ahora vive en otra pestaña. Si la URL trae una de esas
 * anclas, se pasa a su pestaña y se baja hasta la sección.
 */
export function SelectorVista({
  vistas,
  porDefecto,
  actual: actualServidor,
  anclas = {},
  quitar = [],
}: {
  vistas: Vista[];
  porDefecto: string;
  /** La pestaña que resolvió el servidor, cuando la URL no trae `vista`
   *  (un enlace viejo con `?marca=`, por ejemplo). */
  actual?: string;
  anclas?: Record<string, string>;
  /** Parámetros viejos que decidían la vista antes de las pestañas (en
   *  Acciones, `marca`): se sacan al cambiar de pestaña, porque si no el
   *  servidor volvería a leerlos y la pestaña por defecto no se podría elegir. */
  quitar?: string[];
}) {
  const { leer, setParams, pendiente } = useFiltroUrl();
  const sp = useSearchParams();
  const pathname = usePathname();
  const actual = leer("vista") ?? actualServidor ?? porDefecto;
  const cambios = (valor: string) => ({
    vista: valor === porDefecto ? null : valor,
    ...Object.fromEntries(quitar.map((k) => [k, null])),
  });
  const esActual = (valor: string) => valor.toLowerCase() === actual.toLowerCase();

  const hrefDe = (valor: string) => {
    const p = new URLSearchParams(sp.toString());
    if (valor === porDefecto) p.delete("vista");
    else p.set("vista", valor);
    for (const k of quitar) p.delete(k);
    const q = p.toString();
    return q ? `${pathname}?${q}` : pathname;
  };

  // Ancla vieja → su pestaña. Una sola vez, al llegar.
  const resuelta = React.useRef(false);
  React.useEffect(() => {
    if (resuelta.current) return;
    resuelta.current = true;
    const ancla = window.location.hash.slice(1);
    const destino = ancla ? anclas[ancla] : undefined;
    if (!destino || esActual(destino)) return;
    setParams(cambios(destino));
    // La sección aparece cuando llega la vista nueva: se espera a que esté.
    let intentos = 0;
    const buscar = window.setInterval(() => {
      const el = document.getElementById(ancla);
      if (el || ++intentos > 40) {
        window.clearInterval(buscar);
        el?.scrollIntoView({ block: "start" });
      }
    }, 150);
    return () => window.clearInterval(buscar);
    // Solo al montar: después la pestaña la maneja el usuario.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <nav aria-label="Vistas de la pantalla" aria-busy={pendiente} data-revelar="">
      {/* Una sola fila siempre: en el celular se desliza de lado en vez de
          partirse en dos renglones (una pestaña suelta abajo parecía otra
          cosa). */}
      {/* La línea de base es una sombra interior y no un borde: con
          overflow-x la pestaña activa no puede montarse sobre un borde de
          afuera (-mb-px se recorta), y la sombra queda debajo de su
          subrayado. */}
      <ul role="list" className="flex gap-x-1 overflow-x-auto overscroll-x-contain shadow-[inset_0_-1px_0_var(--border)] [scrollbar-width:none]">
        {vistas.map((v) => {
          const activa = esActual(v.valor);
          return (
            <li key={v.valor}>
              <a
                href={hrefDe(v.valor)}
                aria-current={activa ? "page" : undefined}
                title={v.pista}
                onClick={(e) => {
                  // Ctrl/Cmd/Shift/rueda: que el navegador haga lo suyo
                  // (otra pestaña, otra ventana).
                  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
                  e.preventDefault();
                  if (!activa) setParams(cambios(v.valor));
                }}
                className={cn(
                  "relative inline-flex h-10 items-center whitespace-nowrap border-b-2 px-2.5 text-sm font-medium transition-colors sm:px-3",
                  "focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
                  activa
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
                  activa && pendiente && "animate-pulse"
                )}
              >
                {v.label}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
