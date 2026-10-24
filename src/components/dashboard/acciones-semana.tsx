import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Cifra } from "@/components/movimiento/cifra";
import { Seccion } from "@/components/dashboard/seccion";
import {
  acotarAFuente, getRankingMarcas, getRankingModelos, type Filtro,
} from "@/lib/cadam/mercado";
import { getAsesoresMayoristasSet, getMarcasPropiasSet, getPresupuesto } from "@/lib/cadam/config";
import {
  getStockPropio, getVentasAsesor, getVentasPropias, hayDatosPropios,
} from "@/lib/informes/propios";
import { calcularCobertura, type CoberturaVersion } from "@/lib/informes/cobertura";
import { anioActual, resumenPresupuesto } from "@/lib/informes/tablero";
import { getI18n } from "@/lib/i18n/servidor";
import { cn } from "@/lib/utils";

/** Una fila de la tarjeta: a la izquierda qué (se corta si no entra), a la
 *  derecha cuánto (nunca se corta: es lo que se lee). */
interface Fila {
  nombre: string;
  valor: string;
}

/**
 * "Acciones de la semana": seis tarjetas que dicen qué hacer, con el
 * número, una frase en palabras de negocio y adónde ir a verlo.
 *
 * Todo calculado acá, en código. La lección del 03/09/2026: el Copiloto
 * cita bien las cifras y concluye al revés. Las tarjetas no interpretan,
 * cuentan.
 *
 * ALCANCE. Estas tarjetas miran TODO el mercado: usan el período de la barra
 * de filtros (Año, Desde, Hasta) y nada más. Marca, Segmento y Tecnología no
 * les cambian nada, y está dicho en el encabezado. Antes los rivales sí
 * recibían esos filtros, y con «Marca: TOYOTA» la tarjeta de rivales quedaba
 * en cero (sin marcas nuestras en el recorte no hay «segmentos donde
 * vendemos») sin que nada lo explicara. Las de Cars (stock, asesores, plan)
 * nunca dependieron de la barra.
 *
 * Es un Server Component asíncrono para que una sola línea lo ponga en
 * cualquier pantalla (hoy en /mercado, que es la home real: "/" redirige
 * ahí). Si Cars no responde, las tres tarjetas que dependen de Cars lo
 * dicen; la página no se cae.
 *
 * IDIOMA. Cada frase de las tarjetas es UNA clave entera, con la unidad
 * («versiones», «modelos»…) adentro: la frase se lee a continuación del
 * número grande, y el inglés tiene que poder ordenarla a su manera.
 */
