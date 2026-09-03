import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NotaDato, PageHeader } from "@/components/dashboard/page-header";
import { Seccion } from "@/components/dashboard/seccion";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { getArchivos, getCobertura } from "@/lib/cadam/mercado";
import { getEstadoSyncPropio } from "@/lib/informes/propios";
import { getIndiceConocimiento } from "@/lib/informes/conocimiento";
import { formatUnidades } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Estado de los datos.
 *
 * Era "Carga de archivos": un MANUAL de cómo correr la ingesta a mano
 * (crear la carpeta, python ingest.py, refrescar). Esas instrucciones
 * dejaron de hacer falta cuando la carga pasó a los cron de Hermes, y un
 * manual que nadie sigue envejece hasta mentir.
 *
 * Lo que sí hace falta —y no existía en ningún lado— es saber si lo que se
 * está mirando está fresco. El 02/09/2026 producción estuvo un mes entero
 * mostrando junio y nadie se enteró: el tablero se veía perfecto, sólo que
 * viejo. Esta pantalla es exactamente ese semáforo.
 *
 * NO duplica /calidad-datos, que responde otra pregunta: allá es "¿el dato
 * es correcto?" (validación contra el informe oficial, hallazgos, detalle
 * del procesamiento); acá es "¿está actualizado y la cadena funciona?".
 */

export const dynamic = "force-dynamic";

/** Cada fuente tiene su propio ritmo, así que su propio umbral. Un dato de
 *  CADAM de tres semanas es normal (publican mensual); uno de Cars de tres
 *  semanas significa que el cron está muerto. */
interface Fuente {
  nombre: string;
  detalle: string;
  cadencia: string;
  actualizado: Date | null;
  /** Horas hasta que deja de estar fresco / hasta que es un problema. */
  tibioH: number;
  frioH: number;
  /** Qué lo mantiene al día. */
  motor: string;
}

function horasDesde(d: Date | null): number | null {
  if (!d || Number.isNaN(d.getTime())) return null;
  return (Date.now() - d.getTime()) / 3_600_000;
}

function edad(h: number | null): string {
  if (h === null) return "sin registro";
  if (h < 1) return "hace minutos";
  if (h < 24) return `hace ${Math.round(h)} h`;
  const d = Math.round(h / 24);
  return d === 1 ? "hace 1 día" : `hace ${d} días`;
}

