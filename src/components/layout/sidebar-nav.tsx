"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { NAV_GROUPS, type IconoNav } from "@/lib/nav";
import { Badge } from "@/components/ui/badge";
import {
  IconInicio, IconMercado, IconEvolucion, IconRankings, IconSegmentos,
  IconCombustibles, IconLocalidades, IconMarketShare, IconBrecha, IconBubble,
  IconGama, IconOperacion, IconInteligencia, IconCopiloto, IconCargas,
  IconCalidad, IconConfiguracion, IconChevron,
} from "@/components/icons";

const ICONOS: Record<IconoNav, React.ComponentType<{ size?: number; className?: string }>> = {
  inicio: IconInicio,
  mercado: IconMercado,
  evolucion: IconEvolucion,
  rankings: IconRankings,
  segmentos: IconSegmentos,
  combustibles: IconCombustibles,
  localidades: IconLocalidades,
  "market-share": IconMarketShare,
  brecha: IconBrecha,
  bubble: IconBubble,
  gama: IconGama,
  operacion: IconOperacion,
  inteligencia: IconInteligencia,
  copiloto: IconCopiloto,
  cargas: IconCargas,
  calidad: IconCalidad,
  configuracion: IconConfiguracion,
};

/**
 * Menú lateral sobre el panel navy.
 *
 * Rediseño 2026-09 sobre la referencia que mandó Croman (el menú de
 * Bitrix24): cada grupo es un PANEL HUNDIDO (fondo apenas más claro que el
 * navy, radio propio) con su encabezado COLAPSABLE, y el ítem activo es una
 * píldora luminosa — sin barra lateral: sobre fondo oscuro la píldora ya es
 * señal suficiente y la referencia tampoco la usa. Siguen siendo tres
 * canales (tinte + peso + color), nunca color solo.
 *
 * Los grupos arrancan TODOS abiertos y el estado no se persiste: son cuatro
 * grupos y trece ítems — el colapso es para enfocar un rato, no una
 * preferencia que valga la pena recordar entre sesiones.
 */
export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const [cerrados, setCerrados] = React.useState<Set<string>>(new Set());

  const alternar = (titulo: string) =>
    setCerrados((prev) => {
      const s = new Set(prev);
      if (s.has(titulo)) s.delete(titulo);
      else s.add(titulo);
      return s;
    });

  return (
    <nav className="flex flex-col gap-2 px-2">
      {NAV_GROUPS.map((grupo) => {
        const abierto = !cerrados.has(grupo.titulo);
        return (
          // Panel hundido del grupo: el fondo apenas-más-claro es lo que
          // dibuja el contorno; no hace falta borde.
          <div key={grupo.titulo} className="rounded-xl bg-white/[0.05] p-1.5">
            <button
              type="button"
              onClick={() => alternar(grupo.titulo)}
              aria-expanded={abierto}
              className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] transition-colors hover:bg-white/5 pointer-coarse:min-h-9"
              style={{ color: "var(--barra-muted)" }}
            >
              {grupo.titulo}
              <IconChevron
                size={13}
                className={cn(
                  "shrink-0 opacity-60 transition-transform duration-200",
                  !abierto && "-rotate-90"
                )}
              />
            </button>

            {abierto && (
              <div className="flex flex-col gap-0.5 pt-0.5 pointer-coarse:gap-1.5">
                {grupo.items.map((item) => {
                  const active = pathname === item.href;
                  const Icono = ICONOS[item.icono];
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onNavigate}
                      title={item.label}
                      style={active ? undefined : { color: "var(--barra-muted)" }}
                      className={cn(
                        // apple-design §1: feedback de press instantáneo
                        // (active:scale a 75ms) sobre el color de 200ms.
                        "relative flex items-center justify-between rounded-lg px-2.5 py-2 text-[13px] transition-colors duration-200 pointer-coarse:min-h-11 active:scale-[0.98] active:duration-75",
                        active
                          ? "bg-white/15 font-semibold text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]"
                          : "hover:bg-white/8 hover:text-white"
                      )}
                    >
                      <span className="flex min-w-0 items-center gap-2.5">
                        <Icono
                          size={17}
                          className={cn("shrink-0", active ? "text-white" : "opacity-75")}
                        />
                        <span className="truncate">{item.label}</span>
                      </span>
                      {!item.implementado && (
                        <Badge
                          variant="outline"
                          className="ml-2 shrink-0 border-white/25 text-[10px] font-normal text-white/70"
                        >
                          pronto
                        </Badge>
                      )}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}
