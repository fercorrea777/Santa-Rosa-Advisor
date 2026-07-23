import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NotaDato, PageHeader } from "@/components/dashboard/page-header";
import { FiltroPeriodo } from "@/components/dashboard/filtro-periodo";
import { Badge } from "@/components/ui/badge";
import { InformesPanel } from "@/components/copiloto/informes-panel";
import { getCobertura, getOpcionesFiltro } from "@/lib/cadam/mercado";
import { generarInforme, type Item, type Prioridad, type Tipo } from "@/lib/cadam/inteligencia";
import { etiquetaPeriodo, filtroDesdeUrl, type SearchParams } from "@/lib/periodo";
import { cn } from "@/lib/utils";

const SECCIONES: { tipo: Tipo; titulo: string; descripcion: string; tono?: "azul" | "verde" | "ambar" }[] = [
  { tipo: "alerta", titulo: "Alertas",
    descripcion: "Movimientos que requieren atención inmediata." },
  { tipo: "oportunidad", titulo: "Oportunidades",
    descripcion: "Espacios donde hay lugar para crecer.", tono: "verde" },
  { tipo: "riesgo", titulo: "Riesgos",
    descripcion: "Amenazas a la posición actual." },
  { tipo: "hallazgo", titulo: "Hallazgos relevantes",
    descripcion: "Lo que muestran los datos del período." },
  { tipo: "historico", titulo: "Lectura histórica",
    descripcion:
      "Sobre toda la serie cargada, no solo el período: estacionalidad, " +
      "tendencia de fondo, meses atípicos y proyección de cierre." },
];

// alta primero: es el orden en el que el equipo comercial necesita leerlas.
const RANGO_PRIORIDAD: Record<Prioridad, number> = { alta: 0, media: 1, baja: 2 };

export default async function InteligenciaPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const cobertura = getCobertura();
  const f = filtroDesdeUrl(sp, cobertura.matriculacion.ultimo);
  const periodo = etiquetaPeriodo(f.anio, f.mesDesde, f.mesHasta);
  const opciones = getOpcionesFiltro();
  const informe = generarInforme(f, periodo);

  const mesMax: Record<number, number> = {};
  for (const a of cobertura.matriculacion.anios) {
    mesMax[a] = a === cobertura.matriculacion.ultimo?.anio
      ? cobertura.matriculacion.ultimo.mes : 12;
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        titulo="Centro de Inteligencia Comercial"
        descripcion={`Lectura automática del período · ${periodo} vs. ${f.anio - 1}.`}
        fuente={`Fuente: CADAM / DNRA · snapshot ${cobertura.snapshot ?? "—"}.`}
      />

      <FiltroPeriodo
        anios={cobertura.matriculacion.anios}
        mesMaximoPorAnio={mesMax}
        opciones={[{ param: "segmento", label: "Segmento", valores: opciones.segmentos }]}
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
                    {titulo}
                  </span>
                  <span className="metric text-2xl">{items.length}</span>
                  {alta > 0 && (
                    <span className="text-[11px] font-medium opacity-80">{alta} en prioridad alta</span>
                  )}
                </CardContent>
              </Card>
            </a>
          );
        })}
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Resumen ejecutivo</CardTitle>
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
                {titulo}{" "}
                <span className="font-normal text-muted-foreground">({items.length})</span>
              </CardTitle>
              <p className="text-xs text-muted-foreground">{descripcion}</p>
            </CardHeader>
            <CardContent>
              {items.length ? (
                <ul className="grid gap-3 lg:grid-cols-2">
                  {items.map((it, i) => <ItemCard key={i} item={it} />)}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Nada que reportar en este período con los umbrales actuales.
                </p>
              )}
            </CardContent>
          </Card>
        );
      })}

      <NotaDato>
        Estas {informe.items.length} lecturas salen de <strong>reglas y cálculos</strong>{" "}
        sobre la base interna, sin inteligencia artificial externa. Cada punto muestra
        la evidencia numérica de la que sale. Para evitar conclusiones falsas, las reglas{" "}
        <strong>ignoran las bases menores a 30 unidades</strong>: un &ldquo;+800%&rdquo;
        que va de 1 a 9 unidades no dice nada del mercado.
      </NotaDato>

      {/* Fuentes externas: a diferencia de todo lo de arriba (reglas sobre
          CADAM/DNRA), esto sale de búsqueda web + IA — precios de
          competencia, noticias, redes, tendencias globales. Mismo panel
          que la pestaña "Informes semanales" del Copiloto: una sola fuente
          de verdad para ese dato, no una segunda lectura de Postgres acá. */}
      <Card>
        <CardHeader>
          <CardTitle>Mercado y competencia (fuentes externas)</CardTitle>
          <p className="text-xs text-muted-foreground">
            Informe semanal automático: precios de competencia, noticias del sector,
            redes sociales y tendencias globales, con fuente y fecha citadas.
          </p>
        </CardHeader>
        <CardContent>
          <InformesPanel />
        </CardContent>
      </Card>
    </div>
  );
}

function ItemCard({ item }: { item: Item }) {
  return (
    <li className="flex flex-col gap-1.5 rounded-md bg-muted/35 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">{item.titulo}</span>
        <PrioridadBadge prioridad={item.prioridad} />
      </div>
      <p className="text-sm text-muted-foreground">{item.motivo}</p>
      <p className="text-xs tabular-nums text-foreground/80">
        <span className="font-medium">Evidencia: </span>{item.evidencia}
      </p>
      {item.impacto && (
        <p className="text-xs text-muted-foreground">
          <span className="font-medium">Impacto potencial: </span>{item.impacto}
        </p>
      )}
      <p className="text-[11px] text-muted-foreground/70">Período analizado: {item.periodo}</p>
    </li>
  );
}

function PrioridadBadge({ prioridad }: { prioridad: Prioridad }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "h-5 px-1.5 text-[10px] font-normal capitalize",
        prioridad === "alta" && "border-rose-500/40 text-rose-600 dark:text-rose-400",
        prioridad === "media" && "border-amber-500/40 text-amber-600 dark:text-amber-500",
        prioridad === "baja" && "text-muted-foreground"
      )}
    >
      {prioridad}
    </Badge>
  );
}
