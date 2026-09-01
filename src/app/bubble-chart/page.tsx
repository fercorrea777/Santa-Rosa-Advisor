import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NotaDato, PageHeader } from "@/components/dashboard/page-header";
import { FiltroPeriodo } from "@/components/dashboard/filtro-periodo";
import { SelectorFuente } from "@/components/dashboard/selector-fuente";
import { BurbujasMarcaChart, type Burbuja } from "@/components/charts/burbujas-marca-chart";
import {
  getCobertura, getOpcionesFiltro, getRankingModelos, type Fuente,
} from "@/lib/cadam/mercado";
import { formatPct } from "@/lib/format";
import { etiquetaPeriodo, filtroDesdeUrl, type SearchParams } from "@/lib/periodo";

/** Unidades mínimas del período anterior para que un modelo entre al
 *  gráfico. Es lo que hace legible el eje, no un capricho: sobre los datos
 *  de Ene–Jun 2026 el universo completo llega a +8700% (un modelo que pasó
 *  de 1 a 88 unidades) y aplasta a los otros 370 contra el piso. Con base
 *  ≥20 el rango cae a ~555% conservando el 87% del volumen. */
const BASE_MINIMA = 20;

/** Marcas por volumen que se grafican. Sin tope entraban ~40 columnas en
 *  860px: etiquetas ilegibles y una cola de marcas con una burbuja suelta
 *  cada una. Las propias entran SIEMPRE, aunque no lleguen al tope. */
const TOPE_MARCAS = 15;

/** Techo del eje de variación, en %. Sobre Ene–Jun 2026 la mediana es +36% y
 *  el percentil 90 es +127%, pero el máximo llega a +555% (CHERY T2): sin
 *  techo, 91 de las 97 burbujas quedan aplastadas contra la línea del 0%.
 *  Cortando en 150 se recupera ~4x de alto útil y solo 6 quedan en el borde,
 *  dibujadas como triángulo y con su valor real en el tooltip.
 *
 *  No hace falta piso: una caída no puede pasar de -100%. */
const TECHO_VARIACION = 150;

