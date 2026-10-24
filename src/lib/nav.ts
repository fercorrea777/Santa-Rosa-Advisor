import { N_ } from "@/lib/i18n/traducir";

/** Id del ícono de línea propio (ver src/components/icons.tsx). */
export type IconoNav =
  | "inicio" | "mercado" | "evolucion" | "rankings" | "segmentos"
  | "combustibles" | "localidades" | "market-share" | "brecha" | "bubble" | "gama"
  | "portafolio" | "operacion" | "acciones" | "rentabilidad" | "cbd" | "carflow"
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
    //
    // Grupos rehechos el 30/09/2026 ("todo el dashboard me parece muy
    // desordenado"): "Panorama" era un grupo de UN ítem y "Análisis" uno de
    // diez que mezclaba el mercado con el producto. Ahora el mercado va
    // junto (del resumen al detalle) y lo de producto y precio, aparte. Los
    // ítems no cambiaron de orden.
    titulo: N_("Mercado"),
    items: [
      { href: "/mercado", label: N_("Resumen del mercado"), icono: "mercado", implementado: true , pista: N_("Cómo viene el mercado entero: unidades, segmentos, tecnologías y quién gana o pierde participación.") },
      { href: "/evolucion", label: N_("Evolución mensual"), icono: "evolucion", implementado: true , pista: N_("El mercado mes a mes, un año contra otro. Para ver la estacionalidad y proyectar el cierre.") },
      { href: "/rankings", label: N_("Rankings"), icono: "rankings", implementado: true , pista: N_("Marcas y modelos ordenados por unidades, en matriculación y en importación.") },
      { href: "/segmentos", label: N_("Segmentos"), icono: "segmentos", implementado: true , pista: N_("Qué tipo de vehículo compra el paraguayo y cuánto de cada segmento es nuestro.") },
      { href: "/combustibles", label: N_("Combustibles y tecnologías"), icono: "combustibles", implementado: true , pista: N_("Nafta, diésel, híbrido o eléctrico: qué se vende y para dónde se está moviendo.") },
      { href: "/localidades", label: N_("Localidades"), icono: "localidades", implementado: true , pista: N_("En qué ciudades se pone la chapa. Dice dónde hay mercado sin local nuestro.") },
      { href: "/market-share", label: N_("Market Share"), icono: "market-share", implementado: true , pista: N_("Nuestra parte del mercado y la de cada competidor, contra el año pasado.") },
      { href: "/brecha", label: N_("Import. vs matric."), icono: "brecha", implementado: true , pista: N_("Lo que entró al país y todavía no sacó chapa: stock que ya está acá y aún no se vendió.") },
    ],
  },
  {
    titulo: N_("Producto y precio"),
    items: [
      { href: "/bubble-chart", label: N_("Bubble chart"), icono: "bubble", implementado: true , pista: N_("El cuadro de producto: cada modelo contra sus rivales, por precio y por volumen.") },
      { href: "/mapa", label: N_("Dónde competir"), icono: "market-share", implementado: true , pista: N_("Contra quién compite cada modelo nuestro y si estamos caros o baratos frente a ellos.") },
      { href: "/portafolio", label: N_("Portafolio por marca"), icono: "portafolio", implementado: true , pista: N_("La gama de cualquier marca, modelo por modelo: precio de lista, cuánto vende cada uno y qué hueco deja.") },
    ],
  },
  {
    // Lo NUESTRO, aparte del mercado (pedido de Fernando, 15/09/2026: "un
    // apartado nuevo que se llame algo como SANTA ROSA" con las acciones
    // comerciales, CBD, Carflow y la gama propia vinculada a todo eso).
    // Gama propia y Nuestra operación se mudaron acá desde Análisis: son
    // datos de la casa, no del mercado.
    titulo: N_("Santa Rosa"),
    items: [
      { href: "/acciones-comerciales", label: N_("Acciones comerciales"), icono: "acciones", implementado: true , pista: N_("La planilla del mes de Fernando: descuento máximo, precio con descuento, bono al vendedor y mecánica de cada versión, cruzada con lo que importa, matricula y factura cada familia.") },
      { href: "/gama-propia", label: N_("Gama propia"), icono: "gama", implementado: true , pista: N_("Nuestros modelos, su precio, cuánto vende cada uno y qué acción comercial tiene este mes. Tocá una burbuja para ver sus rivales.") },
      // Márgenes en todas las columnas: solo admin (mismo criterio que el
      // costo en Acciones comerciales).
      { href: "/rentabilidad", label: N_("Rentabilidad"), icono: "rentabilidad", implementado: true, soloAdmin: true , pista: N_("Precio y margen de cada versión según la planilla, contra lo que facturamos: qué vende, a qué ticket y qué deja. En cuatro cuadrantes.") },
      { href: "/operacion", label: N_("Nuestra operación"), icono: "operacion", implementado: true , pista: N_("Lo nuestro: qué facturamos, qué stock hay, cómo vamos contra el presupuesto y quién vende.") },
      { href: "/cbd", label: N_("CBD"), icono: "cbd", implementado: false , pista: N_("Cost break down: de FOB a costo puesto en playa, versión por versión. Falta el archivo de cada marca.") },
      { href: "/carflow", label: N_("Carflow"), icono: "carflow", implementado: false , pista: N_("El flujo de unidades: pedido, embarque, tránsito, aduana y playa. Falta definir la fuente.") },
    ],
  },
  {
    titulo: N_("Inteligencia"),
    items: [
      { href: "/inteligencia", label: N_("Centro de Inteligencia"), icono: "inteligencia", implementado: true , pista: N_("La lectura del período escrita, más lo que se sabe de la competencia.") },
      { href: "/copiloto", label: N_("Copiloto"), icono: "copiloto", implementado: true , pista: N_("Preguntale a los datos en castellano; contesta citando de dónde sacó cada cifra.") },
    ],
  },
  {
    titulo: N_("Datos"),
    items: [
      { href: "/cargas", label: N_("Estado de los datos"), icono: "cargas", implementado: true , pista: N_("Hasta qué fecha llega cada fuente y quién la trae. Se mira cuando un número parece viejo.") },
      { href: "/calidad-datos", label: N_("Calidad de datos"), icono: "calidad", implementado: true , pista: N_("Los controles que corrieron al cargar los archivos y qué no cerró.") },
      { href: "/configuracion", label: N_("Configuración"), icono: "configuracion", implementado: true, soloAdmin: true , pista: N_("Marcas propias, metas y competidores.") },
    ],
  },
];

