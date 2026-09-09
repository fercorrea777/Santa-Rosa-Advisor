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
  /**
   * Qué se contesta en esa pantalla, en una línea. Sale como tooltip al pasar
   * el mouse por el renglón del menú.
   *
   * El menú son trece rótulos de dos palabras —"Brecha", "Bubble chart",
   * "Segmentos"— y entrar a cada uno para descubrir qué hace cuesta trece
   * clics. La pista lo dice antes de entrar.
   */
  pista?: string;
  /** Solo para rol admin. Quien no lo tiene NI SIQUIERA VE el renglón: la
   *  puerta (proxy.ts) ya lo frena si escribe la URL, pero ofrecer un enlace
   *  que va a rebotar es peor que no ofrecerlo. */
  soloAdmin?: boolean;
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
      { href: "/mercado", label: "Resumen del mercado", icono: "mercado", implementado: true , pista: "Cómo viene el mercado entero: unidades, segmentos, tecnologías y quién gana o pierde participación." },
    ],
  },
  {
    titulo: "Análisis",
    items: [
      { href: "/evolucion", label: "Evolución mensual", icono: "evolucion", implementado: true , pista: "El mercado mes a mes, un año contra otro. Para ver la estacionalidad y proyectar el cierre." },
      { href: "/rankings", label: "Rankings", icono: "rankings", implementado: true , pista: "Marcas y modelos ordenados por unidades, en matriculación y en importación." },
      { href: "/segmentos", label: "Segmentos", icono: "segmentos", implementado: true , pista: "Qué tipo de vehículo compra el paraguayo y cuánto de cada segmento es nuestro." },
      { href: "/combustibles", label: "Combustibles y tecnologías", icono: "combustibles", implementado: true , pista: "Nafta, diésel, híbrido o eléctrico: qué se vende y para dónde se está moviendo." },
      { href: "/localidades", label: "Localidades", icono: "localidades", implementado: true , pista: "En qué ciudades se pone la chapa. Dice dónde hay mercado sin local nuestro." },
      { href: "/market-share", label: "Market Share", icono: "market-share", implementado: true , pista: "Nuestra parte del mercado y la de cada competidor, contra el año pasado." },
      { href: "/brecha", label: "Import. vs matric.", icono: "brecha", implementado: true , pista: "Lo que entró al país y todavía no sacó chapa: stock que ya está acá y aún no se vendió." },
      { href: "/bubble-chart", label: "Bubble chart", icono: "bubble", implementado: true , pista: "El cuadro de producto: cada modelo contra sus rivales, por precio y por volumen." },
      { href: "/mapa", label: "Dónde competir", icono: "market-share", implementado: true , pista: "Contra quién compite cada modelo nuestro y si estamos caros o baratos frente a ellos." },
      { href: "/gama-propia", label: "Gama propia", icono: "gama", implementado: true , pista: "Nuestros modelos, su precio y cuánto vende cada uno. Tocá una burbuja para ver sus rivales." },
      { href: "/operacion", label: "Nuestra operación", icono: "operacion", implementado: true , pista: "Lo nuestro: qué facturamos, qué stock hay, cómo vamos contra el presupuesto y quién vende." },
    ],
  },
  {
    titulo: "Inteligencia",
    items: [
      { href: "/inteligencia", label: "Centro de Inteligencia", icono: "inteligencia", implementado: true , pista: "La lectura del período escrita, más lo que se sabe de la competencia." },
      { href: "/copiloto", label: "Copiloto", icono: "copiloto", implementado: true , pista: "Preguntale a los datos en castellano; contesta citando de dónde sacó cada cifra." },
    ],
  },
  {
    titulo: "Datos",
    items: [
      { href: "/cargas", label: "Estado de los datos", icono: "cargas", implementado: true , pista: "Hasta qué fecha llega cada fuente y quién la trae. Se mira cuando un número parece viejo." },
      { href: "/calidad-datos", label: "Calidad de datos", icono: "calidad", implementado: true , pista: "Los controles que corrieron al cargar los archivos y qué no cerró." },
      { href: "/configuracion", label: "Configuración", icono: "configuracion", implementado: true, soloAdmin: true , pista: "Marcas propias, metas y competidores." },
    ],
  },
];

/** El menú que le toca a un rol. Los grupos que quedan sin items desaparecen
 *  enteros, para no dejar un encabezado de sección colgado sin nada debajo. */
export function navPara(esAdmin: boolean): NavGroup[] {
  if (esAdmin) return NAV_GROUPS;
  return NAV_GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((i) => !i.soloAdmin),
  })).filter((g) => g.items.length > 0);
}

// Lista plana derivada, por si algún consumidor necesita recorrer todas las
// pantallas sin importar el grupo (breadcrumbs, títulos, etc.).
export const NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);
