"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { MenuLateral } from "@/components/layout/menu-lateral";
import { PaletaComandos } from "@/components/layout/paleta-comandos";
import { Avatar } from "@/components/perfil/avatar";
import { IconBuscar } from "@/components/icons";
import type { PerfilVisible } from "@/lib/auth/perfil";
import { COOKIE_MENU, MENU_DESPLEGADO, MENU_PLEGADO } from "@/lib/menu";
import { cn } from "@/lib/utils";

const ANCHO_MENU = "15rem";
/** Dentro o fuera de un iframe no cambia mientras la página vive: no hay nada
 *  a lo que suscribirse. useSyncExternalStore es la forma de leer «¿estoy en
 *  un frame?» sin diferencia de hidratación (el servidor responde `false`). */
const sinSuscripcion = () => () => {};
const ANCHO_MENU_PLEGADO = "4.5rem";

export function AppShell({
  children,
  sinClave = false,
  esAdmin = true,
  embebidoPorUrl = false,
  perfil = null,
  menuPlegadoInicial = false,
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
  /** true cuando la URL trae `?embed=1` (lo lee el layout vía la cabecera
   *  que deja src/proxy.ts). Ver `embebido` abajo. */
  embebidoPorUrl?: boolean;
  /** Quién está mirando (nombre, rol, foto). Lo arma el layout, que es el que
   *  ve la cookie; null cuando no hay sesión (tablero abierto). */
  perfil?: PerfilVisible | null;
  /** Estado de la cookie del menú, leído en el servidor. */
  menuPlegadoInicial?: boolean;
}) {
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [paletaAbierta, setPaletaAbierta] = React.useState(false);
  const [plegado, setPlegado] = React.useState(menuPlegadoInicial);
  const [animarEtiquetas, setAnimarEtiquetas] = React.useState(false);
  const pathname = usePathname();
  // Modo embebido (Croman, 17/09/2026): presentacion.santarosa.lat muestra el
  // Bubble chart dentro de su propio tablero, en un iframe. Ahí el menú y la
  // barra de marca sobran —el tablero de afuera ya tiene los suyos— y
  // quedaría un marco adentro de otro marco. Se detecta de dos formas que se
  // complementan: `?embed=1` en la URL (lo pone el iframe; llega ya en el
  // render del servidor, así no hay parpadeo) y, por si un filtro reescribe
  // la query y pierde el parámetro, el hecho de estar adentro de un frame.
  // Fuera de un frame, sin el parámetro, no cambia nada.
  const enFrame = React.useSyncExternalStore(
    sinSuscripcion,
    () => window.self !== window.top,
    () => false
  );
  const embebido = embebidoPorUrl || enFrame;
  // La pantalla de acceso NO lleva el marco de la app: mostrar el menú de
  // veintidós secciones detrás del login sería enseñar el mapa de lo que
  // justamente todavía no se puede ver. Las pantallas de acceso (entrar,
  // olvidé mi clave, poner clave con el enlace) van sin menú ni cabecera:
  // quien está ahí todavía no entró.
  const esAcceso =
    pathname === "/entrar" || pathname.startsWith("/entrar/") || pathname === "/restablecer";
  const conMarco = !esAcceso && !embebido;

  // Cajón móvil (guía "navigation-drawer" de modern-web-guidance): Escape
  // lo cierra, el foco entra al abrirlo y vuelve al botón al cerrarlo, y
  // el botón declara qué abre y si está abierto.
  const botonMenu = React.useRef<HTMLButtonElement>(null);
  const botonCerrar = React.useRef<HTMLButtonElement>(null);
  const estabaAbierto = React.useRef(false);
  React.useEffect(() => {
    if (mobileOpen) {
      estabaAbierto.current = true;
      // Después de la transición de entrada: enfocar antes mueve el scroll.
      const t = window.setTimeout(() => botonCerrar.current?.focus(), 320);
      const alTeclear = (e: KeyboardEvent) => {
        if (e.key === "Escape") setMobileOpen(false);
      };
      document.addEventListener("keydown", alTeclear);
      return () => {
        window.clearTimeout(t);
        document.removeEventListener("keydown", alTeclear);
      };
    }
    if (estabaAbierto.current) {
      estabaAbierto.current = false;
      botonMenu.current?.focus();
    }
  }, [mobileOpen]);

  // Ctrl/⌘ + K abre y cierra la paleta en cualquier pantalla con marco.
  React.useEffect(() => {
    if (!conMarco) return;
    const alTeclear = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletaAbierta((abierta) => !abierta);
      }
    };
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, [conMarco]);

  const alternarPlegado = () => {
    const nuevo = !plegado;
    setPlegado(nuevo);
    setAnimarEtiquetas(true);
    document.cookie =
      `${COOKIE_MENU}=${nuevo ? MENU_PLEGADO : MENU_DESPLEGADO}; path=/; max-age=31536000; samesite=lax` +
      (window.location.protocol === "https:" ? "; secure" : "");
  };
  const abrirPaleta = () => {
    setMobileOpen(false);
    setPaletaAbierta(true);
  };

  if (esAcceso) {
    return <>{children}</>;
  }

  if (embebido) {
    return (
      <div className="flex w-full flex-col">
        {sinClave && <AvisoSinClave />}
        {/* Solo el contenido, con el mismo aire que <main> tiene en la app.
            Sin `min-h-screen`: el alto tiene que ser el del contenido, porque
            el tablero de afuera ajusta el iframe a esa medida (AvisarAlto) y
            un mínimo de 100vh haría que nunca pudiera achicarse. El enlace
            para abrirlo aparte lo pone el tablero que embebe. */}
        <main id="contenido" tabIndex={-1} className="min-w-0 flex-1 p-4 outline-none md:p-6">
          {children}
        </main>
        <AvisarAlto />
      </div>
    );
  }

  return (
    // Columna, no fila: la barra de marca cruza TODO el ancho arriba de todo
    // y el rail cuelga debajo. Antes la barra empezaba al costado del rail y
    // chocaba contra el bloque blanco de marca que el rail traía — dos
    // cabeceras de alturas distintas (56 y 64px) y colores opuestos pegadas,
    // con la misma marca escrita dos veces.
    <div className="flex min-h-screen w-full flex-col">
      {/* Enlace para saltar el menú: invisible hasta que recibe el foco
          con Tab. Quien navega con teclado o lector de pantalla no tiene
          que pasar por veintidós renglones en cada página. */}
      <a
        href="#contenido"
        className="sr-only z-[60] rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
      >
        Saltar al contenido
      </a>
      <BarraMarca
        onAbrirMenu={() => setMobileOpen(true)}
        onBuscar={abrirPaleta}
        abierto={mobileOpen}
        refBoton={botonMenu}
        perfil={perfil}
      />

      {sinClave && <AvisoSinClave />}

      <div className="flex min-h-0 w-full flex-1">
        {/* Rail de escritorio: fijo mientras el contenido scrollea.
            `self-start` es lo que lo hace posible: sin eso el aside se
            estira a la altura del contenido (align-items: stretch) y
            `sticky` no tiene margen para pegarse. Alto = viewport menos la
            barra de marca (56px).

            Es un PANEL NAVY PLENO, continuo con la barra de marca de arriba
            (rediseño 2026-09): juntos forman un marco en L alrededor del
            contenido claro. Sin borde, sin radio, sin sombra: navy contra
            lienzo claro no necesita ninguna de las tres.

            El ancho lo decide `plegado` (15rem o 4.5rem). No se anima: mover
            el ancho obliga a recalcular el layout de todos los gráficos en
            cada cuadro, y se ve peor que el salto. */}
        <aside
          aria-label="Menú principal"
          className="sticky top-14 hidden h-[calc(100dvh-3.5rem)] shrink-0 self-start overflow-hidden md:flex md:flex-col"
          style={{
            width: plegado ? ANCHO_MENU_PLEGADO : ANCHO_MENU,
            // Un brillo suave arriba y un oscurecido hacia el pie, como la
            // referencia: profundidad sin textura ni imagen. El color base
            // sigue siendo el token —el degradado es un velo encima.
            backgroundColor: "var(--barra)",
            backgroundImage:
              "radial-gradient(140% 50% at 50% 0%, rgba(255,255,255,0.07), transparent 55%), linear-gradient(180deg, transparent 40%, rgba(0,0,0,0.25) 100%)",
            color: "var(--barra-foreground)",
          }}
        >
          <MenuLateral
            perfil={perfil}
            esAdmin={esAdmin}
            colapsado={plegado}
            onAlternar={alternarPlegado}
            onBuscar={abrirPaleta}
            animarEtiquetas={animarEtiquetas}
          />
        </aside>

        {/* Cajón móvil (overlay). Siempre montado (no `{mobileOpen && ...}`):
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
          {/* Telón en el navy de la marca y no en negro puro: un negro
              neutro se lee sucio contra la barra azul. */}
          <div
            className="fixed inset-0 transition-opacity duration-200 ease-out"
            style={{
              opacity: mobileOpen ? 1 : 0,
              backgroundColor: "color-mix(in oklab, var(--barra) 68%, transparent)",
            }}
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <aside
            id="menu-movil"
            role="dialog"
            aria-modal="true"
            aria-label="Menú"
            className="relative flex w-72 max-w-[85vw] flex-col shadow-xl transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]"
            style={{
              translate: mobileOpen ? "0" : "-100%",
              backgroundColor: "var(--barra)",
              backgroundImage:
                "radial-gradient(140% 50% at 50% 0%, rgba(255,255,255,0.07), transparent 55%), linear-gradient(180deg, transparent 40%, rgba(0,0,0,0.25) 100%)",
              color: "var(--barra-foreground)",
            }}
          >
            <div className="flex h-14 shrink-0 items-center justify-between border-b border-white/10 px-4">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold tracking-tight">
                  Mercado Automotor PY
                </span>
              </div>
              <Button
                ref={botonCerrar}
                variant="ghost"
                size="icon"
                className="size-8 text-base leading-none text-white/80 hover:bg-white/10 hover:text-white"
                aria-label="Cerrar menú"
                onClick={() => setMobileOpen(false)}
              >
                ✕
              </Button>
            </div>
            <MenuLateral
              perfil={perfil}
              esAdmin={esAdmin}
              onBuscar={abrirPaleta}
              onNavigate={() => setMobileOpen(false)}
            />
          </aside>
        </div>

        {/* Único punto de padding de todo el contenido: ningún page.tsx
            trae el suyo (confirmado: 0px de gap real entre el header y el
            H1, medido en vivo — no era percepción). Vive acá para que las
            pantallas lo hereden parejo en vez de repetirlo en cada una. */}
        <main id="contenido" tabIndex={-1} className="min-w-0 flex-1 p-4 outline-none md:p-6">{children}</main>
      </div>

      <PaletaComandos
        abierta={paletaAbierta}
        onCerrar={() => setPaletaAbierta(false)}
        esAdmin={esAdmin}
        conCuenta={!!perfil && !perfil.emergencia}
      />
    </div>
  );
}

