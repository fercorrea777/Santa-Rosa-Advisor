/** Id del ícono de línea propio (ver src/components/icons.tsx). */
export type IconoNav =
  | "inicio" | "mercado" | "evolucion" | "rankings" | "segmentos"
  | "combustibles" | "localidades" | "market-share" | "brecha" | "bubble" | "gama"
  | "operacion"
  | "inteligencia" | "copiloto" | "cargas" | "calidad" | "configuracion";

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
    // "Inicio" salió del menú (2026-09): repetía lo que ya muestra "Resumen
    // del mercado". La ruta "/" sigue viva — es donde cae quien entra al
    // dominio pelado y adonde lleva el logo — pero no ocupa un renglón del
    // menú al lado de su propio duplicado.
    titulo: "Panorama",
    items: [
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
      { href: "/localidades", label: "Localidades", icono: "localidades", implementado: true },
      { href: "/market-share", label: "Market Share", icono: "market-share", implementado: true },
      { href: "/brecha", label: "Import. vs matric.", icono: "brecha", implementado: true },
      { href: "/bubble-chart", label: "Bubble chart", icono: "bubble", implementado: true },
      { href: "/gama-propia", label: "Gama propia", icono: "gama", implementado: true },
      { href: "/operacion", label: "Nuestra operación", icono: "operacion", implementado: true },
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
      { href: "/configuracion", label: "Configuración", icono: "configuracion", implementado: true },
    ],
  },
];

// Lista plana derivada, por si algún consumidor necesita recorrer todas las
// pantallas sin importar el grupo (breadcrumbs, títulos, etc.).
export const NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);
