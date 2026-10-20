"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import type { PerfilVisible } from "@/lib/auth/perfil";
import { salir } from "@/app/entrar/acciones";
import { Avatar } from "@/components/perfil/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { IconSalir } from "@/components/icons";

const BOTON_SALIR =
  "grid size-9 shrink-0 place-items-center rounded-lg text-white/65 outline-none transition-colors hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-[var(--barra-foreground)]/60 pointer-coarse:size-11";

/**
 * La persona que está mirando, arriba del menú: foto, nombre, rol, un enlace a
 * «Mi cuenta» y la salida.
 *
 * Mismo patrón que los otros tableros de la casa (Gestión de Compras,
 * Selección SRPY): la cuenta es lo primero que uno busca cuando algo no se ve
 * como debería («¿entré con mi usuario?»), y tenerla a la vista evita el
 * «¿quién soy en esta pantalla?». «Cerrar sesión» queda al lado y no escondido
 * tres clics adentro, porque en una notebook prestada o en la sala de
 * reuniones es lo que hay que poder hacer rápido.
 */
export function TarjetaPerfil({
  perfil,
  colapsado = false,
  onNavigate,
}: {
  perfil: PerfilVisible;
  colapsado?: boolean;
  onNavigate?: () => void;
}) {
  if (colapsado) {
    return (
      <div className="flex flex-col items-center gap-1 px-2 pt-3">
        <Tooltip>
          <TooltipTrigger
            render={
              <Link
                href="/mi-cuenta"
                onClick={onNavigate}
                aria-label={`Mi cuenta, ${perfil.nombre}`}
                className="grid size-10 place-items-center rounded-xl outline-none transition-colors hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-[var(--barra-foreground)]/60"
              />
            }
          >
            <Avatar nombre={perfil.nombre} fotoUrl={perfil.fotoUrl} tamano="md" sobre="navy" />
          </TooltipTrigger>
          <TooltipContent side="right" sideOffset={10}>
            <span className="flex flex-col">
              <strong className="font-semibold">{perfil.nombre}</strong>
              <span className="opacity-70">{perfil.rolEtiqueta} · Mi cuenta</span>
            </span>
          </TooltipContent>
        </Tooltip>
        <form action={salir}>
          <Tooltip>
            <TooltipTrigger
              render={<button type="submit" aria-label="Cerrar sesión" className={BOTON_SALIR} />}
            >
              <IconSalir size={17} />
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={10}>Cerrar sesión</TooltipContent>
          </Tooltip>
        </form>
      </div>
    );
  }

  return (
    <div className="mx-2 mt-3 flex items-center gap-0.5 rounded-xl bg-white/[0.06] p-1.5 ring-1 ring-inset ring-white/10">
      <Link
        href="/mi-cuenta"
        onClick={onNavigate}
        title="Mi cuenta"
        className="group flex min-w-0 flex-1 items-center gap-2.5 rounded-lg px-1.5 py-1 outline-none transition-colors hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-[var(--barra-foreground)]/60 pointer-coarse:min-h-11"
      >
        <Avatar nombre={perfil.nombre} fotoUrl={perfil.fotoUrl} tamano="md" sobre="navy" />
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block truncate text-[13px] font-semibold text-white">{perfil.nombre}</span>
          <span className="block truncate text-[11px] text-[var(--barra-muted)]">
            {perfil.rolEtiqueta}
            {perfil.emergencia && " · emergencia"}
          </span>
        </span>
      </Link>
      <form action={salir}>
        <button type="submit" aria-label="Cerrar sesión" title="Cerrar sesión" className={cn(BOTON_SALIR)}>
          <IconSalir size={17} />
        </button>
      </form>
    </div>
  );
}
