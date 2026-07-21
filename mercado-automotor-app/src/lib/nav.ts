export interface NavItem {
  href: string;
  label: string;
  /** true = tiene datos reales conectados en esta fase; false = shell/placeholder */
  implementado: boolean;
}

// Menu principal, orden segun CLAUDE.md seccion 10.
export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Inicio", implementado: true },
  { href: "/mercado", label: "Resumen del mercado", implementado: true },
  { href: "/evolucion", label: "Evolución mensual", implementado: true },
  { href: "/rankings", label: "Rankings", implementado: true },
  { href: "/segmentos", label: "Segmentos", implementado: true },
  { href: "/combustibles", label: "Combustibles y tecnologías", implementado: true },
  { href: "/market-share", label: "Market Share", implementado: true },
  { href: "/brecha", label: "Import. vs matric.", implementado: true },
  { href: "/inteligencia", label: "Centro de Inteligencia", implementado: true },
  { href: "/copiloto", label: "Copiloto", implementado: true },
  { href: "/cargas", label: "Carga de archivos", implementado: true },
  { href: "/calidad-datos", label: "Calidad de datos", implementado: true },
  { href: "/configuracion", label: "Configuración", implementado: false },
];
