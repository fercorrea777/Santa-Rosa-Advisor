"use client";

import * as React from "react";
import { useActionState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { guardarConfiguracion, type EstadoGuardado } from "./acciones";

/**
 * Formulario de metas y competidores. Un solo submit para las dos tarjetas:
 * viven en el mismo archivo y guardarlas juntas evita el estado a medias
 * ("guardé las metas pero no los competidores") que después nadie recuerda.
 *
 * `useActionState` + <form action>: el POST lo arma Next, el pending
 * deshabilita el botón solo, y si JS todavía no cargó el form igual
 * funciona — es un form.
 */
export function EditorConfiguracion({
  anio,
  metas,
  competidores,
}: {
  anio: number;
  metas: {
    participacion_mercado_2026_pct: number | null;
    ranking_objetivo_2026: number | null;
    unidades_objetivo_mensual: number | null;
  };
  competidores: string[];
}) {
  const [estado, enviar, pendiente] = useActionState<EstadoGuardado | null, FormData>(
    guardarConfiguracion,
    null
  );

  return (
    <Card>
      <form action={enviar} className="contents">
        <CardHeader>
          <CardTitle className="text-base">Metas {anio} y competidores clave</CardTitle>
          <p className="text-xs text-muted-foreground">
            Contra las metas se compara el share real en el Centro de
            Inteligencia; los competidores son la watchlist que resaltan los
            rankings. Dejá vacío lo que todavía no esté definido: la app
            muestra «sin definir», nunca un cero inventado.
          </p>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <div className="grid gap-3 sm:grid-cols-3">
            <CampoMeta
              name="participacion"
              label="Participación de mercado"
              sufijo="%"
              placeholder="ej. 8,5"
              defaultValue={metas.participacion_mercado_2026_pct}
            />
            <CampoMeta
              name="ranking"
              label="Ranking objetivo"
              nota="posición del grupo"
              sufijo="#"
              placeholder="ej. 3"
              defaultValue={metas.ranking_objetivo_2026}
            />
            <CampoMeta
              name="unidades"
              label="Unidades objetivo"
              nota="por mes, todo el grupo"
              sufijo="u."
              placeholder="ej. 400"
              defaultValue={metas.unidades_objetivo_mensual}
            />
          </div>
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Competidores clave
            </span>
            <textarea
              name="competidores"
              rows={4}
              defaultValue={competidores.join("\n")}
              spellCheck={false}
              placeholder={"TOYOTA\nKIA\nCHEVROLET"}
              className="input-base h-auto w-full max-w-md resize-y px-3 py-2 font-mono text-sm leading-relaxed"
            />
            <span className="text-[11px] text-muted-foreground">
              Un nombre por línea (o separados por coma), tal como los escribe CADAM.
            </span>
          </label>
          <div className="flex flex-wrap items-center justify-end gap-3 border-t pt-4">
            {estado && (
              <p
                role="status"
                className={
                  estado.ok
                    ? "text-sm text-emerald-600 dark:text-emerald-500"
                    : "text-sm text-rose-600 dark:text-rose-500"
                }
              >
                {estado.mensaje}
              </p>
            )}
            <Button type="submit" disabled={pendiente}>
              {pendiente ? "Guardando…" : "Guardar metas y competidores"}
            </Button>
          </div>
        </CardContent>
      </form>
    </Card>
  );
}

function CampoMeta({
  name,
  label,
  nota,
  sufijo,
  placeholder,
  defaultValue,
}: {
  name: string;
  label: string;
  nota?: string;
  sufijo: string;
  placeholder: string;
  defaultValue: number | null;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
        {nota && <span className="ml-1 font-normal normal-case tracking-normal">· {nota}</span>}
      </span>
      <span className="relative block">
        <input
          name={name}
          // text + inputMode y no type=number: number rechaza la coma decimal
          // que acá todo el mundo tipea, y el action ya valida en serio.
          type="text"
          inputMode="decimal"
          placeholder={placeholder}
          defaultValue={defaultValue ?? ""}
          className="input-base w-full pr-9 text-right tabular-nums"
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground"
        >
          {sufijo}
        </span>
      </span>
    </label>
  );
}
