"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * Todos los filtros del tablero, con la misma mecánica.
 *
 * POR QUÉ EXISTE ESTE HOOK. Los filtros viven en la URL (así son
 * compartibles, sobreviven al refresh y el Server Component vuelve a
 * consultar la base). El problema es que la URL recién cambia cuando ese
 * Server Component termina de consultar y vuelve: medio segundo largo en
 * Operación. Y como cada control leía su valor de la URL, en ese medio
 * segundo seguía mostrando el valor viejo. El reclamo, textual, fue que los
 * filtros «no se quedan quietos»: elegías HAVAL y el desplegable volvía solo
 * a «Todos». El filtro SÍ se aplicaba; no se veía aplicado.
 *
 * `tentativo` guarda lo que se acaba de elegir y manda sobre la URL hasta que
 * la URL trae lo mismo. El `useTransition` da el pendiente para poder mostrar
 * que está trabajando.
 *
 * Estaba resuelto en dos componentes y roto en otros siete —los selectores de
 * año, fuente y dimensión, y los tres gráficos que filtran al hacer clic—.
 * Por eso vive acá: un solo lugar donde arreglarlo.
 */
export function useFiltroUrl() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const [tentativo, setTentativo] = React.useState<Record<string, string | null>>({});
  const [pendiente, iniciar] = React.useTransition();

  const clave = sp.toString();
  React.useEffect(() => {
    setTentativo((t) => {
      // Solo se sueltan las claves que la URL ya alcanzó. Si alguien mueve dos
      // filtros seguidos, la vuelta del primero no puede borrar la elección
      // del segundo, que todavía está viajando.
      const quedan: Record<string, string | null> = {};
      for (const [k, v] of Object.entries(t)) {
        if (sp.get(k) !== v) quedan[k] = v;
      }
      return Object.keys(quedan).length === Object.keys(t).length ? t : quedan;
    });
    // `clave` es la URL serializada: cambia exactamente cuando hay que revisar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave]);

  /** El valor del filtro contando el clic que todavía viaja. */
  const leer = React.useCallback(
    (param: string): string | null =>
      param in tentativo ? tentativo[param] : sp.get(param),
    [tentativo, sp]
  );

  /** Igual que `leer`, para los filtros numéricos. */
  const leerNum = React.useCallback(
    (param: string, porDefecto: number): number => Number(leer(param)) || porDefecto,
    [leer]
  );

  /**
   * Escribe los cambios en la URL. `null` y `"todos"` borran el parámetro:
   * una URL sin el parámetro es «sin filtrar», y dejar `marca=todos` escrito
   * ensucia el enlace que después alguien comparte.
   */
  const setParams = React.useCallback(
    (cambios: Record<string, string | number | null>) => {
      const p = new URLSearchParams(sp.toString());
      const recien: Record<string, string | null> = {};
      for (const [k, v] of Object.entries(cambios)) {
        if (v === null || v === "todos") {
          p.delete(k);
          recien[k] = null;
        } else {
          p.set(k, String(v));
          recien[k] = String(v);
        }
      }
      setTentativo((t) => ({ ...t, ...recien }));
      iniciar(() => {
        const q = p.toString();
        router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
      });
    },
    [pathname, router, sp]
  );

  /** Pone o quita un valor: si ya está puesto ese mismo, lo saca. Es lo que
   *  hacen las barras de los gráficos y las celdas del ranking. */
  const alternar = React.useCallback(
    (param: string, valor: string) => {
      setParams({ [param]: leer(param) === valor ? null : valor });
    },
    [leer, setParams]
  );

  /** Vuelve a la pantalla sin ningún filtro. */
  const limpiar = React.useCallback(() => {
    setTentativo({});
    iniciar(() => router.replace(pathname, { scroll: false }));
  }, [pathname, router]);

  /** Cuántos filtros hay puestos, contando los que todavía viajan. */
  const puestos = React.useMemo(() => {
    const claves = new Set([...sp.keys()]);
    for (const [k, v] of Object.entries(tentativo)) {
      if (v === null) claves.delete(k);
      else claves.add(k);
    }
    return [...claves];
  }, [sp, tentativo]);

  return { leer, leerNum, setParams, alternar, limpiar, puestos, pendiente };
}
