import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NotaDato, PageHeader } from "@/components/dashboard/page-header";
import { Pagina } from "@/components/movimiento/pagina";
import { Seccion } from "@/components/dashboard/seccion";
import { Marca } from "@/components/dashboard/logo-marca";
import { getMetasMensuales, getParametros, getPresupuesto } from "@/lib/cadam/config";
import { hoyEnAsuncion } from "@/lib/format";
import { EditorMetasMensuales } from "./metas";
import { CatalogoTransmision } from "./transmision";
import { getPeriodoInfo } from "@/lib/cadam/queries";
import {
  DOMINIO_CORREO, listarAuditoria, listarUsuarios, type EventoAuditoria, type Usuario,
} from "@/lib/auth/usuarios";
import { hayCorreo } from "@/lib/auth/correo";
import { getVentasPropias } from "@/lib/informes/propios";
import { EditorConfiguracion } from "./editor";
import { PanelUsuarios } from "./usuarios";

// Los formularios escriben parametros.json: si esto quedara estatico, la
// pagina serviria para siempre los valores del build.
export const dynamic = "force-dynamic";

export default async function ConfiguracionPage() {
  const parametros = getParametros();
  const info = getPeriodoInfo();
  const anioMetas = Number(hoyEnAsuncion().slice(0, 4));
  const presupuesto = getPresupuesto(anioMetas);
  // Lo facturado en Cars por marca y mes del año, para verlo debajo de cada
  // meta. Si Cars no responde, la grilla sale sin esa línea.
  let facturado: Record<string, number[]> | null = null;
  try {
    facturado = {};
    for (const v of await getVentasPropias()) {
      if (!v.periodo.startsWith(`${anioMetas}-`)) continue;
      const mes = Number(v.periodo.slice(5, 7));
      const fila = (facturado[v.marca] ??= Array(12).fill(0));
      fila[mes - 1] += v.unidades;
    }
  } catch {
    facturado = null;
  }

  // Los usuarios viven en Postgres y el resto de esta pantalla no. Si la base
  // no responde, se muestra el aviso SOLO en esa tarjeta: metas y
  // competidores salen de parametros.json y no tienen por que caerse con ella.
  let usuarios: Usuario[] = [];
  let auditoria: EventoAuditoria[] = [];
  let errorUsuarios: string | undefined;
  try {
    usuarios = await listarUsuarios();
    auditoria = await listarAuditoria(60);
  } catch (e) {
    errorUsuarios =
      `No se pudo leer la lista de usuarios: ${(e as Error).message}. ` +
      `Mientras tanto se entra con la clave general.`;
  }

  return (
    <Pagina>
      <PageHeader
        titulo="Configuración"
        descripcion="Quién entra, qué metas se persiguen y qué catálogo usa el tablero. Metas y competidores se guardan en parametros.json, el mismo archivo que la app ya leía."
        fuente={info ? `Último informe CADAM: ${info.periodo} · ${info.anioActual} (ene–mes ${info.mesMax}) vs. ${info.anioAnterior}.` : "Sin informes ingestados."}
      />

      <Seccion
        titulo="Acceso"
        nota="Cada persona entra con su correo de la empresa. Los administradores manejan usuarios y ven costos y márgenes; los lectores ven el tablero."
      >
        <PanelUsuarios
          usuarios={usuarios}
          error={errorUsuarios}
          dominio={DOMINIO_CORREO}
          hayCorreo={hayCorreo()}
          auditoria={auditoria}
        />
      </Seccion>

      <Seccion
        titulo="Metas"
        nota="Contra esto se mide el tablero: el share y el ranking objetivo en el Centro de Inteligencia, y las unidades por marca y mes en Nuestra operación."
      >
        <EditorConfiguracion
          anio={anioMetas}
          metas={parametros.metas}
          competidores={parametros.competidores_clave}
        />
        <EditorMetasMensuales
          anio={anioMetas}
          anios={[anioMetas - 1, anioMetas, anioMetas + 1]}
          marcas={parametros.marcas_propias.map((m) => m.marca_cadam)}
          metas={getMetasMensuales(anioMetas)}
          grupos={presupuesto?.grupos.map((g) => g.marcas) ?? []}
          facturado={facturado}
          presupuesto={
            presupuesto
              ? {
                  version: presupuesto.version,
                  archivo: presupuesto.archivo,
                  modificado: presupuesto.modificado,
                  cargado_en: presupuesto.cargado_en,
                  anual: Object.fromEntries(
                    presupuesto.grupos.map((g) => [g.marcas[0], g.presupuesto_anual])
                  ),
                }
              : null
          }
        />
      </Seccion>

      <Seccion
        titulo="Catálogo"
        nota="Lo que el tablero da por sabido: qué marcas son nuestras y qué caja lleva cada familia."
      >
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Marcas propias</CardTitle>
            <p className="text-xs text-muted-foreground">
              Las marcas que la casa distribuye y con qué grupo las presupuesta
              Finanzas. De esta lista sale qué filas van resaltadas en todo el
              tablero y qué se cuenta como «nuestro».
            </p>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <ul className="grid grid-cols-1 gap-x-6 sm:grid-cols-2 lg:grid-cols-3">
              {parametros.marcas_propias.map((m) => (
                <li
                  key={m.marca_cadam}
                  className="flex min-w-0 items-center justify-between gap-3 border-b py-2 text-sm"
                >
                  <Marca marca={m.marca_cadam} claseNombre="font-medium" />
                  <span className="truncate text-xs text-muted-foreground" title={m.submarca ?? undefined}>
                    {m.grupo}
                  </span>
                </li>
              ))}
            </ul>
            <NotaDato>
              Las <strong>marcas propias no se editan desde acá</strong>, a propósito:
              son el numerador del share en todo el tablero y el vínculo con los
              nombres exactos de CADAM. Un cambio distraído acá serían cifras mal
              calculadas en doce pantallas — se tocan en el archivo, a conciencia.
            </NotaDato>
          </CardContent>
        </Card>
        <CatalogoTransmision anio={anioMetas} />
      </Seccion>
    </Pagina>
  );
}

