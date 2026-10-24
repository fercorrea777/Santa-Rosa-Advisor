"use client";

import * as React from "react";
import type { FilaInforme } from "@/lib/informes/db";
import { Contenido } from "@/components/copiloto/chat";
import { useI18n } from "@/lib/i18n/cliente";
import { N_ } from "@/lib/i18n/traducir";

const ETIQUETA_DIMENSION: Record<string, string> = {
  resumen: N_("Resumen ejecutivo"),
  hermes_resumen: N_("Resumen de la semana"),
  precios: N_("Precios y modelos"),
  hermes_precios: N_("Precios de lista de la competencia"),
  hermes_promos: N_("Promociones de la competencia"),
  hermes_bitacora: N_("Cambios en las webs de la competencia"),
  hermes_battle_cards: N_("Battle cards modelo contra modelo"),
  noticias: N_("Noticias y lanzamientos"),
  redes: N_("Redes sociales"),
  tendencias: N_("Tendencias globales"),
};
// El resumen primero, el resto en este orden; lo que no este en la lista,
// al final tal como llegue.
const ORDEN = Object.keys(ETIQUETA_DIMENSION);
const posicion = (d: string) => (ORDEN.includes(d) ? ORDEN.indexOf(d) : 99);

export function InformesPanel() {
  const { t } = useI18n();
  const [informes, setInformes] = React.useState<FilaInforme[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  // El mensaje de «sin conexión» se arma al dibujar (no al fallar) para que siga
  // al idioma elegido.
  const [sinConexion, setSinConexion] = React.useState(false);

  React.useEffect(() => {
    fetch("/api/informes-competencia")
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else setInformes(data.informes);
      })
      .catch(() => setSinConexion(true));
  }, []);

  const mensajeError = sinConexion ? t("No se pudo contactar al servidor.") : error;
  if (mensajeError) {
    return <p className="p-4 text-sm text-muted-foreground">{mensajeError}</p>;
  }
  if (informes === null) {
    return <p className="p-4 text-sm text-muted-foreground">{t("Cargando informes…")}</p>;
  }
  if (informes.length === 0) {
    return (
      <p className="p-4 text-sm text-muted-foreground">
        {t("Todavía no hay informes semanales. Hermes los arma los lunes a la mañana con lo que relevó en la semana (promociones, cambios en las webs, precios de lista y battle cards).")}
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
            {t("Semana del {semana}", { semana })}
          </p>
          {filas.map((f) => (
            <details key={f.id} className="group" open={f.dimension === "hermes_resumen" || f.dimension === "resumen"}>
              <summary className="cursor-pointer text-sm font-medium">
                {ETIQUETA_DIMENSION[f.dimension] ? t(ETIQUETA_DIMENSION[f.dimension]) : f.dimension}
              </summary>
              <div className="mt-2 flex flex-col gap-2 text-sm text-muted-foreground">
                <Contenido texto={f.contenido} />
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
