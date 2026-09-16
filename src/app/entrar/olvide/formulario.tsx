"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { campo, patronCorreo } from "../formulario";
import { pedirRecuperacion, type EstadoOlvide } from "./acciones";

export function FormularioOlvide({ dominio }: { dominio: string }) {
  const [estado, enviar, pendiente] = useActionState<EstadoOlvide | null, FormData>(
    pedirRecuperacion,
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
          <h1 className="text-lg font-bold tracking-tight text-white">Olvidé mi clave</h1>
          <p className="text-sm text-white/60">
            Escribí tu correo de la empresa y te mandamos un enlace para poner
            una clave nueva.
          </p>
        </div>

        {estado?.ok ? (
          <p role="status" className="rounded-lg border border-emerald-300/30 bg-emerald-400/10 px-3 py-3 text-sm text-emerald-100">
            {estado.ok}
          </p>
        ) : (
          <form action={enviar} className="flex flex-col gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-white/70">Correo</span>
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
                className={campo}
                placeholder={`nombre@${dominio}`}
              />
            </label>
            <Button
              type="submit"
              disabled={pendiente}
              className="w-full bg-white text-[color:var(--barra)] hover:bg-white/90"
            >
              {pendiente ? "Enviando…" : "Enviarme el enlace"}
            </Button>
            {estado?.error && (
              <p role="alert" className="text-center text-sm text-rose-300">{estado.error}</p>
            )}
          </form>
        )}

        <p className="text-center text-[11px] text-white/40">
          <Link href="/entrar" className="underline underline-offset-2 hover:text-white">
            Volver a entrar
          </Link>
        </p>
      </div>
    </div>
  );
}