export default async function BubbleChartPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const fuente: Fuente = sp.fuente === "importacion" ? "importacion" : "matriculacion";
  const cobertura = getCobertura();
  const ultimo = fuente === "importacion"
    ? cobertura.importacion.ultimo
    : cobertura.matriculacion.ultimo;
  const f = filtroDesdeUrl(sp, ultimo);
  const periodo = etiquetaPeriodo(f.anio, f.mesDesde, f.mesHasta);
  const etiquetaFuente = fuente === "importacion" ? "importaciones" : "matriculaciones";

  const anios = fuente === "importacion"
    ? cobertura.importacion.anios
    : cobertura.matriculacion.anios;
  const mesMax: Record<number, number> = {};
  for (const a of anios) {
    mesMax[a] = a === ultimo?.anio ? ultimo.mes : 12;
  }

  const modelos = getRankingModelos(fuente, f, 600);

  // Solo entran los que tienen base comparable Y la superan. `variacion`
  // viene null cuando el modelo no existía el año anterior: esos no se
  // pueden ubicar en un eje de porcentaje, no se estiman.
  const conBase = modelos.filter(
    (m) => m.variacion !== null && m.unidadesAnterior >= BASE_MINIMA
  );

  // Top de marcas por volumen dentro de lo comparable, MÁS las propias
  // siempre. No es un capricho: con los datos de Ene–Jun 2026, MITSUBISHI
  // queda 17ª y RENAULT más abajo — un top 15 estricto dejaba el tablero de
  // Santa Rosa sin sus propias marcas.
  const volPorMarca = new Map<string, number>();
  for (const m of conBase) {
    volPorMarca.set(m.marca, (volPorMarca.get(m.marca) ?? 0) + m.unidades);
  }
  const topMarcas = [...volPorMarca.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, TOPE_MARCAS)
    .map(([marca]) => marca);
  const marcasVisibles = new Set([
    ...topMarcas,
    ...conBase.filter((m) => m.esPropia).map((m) => m.marca),
  ]);
  const visibles = conBase.filter((m) => marcasVisibles.has(m.marca));

  const datos: Burbuja[] = visibles.map((m) => ({
    marca: m.marca,
    modelo: m.modelo ?? m.marca,
    unidades: m.unidades,
    unidadesAnterior: m.unidadesAnterior,
    variacion: m.variacion as number,
    esPropia: m.esPropia,
  }));

  const volTotal = modelos.reduce((s, m) => s + m.unidades, 0);
  const volGraficado = visibles.reduce((s, m) => s + m.unidades, 0);
  const entrantes = modelos.filter((m) => m.variacion === null).length;
  const bajoBase = modelos.length - conBase.length - entrantes;
  const fueraDelTope = conBase.length - visibles.length;
  const propiasForzadas = [...marcasVisibles].filter(
    (m) => !topMarcas.includes(m)
  );
  const recortadas = datos.filter((d) => d.variacion * 100 > TECHO_VARIACION);

  const opciones = getOpcionesFiltro();

  // La lista de modelos sale de los datos ya filtrados, no de un catálogo
  // fijo: al elegir una marca (o un segmento) el desplegable se achica solo
  // a los modelos que existen en ese corte, en vez de ofrecer 600 sueltos.
  // Vienen ordenados por volumen porque getRankingModelos ya rankea.
  const modelosDisponibles = [
    ...new Set(modelos.map((m) => m.modelo).filter((m): m is string => !!m)),
  ];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        titulo="Bubble chart"
        descripcion={`Cada burbuja es un modelo, agrupado en la columna de su marca · ${etiquetaFuente} · ${periodo} vs. mismo período ${f.anio - 1}.`}
        fuente={`Fuente: CADAM / DNRA · snapshot ${cobertura.snapshot ?? "—"}.`}
      />

      <div className="-mx-1 flex flex-col gap-3 rounded-xl px-1 py-1 sm:sticky sm:top-16 sm:z-30 sm:flex-row sm:flex-wrap sm:items-end sm:bg-background/85 sm:backdrop-blur-md">
        <SelectorFuente fuente={fuente} />
        <div className="min-w-0 sm:flex-1">
          <FiltroPeriodo
            pegajoso={false}
            anios={anios}
            mesMaximoPorAnio={mesMax}
            opciones={[
              { param: "marca", label: "Marca", valores: opciones.marcas },
              { param: "modelo", label: "Modelo", valores: modelosDisponibles },
              { param: "segmento", label: "Segmento", valores: opciones.segmentos },
              ...(fuente === "importacion"
                ? []
                : [{
                    param: "tecnologia",
                    label: "Tecnología",
                    valores: ["ICE", "MHEV", "HEV", "PHEV", "REEV", "EV"],
                  }]),
            ]}
          />
        </div>
      </div>

      <NotaDato>
        El eje vertical es la <strong>variación %</strong>, no el precio: la base
        de CADAM trae unidades, no importes. Como el porcentaje se dispara sobre
        bases chicas, sólo entran los modelos con al menos{" "}
        <strong>{BASE_MINIMA} unidades</strong> en {f.anio - 1}, y sólo las{" "}
        <strong>{TOPE_MARCAS} marcas de mayor volumen</strong>
        {propiasForzadas.length > 0 && (
          <> más las propias ({propiasForzadas.join(", ")}), que entran siempre</>
        )}
        . Se grafican <strong>{visibles.length}</strong> de {modelos.length}{" "}
        modelos, el{" "}
        <strong>{volTotal ? formatPct(volGraficado / volTotal) : "—"}</strong> del
        volumen del período. Fuera quedan {entrantes} modelos nuevos (sin año
        anterior contra qué comparar), {bajoBase} por debajo de la base mínima y{" "}
        {fueraDelTope} de marcas que no llegan al tope.
      </NotaDato>

      <Card>
        <CardHeader>
          <CardTitle>Crecimiento por modelo — {etiquetaFuente}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="pb-3 text-xs text-muted-foreground">
            Eje Y = variación contra {f.anio - 1} · tamaño = unidades del período ·
            las marcas propias van primero, con borde y su nombre resaltado en el
            eje. Arriba de la línea del 0% crecen, abajo caen; el tamaño dice
            cuánto pesa ese crecimiento.
            {recortadas.length > 0 && (
              <>
                {" "}El eje corta en +{TECHO_VARIACION}%:{" "}
                <strong>{recortadas.length}</strong>{" "}
                {recortadas.length === 1 ? "modelo se sale" : "modelos se salen"} y
                {recortadas.length === 1 ? " queda dibujado" : " quedan dibujados"}{" "}
                como triángulo en el tope —{" "}
                {[...recortadas]
                  .sort((a, b) => b.variacion - a.variacion)
                  .slice(0, 3)
                  .map((d) => `${d.marca} ${d.modelo} ${formatPct(d.variacion, { signed: true })}`)
                  .join(", ")}
                {recortadas.length > 3 ? " y otros" : ""}. El valor real está en el
                tooltip de cada uno.
              </>
            )}
          </p>
          <BurbujasMarcaChart datos={datos} techo={TECHO_VARIACION} />
        </CardContent>
      </Card>
    </div>
  );
}
