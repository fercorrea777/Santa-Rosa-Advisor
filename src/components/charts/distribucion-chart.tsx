"use client";

import { EchartsAuto } from "@/components/charts/echarts-auto";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { TOOLTIP_BASE, useChartTheme } from "@/lib/chart-theme";
import { formatUnidades } from "@/lib/format";

export interface Parte {
  nombre: string;
  valor: number;
}

/**
 * Distribucion parte-sobre-total en BARRAS HORIZONTALES ordenadas de mayor
 * a menor. Antes era una dona (2026-09: reemplazadas en toda la app).
 *
 * Por que barras y no anillo:
 *  - comparar largos es preciso; comparar angulos no. Con 8-9 categorias la
 *    dona obligaba a leer la leyenda para saber cual era mas grande.
 *  - el nombre va sobre el eje, alineado a la izquierda: se lee sin leyenda
 *    y sin buscar que color le toco a cada porcion.
 *  - la cola larga sigue siendo legible. La dona no podia etiquetar las
 *    porciones chicas (de ahi el viejo `minLabel`) y quedaban mudas.
 *
 * Cada barra lleva su valor y su % al costado, asi que NO se dibuja el eje
 * X: ticks + etiquetas seria el mismo numero dos veces. El total va al pie
 * del grafico (antes iba al centro del anillo).
 *
 * Si se pasa `param`, la barra funciona como filtro: al hacer clic se
 * escribe `?{param}=<valor>` en la URL y toda la pagina se recalcula. Otro
 * clic sobre la misma barra lo quita. La activa queda encendida y las
 * demas en gris plano, para que se vea que hay un filtro aplicado.
 */
