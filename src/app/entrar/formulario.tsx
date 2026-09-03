"use client";

import Image from "next/image";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { entrar, type EstadoLogin } from "./acciones";

/**
 * Formulario de acceso.
 *
 * Reemplaza al diálogo nativo de Basic Auth, que no se puede maquillar y que
 * además no tiene forma de cerrar sesión: el navegador reenvía las
 * credenciales hasta que se cierra el navegador entero.
 *
 * Sobre el navy de la marca, con el mismo velo de profundidad que el menú
 * lateral: entrar y estar adentro se ven parte de la misma app.
 */
export function FormularioLogin({ destino }: { destino: string }) {
  const [estado, enviar, pendiente] = useActionState<EstadoLogin | null, FormData>(
    entrar,
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
      <div className="flex w-full max-w-sm flex-col gap-7">
        <div className="flex flex-col items-center gap-3 text-center">
          {/* brightness-0 primero aplana el azul del monograma; invert lo
              pasa a blanco parejo sobre el navy. */}
          <Image
            src="/logo-santa-rosa.png"
            alt="Santa Rosa"
            width={311}
            height={32}
            priority
            className="h-5 w-auto brightness-0 invert"
          />
          <div className="flex flex-col gap-1">
            <h1 className="text-lg font-bold tracking-tight text-white">
              Mercado Automotor
            </h1>
            <p className="text-xs uppercase tracking-[0.14em] text-white/50">
              Inteligencia comercial · Paraguay
            </p>
          </div>
        </div>

        <form action={enviar} className="flex flex-col gap-3">
          <input type="hidden" name="destino" value={destino} />
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-white/70">Usuario</span>
            <input
              name="usuario"
              type="text"
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              autoFocus
              className="w-full rounded-lg border border-white/15 bg-white/10 px-3 py-2.5 text-sm text-white placeholder:text-white/35 focus-visible:border-white/40 focus-visible:outline-none"
              placeholder="tu.usuario"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-white/70">Clave</span>
            <input
              name="clave"
              type="password"
              autoComplete="current-password"
              required
              className="w-full rounded-lg border border-white/15 bg-white/10 px-3 py-2.5 text-sm text-white placeholder:text-white/35 focus-visible:border-white/40 focus-visible:outline-none"
              placeholder="••••••••"
            />
          </label>

          <Button
            type="submit"
            disabled={pendiente}
            className="w-full bg-white text-[color:var(--barra)] hover:bg-white/90"
          >
            {pendiente ? "Entrando…" : "Entrar"}
          </Button>

          {estado?.error && (
            // role=alert: quien usa lector de pantalla se entera del rechazo
            // sin tener que ir a buscar el texto.
            <p role="alert" className="text-center text-sm text-rose-300">
              {estado.error}
            </p>
          )}
        </form>

        <p className="text-center text-[11px] leading-relaxed text-white/40">
          ¿No tenés usuario todavía? Dejalo vacío y entrá con la clave general
          del equipo.
          <br />
          El tablero incluye precios y stock propios: no la compartas fuera.
        </p>
      </div>
    </div>
  );
}
