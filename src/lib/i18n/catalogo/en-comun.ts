/** Frases en inglés: lo común a todas las pantallas (formatos, menú, barra, filtros, tablas, gráficos). */
const EN: Record<string, string> = {
  // --- formatos.ts
  "Otros importadores": "Other importers",
  "datos hasta {corte}": "data through {corte}",
  "matriculaciones hasta {m} · importaciones hasta {i}": "registrations through {m} · imports through {i}",
  "Matriculaciones hasta {m} · importaciones hasta {i}: CADAM ya publicó la importación de {meses}, la matriculación de esos meses todavía no.":
    "Registrations through {m} · imports through {i}: CADAM has already published imports for {meses}, but not registrations for those months.",
  "Matriculaciones hasta {m} · importaciones hasta {i}: CADAM ya publicó la importación de {meses}, la matriculación de ese mes todavía no.":
    "Registrations through {m} · imports through {i}: CADAM has already published imports for {meses}, but not registrations for that month.",
  "Matriculaciones hasta {m} · importaciones hasta {i}: CADAM ya publicó la matriculación de {meses}, la importación de esos meses todavía no.":
    "Registrations through {m} · imports through {i}: CADAM has already published registrations for {meses}, but not imports for those months.",
  "Matriculaciones hasta {m} · importaciones hasta {i}: CADAM ya publicó la matriculación de {meses}, la importación de ese mes todavía no.":
    "Registrations through {m} · imports through {i}: CADAM has already published registrations for {meses}, but not imports for that month.",

  // --- layout.tsx (metadatos)
  "Mercado Automotor PY | Santa Rosa Comercial Advisor": "Paraguay Auto Market | Santa Rosa Commercial Advisor",
  "%s · Mercado Automotor PY": "%s · Paraguay Auto Market",
  "Inteligencia comercial del mercado automotor paraguayo — matriculaciones e importaciones (CADAM).":
    "Commercial intelligence on the Paraguayan auto market: vehicle registrations and imports (CADAM).",
  "Matriculaciones e importaciones del mercado automotor paraguayo (CADAM), con rankings, market share y evolución.":
    "Registrations and imports in the Paraguayan auto market (CADAM), with rankings, market share and trends.",
  "Mercado Automotor PY": "Paraguay Auto Market",
  "Mercado Automotor": "Auto Market",
  "Mercado Automotor PY — inicio": "Paraguay Auto Market — home",
  "Inteligencia comercial · Paraguay": "Commercial intelligence · Paraguay",

  // --- barra de marca, menú y atajos
  "Atajos": "Shortcuts",
  "Saltar al contenido": "Skip to content",
  "Menú principal": "Main menu",
  "Menú": "Menu",
  "Abrir menú": "Open menu",
  "Cerrar menú": "Close menu",
  "Expandir el menú": "Expand the menu",
  "Colapsar el menú": "Collapse the menu",
  "Pantallas": "Screens",
  "Idioma": "Language",
  "pronto": "soon",
  "{label} (pronto)": "{label} (soon)",
  "Inteligencia Comercial": "Commercial Intelligence",
  "Tablero sin clave": "Dashboard without a password",
  "Cualquiera con la URL ve el stock, los precios y la inteligencia de competencia. Definí <code>ADVISOR_CLAVE</code> en el entorno del servidor para cerrarlo.":
    "Anyone with the URL can see stock, prices and competitive intelligence. Set <code>ADVISOR_CLAVE</code> in the server environment to lock it.",
  "Cambiar a modo claro": "Switch to light mode",
  "Cambiar a modo oscuro": "Switch to dark mode",

  // --- perfil
  "Mi cuenta": "My account",
  "Mi cuenta, {nombre}": "My account, {nombre}",
  "Cerrar sesión": "Sign out",
  "emergencia": "emergency",
  "Administrador": "Administrator",
  "Lector": "Viewer",
  "Acceso de emergencia": "Emergency access",
  "Clave general del equipo": "Team shared password",
  "Tu cuenta": "Your account",

  // --- buscador de pantallas (Ctrl K)
  "Buscar pantalla": "Search screens",
  "Buscar pantalla ({atajo})": "Search screens ({atajo})",
  "Buscar pantalla…": "Search screens…",
  "Buscar una pantalla o una acción": "Search for a screen or an action",
  "Buscar una pantalla o una acción…": "Search for a screen or an action…",
  "Resultados": "Results",
  "Sin resultados": "No results",
  "{n} resultados": "{n} results",
  "Nada coincide con «{consulta}». Probá con otra palabra: «brecha», «precios», «copiloto».":
    "Nothing matches “{consulta}”. Try another word: “gap”, “prices”, “copilot”.",
  "Cuenta": "Account",
  "Tu foto, tus datos y tu clave.": "Your photo, your details and your password.",
  "El oscuro está pensado para la sala de reuniones.": "Dark mode is designed for the meeting room.",
  "Salir de este equipo.": "Sign out on this device.",
  "moverse": "move",
  "abrir": "open",
  "cerrar": "close",

  // --- menú: grupos
  "Mercado": "Market",
  "Producto y precio": "Product & pricing",
  "Santa Rosa": "Santa Rosa",
  "Inteligencia": "Intelligence",
  "Datos": "Data",

  // --- menú: pantallas
  "Resumen del mercado": "Market overview",
  "Evolución mensual": "Monthly trend",
  "Rankings": "Rankings",
  "Segmentos": "Segments",
  "Combustibles y tecnologías": "Fuels & powertrains",
  "Localidades": "Locations",
  "Market Share": "Market share",
  "Import. vs matric.": "Imports vs. registrations",
  "Bubble chart": "Bubble chart",
  "Dónde competir": "Where to compete",
  "Portafolio por marca": "Portfolio by brand",
  "Acciones comerciales": "Commercial actions",
  "Gama propia": "Own range",
  "Rentabilidad": "Profitability",
  "Nuestra operación": "Our operation",
  "CBD": "CBD",
  "Carflow": "Carflow",
  "Centro de Inteligencia": "Intelligence center",
  "Copiloto": "Copilot",
  "Estado de los datos": "Data status",
  "Calidad de datos": "Data quality",
  "Configuración": "Settings",

  // --- menú: pistas (tooltip de cada renglón)
  "Cómo viene el mercado entero: unidades, segmentos, tecnologías y quién gana o pierde participación.":
    "How the whole market is doing: units, segments, powertrains, and who is gaining or losing share.",
  "El mercado mes a mes, un año contra otro. Para ver la estacionalidad y proyectar el cierre.":
    "The market month by month, one year against another. To see seasonality and project the year-end close.",
  "Marcas y modelos ordenados por unidades, en matriculación y en importación.":
    "Brands and models ranked by units, in registrations and in imports.",
  "Qué tipo de vehículo compra el paraguayo y cuánto de cada segmento es nuestro.":
    "What type of vehicle Paraguayans buy and how much of each segment is ours.",
  "Nafta, diésel, híbrido o eléctrico: qué se vende y para dónde se está moviendo.":
    "Gasoline, diesel, hybrid or electric: what is selling and where the market is heading.",
  "En qué ciudades se pone la chapa. Dice dónde hay mercado sin local nuestro.":
    "In which cities vehicles get registered. Shows where there is market without a branch of ours.",
  "Nuestra parte del mercado y la de cada competidor, contra el año pasado.":
    "Our share of the market and each competitor's, against last year.",
  "Lo que entró al país y todavía no sacó chapa: stock que ya está acá y aún no se vendió.":
    "What entered the country and has not been registered yet: stock that is already here and not yet sold.",
  "El cuadro de producto: cada modelo contra sus rivales, por precio y por volumen.":
    "The product map: each model against its rivals, by price and by volume.",
  "Contra quién compite cada modelo nuestro y si estamos caros o baratos frente a ellos.":
    "Who each of our models competes against, and whether we are expensive or cheap relative to them.",
  "La gama de cualquier marca, modelo por modelo: precio de lista, cuánto vende cada uno y qué hueco deja.":
    "Any brand's range, model by model: list price, how much each one sells, and what gap it leaves.",
  "La planilla del mes de Fernando: descuento máximo, precio con descuento, bono al vendedor y mecánica de cada versión, cruzada con lo que importa, matricula y factura cada familia.":
    "Fernando's monthly sheet: maximum discount, discounted price, salesperson bonus and promotion mechanics for each version, cross-referenced with what each family imports, registers and invoices.",
  "Nuestros modelos, su precio, cuánto vende cada uno y qué acción comercial tiene este mes. Tocá una burbuja para ver sus rivales.":
    "Our models, their price, how much each one sells and which commercial action it has this month. Tap a bubble to see its rivals.",
  "Precio y margen de cada versión según la planilla, contra lo que facturamos: qué vende, a qué ticket y qué deja. En cuatro cuadrantes.":
    "Price and margin of each version according to the sheet, against what we invoice: what sells, at what ticket, and what it leaves. In four quadrants.",
  "Lo nuestro: qué facturamos, qué stock hay, cómo vamos contra el presupuesto y quién vende.":
    "Our own numbers: what we invoice, what stock we hold, how we are doing against budget, and who sells.",
  "Cost break down: de FOB a costo puesto en playa, versión por versión. Falta el archivo de cada marca.":
    "Cost breakdown: from FOB to landed cost at the yard, version by version. Each brand's file is still missing.",
  "El flujo de unidades: pedido, embarque, tránsito, aduana y playa. Falta definir la fuente.":
    "The flow of units: order, shipment, transit, customs and yard. The source is still to be defined.",
  "La lectura del período escrita, más lo que se sabe de la competencia.":
    "The written reading of the period, plus what is known about the competition.",
  "Preguntale a los datos en castellano; contesta citando de dónde sacó cada cifra.":
    "Ask the data questions in plain language; it answers and cites where each figure came from.",
  "Hasta qué fecha llega cada fuente y quién la trae. Se mira cuando un número parece viejo.":
    "How far each source goes and who brings it in. Check it when a number looks stale.",
  "Los controles que corrieron al cargar los archivos y qué no cerró.":
    "The checks that ran when the files were loaded, and what did not reconcile.",
  "Marcas propias, metas y competidores.": "Own brands, targets and competitors.",
};

export default EN;
