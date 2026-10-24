"use client";

import * as React from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { Globito } from "@/components/ui/globito";
import { IconBrecha, IconEvolucion, IconMarketShare } from "@/components/icons";
import { useI18n } from "@/lib/i18n/cliente";

/**
 * El lado ilustrado de las pantallas de acceso: lo que hay adentro, sin dejar
 * ver lo que hay adentro.
 *
 * Es el panel izquierdo de la referencia de login que mandó Croman (tarjetas
 * flotando sobre un degradé, con el titular abajo), adaptado: el navy de la
 * marca con el cian de acento, y tarjetas que muestran QUÉ HACE el tablero
 * —una evolución, una participación, la brecha, el Copiloto contestando—
 * en vez de cifras de una cuenta de pagos.
 *
 * NO HAY NI UN NÚMERO REAL NI INVENTADO. Esto se ve antes de entrar: mostrar
 * cifras sería regalar datos de la empresa a quien llegue a la URL, y
 * inventarlas rompe la primera regla del producto (PRODUCT.md: nunca inventar
 * datos). Por eso las tarjetas son formas —una línea que sube, un anillo, dos
 * barras, renglones grises— y ningún dígito.
 *
 * Todo es CSS salvo el desplazamiento con el puntero (paralaje): cada capa se
 * corre un poco según dónde esté el mouse, y lo hace con variables CSS que se
 * escriben directo en el elemento, sin pasar por el estado de React.
 */