/**
 * Modo embebido: le avisa al tablero que embebe (presentacion.santarosa.lat)
 * cuánto mide el contenido, para que ajuste el alto del iframe y la página de
 * afuera scrollee entera, sin un scroll adentro de otro. Se manda solo a ese
 * origen: es el único que puede enmarcar la app (ver frame-ancestors en
 * next.config.ts).
 */
function AvisarAlto() {
  React.useEffect(() => {
    if (window.self === window.top) return;
    const destino = "https://presentacion.santarosa.lat";
    const avisar = () => {
      window.parent.postMessage(
        { tipo: "advisor-alto", alto: document.documentElement.scrollHeight },
        destino
      );
    };
    avisar();
    const ro = new ResizeObserver(avisar);
    ro.observe(document.body);
    window.addEventListener("load", avisar);
    return () => {
      ro.disconnect();
      window.removeEventListener("load", avisar);
    };
  }, []);
  return null;
}

/**
 * Barra de marca, a todo el ancho y arriba de todo.
 *
 * Opaca y en el navy del logo, no translúcida: es la firma de Santa Rosa y
 * tiene que leerse igual sobre cualquier contenido que pase por debajo.
 * Cruza el ancho completo (rail incluido) porque si arrancara al costado
 * choca contra el rail, que es una tarjeta blanca — dos cabeceras pegadas,
 * de distinto alto y color opuesto.
 *
 * En el celular, donde el menú queda escondido en el cajón, la barra suma la
 * lupa (la paleta de comandos) y la cara de quien está mirando, que lleva a
 * «Mi cuenta»: el mismo lugar que tiene en la parte de arriba del menú de
 * escritorio.
 */
