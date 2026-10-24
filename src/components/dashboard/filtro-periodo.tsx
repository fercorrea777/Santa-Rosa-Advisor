"use client";

import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { QuitarFiltros } from "@/components/dashboard/quitar-filtros";
import { DURACION, SUAVE_BEZIER } from "@/lib/movimiento";
import { useFiltroUrl } from "@/lib/filtro-url";
import { useI18n } from "@/lib/i18n/cliente";
import { N_ } from "@/lib/i18n/traducir";
import { cn } from "@/lib/utils";

/** Filtros que se aplican con un clic (grafico o fila de ranking) y no
 *  tienen desplegable: se muestran como chip para poder sacarlos. */
const CHIPS = [
  { param: "marca", label: N_("Marca") },
  { param: "modelo", label: N_("Modelo") },
  { param: "version", label: N_("Versión") },
] as const;

export interface OpcionFiltro {
  /** Clave del parametro en la URL, ej. 'segmento'. */
  param: string;
  label: string;
  /** Un texto por opción, o {valor, label} cuando lo que va a la URL no es
   *  lo que se lee ("2026-09" → "Septiembre 2026"). */
  valores: (string | { valor: string; label: string })[];
}

/**
 * Barra de filtros. Escribe en la URL (searchParams) en vez de en estado
 * local: asi el filtro es compartible, sobrevive al refresh y el Server
 * Component vuelve a consultar la base con los valores nuevos.
 */