/**
 * Otros nombres con los que la gente conoce cada pantalla, para el buscador
 * (Ctrl K). El rótulo del menú es uno, pero el equipo habla de «la brecha»,
 * «el mapa» o «nafta y diésel»: sin esto, buscar «brecha» no encontraba
 * «Import. vs matric.» porque esa palabra no está en su rótulo. Va aparte de
 * NAV_GROUPS para no ensuciar la definición del menú; el buscador ya no
 * distingue tildes ni mayúsculas.
 */
// i18n-ignore-start (palabras clave de búsqueda en castellano: no se traducen, se les suma ALIAS_NAV_EN)
export const ALIAS_NAV: Record<string, string> = {
  "/mercado": "resumen mercado inicio home panorama",
  "/evolucion": "mensual estacionalidad proyeccion cierre meses",
  "/rankings": "marcas modelos ranking top posiciones",
  "/segmentos": "suv pick up pickup automovil camion furgon tipo de vehiculo",
  "/combustibles": "nafta diesel gasoil hibrido electrico tecnologia motor propulsion",
  "/localidades": "ciudades departamentos asuncion capital interior donde",
  "/market-share": "participacion share cuota porcentaje",
  "/brecha": "brecha importaciones matriculaciones stock en camino diferencia",
  "/bubble-chart": "burbujas cuadro producto precio volumen",
  "/mapa": "mapa rivales competidores competencia donde competir caro barato",
  "/portafolio": "gama marca modelos portafolio versiones",
  "/acciones-comerciales": "promociones descuentos bono mecanica planilla fernando",
  "/gama-propia": "nuestros modelos gama propia precios",
  "/rentabilidad": "margen ticket precio ganancia",
  "/operacion": "facturacion stock presupuesto vendedores asesores ventas",
  "/cbd": "costos fob puesto en playa",
  "/carflow": "flujo embarque aduana transito pedido",
  "/inteligencia": "informe lectura alertas oportunidades centro",
  "/copiloto": "chat preguntas asistente ia ayuda",
  "/cargas": "fuentes fechas actualizacion cadam cars estado",
  "/calidad-datos": "controles errores avisos validacion",
  "/configuracion": "metas marcas competidores usuarios admin",
};
// i18n-ignore-end

/**
 * Lo mismo en inglés: con el idioma en inglés el buscador (Ctrl K) busca en las
 * dos listas, porque quien escribe «brecha» en una pantalla en inglés también
 * tiene que encontrar «Imports vs. registrations».
 */
export const ALIAS_NAV_EN: Record<string, string> = {
  "/mercado": "market overview home summary dashboard",
  "/evolucion": "monthly trend seasonality projection close months",
  "/rankings": "brands models ranking top positions",
  "/segmentos": "suv pick up pickup car truck van bus vehicle type",
  "/combustibles": "gasoline petrol diesel hybrid electric powertrain engine fuel technology",
  "/localidades": "cities departments asuncion capital interior where locations",
  "/market-share": "share participation quota percentage",
  "/brecha": "gap imports registrations stock in transit difference",
  "/bubble-chart": "bubbles product map price volume",
  "/mapa": "map rivals competitors competition where to compete expensive cheap",
  "/portafolio": "range brand models portfolio versions",
  "/acciones-comerciales": "promotions discounts bonus mechanics sheet fernando commercial actions",
  "/gama-propia": "our models own range prices",
  "/rentabilidad": "margin ticket price profit profitability",
  "/operacion": "invoicing billing stock budget salespeople advisors sales operation",
  "/cbd": "costs fob landed cost yard",
  "/carflow": "flow shipment customs transit order",
  "/inteligencia": "report reading alerts opportunities center intelligence",
  "/copiloto": "chat questions assistant ai help copilot",
  "/cargas": "sources dates update cadam cars status data",
  "/calidad-datos": "checks errors warnings validation quality",
  "/configuracion": "targets goals brands competitors users admin settings",
};

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
