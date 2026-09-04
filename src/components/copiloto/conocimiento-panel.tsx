"use client";

import * as React from "react";
import type { EntradaIndice } from "@/lib/informes/conocimiento";
import { formatFecha } from "@/lib/format";

/**
 * Que sabe el Copiloto sobre la competencia, y de cuando es.
 *
 * El panel NO muestra el contenido — a proposito, ver
 * /api/conocimiento-competencia/indice. Muestra el inventario y su edad,
 * que es lo que hace falta para confiar (o desconfiar) de una respuesta del
 * Copiloto sobre precios de la competencia.
 *
 * La edad va en primer plano: el riesgo de esta integracion no es que falle
 * — es que siga empujando en silencio un benchmark de hace tres meses y el
 * Copiloto lo cite como si fuera de hoy.
 */

/** A partir de acá el dato deja de ser "reciente" y se marca. Un mes es lo
 *  que tarda el mercado paraguayo en mover precios de lista. */
const DIAS_TIBIO = 30;
const DIAS_FRIO = 90;

function dias(desde: string | null): number | null {
  if (!desde) return null;
  const t = Date.parse(desde);
  if (Number.isNaN(t)) return null;
  return Math.floor((Date.now() - t) / 86_400_000);
}

function Antiguedad({ d }: { d: number | null }) {
  if (d === null) {
    return <span className="text-muted-foreground">sin fecha</span>;
  }
  const texto = d === 0 ? "hoy" : d === 1 ? "ayer" : `hace ${d} días`;
  const tono =
    d >= DIAS_FRIO
      ? "text-rose-600 dark:text-rose-500"
      : d >= DIAS_TIBIO
        ? "text-amber-600 dark:text-amber-500"
        : "text-emerald-600 dark:text-emerald-500";
  return <span className={tono}>{texto}</span>;
}

export function ConocimientoPanel() {
  const [docs, setDocs] = React.useState<EntradaIndice[] | null>(null);

  React.useEffect(() => {
    fetch("/api/conocimiento-competencia/indice")
      .then((r) => r.json())
      .then((d) => setDocs(d.documentos ?? []))
      .catch(() => setDocs([]));
  }, []);

  if (docs === null) {
    return <p className="text-sm text-muted-foreground">Cargando…</p>;
  }

  if (!docs.length) {
    return (
      <p className="text-sm text-muted-foreground">
        Hermes todavía no empujó nada. El cron corre todos los días a las 08:15;
        si pasó la hora y sigue vacío, revisá el trabajo{" "}
        <span className="font-mono text-xs">advisor-conocimiento</span> en Hermes.
      </p>
    );
  }

  const masViejo = docs.reduce<number | null>((peor, d) => {
    const x = dias(d.fechado_en ?? d.actualizado_en);
    return x !== null && (peor === null || x > peor) ? x : peor;
  }, null);

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col divide-y">
        {docs.map((d) => (
          <li
            key={d.clave}
            className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 py-2 text-sm"
          >
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate font-medium">{d.titulo}</span>
              <span className="truncate font-mono text-[11px] text-muted-foreground">
                {d.clave}
              </span>
            </span>
            <span className="shrink-0 text-right text-xs">
              {/* Dos fechas distintas y las dos importan: la del documento
                  (cuándo se relevó el dato) y la del push (cuándo llegó
                  acá). Un benchmark de agosto empujado hoy sigue siendo de
                  agosto. */}
              <span className="block">
                Dato: <Antiguedad d={dias(d.fechado_en)} />
              </span>
              <span className="block text-muted-foreground">
                Subido {formatFecha(d.actualizado_en)} ·{" "}
                {Math.round(d.caracteres / 1000)} k
              </span>
            </span>
          </li>
        ))}
      </ul>
      {masViejo !== null && masViejo >= DIAS_TIBIO && (
        <p className="text-xs text-muted-foreground">
          Hay material de hasta {masViejo} días. El Copiloto cita la fecha de cada
          documento cuando lo usa, pero conviene refrescar el relevamiento manual.
        </p>
      )}
    </div>
  );
}
