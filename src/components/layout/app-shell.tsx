"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { salir } from "@/app/entrar/acciones";
import { cn } from "@/lib/utils";

export function AppShell({
  children,
  sinClave = false,
  esAdmin = true,
}: {
  children: React.ReactNode;
  /** true cuando falta ADVISOR_CLAVE, o sea que el tablero esta abierto a
   *  quien tenga la URL. Ver src/proxy.ts: la puerta falla ABIERTA a
   *  proposito para no dejar al equipo afuera en el deploy, y este aviso es
   *  la contrapartida — el riesgo tiene que verse, no quedar en silencio. */
  sinClave?: boolean;
  /** Rol de quien esta mirando. Se calcula en el layout (Server Component,
   *  unico lugar donde se puede leer la cookie) y baja hasta el menu: un
   *  lector no ve el renglon de Configuracion. */
  esAdmin?: boolean;
}) {
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const pathname = usePathname();

  // La pantalla de acceso NO lleva el marco de la app: mostrar el menú de
  // trece secciones detrás del login sería enseñar el mapa de lo que
  // justamente todavía no se puede ver.
  if (pathname === "/entrar") return <>{children}</>;

  return (
    // Columna, no fila: la barra de marca cruza TODO el ancho arriba de todo
    // y el rail cuelga debajo. Antes la barra empezaba al costado del rail y
    // chocaba contra el bloque blanco de marca que el rail traía — dos
    // cabeceras de alturas distintas (56 y 64px) y colores opuestos pegadas,
    // con la misma marca escrita dos veces.
    <div className="flex min-h-screen w-full flex-col">
      <BarraMarca onAbrirMenu={() => setMobileOpen(true)} />

      {sinClave && <AvisoSinClave />}

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
        {/* Rediseño 2026-09 ("mas moderno"): el rail dejo de ser una tarjeta
            blanca flotante — la iteracion anterior solo refino el item activo
            y no se notaba. Ahora es un PANEL NAVY PLENO, continuo con la
            barra de marca de arriba: juntos forman un marco en L alrededor
            del contenido claro. Es el patron de sidebar oscura de las apps
            actuales, y ademas el navy es el color de la referencia que
            Croman eligio. Sin borde, sin radio, sin sombra: navy contra
            lienzo claro no necesita ninguna de las tres. */}
        <aside
          className="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-60 shrink-0 self-start overflow-hidden md:flex md:flex-col"
          style={{
            // Un brillo suave arriba y un oscurecido hacia el pie, como la
            // referencia: profundidad sin textura ni imagen. El color base
            // sigue siendo el token —el degradado es un velo encima.
            backgroundColor: "var(--barra)",
            backgroundImage:
              "radial-gradient(140% 50% at 50% 0%, rgba(255,255,255,0.07), transparent 55%), linear-gradient(180deg, transparent 40%, rgba(0,0,0,0.25) 100%)",
            color: "var(--barra-foreground)",
          }}
        >
          <div className="flex-1 overflow-y-auto py-4">
            <SidebarNav esAdmin={esAdmin} />
          </div>
          <div className="flex flex-col gap-2 border-t border-white/10 p-3">
            <span className="text-[11px] leading-snug text-white/50">
              Santa Rosa Paraguay S.A.
              <br />
              Inteligencia Comercial
            </span>
            {!sinClave && (
              // Solo si hay clave: sin ella no hay sesión que cerrar y el
              // botón prometería algo que no hace.
              <form action={salir}>
                <button
                  type="submit"
                  className="w-full rounded-md px-2 py-1.5 text-left text-xs text-white/60 transition-colors hover:bg-white/10 hover:text-white pointer-coarse:min-h-9"
                >
                  Cerrar sesión
                </button>
              </form>
            )}
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
          className="relative flex w-72 flex-col shadow-xl transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]"
          style={{
            translate: mobileOpen ? "0" : "-100%",
            backgroundColor: "var(--barra)",
            backgroundImage:
              "radial-gradient(140% 50% at 50% 0%, rgba(255,255,255,0.07), transparent 55%), linear-gradient(180deg, transparent 40%, rgba(0,0,0,0.25) 100%)",
            color: "var(--barra-foreground)",
          }}
        >
          <div className="flex h-14 items-center justify-between border-b border-white/10 px-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold tracking-tight">
                Mercado Automotor PY
              </span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="size-8 text-base leading-none text-white/80 hover:bg-white/10 hover:text-white"
              aria-label="Cerrar menú"
              onClick={() => setMobileOpen(false)}
            >
              ✕
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto py-3">
            <SidebarNav esAdmin={esAdmin} onNavigate={() => setMobileOpen(false)} />
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

/**
 * Franja de "este tablero es publico".
 *
 * Fea a proposito: tiene que molestar hasta que alguien ponga la clave. Un
 * aviso discreto en un tablero que se mira todos los dias se vuelve parte
 * del mobiliario en una semana, y entonces deja de avisar.
 *
 * No lleva boton para cerrarla: no es una notificacion, es un estado.
 */
function AvisoSinClave() {
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 border-b border-rose-700/40 bg-rose-600 px-4 py-2 text-center text-[0.8rem] font-medium text-white"
    >
      <span className="font-bold uppercase tracking-wide">Tablero sin clave</span>
      <span className="opacity-95">
        Cualquiera con la URL ve el stock, los precios y la inteligencia de
        competencia. Definí <code className="font-mono">ADVISOR_CLAVE</code> en
        el entorno del servidor para cerrarlo.
      </span>
    </div>
  );
}
