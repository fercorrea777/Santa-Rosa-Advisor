import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getParametros } from "@/lib/cadam/config";
import { getPeriodoInfo } from "@/lib/cadam/queries";

export default function ConfiguracionPage() {
  const parametros = getParametros();
  const info = getPeriodoInfo();

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 p-4 md:p-6">
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Configuración</h1>
        <Badge variant="outline" className="font-normal">
          Solo lectura por ahora
        </Badge>
      </div>
      <p className="text-sm text-muted-foreground">
        Esto es exactamente lo que hay hoy en{" "}
        <code className="rounded bg-muted px-1 py-0.5 text-xs">
          SANTA ROSA COMERCIAL ADVISOR/CADAM/parametros.json
        </code>{" "}
        — la app lo lee de ahí, no lo duplica. Editarlo desde acá (en vez de a mano en el archivo)
        queda para cuando haya persistencia real (Fase 2).
      </p>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Marcas propias</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {parametros.marcas_propias.map((m) => (
            <div
              key={m.marca_cadam}
              className="flex flex-col gap-0.5 rounded-md border px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between"
            >
              <span className="font-medium">{m.marca_cadam}</span>
              <span className="text-xs text-muted-foreground">
                {m.grupo}
                {m.submarca ? ` — ${m.submarca}` : ""}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Competidores clave</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-1.5">
          {parametros.competidores_clave.map((c) => (
            <Badge key={c} variant="secondary" className="font-normal">
              {c}
            </Badge>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Metas</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-1 text-sm">
          <MetaRow
            label="Participación de mercado 2026"
            value={parametros.metas.participacion_mercado_2026_pct}
          />
          <MetaRow label="Ranking objetivo 2026" value={parametros.metas.ranking_objetivo_2026} />
          <MetaRow
            label="Unidades objetivo mensual"
            value={parametros.metas.unidades_objetivo_mensual}
          />
          <p className="mt-2 text-xs text-muted-foreground">
            Todavía sin definir por el equipo comercial.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Datos cargados</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          {info ? (
            <p>
              Último informe: <span className="font-medium">{info.periodo}</span> ·{" "}
              {info.anioActual} (ene–mes {info.mesMax}) vs. {info.anioAnterior}
            </p>
          ) : (
            <p className="text-muted-foreground">Sin informes ingestados.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="flex items-center justify-between border-b py-1.5 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value ?? "— sin definir"}</span>
    </div>
  );
}
