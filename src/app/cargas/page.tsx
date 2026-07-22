import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NotaDato, PageHeader } from "@/components/dashboard/page-header";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { getArchivos, getCobertura } from "@/lib/cadam/mercado";
import { formatUnidades } from "@/lib/format";
import { FolderOpen, Terminal } from "lucide-react";

export default function CargasPage() {
  const cobertura = getCobertura();
  const archivos = getArchivos();
  const porSnapshot = new Map<string, typeof archivos>();
  for (const a of archivos) {
    porSnapshot.set(a.snapshot, [...(porSnapshot.get(a.snapshot) ?? []), a]);
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        titulo="Carga de archivos"
        descripcion="Cómo se cargan los informes mensuales de CADAM y qué hay cargado hoy."
        fuente={
          cobertura.snapshot
            ? `Snapshot activo: ${cobertura.snapshot} · cargado ${cobertura.fechaIngesta ?? "—"}.`
            : "Sin cargas registradas."
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="inline-flex items-center gap-2 text-sm">
            <FolderOpen className="size-4" />
            Cómo cargar un mes nuevo
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 text-sm">
          <ol className="flex list-decimal flex-col gap-3 pl-5">
            <li>
              Creá una carpeta por mes dentro de <code className="rounded bg-muted px-1 py-0.5">CADAM-DATA/</code>.
              El nombre define el período:
              <div className="mt-1.5 rounded-md bg-muted/50 p-2 font-mono text-xs">
                CADAM-DATA/<strong>AGOSTO 2026</strong>/ &nbsp;·&nbsp; también sirve{" "}
                <strong>ago_2026</strong> o <strong>2026-08</strong>
              </div>
            </li>
            <li>
              Poné adentro los archivos, <strong>con el nombre que vengan</strong>. No
              importa cómo se llamen: el tipo se detecta por las columnas reales de
              cada archivo, no por el nombre.
            </li>
            <li>
              Corré la ingesta desde <code className="rounded bg-muted px-1 py-0.5">CADAM/scripts</code>:
              <div className="mt-1.5 flex flex-col gap-1 rounded-md bg-muted/50 p-2 font-mono text-xs">
                <span>python ingest.py --dry-run</span>
                <span className="text-muted-foreground"># ver qué haría, sin escribir</span>
                <span className="mt-1">python ingest.py --correcciones</span>
                <span className="text-muted-foreground"># cargar aplicando las correcciones</span>
              </div>
            </li>
            <li>Refrescá la app. No hace falta reiniciar el servidor.</li>
          </ol>

          <NotaDato>
            Reingestar un período <strong>lo reemplaza</strong>, no lo duplica: es
            seguro correrlo de nuevo. Los archivos de CADAM son acumulativos (el de
            julio ya trae 2019–2026 entero), así que cada carpeta se guarda como un
            snapshot completo y la app lee siempre el más reciente. Los anteriores
            quedan para auditoría.
          </NotaDato>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm">Snapshots cargados</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-5">
          {[...porSnapshot.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([snap, arch]) => (
            <div key={snap} className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium tabular-nums">{snap}</span>
                {snap === cobertura.snapshot && (
                  <Badge className="h-5 px-1.5 text-[10px]">activo</Badge>
                )}
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Archivo</TableHead>
                      <TableHead>Detectado como</TableHead>
                      <TableHead className="text-right">Filas leídas</TableHead>
                      <TableHead className="text-right">Filas cargadas</TableHead>
                      <TableHead className="text-right">Unidades</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {arch.map((a) => (
                      <TableRow key={a.nombre}>
                        <TableCell className="font-medium">{a.nombre}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-normal">{a.tipo}</Badge>
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">
                          {formatUnidades(a.filas_leidas)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatUnidades(a.filas_cargadas)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatUnidades(a.unidades)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          ))}
          {!archivos.length && (
            <p className="text-sm text-muted-foreground">Sin archivos cargados todavía.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="inline-flex items-center gap-2 text-sm">
            <Terminal className="size-4" />
            Pendiente: carga desde la interfaz
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Hoy la carga se hace por línea de comandos. Subir el archivo desde el
          navegador requiere que la app pueda escribir en disco y ejecutar el
          pipeline, lo que conviene resolver junto con la base en servidor y el
          control de acceso — no antes, porque una pantalla que escribe archivos sin
          usuarios identificados no deja rastro de quién cargó qué.
        </CardContent>
      </Card>
    </div>
  );
}
