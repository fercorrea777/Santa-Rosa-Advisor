"use client";

import { useFiltroUrl } from "@/lib/filtro-url";
import { useI18n } from "@/lib/i18n/cliente";
import { cn } from "@/lib/utils";

/**
 * Chips de «Años en el gráfico» (param `anios` de la URL).
 *
 * Chips y no un <select multiple>: son cinco años y el multiple nativo obliga
 * a ctrl+clic —que nadie descubre— y ocupa cuatro renglones. Acá se ve de un
 * vistazo cuáles están puestos.
 *
 * Es ADITIVO: elige qué se DIBUJA, no sobre qué se calcula (ver
 * `aniosDeSerie` en lib/periodo.ts). Por eso vive junto a los gráficos y no en
 * la barra de filtros: en la barra parecía un filtro más y no lo es, no mueve
 * ninguna cifra.
 */
function ChipsAniosSerie({ anios }: { anios: number[] }) {
  const { t } = useI18n();
  const { leer, setParams, pendiente } = useFiltroUrl();

  const anioActual = Number(leer("anio")) || anios[anios.length - 1];
  // Mismo criterio que aniosDeSerie() del servidor: sin param, el año del
  // filtro y el anterior. Se replica acá porque este componente es de
  // cliente y no puede importar del módulo de servidor.
  const defectoAnios = [anioActual - 1, anioActual].filter((a) => anios.includes(a)).join(",");
  const crudo = leer("anios");
  const puestos = (crudo ? crudo.split(",") : defectoAnios.split(","))
    .map(Number)
    .filter((a) => anios.includes(a));

  return (
    <div role="group" aria-label={t("Años en el gráfico")} aria-busy={pendiente} className="flex flex-wrap items-center gap-1">
      {anios.map((a) => {
        const puesto = puestos.includes(a);
        return (
          <button
            key={a}
            type="button"
            aria-pressed={puesto}
            onClick={() => {
              const siguiente = puesto
                ? puestos.filter((x) => x !== a)
                : [...puestos, a].sort((x, y) => x - y);
              // Nunca dejar cero años: un gráfico vacío no es un
              // estado que alguien quiera pedir, es un clic de más.
              if (!siguiente.length) return;
              setParams({
                anios: siguiente.join(",") === defectoAnios ? null : siguiente.join(","),
              });
            }}
            className={cn(
              "rounded-md px-2 py-1 text-xs font-medium tabular-nums transition-colors pointer-coarse:min-h-9 pointer-coarse:px-3",
              puesto
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            )}
          >
            {a}
          </button>
        );
      })}
    </div>
  );
}

/** Los chips con su rótulo al lado, para ponerlos en el encabezado de una
 *  sección de gráficos. */
export function SelectorAniosSerie({ anios }: { anios: number[] }) {
  const { t } = useI18n();
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
      <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {t("Años en el gráfico")}
      </span>
      <ChipsAniosSerie anios={anios} />
    </div>
  );
}
