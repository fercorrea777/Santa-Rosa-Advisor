import { Badge } from "@/components/ui/badge";
import { LogoMarca } from "@/components/dashboard/logo-marca";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { CambioPosicion, ParteYPuesto, Variacion } from "@/components/dashboard/celdas-ranking";
import type { FilaGrupo } from "@/lib/cadam/mercado";
import { GRUPO_RESTO, REPARTO_POR_MARCA } from "@/lib/cadam/grupos";
import {
  formatPct, formatPuntosPct, formatUnidades, nombreDeGrupo, nombreDeMarca,
} from "@/lib/format";
import { cn } from "@/lib/utils";

/** Cuántos logos entran en la fila; el resto va como «+N» y el detalle completo,
 *  con unidades, en el tooltip. */
const LOGOS_VISIBLES = 6;

/** «Chevrolet (40 %)»: una marca repartida entre varios grupos dice qué parte
 *  de ella es de ESTE grupo, para que nadie crea que Garden vende todos los
 *  Chevrolet ni que De la Sobera no vende ninguno. */
function etiquetaDeMarca(m: FilaGrupo["marcas"][number]): string {
  return m.parte !== undefined
    ? `${nombreDeMarca(m.marca)} (${Math.round(m.parte * 100)} %)`
    : nombreDeMarca(m.marca);
}

function detalleDeMarcas(marcas: FilaGrupo["marcas"]): string {
  return marcas.map((m) => `${etiquetaDeMarca(m)} ${formatUnidades(m.unidades)}`).join(" · ");
}

/**
 * Las marcas del grupo, con su logo: «Garden» es un nombre y no dice qué hay
 * adentro; los emblemas se reconocen antes que las palabras (mismo criterio que
 * las tablas de marcas). El nombre de cada marca va en el tooltip y, completo y
 * con unidades, en un texto solo para el lector de pantalla: el chip del logo
 * es decorativo. Una marca repartida lleva su porcentaje pegado al logo.
 */
function MarcasDelGrupo({ marcas }: { marcas: FilaGrupo["marcas"] }) {
  const visibles = marcas.slice(0, LOGOS_VISIBLES);
  const resto = marcas.slice(LOGOS_VISIBLES);
  return (
    <span className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-2">
      {visibles.map((m) => (
        <span key={m.marca} className="relative" title={`${etiquetaDeMarca(m)} · ${formatUnidades(m.unidades)} u.`}>
          <LogoMarca marca={m.marca} />
          {m.parte !== undefined && (
            <span
              aria-hidden="true"
              className="absolute -bottom-1.5 -right-1 rounded bg-primary px-1 text-[9px] font-semibold leading-3 text-primary-foreground"
            >
              {Math.round(m.parte * 100)}%
            </span>
          )}
        </span>
      ))}
      {resto.length > 0 && (
        <span
          className="rounded-md bg-muted px-1.5 py-1 text-[11px] font-medium text-muted-foreground"
          title={detalleDeMarcas(resto)}
        >
          +{resto.length}
        </span>
      )}
      <span className="sr-only">{detalleDeMarcas(marcas)}</span>
    </span>
  );
}

/**
 * Ranking por GRUPO: cada fila es un importador con todas sus marcas juntas,
 * el puesto que ocupa y el que ocupaba en el mismo período del año anterior.
 *
 * Por qué «Antes» es una columna con nombre y no solo una flecha: la pregunta
 * de la reunión es «¿en qué puesto estaba Garden?», y la flecha dice cuánto
 * se movió pero no dónde estaba. Acá se lee los dos: el puesto de hoy a la
 * izquierda, el de antes (con su flecha) a la derecha.
 *
 * Mismo criterio que la tabla de marcas: lista de tarjetas en el celular y
 * tabla desde sm; la fila del grupo propio va teñida y con su chapa.
 */
