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
import { getGamaPropiaDesdeCars } from "@/lib/cadam/precios-cars";
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

  // DOS FUENTES DE PRECIO, con prioridad explicita:
  //
  //  1. La lista cargada a mano (`precio_modelo`), si existe. Alguien la subio
  //     a proposito para un periodo: eso gana.
  //  2. El stock de Cars, que se sincroniza solo cada 4 horas.
  //
  // Antes solo existia la primera, y como nadie la subio nunca la pantalla
  // llevaba meses mostrando un instructivo en vez de datos — pidiendo a mano
  // un dato que el sistema ya tenia. Ver lib/cadam/precios-cars.ts.
  const listaManual = hayPrecios();
  const periodosLista = getPeriodosPrecio();
  const cars = listaManual ? null : await getGamaPropiaDesdeCars(f);

  const conPrecio = listaManual ? getGamaPropiaConPrecio(f) : (cars?.conPrecio ?? []);
  const sinPrecio = listaManual ? getGamaPropiaSinPrecio(f) : (cars?.sinPrecio ?? []);
  const tienePrecios = conPrecio.length > 0;
  const fuentePrecio = listaManual ? "lista propia cargada" : "stock de Cars";

  const uConPrecio = conPrecio.reduce((s, d) => s + d.unidades, 0);
  const uSinPrecio = sinPrecio.reduce((s, d) => s + d.unidades, 0);
  const uTotal = uConPrecio + uSinPrecio;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        titulo="Gama propia"
        descripcion={`Posicionamiento por precio de los modelos del grupo · matriculaciones · ${periodo}.`}
        fuente={`Fuente: CADAM / DNRA · snapshot ${cobertura.snapshot ?? "—"} · precios: ${fuentePrecio}${cars?.sincronizado ? ` (sinc. ${cars.sincronizado.slice(0, 16)})` : ""}.`}
      />

      <FiltroPeriodo anios={cobertura.matriculacion.anios} mesMaximoPorAnio={mesMax} />

      {!tienePrecios ? (
        // Estado vacío con la instrucción, no una pantalla en blanco: lo que
        // falta es un dato que alguien tiene que cargar, y acá se dice cómo.
        <Card>
          <CardHeader>
            <CardTitle>
              {cars?.error ? "No se pudo leer el stock de Cars" : "Sin precios para este período"}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            <p className="text-muted-foreground">
              {cars?.error ? (
                <>
                  Los precios salen del stock de Cars y la base no respondió:{" "}
                  <code className="rounded bg-muted px-1 py-0.5">{cars.error}</code>.
                  No es que no tengamos precios — es que no se pudieron leer ahora.
                  El resto del tablero no depende de esto.
                </>
              ) : (
                <>
                  Esta vista cruza las unidades de CADAM con el precio de lista.
                  CADAM no trae importes, así que sin precio no hay eje que
                  mostrar. Normalmente el precio sale solo del stock de Cars; si
                  acá no aparece nada, o el período filtrado no tiene ventas del
                  grupo, o el stock todavía no sincronizó.
                </>
              )}
            </p>
            <p className="text-muted-foreground">
              También se puede cargar una lista a mano, que tiene prioridad sobre
              Cars:
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
            {listaManual ? (
              <>
                Precios de la <strong>lista cargada a mano</strong>. Se usa la más
                reciente que no supere el período filtrado
                {periodosLista.length > 0 && <> (cargadas: {periodosLista.join(", ")})</>}.
              </>
            ) : (
              <>
                Precios del <strong>stock de Cars</strong>, nuestro DMS — el mismo
                precio de lista que ve un vendedor, sin subir nada a mano. Cuando
                un modelo tiene varias versiones se toma la más barata: es el
                «desde» de esa gama.
              </>
            )}{" "}
            Esta vista solo cubre las marcas del grupo —{" "}
            <strong>no compara contra la competencia</strong>, porque CADAM no
            trae precios de terceros.
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
              <BurbujasPrecioChart datos={conPrecio} columna="marca" />
            </CardContent>
          </Card>

          {sinPrecio.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Modelos con ventas y sin precio</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="pb-3 text-xs text-muted-foreground">
                  Vendieron en el período pero no tienen precio en la fuente.
                  Se muestran acá en vez de desaparecer del gráfico: es un dato
                  que falta, no un modelo que no existe.{" "}
                  {!listaManual && (
                    <>Son casi todos <strong>camiones</strong> (Fuso, Canter,
                    chasis JAC): Cars no les pone precio de lista porque se
                    cotizan uno por uno.</>
                  )}
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