export default async function EstadoDatosPage() {
  const cobertura = getCobertura();
  const archivos = getArchivos();

  // Las dos fuentes de Postgres pueden no estar (base caída, tablas sin
  // crear). Que la pantalla de estado se caiga por eso sería el colmo:
  // se degradan a "sin registro" y el resto sigue en pie.
  const [sync, indice] = await Promise.all([
    getEstadoSyncPropio().catch(() => null),
    getIndiceConocimiento().catch(() => []),
  ]);

  const ultimoConocimiento = indice.length
    ? new Date(
        Math.max(...indice.map((d) => new Date(d.actualizado_en).getTime()))
      )
    : null;

  const fuentes: Fuente[] = [
    {
      nombre: "CADAM / DNRA",
      detalle: cobertura.snapshot
        ? `Snapshot ${cobertura.snapshot} · matriculaciones hasta ${
            cobertura.matriculacion.ultimo
              ? `${cobertura.matriculacion.ultimo.anio}-${String(cobertura.matriculacion.ultimo.mes).padStart(2, "0")}`
              : "—"
          }`
        : "Sin cargas registradas",
      cadencia: "Mensual",
      actualizado: cobertura.fechaIngesta ? new Date(cobertura.fechaIngesta) : null,
      // CADAM publica el mes M durante M+1: 45 días es lo normal, 75 ya es
      // que nadie ingestó.
      tibioH: 45 * 24,
      frioH: 75 * 24,
      motor: "Hermes · «CADAM desde OneDrive», 06:00 diario",
    },
    {
      nombre: "Cars (DMS propio)",
      detalle: sync
        ? `${String((sync.detalle as Record<string, unknown>).filas_ventas ?? "?")} filas de facturación · ${String((sync.detalle as Record<string, unknown>).unidades_en_stock ?? "?")} unidades en stock`
        : "Sin sincronización registrada",
      cadencia: "Cada 4 horas",
      actualizado: sync ? new Date(sync.actualizado_en) : null,
      tibioH: 12,
      frioH: 36,
      motor: "Hermes · «Operación propia (Cars)», cada 4 h",
    },
    {
      nombre: "Inteligencia de competencia",
      detalle: indice.length
        ? `${indice.length} documentos (benchmark de precios, battle cards, promociones)`
        : "Sin documentos cargados",
      cadencia: "Diaria",
      actualizado: ultimoConocimiento,
      tibioH: 48,
      frioH: 96,
      motor: "Hermes · «Conocimiento de competencia», 08:15 diario",
    },
  ];

  const hayProblema = fuentes.some((f) => {
    const h = horasDesde(f.actualizado);
    return h === null || h > f.frioH;
  });

  const porSnapshot = new Map<string, typeof archivos>();
  for (const a of archivos) {
    porSnapshot.set(a.snapshot, [...(porSnapshot.get(a.snapshot) ?? []), a]);
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        titulo="Estado de los datos"
        descripcion="Qué tan fresco está cada dato del tablero y qué lo mantiene al día."
        fuente={
          cobertura.snapshot
            ? `Snapshot activo: ${cobertura.snapshot} · cargado ${cobertura.fechaIngesta ?? "—"}.`
            : "Sin cargas registradas."
        }
      />

      {hayProblema && (
        <NotaDato>
          Hay al menos una fuente <strong>más atrasada de lo esperado</strong>.
          Si es CADAM, puede ser que el mes todavía no se publicó o que la
          ingesta no corrió. Si es Cars o la inteligencia de competencia, el
          cron de Hermes que la alimenta dejó de correr — se revisa en la
          máquina donde vive Hermes, no acá.
        </NotaDato>
      )}

      <Seccion titulo="Frescura por fuente">
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          {fuentes.map((f) => (
            <TarjetaFuente key={f.nombre} fuente={f} />
          ))}
        </div>
      </Seccion>

      <Seccion titulo="Cómo llega el dato">
        <Card>
          <CardContent className="flex flex-col gap-3 text-sm">
            <p className="text-muted-foreground">
              Las tres fuentes se actualizan solas desde los cron de Hermes, que
              corren en la máquina de Croman —no en este servidor— porque es
              donde están las credenciales de CADAM y de Cars. El tablero es el
              consumidor: nunca sale a buscar nada por su cuenta.
            </p>
            <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-muted-foreground">
              <li>
                <strong className="text-foreground">CADAM.</strong> El cron
                sincroniza la carpeta de OneDrive, corre la ingesta y, si el
                período cambió, sube la base a producción. Silencioso si CADAM no
                publicó nada nuevo.
              </li>
              <li>
                <strong className="text-foreground">Cars.</strong> Lee facturación
                y stock del API, agrega en la máquina —los datos de clientes nunca
                salen de ahí— y empuja sólo los conteos.
              </li>
              <li>
                <strong className="text-foreground">Competencia.</strong> Empuja el
                vault de Hermes: benchmark de precios, battle cards y el scan
                diario de promociones.
              </li>
            </ol>
            <p className="text-xs text-muted-foreground">
              ¿Buscás si el dato es <em>correcto</em>, no si está fresco? Eso vive
              en <strong>Calidad de datos</strong>: validación contra el informe
              oficial, hallazgos y detalle del procesamiento.
            </p>
          </CardContent>
        </Card>
      </Seccion>

      <Seccion titulo="Qué entró en cada snapshot">
        <Card>
          <CardContent className="flex flex-col gap-5 pt-6">
            {[...porSnapshot.entries()]
              .sort((a, b) => b[0].localeCompare(a[0]))
              .map(([snap, arch]) => (
                <div key={snap} className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium tabular-nums">{snap}</span>
                    {snap === cobertura.snapshot && (
                      <Badge className="h-5 px-1.5 text-[10px]">activo</Badge>
                    )}
                  </div>
                  <div className="flex flex-col divide-y sm:hidden">
                    {arch.map((a) => (
                      <div key={a.nombre} className="flex flex-col gap-1 py-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="min-w-0 truncate font-medium">{a.nombre}</span>
                          <Badge variant="outline" className="shrink-0 font-normal">{a.tipo}</Badge>
                        </div>
                        <div className="flex items-center gap-3 text-xs tabular-nums text-muted-foreground">
                          <span>{formatUnidades(a.filas_leidas)} leídas</span>
                          <span>{formatUnidades(a.filas_cargadas)} cargadas</span>
                          <span className="font-mono font-semibold text-foreground">
                            {formatUnidades(a.unidades)} u.
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="hidden overflow-x-auto sm:block">
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
      </Seccion>
    </div>
  );
}

function TarjetaFuente({ fuente }: { fuente: Fuente }) {
  const h = horasDesde(fuente.actualizado);
  const estado =
    h === null ? "frio" : h > fuente.frioH ? "frio" : h > fuente.tibioH ? "tibio" : "ok";

  const tono = {
    ok: "text-emerald-600 dark:text-emerald-500",
    tibio: "text-amber-600 dark:text-amber-500",
    frio: "text-rose-600 dark:text-rose-500",
  }[estado];

  const etiqueta = { ok: "Al día", tibio: "Envejeciendo", frio: "Atrasado" }[estado];

  return (
    <Card>
      <CardHeader className="gap-1">
        <CardTitle>{fuente.nombre}</CardTitle>
        <p className="text-xs text-muted-foreground">{fuente.detalle}</p>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 text-sm">
        <div className="flex items-baseline gap-2">
          {/* El punto NO es la única señal: al lado va la palabra. Un
              semáforo de color solo no se lee con percepción reducida. */}
          <span aria-hidden="true" className={cn("text-lg leading-none", tono)}>
            ●
          </span>
          <span className={cn("font-semibold", tono)}>{etiqueta}</span>
          <span className="text-muted-foreground">· {edad(h)}</span>
        </div>
        <dl className="flex flex-col gap-1 text-xs text-muted-foreground">
          <div className="flex justify-between gap-2">
            <dt>Se espera</dt>
            <dd className="text-right">{fuente.cadencia}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt>Lo mantiene</dt>
            <dd className="text-right">{fuente.motor}</dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  );
}
