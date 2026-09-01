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

export default async function PosicionamientoPage({
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
  const datos: Burbuja[] = conBase.map((m) => ({
    marca: m.marca,
    modelo: m.modelo ?? m.marca,
    unidades: m.unidades,
    unidadesAnterior: m.unidadesAnterior,
    variacion: m.variacion as number,
    esPropia: m.esPropia,
  }));

  const volTotal = modelos.reduce((s, m) => s + m.unidades, 0);
  const volGraficado = conBase.reduce((s, m) => s + m.unidades, 0);
  const entrantes = modelos.filter((m) => m.variacion === null).length;
  const bajoBase = modelos.length - conBase.length - entrantes;

  const opciones = getOpcionesFiltro();

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        titulo="Posicionamiento"
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
        <strong>{BASE_MINIMA} unidades</strong> en {f.anio - 1}. Quedan{" "}
        <strong>{conBase.length}</strong> de {modelos.length} modelos, que son el{" "}
        <strong>{volTotal ? formatPct(volGraficado / volTotal) : "—"}</strong> del
        volumen del período. Fuera quedan {entrantes} modelos nuevos (sin año
        anterior contra qué comparar) y {bajoBase} por debajo de la base mínima.
      </NotaDato>

      <Card>
        <CardHeader>
          <CardTitle>Crecimiento por modelo — {etiquetaFuente}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="pb-3 text-xs text-muted-foreground">
            Eje Y = variación contra {f.anio - 1} · tamaño = unidades del período ·
            las marcas propias van primero y en color. Arriba de la línea del 0%
            crecen, abajo caen; el tamaño dice cuánto pesa ese crecimiento.
          </p>
          <BurbujasMarcaChart datos={datos} />
        </CardContent>
      </Card>
    </div>
  );
}
