"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "@/lib/nav";
import { Badge } from "@/components/ui/badge";

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-0.5 px-2">
      {NAV_ITEMS.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              // apple-design §1 (Response): el feedback de press es
              // instantáneo (100ms, no la transición de 200ms del resto) y
              // ocurre en pointer-down vía :active — no hay que esperar a
              // soltar para que el link se sienta "tocado".
              "relative flex items-center justify-between rounded-md px-3 py-2 text-sm transition-colors duration-200 active:scale-[0.98] active:duration-75",
              active
                ? // Barra de acento + fondo tintado: se lee "instrumento
                  // seleccionado", no un botón lleno que pesa más que el dato.
                  "bg-primary/12 font-semibold text-foreground before:absolute before:inset-y-1.5 before:left-0 before:w-0.5 before:rounded-full before:bg-primary before:shadow-[0_0_8px_var(--primary)]"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            )}
          >
            <span>{item.label}</span>
            {!item.implementado && (
              <Badge variant="outline" className="ml-2 shrink-0 text-[10px] font-normal">
                pronto
              </Badge>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
