"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { CampoClave } from "@/components/ui/campo-clave";
import { MarcoAcceso } from "@/components/acceso/marco-acceso";
import { sincronizarAriaInvalid } from "@/lib/utils";
import { campo, useGestoGlobito } from "../entrar/formulario";
import { restablecerClave, type EstadoRestablecer } from "./acciones";

export function FormularioRestablecer({
  token,
  correo,
  nombre,
  minimo,
}: {
  token: string;
  correo: string;
  nombre: string;
  minimo: number;
}) {
  const [estado, enviar, pendiente] = useActionState<EstadoRestablecer | null, FormData>(
    restablecerClave,
    null
  );
  const gesto = useGestoGlobito(estado?.error ? estado : null, pendiente);

  return (
    <MarcoAcceso
      estado={gesto.estado}
      mirada={gesto.mirada}
      titulo="Elegí tu clave"
      subtitulo={
        <>
          Hola {nombre.split(" ")[0] || correo}. Tu usuario es{" "}
          <strong className="font-semibold text-foreground">{correo}</strong>.
        </>
      }
      pie={
        <p className="text-center text-[11px] leading-relaxed text-muted-foreground">
          Mínimo {minimo} caracteres; no puede contener tu usuario ni el nombre de la empresa.
          <br />
          <Link href="/entrar" className="underline underline-offset-2 hover:text-foreground">
            Volver a entrar
          </Link>
        </p>
      }
    >
      <form action={enviar} className="flex flex-col gap-4" {...gesto.alForm}>
        <input type="hidden" name="token" value={token} />
        {/* El correo va como campo oculto de solo lectura para que el
            gestor de claves del navegador guarde usuario y clave juntos. */}
        <input type="hidden" name="username" autoComplete="username" value={correo} readOnly />
        <label data-campo="clave" className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Clave nueva</span>
          <CampoClave
            name="nueva"
            autoComplete="new-password"
            required
            minLength={minimo}
            autoFocus
            onBlur={sincronizarAriaInvalid}
            onInput={sincronizarAriaInvalid}
            onVisibleChange={gesto.alMostrarClave}
            className={campo}
            placeholder={`al menos ${minimo} caracteres`}
          />
        </label>
        <label data-campo="clave" className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Repetir la clave</span>
          <CampoClave
            name="repetida"
            autoComplete="new-password"
            required
            minLength={minimo}
            onBlur={sincronizarAriaInvalid}
            onInput={sincronizarAriaInvalid}
            onVisibleChange={gesto.alMostrarClave}
            className={campo}
            placeholder="la misma otra vez"
          />
        </label>
        <Button type="submit" disabled={pendiente} className="mt-1 h-11 w-full rounded-xl text-[0.95rem]">
          {pendiente ? "Guardando…" : "Guardar la clave"}
        </Button>
        {estado?.error && (
          <p role="alert" className="text-center text-sm text-destructive">
            {estado.error}
          </p>
        )}
      </form>
    </MarcoAcceso>
  );
}
