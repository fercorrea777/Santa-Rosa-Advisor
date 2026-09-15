import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Marca } from "@/components/dashboard/logo-marca";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { NotaDato, PageHeader } from "@/components/dashboard/page-header";
import { Pagina } from "@/components/movimiento/pagina";
import { FiltroPeriodo } from "@/components/dashboard/filtro-periodo";
import { Seccion } from "@/components/dashboard/seccion";
import { EscaleraPreciosChart, type PeldanoPrecio } from "@/components/charts/escalera-precios-chart";
import { TablaPortafolio, type FilaPortafolio } from "@/components/dashboard/tabla-portafolio";
import {
  getCobertura, getKpi, getOpcionesFiltro, getRankingMarcas, getRankingModelos, getVersionesPorModelo,
  totalUnidades,
} from "@/lib/cadam/mercado";
import { asignarPrecios, fichasDeModelos, type PrecioCandidato } from "@/lib/cadam/bandas";
import { getMarcasPropiasSet } from "@/lib/cadam/config";
import { getStockPropio } from "@/lib/informes/propios";
import { getPreciosCompetencia } from "@/lib/informes/precios-competencia";
import { tokens } from "@/lib/informes/segmento-version";
import { formatPct, formatUnidades } from "@/lib/format";
import { etiquetaCorte, etiquetaPeriodo, filtroDesdeUrl, type SearchParams } from "@/lib/periodo";

/**
 * Portafolio por marca: la gama de UNA marca, modelo por modelo, con
 * precio de lista. Pedido de Fernando (15/09/2026): "crear uno donde
 * podamos ver por line up o portafolio de modelos de cada marca, con
 * precio". Gama propia hace esto para nuestras marcas desde Cars; esta
 * pantalla lo hace para cualquier marca del mercado.
 *
 * FUENTES. Modelos y unidades: CADAM (matriculación, y la importación
 * cruzada por nombre). Precios: CADAM no trae importes; los nuestros salen
 * del stock de Cars y los de la competencia del catálogo de Datacar que
 * releva Hermes. Un modelo sin precio en ninguna fuente se muestra igual,
 * con el precio vacío: la gama es la gama, tenga o no precio cargado.
 */
