"use client";

import * as React from "react";
import { useActionState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CampoClave } from "@/components/ui/campo-clave";
import { cn } from "@/lib/utils";
import { cambiarMiClave, type EstadoMiClave } from "./acciones";

export function FormularioMiClave({ quien }: { quien: string | null }) {
  const [estado, enviar, pendiente] = useActionState<EstadoMiClave | null, FormData>(
    cambiarMiClave,
    null
  );
  const form = React.useRef<HTMLFormElement>(null);
  React.useEffect(() => {
    if (estado?.ok) form.current?.reset();
  }, [estado?.ok]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Mi clave</CardTitle>
        <p className="text-xs text-muted-foreground">
          {quien
            ? `Estás como ${quien}. Cambiá acá la clave con la que entrás.`
            : "Entraste con la clave general del equipo, que no es de una persona en particular."}
        </p>
      </CardHeader>
      <CardContent>
        <form ref={form} action={enviar} className="flex flex-col gap-3">
          <Campo name="actual" label="Clave actual" autoComplete="current-password" />
          <Campo name="nueva" label="Clave nueva" autoComplete="new-password" minLength={10} />
          <Campo name="repetida" label="Repetir la clave nueva" autoComplete="new-password" minLength={10} />
          <div className="flex items-center justify-between gap-3">
            <span className="text-[11px] text-muted-foreground">
              Mínimo 10 caracteres.
            </span>
            <Button type="submit" size="sm" disabled={pendiente}>
              {pendiente ? "Cambiando…" : "Cambiar mi clave"}
            </Button>
          </div>
          {(estado?.error || estado?.ok) && (
            <p
              role="alert"
              className={cn(
                "rounded-md border px-3 py-2 text-xs",
                estado.error
                  ? "border-rose-500/30 bg-rose-500/5 text-rose-600 dark:text-rose-400"
                  : "border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400"
              )}
            >
              {estado.error ?? estado.ok}
            </p>
          )}
        </form>
      </CardContent>
    </Card>
  );
}

function Campo({
  name,
  label,
  autoComplete,
  minLength,
}: {
  name: string;
  label: string;
  autoComplete: string;
  minLength?: number;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <CampoClave
        name={name}
        required
        minLength={minLength}
        autoComplete={autoComplete}
        className="input-base h-9"
      />
    </label>
  );
}
