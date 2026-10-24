import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ReactNode } from "react";
import { tipoArchivoLegible } from "@/lib/tipo-archivo";
import { getI18n } from "@/lib/i18n/servidor";
import type { T } from "@/lib/i18n/traducir";
import { NotaDato, PageHeader } from "@/components/dashboard/page-header";
import { Pagina } from "@/components/movimiento/pagina";
import { Seccion } from "@/components/dashboard/seccion";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { getArchivos, getCobertura } from "@/lib/cadam/mercado";
import { getEstadoSyncPropio } from "@/lib/informes/propios";
import { getIndiceConocimiento } from "@/lib/informes/conocimiento";
import { getPreciosCompetencia } from "@/lib/informes/precios-competencia";
import { getActualizacionDemandaBitrix, getDemandaBitrix } from "@/lib/informes/demanda-bitrix";
import { getActualizacionLeadsAsesor } from "@/lib/informes/leads-asesor";
import { getActualizacionPautaMarca, getPautaMarca } from "@/lib/informes/pauta-marca";
import { hoyEnAsuncion } from "@/lib/format";
import { getPresupuesto } from "@/lib/cadam/config";
import { getBatalla } from "@/lib/informes/batalla";
import { getAcciones } from "@/lib/informes/acciones";
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

function edad(h: number | null, t: T): string {
  if (h === null) return t("sin registro");
  if (h < 1) return t("hace minutos");
  if (h < 24) return t("hace {n} h", { n: Math.round(h) });
  const d = Math.round(h / 24);
  return d === 1 ? t("hace 1 día") : t("hace {n} días", { n: d });
}

