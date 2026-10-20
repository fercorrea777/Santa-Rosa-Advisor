"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import { ALIAS_NAV, navPara } from "@/lib/nav";
import { salir } from "@/app/entrar/acciones";
import { ICONOS } from "@/components/layout/iconos-nav";
import { IconBuscar, IconLuna, IconSalir, IconSol, IconCamara } from "@/components/icons";

/**
 * Paleta de comandos (Ctrl/⌘ + K): saltar a cualquier pantalla escribiendo.
 *
 * El menú tiene 22 renglones en cuatro grupos. Con el mouse alcanza, pero
 * quien ya sabe adónde va ("brecha", "copiloto", "calidad") pierde más tiempo
 * recorriendo el menú que el que tarda en escribirlo; y en la reunión del
 * lunes, proyectado, es la forma de ir de una pantalla a otra sin buscar con
 * el cursor. Es el mismo patrón que ya usa Gestión de Compras.
 *
 * <dialog> NATIVO con showModal(): el navegador se ocupa de atrapar el foco,
 * de cerrar con Escape, de dejar inerte lo de atrás y de devolver el foco a
 * quien lo abrió. Lo único propio es el combobox de adentro (lista + flechas).
 */

interface Entrada {
  id: string;
  etiqueta: string;
  grupo: string;
  pista?: string;
  /** Otros nombres con los que se la conoce: solo para encontrarla. */
  alias?: string;
  icono: React.ReactNode;
  /** Destino de navegación… */
  href?: string;
  /** …o una acción que no es una pantalla. */
  accion?: "tema" | "salir";
}

const sinTildes = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

/** Cuántos resultados se muestran mientras se escribe: más que eso es una
 *  lista para recorrer, no un buscador. */
const TOPE_RESULTADOS = 9;

