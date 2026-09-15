import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Marca } from "@/components/dashboard/logo-marca";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { NotaDato, PageHeader } from "@/components/dashboard/page-header";
import { Pagina } from "@/components/movimiento/pagina";
import { FiltroPeriodo } from "@/components/dashboard/filtro-periodo";
import { SelectorFuente, type FuenteVista } from "@/components/dashboard/selector-fuente";
import { Seccion } from "@/components/dashboard/seccion";
import { EscaleraPreciosChart, type PeldanoPrecio } from "@/components/charts/escalera-precios-chart";
import { TablaPortafolio, type FilaPortafolio } from "@/components/dashboard/tabla-portafolio";
import {
  getCobertura, getKpi, getOpcionesFiltro, getRankingMarcas, getRankingModelos, getVersionesPorModelo,
  totalUnidades, type Fuente,
} from "@/lib/cadam/mercado";
import { asignarPrecios, fichasDeModelos, type PrecioCandidato } from "@/lib/cadam/bandas";
import { getMarcasPropiasSet } from "@/lib/cadam/config";
import { getStockPropio } from "@/lib/informes/propios";
import { getPreciosCompetencia } from "@/lib/informes/precios-competencia";
import { tokens } from "@/lib/informes/segmento-version";
import { formatPct, formatUnidades } from "@/lib/format";
import {
  etiquetaCortes, etiquetaPeriodo, filtroDesdeUrl, mesCorto, type SearchParams,
} from "@/lib/periodo";

/**
 * Portafolio por marca: la gama de UNA marca, modelo por modelo, con
 * precio de lista. Pedido de Fernando (15/09/2026): "crear uno donde
 * podamos ver por line up o portafolio de modelos de cada marca, con
 * precio". Gama propia hace esto para nuestras marcas desde Cars; esta
 * pantalla lo hace para cualquier marca del mercado.
 *
 * TRES VISTAS (Croman, 15/09/2026: "dame a elegir importaciones o
 * matriculaciones o ambos"). La fuente PRINCIPAL define la lista de
 * modelos, las unidades, el peso y la escalera; la otra va como columna
 * cruzada por nombre. Cada fuente se mide hasta SU último mes publicado:
 * la importación suele ir un mes adelante (el informe de CADAM llega antes
 * que el detalle) y esconder ese mes era esconder el dato más nuevo.
 *
 * FUENTES. Modelos y unidades: CADAM. Precios: CADAM no trae importes; los
 * nuestros salen del stock de Cars y los de la competencia del catálogo de
 * Datacar (datacarpy.com) que releva Hermes. Un modelo sin precio en
 * ninguna fuente se muestra igual, con el precio vacío: la gama es la gama,
 * tenga o no precio cargado.
 */