export async function AccionesSemana({ f, periodo }: { f: Filtro; periodo: string }) {
  const { t, fmt, idioma } = await getI18n();
  const { formatDecimal, formatPuntosPct, formatUnidades, mesCorto } = fmt;
  // Con UN solo elemento el inglés tiene que concordar («1 version is selling…»). El castellano no cambia nunca
  // con el número: sus frases dicen siempre «versiones se venden…», también con 1; las frases en singular de abajo
  // (en castellano correcto) se usan solo para el inglés.
  const unico = (n: number | null) => idioma === "en" && n === 1;
  const propias = getMarcasPropiasSet();
  // Solo el período: ver «ALCANCE» arriba.
  const fMercado: Filtro = { anio: f.anio, mesDesde: f.mesDesde, mesHasta: f.mesHasta };
  // «Rivales cargando stock» compara importaciones contra matriculaciones:
  // las dos sobre el tramo que tienen ambas. Con un mes de ventaja de una
  // fuente (importación en sep-2026, matriculación en oct-2026) la
  // comparación dejaba pasar o inventaba marcas que cargan stock.
  const hastaComun = Math.max(
    fMercado.mesDesde,
    Math.min(
      acotarAFuente("matriculacion", fMercado).mesHasta,
      acotarAFuente("importacion", fMercado).mesHasta
    )
  );
  const fComun = { ...fMercado, mesHasta: hastaComun };
  const marcas = getRankingMarcas("matriculacion", fComun);
  const marcasImp = getRankingMarcas("importacion", fComun);

  // Rivales en alza: modelos de OTRAS marcas que más participación ganaron
  // en los segmentos donde nosotros vendemos (20+ u. propias en el período),
  // con base mínima de 30 u. para que el salto no sea ruido.
  const modelos = getRankingModelos("matriculacion", fMercado, 800);
  const segsPropios = new Map<string, number>();
  for (const m of modelos) {
    if (m.esPropia && m.segmento) {
      segsPropios.set(m.segmento, (segsPropios.get(m.segmento) ?? 0) + m.unidades);
    }
  }
  const segsDondeJugamos = new Set(
    [...segsPropios.entries()].filter(([, u]) => u >= 20).map(([s]) => s)
  );
  const rivalesEnAlza = modelos
    .filter(
      (m) =>
        !m.esPropia && !!m.segmento && segsDondeJugamos.has(m.segmento) &&
        m.unidades >= 30 && m.deltaShare !== null
    )
    .sort((a, b) => (b.deltaShare ?? 0) - (a.deltaShare ?? 0))
    .slice(0, 3);

  // Rivales cargando stock: importaron mucho más de lo que matricularon.
  // Lo que se importa se matricula 2-3 meses después: es stock que va a
  // salir a la calle, con promociones o sin ellas.
  const importPorMarca = new Map(marcasImp.map((m) => [m.marca, m.unidades]));
  const rivalesCargando = marcas
    .filter((m) => !propias.has(m.marca))
    .map((m) => ({ marca: m.marca, matric: m.unidades, imp: importPorMarca.get(m.marca) ?? 0 }))
    .filter((x) => x.imp >= 100 && x.imp >= 1.5 * x.matric)
    .sort((a, b) => b.imp - b.matric - (a.imp - a.matric))
    .slice(0, 3);

  // Lo que viene de Cars: stock, ritmo y asesores.
  let acciones: {
    pedir: CoberturaVersion[];
    empujar: CoberturaVersion[];
    parados: { asesor: string; antes: number }[];
    ultimoMes: string;
  } | null = null;
  try {
    if (await hayDatosPropios()) {
      const [stockP, ventasP, asesoresP] = await Promise.all([
        getStockPropio(), getVentasPropias(), getVentasAsesor(),
      ]);
      const cob = calcularCobertura(stockP, ventasP);
      const [m1, m2, m3] = cob.mesesRitmo;
      const mayoristas = getAsesoresMayoristasSet();
      // Parado: vendía (3+ vehículos en los dos meses anteriores) y en el
      // último mes cerrado no facturó ninguno. Solo retail.
      const porAsesor = new Map<string, { antes: number; ultimo: number }>();
      for (const a of asesoresP) {
        if (mayoristas.has(a.asesor)) continue;
        const x = porAsesor.get(a.asesor) ?? { antes: 0, ultimo: 0 };
        if (a.periodo === m1 || a.periodo === m2) x.antes += a.unidades;
        if (a.periodo === m3) x.ultimo += a.unidades;
        porAsesor.set(a.asesor, x);
      }
      const parados = [...porAsesor.entries()]
        .filter(([, x]) => x.antes >= 3 && x.ultimo === 0)
        .sort((a, b) => b[1].antes - a[1].antes)
        .map(([asesor, x]) => ({ asesor, antes: x.antes }));
      acciones = { pedir: cob.pedir, empujar: cob.empujar, parados, ultimoMes: m3 };
    }
  } catch {
    acciones = null;
  }
  const mesCerrado = acciones ? mesCorto(Number(acciones.ultimoMes.slice(5, 7))) : "";

  // Presupuesto del año (Excel de Finanzas): qué marcas van más lento que
  // el plan para lo que queda. null = no cargado o Cars caído.
  let presupuesto: Awaited<ReturnType<typeof resumenPresupuesto>> = null;
  try {
    presupuesto = await resumenPresupuesto();
  } catch {
    presupuesto = null;
  }
  const hayPresupuestoCargado = getPresupuesto(anioActual()) !== null;
  const nPedir = acciones ? acciones.pedir.length : null;
  const nEmpujar = acciones ? acciones.empujar.length : null;
  const nParados = acciones ? acciones.parados.length : null;
  const nAtrasados = presupuesto ? presupuesto.atrasados.length : null;

  return (
    <Seccion
      titulo={t("Acciones de la semana")}
      nota={t("Los rivales miran todo el mercado del período; stock, asesores y plan, lo último de Cars. Ninguna cambia con Marca, Segmento ni Tecnología.")}
    >
      {/* En el celular, una tira que se desliza (cada tarjeta al 82% para que
          asome la siguiente): seis tarjetas apiladas eran más de mil píxeles
          de scroll antes de la primera cifra del mercado. Desde sm, grilla.
          Tres columnas hasta 2xl: con seis, cada tarjeta medía ~190 px y los
          nombres de versión salían cortados. */}
      <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 [scroll-padding-inline:1rem] [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-3 2xl:grid-cols-6 [&::-webkit-scrollbar]:hidden">
        <TarjetaAccion
          titulo={t("Pedir stock")}
          numero={nPedir}
          vacio={t("Ninguna versión con menos de un mes y medio de stock.")}
          frase={
            unico(nPedir)
              ? t("versión se vende y tiene menos de un mes y medio de stock libre, aun contando lo que viene en viaje.")
              : t("versiones se venden y tienen menos de un mes y medio de stock libre, aun contando lo que viene en viaje.")
          }
          filas={acciones?.pedir.slice(0, 3).map((v) => ({
            nombre: v.version,
            valor: t("{n} meses", { n: formatDecimal(v.meses) }),
          })) ?? []}
          href="/operacion?vista=stock#pedido"
          tono="rojo"
        />
        <TarjetaAccion
          titulo={t("Empujar con promo")}
          numero={nEmpujar}
          vacio={t("Ninguna versión con más de seis meses de stock.")}
          frase={
            unico(nEmpujar)
              ? t("versión tiene más de seis meses de stock o casi no se mueve. Plata parada.")
              : t("versiones tienen más de seis meses de stock o casi no se mueven. Plata parada.")
          }
          filas={acciones?.empujar.slice(0, 3).map((v) => ({
            nombre: v.version,
            valor: t("{n} libres", { n: formatUnidades(v.libres) }),
          })) ?? []}
          href="/operacion?vista=stock#pedido"
          tono="ambar"
        />
        <TarjetaAccion
          titulo={t("Rivales en alza")}
          numero={rivalesEnAlza.length}
          vacio={t("Ningún modelo rival ganó participación de forma notable.")}
          frase={
            unico(rivalesEnAlza.length)
              ? t("modelo de otra marca ganó más participación en los segmentos donde vendemos · {periodo}.", { periodo })
              : t("modelos de otras marcas ganaron más participación en los segmentos donde vendemos · {periodo}.", { periodo })
          }
          filas={rivalesEnAlza.map((m) => ({
            nombre: `${m.marca} ${m.modelo}`,
            valor: formatPuntosPct(m.deltaShare ?? 0),
          }))}
          href="/rankings"
          tono="tinta"
        />
        <TarjetaAccion
          titulo={t("Asesores parados")}
          numero={nParados}
          vacio={t("Ningún asesor retail dejó de facturar.")}
          frase={
            acciones
              ? unico(nParados)
                ? t("asesor venía vendiendo y en {mes} no facturó ningún vehículo.", { mes: mesCerrado })
                : t("asesores venían vendiendo y en {mes} no facturaron ningún vehículo.", { mes: mesCerrado })
              : unico(nParados)
                ? t("asesor venía vendiendo y el último mes no facturó.")
                : t("asesores venían vendiendo y el último mes no facturaron.")
          }
          filas={acciones?.parados.slice(0, 3).map((p) => ({
            nombre: p.asesor,
            valor: t("{n} antes", { n: p.antes }),
          })) ?? []}
          href="/operacion?vista=equipo#asesores"
          tono="ambar"
        />
        <TarjetaAccion
          titulo={t("Rivales cargando stock")}
          numero={rivalesCargando.length}
          vacio={t("Ninguna marca rival importa muy por encima de lo que matricula.")}
          frase={
            unico(rivalesCargando.length)
              ? t("marca importó al menos 50% más de lo que matriculó: stock que va a salir a la calle.")
              : t("marcas importaron al menos 50% más de lo que matricularon: stock que va a salir a la calle.")
          }
          filas={rivalesCargando.map((x) => ({
            nombre: x.marca,
            valor: t("{imp} imp. · {mat} mat.", { imp: formatUnidades(x.imp), mat: formatUnidades(x.matric) }),
          }))}
          href="/brecha"
          tono="tinta"
        />
        <TarjetaAccion
          titulo={t("Atrasados contra el plan")}
          numero={nAtrasados}
          vacio={t("Todas las marcas al ritmo del plan.")}
          // Acá null no siempre es «Cars no respondió»: también es «no hay
          // presupuesto cargado», y la tarjeta decía lo primero en los dos casos.
          sinDatosTexto={
            hayPresupuestoCargado
              ? t("Hay presupuesto cargado pero Cars no respondió: sin facturas no hay ritmo que comparar.")
              : t("Sin presupuesto cargado: se lee solo del Excel de Finanzas, una vez por hora.")
          }
          frase={
            presupuesto
              ? unico(nAtrasados)
                ? t("marca va más lento que lo que pide el plan {version} para lo que queda del año.", { version: presupuesto.version })
                : t("marcas van más lento que lo que pide el plan {version} para lo que queda del año.", { version: presupuesto.version })
              : unico(nAtrasados)
                ? t("marca va más lento que el plan del año.")
                : t("marcas van más lento que el plan del año.")
          }
          filas={
            presupuesto?.atrasados.slice(0, 3).map((a) => ({
              nombre: a.marcas.join(" + "),
              valor: t("falta {n}/mes", { n: formatDecimal(a.faltaPorMes) }),
            })) ?? []
          }
          href={presupuesto ? "/operacion#marcas" : "/cargas"}
          tono="rojo"
        />
      </div>
    </Seccion>
  );
}

/**
 * Una acción: qué, cuántas, por qué, y adónde ir. `numero` null = la fuente
 * no respondió (Cars caído): se dice, no se muestra un cero que parecería
 * "no hay nada que hacer".
 */
async function TarjetaAccion({
  titulo, numero, vacio, sinDatosTexto, frase, filas, href, tono,
}: {
  titulo: string;
  numero: number | null;
  /** Qué decir cuando el número es 0: en singular y en positivo. */
  vacio: string;
  /** Qué decir cuando no hay número (la fuente no respondió o no hay carga).
   *  Sin esto, «Sin datos de Cars ahora mismo.». */
  sinDatosTexto?: string;
  /** La frase entera que sigue al número grande, con su unidad adentro
   *  («versiones se venden y…»): se traduce como UNA clave. */
  frase: string;
  filas: Fila[];
  href: string;
  tono: "rojo" | "ambar" | "tinta";
}) {
  const { t } = await getI18n();
  const sinDatos = numero === null;
  const nada = numero === 0;
  return (
    <Link
      href={href}
      className="group flex w-[82%] shrink-0 snap-start rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-auto sm:shrink"
    >
      <Card
        className={cn(
          "flex w-full flex-col gap-2 py-4 transition-shadow group-hover:shadow-md",
          // El borde de color es el refuerzo del número, no el único aviso:
          // con el 300 casi no se distinguía del fondo.
          !sinDatos && !nada && tono === "rojo" && "border-rose-400/70 dark:border-rose-800",
          !sinDatos && !nada && tono === "ambar" && "border-amber-400/80 dark:border-amber-800"
        )}
      >
        <CardContent className="flex flex-1 flex-col px-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {titulo}
          </p>
          <Cifra
            como="p"
            texto={sinDatos ? "—" : String(numero)}
            className={cn(
              "metric mt-1 text-4xl leading-none",
              sinDatos || nada
                ? "text-muted-foreground"
                : tono === "rojo"
                  ? "text-rose-600 dark:text-rose-400"
                  : tono === "ambar"
                    ? "text-amber-600 dark:text-amber-500"
                    : "text-foreground"
            )}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            {sinDatos ? (sinDatosTexto ?? t("Sin datos de Cars ahora mismo.")) : nada ? vacio : frase}
          </p>
          {filas.length > 0 && (
            <ul className="mt-3 flex flex-col text-xs">
              {filas.map((fila) => (
                <li
                  key={fila.nombre}
                  title={`${fila.nombre} · ${fila.valor}`}
                  className="flex items-baseline justify-between gap-3 border-t border-border/60 py-1.5 first:border-t-0 first:pt-0"
                >
                  <span className="min-w-0 truncate font-medium">{fila.nombre}</span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">{fila.valor}</span>
                </li>
              ))}
            </ul>
          )}
          <span className="mt-auto pt-2 text-xs font-medium text-primary">{t("Ver")} <span aria-hidden="true">→</span></span>
        </CardContent>
      </Card>
    </Link>
  );
}
