import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NotaDato, PageHeader } from "@/components/dashboard/page-header";
import { FiltroPeriodo } from "@/components/dashboard/filtro-periodo";
import { BurbujasPrecioChart } from "@/components/charts/burbujas-precio-chart";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { getCobertura } from "@/lib/cadam/mercado";
import {
  getGamaPropiaConPrecio, getGamaPropiaSinPrecio, getPeriodosPrecio, hayPrecios,
} from "@/lib/cadam/precios";
import { formatPct, formatUnidades } from "@/lib/format";
import { etiquetaPeriodo, filtroDesdeUrl, type SearchParams } from "@/lib/periodo";

export default async function GamaPropiaPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const cobertura = getCobertura();
  const f = filtroDesdeUrl(sp, cobertura.matriculacion.ultimo);
  const periodo = etiquetaPeriodo(f.anio, f.mesDesde, f.mesHasta);

  const mesMax: Record<number, number> = {};
  for (const a of cobertura.matriculacion.anios) {
    mesMax[a] = a === cobertura.matriculacion.ultimo?.anio
      ? cobertura.matriculacion.ultimo.mes : 12;
  }

  const tienePrecios = hayPrecios();
  const conPrecio = getGamaPropiaConPrecio(f);
  const sinPrecio = getGamaPropiaSinPrecio(f);
  const periodosLista = getPeriodosPrecio();

  const uConPrecio = conPrecio.reduce((s, d) => s + d.unidades, 0);
  const uSinPrecio = sinPrecio.reduce((s, d) => s + d.unidades, 0);
  const uTotal = uConPrecio + uSinPrecio;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        titulo="Gama propia"
        descripcion={`Posicionamiento por precio de los modelos del grupo · matriculaciones · ${periodo}.`}
        fuente={`Fuente: CADAM / DNRA · snapshot ${cobertura.snapshot ?? "—"} · precios: lista propia.`}
      />

      <FiltroPeriodo anios={cobertura.matriculacion.anios} mesMaximoPorAnio={mesMax} />

      {!tienePrecios ? (
        // Estado vacío con la instrucción, no una pantalla en blanco: lo que
        // falta es un dato que alguien tiene que cargar, y acá se dice cómo.
        <Card>
          <CardHeader>
            <CardTitle>Falta la lista de precios</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            <p className="text-muted-foreground">
              Esta vista cruza las unidades de CADAM con la lista de precios
              propia. CADAM no trae importes, así que sin esa lista no hay eje
              de precio que mostrar. Se carga una vez por período:
            </p>
            <div className="flex flex-col gap-1 rounded-md bg-muted/50 p-2 font-mono text-xs">
              <span>cd CADAM/scripts</span>
              <span>python3 ingest_precios.py lista.xlsx --periodo {`${f.anio}-${String(f.mesHasta).padStart(2, "0")}`} --dry-run</span>
              <span className="text-muted-foreground"># revisar lo que detectó, y sin --dry-run para cargar</span>
            </div>
            <p className="text-muted-foreground">
              El archivo puede ser .xlsx, .xls o .csv, con columnas de marca,
              modelo y precio — los títulos se detectan por alias. Hay una
              plantilla en{" "}
              <code className="rounded bg-muted px-1 py-0.5">CADAM/plantilla-precios.csv</code>.
            </p>
            {sinPrecio.length > 0 && (
              <p className="text-muted-foreground">
                Mientras tanto, el grupo tiene{" "}
                <strong>{sinPrecio.length} modelos</strong> con ventas en el
                período ({formatUnidades(uSinPrecio)} u.) esperando precio.
              </p>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          <NotaDato>
            Los precios salen de la lista propia, así que esta vista solo cubre
            las marcas del grupo — <strong>no compara contra la competencia</strong>,
            porque CADAM no trae precios de terceros. Se usa la lista más
            reciente que no supere el período filtrado
            {periodosLista.length > 0 && <> (cargadas: {periodosLista.join(", ")})</>}.
            {uTotal > 0 && (
              <>
                {" "}Con precio: <strong>{formatUnidades(uConPrecio)} u.</strong>{" "}
                ({formatPct(uConPrecio / uTotal)} de lo que vendió el grupo en el
                período).
              </>
            )}
          </NotaDato>

          <Card>
            <CardHeader>
              <CardTitle>Precio vs. volumen — gama propia</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="pb-3 text-xs text-muted-foreground">
                Cada burbuja es un modelo, en la columna de su marca · eje Y =
                precio de lista · tamaño = unidades del período. La línea
                punteada es el precio <strong>ponderado por unidades</strong>, no
                el promedio simple: un modelo que vendió 3 no puede pesar lo
                mismo que uno que vendió 300.
              </p>
              <BurbujasPrecioChart datos={conPrecio} />
            </CardContent>
          </Card>

          {sinPrecio.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Modelos con ventas y sin precio en la lista</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="pb-3 text-xs text-muted-foreground">
                  Vendieron en el período pero no figuran en ninguna lista
                  aplicable. Se muestran acá en vez de desaparecer del gráfico:
                  es un dato que falta, no un modelo que no existe.
                </p>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Marca</TableHead>
                      <TableHead>Modelo</TableHead>
                      <TableHead className="text-right">Unidades</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sinPrecio.slice(0, 30).map((d) => (
                      <TableRow key={`${d.marca}-${d.modelo}`}>
                        <TableCell>{d.marca}</TableCell>
                        <TableCell>{d.modelo}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatUnidades(d.unidades)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
