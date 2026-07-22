import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/dashboard/page-header";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { getArchivos, getCargaLog, getCobertura } from "@/lib/cadam/mercado";
import { formatUnidades } from "@/lib/format";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";

export default function CalidadDatosPage() {
  const cobertura = getCobertura();
  const log = getCargaLog();
  const archivos = getArchivos();

  const errores = log.filter((l) => l.nivel === "error");
  const avisos = log.filter((l) => l.nivel === "aviso");
  const controles = log.filter((l) => l.categoria === "control_ok");
  const resto = log.filter((l) => l.nivel === "info" && l.categoria !== "control_ok");

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        titulo="Calidad de datos"
        descripcion="Todo lo que el pipeline detectó al cargar los archivos: controles cruzados contra el informe oficial de CADAM, huecos, ambigüedades y valores sin clasificar."
        fuente={
          cobertura.snapshot
            ? `Snapshot ${cobertura.snapshot} · cargado ${cobertura.fechaIngesta ?? "—"}.`
            : "Todavía no hay ninguna carga registrada."
        }
      />

      <section className="grid gap-3 sm:grid-cols-3">
        <Contador label="Errores" n={errores.length} tono="error" />
        <Contador label="Avisos" n={avisos.length} tono="aviso" />
        <Contador label="Controles OK" n={controles.length} tono="ok" />
      </section>

      {controles.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Validación contra el informe oficial de CADAM</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {controles.map((c, i) => (
              <p key={i} className="flex items-start gap-2 text-sm">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <span>{c.mensaje}</span>
              </p>
            ))}
            <p className="mt-1 text-xs text-muted-foreground">
              Es el control más fuerte del pipeline: los datos row-level tienen que
              reproducir exactamente los totales que publica CADAM en su informe
              estadístico. Se comparan solo los meses presentes en ambas fuentes.
            </p>
          </CardContent>
        </Card>
      )}

      {(errores.length > 0 || avisos.length > 0) && (
        <Card>
          <CardHeader><CardTitle>Hallazgos</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-3">
            {[...errores, ...avisos].map((l, i) => (
              <div key={i} className="flex items-start gap-2">
                {l.nivel === "error" ? (
                  <XCircle className="mt-0.5 size-4 shrink-0 text-rose-600 dark:text-rose-400" />
                ) : (
                  <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-500" />
                )}
                <div className="flex flex-col gap-0.5">
                  <p className="text-sm">{l.mensaje}</p>
                  <p className="text-xs text-muted-foreground">
                    <code className="rounded bg-muted px-1 py-0.5">{l.categoria}</code>
                    {l.archivo && <> · {l.archivo}</>}
                    {l.n > 1 && <> · {formatUnidades(l.n)} filas afectadas</>}
                  </p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Archivos cargados</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Archivo</TableHead>
                <TableHead>Tipo detectado</TableHead>
                <TableHead>Snapshot</TableHead>
                <TableHead className="text-right">Filas leídas</TableHead>
                <TableHead className="text-right">Filas cargadas</TableHead>
                <TableHead className="text-right">Unidades</TableHead>
                <TableHead>Fecha de carga</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {archivos.map((a) => (
                <TableRow key={`${a.snapshot}-${a.nombre}`}>
                  <TableCell className="font-medium">{a.nombre}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-normal">{a.tipo}</Badge>
                  </TableCell>
                  <TableCell className="tabular-nums text-muted-foreground">{a.snapshot}</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {formatUnidades(a.filas_leidas)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatUnidades(a.filas_cargadas)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatUnidades(a.unidades)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{a.fecha_ingesta}</TableCell>
                </TableRow>
              ))}
              {!archivos.length && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    Sin archivos cargados todavía.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          <p className="mt-3 text-xs text-muted-foreground">
            &ldquo;Filas leídas&rdquo; es lo que traía el Excel; &ldquo;filas
            cargadas&rdquo; es lo que quedó después de descartar meses vacíos y
            agrupar duplicados. La diferencia es normal, no una pérdida: las
            unidades totales se conservan.
          </p>
        </CardContent>
      </Card>

      {resto.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Detalle del procesamiento</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-2">
            {resto.map((l, i) => (
              <p key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                <Info className="mt-0.5 size-3.5 shrink-0" />
                <span>
                  {l.mensaje}
                  {l.n > 1 && <> — {formatUnidades(l.n)}</>}
                  {l.archivo && <> · {l.archivo}</>}
                </span>
              </p>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Contador({
  label, n, tono,
}: { label: string; n: number; tono: "error" | "aviso" | "ok" }) {
  const color = {
    error: "text-rose-600 dark:text-rose-400",
    aviso: "text-amber-600 dark:text-amber-500",
    ok: "text-emerald-600 dark:text-emerald-400",
  }[tono];
  return (
    <Card className="gap-1 py-4">
      <CardHeader className="px-4">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
      </CardHeader>
      <CardContent className="px-4">
        <p className={`text-2xl font-semibold tabular-nums ${n > 0 || tono === "ok" ? color : ""}`}>
          {n}
        </p>
      </CardContent>
    </Card>
  );
}
