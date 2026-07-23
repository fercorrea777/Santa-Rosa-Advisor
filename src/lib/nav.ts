/** Id del ícono de línea propio (ver src/components/icons.tsx). */
export type IconoNav =
  | "inicio" | "mercado" | "evolucion" | "rankings" | "segmentos"
  | "combustibles" | "market-share" | "brecha" | "inteligencia"
  | "copiloto" | "cargas" | "calidad" | "configuracion";

export interface NavItem {
  href: string;
  label: string;
  icono: IconoNav;
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
      { href: "/", label: "Inicio", icono: "inicio", implementado: true },
      { href: "/mercado", label: "Resumen del mercado", icono: "mercado", implementado: true },
    ],
  },
  {
    titulo: "Análisis",
    items: [
      { href: "/evolucion", label: "Evolución mensual", icono: "evolucion", implementado: true },
      { href: "/rankings", label: "Rankings", icono: "rankings", implementado: true },
      { href: "/segmentos", label: "Segmentos", icono: "segmentos", implementado: true },
      { href: "/combustibles", label: "Combustibles y tecnologías", icono: "combustibles", implementado: true },
      { href: "/market-share", label: "Market Share", icono: "market-share", implementado: true },
      { href: "/brecha", label: "Import. vs matric.", icono: "brecha", implementado: true },
    ],
  },
  {
    titulo: "Inteligencia",
    items: [
      { href: "/inteligencia", label: "Centro de Inteligencia", icono: "inteligencia", implementado: true },
      { href: "/copiloto", label: "Copiloto", icono: "copiloto", implementado: true },
    ],
  },
  {
    titulo: "Datos",
    items: [
      { href: "/cargas", label: "Carga de archivos", icono: "cargas", implementado: true },
      { href: "/calidad-datos", label: "Calidad de datos", icono: "calidad", implementado: true },
      { href: "/configuracion", label: "Configuración", icono: "configuracion", implementado: false },
    ],
  },
];

// Lista plana derivada, por si algún consumidor necesita recorrer todas las
// pantallas sin importar el grupo (breadcrumbs, títulos, etc.).
export const NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);