export function PaletaComandos({
  abierta,
  onCerrar,
  esAdmin,
  conCuenta,
}: {
  abierta: boolean;
  onCerrar: () => void;
  esAdmin: boolean;
  /** Hay sesión de persona: se ofrecen «Mi cuenta» y «Cerrar sesión». */
  conCuenta: boolean;
}) {
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const dialogo = React.useRef<HTMLDialogElement>(null);
  const entrada = React.useRef<HTMLInputElement>(null);
  const formSalir = React.useRef<HTMLFormElement>(null);
  const [consulta, setConsulta] = React.useState("");
  const [activa, setActiva] = React.useState(0);
  const idLista = React.useId();
  const esOscuro = resolvedTheme === "dark";

  const entradas = React.useMemo<Entrada[]>(() => {
    const pantallas: Entrada[] = navPara(esAdmin).flatMap((g) =>
      g.items.map((i) => {
        const Icono = ICONOS[i.icono];
        return {
          id: i.href,
          etiqueta: i.label,
          grupo: g.titulo,
          pista: i.pista,
          alias: ALIAS_NAV[i.href],
          icono: <Icono size={16} />,
          href: i.href,
        };
      })
    );
    const cuenta: Entrada[] = [
      ...(conCuenta
        ? [{
            id: "mi-cuenta", etiqueta: "Mi cuenta", grupo: "Cuenta",
            pista: "Tu foto, tus datos y tu clave.", icono: <IconCamara size={16} />, href: "/mi-cuenta",
          }]
        : []),
      {
        id: "tema", etiqueta: esOscuro ? "Cambiar a modo claro" : "Cambiar a modo oscuro", grupo: "Cuenta",
        pista: "El oscuro está pensado para la sala de reuniones.",
        icono: esOscuro ? <IconSol size={16} /> : <IconLuna size={16} />, accion: "tema" as const,
      },
      ...(conCuenta
        ? [{
            id: "salir", etiqueta: "Cerrar sesión", grupo: "Cuenta",
            pista: "Salir de este equipo.", icono: <IconSalir size={16} />, accion: "salir" as const,
          }]
        : []),
    ];
    return [...pantallas, ...cuenta];
  }, [esAdmin, conCuenta, esOscuro]);

  const resultados = React.useMemo(() => {
    const fichas = sinTildes(consulta).split(/\s+/).filter(Boolean);
    if (fichas.length === 0) return entradas;
    const puntuadas: { e: Entrada; punto: number }[] = [];
    for (const e of entradas) {
      const nombre = sinTildes(`${e.etiqueta} ${e.alias ?? ""}`);
      const resto = sinTildes(`${e.grupo} ${e.pista ?? ""}`);
      let punto = 0;
      let todas = true;
      for (const f of fichas) {
        if (nombre.startsWith(f)) punto += 3;
        else if (nombre.includes(` ${f}`)) punto += 2.5;
        else if (nombre.includes(f)) punto += 2;
        else if (resto.includes(f)) punto += 0.5;
        else {
          todas = false;
          break;
        }
      }
      if (todas) puntuadas.push({ e, punto });
    }
    // sort es estable: a igual puntaje queda el orden del menú.
    return puntuadas.sort((a, b) => b.punto - a.punto).slice(0, TOPE_RESULTADOS).map((x) => x.e);
  }, [consulta, entradas]);

  // Abrir y cerrar el <dialog> nativo según la prop.
  React.useEffect(() => {
    const d = dialogo.current;
    if (!d) return;
    if (abierta && !d.open) {
      setConsulta("");
      setActiva(0);
      d.showModal();
      entrada.current?.focus();
    } else if (!abierta && d.open) {
      d.close();
    }
  }, [abierta]);

  // La opción activa siempre a la vista.
  React.useEffect(() => {
    if (!abierta) return;
    document.getElementById(`${idLista}-${activa}`)?.scrollIntoView({ block: "nearest" });
  }, [activa, abierta, idLista, resultados]);

  const ejecutar = (e: Entrada | undefined) => {
    if (!e) return;
    onCerrar();
    if (e.href) router.push(e.href);
    else if (e.accion === "tema") setTheme(esOscuro ? "light" : "dark");
    else if (e.accion === "salir") formSalir.current?.requestSubmit();
  };

  const alTeclear = (ev: React.KeyboardEvent<HTMLInputElement>) => {
    const n = resultados.length;
    if (n === 0) return;
    if (ev.key === "ArrowDown") {
      ev.preventDefault();
      setActiva((a) => (a + 1) % n);
    } else if (ev.key === "ArrowUp") {
      ev.preventDefault();
      setActiva((a) => (a - 1 + n) % n);
    } else if (ev.key === "Home") {
      ev.preventDefault();
      setActiva(0);
    } else if (ev.key === "End") {
      ev.preventDefault();
      setActiva(n - 1);
    } else if (ev.key === "Enter") {
      ev.preventDefault();
      ejecutar(resultados[Math.min(activa, n - 1)]);
    }
  };

  // Con la consulta vacía se muestran los grupos con su encabezado; escribiendo,
  // una lista plana donde el grupo va como dato al costado.
  const agrupada = consulta.trim() === "";

  return (
    <dialog
      ref={dialogo}
      aria-label="Buscar pantalla"
      onClose={onCerrar}
      // Un clic en el telón (el propio <dialog>, fuera de la caja) cierra.
      onClick={(e) => {
        if (e.target === e.currentTarget) onCerrar();
      }}
      className="paleta fixed inset-0 m-auto mt-[11vh] w-[min(40rem,92vw)] max-w-none overflow-hidden rounded-2xl border border-border bg-popover p-0 text-popover-foreground shadow-[0_30px_80px_-20px_oklch(0.15_0.06_277/0.7)] backdrop:bg-[oklch(0.2_0.07_277/0.55)] open:flex open:flex-col"
    >
      <form ref={formSalir} action={salir} className="hidden" />
      <div className="flex items-center gap-3 border-b border-border px-4">
        <IconBuscar size={18} className="shrink-0 text-muted-foreground" />
        <input
          ref={entrada}
          role="combobox"
          aria-expanded="true"
          aria-controls={idLista}
          aria-activedescendant={resultados.length ? `${idLista}-${Math.min(activa, resultados.length - 1)}` : undefined}
          aria-autocomplete="list"
          aria-label="Buscar una pantalla o una acción"
          type="text"
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          placeholder="Buscar una pantalla o una acción…"
          value={consulta}
          onChange={(e) => {
            setConsulta(e.target.value);
            setActiva(0);
          }}
          onKeyDown={alTeclear}
          className="h-14 min-w-0 flex-1 bg-transparent text-[0.95rem] outline-none placeholder:text-muted-foreground"
        />
        <kbd className="hidden rounded-md border border-border px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:block">
          esc
        </kbd>
      </div>

      <ul
        id={idLista}
        role="listbox"
        aria-label="Resultados"
        className="max-h-[min(26rem,60vh)] overflow-y-auto overscroll-contain p-2"
      >
        {resultados.map((e, i) => {
          const encabezado = agrupada && (i === 0 || resultados[i - 1].grupo !== e.grupo);
          const esActiva = i === Math.min(activa, resultados.length - 1);
          return (
            <React.Fragment key={e.id}>
              {encabezado && (
                <li role="presentation" className="px-2 pb-1 pt-2.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground first:pt-1">
                  {e.grupo}
                </li>
              )}
              <li
                id={`${idLista}-${i}`}
                role="option"
                aria-selected={esActiva}
                onPointerMove={() => setActiva(i)}
                onClick={() => ejecutar(e)}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-xl px-2.5 py-2 text-sm",
                  esActiva ? "bg-primary/10 text-foreground" : "text-foreground/85"
                )}
              >
                <span
                  className={cn(
                    "grid size-8 shrink-0 place-items-center rounded-lg",
                    esActiva ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  )}
                >
                  {e.icono}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{e.etiqueta}</span>
                  {e.pista && (
                    <span className="block truncate text-xs text-muted-foreground">{e.pista}</span>
                  )}
                </span>
                {!agrupada && (
                  <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                    {e.grupo}
                  </span>
                )}
              </li>
            </React.Fragment>
          );
        })}
      </ul>

      {resultados.length === 0 && (
        <p role="status" className="px-4 pb-6 pt-4 text-center text-sm text-muted-foreground">
          Nada coincide con «{consulta.trim()}». Probá con otra palabra: «brecha», «precios», «copiloto».
        </p>
      )}
      {/* Anuncia cuántos resultados hay sin mover el foco. */}
      <p className="sr-only" role="status" aria-live="polite">
        {resultados.length === 0 ? "Sin resultados" : `${resultados.length} resultados`}
      </p>

      <div className="hidden items-center gap-4 border-t border-border bg-muted/40 px-4 py-2 text-[11px] text-muted-foreground sm:flex">
        <span><kbd className="font-mono">↑↓</kbd> moverse</span>
        <span><kbd className="font-mono">↵</kbd> abrir</span>
        <span><kbd className="font-mono">esc</kbd> cerrar</span>
      </div>
    </dialog>
  );
}
