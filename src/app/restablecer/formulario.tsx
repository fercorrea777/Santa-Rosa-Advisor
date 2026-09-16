"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { CampoClave } from "@/components/ui/campo-clave";
import { sincronizarAriaInvalid } from "@/lib/utils";
import { campo } from "../entrar/formulario";
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

  return (
    <div
      className="flex min-h-screen items-center justify-center p-6"
      style={{
        backgroundColor: "var(--barra)",
        backgroundImage:
          "radial-gradient(120% 60% at 50% 0%, rgba(255,255,255,0.08), transparent 60%), linear-gradient(180deg, transparent 40%, rgba(0,0,0,0.3) 100%)",
      }}
    >
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="flex flex-col gap-1 text-center">
          <h1 className="text-lg font-bold tracking-tight text-white">Elegí tu clave</h1>
          <p className="text-sm text-white/60">
            Hola {nombre.split(" ")[0] || correo}. Tu usuario es <strong className="text-white/85">{correo}</strong>.
          </p>
        </div>

        <form action={enviar} className="flex flex-col gap-3">
          <input type="hidden" name="token" value={token} />
          {/* El correo va como campo oculto de solo lectura para que el
              gestor de claves del navegador guarde usuario y clave juntos. */}
          <input type="hidden" name="username" autoComplete="username" value={correo} readOnly />
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-white/70">Clave nueva</span>
            <CampoClave
              name="nueva"
              autoComplete="new-password"
              required
              minLength={minimo}
              autoFocus
              onBlur={sincronizarAriaInvalid}
              onInput={sincronizarAriaInvalid}
              className={campo}
              claseBoton="text-white/70 hover:text-white hover:bg-white/15"
              placeholder={`al menos ${minimo} caracteres`}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-white/70">Repetir la clave</span>
            <CampoClave
              name="repetida"
              autoComplete="new-password"
              required
              minLength={minimo}
              onBlur={sincronizarAriaInvalid}
              onInput={sincronizarAriaInvalid}
              className={campo}
              claseBoton="text-white/70 hover:text-white hover:bg-white/15"
              placeholder="la misma otra vez"
            />
          </label>
          <Button
            type="submit"
            disabled={pendiente}
            className="w-full bg-white text-[color:var(--barra)] hover:bg-white/90"
          >
            {pendiente ? "Guardando…" : "Guardar la clave"}
          </Button>
          {estado?.error && (
            <p role="alert" className="text-center text-sm text-rose-300">{estado.error}</p>
          )}
        </form>

        <p className="text-center text-[11px] leading-relaxed text-white/40">
          Mínimo {minimo} caracteres; no puede contener tu usuario ni el nombre de la empresa.
          <br />
          <Link href="/entrar" className="underline underline-offset-2 hover:text-white">
            Volver a entrar
          </Link>
        </p>
      </div>
    </div>
  );
}
