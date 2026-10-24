/** Frases en inglés: inteligencia (Centro de Inteligencia, Copiloto, lectura del período). Clave = el texto en
 *  castellano tal cual está en el código. */
const EN: Record<string, string> = {
  // --- src/app/api/copiloto/route.ts
  "CADAM / DNRA — matriculación e importación": "CADAM / DNRA — registrations and imports",
  "Informes semanales de competencia": "Weekly competitor reports",
  "Hermes · {titulo} (dato del {fecha})": "Hermes · {titulo} (data from {fecha})",
  "Hermes · {titulo}": "Hermes · {titulo}",
  "Bitrix — leads y negocios": "Bitrix — leads and deals",
  "Meta — pauta por marca · Cars": "Meta — ad spend by brand · Cars",
  "CADAM · Cars · Datacar — rivales por clase": "CADAM · Cars · Datacar — rivals by class",
  "Cars (DMS propio) — facturación y stock": "Cars (in-house DMS) — invoicing and stock",
  "Internet (búsqueda en DuckDuckGo)": "Internet (DuckDuckGo search)",
  "Cuerpo inválido: se espera { mensajes: [{role, content}] }.": "Invalid body: expected { mensajes: [{role, content}] }.",
  "El copiloto falló: {mensaje}": "The Copilot failed: {mensaje}",

  // --- src/app/copiloto/page.tsx
  "Preguntale a los datos en lenguaje natural. Consulta él mismo las fuentes —CADAM, el relevamiento de precios de la competencia, nuestra operación, la demanda de Bitrix y la pauta de Meta— y, si ahí no está, busca en internet. Muestra abajo de cada respuesta cuáles abrió.":
    "Ask the data questions in plain language. It checks the sources itself —CADAM, the competitor price survey, our operation, Bitrix demand and Meta ad spend— and, if the answer is not there, it searches the internet. Below each answer it shows which sources it opened.",
  "CADAM / DNRA · {cortes} · precios y promociones de la competencia relevados a diario · facturación, stock y asesores de Cars · leads y negocios de Bitrix · pauta de Meta · rivales por clase de vehículo · internet (DuckDuckGo) solo para lo que no está en esas fuentes, citando la URL.":
    "CADAM / DNRA · {cortes} · competitor prices and promotions surveyed daily · invoicing, stock and advisors from Cars · Bitrix leads and deals · Meta ad spend · rivals by vehicle class · internet (DuckDuckGo) only for what is not in those sources, citing the URL.",
  "Chat": "Chat",
  "Informes semanales": "Weekly reports",
  "¿Contra quién compite la X50 y a qué precio está cada rival?": "Who does the X50 compete against, and what is each rival's price?",
  "¿Qué versiones hay que pedir y cuáles empujar con promo?": "Which versions should we order, and which should we push with a promo?",
  "¿Qué marca pierde más leads y por qué?": "Which brand loses the most leads, and why?",
  "¿Cuánto nos cuesta en pauta cada vehículo vendido, por marca?": "How much does each vehicle sold cost us in ad spend, by brand?",
  "¿Qué marcas van atrasadas contra el presupuesto 2026?": "Which brands are behind the 2026 budget?",
  "¿Quiénes son los mejores asesores del año y de cada marca?": "Who are the best advisors of the year, and of each brand?",
  "¿Quién ganó y quién perdió market share este año?": "Who gained and who lost market share this year?",

  // --- src/app/inteligencia/page.tsx
  "Alertas": "Alerts",
  "Movimientos que requieren atención inmediata.": "Movements that need immediate attention.",
  "Oportunidades": "Opportunities",
  "Espacios donde hay lugar para crecer.": "Areas with room to grow.",
  "Riesgos": "Risks",
  "Amenazas a la posición actual.": "Threats to the current position.",
  "Hallazgos relevantes": "Key findings",
  "Lo que muestran los datos del período.": "What the data shows for the period.",
  "Lectura histórica": "Historical reading",
  "Sobre toda la serie cargada, no solo el período: estacionalidad, tendencia de fondo, meses atípicos y proyección de cierre.":
    "Across the whole loaded series, not just the period: seasonality, underlying trend, unusual months and year-end projection.",
  "alta": "high",
  "media": "medium",
  "baja": "low",
  "Centro de Inteligencia Comercial": "Commercial intelligence center",
  "Lectura automática del mercado ({periodo} vs. {anioPrevio}) y de nuestra operación al día de hoy.":
    "Automated reading of the market ({periodo} vs. {anioPrevio}) and of our operation as of today.",
  "Fuente: CADAM / DNRA · {cortes} · Cars (stock y facturación) · Bitrix (demanda) · Meta (pauta) · Datacar (precios de la competencia) · catálogo de clases de vehículo.":
    "Source: CADAM / DNRA · {cortes} · Cars (stock and invoicing) · Bitrix (demand) · Meta (ad spend) · Datacar (competitor prices) · vehicle class catalog.",
  "{n} en prioridad alta": "{n} high priority",
  "Lectura del período": "Period reading",
  "Lo que hay que saber del período, escrito. Sale de los mismos números del tablero, no de otra fuente.":
    "What you need to know about the period, written out. It comes from the same numbers as the dashboard, not from another source.",
  "Resumen ejecutivo": "Executive summary",
  "Los puntos del período en orden de importancia. Salen calculados de los mismos números del tablero: si algo no cierra con una pantalla, es que cambió el dato, no la lectura.":
    "The key points of the period in order of importance. They are calculated from the same numbers as the dashboard: if something does not match a screen, the data changed, not the reading.",
  "Nada que reportar en este período con los umbrales actuales.": "Nothing to report for this period at the current thresholds.",
  "Estas {n} lecturas salen de <b>reglas y cálculos</b> sobre las fuentes cargadas, sin inteligencia artificial externa. Cada punto muestra la evidencia numérica de la que sale y, al pie, de qué fuente y período: las del mercado (CADAM) cierran en el último mes publicado; las de nuestra operación (Cars, Bitrix, Meta) llegan hasta hoy. Para evitar conclusiones falsas, las reglas <b>ignoran las bases chicas</b>: un “+800%” que va de 1 a 9 unidades no dice nada del mercado.":
    "These {n} readings come from <b>rules and calculations</b> over the loaded sources, with no external artificial intelligence. Each point shows the numeric evidence it comes from and, at the bottom, which source and period: those for the market (CADAM) close at the last published month; those for our operation (Cars, Bitrix, Meta) run up to today. To avoid false conclusions, the rules <b>ignore small bases</b>: a “+800%” that goes from 1 to 9 units says nothing about the market.",
  "Fuentes externas": "External sources",
  "Lo que se sabe de la competencia y del mercado por fuera de CADAM y de Cars: precios publicados, promociones y notas del monitoreo.":
    "What is known about the competition and the market outside CADAM and Cars: published prices, promotions and monitoring notes.",
  "Mercado y competencia (fuentes externas)": "Market and competition (external sources)",
  "Informe semanal automático: precios de competencia, noticias del sector, redes sociales y tendencias globales, con fuente y fecha citadas.":
    "Automated weekly report: competitor prices, industry news, social media and global trends, with source and date cited.",
  "Qué sabe el Copiloto de la competencia": "What the Copilot knows about the competition",
  "Base de conocimiento que se refresca sola todos los días: precios públicos de la competencia, comparativos modelo a modelo, relevamiento de promociones y guía de pauta. Acá va el inventario y su antigüedad; el contenido lo lee el Copiloto cuando lo necesita.":
    "Knowledge base that refreshes itself every day: public competitor prices, model-by-model comparisons, a promotions survey and an advertising guide. Here you see the inventory and how old it is; the Copilot reads the content when it needs it.",
  "Evidencia:": "Evidence:",
  "Impacto potencial:": "Potential impact:",
  "Período analizado: {periodo}": "Period analyzed: {periodo}",

  // --- src/components/copiloto/chat.tsx
  "Error {status}": "Error {status}",
  "La respuesta se cortó por longitud. Pedí el detalle en partes.": "The answer was cut off for length. Ask for the detail in parts.",
  "No se pudo contactar al servidor. ¿Sigue corriendo la app?": "Could not reach the server. Is the app still running?",
  "¿En qué te ayudo <hoy>hoy</hoy>?": "How can I help you <hoy>today</hoy>?",
  "Preguntá sobre el mercado — marcas, modelos, segmentos, tecnologías, evolución. Respondo con los datos cargados y cito las cifras.":
    "Ask about the market — brands, models, segments, powertrains, trends. I answer with the loaded data and cite the figures.",
  "Consultando": "Looking it up",
  "Pregunta para el Copiloto": "Question for the Copilot",
  "Preguntá al copiloto…": "Ask the Copilot…",
  "Enter para enviar": "Press Enter to send",
  "Enviar": "Send",
  "Ej.: ¿cómo viene GREAT WALL en SUV contra GEELY?": "E.g.: how is GREAT WALL doing in SUVs against GEELY?",
  "Vos": "You",
  "Sin fuentes consultadas — esta respuesta no salió de los datos.": "No sources consulted — this answer did not come from the data.",
  "Fuentes:": "Sources:",

  // --- src/components/copiloto/conocimiento-panel.tsx
  "sin fecha": "no date",
  "hoy": "today",
  "ayer": "yesterday",
  "hace {n} días": "{n} days ago",
  "Cargando…": "Loading…",
  "Hermes todavía no empujó nada. El cron corre todos los días a las 08:15; si pasó la hora y sigue vacío, revisá el trabajo <job>advisor-conocimiento</job> en Hermes.":
    "Hermes has not pushed anything yet. The cron runs every day at 08:15; if that time has passed and this is still empty, check the <job>advisor-conocimiento</job> job in Hermes.",
  "Dato:": "Data:",
  "Subido {fecha} · {k} k": "Uploaded {fecha} · {k} k",
  "Hay material de hasta {n} días. El Copiloto cita la fecha de cada documento cuando lo usa, pero conviene refrescar el relevamiento manual.":
    "Some material is up to {n} days old. The Copilot cites each document's date when it uses it, but the manual survey should be refreshed.",

  // --- src/components/copiloto/informes-panel.tsx
  "Resumen de la semana": "Summary of the week",
  "Precios y modelos": "Prices and models",
  "Precios de lista de la competencia": "Competitor list prices",
  "Promociones de la competencia": "Competitor promotions",
  "Cambios en las webs de la competencia": "Changes on competitor websites",
  "Battle cards modelo contra modelo": "Model-vs-model battle cards",
  "Noticias y lanzamientos": "News and launches",
  "Redes sociales": "Social media",
  "Tendencias globales": "Global trends",
  "No se pudo contactar al servidor.": "Could not reach the server.",
  "Cargando informes…": "Loading reports…",
  "Todavía no hay informes semanales. Hermes los arma los lunes a la mañana con lo que relevó en la semana (promociones, cambios en las webs, precios de lista y battle cards).":
    "There are no weekly reports yet. Hermes builds them on Monday mornings from what it collected during the week (promotions, website changes, list prices and battle cards).",
  "Semana del {semana}": "Week of {semana}",

  // --- src/lib/cadam/inteligencia.ts
  "{nombre}: {antes} → {ahora} u. ({variacion})": "{nombre}: {antes} → {ahora} units ({variacion})",
  "sube {n} posición ({antes} → {ahora})": "up {n} position ({antes} → {ahora})",
  "sube {n} posiciónes ({antes} → {ahora})": "up {n} positions ({antes} → {ahora})",
  "baja {n} posición ({antes} → {ahora})": "down {n} position ({antes} → {ahora})",
  "baja {n} posiciónes ({antes} → {ahora})": "down {n} positions ({antes} → {ahora})",
  "No hay datos de {anio} cargados, así que no se puede comparar contra el año anterior. Los hallazgos que dependen de esa comparación no se generan.":
    "No {anio} data has been loaded, so there is nothing to compare against the previous year. Findings that depend on that comparison are not generated.",
  "En {periodo} se matricularon {n} unidades. No hay período anterior cargado para comparar.":
    "In {periodo}, {n} units were registered. No prior period has been loaded for comparison.",
  "En {periodo} se matricularon {n} unidades, un alza de {variacion} frente a las {base} del mismo período de {anio}.":
    "In {periodo}, {n} units were registered, an increase of {variacion} over the {base} in the same period of {anio}.",
  "En {periodo} se matricularon {n} unidades, una baja de {variacion} frente a las {base} del mismo período de {anio}.":
    "In {periodo}, {n} units were registered, a decrease of {variacion} from the {base} in the same period of {anio}.",
  "CADAM todavía no publicó la importación de {periodo}: no hay cifra de importaciones ni diferencia contra matriculación para este período.":
    "CADAM has not yet published imports for {periodo}: there is no import figure or difference against registrations for this period.",
  "Las importaciones sumaron {n} unidades hasta {hasta} ({variacion}), porque CADAM todavía no publicó la importación de {faltan}.":
    "Imports totaled {n} units through {hasta} ({variacion}), because CADAM has not yet published imports for {faltan}.",
  "Las importaciones sumaron {n} unidades hasta {hasta}, porque CADAM todavía no publicó la importación de {faltan}.":
    "Imports totaled {n} units through {hasta}, because CADAM has not yet published imports for {faltan}.",
  "Las importaciones sumaron {n} unidades ({variacion}).": "Imports totaled {n} units ({variacion}).",
  "Las importaciones sumaron {n} unidades.": "Imports totaled {n} units.",
  "la importación": "imports",
  "la matriculación": "registrations",
  "La diferencia contra matriculación es de {n} unidades a favor de {lado} en {tramo}, el tramo que tienen las dos fuentes, una señal orientativa y no una medida de stock.":
    "The gap between imports and registrations is {n} units in favor of {lado} in {tramo}, the span both sources cover, a rough signal and not a measure of stock.",
  "La diferencia contra matriculación es de {n} unidades a favor de {lado}, una señal orientativa y no una medida de stock.":
    "The gap between imports and registrations is {n} units in favor of {lado}, a rough signal and not a measure of stock.",
  "Lidera {marca} con {n} unidades ({pct}% del mercado).": "{marca} leads with {n} units ({pct}% of the market).",
  "Las marcas propias suman {n} unidades, {pct}% del mercado.": "Own brands total {n} units, {pct}% of the market.",
  "{marca} lidera el crecimiento en unidades": "{marca} leads unit growth",
  "Es quien más volumen agregó al mercado en el período; marca la dirección de la demanda.":
    "It added the most volume to the market in the period; it sets the direction of demand.",
  "{marca}: {antes} → {ahora} u. ({variacion}, {delta} u.)": "{marca}: {antes} → {ahora} units ({variacion}, {delta} units)",
  "{marca} lidera la caída en unidades": "{marca} leads the decline in units",
  "Pérdida de volumen sostenida sobre una base relevante.": "Sustained volume loss on a significant base.",
  "Modelos que más crecieron": "Fastest-growing models",
  "El movimiento a nivel modelo anticipa el de la marca.": "Movement at the model level anticipates the brand's.",
  "{n} modelos nuevos con volumen relevante": "{n} new models with significant volume",
  "No tenían matriculaciones en el período anterior: son lanzamientos o ingresos al mercado.":
    "They had no registrations in the prior period: they are launches or market entries.",
  "{marca} {modelo} ({n} u.)": "{marca} {modelo} ({n} units)",
  "{n} unidades en total": "{n} units in total",
  "El segmento {segmento} gana peso en el mercado": "The {segmento} segment is gaining ground in the market",
  "El segmento {segmento} pierde peso en el mercado": "The {segmento} segment is losing ground in the market",
  "Está creciendo más rápido que el mercado: se lleva participación de los demás.":
    "It is growing faster than the market: it is taking share from the others.",
  "Crece menos que el mercado (o cae): otros segmentos le sacan participación.":
    "It is growing slower than the market (or declining): other segments are taking its share.",
  "{antes} → {ahora} u. ({variacion}), participación {delta} hasta {pct}%": "{antes} → {ahora} units ({variacion}), share {delta} to {pct}%",
  "{tecnologia} es la tecnología de mayor crecimiento": "{tecnologia} is the fastest-growing powertrain",
  "La adopción de tecnologías alternativas marca hacia dónde va el mix de producto.":
    "Adoption of alternative powertrains shows where the product mix is heading.",
  "{marca} (marca propia)": "{marca} (own brand)",
  "{marca} (competidor clave)": "{marca} (key competitor)",
  "Crecimiento abrupto de {marca}": "Sharp growth in {marca}",
  "Caída abrupta de {marca}": "Sharp drop in {marca}",
  "Un salto de esta magnitud cambia el equilibrio competitivo del período.": "A jump of this size changes the period's competitive balance.",
  "Una caída de esta magnitud sobre una base relevante requiere explicación.": "A drop of this size on a significant base calls for an explanation.",
  "{antes} → {ahora} u. ({variacion}), participación {pct}%": "{antes} → {ahora} units ({variacion}), share {pct}%",
  "{marca} sube {n} posiciones sin un cambio abrupto de volumen": "{marca} moves up {n} positions without a sharp change in volume",
  "{marca} baja {n} posiciones sin un cambio abrupto de volumen": "{marca} drops {n} positions without a sharp change in volume",
  "Se movió en el ranking por lo que hicieron las demás, no por su propio volumen.":
    "It moved in the ranking because of what the others did, not because of its own volume.",
  "Posición {antes} → {ahora} · {n} u. ({variacion})": "Rank {antes} → {ahora} · {n} units ({variacion})",
  "Se está importando bastante más de lo que se patenta": "Far more is being imported than registered",
  "Se está patentando bastante más de lo que se importa": "Far more is being registered than imported",
  "Una brecha sostenida sugiere un cambio de ritmo entre el ingreso de unidades y su venta. Es orientativo: no equivale a stock real.":
    "A sustained gap suggests a change in pace between units arriving and units sold. It is indicative only: it is not the same as actual stock.",
  "Importación {imp} u. vs matriculación {mat} u. Relación matric./import. {rel} · {tramo}, el tramo que tienen las dos fuentes":
    "Imports {imp} units vs registrations {mat} units. Registrations/imports ratio {rel} · {tramo}, the span both sources cover",
  "Importación {imp} u. vs matriculación {mat} u. Relación matric./import. {rel}":
    "Imports {imp} units vs registrations {mat} units. Registrations/imports ratio {rel}",
  "Faltan meses en la serie de matriculación": "Months are missing from the registrations series",
  "Un hueco en el histórico distorsiona promedios, tendencias y proyecciones.": "A gap in the history distorts averages, trends and projections.",
  "Meses sin datos en el origen: {meses}": "Months with no data at the source: {meses}",
  "Sin clasificación de segmento en {anio}": "No segment classification in {anio}",
  "CADAM no publica el segmento antes de {anio}: el análisis por segmento de este año no es posible.":
    "CADAM does not publish the segment before {anio}: segment analysis for this year is not possible.",
  "El segmento aparece recién desde {anio}.": "The segment only appears from {anio}.",
  "Baja participación propia en {segmento}, que además está creciendo": "Low own share in {segmento}, which is also growing",
  "Segmento en expansión donde las marcas propias casi no están presentes.": "An expanding segment where own brands are barely present.",
  "Segmento {n} u. ({variacion}); marcas propias {propias} u. = {pct}% del segmento":
    "Segment {n} units ({variacion}); own brands {propias} units = {pct}% of the segment",
  "Cada punto de participación en este segmento son ~{n} unidades": "Each share point in this segment is ~{n} units",
  "{tecnologia} crece fuerte y las marcas propias casi no participan": "{tecnologia} is growing strongly and own brands barely participate",
  "Posición fuerte en {tecnologia}, una tecnología en expansión": "Strong position in {tecnologia}, an expanding powertrain",
  "Tecnología emergente donde todavía hay espacio para entrar.": "An emerging powertrain with room left to enter.",
  "Las marcas propias están sobre-representadas en una tecnología que crece.": "Own brands are over-represented in a powertrain that is growing.",
  "{tecnologia}: {antes} → {ahora} u. ({variacion}); marcas propias {propias} u. = {pct}%":
    "{tecnologia}: {antes} → {ahora} units ({variacion}); own brands {propias} units = {pct}%",
  "{marca} crece en unidades pero pierde posiciones": "{marca} grows in units but loses positions",
  "El mercado crece más rápido que la marca: se avanza en volumen y se retrocede en relevancia.":
    "The market is growing faster than the brand: it gains volume but loses relevance.",
  "{antes} → {ahora} u. ({variacion}) pero cae de la posición {posAntes} a la {posAhora}":
    "{antes} → {ahora} units ({variacion}) but falls from rank {posAntes} to {posAhora}",
  "Caída sostenida de {marca} (marca propia)": "Sustained decline of {marca} (own brand)",
  "Pérdida de volumen sobre una base relevante en una marca del portafolio.": "Volume loss on a significant base in one of the portfolio's brands.",
  "{antes} → {ahora} u. ({variacion})": "{antes} → {ahora} units ({variacion})",
  "{marca} depende de un solo modelo": "{marca} depends on a single model",
  "Una caída de ese modelo arrastra a toda la marca; poco margen para compensar.":
    "A decline in that model drags down the whole brand; little room to compensate.",
  "{modelo} concentra {n} de {total} u. = {pct}% de la marca": "{modelo} accounts for {n} of {total} units = {pct}% of the brand",
  "{marca} (competidor clave) más que duplicó su volumen": "{marca} (key competitor) more than doubled its volume",
  "Un competidor directo acelerando a este ritmo redistribuye participación del resto.":
    "A direct competitor accelerating at this pace redistributes share from the rest.",
  "{antes} → {ahora} u. ({variacion}), ahora {pct}% del mercado": "{antes} → {ahora} units ({variacion}), now {pct}% of the market",
  "El mercado tiene estacionalidad real: {fuerte} fuerte, {debil} débil": "The market is genuinely seasonal: {fuerte} is strong, {debil} is weak",
  "Comparar un mes contra el anterior sin descontar este patrón lleva a conclusiones falsas.":
    "Comparing one month with the previous one without adjusting for this pattern leads to false conclusions.",
  "Índice de {fuerte}: {indiceFuerte} ({sobre}% sobre un mes promedio); {debil}: {indiceDebil}. Calculado sobre {n} años completos ({anios}).":
    "{fuerte} index: {indiceFuerte} ({sobre}% above an average month); {debil}: {indiceDebil}. Calculated over {n} full years ({anios}).",
  "El mercado acumula {n} meses subiendo (sin contar la estacionalidad)": "The market has been rising for {n} months (excluding seasonality)",
  "El mercado acumula {n} meses bajando (sin contar la estacionalidad)": "The market has been falling for {n} months (excluding seasonality)",
  "Racha medida sobre la serie desestacionalizada: es dirección real, no el calendario.":
    "Streak measured on the seasonally adjusted series: it is a real direction, not the calendar.",
  "Pendiente de los últimos 12 meses: {pendiente} unidades/mes; últimos 3 meses vs los 3 previos: {aceleracion}":
    "Slope over the last 12 months: {pendiente} units/month; last 3 months vs the previous 3: {aceleracion}",
  "Pendiente de los últimos 12 meses: {pendiente} unidades/mes": "Slope over the last 12 months: {pendiente} units/month",
  "últimos 12 meses": "last 12 months",
  "{mes} {anio} fue atípico incluso para un {mes}": "{mes} {anio} was unusual even for a typical {mes}",
  "Se desvía de lo esperable ya descontada la estacionalidad: hubo algo más que el calendario.":
    "It deviates from what is expected once seasonality is removed: something more than the calendar was at work.",
  "{n} unidades contra ~{esperado} esperables ({sigmas}σ)": "{n} units vs ~{esperado} expected ({sigmas}σ)",
  "Proyección de cierre {anio}: ~{n} matriculaciones": "{anio} year-end projection: ~{n} registrations",
  "A diferencia de la proyección simple, esta aplica el patrón estacional a los meses que faltan.":
    "Unlike the simple projection, this one applies the seasonal pattern to the remaining months.",
  "Acumulado real {acumulado} u. en {meses} meses; los {faltan} restantes se estiman con el índice estacional de cada mes.":
    "Actual year to date {acumulado} units over {meses} months; the remaining {faltan} are estimated with each month's seasonal index.",
  "Base estacional corta: tomar con cautela.": "Short seasonal base: treat with caution.",
  "Proyección orientativa": "Indicative projection",
  "Marcas del radar con trayectoria ascendente sostenida (12m vs 12m)": "Watchlist brands on a sustained upward trajectory (12m vs 12m)",
  "La ventana móvil de 12 meses no depende de dónde caiga el corte del año: es tendencia de fondo.":
    "The rolling 12-month window does not depend on where the year cutoff falls: it is the underlying trend.",
  "{marca} (propia)": "{marca} (own)",
  "últimos 24 meses": "last 24 months",

  // --- src/lib/copiloto/ollama.ts
  "No se encontró Ollama en ninguna de estas direcciones: {lista}. Definí COPILOTO_OLLAMA_URL si está en otra.":
    "Ollama was not found at any of these addresses: {lista}. Set COPILOTO_OLLAMA_URL if it is somewhere else.",
  "El modelo no respondió a tiempo. Suele pasar en la primera pregunta después de un rato, mientras se carga en la placa. Probá de nuevo.":
    "The model did not respond in time. This usually happens on the first question after a while, as the model loads onto the GPU. Try again.",
  "No se pudo contactar al modelo ({modelo}) en {base}: {detalle}": "Could not reach the model ({modelo}) at {base}: {detalle}",
  "El modelo respondió {status}: {detalle}": "The model responded {status}: {detalle}",
  "El modelo devolvió una respuesta vacía.": "The model returned an empty response.",
  "No obtuve respuesta. Probá reformular.": "I did not get a response. Try rephrasing.",
  "Me quedé sin pasos antes de llegar a una respuesta. Probá una pregunta más acotada (una marca, un período).":
    "I ran out of steps before reaching an answer. Try a narrower question (one brand, one period).",

  // --- src/lib/informes/inteligencia-propia.ts
  "{n} %": "{n}%",
  "SIN MARCA": "NO BRAND",
  "Stock de hoy · ritmo {desde}–{hasta} (Cars)": "Stock today · pace {desde}–{hasta} (Cars)",
  "{n} versión se queda sin stock en menos de un mes y medio": "{n} version will run out of stock in under a month and a half",
  "{n} versiones se quedan sin stock en menos de un mes y medio": "{n} versions will run out of stock in under a month and a half",
  "Se venden y lo que hay libre, contando lo que viene en viaje, no llega al mes y medio: hay que pedir ahora.":
    "They are selling, and the free stock, counting what is in transit, will not last a month and a half: order now.",
  "{version}: {libres} libres, {ritmo}/mes": "{version}: {libres} free, {ritmo}/month",
  "Pedido de stock": "Stock order",
  "{n} versión tiene más de seis meses de stock": "{n} version has more than six months of stock",
  "{n} versiones tienen más de seis meses de stock": "{n} versions have more than six months of stock",
  "Plata parada: salen con promoción, con incentivo al asesor o se frena el próximo pedido.":
    "Cash tied up: move them with a promotion or an advisor incentive, or hold back the next order.",
  "{version}: {libres} libres, {meses} meses": "{version}: {libres} free, {meses} months",
  "{version}: {libres} libres, sin ritmo": "{version}: {libres} free, no pace",
  "Promoción / freno de pedido": "Promotion / order hold",
  "{n} asesor retail dejó de facturar en {mes}": "{n} retail advisor stopped invoicing in {mes}",
  "{n} asesores retail dejaron de facturar en {mes}": "{n} retail advisors stopped invoicing in {mes}",
  "Vendían 3 o más vehículos en los dos meses anteriores y en el último mes cerrado no facturaron ninguno.":
    "They were selling 3 or more vehicles in the two previous months and invoiced none in the last closed month.",
  "{asesor} ({n} antes)": "{asesor} ({n} previously)",
  "Cars todavía no cargó facturación ni stock: las lecturas de pedido de stock y asesores no se generan.":
    "Cars has not loaded invoicing or stock yet: the stock-order and advisor readings are not generated.",
  "Cars no respondió: las lecturas de pedido de stock y asesores no se generan en esta corrida.":
    "Cars did not respond: the stock-order and advisor readings are not generated in this run.",
  "Plan {version} · facturado a {mes} {anio} (Cars)": "Plan {version} · invoiced through {mes} {anio} (Cars)",
  "Presupuesto {anio}: {hecho} hecho a {mes} ({facturado} facturados; plan vigente {plan}).":
    "{anio} budget: {hecho} achieved through {mes} ({facturado} invoiced; current plan {plan}).",
  "{canal} {anio}: {real} vendidos contra {objetivo} de objetivo a {mes} ({cumplimiento}), según Finanzas; objetivo del año {anual}.":
    "{canal} {anio}: {real} sold against a target of {objetivo} through {mes} ({cumplimiento}), per Finance; annual target {anual}.",
  "{n} marca va por debajo del ritmo que pide el plan {anio}": "{n} brand is behind the pace the {anio} plan requires",
  "{n} marcas van por debajo del ritmo que pide el plan {anio}": "{n} brands are behind the pace the {anio} plan requires",
  "El ritmo de los últimos tres meses cerrados no alcanza el que hace falta para llegar al plan del año en los meses que quedan.":
    "The pace of the last three closed months is not enough to reach the year's plan in the months that remain.",
  "{marcas}: {ritmo}/mes, pide {necesario}": "{marcas}: {ritmo}/month, needs {necesario}",
  "Plan comercial": "Commercial plan",
  "Presupuesto: {mensaje}": "Budget: {mensaje}",
  "Demanda en Bitrix: {leads} leads en el año, {abiertos} siguen abiertos, {convertidos} se convirtieron y {perdidos} se perdieron (el motivo más frecuente: {motivo}, {cantidad}); {descartados} eran spam, duplicados o incontactables.":
    "Bitrix demand: {leads} leads this year, {abiertos} still open, {convertidos} converted and {perdidos} lost (most frequent reason: {motivo}, {cantidad}); {descartados} were spam, duplicates or unreachable.",
  "Demanda en Bitrix: {leads} leads en el año, {abiertos} siguen abiertos, {convertidos} se convirtieron y {perdidos} se perdieron; {descartados} eran spam, duplicados o incontactables.":
    "Bitrix demand: {leads} leads this year, {abiertos} still open, {convertidos} converted and {perdidos} lost; {descartados} were spam, duplicates or unreachable.",
  "{marca}: {leads} leads y {n} vehículo facturado": "{marca}: {leads} leads and {n} vehicle invoiced",
  "{marca}: {leads} leads y {n} vehículos facturados": "{marca}: {leads} leads and {n} vehicles invoiced",
  "Hay demanda registrada sin producto que entregar: es la marca con más leads por vehículo del año.":
    "There is recorded demand with no product to deliver: this is the brand with the most leads per vehicle this year.",
  "{abiertos} abiertos · {perdidos} perdidos ({motivo} {cantidad})": "{abiertos} open · {perdidos} lost ({motivo} {cantidad})",
  "{abiertos} abiertos · {perdidos} perdidos": "{abiertos} open · {perdidos} lost",
  "Producto / preventa": "Product / pre-sales",
  "{marca}: {n} leads por cada vehículo facturado": "{marca}: {n} leads per vehicle invoiced",
  "Muy por encima del resto del grupo: o la demanda se desaprovecha en el seguimiento o los leads llegan de baja calidad.":
    "Far above the rest of the group: either demand is being wasted in follow-up or the leads are of low quality.",
  "{leads} leads, {facturados} facturados, {abiertos} abiertos, {perdidos} perdidos · {motivo} {cantidad}":
    "{leads} leads, {facturados} invoiced, {abiertos} open, {perdidos} lost · {motivo} {cantidad}",
  "{leads} leads, {facturados} facturados, {abiertos} abiertos, {perdidos} perdidos":
    "{leads} leads, {facturados} invoiced, {abiertos} open, {perdidos} lost",
  "Seguimiento comercial": "Sales follow-up",
  "{marca} {modelo}: {n} lead perdido por falta de stock": "{marca} {modelo}: {n} lead lost for lack of stock",
  "{marca} {modelo}: {n} leads perdidos por falta de stock": "{marca} {modelo}: {n} leads lost for lack of stock",
  "Y hoy no hay unidades libres: cada lead que entra se pierde igual.": "And there are no free units today: every lead that comes in is lost anyway.",
  "El CRM registra la pérdida por stock; conviene cruzarlo con lo que hay libre hoy.":
    "The CRM records the loss as stock-related; it should be cross-checked against the free stock today.",
  "{demanda} de demanda en el año, {abiertos} abiertos, {facturados} facturados, {libres} libres hoy":
    "{demanda} demand records this year, {abiertos} open, {facturados} invoiced, {libres} free today",
  "{demanda} de demanda en el año, {abiertos} abiertos, {facturados} facturados":
    "{demanda} demand records this year, {abiertos} open, {facturados} invoiced",
  "{marca} {modelo}: {abiertos} contactos abiertos y {libres} unidades libres": "{marca} {modelo}: {abiertos} open contacts and {libres} free units",
  "Demanda registrada y stock para entregar: es el modelo para empujar con el equipo esta semana.":
    "Recorded demand and free stock to deliver: this is the model to push with the team this week.",
  "{demanda} de demanda en el año, {facturados} facturados": "{demanda} demand records this year, {facturados} invoiced",
  "Bitrix todavía no cargó leads ni negocios: las lecturas de demanda no se generan.":
    "Bitrix has not loaded leads or deals yet: the demand readings are not generated.",
  "No se pudo leer la demanda de Bitrix en esta corrida.": "Bitrix demand could not be read in this run.",
  "{desde}–{hasta} (Meta y Cars)": "{desde}–{hasta} (Meta and Cars)",
  "Pauta en Meta: US$ {total} en el año, US$ {porVehiculo} por cada vehículo facturado.":
    "Meta ad spend: US$ {total} this year, US$ {porVehiculo} per vehicle invoiced.",
  "{marca}: US$ {porVehiculo} de pauta por cada vehículo facturado": "{marca}: US$ {porVehiculo} of ad spend per vehicle invoiced",
  "Muy por encima del promedio del grupo: la pauta no se está convirtiendo en ventas, o la marca vende poco por otro motivo.":
    "Far above the group average: ad spend is not turning into sales, or the brand sells little for another reason.",
  "US$ {gasto} de pauta, {facturados} facturados, {leads} leads (US$ {costo} por lead)":
    "US$ {gasto} in ad spend, {facturados} invoiced, {leads} leads (US$ {costo} per lead)",
  "US$ {gasto} de pauta, {facturados} facturados, {leads} leads": "US$ {gasto} in ad spend, {facturados} invoiced, {leads} leads",
  "Pauta": "Ad spend",
  "No se pudo leer la pauta de Meta en esta corrida.": "Meta ad spend could not be read in this run.",
  "{periodo} (CADAM y precios de lista)": "{periodo} (CADAM and list prices)",
  "Hueco en {clase} de US$ {banda}: {n} unidades y ninguna nuestra": "Gap in {clase} at US$ {banda}: {n} units and none of them ours",
  "Hueco en {clase} de US$ {banda}: {n} unidades y {parte} nuestra": "Gap in {clase} at US$ {banda}: {n} units and {parte} of them ours",
  "El mercado compra ahí en volumen y no tenemos oferta, o la tenemos a otro precio.":
    "The market buys there in volume and we have no offer, or we have it at a different price.",
  "{mercado} u. en el casillero, {nuestras} nuestras": "{mercado} units in the cell, {nuestras} ours",
  "Producto / precio": "Product / price",
  "{clase}: {parte} de la clase es nuestro": "{clase}: {parte} of the class is ours",
  "Es una clase donde el grupo pesa: cuidar stock y precio ahí rinde más que en cualquier otra.":
    "A class where the group has weight: looking after stock and price here pays off more than anywhere else.",
  "{nuestras} de {mercado} unidades": "{nuestras} of {mercado} units",
  "{modelo} está {diferencia} por encima de la mediana de su clase": "{modelo} is priced {diferencia} above its class median",
  "Compite en {clase} y la mitad de sus rivales cuesta menos: el precio es un argumento en contra.":
    "It competes in {clase} and half of its rivals cost less: price works against it.",
  "US$ {precio} contra mediana US$ {mediana} · {unidades} u., {parte} de la clase":
    "US$ {precio} vs median US$ {mediana} · {unidades} units, {parte} of the class",
  "Precio": "Price",
  "{modelo} está {diferencia} por debajo de su clase y tiene {parte} de ella":
    "{modelo} is priced {diferencia} below its class median and holds {parte} of the class",
  "El precio no es la barrera: lo que falta es presencia, pauta o argumento de producto.":
    "Price is not the barrier: what is missing is presence, advertising or a product argument.",
  "US$ {precio} contra mediana US$ {mediana} · {unidades} de {unidadesClase} u. de la clase":
    "US$ {precio} vs median US$ {mediana} · {unidades} of {unidadesClase} units in the class",
  "Comercial": "Commercial",
  "Cars no respondió: el precio de nuestros modelos no entra en la lectura por clase.":
    "Cars did not respond: the price of our models is not included in the class reading.",
  "No se pudo armar la lectura por clase de vehículo en esta corrida.": "The vehicle-class reading could not be built in this run.",

  // --- src/lib/informes/transmision.ts
  "mecánico": "manual",
  "automático": "automatic",
  "sin dato": "no data",
};

export default EN;
