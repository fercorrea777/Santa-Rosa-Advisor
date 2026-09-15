"use client";

import { useFiltroUrl } from "@/lib/filtro-url";
import { cn } from "@/lib/utils";

/**
 * Elige que fuente manda en la pagina: matriculacion o importacion.
 * Escribe `?fuente=` en la URL, igual que el resto de los filtros, para
 * que el estado sea compartible y sobreviva al refresh.
 */
export type FuenteVista = "matriculacion" | "importacion" | "ambas";

export function SelectorFuente({
  fuente,
  tecnologiasImportacion = [],
  conAmbas = false,
  aclaracion,
  porDefecto,
}: {
  fuente: FuenteVista;
  /** Tecnologías que SÍ existen del lado de importación (Combustibles las
   *  saca del archivo NEV: HEV, PHEV, EV). Cualquier otra se descarta al
   *  cambiar de fuente. Sin la lista, se descarta siempre. */
  tecnologiasImportacion?: string[];
  /** Tercera opción «Ambas»: la pantalla muestra las dos fuentes lado a
   *  lado, cada una hasta su propio último mes (Portafolio). */
  conAmbas?: boolean;
  /** Una línea debajo del selector: hasta dónde llega cada fuente. Va acá y
   *  no en una nota aparte porque es la respuesta a la pregunta que se hace
   *  quien está por elegir. */
  aclaracion?: string;
  /** La vista que la página muestra sin parámetro. Elegirla saca `fuente`
   *  de la URL en vez de escribirla: así el botón "Quitar filtros" no cuenta
   *  como filtro a la opción por defecto. */
  porDefecto?: FuenteVista;
}) {
  const { leer, setParams, pendiente } = useFiltroUrl();
  const vista = (leer("fuente") ?? fuente) as FuenteVista;
  const opciones: FuenteVista[] = conAmbas
    ? ["ambas", "matriculacion", "importacion"]
    : ["matriculacion", "importacion"];
  const rotulo: Record<FuenteVista, string> = {
    matriculacion: "Matriculaciones",
    importacion: "Importaciones",
    ambas: "Ambas",
  };

  const set = (v: string) => {
    // La tecnologia (casi) solo existe del lado de matriculacion: al pasar
    // a importacion se descarta para no dejar un filtro que no aplica.
    const tec = leer("tecnologia");
    const conservar = !!tec && tecnologiasImportacion.includes(tec);
    const valor = v === porDefecto ? null : v;
    setParams(v === "importacion" && !conservar ? { fuente: valor, tecnologia: null } : { fuente: valor });
  };

  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        Analizar
      </span>
      <div
        aria-busy={pendiente}
        className={cn(
          "flex gap-1 rounded-md border bg-card p-1 transition-opacity",
          pendiente && "opacity-70"
        )}
      >
        {opciones.map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => set(v)}
            aria-pressed={vista === v}
            className={cn(
              "h-8 rounded px-3 text-xs font-medium transition-colors",
              vista === v
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted"
            )}
          >
            {rotulo[v]}
          </button>
        ))}
      </div>
      {aclaracion && (
        <p className="max-w-[46ch] text-[11px] leading-snug text-muted-foreground">{aclaracion}</p>
      )}
    </div>
  );
}