export default async function PortafolioPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const cobertura = getCobertura();
  const f = filtroDesdeUrl(sp, cobertura.matriculacion.ultimo);
  const periodo = etiquetaPeriodo(f.anio, f.mesDesde, f.mesHasta);
  const opciones = getOpcionesFiltro();
  const propias = getMarcasPropiasSet();

  // Sin marca en la URL, la propia que más vende EN EL PERÍODO: es nuestro
  // tablero y la primera pregunta es cómo está armada nuestra gama. El
  // desplegable ofrece todas, de más a menos unidades.
  const marca =
    (f.marca && opciones.marcas.includes(f.marca) ? f.marca : undefined) ??
    getRankingMarcas("matriculacion", { ...f, marca: undefined }).find((m) => m.esPropia)?.marca ??
    opciones.marcas[0];
  const fm = { ...f, marca, modelo: undefined, version: undefined };

  const mesMax: Record<number, number> = {};
  for (const a of cobertura.matriculacion.anios) {
    mesMax[a] = a === cobertura.matriculacion.ultimo?.anio ? cobertura.matriculacion.ultimo.mes : 12;
  }

  // --- la gama: modelos matriculados, con su precio ------------------------
  const modelos = getRankingModelos("matriculacion", fm, 300);
  const kpiMat = getKpi("matriculacion", fm);
  const kpiImp = getKpi("importacion", fm);
  const mercado = totalUnidades("matriculacion", { ...fm, marca: undefined });
  const versionesPorModelo = getVersionesPorModelo(fm);

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
  // entero, porque los rivales son de otras marcas.
  const universo = asignarPrecios(
    getRankingModelos("matriculacion", { ...fm, marca: undefined }, 3000),
    listasPrecio
  );
  const fichas = fichasDeModelos(universo);

  // --- importación cruzada por nombre ---------------------------------------
  // Las dos bases escriben el modelo distinto ("COROLLA CROSS" en las dos,
  // pero "HILUX" contra "HILUX D/C"…): se cruza por nombre normalizado y,
  // si no, por el mismo conjunto de palabras. Lo que no cruza se informa
  // como total aparte, no se inventa a qué modelo va.
  const importados = getRankingModelos("importacion", fm, 300);
  const clave = (s: string) => tokens(s).join(" ");
  const importPorClave = new Map<string, number>();
  for (const i of importados) {
    const k = clave(i.modelo ?? "");
    importPorClave.set(k, (importPorClave.get(k) ?? 0) + i.unidades);
  }
  const cruzadas = new Set<string>();
  const filas: FilaPortafolio[] = gama.map((m) => {
    const k = clave(m.modelo);
    let importadas: number | null = null;
    if (importPorClave.has(k)) {
      importadas = importPorClave.get(k) ?? null;
      cruzadas.add(k);
    }
    return {
      modelo: m.modelo,
      clase: m.clase,
      claseInferida: m.claseOrigen !== "catalogo",
      tecnologia: m.tecnologia,
      unidades: m.unidades,
      participacion: kpiMat.valor ? m.unidades / kpiMat.valor : 0,
      variacion: m.variacion,
      importadas,
      versionesDnra: versionesPorModelo.get(m.modelo) ?? 0,
      precioDesde: m.precio,
      precioHasta: m.precioHasta,
      precioDeFamilia: m.precioDeFamilia,
      versionesConPrecio: m.versionesConPrecio,
      fuentePrecio: m.fuentePrecio,
      banda: m.banda,
    };
  });
  const importSinCruce = importados
    .filter((i) => !cruzadas.has(clave(i.modelo ?? "")))
    .reduce((s, i) => s + i.unidades, 0);
  const importSinCruceModelos = importados
    .filter((i) => !cruzadas.has(clave(i.modelo ?? "")))
    .map((i) => `${i.modelo} (${formatUnidades(i.unidades)})`);

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
    if (acumulado >= 0.8 * kpiMat.valor) break;
    acumulado += r.unidades;
    modelos80++;
  }

  return (
    <Pagina>
      <PageHeader
        titulo="Portafolio por marca"
        descripcion={`La gama de una marca, modelo por modelo: cuánto vende cada uno, cuánto entró al país y a qué precio de lista · ${periodo}.`}
        fuente={`Fuente: CADAM / DNRA · datos hasta ${etiquetaCorte(cobertura.snapshot)} · precios: ${fuentesUsadas.length ? fuentesUsadas.map((x) => (x === "cars" ? "stock de Cars" : "catálogo Datacar")).join(" y ") : "sin fuente con precio para esta marca"}.`}
      />

      <FiltroPeriodo
        anios={cobertura.matriculacion.anios}
        mesMaximoPorAnio={mesMax}
        opciones={[{ param: "marca", label: "Marca", valores: opciones.marcas }]}
      />

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
          periodo={periodo}
          tooltip={`Chapas puestas de ${marca} en el período, contra el mismo período de ${f.anio - 1}.`}
        />
        <KpiCard
          label="Importaciones"
          value={formatUnidades(kpiImp.valor)}
          variacion={kpiImp.variacion}
          periodo={periodo}
          tooltip={`Unidades de ${marca} que entraron al país en el período. Lo que importa y no matricula es stock en camino.`}
        />
        <KpiCard
          label="Participación de mercado"
          value={mercado ? formatPct(kpiMat.valor / mercado) : "—"}
          periodo={`de ${formatUnidades(mercado)} u. del mercado`}
          tooltip="Matriculaciones de la marca sobre todas las del período."
        />
        <KpiCard
          label="Modelos en la gama"
          value={String(filas.length)}
          periodo={filas.length ? `${modelos80} hacen el 80% de la marca` : undefined}
          tooltip="Modelos con al menos una matriculación en el período. Cuántos de ellos concentran el 80% de las unidades dice si la marca depende de uno o dos."
        />
        <KpiCard
          label="Rango de precios"
          value={desdeGama !== null ? `${formatUnidades(Math.round(desdeGama / 1000))}–${formatUnidades(Math.round((hastaGama ?? desdeGama) / 1000))}k` : "—"}
          periodo={desdeGama !== null ? `US$ · ${conPrecio.length} de ${filas.length} modelos con precio (${formatPct(kpiMat.valor ? uConPrecio / kpiMat.valor : 0)} de las unidades)` : "sin precio de lista"}
          tooltip="De la versión más barata a la más cara de toda la gama, según las listas cargadas (Cars para las propias, Datacar para el resto)."
        />
      </section>

      <Seccion
        titulo="Escalera de precios"
        nota="Cada barra va de la versión más barata a la más cara del modelo, en US$ de lista. Cuanto más pleno el color, más vende. Los huecos entre barras son huecos de la gama; las barras que se pisan, modelos que compiten entre sí."
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
            <EscaleraPreciosChart filas={escalera} />
          </CardContent>
        </Card>
      </Seccion>

      <Seccion
        titulo="La gama, modelo por modelo"
        nota="Todos los modelos que la marca matriculó en el período, tengan o no precio. El peso es la parte de cada uno dentro de la marca; la importación se cruza por nombre con la otra base de CADAM."
      >
        <Card>
          <CardHeader>
            <CardTitle>{marca} — {filas.length} modelos · {periodo}</CardTitle>
          </CardHeader>
          <CardContent>
            {filas.length ? (
              <TablaPortafolio marca={marca} filas={filas} fichas={fichas} periodo={periodo} />
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {marca} no tiene matriculaciones en {periodo}.
              </p>
            )}
          </CardContent>
        </Card>

        {importSinCruce > 0 && (
          <NotaDato>
            <strong>{formatUnidades(importSinCruce)} unidades importadas</strong> de {marca} no
            cruzan con ningún modelo matriculado por nombre y no se atribuyen a
            ninguna fila: {importSinCruceModelos.slice(0, 8).join(", ")}
            {importSinCruceModelos.length > 8 ? "…" : ""}. Suelen ser modelos que
            todavía no sacaron chapa o que la DNRA escribe con otro nombre.
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
