"use client";

import * as React from "react";
import type { FilaInforme } from "@/lib/informes/db";

const ETIQUETA_DIMENSION: Record<string, string> = {
  precios: "Precios y modelos",
  noticias: "Noticias y lanzamientos",
  redes: "Redes sociales",
  tendencias: "Tendencias globales",
  resumen: "Resumen ejecutivo",
};

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
        Todavía no se generó ningún informe semanal. Se genera automáticamente
        cada semana; también se puede disparar a mano desde el dashboard de
        Vercel (Cron Jobs).
      </p>
    );
  }

  const porSemana = new Map<string, FilaInforme[]>();
  for (const i of informes) {
    porSemana.set(i.semana, [...(porSemana.get(i.semana) ?? []), i]);
  }

  return (
    <div className="flex flex-col gap-4 overflow-y-auto p-1">
      {[...porSemana.entries()].map(([semana, filas]) => (
        <div key={semana} className="flex flex-col gap-2 rounded-lg border bg-card p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Semana del {semana}
          </p>
          {filas.map((f) => (
            <details key={f.id} className="group">
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
