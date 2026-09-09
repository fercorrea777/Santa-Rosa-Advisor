import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { getRankingMarcas, getRankingModelos, type Filtro } from "@/lib/cadam/mercado";
import { getAsesoresMayoristasSet, getMarcasPropiasSet, getPresupuesto } from "@/lib/cadam/config";
import {
  getStockPropio, getVentasAsesor, getVentasPropias, hayDatosPropios,
} from "@/lib/informes/propios";
import { calcularCobertura, type CoberturaVersion } from "@/lib/informes/cobertura";
import { formatUnidades } from "@/lib/format";
import { mesCorto } from "@/lib/periodo";
import { anioActual, resumenPresupuesto } from "@/lib/informes/tablero";
import { cn } from "@/lib/utils";

/**
 * "Acciones de la semana": cinco tarjetas que dicen qué hacer, con el
 * número, una frase en palabras de negocio y adónde ir a verlo.
 *
 * Todo calculado acá, en código. La lección del 03/09/2026: el Copiloto
 * cita bien las cifras y concluye al revés. Las tarjetas no interpretan,
 * cuentan.
 *
 * Es un Server Component asíncrono para que una sola línea lo ponga en
 * cualquier pantalla (hoy en /mercado, que es la home real: "/" redirige
 * ahí). Si Cars no responde, las tres tarjetas que dependen de Cars lo
 * dicen; la página no se cae.
 */
export async function AccionesSemana({ f, periodo }: { f: Filtro; periodo: string }) {
  const propias = getMarcasPropiasSet();
  const marcas = getRankingMarcas("matriculacion", f);
  const marcasImp = getRankingMarcas("importacion", f);

  // Rivales en alza: modelos de OTRAS marcas que más participación ganaron
  // en los segmentos donde nosotros vendemos (20+ u. propias en el período),
  // con base mínima de 30 u. para que el salto no sea ruido.
  const modelos = getRankingModelos("matriculacion", f, 800);
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

  return (
    <section aria-labelledby="acciones-titulo" className="flex flex-col gap-3">
      <h2 id="acciones-titulo" className="seccion-hd">Acciones de la semana</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <TarjetaAccion
          titulo="Pedir stock"
          numero={acciones ? acciones.pedir.length : null}
          unidad="versiones"
          vacio="Ninguna versión con menos de un mes y medio de stock."
          frase="se venden y tienen menos de un mes y medio de stock libre, aun contando lo que viene en viaje."
          items={acciones?.pedir.slice(0, 3).map((v) => `${v.version} · ${coma(v.meses)} meses`) ?? []}
          href="/operacion#pedido"
          tono="rojo"
        />
        <TarjetaAccion
          titulo="Empujar con promo"
          numero={acciones ? acciones.empujar.length : null}
          unidad="versiones"
          vacio="Ninguna versión con más de seis meses de stock."
          frase="tienen más de seis meses de stock o casi no se mueven. Plata parada."
          items={acciones?.empujar.slice(0, 3).map((v) => `${v.version} · ${formatUnidades(v.libres)} libres`) ?? []}
          href="/operacion#pedido"
          tono="ambar"
        />
        <TarjetaAccion
          titulo="Rivales en alza"
          numero={rivalesEnAlza.length}
          unidad="modelos"
          vacio="Ningún modelo rival ganó participación de forma notable."
          frase={`de otras marcas ganaron más participación en los segmentos donde vendemos · ${periodo}.`}
          items={rivalesEnAlza.map(
            (m) => `${m.marca} ${m.modelo} +${coma((m.deltaShare ?? 0) * 100)} pts`
          )}
          href="/rankings"
          tono="tinta"
        />
        <TarjetaAccion
          titulo="Asesores parados"
          numero={acciones ? acciones.parados.length : null}
          unidad="asesores"
          vacio="Ningún asesor retail dejó de facturar."
          frase={
            acciones
              ? `venían vendiendo y en ${mesCerrado} no facturaron ningún vehículo.`
              : "venían vendiendo y el último mes no facturaron."
          }
          items={acciones?.parados.slice(0, 3).map((p) => `${p.asesor} · ${p.antes} antes`) ?? []}
          href="/operacion#asesores"
          tono="ambar"
        />
        <TarjetaAccion
          titulo="Rivales cargando stock"
          numero={rivalesCargando.length}
          unidad="marcas"
          vacio="Ninguna marca rival importa muy por encima de lo que matricula."
          frase="importaron al menos 50% más de lo que matricularon: stock que va a salir a la calle."
          items={rivalesCargando.map(
            (x) => `${x.marca}: ${formatUnidades(x.imp)} imp. vs ${formatUnidades(x.matric)} mat.`
          )}
          href="/brecha"
          tono="tinta"
        />
        <TarjetaAccion
          titulo="Atrasados contra el plan"
          numero={presupuesto ? presupuesto.atrasados.length : null}
          unidad="marcas"
          vacio={
            presupuesto
              ? "Todas las marcas al ritmo del plan."
              : hayPresupuestoCargado
                ? "Hay presupuesto cargado pero Cars no respondió: sin facturas no hay ritmo que comparar."
                : "Sin presupuesto cargado: se lee solo del Excel de Finanzas, una vez por hora."
          }
          frase={
            presupuesto
              ? `van más lento que lo que pide el plan ${presupuesto.version} para lo que queda del año.`
              : "van más lento que el plan del año."
          }
          items={
            presupuesto?.atrasados
              .slice(0, 3)
              .map((a) => `${a.marcas.join(" + ")} · falta ${coma(a.faltaPorMes)}/mes`) ?? []
          }
          href={presupuesto ? "/operacion#marcas" : "/cargas"}
          tono="rojo"
        />
      </div>
    </section>
  );
}

/**
 * Una acción: qué, cuántas, por qué, y adónde ir. `numero` null = la fuente
 * no respondió (Cars caído): se dice, no se muestra un cero que parecería
 * "no hay nada que hacer".
 */
/** Un decimal con coma, como se lee acá: 1,4 y no 1.4. */
function coma(n: number | null | undefined): string {
  return n === null || n === undefined ? "—" : n.toFixed(1).replace(".", ",");
}

function TarjetaAccion({
  titulo, numero, unidad, vacio, frase, items, href, tono,
}: {
  titulo: string;
  numero: number | null;
  unidad: string;
  /** Qué decir cuando el número es 0: en singular y en positivo. */
  vacio: string;
  frase: string;
  items: string[];
  href: string;
  tono: "rojo" | "ambar" | "tinta";
}) {
  const sinDatos = numero === null;
  const nada = numero === 0;
  return (
    <Link
      href={href}
      className="group flex rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Card
        className={cn(
          "flex w-full flex-col gap-2 py-4 transition-shadow group-hover:shadow-md",
          !sinDatos && !nada && tono === "rojo" && "border-rose-300/70 dark:border-rose-900",
          !sinDatos && !nada && tono === "ambar" && "border-amber-300/70 dark:border-amber-900"
        )}
      >
        <CardContent className="flex flex-1 flex-col px-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {titulo}
          </p>
          <p
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
          >
            {sinDatos ? "—" : numero}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {sinDatos ? "Sin datos de Cars ahora mismo." : nada ? vacio : `${unidad} ${frase}`}
          </p>
          {items.length > 0 && (
            <ul className="mt-2 flex flex-col gap-0.5 text-xs">
              {items.map((it) => (
                <li key={it} className="truncate font-medium" title={it}>{it}</li>
              ))}
            </ul>
          )}
          <span className="mt-auto pt-2 text-xs font-medium text-primary">Ver →</span>
        </CardContent>
      </Card>
    </Link>
  );
}
