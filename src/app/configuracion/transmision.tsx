import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { getMarcasPropiasSet } from "@/lib/cadam/config";
import { formatUnidades } from "@/lib/format";
import { getVentasPropias } from "@/lib/informes/propios";
import { FAMILIAS, MARCAS_ELECTRICAS, transmisionDe } from "@/lib/informes/transmision";

/**
 * El catálogo de transmisión por familia, a la vista, para que Comercial lo
 * revise. Es lo que la ficha usa cuando el nombre de la versión no dice si
 * es mecánica o automática (Cars no trae la caja como dato, 07/09/2026).
 * Abajo, las versiones nuestras vendidas este año que siguen sin caja
 * conocida: son las que hay que resolver, o nombrando la versión con la caja
 * en Cars o agregando la familia acá.
 */
export async function CatalogoTransmision({ anio }: { anio: number }) {
  const propias = getMarcasPropiasSet();
  const filas = Object.entries(FAMILIAS)
    .map(([clave, transmision]) => {
      const [marca, familia] = clave.split("|");
      return { marca, familia, transmision };
    })
    .sort((a, b) => a.marca.localeCompare(b.marca) || a.familia.localeCompare(b.familia));

  // Versiones propias del año sin transmisión conocida, con lo vendido.
  let sinCaja: { marca: string; version: string; unidades: number }[] = [];
  let totalAnio = 0;
  let errorCars: string | null = null;
  try {
    const ventas = (await getVentasPropias()).filter(
      (v) => v.periodo.startsWith(`${anio}-`) && propias.has(v.marca)
    );
    const porVersion = new Map<string, { marca: string; version: string; unidades: number }>();
    for (const v of ventas) {
      totalAnio += v.unidades;
      const k = `${v.marca}|${v.version}`;
      const x = porVersion.get(k) ?? { marca: v.marca, version: v.version, unidades: 0 };
      x.unidades += v.unidades;
      porVersion.set(k, x);
    }
    sinCaja = [...porVersion.values()]
      .filter((x) => transmisionDe(x.version, x.marca) === null)
      .sort((a, b) => b.unidades - a.unidades);
  } catch (e) {
    errorCars = (e as Error).message;
  }
  const unidadesSinCaja = sinCaja.reduce((s, x) => s + x.unidades, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Transmisión por familia (para revisar)</CardTitle>
        <p className="text-xs text-muted-foreground">
          Las fichas comparan mecánico con mecánico y automático con automático. Cars no
          trae la caja como dato: se lee del nombre de la versión (MT, AT, CVT, DCT…) y, cuando
          el nombre no lo dice, de esta lista. Si algo está mal, se corrige en{" "}
          <code className="rounded bg-muted px-1 py-0.5">src/lib/informes/transmision.ts</code>.
          Las marcas solo eléctricas ({[...MARCAS_ELECTRICAS].filter((m) => propias.has(m)).join(", ") || "—"}
          ) cuentan como automáticas enteras.
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-2 lg:grid-cols-3">
          {filas.map((f) => (
            <div key={`${f.marca}|${f.familia}`} className="flex items-center justify-between border-b py-1">
              <span>
                <span className="font-medium">{f.familia}</span>
                <span className="ml-1.5 text-xs text-muted-foreground">{f.marca}</span>
              </span>
              <span className={f.transmision === "AT" ? "text-xs font-medium" : "text-xs font-medium text-amber-700 dark:text-amber-400"}>
                {f.transmision === "AT" ? "automático" : "mecánico"}
              </span>
            </div>
          ))}
        </div>

        <div>
          <h4 className="text-sm font-semibold">
            Versiones vendidas en {anio} que siguen sin caja conocida
            {totalAnio > 0 && (
              <span className="ml-1 font-normal text-muted-foreground">
                ({formatUnidades(unidadesSinCaja)} de {formatUnidades(totalAnio)} unidades)
              </span>
            )}
          </h4>
          {errorCars ? (
            <p className="mt-1 text-xs text-muted-foreground">Cars no respondió: {errorCars}</p>
          ) : sinCaja.length === 0 ? (
            <p className="mt-1 text-xs text-muted-foreground">Ninguna: todas las versiones tienen caja conocida.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Marca</TableHead>
                  <TableHead>Versión (como la escribe Cars)</TableHead>
                  <TableHead className="text-right">Unidades {anio}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sinCaja.map((x) => (
                  <TableRow key={`${x.marca}|${x.version}`}>
                    <TableCell className="text-xs">{x.marca}</TableCell>
                    <TableCell className="text-xs font-medium">{x.version}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatUnidades(x.unidades)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          <p className="mt-2 text-[11px] text-muted-foreground">
            Estas tienen las dos cajas según la versión (Poer diesel, JAC T8) o son chasis: el
            nombre no lo dice y no se adivina. Se resuelven nombrando la versión con la caja en
            Cars («… AT», «… MT») o agregando la familia arriba si toda la familia viene igual.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