export default async function EstadoDatosPage() {
  const { t, tr, fmt } = await getI18n();
  const { formatUnidades, mesCorto, etiquetaCorte, etiquetaCortes } = fmt;
  // «2026-09» → «Septiembre 2026» / «September 2026» (lo mismo que hace nombreMes() de informes/acciones, en el idioma de la pantalla).
  const nombreMes = (mes: string): string => {
    const [a, m] = mes.split("-").map(Number);
    return m >= 1 && m <= 12 ? fmt.etiquetaPeriodo(a, m, m) : mes;
  };
  const cobertura = getCobertura();
  const archivos = getArchivos();

  // Las dos fuentes de Postgres pueden no estar (base caída, tablas sin
  // crear). Que la pantalla de estado se caiga por eso sería el colmo:
  // se degradan a "sin registro" y el resto sigue en pie.
  const [sync, indice, precios, demanda, demandaFecha, leadsFecha, pauta, pautaFecha] = await Promise.all([
    getEstadoSyncPropio().catch(() => null),
    getIndiceConocimiento().catch(() => []),
    getPreciosCompetencia().catch(() => []),
    getDemandaBitrix().catch(() => []),
    getActualizacionDemandaBitrix().catch(() => null),
    getActualizacionLeadsAsesor().catch(() => null),
    getPautaMarca().catch(() => []),
    getActualizacionPautaMarca().catch(() => null),
  ]);
  const ultimoPrecio = precios.length
    ? new Date(Math.max(...precios.map((p) => new Date(p.actualizado_en).getTime())))
    : null;
  const marcasConPrecio = new Set(precios.map((p) => p.marca)).size;
  const leadsDemanda = demanda.filter((d) => d.origen === "lead").reduce((s, d) => s + d.cantidad, 0);
  const negociosDemanda = demanda.filter((d) => d.origen === "negocio").reduce((s, d) => s + d.cantidad, 0);
  const gastoPauta = pauta.reduce((s, p) => s + p.gasto_usd, 0);
  const cuentasPauta = new Set(pauta.map((p) => p.marca)).size;
  const anioHoy = Number(hoyEnAsuncion().slice(0, 4));
  const presupuesto = getPresupuesto(anioHoy);
  const batalla = getBatalla();
  const acciones = getAcciones();
  const planTotal = presupuesto ? presupuesto.grupos.reduce((s, g) => s + g.plan.reduce((a, b) => a + b, 0), 0) : 0;
  const pptoTotal = presupuesto ? presupuesto.grupos.reduce((s, g) => s + (g.presupuesto_anual ?? 0), 0) : 0;

  const ultimoConocimiento = indice.length
    ? new Date(
        Math.max(...indice.map((d) => new Date(d.actualizado_en).getTime()))
      )
    : null;

  const variablesPresupuesto = presupuesto && {
    version: presupuesto.version,
    grupos: presupuesto.grupos.length,
    mes: presupuesto.real_hasta_mes ? mesCorto(presupuesto.real_hasta_mes) : "—",
    plan: formatUnidades(planTotal),
    ppto: formatUnidades(pptoTotal),
    // «CDE y WHOLESALE»: los canales se unen con «y» (en inglés, «and»).
    canales: (presupuesto.canales ?? []).map((c) => c.canal).reduce((junto, c) => (junto ? t("{a} y {b}", { a: junto, b: c }) : c), ""),
  };
  const detallePresupuesto = !presupuesto || !variablesPresupuesto
    ? t("Nunca cargado. Lo carga advisor-presupuesto.sh (Hermes, notebook) desde el Budget de Finanzas.")
    : presupuesto.canales?.length
      ? t("Plan {version} · {grupos} marcas o grupos · real hasta {mes} · plan {plan} u. · presupuesto original {ppto} u. · canales {canales} con objetivo y real de Finanzas Renew (usados) no entra.", variablesPresupuesto)
      : t("Plan {version} · {grupos} marcas o grupos · real hasta {mes} · plan {plan} u. · presupuesto original {ppto} u. Renew (usados) no entra.", variablesPresupuesto);

  const fuentes: Fuente[] = [
    {
      nombre: "CADAM / DNRA",
      // Hasta dónde llega CADA fuente: cuál va adelante cambia de un mes a
      // otro, y mostrar solo la matriculación escondía un atraso de la
      // importación (oct-2026: matriculación a septiembre, importación a agosto).
      detalle: cobertura.snapshot
        ? `${etiquetaCortes(cobertura).replace(/^./, (c) => c.toUpperCase())}`
        : t("Sin cargas registradas"),
      cadencia: t("Mensual"),
      actualizado: cobertura.fechaIngesta ? new Date(cobertura.fechaIngesta) : null,
      // CADAM publica el mes M durante M+1: 45 días es lo normal, 75 ya es
      // que nadie ingestó.
      tibioH: 45 * 24,
      frioH: 75 * 24,
      motor: t("Hermes · «CADAM desde OneDrive», 06:00 diario"),
    },
    {
      nombre: t("Cars (DMS propio)"),
      detalle: sync
        ? t("{filas} filas de facturación · {unidades} unidades en stock", {
            filas: String((sync.detalle as Record<string, unknown>).filas_ventas ?? "?"),
            unidades: String((sync.detalle as Record<string, unknown>).unidades_en_stock ?? "?"),
          })
        : t("Sin sincronización registrada"),
      cadencia: t("Cada 4 horas"),
      actualizado: sync ? new Date(sync.actualizado_en) : null,
      tibioH: 12,
      frioH: 36,
      motor: t("Hermes · «Operación propia (Cars)», cada 4 h"),
    },
    {
      nombre: t("Inteligencia de competencia"),
      detalle: indice.length
        ? t("{n} documentos (benchmark de precios, battle cards, promociones)", { n: indice.length })
        : t("Sin documentos cargados"),
      cadencia: t("Diaria"),
      actualizado: ultimoConocimiento,
      tibioH: 48,
      frioH: 96,
      motor: t("Hermes · «Conocimiento de competencia», 08:15 diario"),
    },
    // Las cuatro fuentes que entraron el 06/09/2026: alimentan Dónde
    // competir, Nuestra operación y el Centro de Inteligencia. Van con el
    // job semanal del benchmark; siete días es lo normal, doce ya es que
    // el lunes no corrió.
    {
      nombre: t("Precios de la competencia (Datacar)"),
      detalle: precios.length
        ? t("{precios} precios de lista de {marcas} marcas · catálogo de terceros", {
            precios: formatUnidades(precios.length), marcas: marcasConPrecio,
          })
        : t("Sin precios cargados"),
      cadencia: t("Semanal"),
      actualizado: ultimoPrecio,
      tibioH: 8 * 24,
      frioH: 12 * 24,
      motor: t("Hermes · «Benchmark competitivo», lunes 10:00"),
    },
    {
      nombre: t("Demanda (Bitrix)"),
      detalle: demanda.length
        ? t("{leads} leads y {negocios} negocios del año, por marca, modelo, estado y motivo", {
            leads: formatUnidades(leadsDemanda), negocios: formatUnidades(negociosDemanda),
          })
        : t("Sin demanda cargada"),
      cadencia: t("Semanal"),
      actualizado: demandaFecha ? new Date(demandaFecha) : null,
      tibioH: 8 * 24,
      frioH: 12 * 24,
      motor: t("Hermes · «Benchmark competitivo», lunes 10:00"),
    },
    {
      nombre: t("Leads por asesor (Bitrix)"),
      detalle: leadsFecha ? t("Leads por responsable y mes, cruzados con Cars en el ranking de asesores") : t("Sin leads cargados"),
      cadencia: t("Semanal"),
      actualizado: leadsFecha ? new Date(leadsFecha) : null,
      tibioH: 8 * 24,
      frioH: 12 * 24,
      motor: t("Hermes · «Benchmark competitivo», lunes 10:00"),
    },
    {
      nombre: t("Pauta (Meta)"),
      detalle: pauta.length
        ? t("US$ {gasto} en el año, {n} marcas · gasto por cuenta y mes", {
            gasto: formatUnidades(Math.round(gastoPauta)), n: cuentasPauta,
          })
        : t("Sin pauta cargada"),
      cadencia: t("Semanal"),
      actualizado: pautaFecha ? new Date(pautaFecha) : null,
      tibioH: 8 * 24,
      frioH: 12 * 24,
      motor: t("Hermes · «Benchmark competitivo», lunes 10:00"),
    },
    {
      nombre: t("Presupuesto {anio} (Excel de Finanzas)", { anio: anioHoy }),
      detalle: detallePresupuesto,
      cadencia: t("cuando Finanzas cambia el Excel (el cron mira cada hora)"),
      actualizado: presupuesto ? new Date(presupuesto.cargado_en) : null,
      // Un presupuesto se revisa cada uno o dos meses: no está viejo a las
      // dos semanas como Cars.
      tibioH: 45 * 24,
      frioH: 90 * 24,
      motor: t("Hermes · «Presupuesto (Excel Finanzas)», cada hora, notebook"),
    },
    {
      nombre: t("Batalla por modelo (Excel de producto)"),
      detalle: batalla
        ? t("{modelos} modelos de {marcas} marcas, {versiones} versiones rivales · {archivos} archivos BBCH en la carpeta", {
            modelos: batalla.modelos.length,
            marcas: new Set(batalla.modelos.map((m) => m.marca_propia)).size,
            versiones: batalla.modelos.reduce((s, m) => s + m.versiones.length, 0),
            archivos: batalla.archivos?.length ?? 1,
          })
        : t("Nunca cargado. Lo carga advisor-batalla.sh (Hermes, notebook) desde los *BBCH*.xlsx de la carpeta."),
      cadencia: t("cuando producto cambia la planilla (el cron mira cada hora)"),
      actualizado: batalla ? new Date(batalla.cargado_en) : null,
      tibioH: 45 * 24,
      frioH: 90 * 24,
      motor: t("Hermes · «Batalla por modelo (Excel producto)», cada hora, notebook"),
    },
    {
      nombre: t("Acciones comerciales (Excel de Fernando)"),
      detalle: acciones
        ? t("{mes} · {marcas} marcas, {versiones} versiones · «{archivo}»", {
            mes: nombreMes(acciones.mes),
            marcas: acciones.hojas.length,
            versiones: acciones.hojas.reduce((s, h) => s + h.versiones.length, 0),
            archivo: acciones.archivo,
          })
        : t("Nunca cargado. Lo carga advisor-acciones.sh (Hermes, notebook) desde ACCIONES COMERCIALES <MES>.xlsx de la carpeta."),
      cadencia: t("mensual, cuando Fernando manda la planilla (el cron mira cada 4 horas)"),
      actualizado: acciones ? new Date(acciones.cargado_en) : null,
      tibioH: 40 * 24,
      frioH: 70 * 24,
      motor: t("Hermes · «Acciones comerciales (Excel)», cada 4 horas, notebook"),
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
    <Pagina>
      <PageHeader
        titulo={t("Estado de los datos")}
        descripcion={t("Qué tan fresco está cada dato del tablero y qué lo mantiene al día.")}
        fuente={
          cobertura.snapshot
            ? t("Datos hasta {corte} · cargados el {fecha}.", {
                corte: etiquetaCorte(cobertura.snapshot), fecha: cobertura.fechaIngesta ?? "—",
              })
            : t("Sin cargas registradas.")
        }
      />

      {hayProblema && (
        <NotaDato>
          {tr("Hay al menos una fuente <b>más atrasada de lo esperado</b>. Si es CADAM, puede ser que el mes todavía no se publicó o que la ingesta no corrió. Si es Cars o la inteligencia de competencia, el cron de Hermes que la alimenta dejó de correr — se revisa en la máquina donde vive Hermes, no acá.")}
        </NotaDato>
      )}

      <Seccion titulo={t("Frescura por fuente")}
        nota={t("Hasta qué mes llega cada fuente. Si una quedó vieja, todo lo que se lea de ella está incompleto.")}>
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          {fuentes.map((f) => (
            <TarjetaFuente key={f.nombre} fuente={f} t={t} />
          ))}
        </div>
      </Seccion>

      <Seccion titulo={t("Cómo llega el dato")}
        nota={t("Quién trae cada dato, cada cuánto y por dónde entra. Sirve para saber a qué trabajo mirar cuando algo no aparece.")}>
        <Card>
          <CardContent className="flex flex-col gap-3 text-sm">
            <p className="text-muted-foreground">
              {t("Todas las fuentes se actualizan solas desde los trabajos programados de Hermes —el robot que corre las cargas—, que corren en la máquina de Croman —no en este servidor— porque es donde están las credenciales de CADAM, Cars, Bitrix y Meta. El tablero es el consumidor: nunca sale a buscar nada por su cuenta.")}
            </p>
            <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-muted-foreground">
              <li>
                {tr("<b>CADAM.</b> El cron sincroniza la carpeta de OneDrive, corre la ingesta y, si el período cambió, sube la base a producción. Silencioso si CADAM no publicó nada nuevo.", undefined, ETIQUETAS_FUENTE)}
              </li>
              <li>
                {tr("<b>Cars.</b> Lee facturación y stock del API, agrega en la máquina —los datos de clientes nunca salen de ahí— y empuja sólo los conteos.", undefined, ETIQUETAS_FUENTE)}
              </li>
              <li>
                {tr("<b>Competencia.</b> Empuja el vault de Hermes: benchmark de precios, battle cards y el scan diario de promociones.", undefined, ETIQUETAS_FUENTE)}
              </li>
              <li>
                {tr("<b>Benchmark semanal.</b> Los lunes, un solo job lee el catálogo de Datacar (precios de lista de la competencia), Bitrix (leads y negocios por marca, modelo, estado y motivo; leads por asesor) y Meta (gasto por cuenta y mes), agrega todo en la máquina y empuja sólo los conteos. Con eso viven Dónde competir, la demanda y la pauta de Nuestra operación, y la mitad del Centro de Inteligencia.", undefined, ETIQUETAS_FUENTE)}
              </li>
            </ol>
            <p className="text-xs text-muted-foreground">
              {tr("¿Buscás si el dato es <i>correcto</i>, no si está fresco? Eso vive en <b>Calidad de datos</b>: validación contra el informe oficial, hallazgos y detalle del procesamiento.")}
            </p>
          </CardContent>
        </Card>
      </Seccion>

      <Seccion titulo={t("Qué entró en cada carga")}
        nota={t("Archivo por archivo: cuántas filas traía, cuántas entraron y cuántas se descartaron.")}>
        <Card>
          <CardContent className="flex flex-col gap-5 pt-6">
            {[...porSnapshot.entries()]
              .sort((a, b) => b[0].localeCompare(a[0]))
              .map(([snap, arch]) => (
                <div key={snap} className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{etiquetaCorte(snap)}</span>
                    {snap === cobertura.snapshot && (
                      <Badge className="h-5 px-1.5 text-[10px]">{t("activo")}</Badge>
                    )}
                  </div>
                  <div className="flex flex-col divide-y sm:hidden">
                    {arch.map((a) => (
                      <div key={a.nombre} className="flex flex-col gap-1 py-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="min-w-0 truncate font-medium">{a.nombre}</span>
                          <Badge variant="outline" className="shrink-0 font-normal">{tipoArchivoLegible(a.tipo, t)}</Badge>
                        </div>
                        <div className="flex items-center gap-3 text-xs tabular-nums text-muted-foreground">
                          <span>{t("{n} leídas", { n: formatUnidades(a.filas_leidas) })}</span>
                          <span>{t("{n} cargadas", { n: formatUnidades(a.filas_cargadas) })}</span>
                          <span className="font-mono font-semibold text-foreground">
                            {t("{n} u.", { n: formatUnidades(a.unidades) })}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="hidden overflow-x-auto sm:block">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t("Archivo")}</TableHead>
                          <TableHead nota={t("qué informe creyó que era")}>{t("Detectado como")}</TableHead>
                          <TableHead className="text-right" nota={t("renglones que traía el archivo")}>{t("Filas leídas")}</TableHead>
                          <TableHead className="text-right" nota={t("las que entraron; el resto, descartes")}>{t("Filas cargadas")}</TableHead>
                          <TableHead className="text-right" nota={t("vehículos que suman esas filas")}>{t("Unidades")}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {arch.map((a) => (
                          <TableRow key={a.nombre}>
                            <TableCell className="font-medium">{a.nombre}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="font-normal">{tipoArchivoLegible(a.tipo, t)}</Badge>
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
              <p className="text-sm text-muted-foreground">{t("Sin archivos cargados todavía.")}</p>
            )}
          </CardContent>
        </Card>
      </Seccion>
    </Pagina>
  );
}

/** Las negritas de la explicación de «Cómo llega el dato»: en el color del texto, no el apagado del párrafo. */
const ETIQUETAS_FUENTE = {
  b: (h: ReactNode) => <strong className="text-foreground">{h}</strong>,
};

function TarjetaFuente({ fuente, t }: { fuente: Fuente; t: T }) {
  const h = horasDesde(fuente.actualizado);
  const estado =
    h === null ? "frio" : h > fuente.frioH ? "frio" : h > fuente.tibioH ? "tibio" : "ok";

  const tono = {
    ok: "text-emerald-700 dark:text-emerald-400",
    tibio: "text-amber-700 dark:text-amber-400",
    frio: "text-rose-700 dark:text-rose-400",
  }[estado];

  const etiqueta = { ok: t("Al día"), tibio: t("Envejeciendo"), frio: t("Atrasado") }[estado];

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
          <span className="text-muted-foreground">· {edad(h, t)}</span>
        </div>
        <dl className="flex flex-col gap-1 text-xs text-muted-foreground">
          <div className="flex justify-between gap-2">
            <dt>{t("Se espera")}</dt>
            <dd className="text-right">{fuente.cadencia}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt>{t("Lo mantiene")}</dt>
            <dd className="text-right">{fuente.motor}</dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  );
}
