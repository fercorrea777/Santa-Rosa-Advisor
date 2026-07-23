import type { SVGProps } from "react";

/**
 * Set de íconos propio del proyecto — dibujados a mano, NO una librería.
 *
 * DESIGN.md prohíbe librerías de íconos (lucide et al.) para no caer en el
 * look genérico; el usuario pidió íconos finos de línea como su referencia
 * (2026-07-23). La salida: un set mínimo propio con reglas fijas, que es lo
 * que hace que un set se vea profesional:
 *   - viewBox 24, stroke 1.75, round cap/join, sin fill, currentColor
 *   - geometría simple alineada a la grilla, un solo concepto por ícono
 *   - tamaño por defecto 16px (nav) — a ese cuerpo el detalle fino ensucia
 */

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function base({ size = 16, ...props }: IconProps) {
  return {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.75,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true as const,
    ...props,
  };
}

/** Marca: velocímetro — arco de instrumento con aguja a fondo. */
export function LogoMark(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 15a8 8 0 0 1 16 0" />
      <path d="M12 15l4.2-4.2" />
      <circle cx="12" cy="15" r="1.4" fill="currentColor" stroke="none" />
      <path d="M5.5 18.5h13" />
    </svg>
  );
}

export function IconInicio(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 11l8-7 8 7" />
      <path d="M6 9.5V20h12V9.5" />
      <path d="M10 20v-5h4v5" />
    </svg>
  );
}

export function IconMercado(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 20h16" />
      <path d="M6.5 20v-7" />
      <path d="M12 20V5" />
      <path d="M17.5 20v-10" />
    </svg>
  );
}

export function IconEvolucion(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 17l5-5 3.5 3.5L19 9" />
      <path d="M19 13V9h-4" />
    </svg>
  );
}

export function IconRankings(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M9 20V10h6v10" />
      <path d="M4 20v-6h5" />
      <path d="M15 20v-4h5" />
      <path d="M4 20h16" />
    </svg>
  );
}

export function IconSegmentos(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="4" y="4" width="7" height="7" rx="1.5" />
      <rect x="13" y="4" width="7" height="7" rx="1.5" />
      <rect x="4" y="13" width="7" height="7" rx="1.5" />
      <rect x="13" y="13" width="7" height="7" rx="1.5" />
    </svg>
  );
}

export function IconCombustibles(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M13 3L5 13.5h5L11 21l8-10.5h-5L13 3z" />
    </svg>
  );
}

export function IconMarketShare(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 4v8l5.5 5.5" />
    </svg>
  );
}

export function IconBrecha(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 8.5h13" />
      <path d="M14 5l3.5 3.5L14 12" />
      <path d="M20 15.5H7" />
      <path d="M10 12l-3.5 3.5L10 19" />
    </svg>
  );
}

export function IconInteligencia(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z" />
      <path d="M18.5 16l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7.7-2z" />
    </svg>
  );
}

export function IconCopiloto(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M20 12a8 8 0 1 0-3.5 6.6L20 20l-.9-3.4A7.9 7.9 0 0 0 20 12z" />
      <path d="M8.5 10.5h7" />
      <path d="M8.5 14h4" />
    </svg>
  );
}

export function IconCargas(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 15V4" />
      <path d="M8 8l4-4 4 4" />
      <path d="M4 15v3.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V15" />
    </svg>
  );
}

export function IconCalidad(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 3l7 3v5c0 4.5-3 8.2-7 10-4-1.8-7-5.5-7-10V6l7-3z" />
      <path d="M9 11.5l2.2 2.2L15.5 9.5" />
    </svg>
  );
}

export function IconConfiguracion(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M5 8h14" />
      <circle cx="9.5" cy="8" r="2" />
      <path d="M5 16h14" />
      <circle cx="14.5" cy="16" r="2" />
    </svg>
  );
}

export function IconSol(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6L17 7M7 17l-1.4 1.4" />
    </svg>
  );
}

export function IconLuna(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M20 13.5A8 8 0 0 1 10.5 4 8 8 0 1 0 20 13.5z" />
    </svg>
  );
}
