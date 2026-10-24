/** Frases en inglés: la pantalla «Resumen del mercado» y su Panorama (el bento de arriba). */
const EN: Record<string, string> = {
  // --- cifras y unidades
  "{n} u.": "{n} units",
  "u.": "units",
  "vs. {periodo}: {n} u.": "vs. {periodo}: {n} units",
  "contra {previo}": "vs. {previo}",
  "Variación": "Change",
  "Unidades": "Units",
  "Participación": "Share",
  "Mes": "Month",
  "Marca": "Brand",
  "Grupo": "Group",
  "Grupos": "Groups",
  "Año": "Year",
  "Segmento": "Segment",
  "Tecnología": "Powertrain",
  "Modelo": "Model",
  "Versión": "Version",

  // --- panorama: tarjeta de matriculaciones
  "Panorama del mercado": "Market overview",
  "Matriculaciones": "Registrations",
  "Matriculaciones (hasta {mes})": "Registrations (through {mes})",
  "chapas puestas": "units registered",
  "{periodo} · todavía sin publicar": "{periodo} · not published yet",
  "Matriculaciones por mes, {anio} contra {previo}": "Registrations by month, {anio} vs. {previo}",
  "Cada barra es un mes contra el mismo mes de {previo}.": "Each bar is a month against the same month of {previo}.",

  // --- panorama: tarjeta de importaciones
  "Importaciones": "Imports",
  "Importaciones (hasta {mes})": "Imports (through {mes})",
  "{periodo} · livianos": "{periodo} · light vehicles",
  "entran al país": "entering the country",
  "Diferencia import. − matric.": "Imports − registrations",
  "importación por encima": "imports above registrations",
  "matriculación por encima": "registrations above imports",
  "las dos fuentes no tienen este período": "the two sources do not cover this period",
  "Importaciones (arriba)": "Imports (top)",
  "Matriculaciones (abajo)": "Registrations (bottom)",
  "{previo}, más tenue": "{previo}, lighter",
  "Importaciones {anio}": "Imports {anio}",
  "Matriculaciones {anio}": "Registrations {anio}",
  "Importaciones y matriculaciones por mes, {anio} y {previo}": "Imports and registrations by month, {anio} and {previo}",

  // --- panorama: treemap
  "Mercado por marca": "Market by brand",
  "Mercado por marca · {fuente}": "Market by brand · {fuente}",
  "Mercado por marca, {periodo}": "Market by brand, {periodo}",
  "El color es el grupo importador. Tocá una marca para filtrar la pantalla.": "The color is the importer group. Tap a brand to filter the screen.",
  "Período": "Period",
  "Mismo período {previo}": "Same period {previo}",
  "Último mes": "Last month",
  "Otras marcas": "Other brands",
  "Otros grupos": "Other groups",
  "importaciones": "imports",
  "matriculaciones": "registrations",

  // --- panorama: participación propia
  "Participación marcas propias": "Own-brand share",
  "las nuestras": "ours",
  "Sin datos en este filtro": "No data in this filter",
  "{propias} u. de {mercado} matriculaciones": "{propias} of {mercado} registrations",
  "{propias} u. de {mercado} importaciones": "{propias} of {mercado} imports",
  "Puesto del grupo": "Group rank",
  "de {n} grupos": "of {n} groups",
  "igual que hace un año (#{antes})": "same as a year ago (#{antes})",
  "▲ {n} desde #{antes} hace un año": "▲ {n} from #{antes} a year ago",
  "▼ {n} desde #{antes} hace un año": "▼ {n} from #{antes} a year ago",
  "Participación mes a mes, {anio}": "Share by month, {anio}",
  "Ver market share": "View market share",
  "{marcas}, sobre el total de {fuente} del período filtrado.": "{marcas}, over the total {fuente} of the filtered period.",

  // --- panorama: nuestras marcas
  "Nuestras marcas": "Our brands",
  "{n} de {total}": "{n} of {total}",
  "{n} marcas": "{n} brands",
  "Ninguna de nuestras marcas vendió en este filtro.": "None of our brands sold in this filter.",
  "Tocá una tarjeta para traerla al frente.": "Tap a card to bring it to the front.",
  "{marca}, al frente": "{marca}, at the front",
  "Traer {marca} al frente": "Bring {marca} to the front",
  "Puesto en el ranking de marcas": "Rank among brands",
  "Nueva en el período": "New in the period",
  "{participacion} de las matriculaciones · puesto #{puesto}": "{participacion} of registrations · rank #{puesto}",
  "{participacion} de las importaciones · puesto #{puesto}": "{participacion} of imports · rank #{puesto}",
  "Filtrar la pantalla por {marca}": "Filter the screen by {marca}",
  "Quitar el filtro de {marca}": "Clear the {marca} filter",

  // --- panorama: estacionalidad
  "Estacionalidad": "Seasonality",
  "Estacionalidad de las matriculaciones": "Registration seasonality",
  "Qué meses del año se vende más. Misma escala para todos los años.": "Which months of the year sell the most. Same scale for every year.",
  "Matriculaciones por mes, {anio}": "Registrations by month, {anio}",
  "Contra el promedio del año": "Against the yearly average",
  "Mes pico": "Peak month",
  "Mes más bajo": "Lowest month",
  "Promedio mensual": "Monthly average",
  "{n} meses con dato": "{n} months with data",
  "1 mes con dato": "1 month with data",
  "Total del año": "Year total",
  "Total hasta {mes}": "Total through {mes}",
  "Trimestre {n}": "Quarter {n}",
  "{anio} llega hasta {mes}: los meses que faltan no se dibujan ni se cuentan.": "{anio} runs through {mes}: missing months are neither drawn nor counted.",

  // --- Resumen del mercado: encabezado y secciones
  "Resumen del mercado": "Market overview",
  "Analizando {fuente} · {periodo} vs. mismo período {previo}.": "Analyzing {fuente} · {periodo} vs. same period {previo}.",
  "Fuente: CADAM / DNRA · {cortes}.": "Source: CADAM / DNRA · {cortes}.",
  "Variación contra {periodo}.": "Change vs. {periodo}.",
  "Sin datos de {anio} para comparar.": "No {anio} data to compare against.",
  "Incluye livianos y pesados: filtrá por segmento para separarlos.": "Includes light and heavy vehicles: filter by segment to separate them.",
  "Unidades matriculadas en el período. Comparación contra {periodo}: {n} u.": "Units registered in the period. Comparison against {periodo}: {n} units.",
  "CADAM todavía no publicó la matriculación de {meses}: la importación de ese mes ya está, la matriculación no.":
    "CADAM has not published registrations for {meses} yet: imports for that month are already in, registrations are not.",
  "Unidades importadas de vehículos livianos, una por una, según CADAM. No incluye camiones: se reportan aparte. Comparación contra {periodo}: {n} u.":
    "Light vehicles imported, unit by unit, according to CADAM. Trucks are not included: they are reported separately. Comparison against {periodo}: {n} units.",
  "CADAM todavía no publicó la importación de {meses}: la matriculación de ese mes ya está, la importación no.":
    "CADAM has not published imports for {meses} yet: registrations for that month are already in, imports are not.",
  "Señal orientativa, NO stock real: hay desfasajes temporales, unidades importadas en períodos anteriores, reexportaciones y registros tardíos.":
    "A rough signal, NOT actual stock: there are timing gaps, units imported in earlier periods, re-exports and late registrations.",
  "Evolución del mercado": "Market trend",
  "Cómo se mueve el mercado mes a mes, en chapas puestas y en unidades que entraron al país. Los dos gráficos comparten escala.":
    "How the market moves month by month, in vehicles registered and in units that entered the country. Both charts share the same scale.",
  "Evolución mensual — matriculaciones": "Monthly trend — registrations",
  "Chapas puestas por mes, una línea por año. Es el mercado que ya se vendió.": "Vehicles registered per month, one line per year. This is the market that has already sold.",
  "Los meses sin dato quedan como hueco en la línea, no como cero. Faltante detectado en el origen: {meses}.":
    "Months without data show as a gap in the line, not as zero. Missing in the source: {meses}.",
  "Evolución mensual — importaciones": "Monthly trend — imports",
  "Unidades que entraron al país por mes. Va adelante de la matriculación: lo que sube acá se vende en los meses que siguen.":
    "Units that entered the country per month. It leads registrations: what rises here sells in the following months.",
  "Sin datos de importación para estos años.": "No import data for these years.",
  "Segmentos y tecnología": "Segments and powertrains",
  "Qué tipo de vehículo y qué motorización está comprando el paraguayo, y para dónde se está moviendo.":
    "What type of vehicle and which powertrain Paraguayans are buying, and where the market is heading.",
  "Participación por segmento — {fuente}": "Share by segment — {fuente}",
  "Hacé clic en una barra para filtrar toda la página por ese segmento; otro clic lo quita.":
    "Click a bar to filter the whole page by that segment; click again to clear it.",
  "CADAM no clasifica el segmento antes de 2024. Las unidades sin segmento se muestran aparte, no se reparten entre los demás.":
    "CADAM does not classify the segment before 2024. Units without a segment are shown separately, not spread across the others.",
  "Participación por tecnología — matriculaciones": "Share by powertrain — registrations",
  "Sin corte por tecnología para importaciones.": "No powertrain breakdown for imports.",
  "La base de importación de CADAM no trae columna de tecnología. El detalle ICE/MHEV/HEV/PHEV/REEV/EV solo existe del lado de matriculación.":
    "CADAM's import database has no powertrain column. The ICE/MHEV/HEV/PHEV/REEV/EV breakdown only exists on the registrations side.",
  "Hacé clic en una barra para filtrar por esa tecnología.": "Click a bar to filter by that powertrain.",
  "Cada tecnología se muestra por separado: MHEV no es HEV, PHEV no es HEV y REEV no es EV.":
    "Each powertrain is shown separately: MHEV is not HEV, PHEV is not HEV and REEV is not EV.",
  "Quién gana y quién pierde": "Who gains and who loses",
  "Las marcas que más unidades sumaron y las que más perdieron contra el mismo período del año pasado.":
    "The brands that added the most units and those that lost the most against the same period last year.",
  "Principales ganadores — {fuente}": "Top gainers — {fuente}",
  "Principales perdedores — {fuente}": "Top decliners — {fuente}",
  "Unidades ganadas frente a {previo} (mismo período del año anterior). El % solo se muestra con una base de {base} u. o más.":
    "Units gained versus {previo} (same period last year). The % is only shown with a base of {base} units or more.",
  "Unidades perdidas frente a {previo} (mismo período del año anterior). El % solo se muestra con una base de {base} u. o más.":
    "Units lost versus {previo} (same period last year). The % is only shown with a base of {base} units or more.",
  "Sin período anterior cargado para comparar.": "No previous period loaded to compare against.",
  "Base de {n} u.: el % no es comparable": "Base of {n} units: the % is not comparable",
  "Rankings": "Rankings",
  "Rankings — {fuente}": "Rankings — {fuente}",
  "Hacé clic en una marca, modelo o versión para filtrar toda la página; otro clic lo quita. Los filtros se acumulan entre sí y con los de arriba.":
    "Click a brand, model or version to filter the whole page; click again to clear it. Filters stack with each other and with the ones above.",
  "Marcas ({n})": "Brands ({n})",
  "Modelos ({n})": "Models ({n})",
  "Versiones": "Versions",
  "Versiones ({n})": "Versions ({n})",
  "La base de importación de CADAM llega hasta el modelo (<code>HILUX</code>), no hasta la versión. El detalle por versión solo existe del lado de matriculación.":
    "CADAM's import database goes down to the model (<code>HILUX</code>), not to the version. Version-level detail only exists on the registrations side.",
  "CADAM no publica un campo de versión: esto es el nombre tal como lo carga la DNRA, que en la práctica incluye el acabado y a veces el motor (<code>HILUX D/C 4X4 SRV AUT</code>). No hay motor, transmisión ni tracción como campos aparte.":
    "CADAM does not publish a version field: this is the name as DNRA enters it, which in practice includes the trim and sometimes the engine (<code>HILUX D/C 4X4 SRV AUT</code>). There is no engine, transmission or drivetrain as separate fields.",
};

export default EN;
