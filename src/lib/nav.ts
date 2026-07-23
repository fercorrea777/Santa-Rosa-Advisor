export interface NavItem {
  href: string;
  label: string;
  /** true = tiene datos reales conectados en esta fase; false = shell/placeholder */
  implementado: boolean;
}

export interface NavGroup {
  /** Encabezado de sección en el sidebar (versalitas tenues). */
  titulo: string;
  items: NavItem[];
}

// Menú principal agrupado por dominio. El orden dentro de cada grupo sigue
// CLAUDE.md sección 10; los grupos hacen escaneable la lista de 13 pantallas
// (panorama → análisis → inteligencia → operación del dato).
export const NAV_GROUPS: NavGroup[] = [
  {
    titulo: "Panorama",
    items: [
      { href: "/", label: "Inicio", implementado: true },
      { href: "/mercado", label: "Resumen del mercado", implementado: true },
    ],
  },
  {
    titulo: "Análisis",
    items: [
      { href: "/evolucion", label: "Evolución mensual", implementado: true },
      { href: "/rankings", label: "Rankings", implementado: true },
      { href: "/segmentos", label: "Segmentos", implementado: true },
      { href: "/combustibles", label: "Combustibles y tecnologías", implementado: true },
      { href: "/market-share", label: "Market Share", implementado: true },
      { href: "/brecha", label: "Import. vs matric.", implementado: true },
    ],
  },
  {
    titulo: "Inteligencia",
    items: [
      { href: "/inteligencia", label: "Centro de Inteligencia", implementado: true },
      { href: "/copiloto", label: "Copiloto", implementado: true },
    ],
  },
  {
    titulo: "Datos",
    items: [
      { href: "/cargas", label: "Carga de archivos", implementado: true },
      { href: "/calidad-datos", label: "Calidad de datos", implementado: true },
      { href: "/configuracion", label: "Configuración", implementado: false },
    ],
  },
];

// Lista plana derivada, por si algún consumidor necesita recorrer todas las
// pantallas sin importar el grupo (breadcrumbs, títulos, etc.).
export const NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);