export function DistribucionChart({
  datos,
  param,
  maximo = 8,
  altura,
  paleta = false,
}: {
  datos: Parte[];
  /** Si se pasa, la barra filtra por este parametro de la URL. */
  param?: string;
  maximo?: number;
  /** Por defecto se calcula segun cuantas barras hay. */
  altura?: number;
  /** Un color por categoria en vez de un solo tono. Solo cuando el color
   *  ya significa algo en otro grafico de la misma pantalla (ej. los tres
   *  grupos de tecnologia, que se repiten en el apilado por año). */
  paleta?: boolean;
}) {
  const theme = useChartTheme();
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const activo = param ? sp.get(param) : null;

  const ordenados = [...datos].sort((a, b) => b.valor - a.valor);
  const visibles = ordenados.slice(0, maximo);
  const resto = ordenados.slice(maximo);
  if (resto.length) {
    visibles.push({
      nombre: `Otros (${resto.length})`,
      valor: resto.reduce((s, d) => s + d.valor, 0),
    });
  }
  const total = visibles.reduce((s, d) => s + d.valor, 0) || 1;

  // ECharts pinta el eje de categorias de abajo hacia arriba, asi que hay
  // que invertir para que la barra mas larga quede ARRIBA.
  const filas = [...visibles].reverse();

  const onClick = (p: { name?: string }) => {
    if (!param || !p.name || p.name.startsWith("Otros (")) return;
    const q = new URLSearchParams(sp.toString());
    if (activo === p.name) q.delete(param);
    else q.set(param, p.name);
    router.replace(`${pathname}?${q.toString()}`, { scroll: false });
  };

  const pct = (v: number) => `${((v / total) * 100).toFixed(1)}%`;

  /** Arranque translucido del degradado. Los tokens --chart-N son hex de 6
   *  digitos, asi que pegarles el alfa alcanza; si alguna vez pasan a
   *  oklch()/rgb() el concat daria un color INVALIDO y la barra se dibujaria
   *  transparente — invisible, sin error en consola. Ante la duda, tono
   *  pleno: se pierde el degradado, no la barra. */
  const tenue = (c: string) => (/^#[0-9a-f]{6}$/i.test(c) ? `${c}99` : c);

  // Con `paleta`, el color de cada categoria sale del ORDEN EN QUE LLEGO en
  // `datos`, no de su posicion en el ranking: asi el color de "Híbridos" es
  // el mismo que en el apilado por año de al lado, aunque el ranking cambie
  // de mes a mes. "Otros" queda en el gris de ejes, que no es de la paleta.
  const ordenOriginal = new Map(datos.map((d, i) => [d.nombre, i]));
  const vivo = (nombre: string) => {
    if (!paleta) return theme.series[0];
    const i = ordenOriginal.get(nombre);
    return i === undefined ? theme.axis : theme.series[i % theme.series.length];
  };

  const option = {
    animationDuration: 600,
    animationEasing: "cubicOut" as const,
    // `right` deja lugar a la etiqueta "12.345  56.7%" de la barra mas
    // larga, que se dibuja por fuera de la barra.
    grid: { left: 4, right: 96, top: 4, bottom: 4, containLabel: true },
    tooltip: {
      ...TOOLTIP_BASE,
      trigger: "item",
      formatter: (p: { name: string; value: number }) =>
        `${p.name}<br/><b>${formatUnidades(p.value)}</b> u. · <b>${pct(p.value)}</b>` +
        (param && !p.name.startsWith("Otros (")
          ? `<br/><span style="font-size:11px;opacity:.75">${
              activo === p.name ? "Clic para quitar el filtro" : "Clic para filtrar"
            }</span>`
          : ""),
    },
    // Sin eje X: cada barra ya trae su numero al costado. Dibujar ticks
    // seria repetir el mismo dato con mas tinta.
    //
    // `max` clavado al dato mas grande, sin el redondeo "lindo" de ECharts
    // (18.980 -> 20.000): ese redondeo existe para que los ticks caigan en
    // numeros redondos, y aca no hay ticks. Sin esto la barra mas larga
    // quedaba al 44% del ancho en movil, con un tercio de la tarjeta vacio.
    xAxis: {
      type: "value",
      show: false,
      max: (v: { max: number }) => v.max,
    },
    yAxis: {
      type: "category",
      data: filas.map((d) => d.nombre),
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        color: theme.text,
        fontSize: 11.5,
        // Nombres largos cortados en vez de empujar el area de barras a la
        // mitad del ancho de la tarjeta.
        width: 120,
        overflow: "truncate" as const,
      },
    },
    series: [
      {
        type: "bar",
        barMaxWidth: 20,
        barCategoryGap: "38%",
        // En horizontal, `barMinHeight` es el LARGO minimo. Sin esto las
        // categorias de cola (Omnibus 0,1%) redondean a 0 px y la fila se
        // lee como si faltara el dato. Con 3 px se ve que existe y es chica;
        // el numero exacto igual va en la etiqueta.
        barMinHeight: 3,
        cursor: param ? "pointer" : "default",
        itemStyle: {
          borderRadius: [0, 4, 4, 0],
          // Degradado horizontal en las barras vivas: cuerpo pleno que se
          // enciende hacia la punta. Las filtradas-fuera quedan en gris.
          // Degradado horizontal en las barras vivas: cuerpo pleno que se
          // enciende hacia la punta. Las filtradas-fuera quedan en gris.
          color: (p: { name: string }) => {
            if (activo && p.name !== activo) return theme.grid;
            const c = vivo(p.name);
            return {
              type: "linear" as const,
              x: 0,
              y: 0,
              x2: 1,
              y2: 0,
              colorStops: [
                { offset: 0, color: tenue(c) },
                { offset: 1, color: c },
              ],
            };
          },
        },
        emphasis: { itemStyle: { color: theme.series[1] } },
        label: {
          show: true,
          position: "right" as const,
          fontSize: 11,
          // El % en negrita: es la pregunta que hacia la dona
          // ("participacion por..."); el valor absoluto es el respaldo.
          formatter: (p: { value: number }) =>
            `{u|${formatUnidades(p.value)}}  {p|${pct(p.value)}}`,
          rich: {
            u: { color: theme.text, fontSize: 11 },
            p: { color: theme.text, fontSize: 11, fontWeight: "bold" as const },
          },
        },
        data: filas.map((d) => d.valor),
      },
    ],
  };

  if (!datos.length) {
    return (
      <p className="py-16 text-center text-sm text-muted-foreground">
        Sin datos para este filtro.
      </p>
    );
  }

  // La altura sale de cuantas barras hay: una fija dejaba las barras
  // aplastadas con 9 categorias y con aire de sobra con 3.
  const alto = altura ?? Math.max(140, filas.length * 34 + 12);

  return (
    <div className="flex flex-col gap-2">
      {/* Sin notMerge: 1 sola serie siempre, el merge por defecto tween-ea
          el largo de cada barra en vez de replayear la entrada en cada clic. */}
      <EchartsAuto
        option={option}
        style={{ height: alto, width: "100%" }}
        onEvents={param ? { click: onClick } : undefined}
      />
      {/* El total: antes iba al centro del anillo. Como HTML y no como texto
          de canvas, para que herede la tipografia tabular del resto. */}
      <p className="border-t pt-2 text-xs text-muted-foreground">
        Total{" "}
        <span className="font-medium tabular-nums text-foreground">
          {formatUnidades(total)}
        </span>{" "}
        u. en {visibles.length} {visibles.length === 1 ? "categoría" : "categorías"}
        {resto.length
          ? ` (las ${resto.length} más chicas, agrupadas en «Otros»)`
          : ""}
        .
      </p>
    </div>
  );
}
