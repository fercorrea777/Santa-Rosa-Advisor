"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { NAV_GROUPS, type IconoNav } from "@/lib/nav";
import { Badge } from "@/components/ui/badge";
import {
  IconInicio, IconMercado, IconEvolucion, IconRankings, IconSegmentos,
  IconCombustibles, IconLocalidades, IconMarketShare, IconBrecha, IconBubble, IconGama,
  IconOperacion,
  IconInteligencia, IconCopiloto, IconCargas, IconCalidad, IconConfiguracion,
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

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-4 px-2">
      {NAV_GROUPS.map((grupo) => (
        // gap-2 en táctil: con el dedo, dos filas separadas por 2px invitan a
        // pifiarle al vecino (mínimo recomendado: 8px). Con mouse el puntero
        // es preciso y la densidad vale más, así que ahí queda en los 2px de
        // siempre.
        <div key={grupo.titulo} className="flex flex-col gap-0.5 pointer-coarse:gap-2">
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
                  // min-h-11 en táctil: py-2 deja el ítem en 36px, y en celular
                  // esta nav vive en un drawer donde se navega con el pulgar.
                  "relative flex items-center justify-between rounded-xl px-3 py-2 text-sm transition-colors duration-200 pointer-coarse:min-h-11 active:scale-[0.98] active:duration-75",
                  active
                    ? // Activo por TRES canales, no color solo (consenso de
                      // las guías de sidebar 2026: tinte + peso + barra
                      // indicadora). Reemplaza la píldora sólida con sombra,
                      // que era el patrón admin de hace una década y además
                      // gritaba más que el contenido. El patrón tintado es
                      // el de Linear/Stripe: señala sin competir.
                      "bg-primary/10 font-semibold text-primary before:absolute before:left-0 before:top-1/2 before:h-5 before:w-[3px] before:-translate-y-1/2 before:rounded-full before:bg-primary"
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
                  <Badge
                    variant="outline"
                    className={cn(
                      "ml-2 shrink-0 text-[10px] font-normal",
                      active && "border-primary/40 text-primary"
                    )}
                  >
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
