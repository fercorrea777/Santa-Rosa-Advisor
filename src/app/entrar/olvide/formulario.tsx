"use client";

import Link from "next/link";
import * as React from "react";
import { useActionState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { MarcoAcceso } from "@/components/acceso/marco-acceso";
import { IconCorreo } from "@/components/icons";
import { cn, sincronizarAriaInvalid } from "@/lib/utils";
import { campo, patronCorreo, useGestoGlobito } from "../formulario";
import { pedirRecuperacion, type EstadoOlvide } from "./acciones";

/**
 * «Olvidé mi clave». Pide el correo y manda un enlace de un solo uso.
 *
 * Cuando el pedido sale, la pantalla pasa a «Revisá tu correo» (el equivalente
 * de la pantalla «Check your email» de la referencia de login, sin el código de
 * cuatro dígitos: acá el correo trae un ENLACE, no un código), con el globito
 * contento. El texto que se muestra es el que devuelve el servidor, que
 * responde siempre lo mismo exista o no la cuenta (ver acciones.ts).
 *
 * «Probá con otro correo» vuelve a montar el formulario limpio: el estado del
 * pedido vive adentro de useActionState y no hay otra forma de reiniciarlo que
 * montarlo de nuevo.
 */
export function FormularioOlvide({ dominio }: { dominio: string }) {
  const [intento, setIntento] = React.useState(0);
  return <Olvide key={intento} dominio={dominio} otraVez={() => setIntento((i) => i + 1)} />;
}

function Olvide({ dominio, otraVez }: { dominio: string; otraVez: () => void }) {
  const [estado, enviar, pendiente] = useActionState<EstadoOlvide | null, FormData>(
    pedirRecuperacion,
    null
  );
  const gesto = useGestoGlobito(estado?.error ? estado : null, pendiente);
  const enviado = !!estado?.ok;

  return (
    <MarcoAcceso
      estado={enviado ? "feliz" : gesto.estado}
      mirada={enviado ? null : gesto.mirada}
      titulo={enviado ? "Revisá tu correo" : "Olvidé mi clave"}
      subtitulo={
        enviado
          ? undefined
          : "Escribí tu correo de la empresa y te mandamos un enlace para poner una clave nueva."
      }
      pie={
        <p className="text-center text-xs">
          <Link href="/entrar" className="text-muted-foreground underline underline-offset-2 hover:text-foreground">
            Volver a entrar
          </Link>
        </p>
      }
    >
      {enviado ? (
        <div role="status" className="flex flex-col gap-4">
          <span className="grid size-12 place-items-center rounded-2xl bg-primary/12 text-primary">
            <IconCorreo size={24} />
          </span>
          <p className="text-sm leading-relaxed text-muted-foreground text-pretty">{estado?.ok}</p>
          <Link
            href="/entrar"
            className={cn(buttonVariants({ variant: "outline" }), "h-11 w-full rounded-xl text-[0.95rem]")}
          >
            Volver a entrar
          </Link>
          <button
            type="button"
            onClick={otraVez}
            className="self-center text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
          >
            ¿Te equivocaste de correo? Probá con otro
          </button>
        </div>
      ) : (
        <form action={enviar} className="flex flex-col gap-4" {...gesto.alForm}>
          <label data-campo="correo" className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Correo</span>
            <input
              name="correo"
              type="email"
              inputMode="email"
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              required
              autoFocus
              pattern={patronCorreo(dominio)}
              title={`Tiene que ser un correo @${dominio}`}
              onBlur={sincronizarAriaInvalid}
              onInput={(e) => {
                sincronizarAriaInvalid(e);
                gesto.alEscribirCorreo(e.currentTarget.value.length);
              }}
              className={campo}
              placeholder={`nombre@${dominio}`}
            />
          </label>
          <Button type="submit" disabled={pendiente} className="mt-1 h-11 w-full rounded-xl text-[0.95rem]">
            {pendiente ? "Enviando…" : "Enviarme el enlace"}
          </Button>
          {estado?.error && (
            <p role="alert" className="text-center text-sm text-destructive">
              {estado.error}
            </p>
          )}
        </form>
      )}
    </MarcoAcceso>
  );
}