export default async function PortafolioPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const cobertura = getCobertura();
  const vista: FuenteVista =
    sp.fuente === "importacion" ? "importacion" : sp.fuente === "matriculacion" ? "matriculacion" : "ambas";
  const principal: Fuente = vista === "importacion" ? "importacion" : "matriculacion";
  const secundaria: Fuente | null =
    vista === "ambas" ? "importacion" : vista === "importacion" ? "matriculacion" : null;
  const nombreFuente: Record<Fuente, string> = { matriculacion: "matriculaciones", importacion: "importaciones" };

  // El período lo manda la fuente principal; la otra se recorta o se estira
  // a su propio último mes cuando la URL no fija el "hasta".
  const f = filtroDesdeUrl(sp, cobertura[principal].ultimo);
  const opciones = getOpcionesFiltro();
  const propias = getMarcasPropiasSet();

  const ventanaDe = (fuente: Fuente) => {
    const ult = cobertura[fuente].ultimo;
    if (!ult || f.anio !== ult.anio) return f;
    if (sp.hasta) return f.mesHasta > ult.mes ? { ...f, mesHasta: Math.max(f.mesDesde, ult.mes) } : f;
    return { ...f, mesHasta: Math.max(f.mesDesde, ult.mes) };
  };
  const fMat = ventanaDe("matriculacion");
  const fImp = ventanaDe("importacion");
  const periodoMat = etiquetaPeriodo(fMat.anio, fMat.mesDesde, fMat.mesHasta);
  const periodoImp = etiquetaPeriodo(fImp.anio, fImp.mesDesde, fImp.mesHasta);
  const fPrin = principal === "importacion" ? fImp : fMat;
  const fSec = secundaria === "importacion" ? fImp : fMat;
  const periodoPrin = principal === "importacion" ? periodoImp : periodoMat;
  const periodoSec = secundaria === "importacion" ? periodoImp : periodoMat;

  // Sin marca en la URL, la propia que más vende EN EL PERÍODO: es nuestro
  // tablero y la primera pregunta es cómo está armada nuestra gama. El
  // desplegable ofrece todas, de más a menos unidades.
  const marca =
    (f.marca && opciones.marcas.includes(f.marca) ? f.marca : undefined) ??
    getRankingMarcas(principal, { ...fPrin, marca: undefined }).find((m) => m.esPropia)?.marca ??
    opciones.marcas[0];
  const conMarca = (x: typeof f) => ({ ...x, marca, modelo: undefined, version: undefined });
  const fmPrin = conMarca(fPrin);
  const fmSec = conMarca(fSec);

  const mesMax: Record<number, number> = {};
  for (const a of cobertura[principal].anios) {
    mesMax[a] = a === cobertura[principal].ultimo?.anio ? cobertura[principal].ultimo.mes : 12;
  }

  // Aclaración de hasta dónde llega cada fuente, al lado del selector.
  const ultMat = cobertura.matriculacion.ultimo;
  const ultImp = cobertura.importacion.ultimo;
  const desparejas = !!ultMat && !!ultImp && (ultMat.anio !== ultImp.anio || ultMat.mes !== ultImp.mes);
  const aclaracion = desparejas && ultMat && ultImp
    ? `Matriculaciones hasta ${mesCorto(ultMat.mes)} · importaciones hasta ${mesCorto(ultImp.mes)}: CADAM ya publicó la importación de ${mesCorto(ultImp.mes)}, la matriculación de ese mes todavía no.`
    : undefined;

  // --- la gama: modelos de la fuente principal, con su precio ---------------
  const modelos = getRankingModelos(principal, fmPrin, 300);
  const kpiMat = getKpi("matriculacion", conMarca(fMat));
  const kpiImp = getKpi("importacion", conMarca(fImp));
  const kpiPrin = principal === "importacion" ? kpiImp : kpiMat;
  const mercado = totalUnidades(principal, { ...fmPrin, marca: undefined });
  const versionesPorModelo = principal === "matriculacion" ? getVersionesPorModelo(fmPrin) : null;

  let preciosPropios: PrecioCandidato[] = [];
  try {
    preciosPropios = (await getStockPropio())
      .filter((s) => s.precio_usd)
      .map((s) => ({ marca: s.marca, nombre: s.version, precio: s.precio_usd as number }));
  } catch {
    preciosPropios = [];
  }
  const preciosRivales: PrecioCandidato[] = (await getPreciosCompetencia())
    .map((p) => ({ marca: p.marca, nombre: p.version, precio: p.precio_usd }));
  const listasPrecio = [
    { fuente: "cars", lista: preciosPropios },
    { fuente: "datacar", lista: preciosRivales },
  ];
  const gama = asignarPrecios(modelos, listasPrecio);

  // Ficha de cada modelo (rivales de clase): se arma sobre el mercado
  // entero de la MISMA fuente, porque los rivales son de otras marcas y
  // las dos bases escriben los modelos distinto.
  const universo = asignarPrecios(
    getRankingModelos(principal, { ...fmPrin, marca: undefined }, 3000),
    listasPrecio
  );
  const fichas = fichasDeModelos(universo);

  // --- la otra fuente, cruzada por nombre ------------------------------------
  // Las dos bases escriben el modelo distinto ("COROLLA CROSS" en las dos,
  // pero "HILUX" contra "HILUX D/C"…): se cruza por las mismas palabras. Lo
  // que no cruza se informa como total aparte, no se inventa a qué modelo va.
  const otros = secundaria ? getRankingModelos(secundaria, fmSec, 300) : [];
  const clave = (s: string) => tokens(s).join(" ");
  const otrosPorClave = new Map<string, number>();
  for (const o of otros) {
    const k = clave(o.modelo ?? "");
    otrosPorClave.set(k, (otrosPorClave.get(k) ?? 0) + o.unidades);
  }
  const cruzadas = new Set<string>();
  const filas: FilaPortafolio[] = gama.map((m) => {
    const k = clave(m.modelo);
    let otras: number | null = null;
    if (secundaria && otrosPorClave.has(k)) {
      otras = otrosPorClave.get(k) ?? null;
      cruzadas.add(k);
    }
    return {
      modelo: m.modelo,
      clase: m.clase,
      claseInferida: m.claseOrigen !== "catalogo",
      tecnologia: m.tecnologia,
      unidades: m.unidades,
      participacion: kpiPrin.valor ? m.unidades / kpiPrin.valor : 0,
      variacion: m.variacion,
      otras,
      versionesDnra: versionesPorModelo ? (versionesPorModelo.get(m.modelo) ?? 0) : null,
      precioDesde: m.precio,
      precioHasta: m.precioHasta,
      precioDeFamilia: m.precioDeFamilia,
      versionesConPrecio: m.versionesConPrecio,
      fuentePrecio: m.fuentePrecio,
      banda: m.banda,
    };
  });
  const sinCruce = otros.filter((o) => !cruzadas.has(clave(o.modelo ?? "")));
  const sinCruceTotal = sinCruce.reduce((s, o) => s + o.unidades, 0);
  const sinCruceModelos = sinCruce.map((o) => `${o.modelo} (${formatUnidades(o.unidades)})`);

  // --- resumen ---------------------------------------------------------------
  const conPrecio = filas.filter((r) => r.precioDesde !== null);
  const desdeGama = conPrecio.length ? Math.min(...conPrecio.map((r) => r.precioDesde as number)) : null;
  const hastaGama = conPrecio.length
    ? Math.max(...conPrecio.map((r) => Math.max(r.precioHasta ?? 0, r.precioDesde ?? 0)))
    : null;
  const uConPrecio = conPrecio.reduce((s, r) => s + r.unidades, 0);
  const fuentesUsadas = [...new Set(conPrecio.map((r) => r.fuentePrecio).filter(Boolean))] as string[];
  // La escalera solo con precio PROPIO: una variante que toma el "desde" de
  // su familia dibujaría una barra idéntica a la de la familia, y tres
  // barras iguales no son tres modelos.
  const escalera: PeldanoPrecio[] = conPrecio.filter((r) => !r.precioDeFamilia).map((r) => ({
    modelo: r.modelo,
    desde: r.precioDesde as number,
    hasta: Math.max(r.precioHasta ?? 0, r.precioDesde as number),
    versiones: r.versionesConPrecio,
    unidades: r.unidades,
    clase: r.clase,
  }));

  // Concentración: cuántos modelos hacen el 80% de la marca. Una gama de
  // doce modelos donde dos hacen el 80% es otra cosa que una pareja.
  const ordenados = [...filas].sort((a, b) => b.unidades - a.unidades);
  let acumulado = 0;
  let modelos80 = 0;
  for (const r of ordenados) {
    if (acumulado >= 0.8 * kpiPrin.valor) break;
    acumulado += r.unidades;
    modelos80++;
  }

  const verbo = principal === "importacion" ? "entró al país" : "matriculó";

  return (
    <Pagina>
      <PageHeader
        titulo="Portafolio por marca"
        descripcion={`La gama de una marca, modelo por modelo: cuánto vende cada uno, cuánto entró al país y a qué precio de lista · ${nombreFuente[principal]} ${periodoPrin}${secundaria ? ` · ${nombreFuente[secundaria]} ${periodoSec}` : ""}.`}
        fuente={`Fuente: CADAM / DNRA · ${etiquetaCortes(cobertura)} · precios: ${fuentesUsadas.length ? fuentesUsadas.map((x) => (x === "cars" ? "stock de Cars" : "catálogo Datacar")).join(" y ") : "sin fuente con precio para esta marca"}.`}
      />

      <div
        data-revelar=""
        className="-mx-1 flex flex-col gap-3 rounded-xl px-1 py-1 sm:sticky sm:top-16 sm:z-30 sm:flex-row sm:flex-wrap sm:items-start sm:bg-background/85 sm:backdrop-blur-md"
      >
        <SelectorFuente fuente={vista} conAmbas aclaracion={aclaracion} />
        <div className="min-w-0 sm:flex-1">
          <FiltroPeriodo
            pegajoso={false}
            anios={cobertura[principal].anios}
            mesMaximoPorAnio={mesMax}
            opciones={[{ param: "marca", label: "Marca", valores: opciones.marcas }]}
          />
        </div>
      </div>

      <section className="flex flex-wrap items-center gap-3">
        <Marca marca={marca} tamano="lg" claseNombre="text-2xl font-extrabold tracking-tight" />
        {propias.has(marca) && (
          <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
            marca propia
          </span>
        )}
      </section>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <KpiCard
          label="Matriculaciones"
          value={formatUnidades(kpiMat.valor)}
          variacion={kpiMat.variacion}
          periodo={periodoMat}
          tono={principal === "matriculacion" ? "azul" : undefined}
          tooltip={`Chapas puestas de ${marca} en ${periodoMat}, contra el mismo período de ${f.anio - 1}.`}
        />
        <KpiCard
          label="Importaciones"
          value={formatUnidades(kpiImp.valor)}
          variacion={kpiImp.variacion}
          periodo={periodoImp}
          tono={principal === "importacion" ? "verde" : undefined}
          tooltip={`Unidades de ${marca} que entraron al país en ${periodoImp}, contra el mismo período de ${f.anio - 1}. Lo que importa y no matricula es stock en camino.${desparejas && ultImp ? ` La importación ya tiene ${mesCorto(ultImp.mes)}; la matriculación de ese mes CADAM todavía no la publicó.` : ""}`}
        />
        <KpiCard
          label="Participación de mercado"
          value={mercado ? formatPct(kpiPrin.valor / mercado) : "—"}
          periodo={`de ${formatUnidades(mercado)} u. ${nombreFuente[principal]} · ${periodoPrin}`}
          tooltip={`${principal === "importacion" ? "Importaciones" : "Matriculaciones"} de la marca sobre todas las del período.`}
        />
        <KpiCard
          label="Modelos en la gama"
          value={String(filas.length)}
          periodo={filas.length ? `${modelos80} hacen el 80% de la marca` : undefined}
          tooltip={`Modelos con al menos una unidad en ${nombreFuente[principal]} del período. Cuántos de ellos concentran el 80% de las unidades dice si la marca depende de uno o dos.`}
        />
        <KpiCard
          label="Rango de precios"
          value={desdeGama !== null ? `${formatUnidades(Math.round(desdeGama / 1000))}–${formatUnidades(Math.round((hastaGama ?? desdeGama) / 1000))}k` : "—"}
          periodo={desdeGama !== null ? `US$ · ${conPrecio.length} de ${filas.length} modelos con precio (${formatPct(kpiPrin.valor ? uConPrecio / kpiPrin.valor : 0)} de las unidades)` : "sin precio de lista"}
          tooltip="De la versión más barata a la más cara de toda la gama, según las listas cargadas (Cars para las propias, Datacar para el resto)."
        />
      </section>

      <Seccion
        titulo="Escalera de precios"
        nota="Cada barra va de la versión más barata a la más cara del modelo, en US$ de lista. Cuanto más pleno el color, más unidades. Los huecos entre barras son huecos de la gama; las barras que se pisan, modelos que compiten entre sí."
      >
        <Card>
          <CardHeader>
            <CardTitle>{marca} — dónde se para cada modelo</CardTitle>
            <p className="text-xs text-muted-foreground">
              Solo los modelos con precio propio en alguna fuente (las variantes que
              toman el precio de su familia van en la tabla, con «≈»). Pasá el mouse
              por una barra para ver el rango, las versiones y las unidades.
            </p>
          </CardHeader>
          <CardContent>
            <EscaleraPreciosChart filas={escalera} etiquetaUnidades={nombreFuente[principal]} />
          </CardContent>
        </Card>
      </Seccion>

      <Seccion
        titulo="La gama, modelo por modelo"
        nota={`Todos los modelos que la marca ${verbo} en ${periodoPrin}, tengan o no precio. El peso es la parte de cada uno dentro de la marca${secundaria ? `; la columna de ${nombreFuente[secundaria]} (${periodoSec}) se cruza por nombre con la otra base de CADAM` : ""}.`}
      >
        <Card>
          <CardHeader>
            <CardTitle>{marca} — {filas.length} modelos · {nombreFuente[principal]} {periodoPrin}</CardTitle>
          </CardHeader>
          <CardContent>
            {filas.length ? (
              <TablaPortafolio
                marca={marca}
                filas={filas}
                fichas={fichas}
                principal={principal}
                secundaria={secundaria}
                periodo={periodoPrin}
                periodoSec={periodoSec}
              />
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {marca} no tiene {nombreFuente[principal]} en {periodoPrin}.
              </p>
            )}
          </CardContent>
        </Card>

        {secundaria && sinCruceTotal > 0 && (
          <NotaDato>
            <strong>{formatUnidades(sinCruceTotal)} unidades de {nombreFuente[secundaria]}</strong> de {marca} ({periodoSec}) no
            cruzan con ningún modelo de la tabla por nombre y no se atribuyen a
            ninguna fila: {sinCruceModelos.slice(0, 8).join(", ")}
            {sinCruceModelos.length > 8 ? "…" : ""}.{" "}
            {secundaria === "importacion"
              ? "Suelen ser modelos que todavía no sacaron chapa o que la DNRA escribe con otro nombre."
              : "Suelen ser modelos que ya no se importan o que las dos bases escriben distinto."}
          </NotaDato>
        )}

        <NotaDato>
          CADAM no publica precios. Los de nuestras marcas salen del stock de Cars
          y los de la competencia del catálogo de Datacar; un modelo sin precio en
          ninguna de las dos queda con el precio vacío, nunca inventado. El rango
          toma las versiones que llevan el nombre del modelo, así que «desde»
          puede no coincidir con la versión más vendida. Para ver contra quién
          compite cada modelo, tocá su fila; para la vista de precio contra
          volumen de toda la clase, está el{" "}
          <Link href={`/bubble-chart?marca=${encodeURIComponent(marca)}`} className="underline underline-offset-4">
            Bubble chart
          </Link>
          .
        </NotaDato>
      </Seccion>
    </Pagina>
  );
}