function BarraMarca({
  onAbrirMenu,
  onBuscar,
  abierto,
  refBoton,
  perfil,
}: {
  onAbrirMenu: () => void;
  onBuscar: () => void;
  abierto: boolean;
  refBoton: React.RefObject<HTMLButtonElement | null>;
  perfil: PerfilVisible | null;
}) {
  return (
    <header
      className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-3 px-4 shadow-[0_10px_20px_-16px_oklch(0_0_0/45%)]"
      style={{ backgroundColor: "var(--barra)", color: "var(--barra-foreground)" }}
    >
      <Button
        ref={refBoton}
        variant="ghost"
        size="icon"
        className="size-8 text-base leading-none text-[var(--barra-foreground)] hover:bg-white/10 hover:text-[var(--barra-foreground)] md:hidden"
        aria-label="Abrir menú"
        aria-expanded={abierto}
        aria-controls="menu-movil"
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
        <span className="hidden h-5 w-px shrink-0 bg-white/25 sm:block" aria-hidden="true" />
        <span className="hidden min-w-0 flex-col leading-tight sm:flex">
          <span className="truncate text-[0.7rem] font-bold uppercase tracking-[0.14em]">
            Mercado Automotor
          </span>
          <span
            className="truncate text-[0.65rem] font-medium uppercase tracking-[0.12em]"
            style={{ color: "var(--barra-muted)" }}
          >
            Inteligencia comercial · Paraguay
          </span>
        </span>
      </Link>
      <div className="ml-auto flex items-center gap-1.5">
        <Button
          variant="ghost"
          size="icon"
          className="text-[var(--barra-foreground)] hover:bg-white/10 hover:text-[var(--barra-foreground)] md:hidden"
          aria-label="Buscar pantalla"
          onClick={onBuscar}
        >
          <IconBuscar size={17} />
        </Button>
        {perfil && (
          <Link
            href="/mi-cuenta"
            aria-label={`Mi cuenta, ${perfil.nombre}`}
            className="grid size-10 place-items-center rounded-full outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-[var(--barra-foreground)]/60 md:hidden"
          >
            <Avatar nombre={perfil.nombre} fotoUrl={perfil.fotoUrl} tamano="sm" sobre="navy" />
          </Link>
        )}
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
