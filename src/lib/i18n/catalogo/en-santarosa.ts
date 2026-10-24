/** Frases en inglés: santarosa (acciones comerciales, gama propia, rentabilidad, nuestra operación, CBD, Carflow y las tarjetas «Acciones de la semana»). Clave = el texto en castellano tal cual está en el código. */
const EN: Record<string, string> = {
  // --- components/dashboard/acciones-semana.tsx — «Acciones de la semana»
  "Acciones de la semana": "This week's actions",
  "Los rivales miran todo el mercado del período; stock, asesores y plan, lo último de Cars. Ninguna cambia con Marca, Segmento ni Tecnología.":
    "Rivals look at the whole market for the period; stock, advisors and plan use the latest from Cars. None of them change with Brand, Segment or Powertrain.",
  "Pedir stock": "Order stock",
  "Ninguna versión con menos de un mes y medio de stock.": "No version has less than 1.5 months of stock.",
  "versiones se venden y tienen menos de un mes y medio de stock libre, aun contando lo que viene en viaje.":
    "versions are selling and have less than 1.5 months of free stock, even counting what is in transit.",
  "{n} meses": "{n} months",
  "Empujar con promo": "Push with a promo",
  "Ninguna versión con más de seis meses de stock.": "No version has more than six months of stock.",
  "versiones tienen más de seis meses de stock o casi no se mueven. Plata parada.":
    "versions have more than six months of stock or barely move. Cash tied up.",
  "{n} libres": "{n} free",
  "Rivales en alza": "Rising rivals",
  "Ningún modelo rival ganó participación de forma notable.": "No rival model has gained notable share.",
  "modelos de otras marcas ganaron más participación en los segmentos donde vendemos · {periodo}.":
    "models from other brands gained the most share in the segments where we sell · {periodo}.",
  "Asesores parados": "Stalled advisors",
  "Ningún asesor retail dejó de facturar.": "No retail advisor stopped invoicing.",
  "asesores venían vendiendo y en {mes} no facturaron ningún vehículo.": "advisors had been selling but invoiced no vehicles in {mes}.",
  "asesores venían vendiendo y el último mes no facturaron.": "advisors had been selling but did not invoice in the last closed month.",
  "{n} antes": "{n} before",
  "Rivales cargando stock": "Rivals building stock",
  "Ninguna marca rival importa muy por encima de lo que matricula.": "No rival brand imports far above what it registers.",
  "marcas importaron al menos 50% más de lo que matricularon: stock que va a salir a la calle.":
    "brands imported at least 50% more than they registered: stock that is about to hit the street.",
  "Atrasados contra el plan": "Behind plan",
  "Todas las marcas al ritmo del plan.": "All brands are on pace with the plan.",
  "Hay presupuesto cargado pero Cars no respondió: sin facturas no hay ritmo que comparar.":
    "A budget is loaded but Cars did not respond: without invoices there is no pace to compare.",
  "Sin presupuesto cargado: se lee solo del Excel de Finanzas, una vez por hora.":
    "No budget loaded: it is read only from the Finanzas Excel file, once an hour.",
  "marcas van más lento que lo que pide el plan {version} para lo que queda del año.":
    "brands are running slower than plan {version} requires for the rest of the year.",
  "marcas van más lento que el plan del año.": "brands are running slower than the plan for the year.",
  "falta {n}/mes": "{n}/mo short",
  "Sin datos de Cars ahora mismo.": "No data from Cars right now.",
  "Ver": "View",
  "versión se vende y tiene menos de un mes y medio de stock libre, aun contando lo que viene en viaje.":
    "version is selling and has less than 1.5 months of free stock, even counting what is in transit.",
  "versión tiene más de seis meses de stock o casi no se mueve. Plata parada.":
    "version has more than six months of stock or barely moves. Cash tied up.",
  "modelo de otra marca ganó más participación en los segmentos donde vendemos · {periodo}.":
    "model from another brand gained the most share in the segments where we sell · {periodo}.",
  "asesor venía vendiendo y en {mes} no facturó ningún vehículo.": "advisor had been selling but invoiced no vehicles in {mes}.",
  "asesor venía vendiendo y el último mes no facturó.": "advisor had been selling but did not invoice in the last closed month.",
  "marca importó al menos 50% más de lo que matriculó: stock que va a salir a la calle.":
    "brand imported at least 50% more than it registered: stock that is about to hit the street.",
  "marca va más lento que lo que pide el plan {version} para lo que queda del año.":
    "brand is running slower than plan {version} requires for the rest of the year.",
  "marca va más lento que el plan del año.": "brand is running slower than the plan for the year.",

  // --- lib/informes/cobertura.ts — etiquetas de la acción por versión
  "Pedir": "Order",
  "Llega en viaje": "Arriving",
  "Empujar (promo)": "Push (promo)",
  "Bien": "OK",
  "Vende poco": "Slow seller",

  // --- components/charts/plan-vs-facturado-chart.tsx
  "Plan vigente": "Current plan",
  "Facturado (Cars)": "Invoiced (Cars)",
  "cerrado (el plan es el real)": "closed (plan equals actuals)",
  "plan {plan} · facturado {facturado}": "plan {plan} · invoiced {facturado}",
  "diferencia": "difference",
  "cerrado": "closed",
  "ppto ÷ 12": "budget ÷ 12",

  // --- app/carflow y app/cbd
  "Dónde está cada unidad antes de llegar a la playa: pedida a fábrica, en producción, embarcada, en tránsito, en aduana, en playa. Por marca y modelo, con fechas estimadas.":
    "Where each unit is before it reaches the yard: ordered from the factory, in production, shipped, in transit, in customs, at the yard. By brand and model, with estimated dates.",
  "Todavía sin datos": "No data yet",
  "Hoy el tablero conoce dos puntas del flujo: lo que ya entró al país (importaciones de CADAM) y lo que está en stock o en viaje según la planilla de acciones comerciales. Carflow es lo que hay entre medio: pedidos confirmados, unidades en producción, embarques y su fecha de llegada.":
    "Today the dashboard knows two ends of the flow: what has already entered the country (CADAM imports) and what is in stock or in transit according to the commercial actions sheet. Carflow is what lies in between: confirmed orders, units in production, shipments and their arrival date.",
  "<b>Qué falta:</b> definir la fuente. Si es una planilla, con dejarla en <code>~/Escritorio/DASHBOARD FERNANDO/</code> se carga como las acciones comerciales; si vive en un sistema (Cars, SAP, el portal de fábrica), hace falta el acceso.":
    "<b>What is missing:</b> defining the source. If it is a spreadsheet, just dropping it in <code>~/Escritorio/DASHBOARD FERNANDO/</code> loads it like the commercial actions; if it lives in a system (Cars, SAP, the factory portal), access is needed.",
  "CBD — Cost break down": "CBD — Cost breakdown",
  "El costo de cada versión abierto paso a paso: FOB, flete, C&F, despacho, seguro, SBLC, playa fiscal… hasta el costo puesto en playa, y el margen contra el precio de lista.":
    "The cost of each version broken down step by step: FOB, freight, C&F, customs clearance, insurance, SBLC, bonded yard… up to the landed cost at the yard, and the margin against the list price.",
  "Esta pantalla va a mostrar, por marca y versión, el desglose del costo con el que se arma el precio: lo que se paga a fábrica (FOB), el flete, los gastos de importación y despacho, y cuánto queda de margen sobre el PVP. Es el mismo cuadro «COST BREAK DOWN» que el equipo de producto arma en Excel.":
    "This screen will show, by brand and version, the breakdown of the cost the price is built on: what is paid to the factory (FOB), freight, import and clearance costs, and how much margin is left over the list price (PVP). It is the same “COST BREAK DOWN” table that the product team builds in Excel.",
  "<b>Qué falta:</b> un CBD por marca en <code>~/Escritorio/DASHBOARD FERNANDO/</code>. Hoy hay uno solo (Dongfeng, en «CBD Y BBCH DONGFENG.xlsx»); con los de Jetour, GWM, JAC, Renault, Mitsubishi, Soueast, Leapmotor, Zeekr, JMEV y XPeng se carga igual que las acciones comerciales, sin tocar nada a mano.":
    "<b>What is missing:</b> one CBD per brand in <code>~/Escritorio/DASHBOARD FERNANDO/</code>. Today there is only one (Dongfeng, in “CBD Y BBCH DONGFENG.xlsx”); with those for Jetour, GWM, JAC, Renault, Mitsubishi, Soueast, Leapmotor, Zeekr, JMEV and XPeng it loads the same way as the commercial actions, without touching anything by hand.",

  // --- app/acciones-comerciales/page.tsx
  "{titulo} · descuento máximo, precio con descuento, bono al vendedor y mecánica de cada versión, con lo que cada familia importó, matriculó y facturó en {anio}.":
    "{titulo} · maximum discount, discounted price, salesperson bonus and promo mechanics for each version, with what each family imported, registered and invoiced in {anio}.",
  "Fuente: «{archivo}» de Fernando, modificado {modificado} · cargado {cargado}.":
    "Source: “{archivo}” from Fernando, modified {modificado} · loaded {cargado}.",
  "Todas": "All",
  "Las diez hojas de la planilla, una abajo de la otra.": "All ten sheets of the spreadsheet, one below the other.",
  "{n} marcas · {titulo}": "{n} brands · {titulo}",
  "Con descuento": "With discount",
  "{pct} del PVP, ponderado por stock": "{pct} of list price, stock-weighted",
  "versiones": "versions",
  "Versiones con descuento máximo mayor a cero. El porcentaje es descuento sobre PVP, ponderado por el stock de cada versión.":
    "Versions with a maximum discount above zero. The percentage is the discount over list price (PVP), weighted by each version's stock.",
  "Con bono al vendedor": "With salesperson bonus",
  "Stock": "Stock",
  "unidades, según la planilla": "units, per the sheet",
  "En viaje": "In transit",
  "unidades en camino": "units on the way",
  "Descuento comprometido": "Committed discount",
  "US$ · stock × descuento máximo": "US$ · stock × maximum discount",
  "US$ {monto}: lo que costaría vender todo el stock de hoy al precio con descuento máximo. Es una cota, no un pronóstico: no todas las unidades salen con el descuento entero.":
    "US$ {monto}: what it would cost to sell all of today's stock at the maximum-discount price. It is an upper bound, not a forecast: not every unit sells with the full discount.",
  "<b>La planilla manda.</b> Precios, descuentos, márgenes y notas se muestran tal cual los cargó Fernando en el Excel; acá no se recalcula nada. Lo que agrega el tablero son las tres columnas de la derecha, en la fila de cada familia: cuánto matriculó ({mat}) e importó ({imp}) ese modelo según CADAM{cars}. El cruce es por <b>familia</b> (X50, TANK 300, L200), porque las tres fuentes escriben la versión distinto; cuando una fuente no tiene la familia con ese nombre exacto se usa la más parecida y se marca con «≈».":
    "<b>The sheet is the source of truth.</b> Prices, discounts, margins and notes are shown exactly as Fernando loaded them in the Excel file; nothing is recalculated here. What the dashboard adds are the three columns on the right, in each family's row: how many of that model were registered ({mat}) and imported ({imp}) according to CADAM{cars}. Matching is by <b>family</b> (X50, TANK 300, L200), because the three sources write the version differently; when a source does not have the family under that exact name, the closest one is used and marked with “≈”.",
  ", y cuánto facturamos nosotros según Cars ({periodo})": ", and how many we invoiced according to Cars ({periodo})",
  "Cars no respondió ahora ({error}): la facturación propia no se muestra.":
    "Cars did not respond just now ({error}): our own invoicing is not shown.",
  "Costo y márgenes se muestran solo con rol admin.": "Cost and margins are shown to the admin role only.",
  "Ninguna versión coincide con ese filtro.": "No version matches that filter.",
  "1 versión": "1 version",
  "{n} versiones": "{n} versions",
  "{n} con descuento": "{n} with discount",
  "stock {n}": "stock {n}",
  "{n} en viaje": "{n} in transit",
  "Portafolio": "Portfolio",
  "Notas de la hoja": "Sheet notes",
  "La planilla mensual de Fernando: descuento máximo, precio con descuento, bono al vendedor y mecánica de cada versión.":
    "Fernando's monthly sheet: maximum discount, discounted price, salesperson bonus and promo mechanics for each version.",
  "Todavía no se cargó ninguna planilla": "No sheet has been loaded yet",
  "Hermes la carga solo cuando aparece o cambia el archivo <code>{archivo}</code> en <code>{carpeta}</code> de la notebook (cron «Advisor · Acciones comerciales», cada 4 horas). Para forzarla ahora:":
    "Hermes loads it on its own when the file <code>{archivo}</code> appears or changes in <code>{carpeta}</code> on the laptop (cron “Advisor · Acciones comerciales”, every 4 hours). To force it now:",

  // --- components/dashboard/tabla-acciones.tsx
  "promedio": "average",
  "Vtas./mes": "Sales/mo",
  "+ en viaje": "+ in transit",
  "PVP": "List price",
  "lista, US$": "list, US$",
  "Con dcto.": "With disc.",
  "y cuánto": "and how much",
  "Margen": "Margin",
  "c/ dcto. máx.": "at max. disc.",
  "Bono": "Bonus",
  "vendedor": "salesperson",
  "Seña": "Deposit",
  "Fact.": "Inv.",
  "Cerrar el detalle de {version}": "Close the details of {version}",
  "Ver el detalle de {version}": "Open the details of {version}",
  "PVP: {texto}": "List price: {texto}",
  "+{n} en viaje": "+{n} in transit",
  "sin dcto.": "no disc.",
  "PVP s/IVA": "List price excl. VAT",
  "Con dcto. s/IVA": "Discounted excl. VAT",
  "Costo SR": "SR cost",
  "Margen sin descuento": "Margin before discount",
  "Margen neto": "Net margin",
  "Precio máx. sin afectar comisión": "Max. price without affecting commission",
  "Soporte FOB": "FOB support",
  "Soporte por venta": "Support per sale",
  "Total soporte": "Total support",
  "Margen con soporte": "Margin with support",
  "Venta wholesale Nipon": "Nipon wholesale sales",
  "Stock final SR": "Ending stock SR",
  "Mecánica": "Promo mechanics",
  "Total marca": "Brand total",
  "Stock {n}": "Stock {n}",
  "En viaje {n}": "In transit {n}",
  "Descuento comprometido {monto}": "Committed discount {monto}",
  "Stock × descuento máximo de cada versión: lo que costaría vender todo el stock de hoy al precio con descuento. Es una cota, no un pronóstico.":
    "Stock × maximum discount of each version: what it would cost to sell all of today's stock at the discounted price. It is an upper bound, not a forecast.",
  "Esa fuente no tiene la familia con este nombre exacto; se muestra «{familia}»: {modelos}.":
    "That source does not have the family under this exact name; “{familia}” is shown: {modelos}.",
  "Suma de: {modelos}.": "Sum of: {modelos}.",
  "aproximado": "approximate",

  // --- components/dashboard/tabla-rentabilidad.tsx
  "Base · planilla de {mes}": "Base · {mes} sheet",
  "Ventas · Cars {periodo}": "Sales · Cars {periodo}",
  "marca, modelo y versión": "brand, model and version",
  "PVP base": "Base list price",
  "lista US$ · % del total": "list US$ · % of total",
  "Margen base": "Base margin",
  "US$, sin descuento · % del total": "US$, before discount · % of total",
  "Margen % base": "Base margin %",
  "sobre el PVP sin IVA": "over list price excl. VAT",
  "Cant. vendida": "Qty. sold",
  "facturadas · % del total": "invoiced · % of total",
  "Ticket prom.": "Avg. ticket",
  "US$ a precio de acción · % de la facturación": "US$ at promo price · % of invoicing",
  "Margen prom.": "Avg. margin",
  "US$ por unidad · % del margen": "US$ per unit · % of margin",
  "Margen prom. %": "Avg. margin %",
  "sobre el ticket sin IVA": "over ticket excl. VAT",
  "{nombre}: facturada en Cars, sin fila en la planilla": "{nombre}: invoiced in Cars, no row in the sheet",
  "{nombre}: facturada en Cars, su familia no está en la planilla": "{nombre}: invoiced in Cars, its family is not in the sheet",
  "Total del filtro": "Filter total",
  "{n} versiones · {v} con venta": "{n} versions · {v} with sales",
  "sin planilla": "no sheet",
  "cruce aproximado": "approximate match",
  "Cars la llama «{cars}»: el cruce con «{version}» es por familia, parte del nombre y precio, no por el nombre entero.":
    "Cars calls it “{cars}”: the match with “{version}” is by family, part of the name and price, not by the full name.",
  "En Cars: «{cars}».": "In Cars: “{cars}”.",

  // --- app/gama-propia/page.tsx
  "lista propia cargada": "own uploaded list",
  "stock de Cars": "Cars stock",
  "Posicionamiento por precio de los modelos del grupo · {fuente} {periodo} · {fuente2} {periodo2} en la tabla.":
    "Price positioning of the group's models · {fuente} {periodo} · {fuente2} {periodo2} in the table.",
  "Posicionamiento por precio de los modelos del grupo · {fuente} {periodo}.": "Price positioning of the group's models · {fuente} {periodo}.",
  "Fuente: CADAM / DNRA · {cortes} · precios: {precios} (sinc. {fecha}).": "Source: CADAM / DNRA · {cortes} · prices: {precios} (synced {fecha}).",
  "Fuente: CADAM / DNRA · {cortes} · precios: {precios}.": "Source: CADAM / DNRA · {cortes} · prices: {precios}.",
  "No se pudo leer el stock de Cars": "Could not read the Cars stock",
  "Sin precios para este período": "No prices for this period",
  "Los precios salen del stock de Cars y la base no respondió: <code>{error}</code>. No es que no tengamos precios — es que no se pudieron leer ahora. El resto del tablero no depende de esto.":
    "Prices come from the Cars stock and the database did not respond: <code>{error}</code>. It is not that we have no prices — they just could not be read right now. The rest of the dashboard does not depend on this.",
  "Esta vista cruza las unidades de CADAM con el precio de lista. CADAM no trae importes, así que sin precio no hay eje que mostrar. Normalmente el precio sale solo del stock de Cars; si acá no aparece nada, o el período filtrado no tiene ventas del grupo, o el stock todavía no sincronizó.":
    "This view crosses CADAM units with the list price. CADAM carries no amounts, so without a price there is no axis to show. Normally the price comes on its own from the Cars stock; if nothing shows up here, either the filtered period has no sales for the group, or the stock has not synced yet.",
  "También se puede cargar una lista a mano, que tiene prioridad sobre Cars:":
    "A list can also be uploaded by hand, and it takes priority over Cars:",
  "# revisar lo que detectó, y sin --dry-run para cargar": "# review what it detected, and run without --dry-run to load it",
  "El archivo puede ser .xlsx, .xls o .csv, con columnas de marca, modelo y precio — los títulos se detectan por alias. Hay una plantilla en <code>CADAM/plantilla-precios.csv</code>.":
    "The file can be .xlsx, .xls or .csv, with brand, model and price columns — headers are detected by alias. There is a template in <code>CADAM/plantilla-precios.csv</code>.",
  "Mientras tanto, el grupo tiene <b>{n} modelos</b> con ventas en el período ({u} u.) esperando precio.":
    "Meanwhile, the group has <b>{n} models</b> with sales in the period ({u} units) waiting for a price.",
  "Mientras tanto, el grupo tiene <b>{n} modelo</b> con ventas en el período ({u} u.) esperando precio.":
    "Meanwhile, the group has <b>{n} model</b> with sales in the period ({u} units) waiting for a price.",
  "Precios de la <b>lista cargada a mano</b>. Se usa la más reciente que no supere el período filtrado{cargadas}.":
    "Prices from the <b>manually uploaded list</b>. The most recent list that is not later than the filtered period is used{cargadas}.",
  "(cargadas: {periodos})": "(uploaded: {periodos})",
  "Precios del <b>stock de Cars</b>, nuestro DMS — el mismo precio de lista que ve un vendedor, sin subir nada a mano. Cuando un modelo tiene varias versiones se toma la más barata: es el «desde» de esa gama.":
    "Prices from the <b>Cars stock</b>, our DMS — the same list price a salesperson sees, with nothing uploaded by hand. When a model has several versions, the cheapest one is used: it is the “from” price of that range.",
  "Esta vista solo cubre las marcas del grupo — <b>no compara contra la competencia</b>, porque CADAM no trae precios de terceros.":
    "This view only covers the group's brands — <b>it does not compare against the competition</b>, because CADAM carries no third-party prices.",
  "Con precio: <b>{u} u.</b> ({pct} de lo que el grupo importó en el período).":
    "With a price: <b>{u} units</b> ({pct} of what the group imported in the period).",
  "Con precio: <b>{u} u.</b> ({pct} de lo que el grupo vendió en el período).":
    "With a price: <b>{u} units</b> ({pct} of what the group sold in the period).",
  "Precio vs. volumen — gama propia · {fuente} {periodo}": "Price vs. volume — own range · {fuente} {periodo}",
  "Cada burbuja es un modelo, en la columna de su marca · eje Y = precio de lista · tamaño = {fuente} del período. La línea punteada es el precio <b>ponderado por unidades</b>, no el promedio simple: un modelo que vendió 3 no puede pesar lo mismo que uno que vendió 300.":
    "Each bubble is a model, in its brand's column · Y axis = list price · size = {fuente} for the period. The dashed line is the <b>unit-weighted</b> price, not the simple average: a model that sold 3 cannot weigh the same as one that sold 300.",
  "<b>Tocá una burbuja</b> y se abre contra quién compite ese modelo: su clase de vehículo, los rivales que más venden ahí con su precio, y si estamos caros o baratos.":
    "<b>Tap a bubble</b> to see who that model competes against: its vehicle class, the best-selling rivals there with their prices, and whether we are expensive or cheap.",
  "La gama, modelo por modelo": "The range, model by model",
  "Los mismos modelos del gráfico, en números: precio de lista y unidades de {fuente} ({periodo})":
    "The same models as in the chart, in numbers: list price and units of {fuente} ({periodo})",
  ", con las {fuente} ({periodo}) al lado": ", with {fuente} ({periodo}) alongside",
  ", lo que facturamos nosotros según Cars en el mismo período": ", what we invoiced according to Cars in the same period",
  "y la <a>acción comercial</a> de {mes}: el descuento máximo de la familia, si tiene bono al vendedor y si hay una mecánica especial":
    "and the <a>commercial action</a> for {mes}: the family's maximum discount, whether it has a salesperson bonus and whether there is a special mechanic",
  "según CADAM": "per CADAM",
  "lista, la versión más barata": "list, cheapest version",
  "Precio US$": "Price US$",
  "facturado por nosotros · {periodo}": "invoiced by us · {periodo}",
  "Fact. Cars": "Invoiced (Cars)",
  "Acción {mes}": "{mes} action",
  "descuento máximo de la familia": "family's maximum discount",
  "(familia {familia})": "(family {familia})",
  "1 versión en la planilla": "1 version in the sheet",
  "{n} versiones en la planilla": "{n} versions in the sheet",
  "sin descuento": "no discount",
  "bono": "bonus",
  "mecánica": "mechanics",
  "Modelos con {fuente} y sin precio": "Models with {fuente} but no price",
  "Vendieron en el período pero no tienen precio en la fuente. Se muestran acá en vez de desaparecer del gráfico: es un dato que falta, no un modelo que no existe.":
    "They sold in the period but have no price in the source. They are shown here instead of disappearing from the chart: it is missing data, not a model that does not exist.",
  "Son casi todos <b>camiones</b> (Fuso, Canter, chasis JAC): Cars no les pone precio de lista porque se cotizan uno por uno.":
    "Almost all are <b>trucks</b> (Fuso, Canter, JAC chassis): Cars does not set a list price for them because they are quoted one by one.",
  "{fuente} del período, sin precio de lista": "{fuente} for the period, with no list price",

  // --- app/rentabilidad/page.tsx
  "Precio y margen de cada versión según la planilla de {mes}, contra lo que facturamos en {periodo}: cuánto vende cada una, a qué ticket y qué margen deja.":
    "Price and margin of each version according to the {mes} sheet, against what we invoiced in {periodo}: how much each one sells, at what ticket, and what margin it leaves.",
  "Fuente: «{archivo}» ({fecha}) · Cars, unidades facturadas hasta {mes}.": "Source: “{archivo}” ({fecha}) · Cars, units invoiced through {mes}.",
  "Fuente: «{archivo}» ({fecha}) · Cars, unidades facturadas.": "Source: “{archivo}” ({fecha}) · Cars, units invoiced.",
  "Planilla": "Sheet",
  "Unidades facturadas": "Units invoiced",
  "Todo lo que Cars facturó de las marcas del filtro en {periodo}, con o sin fila en la planilla. {n} de esas unidades tienen versión en la planilla.":
    "Everything Cars invoiced for the brands in the filter in {periodo}, with or without a row in the sheet. {n} of those units have a version in the sheet.",
  "Versiones con venta": "Versions with sales",
  "versiones de la planilla": "versions in the sheet",
  "Facturación": "Invoicing",
  "US$ a precio de acción · estimada": "US$ at promo price · estimated",
  "US$ {monto}: unidades facturadas × precio con descuento máximo de la planilla. Es el piso de la acción, no el importe real de las facturas: Cars no lo trae de forma confiable.":
    "US$ {monto}: units invoiced × the sheet's maximum-discount price. It is the floor of the promotion, not the actual invoice amount: Cars does not provide it reliably.",
  "US$ · {pct} sobre el precio sin IVA · estimado": "US$ · {pct} over the price excl. VAT · estimated",
  "US$ a precio de acción · estimado": "US$ at promo price · estimated",
  "US$ {monto}: unidades facturadas × margen con descuento máximo de la planilla (costo Santa Rosa de la planilla). Es el margen a precio de acción, no el realizado.":
    "US$ {monto}: units invoiced × the sheet's maximum-discount margin (the sheet's Santa Rosa cost). It is the margin at promo price, not the realized one.",
  "<b>Ticket y margen son a precio de acción, no facturados.</b> Cars trae las unidades que facturamos pero no importes confiables ni costo, así que el ticket y el margen «promedio» se calculan con el precio y el margen<b> con descuento máximo</b> de la planilla de {mes} —el piso de la acción— por las unidades facturadas en {periodo}. Es una estimación conservadora hecha con los números de Fernando; cuando haya dato real de factura (SAP), se reemplaza. El cruce planilla ↔ Cars es por versión, uno a uno dentro de cada familia: cuando el nombre no es el mismo se marca con «≈» y el tooltip dice cómo la llama Cars; lo que Cars facturó sin fila en la planilla se lista aparte y cuenta en el total.":
    "<b>Ticket and margin are at promo price, not invoiced.</b> Cars provides the units we invoice but no reliable amounts or cost, so the “average” ticket and margin are calculated with the price and margin<b> at maximum discount</b> from the {mes} sheet —the floor of the promotion— times the units invoiced in {periodo}. It is a conservative estimate built with Fernando's numbers; when real invoice data (SAP) is available, it will be replaced. The sheet ↔ Cars match is by version, one to one within each family: when the name is not the same it is marked with “≈” and the tooltip says what Cars calls it; what Cars invoiced without a row in the sheet is listed separately and counts in the total.",
  "<b>Cars no respondió ahora</b> ({error}): se ve solo la planilla.": "<b>Cars did not respond just now</b> ({error}): only the sheet is shown.",
  "Versión por versión — base y ventas": "Version by version — base and sales",
  "A la izquierda, lo que dice la <a>planilla</a> de {mes} (PVP, margen sin descuento y margen %); a la derecha, lo que facturamos en {periodo} y su ticket y margen a precio de acción. Debajo de cada valor, qué parte del total del filtro es. La fila de cada familia suma lo que Cars facturó de ella, cruzado o no.":
    "On the left, what the {mes} <a>sheet</a> says (list price, margin before discount and margin %); on the right, what we invoiced in {periodo} and its ticket and margin at promo price. Below each value, what share of the filter total it is. Each family's row adds up what Cars invoiced for it, matched or not.",
  "Volumen contra ticket y margen · {periodo}": "Volume vs. ticket and margin · {periodo}",
  "Cada burbuja es una versión (o una familia) con venta: arriba las que más facturan en unidades, a la derecha las de mayor ticket o margen. Los cuadrantes se cortan en el promedio de lo filtrado. Tocá una marca en la leyenda para apagarla.":
    "Each bubble is a version (or a family) with sales: the top ones invoice the most units, the ones on the right have the highest ticket or margin. The quadrants are split at the average of what is filtered. Tap a brand in the legend to switch it off.",
  "Precio y margen de cada versión contra lo que facturamos.": "Price and margin of each version against what we invoice.",
  "Esta pantalla muestra costos y márgenes: la ve solo el rol administrador.":
    "This screen shows costs and margins: only the administrator role can see it.",
  "Todavía no se cargó ninguna planilla de acciones": "No commercial actions sheet has been loaded yet",
  "El precio y el margen de cada versión salen de la planilla mensual de Fernando. Cuando Hermes la cargue (<a>Acciones comerciales</a>), esta pantalla se arma sola.":
    "The price and margin of each version come from Fernando's monthly sheet. Once Hermes loads it (<a>Commercial actions</a>), this screen builds itself.",

  // --- app/operacion/page.tsx — cabecera, señales y pestaña Resumen
  "Facturación y stock propios, del API de Cars.": "Our own invoicing and stock, from the Cars API.",
  "Todavía no llegaron los datos de Cars": "The Cars data has not arrived yet",
  "Los empuja Hermes cada 4 horas desde la máquina donde el API responde. Si pasaron varias horas y sigue vacío, revisá el trabajo advisor-datos-propios en Hermes.":
    "Hermes pushes it every 4 hours from the machine where the API responds. If several hours have passed and it is still empty, check the advisor-datos-propios job in Hermes.",
  "Se perdió por falta de stock y hoy no hay libres.": "Lost for lack of stock, and there are none free today.",
  "{n} sin stock": "{n} lost, no stock",
  "Se perdió {n} vez por falta de stock; hoy hay {libres} libres.": "Lost {n} time for lack of stock; {libres} free today.",
  "Se perdió {n} veces por falta de stock; hoy hay {libres} libres.": "Lost {n} times for lack of stock; {libres} free today.",
  "Empujar": "Push",
  "Hay demanda abierta y stock libre para entregar.": "There is open demand and free stock ready to deliver.",
  "Revisar precio": "Review price",
  "Se pierde por precio o por la competencia.": "Losing deals on price or to the competition.",
  "Resumen": "Summary",
  "Cómo venimos: facturado, mercado, stock y plan, marca por marca.": "How we are doing: invoiced, market, stock and plan, brand by brand.",
  "Stock y pedido": "Stock and ordering",
  "Qué pedir, qué empujar con promoción y todo el stock por modelo.": "What to order, what to push with a promotion, and all the stock by model.",
  "Demanda": "Demand",
  "Los leads de Bitrix: cuánta demanda entró, cuánta se perdió y por qué.": "Bitrix leads: how much demand came in, how much was lost and why.",
  "Equipo": "Team",
  "Quién vende y desde qué local.": "Who sells, and from which branch.",
  "Facturación, stock, demanda y equipo de venta · {periodo}.": "Invoicing, stock, demand and sales team · {periodo}.",
  "(sinc. {fecha})": "(synced {fecha})",
  "hasta {mes}": "through {mes}",
  "Facturado": "Invoiced",
  "Vehículos facturados en Cars. Contra {n} en el mismo período de {anio}.": "Vehicles invoiced in Cars. Versus {n} in the same period of {anio}.",
  "Matriculado (CADAM)": "Registered (CADAM)",
  "Sin datos de CADAM": "No CADAM data",
  "Marcas propias registradas por la DNRA hasta {mes}, el último mes que CADAM publicó. Es otro evento, no el mismo dato.":
    "Own brands registered with the DNRA through {mes}, the last month CADAM published. It is a different event, not the same data point.",
  "Marcas propias registradas por la DNRA en el mismo período. Es otro evento, no el mismo dato.":
    "Own brands registered with the DNRA in the same period. It is a different event, not the same data point.",
  "Participación de mercado": "Market share",
  "{a} de {b} matriculaciones del país. Se mide con CADAM, no con nuestras facturas: el denominador es el mercado.":
    "{a} of {b} registrations in the country. It is measured with CADAM, not with our invoices: the denominator is the market.",
  "Unidades en stock": "Units in stock",
  "Hoy": "Today",
  "{n} reservadas. Incluye lo que está en viaje: el detalle está en la pestaña Stock y pedido.":
    "{n} reserved. It includes what is in transit: the detail is in the Stock and ordering tab.",
  "Presupuesto {anio}": "{anio} budget",
  "Meta del período": "Target for the period",
  "hecho · {a} de {b}": "achieved · {a} of {b}",
  "{a} de {b} · {periodo}": "{a} of {b} · {periodo}",
  "Qué parte del presupuesto original del año ({total} u., solo las marcas que lo tienen) ya se facturó, hasta {mes}. El plan vigente ({version}) suma {plan} u.":
    "How much of the year's original budget ({total} units, only the brands that have one) has already been invoiced, through {mes}. The current plan ({version}) adds up to {plan} units.",
  "Vehículos facturados contra la meta cargada en Configuración para estos meses.":
    "Vehicles invoiced against the target loaded in Settings for these months.",
  "<b>Facturar no es matricular.</b> Cars cuenta cada vehículo (VIN) en el mes de su primera factura; CADAM, cuándo la DNRA lo registró — y el comprador matricula después, o nunca si es flota o si registra en otra plaza. Por eso las dos cifras no coinciden y <b>ninguna de las dos está mal</b>: miden momentos distintos del mismo auto.":
    "<b>Invoicing is not registering.</b> Cars counts each vehicle (VIN) in the month of its first invoice; CADAM counts when the DNRA registered it — and the buyer registers later, or never if it is a fleet or is registered elsewhere. That is why the two figures do not match and <b>neither is wrong</b>: they measure different moments of the same car.",
  "Hasta {mes}, donde cierra CADAM, nuestra facturación creció <b>{a}</b> y las matriculaciones de nuestras marcas en CADAM —una fuente que no es nuestra— <b>{b}</b>.":
    "Through {mes}, where CADAM closes, our invoicing grew <b>{a}</b> and registrations of our brands in CADAM —a source that is not ours— grew <b>{b}</b>.",
  "En este período nuestra facturación creció <b>{a}</b> y las matriculaciones de nuestras marcas en CADAM —una fuente que no es nuestra— <b>{b}</b>.":
    "In this period our invoicing grew <b>{a}</b> and registrations of our brands in CADAM —a source that is not ours— grew <b>{b}</b>.",
  "Dos caminos separados, la misma historia.": "Two separate paths, the same story.",
  "La diferencia es esperable: la matriculación va atrás de la factura, así que cuanto más cerca esté el período del último mes cerrado, más se abre la brecha. Achicá el rango de meses para compararlos con la cola ya registrada.":
    "The difference is expected: registration lags invoicing, so the closer the period is to the last closed month, the wider the gap gets. Narrow the month range to compare them over the part that is already registered.",
  "Facturación mensual": "Monthly invoicing",
  "Vehículos facturados por mes; el año anterior, punteado.": "Vehicles invoiced per month; previous year dotted.",
  "Sin facturación cargada para estos años.": "No invoicing loaded for these years.",
  "Stock por estado — hoy": "Stock by status — today",
  "«En viaje» y «sin despachar» no se entregan mañana: por eso no se colapsa en un solo número.":
    "“In transit” and “not dispatched” units cannot be delivered tomorrow, which is why this is not collapsed into a single number.",
  "Marca por marca": "Brand by brand",
  "Mercado y stock — {periodo}": "Market and stock — {periodo}",
  "Lo que vendimos, lo que la marca patentó en todo el país y cuánto dura el stock al ritmo de hoy.":
    "What we sold, what the brand registered nationwide, and how long the stock lasts at today's pace.",
  "Pauta de Meta del período: US$ {total} (US$ {resto} en cuentas de usados o de varias marcas, que no se reparten).":
    "Meta ad spend for the period: US$ {total} (US$ {resto} in used-car or multi-brand accounts, which are not allocated).",
  "Pauta de Meta del período: US$ {total}.": "Meta ad spend for the period: US$ {total}.",
  "vehículos, en Cars": "vehicles, in Cars",
  "chapas en todo el país · su share": "registrations nationwide · its share",
  "Matriculado": "Registered",
  "hoy · con seña": "today · with deposit",
  "Meses de stock": "Months of stock",
  "al ritmo del período": "at the period's pace",
  "gasto en Meta · por vehículo": "Meta spend · per vehicle",
  "meta conjunta: así la presupuesta Finanzas": "combined target: this is how Finanzas budgets it",
  "{pct} del mercado": "{pct} of the market",
  "{n} con seña": "{n} with deposit",
  "Menos de {n} facturas por mes: el cociente no informa nada.": "Fewer than {n} invoices per month: the ratio tells us nothing.",
  "US$ {n} por vehículo": "US$ {n} per vehicle",
  "Unidades de canje y usados de marcas que la casa no distribuye, casi siempre una o dos por marca.":
    "Trade-in and used units of brands the company does not distribute, almost always one or two per brand.",
  "Otras {n} marcas (canje y usados)": "{n} other brands (trade-ins and used)",
  "Otras {n} marca (canje y usados)": "{n} other brand (trade-ins and used)",
  "Plan y presupuesto": "Plan and budget",
  "Contra el plan — {periodo}": "Against the plan — {periodo}",
  "Plan de Finanzas ({version}, archivo del {fecha}). Hasta {mes} el plan ES el real: el cumplimiento se mide sobre los meses que siguen.":
    "Plan from Finanzas ({version}, file dated {fecha}). Through {mes} the plan IS the actual: attainment is measured over the months that follow.",
  "Metas cargadas en Configuración.": "Targets loaded in Settings.",
  "La proyección suma a lo facturado lo que el año pasado se vendió en los meses que faltan, al ritmo de este año.":
    "The projection takes what has been invoiced and adds what was sold last year in the months still to come, at this year's pace.",
  "en el período": "in the period",
  "Plan": "Plan",
  "para estos meses": "for these months",
  "Cumplimiento": "Attainment",
  "facturado ÷ plan": "invoiced ÷ plan",
  "Presupuesto": "Budget",
  "cifra original del año": "original figure for the year",
  "Hecho": "Achieved",
  "del presupuesto anual": "of the annual budget",
  "Proyección": "Projection",
  "cierre estimado / plan del año": "estimated close / plan for the year",
  "Todos los meses del filtro ya cerraron en el Excel: ahí el plan es el real.":
    "All the months in the filter have already closed in the Excel file: there the plan is the actual.",
  "Plan vs. facturado, mes a mes — {anio}": "Plan vs. invoiced, month by month — {anio}",
  "Barras: plan vigente ({version}) y facturado en Cars. Los meses sombreados ya cerraron en el Excel. La línea punteada es el presupuesto anual dividido doce, solo como referencia.":
    "Bars: current plan ({version}) and invoiced in Cars. Shaded months have already closed in the Excel file. The dashed line is the annual budget divided by twelve, for reference only.",
  "<b>CDE y Wholesale tienen objetivo propio en el Excel de Finanzas</b> (la sucursal de Ciudad del Este y las ventas mayoristas). Sus unidades ya están dentro de las marcas de arriba: es otro corte de lo mismo, no se suma. El real es el de Finanzas, del mismo Excel, hasta el mes que ellos cerraron: la sucursal que anota Cars no coincide con esta definición de canal (CDE en Cars: 79 unidades en {anio}; Finanzas: {real} hasta {mes}).":
    "<b>CDE and Wholesale have their own target in the Finanzas Excel file</b> (the Ciudad del Este branch and wholesale sales). Their units are already included in the brands above: it is another cut of the same thing and is not added up. The actual figures are Finanzas' own, from the same Excel file, through the month they closed: the branch Cars records does not match this channel definition (CDE in Cars: 79 units in {anio}; Finanzas: {real} through {mes}).",
  "Canales que Finanzas presupuesta aparte — {anio}": "Channels that Finanzas budgets separately — {anio}",
  "Canal": "Channel",
  "Objetivo": "Target",
  "hasta el mes cerrado": "through the closed month",
  "Real": "Actual",
  "según Finanzas": "per Finanzas",
  "real ÷ objetivo": "actual ÷ target",
  "Objetivo anual": "Annual target",
  "todo el año": "full year",
  "del objetivo anual": "of the annual target",
  "CDE (Ciudad del Este)": "CDE (Ciudad del Este)",
  "Wholesale (mayoristas)": "Wholesale",
  "real hasta {mes}": "actual through {mes}",
  "{canal} — objetivo vs. real, mes a mes": "{canal} — target vs. actual, month by month",
  "Real de Finanzas hasta {mes}; de ahí en adelante solo hay objetivo.": "Actuals from Finanzas through {mes}; from there on there is only a target.",
  "Real (Finanzas)": "Actual (Finanzas)",
  "<b>Acá no hay facturación en guaraníes ni dólares, a propósito.</b> Cars devuelve importes, pero no cierran: en 2026 hay 2.936 facturas marcadas «DOLARES» con montos de 54 millones a 4,8 billones —o sea guaraníes, con basura adentro— y 54 marcadas «GUARANIES» que arrancan en 29.990. Publicar facturación con esa base sería inventar una cifra. Las unidades sí cierran, y son lo que se muestra. El precio de lista de las unidades es harina de otro costal: ese sí está en dólares y es creíble.":
    "<b>There is no invoicing in guaraníes or dollars here, on purpose.</b> Cars returns amounts, but they do not add up: in 2026 there are 2,936 invoices flagged “DOLARES” with amounts from 54 million to 4.8 trillion —that is, guaraníes, with junk mixed in— and 54 flagged “GUARANIES” starting at 29,990. Publishing invoicing on that basis would be making up a figure. Units do add up, and they are what is shown. The list price of the units is a different story: that one is in dollars and is credible.",
  "Última sincronización: {facturas} facturas y {unidades} unidades leídas de Cars, agregadas antes de salir de la máquina — el Advisor nunca recibe nombres, correos, teléfonos ni VIN de clientes.":
    "Last sync: {facturas} invoices and {unidades} units read from Cars, aggregated before leaving the machine — the Advisor never receives customer names, emails, phone numbers or VINs.",
  "<b>Una unidad es un vehículo, no una factura:</b> de esas {facturas} facturas, {vehiculos} son vehículos distintos (1 VIN = 1 unidad, contado en su primera factura; {repetidas} facturas repetían un VIN ya contado — seña, saldo o accesorios en documentos aparte). Las {usados} facturas de LOCAL USADOS quedan fuera: son usados de marcas propias, no 0km.":
    "<b>A unit is a vehicle, not an invoice:</b> of those {facturas} invoices, {vehiculos} are distinct vehicles (1 VIN = 1 unit, counted on its first invoice; {repetidas} invoices repeated a VIN that had already been counted — deposit, balance or accessories on separate documents). The {usados} invoices for LOCAL USADOS are left out: they are used cars of own brands, not 0 km.",

  // --- app/operacion/page.tsx — pestaña Stock y pedido
  "<b>El ritmo son los tres últimos meses cerrados ({meses})</b>: el mes en curso no entra porque está a medias. De <b>libres</b> quedan afuera las reservadas, lo que está en viaje y lo que anda en test drive o cortesía. Con menos de {n} autos por mes no se calculan los meses de stock: el número no significaría nada.":
    "<b>Pace is the last three closed months ({meses})</b>: the current month is not included because it is only partly done. <b>Free</b> units exclude reserved ones, those in transit, and those out on test drives or as courtesy cars. With fewer than {n} cars per month, months of stock are not calculated: the number would mean nothing.",
  "Qué pedir": "What to order",
  "Se venden y les queda menos de un mes y medio libre, aun con lo que viene en viaje. Primero las que más venden.":
    "They sell and have less than 1.5 months of free stock left, even counting what is in transit. Best sellers first.",
  "Nada urgente: ninguna versión con ritmo tiene menos de un mes y medio de stock.":
    "Nothing urgent: no version with a sales pace has less than 1.5 months of stock.",
  "Ritmo": "Pace",
  "por mes": "per month",
  "Libres": "Free",
  "sin llegar": "not yet arrived",
  "libres ÷ ritmo": "free ÷ pace",
  "Qué empujar": "What to push",
  "Más de seis meses de stock, o cinco o más libres que casi no se mueven. Primero las que más plata tienen parada. Promoción, no pedido.":
    "More than six months of stock, or five or more free units that barely move. Those with the most cash tied up come first. A promotion, not an order.",
  "Nada parado: ninguna versión pasa los seis meses de stock.": "Nothing stalled: no version exceeds six months of stock.",
  "sin ritmo": "no pace",
  "Todo el stock": "All the stock",
  "<b>Estados de Cars que la regla de stock no conoce: {estados}.</b> Cuentan como en piso hasta que alguien los clasifique en <code>cobertura.ts</code> (en piso, en viaje o no vendible).":
    "<b>Cars statuses the stock rule does not know: {estados}.</b> They count as on the floor until someone classifies them in <code>cobertura.ts</code> (on the floor, in transit or not sellable).",
  "Stock por modelo — hoy": "Stock by model — today",
  "Una fila por modelo, del que más unidades tiene al que menos; la flecha abre sus versiones, que es donde se decide qué pedir.":
    "One row per model, from the one with the most units to the one with the fewest; the arrow opens its versions, which is where you decide what to order.",

  // --- app/operacion/page.tsx — pestaña Demanda
  "Todavía no hay demanda de Bitrix": "No Bitrix demand yet",
  "La empuja Hermes (advisor-demanda-bitrix.py) una vez por semana. Si ya pasaron unos días, revisá ese trabajo.":
    "Hermes pushes it (advisor-demanda-bitrix.py) once a week. If a few days have passed, check that job.",
  "<b>Esto es demanda registrada en el CRM, no mercado.</b> Sale de Bitrix por mes de creación y se resume antes de salir de la máquina donde se lee: ningún dato del cliente llega acá. «Abierto», «convertido» y «perdido» son la semántica de cada estado de Bitrix; el motivo es el nombre del estado o de la etapa de pérdida. Los descartados (spam, datos falsos, duplicados, incontactables) no cuentan como demanda perdida: nunca fueron un comprador. La marca es la «marca de interés» del lead, salvo que el título o la campaña nombren otra marca de forma explícita («SOUEAST S09» cargado como Jetour); el modelo se acepta solo si es de esa marca en el catálogo de Bitrix. Bitrix reclasifica hacia atrás, así que estas cifras cambian en cada actualización{ultima}.":
    "<b>This is demand recorded in the CRM, not market.</b> It comes from Bitrix by creation month and is summarized before leaving the machine where it is read: no customer data reaches this screen. “Open”, “converted” and “lost” are the semantics of each Bitrix status; the reason is the name of the status or of the loss stage. Discarded leads (spam, fake data, duplicates, unreachable) do not count as lost demand: they were never a buyer. The brand is the lead's “brand of interest”, unless the title or the campaign explicitly names another brand (“SOUEAST S09” loaded as Jetour); the model is accepted only if it belongs to that brand in the Bitrix catalog. Bitrix reclassifies backwards, so these figures change with every update{ultima}.",
  "(última: {fecha})": "(latest: {fecha})",
  "Por marca": "By brand",
  "Leads y negocios — {periodo}": "Leads and deals — {periodo}",
  "Lo facturado acá es <b>solo retail</b>: las {n} unidades mayoristas (flotas y gerencia) no las trajo ningún lead.":
    "What is invoiced here is <b>retail only</b>: the {n} wholesale units (fleets and management) were not brought in by any lead.",
  "Leads": "Leads",
  "consultas que entraron": "inquiries received",
  "Abiertos": "Open",
  "sin cerrar ni perder": "neither closed nor lost",
  "Convertidos": "Converted",
  "pasaron a negociación": "moved to negotiation",
  "Perdidos": "Lost",
  "se dieron de baja": "dropped out",
  "Negocios": "Deals",
  "ya calificados": "already qualified",
  "Facturado retail": "Retail invoiced",
  "sin flotas ni gerencia": "excl. fleets and management",
  "Leads por venta": "Leads per sale",
  "si sube, se desaprovecha": "if it rises, demand is being wasted",
  "Total": "Total",
  "{n} descartados": "{n} discarded",
  "{g} ganados · {p} perdidos": "{g} won · {p} lost",
  "Por qué se pierde": "Why deals are lost",
  "Motivo de baja de los leads y negocios perdidos del período, sin los descartados. Pasá el mouse por «Perdidos» para verlo por marca.":
    "Reason for dropping the leads and deals lost in the period, excluding discarded ones. Hover over “Lost” to see it by brand.",
  "Sin pérdidas con motivo en el período.": "No losses with a reason in the period.",
  "Por modelo": "By model",
  "Demanda que nombra el modelo — {periodo}": "Demand that names the model — {periodo}",
  "Bitrix no tiene campo de modelo en los leads: se lee del título o de la campaña cuando lo dicen ({leads} de los leads) y del producto de los negocios ({negocios}). Se cruza con lo facturado retail y con el stock libre de hoy.":
    "Bitrix has no model field on leads: it is read from the title or campaign when they state it ({leads} of leads) and from the product of the deals ({negocios}). It is matched against retail invoicing and today's free stock.",
  "Ningún lead ni negocio del período nombra el modelo.": "No lead or deal in the period names the model.",
  "leads y negocios": "leads and deals",
  "y el motivo principal": "and the main reason",
  "Libres hoy": "Free today",
  "entregables hoy": "deliverable today",
  "Qué hacer": "What to do",
  "la lectura de la fila": "the reading of the row",
  "{n} negocio": "{n} deal",
  "{n} negocios": "{n} deals",

  // --- app/operacion/page.tsx — pestaña Equipo
  "Asesores": "Sales advisors",
  "Todavía no hay ranking de asesores": "No sales advisor ranking yet",
  "Hace falta que Hermes corra el push de Cars para que este período tenga datos. Si ya pasaron unas horas, revisá el trabajo advisor-datos-propios.":
    "Hermes needs to run the Cars push for this period to have data. If a few hours have passed, check the advisor-datos-propios job.",
  "Ranking retail — {periodo}": "Retail ranking — {periodo}",
  "Los {n} de {total} asesores retail con más vehículos facturados de {marca}. Flotas y gerencia van aparte.":
    "The top {n} of {total} retail sales advisors by vehicles invoiced for {marca}. Fleets and management are shown separately.",
  "Los {n} de {total} asesores retail con más vehículos facturados. Flotas y gerencia van aparte.":
    "The top {n} of {total} retail sales advisors by vehicles invoiced. Fleets and management are shown separately.",
  "Asesor": "Sales advisor",
  "Marcas": "Brands",
  "de la que más vende a la que menos": "from the one they sell most to the one they sell least",
  "Vehículos": "Vehicles",
  "facturados en el período": "invoiced in the period",
  "% del total": "% of total",
  "de todo lo retail": "of all retail",
  "los que Bitrix le asignó": "assigned to them by Bitrix",
  "Sin contactar": "Not contacted",
  "nadie los tocó": "nobody has touched them",
  "Lead → venta": "Lead → sale",
  "de sus leads, cuántos cerraron": "of their leads, how many closed",
  "No es una persona: bucket interno de Cars.": "Not a person: internal Cars bucket.",
  "Factura {n} marcas, de la que más vende a la que menos.": "Invoices {n} brands, from the one sold most to the one sold least.",
  "Bitrix le asigna pocos leads a este asesor (los recibe quien califica): la conversión no se puede calcular con sentido.":
    "Bitrix assigns few leads to this sales advisor (whoever qualifies them receives them): the conversion cannot be meaningfully calculated.",
  "El mejor de cada marca — {periodo}": "Best of each brand — {periodo}",
  "Quién vendió más de cada marca, y entre cuántos asesores se reparte.":
    "Who sold the most of each brand, and among how many sales advisors it is spread.",
  "el que más vendió de esa marca": "the one who sold the most of that brand",
  "de esa marca": "of that brand",
  "de {n} asesor que la venden": "of {n} sales advisor selling it",
  "de {n} asesores que la venden": "of {n} sales advisors selling it",
  "de {n}": "of {n}",
  "Ventas mayoristas — {periodo}": "Wholesale sales — {periodo}",
  "Flotas y ventas de gerencia: otro negocio, fuera del ranking. La lista de quiénes son mayoristas la mantiene Sistemas.":
    "Fleets and management sales: a different business, outside the ranking. The list of who counts as wholesale is maintained by IT.",
  "Vendedor mayorista": "Wholesale salesperson",
  "flotas y gerencia": "fleets and management",
  "de todo lo facturado": "of everything invoiced",
  "<b>Esto es desempeño individual, no un dato de mercado.</b> Sale de <code>Vendedor</code> en las facturas de Cars, ya sumado por vendedor antes de salir de la máquina — nunca viaja factura por factura. Una unidad es un vehículo (un VIN), contado en su primera factura. De los {total} vehículos del período: <b>{retail} retail</b> (el ranking), <b>{mayoristas} mayoristas</b>{sinVendedor}. Si algún nombre en cursiva no es una persona (una razón social, por ejemplo), Cars lo cargó en el mismo campo que a un asesor.":
    "<b>This is individual performance, not market data.</b> It comes from <code>Vendedor</code> on the Cars invoices, already summed by salesperson before leaving the machine — it never travels invoice by invoice. A unit is a vehicle (one VIN), counted on its first invoice. Of the {total} vehicles in the period: <b>{retail} retail</b> (the ranking), <b>{mayoristas} wholesale</b>{sinVendedor}. If a name in italics is not a person (a company name, for example), Cars loaded it in the same field as a sales advisor.",
  "y {n} sin vendedor cargado en Cars": "and {n} with no salesperson loaded in Cars",
  "<b>Sobre los leads:</b> son los de Bitrix, por responsable y mes. El CRM le asigna la mayoría a quienes califican (el equipo que llama primero), no a quien cierra, así que muchos vendedores aparecen con pocos leads o ninguno. «Lead → venta» solo se calcula cuando el asesor tiene al menos 20 leads asignados y no vende más de lo que le asignan; si no, sería un porcentaje sin sentido, y se muestra «—».":
    "<b>About leads:</b> these are Bitrix leads, by owner and month. The CRM assigns most of them to whoever qualifies them (the team that calls first), not to whoever closes, so many salespeople show few leads or none. “Lead → sale” is only calculated when the sales advisor has at least 20 leads assigned and does not sell more than they are assigned; otherwise it would be a meaningless percentage, and “—” is shown.",
  "Sucursales": "Branches",
  "Ventas por sucursal — {periodo}": "Sales by branch — {periodo}",
  "Vehículos facturados desde cada local (la sucursal que Cars registra en la factura) y quién más vendió ahí.":
    "Vehicles invoiced from each location (the branch Cars records on the invoice) and who sold the most there.",
  "Sucursal": "Branch",
  "facturados desde ese local": "invoiced from that location",
  "facturaron algo ahí": "invoiced something there",
  "Mejor asesor": "Top sales advisor",
  "el que más vendió en el local": "the one who sold the most at that location",
  "Sin sucursal": "No branch",
};

export default EN;
