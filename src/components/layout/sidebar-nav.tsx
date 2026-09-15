"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { cn } from "@/lib/utils";
import { DURACION, SUAVE_BEZIER } from "@/lib/movimiento";
import { navPara, type IconoNav } from "@/lib/nav";
import { Badge } from "@/components/ui/badge";
import {
  IconInicio, IconMercado, IconEvolucion, IconRankings, IconSegmentos,
  IconCombustibles, IconLocalidades, IconMarketShare, IconBrecha, IconBubble,
  IconGama, IconPortafolio, IconOperacion, IconAcciones, IconCbd, IconCarflow,
  IconInteligencia, IconCopiloto, IconCargas,
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
  portafolio: IconPortafolio,
  operacion: IconOperacion,
  acciones: IconAcciones,
  cbd: IconCbd,
  carflow: IconCarflow,
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
 *
 * MOVIMIENTO (Motion). La píldora del ítem activo es UN elemento con
 * `layoutId`: al navegar, React desmonta la del ítem viejo y monta la del
 * nuevo, y Motion la ve como la misma píldora que cambió de lugar — la
 * desliza en vez de apagar una y prender otra. Cuando un grupo se pliega
 * arriba, la píldora también acompaña el corrimiento. Los grupos se
 * pliegan con altura animada (AnimatePresence + height: auto), que en CSS
 * puro no se puede.
 *
 * Este menú se monta dos veces (rail de escritorio y cajón móvil): el
 * LayoutGroup con id propio evita que las dos píldoras se crean la misma y
 * se animen de un menú al otro.
 */
export function SidebarNav({
  onNavigate,
  esAdmin = true,
}: {
  onNavigate?: () => void;
  /** Un lector no ve Configuración. Por defecto true para no romper a quien
   *  monte este componente sin pasar el rol; la puerta igual manda. */
  esAdmin?: boolean;
}) {
  const grupos = navPara(esAdmin);
  const pathname = usePathname();
  const [cerrados, setCerrados] = React.useState<Set<string>>(new Set());
  const idGrupo = React.useId();

  const alternar = (titulo: string) =>
    setCerrados((prev) => {
      const s = new Set(prev);
      if (s.has(titulo)) s.delete(titulo);
      else s.add(titulo);
      return s;
    });

  return (
    <LayoutGroup id={idGrupo}>
      <nav className="flex flex-col gap-2 px-2">
        {grupos.map((grupo) => {
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

              {/* initial={false}: al montar, los grupos abiertos aparecen
                  abiertos y listo; la altura solo se anima al plegar y
                  desplegar. */}
              <AnimatePresence initial={false}>
                {abierto && (
                  <motion.div
                    key="items"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: DURACION.corta, ease: SUAVE_BEZIER }}
                    className="overflow-hidden"
                  >
                    <div className="flex flex-col gap-0.5 pt-0.5 pointer-coarse:gap-1.5">
                      {grupo.items.map((item) => {
                        const active = pathname === item.href;
                        const Icono = ICONOS[item.icono];
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            onClick={onNavigate}
                            title={item.pista ? `${item.label} — ${item.pista}` : item.label}
                            style={active ? undefined : { color: "var(--barra-muted)" }}
                            className={cn(
                              // apple-design §1: feedback de press instantáneo
                              // (active:scale a 75ms) sobre el color de 200ms.
                              "relative flex items-center justify-between rounded-lg px-2.5 py-2 text-[13px] transition-colors duration-200 pointer-coarse:min-h-11 active:scale-[0.98] active:duration-75",
                              active ? "font-semibold text-white" : "hover:bg-white/8 hover:text-white"
                            )}
                          >
                            {active && (
                              // El fondo del activo es esta píldora y no una
                              // clase del Link, para que pueda deslizarse de
                              // un ítem al otro.
                              <motion.span
                                layoutId="pildora-activa"
                                aria-hidden="true"
                                className="absolute inset-0 rounded-lg bg-white/15 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]"
                                transition={{ type: "spring", stiffness: 480, damping: 40 }}
                              />
                            )}
                            {/* relative: el texto y el ícono quedan ARRIBA de
                                la píldora, que es absoluta. */}
                            <span className="relative flex min-w-0 items-center gap-2.5">
                              <Icono
                                size={17}
                                className={cn("shrink-0", active ? "text-white" : "opacity-75")}
                              />
                              <span className="truncate">{item.label}</span>
                            </span>
                            {!item.implementado && (
                              <Badge
                                variant="outline"
                                className="relative ml-2 shrink-0 border-white/25 text-[10px] font-normal text-white/70"
                              >
                                pronto
                              </Badge>
                            )}
                          </Link>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </nav>
    </LayoutGroup>
  );
}
