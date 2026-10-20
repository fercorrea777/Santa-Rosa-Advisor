"use client";

import Link from "next/link";
import * as React from "react";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { CampoClave } from "@/components/ui/campo-clave";
import { MarcoAcceso } from "@/components/acceso/marco-acceso";
import type { EstadoGlobito, MiradaGlobito } from "@/components/ui/globito";
import { useCampoConFoco } from "@/lib/foco-campo";
import { sincronizarAriaInvalid } from "@/lib/utils";
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
 * Desde el 19/10/2026 vive dentro del marco ilustrado (MarcoAcceso), con el
 * globito arriba. El globito mira el campo que se está llenando, se tapa los
 * ojos cuando se escribe una clave oculta, piensa mientras se envía y se
 * sacude si el acceso falla; nada de eso reemplaza al texto (el error sigue
 * con su `role="alert"`).
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
  const gesto = useGestoGlobito(estado?.error ? estado : null, pendiente);

  return (
    <MarcoAcceso
      estado={gesto.estado}
      mirada={gesto.mirada}
      titulo={emergencia ? "Acceso de emergencia" : "Entrá a tu tablero"}
      subtitulo={
        emergencia
          ? "Con la clave general del equipo. Abre una sesión de administrador por 24 horas y queda registrado."
          : `Con tu correo @${dominio} y tu clave.`
      }
      pie={
        emergencia ? (
          <p className="text-center text-xs">
            <Link href="/entrar" className="text-muted-foreground underline underline-offset-2 hover:text-foreground">
              Volver a entrar con mi correo
            </Link>
          </p>
        ) : (
          <div className="flex flex-col items-center gap-2.5 text-center">
            <Link
              href="/entrar/olvide"
              className="text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              Olvidé mi clave
            </Link>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              Solo entran correos @{dominio}. ¿No tenés cuenta? Pedísela a Croman.
              <br />
              El tablero incluye precios y stock propios: no compartas tu clave.
            </p>
          </div>
        )
      }
    >
      {aviso && (
        <p
          role="status"
          className="mb-4 rounded-xl border border-emerald-600/25 bg-emerald-500/10 px-3.5 py-2.5 text-sm text-emerald-800 dark:text-emerald-200"
        >
          {aviso}
        </p>
      )}

      <form action={enviar} className="flex flex-col gap-4" {...gesto.alForm}>
        <input type="hidden" name="destino" value={destino} />
        {emergencia ? (
          <>
            <input type="hidden" name="modo" value="emergencia" />
            <p className="rounded-xl border border-amber-600/30 bg-amber-500/10 px-3.5 py-2.5 text-xs text-amber-900 dark:text-amber-100">
              Esta entrada no es de una persona: queda como administrador por un día y
              deja constancia en la auditoría.
            </p>
          </>
        ) : (
          <label data-campo="correo" className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Correo</span>
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
              // React 19 vacía los campos al terminar la acción: el correo
              // vuelve desde el estado para no obligar a tipearlo otra vez.
              defaultValue={estado?.usuario}
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
        )}
        <label data-campo="clave" className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">{emergencia ? "Clave general" : "Clave"}</span>
          <CampoClave
            name="clave"
            autoComplete="current-password"
            required
            autoFocus={emergencia}
            onBlur={sincronizarAriaInvalid}
            onInput={sincronizarAriaInvalid}
            onVisibleChange={gesto.alMostrarClave}
            className={campo}
            placeholder="••••••••"
          />
        </label>

        <Button type="submit" disabled={pendiente} className="mt-1 h-11 w-full rounded-xl text-[0.95rem]">
          {pendiente ? "Entrando…" : "Entrar"}
        </Button>

        {estado?.error && (
          // role=alert: quien usa lector de pantalla se entera del rechazo
          // sin tener que ir a buscar el texto.
          <p role="alert" className="text-center text-sm text-destructive">
            {estado.error}
          </p>
        )}
      </form>
    </MarcoAcceso>
  );
}

/**
 * Traduce lo que pasa en el formulario al gesto del globito.
 *
 * Prioridad: enviando > falló y todavía no se tocó nada > qué campo tiene el
 * foco. Con el foco en una clave oculta se tapa los ojos; en un campo visible
 * mira hacia él (en el correo, siguiendo lo que se va escribiendo, de izquierda
 * a derecha). El error se «da por visto» en cuanto la persona empieza a
 * corregir, así no queda con la cara fruncida mientras escribe de nuevo.
 *
 * El foco sale de `useCampoConFoco`, que lo lee del documento: el correo llega
 * con `autoFocus` y el navegador lo enfoca antes de que React hidrate.
 *
 * Exportado porque «olvidé mi clave» y «poner clave nueva» lo comparten.
 */
export function useGestoGlobito(error: object | null, pendiente: boolean) {
  const foco = useCampoConFoco();
  const [claveVisible, setClaveVisible] = React.useState(false);
  const [largoCorreo, setLargoCorreo] = React.useState(0);
  const [visto, setVisto] = React.useState<object | null>(null);

  let estado: EstadoGlobito = "reposo";
  let mirada: MiradaGlobito | null = null;
  if (pendiente) {
    estado = "pensando";
    mirada = { x: 0.55, y: -0.8 };
  } else if (error && error !== visto) {
    estado = "error";
  } else if (foco === "clave" && !claveVisible) {
    estado = "privado";
  } else if (foco === "clave") {
    estado = "atento";
    mirada = { x: 0.2, y: 0.9 };
  } else if (foco === "correo") {
    estado = "atento";
    mirada = { x: Math.max(-0.85, Math.min(0.85, -0.85 + largoCorreo / 18)), y: 0.9 };
  }

  const alForm = {
    // Empezar a corregir da el error por visto.
    onInput: () => {
      if (error) setVisto(error);
    },
  };

  return {
    estado,
    mirada,
    alForm,
    alEscribirCorreo: setLargoCorreo,
    alMostrarClave: setClaveVisible,
  };
}

/** Patrón HTML para el correo del dominio: valida en el navegador al salir
 *  del campo (ver :user-invalid en globals.css). Los puntos van escapados. */
export const patronCorreo = (dominio: string) =>
  `[a-z0-9._+\\-]+@${dominio.replace(/\./g, "\\.")}`;

/** Campo de las pantallas de acceso, con el tema. `campo-acceso-tema`
 *  (globals.css) mantiene este aspecto cuando el navegador autocompleta, así el
 *  ojito de la clave sigue viéndose. `pointer-coarse:text-base`: en iOS un campo
 *  de menos de 16 px hace que Safari amplíe la página al enfocarlo. */
export const campo =
  "campo-acceso-tema h-11 w-full rounded-xl border border-input bg-background px-3.5 text-[0.95rem] text-foreground shadow-[var(--card-shadow)] outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground/70 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 aria-invalid:border-destructive pointer-coarse:text-base";