export function TablaGrupos({ filas, anioAnterior }: { filas: FilaGrupo[]; anioAnterior: number }) {
  if (!filas.length) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Sin datos para este filtro.
      </p>
    );
  }
  const hayBase = filas.some((f) => f.posicionAnterior !== null || f.unidadesAnterior > 0);
  // Con segmento o tecnología puestos las filas traen además su puesto y su
  // participación en el mercado ENTERO (ver getRankingGrupos).
  const conMercado = filas.some((f) => f.posicionMercado !== undefined);
  // Sale de la misma constante que hace la cuenta: el texto no puede quedar
  // diciendo 35 % si alguien cambia el reparto a 35.
  const repartoDeChevrolet = REPARTO_POR_MARCA.CHEVROLET
    .map((p) => `${p.grupo === GRUPO_RESTO ? "Otros" : nombreDeGrupo(p.grupo)} ${Math.round(p.parte * 100)} %`)
    .join(", ");

  return (
    <div className="flex flex-col gap-3">
      {/* Celular: una tarjeta por grupo. */}
      <ul className="flex flex-col divide-y sm:hidden">
        {filas.map((f) => (
          <li
            key={f.grupo}
            className={cn("flex flex-col gap-1.5 py-3", f.esPropio && "-mx-3 rounded-md bg-primary/5 px-3")}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-2">
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{f.posicion}</span>
                <span className="min-w-0 truncate font-medium">{nombreDeGrupo(f.grupo)}</span>
                {f.esPropio && <Badge className="h-5 shrink-0 px-1.5 text-[10px]">propio</Badge>}
              </span>
              <AntesDelGrupo f={f} anioAnterior={anioAnterior} />
            </div>
            <div className="pl-6">
              <MarcasDelGrupo marcas={f.marcas} />
            </div>
            {conMercado && (
              <p className="pl-6 text-xs text-muted-foreground">
                En el mercado: <span className="font-medium text-foreground">{f.posicionMercado ? `#${f.posicionMercado}` : "—"}</span>
                {" · "}
                <span className="tabular-nums">{f.participacionMercado == null ? "—" : formatPct(f.participacionMercado)}</span>
              </p>
            )}
            <div className="flex items-baseline justify-between pl-6">
              <span className="font-mono text-lg font-semibold tabular-nums">{formatUnidades(f.unidades)}</span>
              <span className="flex items-center gap-3 text-xs">
                <span className="tabular-nums text-muted-foreground">
                  {formatPct(f.participacion)}{conMercado ? " del filtro" : ""}
                </span>
                <Variacion v={f.variacion} entrante={f.unidadesAnterior === 0 && hayBase} />
              </span>
            </div>
          </li>
        ))}
      </ul>

      <div className="hidden sm:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-0" nota={conMercado ? "en el filtro" : undefined}>#</TableHead>
              <TableHead>Grupo</TableHead>
              <TableHead className={cn("text-right", conMercado && "min-w-0")} nota="las del período">Unidades</TableHead>
              {conMercado && (
                <TableHead className="min-w-0 text-right" nota="parte y puesto, sin filtros">Mercado</TableHead>
              )}
              <TableHead
                className="text-right"
                nota={conMercado ? "sobre lo filtrado y cuánto cambió" : "su parte y cuánto cambió en puntos"}
              >
                {conMercado ? "Part. filtro" : "Part."}
              </TableHead>
              <TableHead className={cn("text-right", conMercado && "min-w-0")} nota="contra el año pasado">Var.</TableHead>
              <TableHead className={cn("text-right", conMercado && "min-w-0")} nota={`su puesto en ${anioAnterior}`}>Antes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filas.map((f) => (
              <TableRow key={f.grupo} className={cn(f.esPropio && "bg-primary/5 hover:bg-primary/10")}>
                <TableCell className="align-top tabular-nums text-muted-foreground">{f.posicion}</TableCell>
                <TableCell className="align-top">
                  <span className="flex items-center gap-2 font-medium">
                    {nombreDeGrupo(f.grupo)}
                    {f.esPropio && <Badge className="h-5 px-1.5 text-[10px]">propio</Badge>}
                  </span>
                  <MarcasDelGrupo marcas={f.marcas} />
                </TableCell>
                <TableCell className="text-right align-top tabular-nums">{formatUnidades(f.unidades)}</TableCell>
                {conMercado && (
                  <TableCell className="text-right align-top tabular-nums">
                    <ParteYPuesto parte={f.participacionMercado} puesto={f.posicionMercado} />
                  </TableCell>
                )}
                <TableCell className="text-right align-top tabular-nums">
                  <span className="block">{formatPct(f.participacion)}</span>
                  {f.deltaShare !== null && (
                    <span className="block text-[11px] text-muted-foreground">{formatPuntosPct(f.deltaShare)}</span>
                  )}
                </TableCell>
                <TableCell className="text-right align-top tabular-nums">
                  <Variacion v={f.variacion} entrante={f.unidadesAnterior === 0 && hayBase} />
                </TableCell>
                <TableCell className="text-right align-top tabular-nums">
                  <AntesDelGrupo f={f} anioAnterior={anioAnterior} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <p className="text-xs text-muted-foreground">
        Un grupo es el importador que representa las marcas, según la lista de Fernando; lo que no
        está en ella va a Otros. Chevrolet se reparte: {repartoDeChevrolet}. «Antes» es el puesto
        del grupo en el mismo período de {anioAnterior}.
        {conMercado
          ? " «Mercado» es la parte y el puesto sobre el mercado entero, sin filtros; «#» y «Part. filtro», sobre lo que queda con el filtro."
          : ""}
      </p>
    </div>
  );
}

/** «#6 =», «#10 ▲2», «Nuevo»: dónde estaba y cuánto se movió. */
function AntesDelGrupo({ f, anioAnterior }: { f: FilaGrupo; anioAnterior: number }) {
  if (f.posicionAnterior === null) {
    return (
      <span className="text-xs text-muted-foreground" title={`No figuraba en ${anioAnterior}`}>
        {f.unidadesAnterior === 0 && f.deltaShare !== null ? "Nuevo" : "—"}
      </span>
    );
  }
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span className="text-muted-foreground" title={`Puesto en ${anioAnterior}`}>#{f.posicionAnterior}</span>
      <CambioPosicion cambio={f.cambioPosicion} anterior={f.posicionAnterior} />
    </span>
  );
}
