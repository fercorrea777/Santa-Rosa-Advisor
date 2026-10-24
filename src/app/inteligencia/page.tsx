import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NotaDato, PageHeader } from "@/components/dashboard/page-header";
import { Pagina } from "@/components/movimiento/pagina";
import { Cifra } from "@/components/movimiento/cifra";
import { FiltroPeriodo } from "@/components/dashboard/filtro-periodo";
import { Badge } from "@/components/ui/badge";
import { InformesPanel } from "@/components/copiloto/informes-panel";
import { ConocimientoPanel } from "@/components/copiloto/conocimiento-panel";
import { Seccion } from "@/components/dashboard/seccion";
import { getCobertura, getOpcionesFiltro } from "@/lib/cadam/mercado";
import { generarInforme, type Item, type Prioridad, type Tipo } from "@/lib/cadam/inteligencia";
import { generarLecturaPropia } from "@/lib/informes/inteligencia-propia";
import { getI18n } from "@/lib/i18n/servidor";
import { N_, type T } from "@/lib/i18n/traducir";
import { filtroDesdeUrl, type SearchParams } from "@/lib/periodo";
import { cn } from "@/lib/utils";

const SECCIONES: { tipo: Tipo; titulo: string; descripcion: string; tono?: "azul" | "verde" | "ambar" }[] = [
  { tipo: "alerta", titulo: N_("Alertas"),
    descripcion: N_("Movimientos que requieren atención inmediata.") },
  { tipo: "oportunidad", titulo: N_("Oportunidades"),
    descripcion: N_("Espacios donde hay lugar para crecer."), tono: "verde" },
  { tipo: "riesgo", titulo: N_("Riesgos"),
    descripcion: N_("Amenazas a la posición actual.") },
  { tipo: "hallazgo", titulo: N_("Hallazgos relevantes"),
    descripcion: N_("Lo que muestran los datos del período.") },
  { tipo: "historico", titulo: N_("Lectura histórica"),
    descripcion:
      N_("Sobre toda la serie cargada, no solo el período: estacionalidad, " +
      "tendencia de fondo, meses atípicos y proyección de cierre.") },
];

// alta primero: es el orden en el que el equipo comercial necesita leerlas.
const RANGO_PRIORIDAD: Record<Prioridad, number> = { alta: 0, media: 1, baja: 2 };

// La prioridad viaja como clave («alta»); lo que se lee es su traducción.
const ETIQUETA_PRIORIDAD: Record<Prioridad, string> = {
  alta: N_("alta"), media: N_("media"), baja: N_("baja"),
};

