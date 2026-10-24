import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Marca } from "@/components/dashboard/logo-marca";
import { NotaDato, PageHeader } from "@/components/dashboard/page-header";
import { Pagina } from "@/components/movimiento/pagina";
import { FiltroPeriodo } from "@/components/dashboard/filtro-periodo";
import { TablaRanking } from "@/components/dashboard/tabla-ranking";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SerieAniosChart } from "@/components/charts/serie-anios-chart";
import { DistribucionChart } from "@/components/charts/distribucion-chart";
import { SelectorFuente } from "@/components/dashboard/selector-fuente";
import { SelectorAniosSerie } from "@/components/dashboard/selector-anios-serie";
import { Seccion } from "@/components/dashboard/seccion";
import { AccionesSemana } from "@/components/dashboard/acciones-semana";
import { Panorama, type DatosPanorama } from "@/components/bento/panorama";
import {
  acotarAFuente, conPuestoDeMercado, getCobertura, getKpi, getOpcionesFiltro, getPorDimension,
  getRankingGrupos, getRankingMarcas, getRankingModelos, getRankingVersiones, getSerieMensual, type Fuente,
} from "@/lib/cadam/mercado";
import { getMarcasPropiasSet, getParametros } from "@/lib/cadam/config";
import {
  armarTreemap, estacionalidad, marcasPropias, participacionPropiaMensual, serieDeAnio,
} from "@/lib/cadam/panorama";
import { aniosDeSerie, filtroDesdeUrl, type SearchParams } from "@/lib/periodo";
import { getI18n } from "@/lib/i18n/servidor";
import { serieAAnios, techoComun } from "@/lib/serie";

