"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { cn } from "@/lib/utils";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = React.useState(false);

  return (
    // Columna, no fila: la barra de marca cruza TODO el ancho arriba de todo
    // y el rail cuelga debajo. Antes la barra empezaba al costado del rail y
    // chocaba contra el bloque blanco de marca que el rail traía — dos
    // cabeceras de alturas distintas (56 y 64px) y colores opuestos pegadas,
    // con la misma marca escrita dos veces.
    <div className="flex min-h-screen w-full flex-col">
      <BarraMarca onAbrirMenu={() => setMobileOpen(true)} />

      <div className="flex min-h-0 w-full flex-1">
        {/* Sidebar desktop: fijo mientras el contenido scrollea.
            `self-start` es lo que lo hace posible: sin eso el aside se
            estira a la altura del contenido (align-items: stretch) y
            `sticky` no tiene margen para pegarse.

            El aire arriba, abajo y a la izquierda es el MISMO que el
            padding de <main> (p-6 = 24px), así el borde de la tarjeta
            arranca a la altura del H1 en vez de 12px más arriba:
            top = 56px de barra + 24, alto = viewport menos esos 80 y otros
            24 abajo. */}
        {/* Rail bento: tarjeta flotante redondeada separada del lienzo, no
            columna pegada al borde. Mantiene labels (13 secciones con ícono
            solo sería adivinanza). El bloque de marca salió de acá: ahora
            vive en la barra superior, que se ve también en móvil. */}
        <aside className="sticky top-20 ml-6 hidden h-[calc(100vh-6.5rem)] w-60 shrink-0 self-start overflow-hidden rounded-3xl border bg-card text-sidebar-foreground shadow-[var(--card-shadow)] md:flex md:flex-col">
          <div className="flex-1 overflow-y-auto py-3">
            <SidebarNav />
          </div>
          <div className="border-t p-3 text-[11px] leading-snug text-muted-foreground">
            Santa Rosa Paraguay S.A.
            <br />
            Inteligencia Comercial
          </div>
        </aside>

      {/* Sidebar mobile (overlay). Siempre montado (no `{mobileOpen && ...}`):
          la entrada sola con clases condicionales no alcanza para animar
          tambien la SALIDA, porque al desmontar React corta la transicion
          a mitad de camino. `inert` saca el drawer cerrado del tab order y
          del hit-testing sin pelear con el foco como haría `aria-hidden`. */}
      <div
        className={cn(
          "fixed inset-0 z-50 flex md:hidden",
          !mobileOpen && "pointer-events-none"
        )}
        inert={!mobileOpen}
      >
        <div
          className="fixed inset-0 bg-black/50 transition-opacity duration-200 ease-out"
          style={{ opacity: mobileOpen ? 1 : 0 }}
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
        <aside
          className="relative flex w-72 flex-col bg-sidebar text-sidebar-foreground shadow-xl transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]"
          style={{ translate: mobileOpen ? "0" : "-100%" }}
        >
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

        {/* Único punto de padding de todo el contenido: ningún page.tsx
            trae el suyo (confirmado: 0px de gap real entre el header y el
            H1, medido en vivo — no era percepción). Vive acá para que las
            13 pantallas lo hereden parejo en vez de repetirlo 13 veces. */}
        <main className="min-w-0 flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}

/**
 * Barra de marca, a todo el ancho y arriba de todo.
 *
 * Opaca y en el navy del logo, no translúcida: es la firma de Santa Rosa y
 * tiene que leerse igual sobre cualquier contenido que pase por debajo.
 * Cruza el ancho completo (rail incluido) porque si arrancara al costado
 * choca contra el rail, que es una tarjeta blanca — dos cabeceras pegadas,
 * de distinto alto y color opuesto.
 */
function BarraMarca({ onAbrirMenu }: { onAbrirMenu: () => void }) {
  return (
    <header
      className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-3 px-4 shadow-[0_10px_20px_-16px_oklch(0_0_0/45%)]"
      style={{ backgroundColor: "var(--barra)", color: "var(--barra-foreground)" }}
    >
      <Button
        variant="ghost"
        size="icon"
        className="size-8 text-base leading-none text-[var(--barra-foreground)] hover:bg-white/10 hover:text-[var(--barra-foreground)] md:hidden"
        aria-label="Abrir menú"
        onClick={onAbrirMenu}
      >
        ≡
      </Button>
      <Link
        href="/"
        className="flex min-w-0 items-center gap-3 pointer-coarse:min-h-11"
        aria-label="Mercado Automotor PY — inicio"
      >
        {/* El logo es negro sobre transparente; invert lo pasa a blanco
            para el navy. brightness-0 primero, para aplanar el azul del
            monograma y que invierta parejo en vez de salir amarillo. */}
        <Image
          src="/logo-santa-rosa.png"
          alt="Santa Rosa"
          width={311}
          height={32}
          priority
          className="h-4 w-auto shrink-0 brightness-0 invert"
        />
        <span className="hidden h-5 w-px shrink-0 bg-white/25 sm:block" />
        <span className="hidden min-w-0 flex-col leading-tight sm:flex">
          <span className="truncate text-[0.7rem] font-bold uppercase tracking-[0.14em]">
            Mercado Automotor
          </span>
          <span
            className="truncate text-[0.6rem] font-medium uppercase tracking-[0.12em]"
            style={{ color: "var(--barra-muted)" }}
          >
            Inteligencia comercial · Paraguay
          </span>
        </span>
      </Link>
      <div className="ml-auto flex items-center gap-2">
        <ThemeToggle />
      </div>
    </header>
  );
}
