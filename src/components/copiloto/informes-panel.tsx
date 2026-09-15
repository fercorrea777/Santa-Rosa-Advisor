"use client";

import * as React from "react";
import type { FilaInforme } from "@/lib/informes/db";

const ETIQUETA_DIMENSION: Record<string, string> = {
  resumen: "Resumen ejecutivo",
  hermes_resumen: "Resumen de la semana",
  precios: "Precios y modelos",
  hermes_precios: "Precios de lista de la competencia",
  hermes_promos: "Promociones de la competencia",
  hermes_bitacora: "Cambios en las webs de la competencia",
  hermes_battle_cards: "Battle cards modelo contra modelo",
  noticias: "Noticias y lanzamientos",
  redes: "Redes sociales",
  tendencias: "Tendencias globales",
};
// El resumen primero, el resto en este orden; lo que no este en la lista,
// al final tal como llegue.
const ORDEN = Object.keys(ETIQUETA_DIMENSION);
const posicion = (d: string) => (ORDEN.includes(d) ? ORDEN.indexOf(d) : 99);

export function InformesPanel() {
  const [informes, setInformes] = React.useState<FilaInforme[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    fetch("/api/informes-competencia")
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else setInformes(data.informes);
      })
      .catch(() => setError("No se pudo contactar al servidor."));
  }, []);

  if (error) {
    return <p className="p-4 text-sm text-muted-foreground">{error}</p>;
  }
  if (informes === null) {
    return <p className="p-4 text-sm text-muted-foreground">Cargando informes…</p>;
  }
  if (informes.length === 0) {
    return (
      <p className="p-4 text-sm text-muted-foreground">
        Todavía no hay informes semanales. Hermes los arma los lunes a la
        mañana con lo que relevó en la semana (promociones, cambios en las
        webs, precios de lista y battle cards).
      </p>
    );
  }

  const porSemana = new Map<string, FilaInforme[]>();
  for (const i of informes) {
    porSemana.set(i.semana, [...(porSemana.get(i.semana) ?? []), i]);
  }
  for (const [, filas] of porSemana) {
    filas.sort((a, b) => posicion(a.dimension) - posicion(b.dimension));
  }

  return (
    <div className="flex flex-col gap-4 overflow-y-auto p-1">
      {[...porSemana.entries()].map(([semana, filas]) => (
        <div key={semana} className="flex flex-col gap-2 rounded-lg border bg-card p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Semana del {semana}
          </p>
          {filas.map((f) => (
            <details key={f.id} className="group" open={f.dimension === "hermes_resumen" || f.dimension === "resumen"}>
              <summary className="cursor-pointer text-sm font-medium">
                {ETIQUETA_DIMENSION[f.dimension] ?? f.dimension}
              </summary>
              <div className="mt-2 flex flex-col gap-2 whitespace-pre-wrap text-sm text-muted-foreground">
                {f.contenido}
                {f.fuentes.length > 0 && (
                  <ul className="flex flex-col gap-1 text-xs">
                    {f.fuentes.map((s, i) => (
                      <li key={i}>
                        <a href={s.url} target="_blank" rel="noreferrer" className="underline">
                          {s.titulo || s.url}
                        </a>
                        {s.fecha && <span> · {s.fecha}</span>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </details>
          ))}
        </div>
      ))}
    </div>
  );
}
