"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { cn } from "@/lib/utils";
import { DURACION, SUAVE_BEZIER } from "@/lib/movimiento";
import { navPara, type NavItem } from "@/lib/nav";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ICONOS } from "@/components/layout/iconos-nav";
import { IconChevron } from "@/components/icons";

/** El cian de la marca como relleno de estado: marca la pantalla en la que
 *  estás. Es el acento del sistema (DESIGN.md: «el acento marca estado y
 *  selección, nunca decora»), el mismo `--primary` del tema oscuro. */
const CHIP_ACTIVO = "bg-[oklch(0.78_0.135_205)] text-[oklch(0.2_0.06_270)]";

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
 * 19/10/2026, sobre la referencia «SideBar UI»: cada ícono va en un chip
 * redondeado (se escanea mejor que un trazo suelto) y el de la pantalla
 * activa se rellena con el cian de la marca. Y el menú entero se puede
 * plegar a solo íconos (`colapsado`), para darle el ancho a los gráficos
 * cuando se proyecta; plegado, cada ícono lleva su rótulo en un tooltip.
 *
 * Los grupos arrancan TODOS abiertos y el estado no se persiste: son cuatro
 * grupos y veintidós ítems — el colapso es para enfocar un rato, no una
 * preferencia que valga la pena recordar entre sesiones.
 *
 * MOVIMIENTO (Motion). La píldora del ítem activo es UN elemento con
 * `layoutId`: al navegar, React desmonta la del ítem viejo y monta la del
 * nuevo, y Motion la ve como la misma píldora que cambió de lugar — la
 * desliza en vez de apagar una y prender otra. Cuando un grupo se pliega
 * arriba, la píldora también acompaña el corrimiento. Los grupos se
 * pliegan con altura animada (AnimatePresence + height: auto), que en CSS
 * puro no se puede. La píldora plegada tiene OTRO `layoutId`: si compartiera
 * el de la ancha, al plegar el menú Motion intentaría transformar una en la
 * otra.
 *
 * Este menú se monta dos veces (rail de escritorio y cajón móvil): el
 * LayoutGroup con id propio evita que las dos píldoras se crean la misma y
 * se animen de un menú al otro.
 */
export function SidebarNav({
  onNavigate,
  esAdmin = true,
  colapsado = false,
}: {
  onNavigate?: () => void;
  /** Un lector no ve Configuración. Por defecto true para no romper a quien
   *  monte este componente sin pasar el rol; la puerta igual manda. */
  esAdmin?: boolean;
  /** Solo íconos, con el rótulo en un tooltip. */
  colapsado?: boolean;
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

  if (colapsado) {
    return (
      <LayoutGroup id={`${idGrupo}-mini`}>
        <nav aria-label="Pantallas" className="flex flex-col gap-2 px-2">
          {grupos.map((grupo) => (
            <div
              key={grupo.titulo}
              role="group"
              aria-label={grupo.titulo}
              className="flex flex-col items-center gap-1 border-t border-white/10 pt-2 first:border-t-0 first:pt-0"
            >
              {grupo.items.map((item) => (
                <ItemPlegado
                  key={item.href}
                  item={item}
                  activo={pathname === item.href}
                  onNavigate={onNavigate}
                />
              ))}
            </div>
          ))}
        </nav>
      </LayoutGroup>
    );
  }

  return (
    <LayoutGroup id={idGrupo}>
      <nav aria-label="Pantallas" className="flex flex-col gap-2 px-2">
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
                className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] outline-none transition-colors hover:bg-white/5 focus-visible:ring-2 focus-visible:ring-[var(--barra-foreground)]/50 pointer-coarse:min-h-9"
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
                      {grupo.items.map((item) => (
                        <ItemExpandido
                          key={item.href}
                          item={item}
                          activo={pathname === item.href}
                          onNavigate={onNavigate}
                        />
                      ))}
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

function ItemExpandido({
  item,
  activo,
  onNavigate,
}: {
  item: NavItem;
  activo: boolean;
  onNavigate?: () => void;
}) {
  const Icono = ICONOS[item.icono];
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={activo ? "page" : undefined}
      title={item.pista ? `${item.label} — ${item.pista}` : item.label}
      style={activo ? undefined : { color: "var(--barra-muted)" }}
      className={cn(
        // apple-design §1: feedback de press instantáneo (active:scale a
        // 75ms) sobre el color de 200ms.
        "relative flex items-center justify-between rounded-lg px-2 py-1.5 text-[13px] outline-none transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-[var(--barra-foreground)]/50 pointer-coarse:min-h-11 active:scale-[0.98] active:duration-75",
        activo ? "font-semibold text-white" : "hover:bg-white/8 hover:text-white"
      )}
    >
      {activo && (
        // El fondo del activo es esta píldora y no una clase del Link, para
        // que pueda deslizarse de un ítem al otro.
        <motion.span
          layoutId="pildora-activa"
          aria-hidden="true"
          className="absolute inset-0 rounded-lg bg-white/12 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]"
          transition={{ type: "spring", stiffness: 480, damping: 40 }}
        />
      )}
      {/* relative: el texto y el ícono quedan ARRIBA de la píldora, que es
          absoluta. */}
      <span className="relative flex min-w-0 items-center gap-2.5">
        <span
          className={cn(
            "grid size-7 shrink-0 place-items-center rounded-lg transition-colors duration-200",
            activo ? CHIP_ACTIVO : "bg-white/[0.06]"
          )}
        >
          <Icono size={16} />
        </span>
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
}

function ItemPlegado({
  item,
  activo,
  onNavigate,
}: {
  item: NavItem;
  activo: boolean;
  onNavigate?: () => void;
}) {
  const Icono = ICONOS[item.icono];
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Link
            href={item.href}
            onClick={onNavigate}
            aria-current={activo ? "page" : undefined}
            aria-label={item.implementado ? item.label : `${item.label} (pronto)`}
            style={activo ? undefined : { color: "var(--barra-muted)" }}
            className={cn(
              "relative grid size-10 place-items-center rounded-xl outline-none transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-[var(--barra-foreground)]/50 active:scale-[0.96] active:duration-75",
              activo ? "text-white" : "hover:bg-white/10 hover:text-white"
            )}
          />
        }
      >
        {activo && (
          <motion.span
            layoutId="pildora-activa-mini"
            aria-hidden="true"
            className="absolute inset-0 rounded-xl bg-white/12 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]"
            transition={{ type: "spring", stiffness: 480, damping: 40 }}
          />
        )}
        <span
          className={cn(
            "relative grid size-7 place-items-center rounded-lg transition-colors duration-200",
            activo ? CHIP_ACTIVO : "bg-white/[0.06]"
          )}
        >
          <Icono size={16} />
        </span>
        {!item.implementado && (
          // El «pronto» de los renglones largos, reducido a un punto.
          <span
            aria-hidden="true"
            className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-white/45"
          />
        )}
      </TooltipTrigger>
      <TooltipContent side="right" sideOffset={10} className="max-w-64 items-start">
        <span className="flex flex-col gap-0.5">
          <strong className="font-semibold">
            {item.label}
            {!item.implementado && <span className="font-normal opacity-70"> · pronto</span>}
          </strong>
          {item.pista && <span className="opacity-75">{item.pista}</span>}
        </span>
      </TooltipContent>
    </Tooltip>
  );
}
