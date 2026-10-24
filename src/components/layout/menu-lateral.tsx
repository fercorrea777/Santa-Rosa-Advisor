"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import type { PerfilVisible } from "@/lib/auth/perfil";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { TarjetaPerfil } from "@/components/layout/tarjeta-perfil";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { IconBuscar, IconColapsar, IconExpandir } from "@/components/icons";
import { useI18n } from "@/lib/i18n/cliente";

const sinSuscripcion = () => () => {};
/** «⌘K» en Mac y iOS, «Ctrl K» en el resto. El servidor no sabe cuál: manda
 *  «Ctrl K» y el cliente lo corrige al hidratar, sin avisos de diferencia. */
function useAtajo(): string {
  return React.useSyncExternalStore(
    sinSuscripcion,
    () => (/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent) ? "⌘K" : "Ctrl K"),
    () => "Ctrl K"
  );
}

/**
 * Todo lo que va dentro del panel navy, para el rail de escritorio y para el
 * cajón del celular: perfil arriba, buscador, las pantallas y, al pie, quién
 * somos y el botón de plegar.
 *
 * Plegado (`colapsado`) es solo de escritorio: el cajón móvil no tiene sentido
 * a 72 px y siempre se abre completo.
 */
export function MenuLateral({
  perfil,
  esAdmin,
  colapsado = false,
  onAlternar,
  onBuscar,
  onNavigate,
  animarEtiquetas = false,
}: {
  perfil: PerfilVisible | null;
  esAdmin: boolean;
  colapsado?: boolean;
  /** Si no se pasa (cajón móvil), no hay botón de plegar. */
  onAlternar?: () => void;
  onBuscar: () => void;
  onNavigate?: () => void;
  /** Las etiquetas entran con un fundido corto al desplegar el menú. Solo
   *  después de que la persona lo toca: en la primera carga no se anima nada. */
  animarEtiquetas?: boolean;
}) {
  return (
    <>
      {perfil && <TarjetaPerfil perfil={perfil} colapsado={colapsado} onNavigate={onNavigate} />}
      <BotonBuscar colapsado={colapsado} onClick={onBuscar} />
      <div
        className={cn(
          "min-h-0 flex-1 overflow-y-auto overscroll-contain py-3",
          animarEtiquetas && !colapsado && "animate-in fade-in-0 duration-150"
        )}
      >
        <SidebarNav esAdmin={esAdmin} colapsado={colapsado} onNavigate={onNavigate} />
      </div>
      <PieMenu colapsado={colapsado} onAlternar={onAlternar} />
    </>
  );
}

function BotonBuscar({ colapsado, onClick }: { colapsado: boolean; onClick: () => void }) {
  const { t } = useI18n();
  const atajo = useAtajo();

  if (colapsado) {
    return (
      <div className="flex justify-center px-2 pt-1">
        <Tooltip>
          <TooltipTrigger
            render={
              <button
                type="button"
                onClick={onClick}
                aria-label={t("Buscar pantalla")}
                aria-keyshortcuts="Control+K Meta+K"
                className="grid size-10 place-items-center rounded-xl bg-white/[0.06] text-[var(--barra-muted)] ring-1 ring-inset ring-white/10 outline-none transition-colors hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-[var(--barra-foreground)]/60"
              />
            }
          >
            <IconBuscar size={16} />
          </TooltipTrigger>
          <TooltipContent side="right" sideOffset={10}>{t("Buscar pantalla ({atajo})", { atajo })}</TooltipContent>
        </Tooltip>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={t("Buscar pantalla")}
      aria-keyshortcuts="Control+K Meta+K"
      className="mx-2 mt-2 flex h-9 items-center gap-2 rounded-xl bg-white/[0.06] px-3 text-left text-[13px] text-[var(--barra-muted)] ring-1 ring-inset ring-white/10 outline-none transition-colors hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-[var(--barra-foreground)]/60 pointer-coarse:h-11"
    >
      <IconBuscar size={15} className="shrink-0" />
      <span className="min-w-0 flex-1 truncate">{t("Buscar pantalla…")}</span>
      <kbd className="shrink-0 rounded-md border border-white/20 px-1.5 py-0.5 font-mono text-[10px] text-white/65 pointer-coarse:hidden">
        {atajo}
      </kbd>
    </button>
  );
}

function PieMenu({ colapsado, onAlternar }: { colapsado: boolean; onAlternar?: () => void }) {
  const { t } = useI18n();
  return (
    <div
      className={cn(
        "flex items-center gap-2 border-t border-white/10 p-2.5",
        colapsado ? "justify-center" : "justify-between"
      )}
    >
      {!colapsado && (
        <span className="min-w-0 text-[11px] leading-snug text-white/60">
          {/* i18n-ignore (razón social: nombre propio) */}
          Santa Rosa Paraguay S.A.
          <br />
          {t("Inteligencia Comercial")}
        </span>
      )}
      {onAlternar && (
        <Tooltip>
          <TooltipTrigger
            render={
              <button
                type="button"
                onClick={onAlternar}
                aria-label={colapsado ? t("Expandir el menú") : t("Colapsar el menú")}
                aria-expanded={!colapsado}
                className="grid size-8 shrink-0 place-items-center rounded-lg text-white/65 outline-none transition-colors hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-[var(--barra-foreground)]/60"
              />
            }
          >
            {colapsado ? <IconExpandir size={16} /> : <IconColapsar size={16} />}
          </TooltipTrigger>
          <TooltipContent side={colapsado ? "right" : "top"} sideOffset={colapsado ? 10 : 6}>
            {colapsado ? t("Expandir el menú") : t("Colapsar el menú")}
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}