export default async function InteligenciaPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const i18n = await getI18n();
  const { t, tr, fmt } = i18n;
  const { etiquetaPeriodo, etiquetaCortes } = fmt;
  const cobertura = getCobertura();
  const f = filtroDesdeUrl(sp, cobertura.matriculacion.ultimo);
  const periodo = etiquetaPeriodo(f.anio, f.mesDesde, f.mesHasta);
  const opciones = getOpcionesFiltro();
  const deCadam = generarInforme(f, periodo, i18n);
  // La otra mitad de la lectura: nuestra operación (Cars), la demanda de
  // Bitrix, la pauta de Meta y el mercado por clase de vehículo. Mismo
  // formato, mezclado en las mismas secciones: el gerente lee una sola lista.
  const propia = await generarLecturaPropia(f, periodo, i18n);
  const informe = {
    ...deCadam,
    resumen: [...deCadam.resumen, ...propia.resumen],
    items: [...deCadam.items, ...propia.items],
    advertencias: [...deCadam.advertencias, ...propia.advertencias],
  };

  const mesMax: Record<number, number> = {};
  for (const a of cobertura.matriculacion.anios) {
    mesMax[a] = a === cobertura.matriculacion.ultimo?.anio
      ? cobertura.matriculacion.ultimo.mes : 12;
  }

  return (
    <Pagina>
      <PageHeader
        titulo={t("Centro de Inteligencia Comercial")}
        descripcion={t("Lectura automática del mercado ({periodo} vs. {anioPrevio}) y de nuestra operación al día de hoy.", { periodo, anioPrevio: f.anio - 1 })}
        fuente={t("Fuente: CADAM / DNRA · {cortes} · Cars (stock y facturación) · Bitrix (demanda) · Meta (pauta) · Datacar (precios de la competencia) · catálogo de clases de vehículo.", { cortes: etiquetaCortes(cobertura) })}
      />

      <FiltroPeriodo
        anios={cobertura.matriculacion.anios}
        mesMaximoPorAnio={mesMax}
        opciones={[{ param: "segmento", label: t("Segmento"), valores: opciones.segmentos }]}
      />

      {informe.advertencias.map((a, i) => <NotaDato key={i}>{a}</NotaDato>)}

      {/* Franja de panorama: cuántos puntos hay en cada categoría antes de
          bajar a leerlos uno por uno, y salto directo a la sección. La
          tile se tiñe si esa categoría tiene algo de prioridad alta. */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {SECCIONES.map(({ tipo, titulo, tono }) => {
          const items = informe.items.filter((i) => i.tipo === tipo);
          const alta = items.filter((i) => i.prioridad === "alta").length;
          return (
            <a key={tipo} href={`#seccion-${tipo}`} className="flex">
              <Card className={cn("w-full gap-1 py-3 transition-transform hover:-translate-y-0.5", alta > 0 ? "tile-tinta" : tono && `tile-${tono}`)}>
                <CardContent className="flex flex-col gap-0.5 px-4">
                  <span className={cn("text-[0.68rem] font-semibold uppercase tracking-[0.06em]", alta > 0 ? undefined : "text-muted-foreground")}>
                    {t(titulo)}
                  </span>
                  <Cifra texto={String(items.length)} className="metric text-2xl" />
                  {alta > 0 && (
                    <span className="text-[11px] font-medium opacity-80">{t("{n} en prioridad alta", { n: alta })}</span>
                  )}
                </CardContent>
              </Card>
            </a>
          );
        })}
      </section>

      <Seccion titulo={t("Lectura del período")}
        nota={t("Lo que hay que saber del período, escrito. Sale de los mismos números del tablero, no de otra fuente.")}>
      <Card>
        <CardHeader>
          <CardTitle>{t("Resumen ejecutivo")}</CardTitle>
          <p className="text-xs text-muted-foreground">
            {t("Los puntos del período en orden de importancia. Salen calculados de los mismos números del tablero: si algo no cierra con una pantalla, es que cambió el dato, no la lectura.")}
          </p>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-col gap-2">
            {informe.resumen.map((r, i) => (
              <li key={i} className="text-sm leading-relaxed tabular-nums">{r}</li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {SECCIONES.map(({ tipo, titulo, descripcion }) => {
        const items = [...informe.items.filter((i) => i.tipo === tipo)]
          .sort((a, b) => RANGO_PRIORIDAD[a.prioridad] - RANGO_PRIORIDAD[b.prioridad]);
        return (
          <Card key={tipo} id={`seccion-${tipo}`} className="scroll-mt-4">
            <CardHeader>
              <CardTitle>
                {t(titulo)}{" "}
                <span className="font-normal text-muted-foreground">({items.length})</span>
              </CardTitle>
              <p className="text-xs text-muted-foreground">{t(descripcion)}</p>
            </CardHeader>
            <CardContent>
              {items.length ? (
                <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                  {items.map((it, i) => <ItemCard key={i} item={it} t={t} />)}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {t("Nada que reportar en este período con los umbrales actuales.")}
                </p>
              )}
            </CardContent>
          </Card>
        );
      })}

      </Seccion>

      <NotaDato>
        {tr(
          "Estas {n} lecturas salen de <b>reglas y cálculos</b> sobre las fuentes cargadas, sin inteligencia artificial externa. " +
          "Cada punto muestra la evidencia numérica de la que sale y, al pie, de qué fuente y período: las del " +
          "mercado (CADAM) cierran en el último mes publicado; las de nuestra operación (Cars, Bitrix, Meta) llegan hasta hoy. " +
          "Para evitar conclusiones falsas, las reglas <b>ignoran las bases chicas</b>: un “+800%” que va de 1 a 9 " +
          "unidades no dice nada del mercado.",
          { n: informe.items.length }
        )}
      </NotaDato>

      {/* Fuentes externas: a diferencia de todo lo de arriba (reglas sobre
          CADAM/DNRA), esto sale de búsqueda web + IA — precios de
          competencia, noticias, redes, tendencias globales. Mismo panel
          que la pestaña "Informes semanales" del Copiloto: una sola fuente
          de verdad para ese dato, no una segunda lectura de Postgres acá. */}
      <Seccion titulo={t("Fuentes externas")}
        nota={t("Lo que se sabe de la competencia y del mercado por fuera de CADAM y de Cars: precios publicados, promociones y notas del monitoreo.")}>
      <Card>
        <CardHeader>
          <CardTitle>{t("Mercado y competencia (fuentes externas)")}</CardTitle>
          <p className="text-xs text-muted-foreground">
            {t("Informe semanal automático: precios de competencia, noticias del sector, redes sociales y tendencias globales, con fuente y fecha citadas.")}
          </p>
        </CardHeader>
        <CardContent>
          <InformesPanel />
        </CardContent>
      </Card>

      {/* Lo que Hermes (agente propio, corre local) empuja por cron: el
          benchmark de precios de competencia, las battle cards, el scan
          diario de promociones. Es lo unico que el Copiloto tiene sobre
          PRECIOS de la competencia — CADAM no los trae.

          Se muestra el inventario y su edad, no el contenido: sirve para
          saber si confiar en una respuesta del Copiloto sobre competencia. */}
      <Card>
        <CardHeader>
          <CardTitle>{t("Qué sabe el Copiloto de la competencia")}</CardTitle>
          <p className="text-xs text-muted-foreground">
            {t("Base de conocimiento que se refresca sola todos los días: precios públicos de la competencia, comparativos modelo a modelo, relevamiento de promociones y guía de pauta. Acá va el inventario y su antigüedad; el contenido lo lee el Copiloto cuando lo necesita.")}
          </p>
        </CardHeader>
        <CardContent>
          <ConocimientoPanel />
        </CardContent>
      </Card>
      </Seccion>
    </Pagina>
  );
}

function ItemCard({ item, t }: { item: Item; t: T }) {
  return (
    <li className="flex flex-col gap-1.5 rounded-md bg-muted/35 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">{item.titulo}</span>
        <PrioridadBadge prioridad={item.prioridad} t={t} />
      </div>
      <p className="text-sm text-muted-foreground">{item.motivo}</p>
      <p className="text-xs tabular-nums text-foreground/80">
        <span className="font-medium">{t("Evidencia:")} </span>{item.evidencia}
      </p>
      {item.impacto && (
        <p className="text-xs text-muted-foreground">
          <span className="font-medium">{t("Impacto potencial:")} </span>{item.impacto}
        </p>
      )}
      <p className="text-[11px] text-muted-foreground">{t("Período analizado: {periodo}", { periodo: item.periodo })}</p>
    </li>
  );
}

function PrioridadBadge({ prioridad, t }: { prioridad: Prioridad; t: T }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "h-5 px-1.5 text-[10px] font-normal capitalize",
        prioridad === "alta" && "border-rose-500/40 text-rose-700 dark:text-rose-400",
        prioridad === "media" && "border-amber-500/40 text-amber-700 dark:text-amber-400",
        prioridad === "baja" && "text-muted-foreground"
      )}
    >
      {t(ETIQUETA_PRIORIDAD[prioridad])}
    </Badge>
  );
}
