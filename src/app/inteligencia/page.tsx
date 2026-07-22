import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NotaDato, PageHeader } from "@/components/dashboard/page-header";
import { FiltroPeriodo } from "@/components/dashboard/filtro-periodo";
import { Badge } from "@/components/ui/badge";
import { getCobertura, getOpcionesFiltro } from "@/lib/cadam/mercado";
import { generarInforme, type Item, type Prioridad, type Tipo } from "@/lib/cadam/inteligencia";
import { etiquetaPeriodo, filtroDesdeUrl, type SearchParams } from "@/lib/periodo";
import { cn } from "@/lib/utils";
import {
  AlertTriangle, History, Lightbulb, Search, ShieldAlert, TrendingUp,
} from "lucide-react";

const SECCIONES: { tipo: Tipo; titulo: string; icono: React.ElementType; descripcion: string }[] = [
  { tipo: "alerta", titulo: "Alertas", icono: AlertTriangle,
    descripcion: "Movimientos que requieren atención inmediata." },
  { tipo: "oportunidad", titulo: "Oportunidades", icono: Lightbulb,
    descripcion: "Espacios donde hay lugar para crecer." },
  { tipo: "riesgo", titulo: "Riesgos", icono: ShieldAlert,
    descripcion: "Amenazas a la posición actual." },
  { tipo: "hallazgo", titulo: "Hallazgos relevantes", icono: Search,
    descripcion: "Lo que muestran los datos del período." },
  { tipo: "historico", titulo: "Lectura histórica", icono: History,
    descripcion:
      "Sobre toda la serie cargada, no solo el período: estacionalidad, " +
      "tendencia de fondo, meses atípicos y proyección de cierre." },
];

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

      <Card>
        <CardHeader>
          <CardTitle className="inline-flex items-center gap-2">
            <TrendingUp className="size-4" />
            Resumen ejecutivo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-col gap-2">
            {informe.resumen.map((r, i) => (
              <li key={i} className="text-sm leading-relaxed">{r}</li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {SECCIONES.map(({ tipo, titulo, icono: Icono, descripcion }) => {
        const items = informe.items.filter((i) => i.tipo === tipo);
        return (
          <Card key={tipo}>
            <CardHeader>
              <CardTitle className="inline-flex items-center gap-2">
                <Icono className="size-4" />
                {titulo}
                <span className="font-normal text-muted-foreground">({items.length})</span>
              </CardTitle>
              <p className="text-xs text-muted-foreground">{descripcion}</p>
            </CardHeader>
            <CardContent>
              {items.length ? (
                <ul className="flex flex-col gap-4">
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
        Este centro funciona con <strong>reglas y cálculos</strong>, sin
        inteligencia artificial externa. Cada punto muestra la evidencia numérica
        de la que sale. Para evitar conclusiones falsas, las reglas{" "}
        <strong>ignoran las bases menores a 30 unidades</strong>: un &ldquo;+800%&rdquo;
        que va de 1 a 9 unidades no dice nada del mercado.
      </NotaDato>
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
        "h-5 px-1.5 text-[10px] font-normal",
        prioridad === "alta" && "border-rose-500/40 text-rose-600 dark:text-rose-400",
        prioridad === "media" && "border-amber-500/40 text-amber-600 dark:text-amber-500",
        prioridad === "baja" && "text-muted-foreground"
      )}
    >
      prioridad {prioridad}
    </Badge>
  );
}
