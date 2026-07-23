"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { SidebarNav } from "@/components/layout/sidebar-nav";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = React.useState(false);

  return (
    <div className="flex min-h-screen w-full">
      {/* Sidebar desktop: fijo mientras el contenido scrollea.
          `self-start` es lo que lo hace posible: sin eso el aside se
          estira a la altura del contenido (align-items: stretch) y
          `sticky` no tiene margen para pegarse. */}
      {/* Rail bento: tarjeta flotante redondeada separada del lienzo, no
          columna pegada al borde. Mantiene labels (13 secciones con ícono
          solo sería adivinanza). */}
      <aside className="sticky top-3 ml-3 hidden h-[calc(100vh-1.5rem)] w-60 shrink-0 self-start overflow-hidden rounded-3xl border bg-card text-sidebar-foreground shadow-[var(--card-shadow)] md:flex md:flex-col">
        <div className="flex h-14 items-center gap-2.5 border-b px-4">
          <span className="text-[0.82rem] font-extrabold uppercase leading-tight tracking-[0.06em]">
            Mercado Automotor <span className="text-primary">PY</span>
          </span>
        </div>
        <div className="flex-1 overflow-y-auto py-3">
          <SidebarNav />
        </div>
        <div className="border-t p-3 text-[11px] leading-snug text-muted-foreground">
          Santa Rosa Paraguay S.A.
          <br />
          Inteligencia Comercial
        </div>
      </aside>

      {/* Sidebar mobile (overlay) */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div
            className="fixed inset-0 bg-black/50"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <aside className="relative flex w-72 flex-col bg-sidebar text-sidebar-foreground shadow-xl">
            <div className="flex h-14 items-center justify-between border-b px-4">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold tracking-tight">
                  Mercado Automotor PY
                </span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 text-base leading-none"
                aria-label="Cerrar menú"
                onClick={() => setMobileOpen(false)}
              >
                ✕
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto py-3">
              <SidebarNav onNavigate={() => setMobileOpen(false)} />
            </div>
          </aside>
        </div>
      )}

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Material translúcido (apple-design §12): el contenido pasa por
            debajo, no una barra opaca fija. El borde inferior es un degradé
            suave (scroll-edge), no una línea dura — solo se nota cuando de
            verdad hay contenido detrás. */}
        <header className="sticky top-0 z-40 flex h-14 items-center gap-3 bg-background/70 px-4 shadow-[0_1px_0_0_var(--border),0_12px_16px_-14px_oklch(0_0_0/10%)] backdrop-blur-xl backdrop-saturate-150 supports-backdrop-filter:bg-background/55">
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-base leading-none md:hidden"
            aria-label="Abrir menú"
            onClick={() => setMobileOpen(true)}
          >
            ≡
          </Button>
          <Link href="/" className="flex items-center gap-2 md:hidden">
            <span className="text-sm font-semibold">Mercado Automotor PY</span>
          </Link>
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
          </div>
        </header>
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