export default async function MercadoPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const { t, tr, fmt } = await getI18n();
  const { formatUnidades, etiquetaPeriodo, mesCorto, etiquetaCortes } = fmt;
  const cobertura = getCobertura();
  // Fuente activa: manda sobre los cortes por dimension, el ranking y
  // TAMBIEN sobre hasta que mes se puede pedir. La importacion suele ir un
  // mes adelante de la matriculacion (el informe de CADAM llega antes que
  // el detalle), y topar todo con la matriculacion escondia ese mes.
  const fuente: Fuente = sp.fuente === "importacion" ? "importacion" : "matriculacion";
  const esImportacion = fuente === "importacion";
  const etiquetaFuente = esImportacion ? t("importaciones") : t("matriculaciones");
  const f = filtroDesdeUrl(sp, cobertura[fuente].ultimo);
  const periodo = etiquetaPeriodo(f.anio, f.mesDesde, f.mesHasta);

  // Las dos fuentes no llegan parejas, y no siempre va adelante la misma:
  // en sep-2026 era la importación (agosto contra julio) y en oct-2026 es la
  // matriculación (septiembre contra agosto). Cada KPI se calcula hasta donde
  // llega SU fuente y lo dice; la diferencia importación − matriculación usa
  // el tramo que tienen las dos, porque restar un mes que una no publicó
  // todavía sería un número inventado.
  const fMat = acotarAFuente("matriculacion", f);
  const fImp = acotarAFuente("importacion", f);
  const fComun = { ...f, mesHasta: Math.max(f.mesDesde, Math.min(fMat.mesHasta, fImp.mesHasta)) };
  const matricRecorta = fMat.mesHasta < f.mesHasta;
  const importRecorta = fImp.mesHasta < f.mesHasta;
  const comunRecorta = fComun.mesHasta < f.mesHasta;
  const periodoMat = etiquetaPeriodo(fMat.anio, fMat.mesDesde, fMat.mesHasta);
  const periodoImp = etiquetaPeriodo(fImp.anio, fImp.mesDesde, fImp.mesHasta);
  const periodoComun = etiquetaPeriodo(fComun.anio, fComun.mesDesde, fComun.mesHasta);
  const mesesSinPublicar = (desde: number, hasta: number) =>
    desde >= hasta ? mesCorto(hasta) : `${mesCorto(desde)}–${mesCorto(hasta)}`;

  const matric = getKpi("matriculacion", f);
  const import_ = getKpi("importacion", f);
  const matricComun = comunRecorta ? getKpi("matriculacion", fComun) : matric;
  const importComun = comunRecorta ? getKpi("importacion", fComun) : import_;

  // Los graficos respetan los mismos filtros que los KPIs (segmento,
  // tecnologia, marca), pero NO el rango de meses: muestran el ano
  // completo para que se vea la estacionalidad.
  const cortes = { segmento: f.segmento, tecnologia: f.tecnologia, marca: f.marca, empresa: f.empresa };
  // Los años del gráfico salen del filtro `anios` (chips), no del año del
  // KPI: se puede mirar 2022–2026 en la serie sin mover las cifras de arriba.
  const aniosMat = aniosDeSerie(sp, f.anio, cobertura.matriculacion.anios);
  const aniosImp = aniosDeSerie(sp, f.anio, cobertura.importacion.anios);
  const serieMat = serieAAnios(getSerieMensual("matriculacion", aniosMat, cortes), aniosMat);
  const serieImp = serieAAnios(getSerieMensual("importacion", aniosImp, cortes), aniosImp);
  // Los dos gráficos van lado a lado: con el mismo techo, la altura compara.
  const techoSerie = techoComun(serieMat, serieImp);

  const opciones = getOpcionesFiltro();
  const segmentos = getPorDimension(fuente, "segmento", f);
  // La base de importacion no trae columna de tecnologia: ese corte solo
  // existe del lado de matriculacion (ver CADAM/DATOS.md).
  const tecnologias = esImportacion ? [] : getPorDimension("matriculacion", "tecnologia", f);
  const marcas = getRankingMarcas(fuente, f);
  const modelos = getRankingModelos(fuente, f);
  // Version solo existe en matriculacion: la base de importacion llega
  // hasta el modelo.
  const versiones = esImportacion ? [] : getRankingVersiones(f);

  // Etiqueta del período contra el que se compara: 'Ene–Jun 2026' -> 'Ene–Jun 2025'.
  const periodoPrevio = periodo.replace(String(f.anio), String(f.anio - 1));

  const notaVar =
    ((esImportacion ? import_ : matric).baseDisponible
      ? t("Variación contra {periodo}.", { periodo: periodoPrevio })
      : t("Sin datos de {anio} para comparar.", { anio: f.anio - 1 })) +
    (f.segmento ? "" : ` ${t("Incluye livianos y pesados: filtrá por segmento para separarlos.")}`);

  // Ganadores y perdedores por variacion absoluta de unidades: es lo que
  // mueve el mercado. El % solo puede ser enorme sobre bases minimas.
  const conBase = marcas.filter((m) => m.unidadesAnterior > 0);
  // Participación de las marcas del grupo sobre el total del período. Sale de
  // `esPropia`, que ya viene en cada fila del ranking, así que sigue sola el
  // toggle matriculación/importación y todos los filtros de la página.
  const totalU = marcas.reduce((s, m) => s + m.unidades, 0);
  const propiasU = marcas.filter((m) => m.esPropia).reduce((s, m) => s + m.unidades, 0);
  // Sin datos en el filtro, totalU es 0: la división daría NaN.
  const participacionPropias = totalU > 0 ? propiasU / totalU : null;
  // Lo mismo un año antes, sobre el mismo tramo de meses. Sale del ranking del
  // período previo y no de `marcas`: ahí solo están las que vendieron AHORA, y
  // una marca nuestra que se apagó dejaría la participación previa más chica
  // de lo que fue y el cambio, inflado.
  const baseComparable = (esImportacion ? import_ : matric).baseDisponible;
  const marcasPrevias = baseComparable ? getRankingMarcas(fuente, { ...f, anio: f.anio - 1 }) : [];
  const totalPrevU = marcasPrevias.reduce((s, m) => s + m.unidades, 0);
  const propiasPrevU = marcasPrevias.filter((m) => m.esPropia).reduce((s, m) => s + m.unidades, 0);
  const cambioParticipacion =
    participacionPropias === null
      ? undefined
      : totalPrevU > 0
        ? participacionPropias - propiasPrevU / totalPrevU
        : null;
  // La lista sale de parametros.json, no escrita a mano: el tooltip que había
  // en la home enumeraba 10 marcas y se había quedado sin HAVAL.
  const nombresPropias = getParametros()
    .marcas_propias.map((m) => m.marca_cadam)
    .join(", ");

  // Hasta 10 por panel, pero filtrando por signo: con tope 5 todas las marcas
  // listadas eran perdedoras de verdad; al subir a 10 la lista se rellenaba
  // con las menos-positivas y aparecían marcas EN ALZA bajo el título
  // "Principales perdedores" (DODGE +66.7%). Si hay menos de 10 con variación
  // real, el panel muestra menos filas — mejor corto que falso.
  const TOPE_PANEL = 10;
  const delta = (m: (typeof conBase)[number]) => m.unidades - m.unidadesAnterior;
  const ganadores = conBase
    .filter((m) => delta(m) > 0)
    .sort((a, b) => delta(b) - delta(a))
    .slice(0, TOPE_PANEL);
  const perdedores = conBase
    .filter((m) => delta(m) < 0)
    .sort((a, b) => delta(a) - delta(b))
    .slice(0, TOPE_PANEL);

  const mesMax: Record<number, number> = {};
  for (const a of cobertura[fuente].anios) {
    mesMax[a] = a === cobertura[fuente].ultimo?.anio ? cobertura[fuente].ultimo.mes : 12;
  }

  // Sobre el mismo rango de meses para las dos, si no la resta no significa nada.
  // Si una de las dos no tiene ni un mes de la ventana pedida (solo septiembre,
  // con la importación en agosto), no hay tramo común y no se resta.
  const diferenciaPosible = !importComun.sinDatos && !matricComun.sinDatos;
  const diferencia = importComun.valor - matricComun.valor;

  // ------- Panorama (el bento de arriba): lo que cada tarjeta necesita, con los
  // mismos filtros que el resto de la pantalla.
  const propiasSet = getMarcasPropiasSet();
  const fFuente = esImportacion ? fImp : fMat;
  const mesUltimo = fFuente.mesHasta;
  const aniosBento = [f.anio - 1, f.anio];
  const puntosMat = getSerieMensual("matriculacion", aniosBento, cortes);
  const puntosImp = getSerieMensual("importacion", aniosBento, cortes);
  const puntosFuente = esImportacion ? puntosImp : puntosMat;
  const marcasUltimoMes = getRankingMarcas(fuente, { ...f, mesDesde: mesUltimo, mesHasta: mesUltimo });
  const treemap = armarTreemap([marcas, marcasPrevias, marcasUltimoMes]);
  const serieUlt = serieDeAnio(puntosFuente, f.anio)[mesUltimo - 1];
  const serieUltPrev = serieDeAnio(puntosFuente, f.anio - 1)[mesUltimo - 1];
  const variacionUltimoMes = serieUlt !== null && serieUltPrev !== null && serieUltPrev > 0 ? serieUlt / serieUltPrev - 1 : null;
  const participacionMensual = participacionPropiaMensual(fuente, aniosBento, cortes, propiasSet);
  const gruposDelPeriodo = getRankingGrupos(fuente, fFuente);
  const filaGrupoPropio = gruposDelPeriodo.find((g) => g.esPropio);
  const aniosEstacionales = [f.anio - 2, f.anio - 1, f.anio].filter((a) => cobertura.matriculacion.anios.includes(a));
  const estacional = estacionalidad(getSerieMensual("matriculacion", aniosEstacionales, cortes), aniosEstacionales);
  const panorama: DatosPanorama = {
    matriculaciones: {
      anio: f.anio, mesDesde: fMat.mesDesde, mesHasta: fMat.mesHasta, recorta: matricRecorta, sinDatos: matric.sinDatos,
      valor: matric.valor, variacion: matric.sinDatos ? null : matric.variacion, baseValor: matric.baseValor,
      actual: serieDeAnio(puntosMat, f.anio), previa: serieDeAnio(puntosMat, f.anio - 1),
      nota: t("Unidades matriculadas en el período. Comparación contra {periodo}: {n} u.", {
        periodo: periodoMat.replace(String(f.anio), String(f.anio - 1)), n: formatUnidades(matric.baseValor),
      }) + (matricRecorta ? ` ${t("CADAM todavía no publicó la matriculación de {meses}: la importación de ese mes ya está, la matriculación no.", { meses: mesesSinPublicar(fMat.mesHasta + 1, f.mesHasta) })}` : ""),
    },
    importaciones: {
      anio: f.anio, mesDesde: fImp.mesDesde, mesHasta: fImp.mesHasta, recorta: importRecorta, sinDatos: import_.sinDatos,
      valor: import_.valor, variacion: import_.sinDatos ? null : import_.variacion, baseValor: import_.baseValor,
      impActual: serieDeAnio(puntosImp, f.anio), impPrevia: serieDeAnio(puntosImp, f.anio - 1),
      matActual: serieDeAnio(puntosMat, f.anio), matPrevia: serieDeAnio(puntosMat, f.anio - 1),
      diferencia: diferenciaPosible
        ? { valor: diferencia, sobraImportacion: diferencia >= 0, periodo: comunRecorta ? periodoComun : null }
        : null,
      nota: t("Unidades importadas de vehículos livianos, una por una, según CADAM. No incluye camiones: se reportan aparte. Comparación contra {periodo}: {n} u.", {
        periodo: periodoImp.replace(String(f.anio), String(f.anio - 1)), n: formatUnidades(import_.baseValor),
      }) + (importRecorta ? ` ${t("CADAM todavía no publicó la importación de {meses}: la matriculación de ese mes ya está, la importación no.", { meses: mesesSinPublicar(fImp.mesHasta + 1, f.mesHasta) })}` : ""),
      notaDiferencia: t("Señal orientativa, NO stock real: hay desfasajes temporales, unidades importadas en períodos anteriores, reexportaciones y registros tardíos."),
    },
    treemap: {
      items: treemap.items, totales: treemap.totales, anio: f.anio, mesDesde: fFuente.mesDesde, mesHasta: fFuente.mesHasta,
      mesUltimo, variacionPeriodo: (esImportacion ? import_ : matric).sinDatos ? null : (esImportacion ? import_ : matric).variacion,
      variacionUltimoMes, fuente,
    },
    participacion: {
      anio: f.anio, mesDesde: fFuente.mesDesde, mesHasta: fFuente.mesHasta, participacion: participacionPropias,
      cambioPp: cambioParticipacion, unidadesPropias: propiasU, unidadesMercado: totalU,
      mensual: participacionMensual[f.anio] ?? Array(12).fill(null),
      mensualPrevia: participacionMensual[f.anio - 1] ?? Array(12).fill(null),
      grupo: filaGrupoPropio
        ? { puesto: filaGrupoPropio.posicion, de: gruposDelPeriodo.length, puestoAntes: filaGrupoPropio.posicionAnterior }
        : null,
      nota: t("{marcas}, sobre el total de {fuente} del período filtrado.", { marcas: nombresPropias, fuente: etiquetaFuente }),
      fuente,
    },
    marcas: {
      marcas: marcasPropias(marcas),
      totalConVentas: marcas.filter((m) => m.esPropia && m.unidades > 0).length,
      fuente,
      periodoPrevio: periodoPrevio,
    },
    estacionalidad: estacional.length ? { anios: estacional } : null,
  };

  return (
    <Pagina>
      <PageHeader
        titulo={t("Resumen del mercado")}
        descripcion={t("Analizando {fuente} · {periodo} vs. mismo período {previo}.", { fuente: etiquetaFuente, periodo, previo: f.anio - 1 })}
        fuente={t("Fuente: CADAM / DNRA · {cortes}.", { cortes: etiquetaCortes(cobertura) })}
      />

      {/* El sticky va acá y no en FiltroPeriodo (de ahí el pegajoso={false}):
          esta página le suma el selector de fuente al lado, y si solo se
          pegara el filtro, el toggle Matriculaciones/Importaciones se quedaría
          scrolleando solo. Fondo propio porque la fila tiene gaps entre las
          dos tarjetas por donde asomaría el contenido de atrás. */}
      <div
        data-revelar=""
        className="barra-pegajosa relative -mx-1 flex flex-col gap-3 rounded-xl px-1 py-1 sm:sticky sm:top-16 sm:z-30 sm:flex-row sm:flex-wrap sm:items-end"
      >
        {/* Fondo y sombra solo cuando la barra está pegada arriba (ver
            .barra-pegajosa en globals.css). El fondo es opaco: el texto que
            pasa por detrás asomaba entre las dos tarjetas con el velo
            translúcido de antes. */}
        <span aria-hidden="true" className="pegada-fondo" />
        <span aria-hidden="true" className="pegada-sombra" />
        <SelectorFuente porDefecto="matriculacion" fuente={fuente} />
        <div className="min-w-0 sm:flex-1">
          <FiltroPeriodo
            pegajoso={false}
            anios={cobertura[fuente].anios}
            mesMaximoPorAnio={mesMax}
            opciones={[
              { param: "marca", label: t("Marca"), valores: opciones.marcas },
              { param: "segmento", label: t("Segmento"), valores: opciones.segmentos },
              ...(esImportacion
                ? []
                : [{
                    param: "tecnologia",
                    label: t("Tecnología"),
                    valores: ["ICE", "MHEV", "HEV", "PHEV", "REEV", "EV"],
                  }]),
            ]}
          />
        </div>
      </div>

      {/* Lo primero después del filtro: qué hacer esta semana. Las cifras
          del mercado vienen después; el gerente entra a decidir, no a mirar. */}
      <AccionesSemana f={f} periodo={periodo} />

      {/* El Panorama reemplaza a la fila de cinco indicadores: las mismas cifras
          (matriculaciones, importaciones, diferencia, participación propia, quién
          lidera) con su historia al lado. Ver components/bento/. */}
      <Panorama datos={panorama} />

      <Seccion titulo={t("Evolución del mercado")}
        nota={t("Cómo se mueve el mercado mes a mes, en chapas puestas y en unidades que entraron al país. Los dos gráficos comparten escala.")}
        accion={<SelectorAniosSerie anios={cobertura[fuente].anios} />}>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("Evolución mensual — matriculaciones")}</CardTitle>
            {/* lg:min-h-8 (dos renglones) en los dos subtítulos: con uno de
                una línea y otro de dos, los gráficos arrancaban a alturas
                distintas y la escala compartida no se podía comparar a ojo. */}
            <p className="text-xs text-muted-foreground lg:min-h-8">
              {t("Chapas puestas por mes, una línea por año. Es el mercado que ya se vendió.")}
            </p>
          </CardHeader>
          <CardContent>
            <SerieAniosChart series={serieMat} maximo={techoSerie} />
            {cobertura.mesesFaltantes.matriculacion.length > 0 && (
              <p className="mt-2 text-xs text-muted-foreground">
                {t("Los meses sin dato quedan como hueco en la línea, no como cero. Faltante detectado en el origen: {meses}.", { meses: cobertura.mesesFaltantes.matriculacion.join(", ") })}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("Evolución mensual — importaciones")}</CardTitle>
            <p className="text-xs text-muted-foreground lg:min-h-8">
              {t("Unidades que entraron al país por mes. Va adelante de la matriculación: lo que sube acá se vende en los meses que siguen.")}
            </p>
          </CardHeader>
          <CardContent>
            {serieImp.length ? (
              <SerieAniosChart series={serieImp} maximo={techoSerie} />
            ) : (
              <p className="py-16 text-center text-sm text-muted-foreground">
                {t("Sin datos de importación para estos años.")}
              </p>
            )}
          </CardContent>
        </Card>

      </div>
      </Seccion>

      <Seccion titulo={t("Segmentos y tecnología")}
        nota={t("Qué tipo de vehículo y qué motorización está comprando el paraguayo, y para dónde se está moviendo.")}>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>
              {t("Participación por segmento — {fuente}", { fuente: etiquetaFuente })}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <DistribucionChart
              datos={segmentos.map((s) => ({ nombre: s.valor, valor: s.unidades }))}
              param="segmento"
            />
            <p className="text-xs text-muted-foreground">
              {t("Hacé clic en una barra para filtrar toda la página por ese segmento; otro clic lo quita.")}
            </p>
            {segmentos.some((s) => s.valor === "Sin clasificar") && (
              <NotaDato>
                {t("CADAM no clasifica el segmento antes de 2024. Las unidades sin segmento se muestran aparte, no se reparten entre los demás.")}
              </NotaDato>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              {/* La tecnologia solo existe en matriculacion, asi que el
                  titulo la nombra siempre: aclara de donde sale el dato
                  aunque arriba este elegida la otra fuente. */}
              {t("Participación por tecnología — matriculaciones")}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {esImportacion ? (
              <>
                <p className="py-16 text-center text-sm text-muted-foreground">
                  {t("Sin corte por tecnología para importaciones.")}
                </p>
                <NotaDato>
                  {t("La base de importación de CADAM no trae columna de tecnología. El detalle ICE/MHEV/HEV/PHEV/REEV/EV solo existe del lado de matriculación.")}
                </NotaDato>
              </>
            ) : (
              <>
                <DistribucionChart
                  datos={tecnologias.map((t) => ({ nombre: t.valor, valor: t.unidades }))}
                  param="tecnologia"
                />
                <p className="text-xs text-muted-foreground">
                  {t("Hacé clic en una barra para filtrar por esa tecnología.")}
                </p>
                <NotaDato>
                  {t("Cada tecnología se muestra por separado: MHEV no es HEV, PHEV no es HEV y REEV no es EV.")}
                </NotaDato>
              </>
            )}
          </CardContent>
        </Card>
      </div>
      </Seccion>

      <Seccion titulo={t("Quién gana y quién pierde")}
        nota={t("Las marcas que más unidades sumaron y las que más perdieron contra el mismo período del año pasado.")}>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <MoviminetoCard
          titulo={t("Principales ganadores — {fuente}", { fuente: etiquetaFuente })}
          subtitulo={t("Unidades ganadas frente a {previo} (mismo período del año anterior). El % solo se muestra con una base de {base} u. o más.", { previo: periodoPrevio, base: BASE_MINIMA_PCT })}
          filas={ganadores}
          positivo
          disponible={(esImportacion ? import_ : matric).baseDisponible}
        />
        <MoviminetoCard
          titulo={t("Principales perdedores — {fuente}", { fuente: etiquetaFuente })}
          subtitulo={t("Unidades perdidas frente a {previo} (mismo período del año anterior). El % solo se muestra con una base de {base} u. o más.", { previo: periodoPrevio, base: BASE_MINIMA_PCT })}
          filas={perdedores}
          positivo={false}
          disponible={(esImportacion ? import_ : matric).baseDisponible}
        />
      </div>

      </Seccion>

      <Seccion titulo={t("Rankings")}>
      <Card>
        <CardHeader>
          <CardTitle>{t("Rankings — {fuente}", { fuente: etiquetaFuente })}</CardTitle>
          <p className="text-xs text-muted-foreground">
            {t("Hacé clic en una marca, modelo o versión para filtrar toda la página; otro clic lo quita. Los filtros se acumulan entre sí y con los de arriba.")}
          </p>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="marcas">
            <TabsList className="flex-wrap">
              <TabsTrigger value="marcas">{t("Marcas ({n})", { n: marcas.length })}</TabsTrigger>
              <TabsTrigger value="modelos">{t("Modelos ({n})", { n: modelos.length })}</TabsTrigger>
              <TabsTrigger value="versiones">
                {esImportacion ? t("Versiones") : t("Versiones ({n})", { n: versiones.length })}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="marcas" className="mt-3">
              <TablaRanking
                filas={conPuestoDeMercado(fuente, marcas, f, "marca")}
                filtrarPor={{ marca: "marca" }}
                nombreArchivo={`ranking-marcas-${fuente}-${f.anio}`}
                notaVariacion={notaVar}
              />
            </TabsContent>

            <TabsContent value="modelos" className="mt-3">
              <TablaRanking
                filas={conPuestoDeMercado(fuente, modelos, f, "modelo")}
                mostrarModelo
                mostrarSegmento
                etiquetaModelo={t("Modelo")}
                filtrarPor={{ marca: "marca", detalle: "modelo" }}
                nombreArchivo={`ranking-modelos-${fuente}-${f.anio}`}
                notaVariacion={notaVar}
              />
            </TabsContent>

            <TabsContent value="versiones" className="mt-3">
              {esImportacion ? (
                <NotaDato>
                  {tr("La base de importación de CADAM llega hasta el modelo (<code>HILUX</code>), no hasta la versión. El detalle por versión solo existe del lado de matriculación.")}
                </NotaDato>
              ) : (
                <>
                  <TablaRanking
                    filas={conPuestoDeMercado("matriculacion", versiones, f, "version")}
                    mostrarModelo
                    mostrarSegmento
                    etiquetaModelo={t("Versión")}
                    filtrarPor={{ marca: "marca", detalle: "version" }}
                    nombreArchivo={`ranking-versiones-${f.anio}`}
                    notaVariacion={notaVar}
                  />
                  <div className="mt-3">
                    <NotaDato>
                      {tr("CADAM no publica un campo de versión: esto es el nombre tal como lo carga la DNRA, que en la práctica incluye el acabado y a veces el motor (<code>HILUX D/C 4X4 SRV AUT</code>). No hay motor, transmisión ni tracción como campos aparte.")}
                    </NotaDato>
                  </div>
                </>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
      </Seccion>
    </Pagina>
  );
}

/** Debajo de esta base (unidades del año anterior) el % no dice nada: una marca
 *  que pasó de 1 a 2 «creció 100%» y una que pasó de 2 a 1 «cayó 50%» (FORLAND,
 *  QUANTUM y AGRALE salían en la lista de los que más perdieron con −50%). Las
 *  unidades sí se muestran: son lo que mueve el mercado. */
const BASE_MINIMA_PCT = 30;

async function MoviminetoCard({
  titulo, subtitulo, filas, positivo, disponible,
}: {
  titulo: string;
  subtitulo?: string;
  filas: { marca: string; unidades: number; unidadesAnterior: number; variacion: number | null; participacion: number }[];
  positivo: boolean;
  disponible: boolean;
}) {
  const { t, fmt } = await getI18n();
  const { formatPct, formatUnidades } = fmt;
  return (
    <Card>
      <CardHeader>
        <CardTitle>{titulo}</CardTitle>
        {subtitulo && (
          <p className="text-xs font-normal normal-case tracking-normal text-muted-foreground">
            {subtitulo}
          </p>
        )}
      </CardHeader>
      <CardContent>
        {!disponible ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {t("Sin período anterior cargado para comparar.")}
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {filas.map((m) => {
              const delta = m.unidades - m.unidadesAnterior;
              return (
                <li key={m.marca} className="flex items-baseline justify-between gap-3 text-sm">
                  <Marca marca={m.marca} claseNombre="font-medium" />
                  <span className="flex items-baseline gap-3 tabular-nums">
                    {/* 700 y no 600: a 14 px sobre blanco el 600 no llega a 4,5:1. */}
                    <span className={positivo ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400"}>
                      {delta > 0 ? "+" : ""}{t("{n} u.", { n: formatUnidades(delta) })}
                    </span>
                    <span
                      className="w-16 text-right text-xs text-muted-foreground"
                      title={m.unidadesAnterior < BASE_MINIMA_PCT ? t("Base de {n} u.: el % no es comparable", { n: m.unidadesAnterior }) : undefined}
                    >
                      {m.unidadesAnterior >= BASE_MINIMA_PCT ? formatPct(m.variacion, { signed: true }) : "—"}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
