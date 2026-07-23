"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { NAV_GROUPS, type IconoNav } from "@/lib/nav";
import { Badge } from "@/components/ui/badge";
import {
  IconInicio, IconMercado, IconEvolucion, IconRankings, IconSegmentos,
  IconCombustibles, IconMarketShare, IconBrecha, IconInteligencia,
  IconCopiloto, IconCargas, IconCalidad, IconConfiguracion,
} from "@/components/icons";

const ICONOS: Record<IconoNav, React.ComponentType<{ size?: number; className?: string }>> = {
  inicio: IconInicio,
  mercado: IconMercado,
  evolucion: IconEvolucion,
  rankings: IconRankings,
  segmentos: IconSegmentos,
  combustibles: IconCombustibles,
  "market-share": IconMarketShare,
  brecha: IconBrecha,
  inteligencia: IconInteligencia,
  copiloto: IconCopiloto,
  cargas: IconCargas,
  calidad: IconCalidad,
  configuracion: IconConfiguracion,
};

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-4 px-2">
      {NAV_GROUPS.map((grupo) => (
        <div key={grupo.titulo} className="flex flex-col gap-0.5">
          <span className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.09em] text-muted-foreground/70">
            {grupo.titulo}
          </span>
          {grupo.items.map((item) => {
            const active = pathname === item.href;
            const Icono = ICONOS[item.icono];
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                title={item.label}
                className={cn(
                  // apple-design §1 (Response): feedback de press instantáneo
                  // (active:scale a 75ms) sobre la transición de color de 200ms.
                  "relative flex items-center justify-between rounded-md px-3 py-2 text-sm transition-colors duration-200 active:scale-[0.98] active:duration-75",
                  active
                    ? // Barra de acento + fondo tintado: "instrumento
                      // seleccionado", no un botón lleno que pesa más que el dato.
                      "bg-primary/12 font-semibold text-foreground before:absolute before:inset-y-1.5 before:left-0 before:w-0.5 before:rounded-full before:bg-primary before:shadow-[0_0_8px_var(--primary)]"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
              >
                <span className="flex min-w-0 items-center gap-2.5">
                  {/* El ícono acompaña, no protagoniza: hereda el gris del
                      label y solo toma el acento en el item activo. */}
                  <Icono size={16} className={cn("shrink-0", active ? "text-primary" : "text-muted-foreground/80")} />
                  <span className="truncate">{item.label}</span>
                </span>
                {!item.implementado && (
                  <Badge variant="outline" className="ml-2 shrink-0 text-[10px] font-normal">
                    pronto
                  </Badge>
                )}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