export function FiltroPeriodo({
  anios = [],
  mesMaximoPorAnio = {},
  opciones = [],
  pegajoso = true,
  sinPeriodo = false,
}: {
  anios?: number[];
  /** Ultimo mes con datos, por anio. Evita ofrecer meses vacios. */
  mesMaximoPorAnio?: Record<number, number>;
  opciones?: OpcionFiltro[];
  /** Sin Año/Desde/Hasta: para las pantallas cuyo dato no tiene período
   *  (la planilla de acciones comerciales es de un mes) pero que quieren la
   *  misma barra que el resto del tablero. */
  sinPeriodo?: boolean;
  /** Queda fijo al hacer scroll. Apagarlo solo cuando la barra vive dentro
   *  de otra fila que ya es pegajosa (mercado, que le suma el selector de
   *  fuente): dos sticky anidados se pisan. */
  pegajoso?: boolean;
}) {
  const { t, fmt } = useI18n();
  const { nombreDeSegmento, mesesCortos } = fmt;
  // La mecánica de "que el filtro se quede quieto" vive en el hook: por qué
  // hace falta está explicado ahí.
  const { leer, setParams, pendiente } = useFiltroUrl();

  const anioActual = Number(leer("anio")) || anios[anios.length - 1];
  const topeMes = mesMaximoPorAnio[anioActual] ?? 12;
  const desde = Math.min(Number(leer("desde")) || 1, topeMes);
  const hasta = Math.min(Number(leer("hasta")) || topeMes, topeMes);

  return (
    // top-16 = los 56px del header de la app + 8px de aire. z-30 la deja por
    // debajo del header (z-40) y del drawer móvil (z-50). La tarjeta es opaca
    // (bg-card), así que el contenido pasa por detrás sin transparentarse; la
    // sombra la despega del texto que scrollea abajo.
    //
    // Solo desde sm: en 375px la barra mide 242px — el 30% de la pantalla —
    // porque los campos se apilan. Fijarla ahí dejaría el teléfono con un
    // tercio muerto todo el tiempo. En móvil scrollea normal.
    <div
      // aria-busy + el punto de abajo: el filtro tarda lo que tarda la
      // consulta, y sin señal parecía que el clic se había perdido.
      aria-busy={pendiente}
      data-revelar=""
      className={cn(
        "relative flex flex-wrap items-end gap-x-5 gap-y-2 rounded-lg border bg-card px-4 py-2.5",
        pegajoso && "barra-pegajosa sm:sticky sm:top-16 sm:z-30"
      )}
    >
      {/* La sombra aparece solo cuando la barra está pegada arriba (ver
          .barra-pegajosa en globals.css). */}
      {pegajoso && <span aria-hidden="true" className="pegada-sombra" />}
      {pendiente && (
        <span
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-0.5 animate-pulse rounded-t-lg bg-primary"
        />
      )}
      {!sinPeriodo && (<>
      <Campo label={t("Año")}>
        <select
          className={selectCls}
          value={anioActual}
          onChange={(e) => {
            const nuevo = Number(e.target.value);
            const tope = mesMaximoPorAnio[nuevo] ?? 12;
            setParams({ anio: nuevo, desde: 1, hasta: tope });
          }}
        >
          {anios.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
      </Campo>

      <Campo label={t("Desde")}>
        <select
          className={selectCls}
          value={desde}
          onChange={(e) => {
            const d = Number(e.target.value);
            setParams({ desde: d, hasta: Math.max(d, hasta) });
          }}
        >
          {mesesCortos.slice(0, topeMes).map((m, i) => (
            <option key={m} value={i + 1}>{m}</option>
          ))}
        </select>
      </Campo>

      <Campo label={t("Hasta")}>
        <select
          className={selectCls}
          value={hasta}
          onChange={(e) => setParams({ hasta: Number(e.target.value) })}
        >
          {mesesCortos.slice(0, topeMes).map((m, i) => (
            <option key={m} value={i + 1} disabled={i + 1 < desde}>{m}</option>
          ))}
        </select>
      </Campo>
      </>)}

      {opciones.map((o) => (
        <Campo key={o.param} label={o.label}>
          <select
            className={selectCls}
            value={leer(o.param) ?? "todos"}
            onChange={(e) => setParams({ [o.param]: e.target.value })}
          >
            <option value="todos">{t("Todos")}</option>
            {o.valores.map((v) => {
              const valor = typeof v === "string" ? v : v.valor;
              const label = typeof v === "string"
                // Los segmentos llegan sin tilde de CADAM (CAMION): se leen
                // con ella, el valor que viaja a la URL no cambia.
                ? (o.param === "segmento" ? nombreDeSegmento(v) : v)
                : v.label;
              return <option key={valor} value={valor}>{label}</option>;
            })}
          </select>
        </Campo>
      ))}

      {/* Filtros aplicados haciendo clic en un grafico o en una fila del
          ranking: no tienen desplegable propio, asi que se muestran aca
          como chips para que se vean y se puedan quitar.

          Los que SI tienen desplegable quedan afuera: en Operación, "marca"
          salia dos veces —el select en HAVAL y al lado el chip "Marca:
          HAVAL ✕"— y no habia forma de saber si eran un filtro o dos. */}
      {/* AnimatePresence: el chip que se quita se achica y se va en vez de
          desaparecer de golpe — y el que llega de un clic en un gráfico
          aparece creciendo, que es lo que señala que ESE clic puso un
          filtro. initial={false}: los que ya estaban al abrir la página
          (URL compartida) no se animan. */}
      <AnimatePresence initial={false}>
        {CHIPS.filter(({ param }) => !opciones.some((o) => o.param === param)).map(({ param, label }) => {
          const valor = leer(param);
          if (!valor || valor === "todos") return null;
          return (
            <motion.button
              key={param}
              type="button"
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85 }}
              transition={{ duration: DURACION.corta * 0.7, ease: SUAVE_BEZIER }}
              onClick={() => setParams({ [param]: null })}
              title={t("Quitar este filtro")}
              className="inline-flex h-8 items-center gap-1.5 self-end rounded-md border border-primary/40 bg-primary/10 px-2.5 text-xs"
            >
              <span className="text-muted-foreground">{t(label)}:</span>
              <span className="font-medium">{valor}</span>
              <span aria-hidden="true" className="opacity-70">✕</span>
            </motion.button>
          );
        })}
      </AnimatePresence>

      <QuitarFiltros className="ml-auto self-end" />
    </div>
  );
}

const selectCls = "input-base";

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}
