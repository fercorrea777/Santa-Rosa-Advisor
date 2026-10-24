"use client";

import * as React from "react";
import Image from "next/image";
import { Globito, type EstadoGlobito, type MiradaGlobito } from "@/components/ui/globito";
import { PanelIlustrado } from "@/components/acceso/panel-ilustrado";
import { SelectorIdioma } from "@/components/layout/selector-idioma";
import { ThemeToggle } from "@/components/theme-toggle";
import { useI18n } from "@/lib/i18n/cliente";

/**
 * El marco de todas las pantallas de acceso (entrar, olvidé mi clave, poner
 * clave con el enlace): a la izquierda el panel ilustrado, a la derecha el
 * globito, el título y el formulario.
 *
 * Reemplaza al navy plano de antes (un formulario centrado sobre fondo azul).
 * Es la pantalla de login de la referencia que mandó Croman, adaptada a lo que
 * ya tenemos: correo del dominio + clave con ojito, «olvidé mi clave» por
 * enlace al correo, y la clave general escondida en /entrar?modo=emergencia.
 * Nada de eso cambió; solo cómo se ve.
 *
 * El lado derecho sigue el tema (claro u oscuro, con su botón); el panel de la
 * izquierda es siempre el navy de la marca. En el celular el panel no entra: se
 * ve solo el formulario, con el logo arriba.
 *
 * Arriba a la derecha, junto al botón del tema, va el selector de idioma «ES | EN»:
 * se tiene que poder elegir ANTES de entrar, y por eso vive en el marco que
 * comparten las tres pantallas de acceso (el menú de la app no se dibuja acá).
 *
 * `estado` y `mirada` son del globito: el formulario que vive adentro le dice
 * qué está pasando (qué campo tiene foco, si se está enviando, si falló).
 */
export function MarcoAcceso({
  estado = "reposo",
  mirada = null,
  titulo,
  subtitulo,
  children,
  pie,
}: {
  estado?: EstadoGlobito;
  mirada?: MiradaGlobito | null;
  titulo: string;
  subtitulo?: React.ReactNode;
  children: React.ReactNode;
  /** Debajo del formulario: enlaces y avisos chicos. */
  pie?: React.ReactNode;
}) {
  const { t } = useI18n();
  return (
    <div className="min-h-dvh bg-background p-3 sm:p-4 lg:p-5">
      <div className="mx-auto grid min-h-[calc(100dvh-1.5rem)] max-w-[1240px] overflow-hidden rounded-[1.75rem] border border-border bg-card shadow-[var(--card-shadow)] sm:min-h-[calc(100dvh-2rem)] lg:min-h-[calc(100dvh-2.5rem)] lg:grid-cols-[1.02fr_1fr]">
        <PanelIlustrado className="hidden lg:flex" />

        <main className="relative flex flex-col px-6 py-6 sm:px-12 lg:px-14 xl:px-20">
          <div className="flex items-center justify-between">
            {/* Sin el panel (celular), el logo va acá. El PNG es navy y negro:
                en oscuro se pasa a blanco. */}
            <Image
              src="/logo-santa-rosa.png"
              alt="Santa Rosa"
              width={311}
              height={32}
              className="h-4 w-auto dark:brightness-0 dark:invert lg:invisible"
            />
            <div className="flex items-center gap-1.5">
              <SelectorIdioma sobre="claro" />
              <ThemeToggle />
            </div>
          </div>

          <div className="mx-auto my-auto flex w-full max-w-sm flex-col py-8">
            <div className="mb-7 flex justify-center">
              <Globito estado={estado} mirada={mirada} tamano={108} />
            </div>

            <h1 className="text-[1.75rem] font-bold leading-tight tracking-tight text-balance">
              {titulo}
            </h1>
            {subtitulo && (
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground text-pretty">
                {subtitulo}
              </p>
            )}

            <div className="mt-6">{children}</div>
            {pie && <div className="mt-6">{pie}</div>}
          </div>

          <p className="text-center text-[11px] text-muted-foreground">
            {t("Santa Rosa Paraguay S.A. · Inteligencia Comercial")}
          </p>
        </main>
      </div>
    </div>
  );
}
