"use client";

import * as React from "react";
import Link from "next/link";
import { Menu, X, Gauge } from "lucide-react";
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
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 self-start border-r bg-sidebar text-sidebar-foreground md:flex md:flex-col">
        <div className="flex h-14 items-center gap-2.5 border-b px-4">
          <Gauge className="size-5 shrink-0 text-primary" />
          <span className="text-[0.8rem] font-semibold uppercase leading-tight tracking-[0.08em]">
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
                <Gauge className="size-5 text-primary" />
                <span className="text-sm font-semibold tracking-tight">
                  Mercado Automotor PY
                </span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                aria-label="Cerrar menú"
                onClick={() => setMobileOpen(false)}
              >
                <X className="size-4" />
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
        <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur supports-backdrop-filter:bg-background/60">
          <Button
            variant="ghost"
            size="icon"
            className="size-8 md:hidden"
            aria-label="Abrir menú"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="size-4" />
          </Button>
          <Link href="/" className="flex items-center gap-2 md:hidden">
            <Gauge className="size-5 text-primary" />
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
