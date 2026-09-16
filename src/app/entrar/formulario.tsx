"use client";

import Image from "next/image";
import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { CampoClave } from "@/components/ui/campo-clave";
import { entrar, type EstadoLogin } from "./acciones";

/**
 * Formulario de acceso.
 *
 * Reemplaza al diálogo nativo de Basic Auth, que no se puede maquillar y que
 * además no tiene forma de cerrar sesión: el navegador reenvía las
 * credenciales hasta que se cierra el navegador entero.
 *
 * El usuario es el correo de la empresa (@santarosa.com.py). La clave
 * general del equipo no aparece acá: vive en /entrar?modo=emergencia, que
 * no está enlazado, para que la pantalla que ve todo el mundo pida una
 * identidad de persona y no una contraseña compartida.
 *
 * Sobre el navy de la marca, con el mismo velo de profundidad que el menú
 * lateral: entrar y estar adentro se ven parte de la misma app.
 */
export function FormularioLogin({
  destino,
  dominio,
  emergencia = false,
  aviso,
}: {
  destino: string;
  dominio: string;
  emergencia?: boolean;
  /** Mensaje de contexto (clave restablecida, sesión cortada…). */
  aviso?: string;
}) {
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

        {aviso && (
          <p role="status" className="rounded-lg border border-emerald-300/30 bg-emerald-400/10 px-3 py-2 text-center text-sm text-emerald-100">
            {aviso}
          </p>
        )}

        <form action={enviar} className="flex flex-col gap-3">
          <input type="hidden" name="destino" value={destino} />
          {emergencia ? (
            <>
              <input type="hidden" name="modo" value="emergencia" />
              <p className="rounded-lg border border-amber-300/30 bg-amber-400/10 px-3 py-2 text-xs text-amber-100">
                Acceso de emergencia con la clave general del equipo. Abre una
                sesión de administrador por 24 horas y queda registrado.
              </p>
            </>
          ) : (
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-white/70">Correo</span>
              <input
                name="usuario"
                type="email"
                inputMode="email"
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                required
                autoFocus
                className={campo}
                placeholder={`nombre@${dominio}`}
              />
            </label>
          )}
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-white/70">
              {emergencia ? "Clave general" : "Clave"}
            </span>
            <CampoClave
              name="clave"
              autoComplete="current-password"
              required
              autoFocus={emergencia}
              className={campo}
              // El ojito va sobre el navy: el gris de la app no se ve ahi.
              claseBoton="text-white/70 hover:text-white hover:bg-white/15"
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

        {emergencia ? (
          <p className="text-center text-[11px] leading-relaxed text-white/40">
            <Link href="/entrar" className="underline underline-offset-2 hover:text-white">
              Volver a entrar con mi correo
            </Link>
          </p>
        ) : (
          <div className="flex flex-col items-center gap-2 text-center text-[11px] leading-relaxed text-white/40">
            <Link
              href="/entrar/olvide"
              className="text-xs text-white/70 underline underline-offset-2 hover:text-white"
            >
              Olvidé mi clave
            </Link>
            <p>
              Solo entran correos @{dominio}. ¿No tenés cuenta? Pedísela a Croman.
              <br />
              El tablero incluye precios y stock propios: no compartas tu clave.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/** Campo sobre el navy. `campo-acceso` (globals.css) mantiene este mismo
 *  aspecto cuando el navegador autocompleta, así el ojito de la clave sigue
 *  viéndose. */
export const campo =
  "campo-acceso w-full rounded-lg border border-white/15 bg-white/10 px-3 py-2.5 text-sm text-white placeholder:text-white/35 focus-visible:border-white/40 focus-visible:outline-none";
