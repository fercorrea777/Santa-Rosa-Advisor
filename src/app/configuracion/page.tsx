import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NotaDato, PageHeader } from "@/components/dashboard/page-header";
import { getParametros } from "@/lib/cadam/config";
import { getPeriodoInfo } from "@/lib/cadam/queries";
import { EditorConfiguracion } from "./editor";

// Los formularios escriben parametros.json: si esto quedara estatico, la
// pagina serviria para siempre los valores del build.
export const dynamic = "force-dynamic";

export default function ConfiguracionPage() {
  const parametros = getParametros();
  const info = getPeriodoInfo();

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        titulo="Configuración"
        descripcion="Metas y competidores se editan acá y se guardan en parametros.json — el mismo archivo que la app ya leía. Un solo lugar, sin duplicados."
      />

      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
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

      <EditorConfiguracion
        metas={parametros.metas}
        competidores={parametros.competidores_clave}
      />

      <NotaDato>
        Las <strong>marcas propias no se editan desde acá</strong>, a propósito:
        son el numerador del share en todo el tablero y el vínculo con los
        nombres exactos de CADAM. Un cambio distraído acá serían cifras mal
        calculadas en doce pantallas — se tocan en el archivo, a conciencia.
      </NotaDato>

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
    </div>
  );
}

