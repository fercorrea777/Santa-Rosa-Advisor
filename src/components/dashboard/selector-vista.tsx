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
  anclas = {},
}: {
  vistas: Vista[];
  porDefecto: string;
  anclas?: Record<string, string>;
}) {
  const { leer, setParams, pendiente } = useFiltroUrl();
  const sp = useSearchParams();
  const pathname = usePathname();
  const actual = leer("vista") ?? porDefecto;

  const hrefDe = (valor: string) => {
    const p = new URLSearchParams(sp.toString());
    if (valor === porDefecto) p.delete("vista");
    else p.set("vista", valor);
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
    if (!destino || destino === actual) return;
    setParams({ vista: destino === porDefecto ? null : destino });
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
      <ul role="list" className="flex flex-wrap gap-x-1 border-b border-border">
        {vistas.map((v) => {
          const activa = v.valor === actual;
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
                  if (!activa) setParams({ vista: v.valor === porDefecto ? null : v.valor });
                }}
                className={cn(
                  "relative -mb-px inline-flex h-10 items-center border-b-2 px-3 text-sm font-medium transition-colors",
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