export function PanelIlustrado({ className }: { className?: string }) {
  const { t } = useI18n();
  const panel = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const el = panel.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let cuadro = 0;
    const alMover = (e: PointerEvent) => {
      cancelAnimationFrame(cuadro);
      cuadro = requestAnimationFrame(() => {
        const r = el.getBoundingClientRect();
        const px = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width - 0.5) * 2));
        const py = Math.max(-1, Math.min(1, ((e.clientY - r.top) / r.height - 0.5) * 2));
        el.style.setProperty("--px", px.toFixed(3));
        el.style.setProperty("--py", py.toFixed(3));
      });
    };
    window.addEventListener("pointermove", alMover, { passive: true });
    return () => {
      cancelAnimationFrame(cuadro);
      window.removeEventListener("pointermove", alMover);
    };
  }, []);

  return (
    <div
      ref={panel}
      aria-hidden="true"
      className={cn(
        "relative isolate flex-col justify-between overflow-hidden p-10 text-white xl:p-12",
        className
      )}
      style={{
        backgroundColor: "var(--barra)",
        // Un resplandor cian arriba a la izquierda, otro azul profundo abajo a la
        // derecha y la trama diagonal del fondo de la app: el mismo lenguaje.
        backgroundImage: [
          "radial-gradient(62% 48% at 18% 12%, oklch(0.78 0.135 205 / 0.34), transparent 70%)",
          "radial-gradient(58% 46% at 88% 92%, oklch(0.58 0.17 268 / 0.5), transparent 70%)",
          "repeating-linear-gradient(128deg, oklch(1 0 0 / 0.035) 0 1px, transparent 1px 3px)",
        ].join(", "),
      }}
    >
      <Image
        src="/logo-santa-rosa.png"
        alt=""
        width={311}
        height={32}
        priority
        className="h-5 w-auto self-start brightness-0 invert"
      />

      {/* El escenario: cinco capas a distinta profundidad. */}
      <div className="relative mx-auto my-8 h-[27rem] w-full max-w-[30rem] shrink-0">
        {/* 1 · La evolución: una línea que se dibuja sola. */}
        <Capa profundidad={14} className="left-0 top-2 w-[17.5rem]">
          <div className="acceso-entra" style={{ "--retraso": "0.1s" } as React.CSSProperties}>
            <div className="acceso-flota-a acceso-tarjeta p-4">
              <div className="flex items-center gap-2.5">
                <span className="grid size-7 place-items-center rounded-lg bg-[oklch(0.78_0.135_205)] text-[oklch(0.2_0.06_270)]">
                  <IconEvolucion size={15} />
                </span>
                <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-white/75">
                  {t("Matriculaciones")}
                </span>
              </div>
              <svg viewBox="0 0 200 64" className="mt-3 h-16 w-full overflow-visible">
                <defs>
                  <linearGradient id="panel-area" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#52deef" stopOpacity="0.38" />
                    <stop offset="1" stopColor="#52deef" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path
                  className="acceso-area"
                  d="M0 50 C 20 46, 30 54, 48 40 S 78 36, 96 27 S 128 34, 148 18 S 176 22, 200 8 L200 64 L0 64 Z"
                  fill="url(#panel-area)"
                />
                <path
                  className="acceso-traza"
                  pathLength={1}
                  d="M0 50 C 20 46, 30 54, 48 40 S 78 36, 96 27 S 128 34, 148 18 S 176 22, 200 8"
                  fill="none"
                  stroke="#7be9ff"
                  strokeWidth="2.6"
                  strokeLinecap="round"
                />
                <circle className="acceso-pulso" cx="200" cy="8" r="3" fill="#7be9ff" />
                <circle cx="200" cy="8" r="3.2" fill="#c4f8ff" />
              </svg>
              <div className="mt-2.5 flex items-center gap-2">
                <span className="h-2 w-16 rounded-full bg-white/25" />
                <span className="h-2 w-9 rounded-full bg-white/14" />
              </div>
            </div>
          </div>
        </Capa>

        {/* 2 · La fuente. */}
        <Capa profundidad={22} className="right-0 top-0">
          <div className="acceso-entra" style={{ "--retraso": "0.35s" } as React.CSSProperties}>
            <div className="acceso-flota-b acceso-tarjeta flex items-center gap-2 rounded-full px-3.5 py-2" style={{ "--retraso": "-3s" } as React.CSSProperties}>
              <span className="size-2 rounded-full bg-[#5be3a8] shadow-[0_0_8px_#5be3a8]" />
              <span className="text-[11px] font-medium text-white/85">CADAM / DNRA</span>
            </div>
          </div>
        </Capa>

        {/* 3 · La participación: un anillo que se llena. */}
        <Capa profundidad={9} className="left-[1.5rem] top-[11.6rem]">
          <div className="acceso-entra" style={{ "--retraso": "0.55s" } as React.CSSProperties}>
            <div className="acceso-flota-b acceso-tarjeta flex items-center gap-3 p-3.5" style={{ "--retraso": "-1.5s" } as React.CSSProperties}>
              <svg viewBox="0 0 44 44" className="size-[3.4rem] -rotate-90">
                <circle cx="22" cy="22" r="16" fill="none" stroke="oklch(1 0 0 / 0.1)" strokeWidth="6" />
                {[
                  { largo: 44, desde: 0, color: "#52deef", retraso: "0.9s" },
                  { largo: 26, desde: 46, color: "#4f8bf0", retraso: "1.15s" },
                  { largo: 16, desde: 74, color: "#9085e9", retraso: "1.4s" },
                ].map((a) => (
                  <circle
                    key={a.color}
                    className="acceso-arco"
                    cx="22"
                    cy="22"
                    r="16"
                    pathLength={100}
                    fill="none"
                    stroke={a.color}
                    strokeWidth="6"
                    strokeLinecap="round"
                    strokeDashoffset={-a.desde}
                    style={{ "--largo": a.largo, "--retraso": a.retraso } as React.CSSProperties}
                  />
                ))}
              </svg>
              <div className="flex flex-col gap-1.5">
                <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-white/70">
                  <IconMarketShare size={12} /> {t("Participación")}
                </span>
                <span className="h-2 w-14 rounded-full bg-white/22" />
              </div>
            </div>
          </div>
        </Capa>

        {/* 4 · La brecha: dos barras que respiran. */}
        <Capa profundidad={18} className="right-0 top-[8.6rem] w-[13rem]">
          <div className="acceso-entra" style={{ "--retraso": "0.75s" } as React.CSSProperties}>
            <div className="acceso-flota-a acceso-tarjeta p-3.5" style={{ "--retraso": "-4s" } as React.CSSProperties}>
              <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-white/70">
                <IconBrecha size={12} /> {t("Importar vs. patentar")}
              </span>
              <div className="mt-3 flex flex-col gap-2">
                <span className="acceso-barra h-2 w-full rounded-full bg-[#52deef]" />
                <span
                  className="acceso-barra h-2 w-full rounded-full bg-[#9085e9]"
                  style={{ "--retraso": "-1.6s" } as React.CSSProperties}
                />
              </div>
            </div>
          </div>
        </Capa>

        {/* 5 · El Copiloto contestando. */}
        <Capa profundidad={12} className="bottom-0 left-[0.75rem] w-[24.5rem] max-w-full">
          <div className="acceso-entra" style={{ "--retraso": "0.95s" } as React.CSSProperties}>
            <div className="acceso-flota-a acceso-tarjeta p-3.5" style={{ "--retraso": "-2.2s" } as React.CSSProperties}>
              <div className="flex items-start gap-3">
                <Globito tamano={34} flotar={false} seguirPuntero={false} className="mt-0.5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium leading-snug text-white/92">
                    <span className="acceso-escribe inline-block whitespace-nowrap">
                      {t("¿Qué marca ganó más participación este año?")}
                    </span>
                  </p>
                  <div className="acceso-respuesta mt-2.5 flex flex-col gap-1.5">
                    <span className="h-2 w-[92%] rounded-full bg-white/22" />
                    <span className="h-2 w-[68%] rounded-full bg-white/14" />
                    <span className="mt-0.5 inline-flex w-fit items-center gap-1.5 rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-white/65">
                      {t("cita de dónde sacó cada cifra")}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Capa>
      </div>

      <div className="max-w-md">
        <h2 className="text-[2rem] font-bold leading-[1.1] tracking-tight text-balance xl:text-[2.25rem]">
          {t("Del dato a la decisión, en un solo lugar.")}
        </h2>
        <p className="mt-3 max-w-sm text-sm leading-relaxed text-white/72 text-pretty">
          {t("Matriculaciones, importaciones, precios y stock propio, con un copiloto que contesta citando de dónde sacó cada cifra.")}
        </p>
      </div>
    </div>
  );
}

/** Una capa del escenario: se corre un poco con el puntero, más cuanto más
 *  «cerca» está (`profundidad`). Usa la propiedad `translate` y no `transform`
 *  para no pisar los movimientos CSS de las tarjetas que lleva adentro. */
function Capa({
  profundidad,
  className,
  children,
}: {
  profundidad: number;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn("absolute", className)}
      style={{
        translate: `calc(var(--px, 0) * ${-profundidad}px) calc(var(--py, 0) * ${-Math.round(profundidad * 0.6)}px)`,
        transition: "translate 340ms cubic-bezier(0.2, 0.8, 0.2, 1)",
      }}
    >
      {children}
    </div>
  );
}
