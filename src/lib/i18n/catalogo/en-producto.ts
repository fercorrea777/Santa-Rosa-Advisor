/** Frases en inglés: producto (Bubble chart, Dónde competir, Portafolio por marca, la ficha del modelo, los mapas y las
 *  clases de vehículo). Clave = el texto en castellano tal cual está en el código. */
const EN: Record<string, string> = {
  "% de la clase":
    "% of class",
  "% del casillero":
    "% of cell",
  "% vs. año anterior":
    "% vs. prior year",
  "(antes {n})":
    "(was {n})",
  "(clase por precio)":
    "(class by price)",
  "(propias que entran igual: {marcas})":
    "(own brands included anyway: {marcas})",
  "({n}) · cuidar stock y precio":
    "({n}) · protect stock and price",
  "({n}) · el mercado compra y no estamos":
    "({n}) · the market buys and we are absent",
  ", así que lo que falta es presencia o producto":
    ", so what is missing is presence or product",
  ", desde contra desde":
    ", starting price vs. starting price",
  ", que en su celda de modelo dice «{celda}»":
    ", which in its model cell reads “{celda}”",
  ", relevado el {fecha}":
    ", surveyed on {fecha}",
  ", y las {n} versiones de canje y usados (marcas que no distribuimos, una unidad cada una) también: están en /operacion":
    ", and the {n} trade-in and used versions (brands we do not distribute, one unit each) as well: they are in /operacion",
  "0 % → 30 % o más":
    "0% → 30% or more",
  "<b>Acá hay que entrar.</b> Es uno de los casilleros grandes del mercado ({peso} de todo lo que se vendió en el mapa) y nosotros tenemos {share}.":
    "<b>We need to enter here.</b> This is one of the market's big cells ({peso} of everything sold on the map) and we hold {share}.",
  "<b>Acá mandamos y hay que defenderlo.</b> De este casillero sale el {pesoPropio} de todo lo que vendemos en el mapa, y tenemos {share} de él. Lo que se cuida es el stock —quedarse sin unidades acá es regalar participación— y el precio.":
    "<b>We lead here and must defend it.</b> {pesoPropio} of everything we sell on the map comes from this cell, and we hold {share} of it. What needs protecting is stock —running out of units here means giving away share— and price.",
  "<b>Cars no respondió:</b> nuestros modelos quedan sin precio en esta corrida.":
    "<b>Cars did not respond:</b> our models have no price in this run.",
  "<b>Casillero para mirar, no para actuar todavía.</b> Pesa {peso} del mercado del mapa, de acá sale el {pesoPropio} de lo que vendemos y tenemos {share} de él: ni es lo bastante grande como para justificar entrar, ni concentra tanto de nuestro volumen como para llamarlo fortaleza. La comparativa está abajo igual.":
    "<b>A cell to watch, not to act on yet.</b> It accounts for {peso} of the market on the map, {pesoPropio} of what we sell comes from here and we hold {share} of it: it is neither big enough to justify entering nor does it concentrate enough of our volume to call it a stronghold. The comparison is below anyway.",
  "<b>Cómo leer los mapas.</b> Cada casillero es una clase en una banda de precio (primer mapa) o en una motorización (segundo). El número grande es cuánto vendió el mercado ahí; debajo, cuánto de eso es nuestro y qué porcentaje representa. Un casillero grande donde nuestra parte es chica es donde falta producto o precio.":
    "<b>How to read the maps.</b> Each cell is a class within a price band (first map) or a powertrain (second). The big number is how much the market sold there; below it, how much of that is ours and what percentage it represents. A large cell where our part is small is where product or price is missing.",
  "<b>Defender</b>: pesa y mandamos nosotros":
    "<b>Defend</b>: it carries weight and we lead",
  "<b>El mapa por motorización solo existe en matriculación.</b> La base de importación de CADAM no dice si el vehículo es híbrido o eléctrico; con «Matriculaciones» vuelve a aparecer.":
    "<b>The powertrain map only exists for registrations.</b> CADAM's import database does not say whether a vehicle is hybrid or electric; switch to “Registrations” and it comes back.",
  "<b>Entrar</b>: el mercado compra ahí y casi no estamos":
    "<b>Enter</b>: the market buys there and we are almost absent",
  "<b>Precio y volumen no salen de la misma fuente:</b> las unidades y la motorización son de CADAM; los precios nuestros, del stock de Cars; los de la competencia, de un catálogo de terceros (Datacar, {n} marcas) — no es lista oficial. Lo que no tiene precio va a la última columna, no se adivina.":
    "<b>Price and volume do not come from the same source:</b> units and powertrain are from CADAM; our prices are from the Cars stock; the competition's are from a third-party catalog (Datacar, {n} brands) — it is not an official list. Whatever has no price goes to the last column; we do not guess.",
  "<b>Qué es una clase.</b> CADAM solo distingue SUV, pick-up, automóvil, camión, furgón y minibús, y eso mete en la misma bolsa a una X50 de US$ 15.000 y a una Fortuner de US$ 52.000. La clase es el tamaño y el uso con el que el comprador compara de verdad: SUV chico, compacto, mediano, grande; pick-up compacta, mediana, grande; auto chico, mediano; camión liviano, mediano, pesado. No está en ninguna fuente: es un catálogo propio sobre los nombres reales del mercado ({pct} de las unidades del período).":
    "<b>What a class is.</b> CADAM only distinguishes SUV, pickup, passenger car, truck, van and minibus, which lumps a US$ 15,000 X50 together with a US$ 52,000 Fortuner. The class is the size and use by which buyers actually compare: small, compact, midsize and large SUV; compact, midsize and full-size pickup; small and midsize car; light, medium and heavy truck. It is not in any source: it is our own catalog built on the real market names ({pct} of the period's units).",
  "<b>{n} u.</b> facturadas":
    "<b>{n} units</b> invoiced",
  "<b>{n} unidades de {fuente}</b> de {marca} ({periodo}) no cruzan con ningún modelo de la tabla por nombre y no se atribuyen a ninguna fila: {modelos}. {nota}":
    "<b>{n} units of {fuente}</b> for {marca} ({periodo}) do not match any model in the table by name and are not attributed to any row: {modelos}. {nota}",
  "a US$ {precio}":
    "at US$ {precio}",
  "AT desde {precio}":
    "AT from {precio}",
  "Auto chico":
    "Small car",
  "Auto mediano":
    "Midsize car",
  "Auto premium":
    "Premium car",
  "Automovil":
    "Passenger car",
  "Batalla por modelo":
    "Model battle",
  "Bubble chart por clase y versión":
    "Bubble chart by class and version",
  "Burbujas":
    "Bubbles",
  "Cada barra va de la versión más barata a la más cara del modelo, en US$ de lista. Cuanto más pleno el color, más unidades. Los huecos entre barras son huecos de la gama; las barras que se pisan, modelos que compiten entre sí.":
    "Each bar runs from the model's cheapest version to its most expensive, in list US$. The fuller the color, the more units. Gaps between bars are gaps in the range; overlapping bars are models competing with each other.",
  "Cada burbuja es un modelo, agrupado en la columna de su marca · {fuentes} vs. mismo período {anio}.":
    "Each bubble is a model, grouped in its brand's column · {fuentes} vs. same period {anio}.",
  "Cada modelo nuestro contra sus rivales, como lo arma el equipo de producto.":
    "Each of our models against its rivals, as the product team puts it together.",
  "CADAM no publica precios. Los de nuestras marcas salen del stock de Cars y los de la competencia del catálogo de Datacar; un modelo sin precio en ninguna de las dos queda con el precio vacío, nunca inventado. El rango toma las versiones que llevan el nombre del modelo, así que «desde» puede no coincidir con la versión más vendida. Para ver contra quién compite cada modelo, tocá su fila; para la vista de precio contra volumen de toda la clase, está el <a>Bubble chart</a>.":
    "CADAM does not publish prices. Our brands' prices come from the Cars stock and the competition's from the Datacar catalog; a model with no price in either is left with an empty price, never invented. The range takes the versions that carry the model's name, so “from” may not match the best-selling version. To see who each model competes against, tap its row; for the price-versus-volume view of the whole class, there is the <a>Bubble chart</a>.",
  "Camion":
    "Truck",
  "Camión liviano":
    "Light truck",
  "Camión mediano":
    "Medium truck",
  "Camión pesado":
    "Heavy truck",
  "Caros o baratos":
    "Expensive or cheap",
  "catálogo Datacar":
    "Datacar catalog",
  "Cerrar":
    "Close",
  "Cerrar las {n} versiones de {modelo}":
    "Collapse the {n} versions of {modelo}",
  "Chapas puestas de {marca} en {periodo}, contra el mismo período de {anio}.":
    "{marca} vehicles registered in {periodo}, against the same period of {anio}.",
  "Clase":
    "Class",
  "Clase inferida por precio o segmento, no del catálogo":
    "Class inferred from price or segment, not from the catalog",
  "clase por precio":
    "class by price",
  "Clases en este gráfico":
    "Classes in this chart",
  "Cobertura de precio: <b>{pct}</b> de las unidades ({propias} de las nuestras, {rivales} de la competencia).":
    "Price coverage: <b>{pct}</b> of units ({propias} of ours, {rivales} of the competition).",
  "Compite en {clase}.":
    "Competes in the {clase} class.",
  "compradas, sin llegar":
    "purchased, not yet arrived",
  "con automático":
    "with automatic",
  "con la misma caja que se compara":
    "with the same transmission being compared",
  "con mecánico":
    "with manual",
  "con precio / según DNRA":
    "priced / per DNRA",
  "contra el año pasado":
    "vs. last year",
  "Contra el mismo período del año pasado cayó {pct} (de {antes} a {ahora}).":
    "Against the same period last year it fell {pct} (from {antes} to {ahora}).",
  "Contra el mismo período del año pasado creció {pct} (de {antes} a {ahora}).":
    "Against the same period last year it grew {pct} (from {antes} to {ahora}).",
  "contra el tipo":
    "vs. the type",
  "Contra quién compite":
    "Who it competes against",
  "contra quién compite":
    "who it competes against",
  "Contra quién compite cada modelo nuestro":
    "Who each of our models competes against",
  "Contra quién compite cada modelo nuestro en el salón.":
    "Who each of our models competes against on the showroom floor.",
  "contra su clase":
    "vs. its class",
  "Crecimiento":
    "Growth",
  "Crecimiento por modelo — {fuente} · {periodo}":
    "Growth by model — {fuente} · {periodo}",
  "Cuánto del casillero es nuestro:":
    "How much of the cell is ours:",
  "de esta versión (automático)":
    "of this version (automatic)",
  "de esta versión (desde)":
    "of this version (starting price)",
  "de esta versión (mecánico)":
    "of this version (manual)",
  "De la versión más barata a la más cara de toda la gama, según las listas cargadas (Cars para las propias, Datacar para el resto).":
    "From the cheapest to the most expensive version in the whole range, according to the loaded lists (Cars for our own, Datacar for the rest).",
  "de {mercado} u. {fuente} · {periodo}":
    "of {mercado} {fuente} · {periodo}",
  "defender":
    "defend",
  "Deja solo las marcas del grupo; después tocá las del mercado con las que querés comparar.":
    "Keeps only the group's brands; then tap the market brands you want to compare against.",
  "Deja, vende poco":
    "Earns, sells little",
  "Desde":
    "From",
  "desde":
    "from",
  "Desde US$":
    "From US$",
  "desde, sin transmisión en el nombre":
    "from price, no transmission in the name",
  "Diferencia":
    "Difference",
  "Dónde entrar":
    "Where to enter",
  "Dónde está la plata del mercado y en qué casilleros estamos o no.":
    "Where the market's money is and in which cells we are present or not.",
  "Dónde está la plata del mercado: cuántas unidades se venden en cada cruce de clase y precio, y en cuáles de esos casilleros estamos o no estamos.":
    "Where the market's money is: how many units are sold at each class-and-price intersection, and in which of those cells we are present or absent.",
  "Dónde mandamos":
    "Where we lead",
  "Eje X":
    "X axis",
  "Eje Y = variación contra {anio} · tamaño = unidades del período · las marcas propias van primero, con borde y su nombre resaltado en el eje. Arriba de la línea del 0% crecen, abajo caen; el tamaño dice cuánto pesa ese crecimiento. <b>Tocá una burbuja</b> y se abre la ficha del modelo: su clase, contra quién compite, a qué precio y cómo viene contra el año pasado.":
    "Y axis = change vs. {anio} · size = units for the period · own brands come first, with a border and their name highlighted on the axis. Above the 0% line they grow, below it they fall; size shows how much that growth weighs. <b>Tap a bubble</b> and the model profile opens: its class, who it competes against, at what price and how it is doing against last year.",
  "El bubble chart del <b>equipo de producto</b>, tal cual está en sus planillas ({n} archivos, una por marca; cargados el {fecha}): por cada modelo nuestro, las versiones rivales que ellos eligieron, con precio de lista, medidas y volumen. Cada hoja tiene su propio período, que se muestra arriba del gráfico: no todas están al mismo mes. Nada se cruza con CADAM ni con Datacar acá: se dibuja lo que dice el Excel, y cuando el Excel cambia, se vuelve a cargar solo.":
    "The <b>product team's</b> bubble chart, exactly as it appears in their spreadsheets ({n} files, one per brand; loaded on {fecha}): for each of our models, the rival versions they chose, with list price, measurements and volume. Each sheet has its own period, shown above the chart: not all of them are at the same month. Nothing is cross-referenced with CADAM or Datacar here: what the Excel says is what gets drawn, and when the Excel changes, it is reloaded automatically.",
  "El casillero se paga alrededor de <num>US$ {precio}</num>. Para entrar hace falta producto en ese precio, o bajar el nuestro hasta ahí.":
    "Buyers in this cell pay around <num>US$ {precio}</num>. To enter we need a product at that price, or to bring ours down to it.",
  "El comprador de este casillero paga alrededor de <b>US$ {precioRival}</b>: entrar significa traer un modelo a ese precio, o acercar el nuestro. Un modelo bueno al precio equivocado no compite acá.":
    "Buyers in this cell pay around <b>US$ {precioRival}</b>: entering means bringing a model at that price, or moving ours closer to it. A good model at the wrong price does not compete here.",
  "El cuadro que arma producto: cada modelo contra sus rivales de verdad, por precio y por volumen, con las medidas de cada versión.":
    "The chart the product team builds: each model against its real rivals, by price and volume, with each version's measurements.",
  "el de la planilla de producto":
    "the one in the product spreadsheet",
  "El eje corta en +{techo}%: <b>{n}</b> modelo se sale y queda dibujado como triángulo en el tope — {lista}. El valor real está en el tooltip de cada uno.":
    "The axis stops at +{techo}%: <b>{n}</b> model falls outside it and is drawn as a triangle at the top — {lista}. The real value is in each one's tooltip.",
  "El eje corta en +{techo}%: <b>{n}</b> modelos se salen y quedan dibujados como triángulo en el tope — {lista}. El valor real está en el tooltip de cada uno.":
    "The axis stops at +{techo}%: <b>{n}</b> models fall outside it and are drawn as triangles at the top — {lista}. The real value is in each one's tooltip.",
  "El eje vertical es la <b>variación %</b>, no el precio: la base de CADAM trae unidades, no importes. Como el porcentaje se dispara sobre bases chicas, sólo entran los modelos con al menos <b>{base} unidades</b> en {anio}, y sólo las <b>{tope} marcas de mayor volumen</b> más las propias, que entran siempre.":
    "The vertical axis is the <b>% change</b>, not the price: the CADAM database has units, not amounts. Since the percentage blows up on small bases, only models with at least <b>{base} units</b> in {anio} are included, and only the <b>{tope} highest-volume brands</b> plus our own, which are always included.",
  "El filtro de motorización no recorta este mapa: es la dimensión de sus columnas.":
    "The powertrain filter does not trim this map: it is the dimension of its columns.",
  "El mercado por clase de vehículo, banda de precio y motorización, cuánto de cada casillero es nuestro y contra quién compite cada modelo · {fuente} {periodo}{recorte}.":
    "The market by vehicle class, price band and powertrain, how much of each cell is ours and who each model competes against · {fuente} {periodo}{recorte}.",
  "El mercado por clase de vehículo, banda de precio, cuánto de cada casillero es nuestro y contra quién compite cada modelo · {fuente} {periodo}{recorte}.":
    "The market by vehicle class and price band, how much of each cell is ours and who each model competes against · {fuente} {periodo}{recorte}.",
  "El mismo cruce de precio y volumen, pero versión por versión: es el nivel al que el cliente elige.":
    "The same price-and-volume view, but version by version: that is the level at which the customer chooses.",
  "el más barato de la gama":
    "the cheapest in the range",
  "El precio sale del <b>API de Cars</b>, que solo conoce nuestra gama: por eso acá están nuestras marcas y no el mercado entero. CADAM no trae importes, así que no hay precio de competencia a nivel versión en ninguna fuente que tengamos — lo público de la competencia sale del relevamiento de precios, que cubre pocos modelos. El <b>segmento</b> tampoco está en Cars: se cruza contra el nombre de la versión en CADAM, y lo que no cruza va a «Sin clasificar» en vez de adivinarse{sinClasificar}. {n} versiones con precio, {unidades} unidades facturadas en el período; las versiones sin precio en Cars quedan fuera del gráfico porque no tendrían dónde ubicarse en el eje{canje}.":
    "The price comes from the <b>Cars API</b>, which only knows our range: that is why our brands are shown here and not the entire market. CADAM has no amounts, so there is no competitor price at version level in any source we have — what is public for the competition comes from the price survey, which covers few models. The <b>segment</b> is not in Cars either: it is matched against the version name in CADAM, and whatever does not match goes to “Unclassified” rather than being guessed{sinClasificar}. {n} versions with a price, {unidades} units invoiced in the period; versions with no price in Cars are left out of the chart because they would have nowhere to sit on the axis{canje}.",
  "El que más vende en esa clase es <b>{marca} {modelo}</b> con {n} unidades{precio}.":
    "The best seller in that class is <b>{marca} {modelo}</b> with {n} units{precio}.",
  "El que más vende en su clase es <b>{marca} {modelo}</b> con {n} unidades{precio}.":
    "The best seller in its class is <b>{marca} {modelo}</b> with {n} units{precio}.",
  "el único rival con precio":
    "the only rival with a price",
  "el único rival con precio automático":
    "the only rival with an automatic price",
  "El único rival con precio cargado está en <b>US$ {precioRival}</b>: alcanza como referencia, no como el precio del casillero.":
    "The only rival with a loaded price is at <b>US$ {precioRival}</b>: enough as a reference, not as the price of the cell.",
  "el único rival con precio desde":
    "the only rival with a starting price",
  "el único rival con precio mecánico":
    "the only rival with a manual price",
  "Empujar {n}":
    "Push {n}",
  "En automático, está":
    "In automatic, it is",
  "En desde, está":
    "On starting prices, it is",
  "en gris, las marcas fuera de las {n} de mayor volumen":
    "in gray, the brands outside the top {n} by volume",
  "En mecánico, está":
    "In manual, it is",
  "En {fuente} ({periodo}) se grafican <b>{n}</b> de {total} modelos, el <b>{pct}</b> del volumen; fuera quedan {entrantes} modelos nuevos (sin año anterior contra qué comparar), {bajoBase} por debajo de la base mínima y {fueraDelTope} de marcas que no llegan al tope{propias}.":
    "For {fuente} ({periodo}), <b>{n}</b> of {total} models are plotted, covering <b>{pct}</b> of volume; left out are {entrantes} new models (no prior year to compare against), {bajoBase} below the minimum base and {fueraDelTope} from brands that fall below the cutoff{propias}.",
  "entrar":
    "enter",
  "entraron al país":
    "entered the country",
  "entregables hoy · con seña":
    "deliverable today · with deposit",
  "entró al país":
    "brought into the country",
  "Es el gráfico del equipo de producto, tal cual está en su planilla{archivo} (hoja «{hoja}»{celda}).":
    "This is the product team's chart, exactly as it appears in its spreadsheet{archivo} (sheet “{hoja}”{celda}).",
  "Escalera de precios":
    "Price ladder",
  "Esta versión está":
    "This version is",
  "Estamos <b>US$ {brecha} por debajo</b> de la mediana del casillero y aun así lideramos: hay espacio de precio, sobre todo si el stock escasea.":
    "We are <b>US$ {brecha} below</b> the cell median and still lead: there is pricing room, especially if stock is tight.",
  "Estamos <b>US$ {brecha} por encima</b> de la mediana y lideramos igual: el precio no es la barrera, no hace falta resignarlo.":
    "We are <b>US$ {brecha} above</b> the median and lead anyway: price is not the barrier, no need to give it up.",
  "Estamos <num>US$ {brecha}</num> por debajo de la mediana del casillero y aun así mandamos: hay espacio de precio, sobre todo si el stock escasea.":
    "We are <num>US$ {brecha}</num> below the cell median and still lead: there is pricing room, especially if stock is tight.",
  "Estamos <num>US$ {brecha}</num> por encima de la mediana y mandamos igual: acá el precio no es la barrera, cuidar el stock.":
    "We are <num>US$ {brecha}</num> above the median and still lead: here price is not the barrier; protect the stock.",
  "Estamos al precio del casillero: lo que decide es el stock y el seguimiento.":
    "We are at the cell's price: what decides is stock and follow-up.",
  "Estamos caros o baratos, modelo por modelo":
    "Are we expensive or cheap, model by model",
  "Está":
    "It is",
  "Facturación US$ {facturacion} · margen total US$ {margen}":
    "Invoicing US$ {facturacion} · total margin US$ {margen}",
  "Facturó esta versión":
    "Invoiced this version",
  "familia {familia}":
    "family {familia}",
  "Fuente: CADAM (unidades y motorización) · Cars (nuestros precios) · Datacar (precios de la competencia, catálogo de terceros{relevado}) · clases de vehículo: catálogo propio.":
    "Source: CADAM (units and powertrain) · Cars (our prices) · Datacar (competitor prices, third-party catalog{relevado}) · vehicle classes: in-house catalog.",
  "Furgon":
    "Van",
  "Furgón chico":
    "Small van",
  "Furgón grande":
    "Large van",
  "Hasta US$":
    "To US$",
  "Hay un solo rival con precio cargado en el casillero: no alcanza para decir si estamos caros o baratos.":
    "There is only one rival with a loaded price in the cell: not enough to say whether we are expensive or cheap.",
  "Importaciones de la marca sobre todas las del período.":
    "The brand's imports over all imports in the period.",
  "Importados":
    "Imported",
  "importados en el período":
    "imported in the period",
  "Importó":
    "Imported",
  "La clase (SUV chico, compacto, mediano, grande; pick-up compacta, mediana…) es un catálogo propio sobre los nombres del mercado: CADAM solo distingue SUV, pick-up, automóvil, camión, furgón y minibús, y eso pone a una X50 al lado de una Fortuner.":
    "The class (small, compact, midsize, large SUV; compact, midsize pickup…) is an in-house catalog built on market names: CADAM only distinguishes SUV, pickup, passenger car, truck, van and minibus, and that puts an X50 next to a Fortuner.",
  "La gama de una marca, modelo por modelo: cuánto vende cada uno, cuánto entró al país y a qué precio de lista · {ventanas}.":
    "A brand's range, model by model: how much each one sells, how much entered the country and at what list price · {ventanas}.",
  "La motorización la informa CADAM en cada matriculación: ICE es combustión; MHEV, HEV y PHEV son híbridos (el PHEV se enchufa); REEV es eléctrico con motor de apoyo; EV, eléctrico puro. Mismo dibujo que el mapa de precios.":
    "CADAM reports the powertrain in each registration: ICE is combustion; MHEV, HEV and PHEV are hybrids (the PHEV plugs in); REEV is electric with a range-extender engine; EV is pure electric. Same layout as the price map.",
  "la más barata, automática":
    "cheapest, automatic",
  "la más barata, mecánica":
    "cheapest, manual",
  "la más cara del modelo":
    "the model's most expensive",
  "la versión más barata":
    "the cheapest version",
  "Largo × ancho × alto en mm, como las anota producto. Las nuestras resaltadas.":
    "Length × width × height in mm, as the product team records them. Ours are highlighted.",
  "largo × ancho × alto, en mm":
    "length × width × height, in mm",
  "las del período":
    "for the period",
  "Las líneas cortan en el promedio de lo filtrado: el eje X ponderado por unidades, el eje Y por burbuja.":
    "The lines cross at the average of what is filtered: the X axis weighted by units, the Y axis per bubble.",
  "Las marcas con menos venta van juntas en «Otras».":
    "The lowest-selling brands are grouped under “Others”.",
  "Las versiones, con sus medidas":
    "The versions, with their measurements",
  "Lidera {clase}.":
    "Leads the {clase} class.",
  "lista US$, la más barata":
    "list US$, cheapest",
  "lista, versión más barata":
    "list, cheapest version",
  "Lo que no está en el catálogo se ubica por precio y queda marcado «por precio» ({pct}).":
    "Whatever is not in the catalog is placed by price and flagged “by price” ({pct}).",
  "Lo sigue <b>{marca} {modelo}</b> con {n} unidades{precio}.":
    "Followed by <b>{marca} {modelo}</b> with {n} units{precio}.",
  "Los casilleros del mapa de precios que piden una decisión. <b>Entrar</b>: pesan al menos {relevante} del mercado y tenemos menos de {ausente}. <b>Defender</b>: de ahí sale al menos {propio} de todo lo que vendemos y tenemos más de {fuerte} del casillero. Con quién se lo lleva, a qué precio y qué margen de precio hay. Tocá cualquier casillero del mapa para ver la comparativa entera.":
    "The price-map cells that call for a decision. <b>Enter</b>: they account for at least {relevante} of the market and we hold less than {ausente}. <b>Defend</b>: at least {propio} of everything we sell comes from there and we hold more than {fuerte} of the cell. Who takes it, at what price and how much pricing room there is. Tap any cell on the map to see the full comparison.",
  "Los mapas":
    "The maps",
  "los que se le cruzan al cliente en el salón":
    "the ones a customer runs into on the showroom floor",
  "Los rivales que se le cruzan al cliente en el salón: los de la misma clase, no los de la misma marca ni los del mismo segmento de CADAM.":
    "The rivals a customer runs into on the showroom floor: those in the same class, not those of the same brand or the same CADAM segment.",
  "Mandamos con:":
    "We lead with:",
  "Mapas":
    "Maps",
  "Marca propia":
    "Own brand",
  "marca propia":
    "own brand",
  "Marcas en este gráfico":
    "Brands in this chart",
  "Margen %":
    "Margin %",
  "Margen promedio (% del precio sin IVA)":
    "Average margin (% of price excl. IVA)",
  "Margen promedio por unidad (US$)":
    "Average margin per unit (US$)",
  "Matriculaciones de la marca sobre todas las del período.":
    "The brand's registrations over all registrations in the period.",
  "matriculadas":
    "registered",
  "matriculados en el período":
    "registered in the period",
  "Matriculó":
    "Registered",
  "matriculó":
    "registered",
  "mediana de los rivales de su clase":
    "median of its class rivals",
  "mediana de todo su tipo de vehículo":
    "median of its entire vehicle type",
  "mediana de {n} precios":
    "median of {n} prices",
  "mediana de {n} rivales, automático":
    "median of {n} rivals, automatic",
  "mediana de {n} rivales, desde":
    "median of {n} rivals, starting price",
  "mediana de {n} rivales, mecánico":
    "median of {n} rivals, manual",
  "Medidas":
    "Measurements",
  "Menos de {hasta}":
    "under {hasta}",
  "Mercado por clase y banda de precio — {periodo}":
    "Market by class and price band — {periodo}",
  "Mercado por clase y motorización — {periodo}":
    "Market by class and powertrain — {periodo}",
  "Minibus":
    "Minibus",
  "Minibús":
    "Minibus",
  "misma banda":
    "same band",
  "misma caja · {precio}":
    "same transmission · {precio}",
  "Modelos":
    "Models",
  "Modelos con al menos una unidad en {fuente} del período. Cuántos de ellos concentran el 80% de las unidades dice si la marca depende de uno o dos.":
    "Models with at least one unit in the period's {fuente}. How many of them account for 80% of units shows whether the brand depends on one or two.",
  "Modelos en la gama":
    "Models in the range",
  "Monovolumen":
    "Minivan",
  "Motorización":
    "Powertrain",
  "Movilidad en este gráfico":
    "Powertrains in this chart",
  "MT desde {precio}":
    "MT from {precio}",
  "más barato":
    "cheaper",
  "más caro":
    "more expensive",
  "Ni vende ni deja":
    "Neither sells nor earns",
  "Ninguna versión con precio dice si es mecánica o automática, así que acá se comparó el «desde» de cada uno.":
    "No version with a price says whether it is manual or automatic, so here each one's “from” price was compared.",
  "Ninguna versión con precio ni con ranking para este filtro.":
    "No version with a price or ranking for this filter.",
  "Ninguna versión con venta y precio en el filtro.":
    "No version with sales and a price in the filter.",
  "Ninguna versión cumple las dos selecciones a la vez. Prendé otra marca u otra clase.":
    "No version meets both selections at once. Turn on another brand or another class.",
  "Ninguna versión cumple las dos selecciones a la vez. Prendé otra marca u otra segmento.":
    "No version meets both selections at once. Turn on another brand or another segment.",
  "ninguno con precio cargado":
    "none with a loaded price",
  "Ningún casillero de este recorte cumple los cortes.":
    "No cell in this selection meets the cutoffs.",
  "Ningún casillero grande con participación nuestra alta.":
    "No large cell with a high share of ours.",
  "Ningún modelo alcanza la base mínima para comparar con el año anterior.":
    "No model reaches the minimum base to compare with the prior year.",
  "Ningún modelo de esta marca tiene precio de lista en las fuentes cargadas.":
    "No model of this brand has a list price in the loaded sources.",
  "Ningún modelo nuestro con ventas en este recorte.":
    "None of our models has sales in this selection.",
  "Ningún modelo propio con ventas tiene precio en la lista cargada.":
    "None of our own models with sales has a price in the loaded list.",
  "Ningún otro modelo con ventas en esta clase durante el período.":
    "No other model with sales in this class during the period.",
  "Ningún rival en esta clase.":
    "No rival in this class.",
  "No está en el catálogo de clases: se ubicó por precio.":
    "Not in the class catalog: placed by price.",
  "No hay casilleros grandes sin presencia nuestra.":
    "There are no large cells without a presence of ours.",
  "No hay precios de rivales cargados en este casillero, así que no se puede decir a qué precio se compra.":
    "There are no rival prices loaded in this cell, so we cannot say what price buyers pay.",
  "No hay precios suficientes en automático en la clase para decir si está caro o barato.":
    "There are not enough automatic prices in the class to say whether it is expensive or cheap.",
  "No hay precios suficientes en la clase para decir si está caro o barato.":
    "There are not enough prices in the class to say whether it is expensive or cheap.",
  "No hay precios suficientes en mecánico en la clase para decir si está caro o barato.":
    "There are not enough manual prices in the class to say whether it is expensive or cheap.",
  "No hay precios suficientes para comparar dentro del casillero.":
    "There are not enough prices to compare within the cell.",
  "no tenemos modelo con precio acá":
    "we have no model with a price here",
  "No tenemos ningún modelo con ventas en este casillero.":
    "We have no model with sales in this cell.",
  "nuestra":
    "ours",
  "Nuestras":
    "Ours",
  "Nuestro modelo":
    "Our model",
  "Nuestro precio":
    "Our price",
  "Nuestro precio contra el de la misma caja en el mercado.":
    "Our price against the market price for the same transmission.",
  "Nuestro precio contra el mercado":
    "Our price against the market",
  "Nuestro precio de lista contra la mediana de los rivales de su misma clase (los que el comprador compara de verdad) y contra la mediana de todo su tipo de vehículo. Positivo = más caro que la mitad de esos rivales. Cada mediana necesita al menos dos rivales con precio. <b>Misma transmisión:</b> se compara el «desde» automático nuestro con el «desde» automático de los rivales (o mecánico con mecánico), leído del nombre de cada versión; solo cuando no hay con qué, «desde» contra «desde». Comparar el mecánico de uno con el automático del otro no es justo.":
    "Our list price against the median of rivals in the same class (those buyers truly compare) and against the median of its whole vehicle type. Positive = more expensive than half of those rivals. Each median needs at least two rivals with a price. <b>Same transmission:</b> our automatic “from” price is compared with the rivals' automatic “from” price (or manual with manual), read from each version's name; only when there is nothing to go on, “from” against “from”. Comparing one's manual with another's automatic is not fair.",
  "Nuestros modelos acá: {modelos}.":
    "Our models here: {modelos}.",
  "Nuevo":
    "New",
  "Omnibus":
    "Bus",
  "Otras ({marcas})":
    "Others ({marcas})",
  "Para cada modelo nuestro con ventas, todos los modelos de la competencia en su misma clase, con unidades, precio de lista y motorización. Los de su misma banda de precio van marcados; los demás no quedan afuera: una pick-up mediana compite con todas las pick-ups medianas, esté una banda arriba o abajo. <b>Misma caja</b>: los que tienen versión de la misma transmisión que la nuestra van primero, con su precio en esa caja; los que no la dicen quedan atenuados. Los primeros {n} van a la vista; el resto, plegado.":
    "For each of our models with sales, all of the competition's models in the same class, with units, list price and powertrain. Those in the same price band are marked; the rest are not left out: a midsize pickup competes with all midsize pickups, whether a band above or below. <b>Same transmission</b>: those with a version of the same transmission as ours come first, with their price in that transmission; those that do not say are dimmed. The first {n} are shown; the rest are collapsed.",
  "parejo":
    "on par",
  "Pedir {n}":
    "Order {n}",
  "Peso":
    "Mix",
  "Pick Up":
    "Pickup",
  "Pick-up compacta":
    "Compact pickup",
  "Pick-up grande":
    "Full-size pickup",
  "Pick-up mediana":
    "Midsize pickup",
  "Ponderado {n}":
    "Weighted {n}",
  "por mes, últimos 3":
    "per month, last 3",
  "Por versión":
    "By version",
  "por versión":
    "per version",
  "Posicionamiento por variación":
    "Positioning by % change",
  "Posicionamiento por versión":
    "Positioning by version",
  "Precio automático":
    "Automatic price",
  "Precio de lista ({moneda})":
    "List price ({moneda})",
  "Precio de los rivales":
    "Rivals' price",
  "Precio de referencia de la familia: esta variante no tiene precio propio en las listas":
    "Family reference price: this variant has no price of its own in the lists",
  "Precio desde":
    "Starting price",
  "Precio mecánico":
    "Manual price",
  "Precio y volumen versión por versión, y el ranking de competidores.":
    "Price and volume version by version, and the competitor ranking.",
  "Precios de lista en dólares. Arriba, lo que vendió el mercado; debajo, lo nuestro y su participación. Cuanto más teñido el casillero, más parte nuestra. Las clases van de chico a grande.":
    "List prices in dollars. On top, what the market sold; below, what is ours and our share. The more tinted the cell, the bigger our part. Classes run from small to large.",
  "Precios: los nuestros del stock de Cars, los de la competencia del catálogo de Datacar — no es lista oficial, y lo que no tiene precio no se adivina.":
    "Prices: ours from the Cars stock, the competition's from the Datacar catalog — not an official list, and whatever has no price is not guessed.",
  "Precios: los nuestros del stock de Cars, los de la competencia del catálogo de Datacar — no es lista oficial, y lo que no tiene precio no se adivina. <b>MT</b> y <b>AT</b> son el «desde» mecánico y automático de cada familia, leídos del nombre de la versión (MT, AT, CVT, DCT; un híbrido o eléctrico es automático): así se compara mecánico con mecánico. Lo que no dice su transmisión queda en «—» y no entra en esa cuenta.":
    "Prices: ours from the Cars stock, the competition's from the Datacar catalog — not an official list, and whatever has no price is not guessed. <b>MT</b> and <b>AT</b> are the manual and automatic “from” price of each family, read from the version name (MT, AT, CVT, DCT; a hybrid or electric is automatic): that is how manual is compared with manual. Whatever does not state its transmission shows “—” and is left out of that calculation.",
  "prom. {n} u.":
    "avg. {n} units",
  "prom. {v}":
    "avg. {v}",
  "Qué hacer en cada casillero marcado — {periodo}":
    "What to do in each flagged cell — {periodo}",
  "Qué modelos crecen y cuáles caen contra el año pasado, y con cuánto volumen.":
    "Which models are growing and which are falling against last year, and with how much volume.",
  "Qué modelos crecen y cuáles se caen, y con cuánto volumen: arriba a la derecha están los que crecen y ya pesan.":
    "Which models are growing and which are dropping, and with how much volume: the ones at the top right are growing and already carry weight.",
  "Rango de precios":
    "Price range",
  "Ranking de competidores por versión":
    "Competitor ranking by version",
  "Ranking por precio":
    "Ranking by price",
  "Ranking por versión":
    "Ranking by version",
  "Rivales de su clase (unidades · precio desde, MT y AT · motorización)":
    "Rivals in its class (units · from price, MT and AT · powertrain)",
  "Rivales directos — los de su misma clase, del que más vende al que menos":
    "Direct rivals — those in its same class, from best seller to least",
  "Rivales por modelo":
    "Rivals by model",
  "se listan los {n} que más venden":
    "showing the top {n} sellers",
  "Se lo llevan:":
    "Who takes it:",
  "Se muestran {n} de {total} marcas ({v} de {vt} versiones).":
    "Showing {n} of {total} brands ({v} of {vt} versions).",
  "Se sale del eje: dibujada en el tope de +{techo}%":
    "Off the axis: drawn at the +{techo}% cap",
  "Segmentos en este gráfico":
    "Segments in this chart",
  "Si estamos caros o baratos, comparando siempre contra la misma caja: un automático contra automáticos, un mecánico contra mecánicos.":
    "Whether we are expensive or cheap, always comparing against the same transmission: an automatic against automatics, a manual against manuals.",
  "Sin alertas":
    "No alerts",
  "sin banda":
    "no band",
  "Sin clasificar":
    "Unclassified",
  "Sin dato":
    "No data",
  "sin fuente con precio para esta marca":
    "no source with a price for this brand",
  "Sin matriculaciones en este recorte.":
    "No registrations in this selection.",
  "sin modelos con ventas en el casillero":
    "no models with sales in the cell",
  "sin precio":
    "no price",
  "Sin precio conocido":
    "Price unknown",
  "sin precio de lista":
    "no list price",
  "Sin precios de rivales en el casillero: no se puede decir a qué precio se compra.":
    "No rival prices in the cell: we cannot say what price buyers pay.",
  "Sin precios suficientes para comparar dentro del casillero.":
    "Not enough prices to compare within the cell.",
  "sin rivales con precio automático":
    "no rivals with an automatic price",
  "sin rivales con precio desde":
    "no rivals with a starting price",
  "sin rivales con precio mecánico":
    "no rivals with a manual price",
  "sin rivales con precio para comparar":
    "no rivals with a price to compare",
  "sin {caja}":
    "no {caja}",
  "Sin {fuente} en este recorte.":
    "No {fuente} in this selection.",
  "Solo los modelos con precio propio en alguna fuente (las variantes que toman el precio de su familia van en la tabla, con «≈»). Pasá el mouse por una barra para ver el rango, las versiones y las unidades.":
    "Only models with a price of their own in some source (variants that take their family's price appear in the table, marked “≈”). Hover over a bar to see the range, the versions and the units.",
  "solo {x}":
    "only {x}",
  "Su clase":
    "Its class",
  "Su clase en el mercado":
    "Its class in the market",
  "Su clase, automático":
    "Its class, automatic",
  "Su clase, desde":
    "Its class, starting price",
  "Su clase, mecánico":
    "Its class, manual",
  "Su nombre no dice si tiene automático: no entra en la comparación por caja.":
    "Its name does not say whether it has an automatic: it is left out of the transmission comparison.",
  "Su nombre no dice si tiene mecánico: no entra en la comparación por caja.":
    "Its name does not say whether it has a manual: it is left out of the transmission comparison.",
  "su parte de este casillero":
    "its share of this cell",
  "su parte de la clase":
    "its share of the class",
  "su parte dentro de la marca":
    "its share within the brand",
  "Suelen ser modelos que todavía no sacaron chapa o que la DNRA escribe con otro nombre.":
    "These are usually models that have not been registered yet or that DNRA writes under another name.",
  "Suelen ser modelos que ya no se importan o que las dos bases escriben distinto.":
    "These are usually models that are no longer imported or that the two databases write differently.",
  "SUV chico":
    "Small SUV",
  "SUV compacto":
    "Compact SUV",
  "SUV grande":
    "Large SUV",
  "SUV mediano":
    "Midsize SUV",
  "SUV premium":
    "Premium SUV",
  "Tamaño de la burbuja = facturación de esa familia (unidades × ticket).":
    "Bubble size = invoicing of that family (units × ticket).",
  "Tamaño de la burbuja = facturación de esa versión (unidades × ticket).":
    "Bubble size = invoicing of that version (units × ticket).",
  "Ticket alto, vende poco":
    "High ticket, sells little",
  "Ticket bajo, vende poco":
    "Low ticket, sells little",
  "Ticket promedio (US$)":
    "Average ticket (US$)",
  "Ticket US$ {ticket} · margen US$ {margen}":
    "Ticket US$ {ticket} · margin US$ {margen}",
  "Tiene versión automática, como el nuestro: US$ {precio}":
    "Has an automatic version, like ours: US$ {precio}",
  "Tiene versión mecánica, como el nuestro: US$ {precio}":
    "Has a manual version, like ours: US$ {precio}",
  "Tipo de vehículo":
    "Vehicle type",
  "Tocá cualquier casillero para ver el detalle.":
    "Tap any cell to see the details.",
  "tocá una burbuja para ver contra quién compite":
    "tap a bubble to see who it competes against",
  "toda la clase, sumando las columnas":
    "the whole class, adding up the columns",
  "Todas las versiones de la batalla, de la más cara a la más barata, con su volumen ({volumen}).":
    "All the versions in the battle, from most to least expensive, with their volume ({volumen}).",
  "Todavía no hay suficientes precios de rivales para comparar.":
    "There are not enough rival prices yet to compare.",
  "Todavía no se cargó la planilla de producto (JETOUR_PY_BBCH_*.xlsx). La carga Hermes desde la carpeta del tablero con <code>advisor-batalla.sh</code>.":
    "The product spreadsheet (JETOUR_PY_BBCH_*.xlsx) has not been loaded yet. Hermes loads it from the dashboard folder with <code>advisor-batalla.sh</code>.",
  "Todo el tipo":
    "Whole type",
  "todos los estados":
    "all statuses",
  "Todos los modelos del casillero":
    "All the models in the cell",
  "Todos los modelos que la marca {verbo} en {periodo}, tengan o no precio. El peso es la parte de cada uno dentro de la marca.":
    "All the models the brand {verbo} in {periodo}, with or without a price. Mix is each one's share within the brand.",
  "Todos los modelos que la marca {verbo} en {periodo}, tengan o no precio. El peso es la parte de cada uno dentro de la marca; la columna de {fuente} ({periodoSec}) se cruza por nombre con la otra base de CADAM.":
    "All the models the brand {verbo} in {periodo}, with or without a price. Mix is each one's share within the brand; the {fuente} column ({periodoSec}) is matched by name against the other CADAM database.",
  "Una burbuja por versión rival, en la columna de su marca · eje Y = precio de lista (US$) · tamaño = {volumen} del período · al pie de cada columna, el total de la marca.":
    "One bubble per rival version, in its brand's column · Y axis = list price (US$) · size = the period's {volumen} · at the foot of each column, the brand total.",
  "Una burbuja por versión · eje X = clase de vehículo · eje Y = precio de lista · tamaño = unidades · color = marca. Lo que comparte columna compite entre sí: la clase separa el SUV chico del grande, cosa que el segmento de CADAM no hace. <b>Tocá una burbuja</b> y se abre contra quién compite esa versión, a qué precio está cada rival y si estamos caros o baratos.":
    "One bubble per version · X axis = vehicle class · Y axis = list price · size = units · color = brand. Whatever shares a column competes with each other: the class separates the small SUV from the large one, which the CADAM segment does not. <b>Tap a bubble</b> and it opens who that version competes against, at what price each rival sits and whether we are expensive or cheap.",
  "Unidades de {marca} que entraron al país en {periodo}, contra el mismo período de {anio}. Lo que importa y no matricula es stock en camino.{aclaracion}":
    "{marca} units that entered the country in {periodo}, against the same period of {anio}. What is imported and not yet registered is stock on its way.{aclaracion}",
  "unidades del período (Cars)":
    "units for the period (Cars)",
  "unidades que entraron al país":
    "units that entered the country",
  "unidades que sacaron chapa":
    "units that got registered",
  "Unidades: importaciones de CADAM del período — lo importado se matricula dos o tres meses después.":
    "Units: CADAM imports for the period — what is imported gets registered two or three months later.",
  "Unidades: importaciones de CADAM del período.":
    "Units: CADAM imports for the period.",
  "Unidades: matriculaciones de CADAM del período.":
    "Units: CADAM registrations for the period.",
  "US$ · {n} de {total} modelos con precio ({pct} de las unidades)":
    "US$ · {n} of {total} models with a price ({pct} of units)",
  "Var.":
    "Chg.",
  "Vende y deja":
    "Sells and earns",
  "Vende, deja poco":
    "Sells, earns little",
  "Vende, ticket alto":
    "Sells, high ticket",
  "Vende, ticket bajo":
    "Sells, low ticket",
  "Vendidos":
    "Sold",
  "Vendimos nosotros":
    "We sold",
  "Vendió el mercado":
    "Market sold",
  "Ver contra quién compite":
    "See who it competes against",
  "Ver el detalle de {fila} · {columna}":
    "View details for {fila} · {columna}",
  "Ver las {n} versiones de {modelo}":
    "Show the {n} versions of {modelo}",
  "Ver {n} más":
    "Show {n} more",
  "vs. año anterior":
    "vs. prior year",
  "y hay espacio si el stock escasea":
    "and there is room if stock runs short",
  "y otras":
    "and others",
  "y otros":
    "and others",
  "y {n} más":
    "and {n} more",
  "{a} y {b}":
    "{a} and {b}",
  "{clase} en el período":
    "{clase} in the period",
  "{desde} a {hasta}":
    "{desde} to {hasta}",
  "{desde} o más":
    "{desde} or more",
  "{fila} en la banda {columna} · {periodo}":
    "{fila} in the {columna} band · {periodo}",
  "{fila} en la motorización {columna} · {periodo}":
    "{fila} in the {columna} powertrain · {periodo}",
  "{imp} import. · {mat} matric.":
    "{imp} imports · {mat} registrations",
  "{marca} no tiene {fuente} en {periodo}.":
    "{marca} has no {fuente} in {periodo}.",
  "{marca} — dónde se para cada modelo":
    "{marca} — where each model stands",
  "{marca} — {n} modelos · {fuente} {periodo}":
    "{marca} — {n} models · {fuente} {periodo}",
  "{n} % contra los rivales":
    "{n}% vs. rivals",
  "{n} /mes":
    "{n} /mo",
  "{n} clase con menos de {min} unidades no se dibujan.":
    "{n} class with fewer than {min} units is not drawn.",
  "{n} clases con menos de {min} unidades no se dibujan.":
    "{n} classes with fewer than {min} units are not drawn.",
  "{n} con automático como el nuestro":
    "{n} with an automatic like ours",
  "{n} con mecánico como el nuestro":
    "{n} with a manual like ours",
  "{n} en su misma banda":
    "{n} in its same band",
  "{n} en {clase}":
    "{n} in {clase}",
  "{n} hacen el 80% de la marca":
    "80% of the brand comes from {n}",
  "{n} modelos":
    "{n} models",
  "{n} modelos. Tocá una fila para ver contra quién compite ese modelo y a qué precio. «~» junto a la clase: inferida por precio o segmento, no del catálogo. «≈» junto al precio: es el «desde» de la familia, porque esa variante no tiene precio propio en las listas.":
    "{n} models. Tap a row to see who that model competes against and at what price. “~” next to the class: inferred from price or segment, not from the catalog. “≈” next to the price: it is the family's “from” price, because that variant has no price of its own in the lists.",
  "{n} nuestras":
    "{n} ours",
  "{n} nuestras · {pct}":
    "{n} ours · {pct}",
  "{n} rival":
    "{n} rival",
  "{n} rival con precio":
    "{n} rival with a price",
  "{n} rival con unidades.":
    "{n} rival with units.",
  "{n} rivales":
    "{n} rivals",
  "{n} rivales con precio":
    "{n} rivals with a price",
  "{n} rivales con unidades.":
    "{n} rivals with units.",
  "{n} u. en el casillero":
    "{n} units in the cell",
  "{n} u. en el período":
    "{n} units in the period",
  "{n} u. en la clase":
    "{n} units in the class",
  "{n} u. facturadas en el período":
    "{n} units invoiced in the period",
  "{n} versiones con precio · {u} {fuente}":
    "{n} versions with a price · {u} {fuente}",
  "{n} versiones · el Δ compara <b>puntos de share</b>, no unidades: entre {anioAnterior} y {anio} el mercado cambió de tamaño, así que las unidades de los dos períodos no son comparables entre sí — el share sí. Una versión puede vender más y aun así ceder terreno.":
    "{n} versions · the Δ compares <b>share points</b>, not units: between {anioAnterior} and {anio} the market changed size, so the units of the two periods are not comparable with each other — share is. A version can sell more and still lose ground.",
  "{n} versión con precio · {u} {fuente}":
    "{n} version with a price · {u} {fuente}",
  "{pct} de la clase":
    "{pct} of the class",
  "{pct} de su clase":
    "{pct} of its class",
  "{pct} de {clase}.":
    "{pct} of the {clase} class.",
  "{pct} del casillero":
    "{pct} of the cell",
  "{pct} del mapa":
    "{pct} of the map",
  "{sujeto} <b>US$ {brecha} por debajo</b> de la mediana de su clase ({n} rivales{rivales}): el precio es un argumento a favor{cierre}.":
    "{sujeto} <b>US$ {brecha} below</b> the median of its class ({n} rivals{rivales}): price is an argument in its favor{cierre}.",
  "{sujeto} <b>US$ {brecha} por encima</b> de la mediana de su clase ({n} rivales{rivales}): el precio juega en contra y hay que compensarlo con producto o financiación.":
    "{sujeto} <b>US$ {brecha} above</b> the median of its class ({n} rivals{rivales}): price works against it and has to be offset with product or financing.",
  "{sujeto} al precio de su clase: lo que decide es el stock, la pauta y el seguimiento.":
    "{sujeto} at its class price: what decides is stock, advertising and follow-up.",
  "«{archivo}»":
    "“{archivo}”",
  "Ómnibus":
    "Bus",
  "— {n} versiones, {unidades} u.: {lista}":
    "— {n} versions, {unidades} units: {lista}",
  "— {n} versión, {unidades} u.: {lista}":
    "— {n} version, {unidades} units: {lista}",
};

export default EN;
