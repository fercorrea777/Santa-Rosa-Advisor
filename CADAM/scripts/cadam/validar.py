"""Controles de consistencia entre fuentes, despues de cada carga.

Todo hallazgo va a `carga_log` y de ahi a la pantalla "Calidad de datos".
La idea es que un problema de datos se vea en la app, no que rompa la
ingesta ni que pase desapercibido (CLAUDE.md sec. 7).

CONTROL CLAVE: import nev NO se suma
------------------------------------
'import nev.xlsx' es un SUBCONJUNTO de 'base importacion.xlsx', no una
fuente adicional. Verificado sobre jul-2026:

    base importacion 2026        24.047  = informe oficial (Cuadro 3)
    base importacion + NEV       28.145  = excede el oficial en 4.098

Sumarlas duplicaria exactamente el total de NEV. Por eso viven en tablas
separadas y NUNCA se unen con UNION ni se suman: `importacion` es la
fuente de VOLUMEN, `importacion_nev` es el detalle de TECNOLOGIA (la base
de importacion no trae columna de tecnologia).
"""

CONTROLES = []


def control(nombre):
    def deco(fn):
        CONTROLES.append((nombre, fn))
        return fn
    return deco


@control("nev_contenido_en_importacion")
def _nev_contenido(con, snapshot):
    """NEV deberia caber dentro de la base de importacion. Donde la
    excede suele ser porque la base agrupa la marca distinto (HAVAL bajo
    GREAT WALL) o porque el vehiculo esta en el archivo de camiones."""
    filas = con.execute("""
        SELECT n.anio, n.mes, n.marca, n.u, COALESCE(b.u, 0)
        FROM (SELECT anio, mes, marca, SUM(unidades) u FROM importacion_nev
              WHERE snapshot = ? GROUP BY 1,2,3) n
        LEFT JOIN (SELECT anio, mes, marca, SUM(unidades) u FROM importacion
                   WHERE snapshot = ? GROUP BY 1,2,3) b
          ON b.anio = n.anio AND b.mes = n.mes AND b.marca = n.marca
        WHERE n.u > COALESCE(b.u, 0)
    """, (snapshot, snapshot)).fetchall()
    if not filas:
        return []
    marcas = sorted({f[2] for f in filas})
    return [("aviso", "nev_excede_base",
             "Marca/mes donde 'import nev' supera a 'base importacion'. "
             "Estas unidades NO se suman al total de importaciones (el NEV "
             "es un subconjunto). Marcas: " + ", ".join(marcas[:10]),
             len(filas))]


@control("totales_vs_informe_estadistico")
def _vs_informe(con, snapshot):
    """Cruce contra las tablas del informe estadistico de CADAM, cuando
    haya alguno cargado. Es el control mas fuerte que tenemos: si el
    row-level no reproduce el informe oficial, algo se rompio."""
    salidas = []
    pares = [
        ("matriculacion", "matriculacion_tipo", "Matriculacion"),
        ("importacion", "importacion_tipo_mensual", "Importacion"),
    ]
    for tabla, oficial, etiqueta in pares:
        # Solo meses presentes en AMBAS fuentes: el informe estadistico
        # cubre el ano en curso hasta su mes de cierre, mientras que el
        # row-level trae anos completos. Comparar totales anuales daria un
        # descuadre falso (ej. 2025 completo vs ene-jun del informe).
        filas = con.execute(f"""
            SELECT r.anio, SUM(r.u), SUM(o.u), COUNT(*) FROM
              (SELECT anio, mes, SUM(unidades) u FROM {tabla}
               WHERE snapshot = ? GROUP BY anio, mes) r
            JOIN (SELECT anio, mes, SUM(unidades) u FROM {oficial}
                  GROUP BY anio, mes) o
              ON o.anio = r.anio AND o.mes = r.mes
            GROUP BY r.anio
        """, (snapshot,)).fetchall()
        for anio, propio, oficial_u, n_meses in filas:
            alcance = f"{anio} ({n_meses} mes{'es' if n_meses != 1 else ''} comparables)"
            if propio == oficial_u:
                salidas.append(("info", "control_ok",
                                f"{etiqueta} {alcance}: {propio:,} unidades, "
                                f"coincide exacto con el informe oficial de CADAM", 1))
            else:
                salidas.append(("error", "descuadre_vs_informe",
                                f"{etiqueta} {alcance}: row-level {propio:,} vs "
                                f"informe oficial {oficial_u:,} "
                                f"(diferencia {propio - oficial_u:+,})", 1))
    return salidas


@control("meses_faltantes")
def _meses_faltantes(con, snapshot):
    """Un mes sin datos en el medio de la serie es sospechoso. La app los
    muestra como 'sin dato', nunca como cero (CLAUDE.md sec. 13)."""
    salidas = []
    for tabla, etiqueta in (("matriculacion", "Matriculacion"),
                            ("importacion", "Importacion")):
        filas = con.execute(f"""
            SELECT DISTINCT anio, mes FROM {tabla} WHERE snapshot = ?
            ORDER BY anio, mes""", (snapshot,)).fetchall()
        if not filas:
            continue
        presentes = {(a, m) for a, m in filas}
        (a0, m0), (a1, m1) = filas[0], filas[-1]
        faltan = [f"{a}-{m:02d}"
                  for a in range(a0, a1 + 1)
                  for m in range(1, 13)
                  if (a, m) > (a0, m0 - 1) and (a, m) <= (a1, m1)
                  and (a, m) not in presentes]
        if faltan:
            salidas.append(("aviso", "mes_sin_datos",
                            f"{etiqueta}: meses sin datos dentro del rango "
                            f"{a0}-{m0:02d}..{a1}-{m1:02d}: " + ", ".join(faltan[:12]),
                            len(faltan)))
    return salidas


@control("segmento_sin_clasificar")
def _sin_segmento(con, snapshot):
    salidas = []
    for tabla, etiqueta in (("matriculacion", "Matriculacion"),
                            ("importacion", "Importacion")):
        filas = con.execute(f"""
            SELECT anio, SUM(unidades) FROM {tabla}
            WHERE snapshot = ? AND segmento = 'Sin clasificar'
            GROUP BY anio ORDER BY anio""", (snapshot,)).fetchall()
        if filas:
            detalle = ", ".join(f"{a}: {u:,}" for a, u in filas)
            salidas.append(("aviso", "segmento_sin_clasificar",
                            f"{etiqueta}: unidades sin segmento en el origen "
                            f"({detalle}). Se muestran como dato no disponible, "
                            f"no se reparten entre los demas segmentos.",
                            sum(u for _, u in filas)))
    return salidas


def correr(con, snapshot: str) -> list[tuple]:
    """Corre todos los controles. -> filas listas para `carga_log`."""
    salidas = []
    for nombre, fn in CONTROLES:
        try:
            for nivel, categoria, mensaje, n in fn(con, snapshot):
                salidas.append((snapshot, None, nivel, categoria, mensaje, n))
        except Exception as e:
            salidas.append((snapshot, None, "error", "control_fallido",
                            f"El control '{nombre}' fallo: {e}", 1))
    return salidas
