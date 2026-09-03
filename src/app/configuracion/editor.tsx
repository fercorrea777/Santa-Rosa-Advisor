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
  metas,
  competidores,
}: {
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
    <form action={enviar} className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Metas 2026</CardTitle>
          <p className="text-xs text-muted-foreground">
            Contra esto se compara el share real en el Centro de Inteligencia.
            Dejá vacío lo que todavía no esté definido: la app muestra «sin
            definir», nunca un cero inventado.
          </p>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <CampoMeta
            name="participacion"
            label="Participación de mercado"
            sufijo="%"
            placeholder="ej. 8.5"
            defaultValue={metas.participacion_mercado_2026_pct}
          />
          <CampoMeta
            name="ranking"
            label="Ranking objetivo (posición del grupo)"
            sufijo="#"
            placeholder="ej. 3"
            defaultValue={metas.ranking_objetivo_2026}
          />
          <CampoMeta
            name="unidades"
            label="Unidades objetivo por mes"
            sufijo="u."
            placeholder="ej. 400"
            defaultValue={metas.unidades_objetivo_mensual}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Competidores clave</CardTitle>
          <p className="text-xs text-muted-foreground">
            La watchlist que resaltan los rankings. Un nombre por línea (o
            separados por coma), tal como los escribe CADAM.
          </p>
        </CardHeader>
        <CardContent>
          <textarea
            name="competidores"
            rows={4}
            defaultValue={competidores.join("\n")}
            spellCheck={false}
            className="input-base w-full rounded-md border bg-background px-3 py-2 font-mono text-sm leading-relaxed"
          />
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pendiente}>
          {pendiente ? "Guardando…" : "Guardar cambios"}
        </Button>
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
      </div>
    </form>
  );
}

function CampoMeta({
  name,
  label,
  sufijo,
  placeholder,
  defaultValue,
}: {
  name: string;
  label: string;
  sufijo: string;
  placeholder: string;
  defaultValue: number | null;
}) {
  return (
    <label className="flex items-center justify-between gap-4 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="flex items-center gap-1.5">
        <input
          name={name}
          // text + inputMode y no type=number: number rechaza la coma decimal
          // que acá todo el mundo tipea, y el action ya valida en serio.
          type="text"
          inputMode="decimal"
          placeholder={placeholder}
          defaultValue={defaultValue ?? ""}
          className="input-base w-28 rounded-md border bg-background px-2.5 py-1.5 text-right tabular-nums"
        />
        <span className="w-5 text-xs text-muted-foreground">{sufijo}</span>
      </span>
    </label>
  );
}
