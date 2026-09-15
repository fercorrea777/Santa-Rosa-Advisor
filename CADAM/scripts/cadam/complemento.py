"""Completar, desde el informe estadistico, los meses que el row-level no tiene.

POR QUE EXISTE
--------------
CADAM publica dos cosas por mes: el informe estadistico (un Excel de 29
cuadros con totales por tipo, marca y modelo) y el detalle por vehiculo
("base importacion.xlsx", "matriculaciones.xlsx"…). El tablero dibuja desde
el detalle. Pero el informe suele llegar antes —el de agosto llego el
15/09/2026 mientras el detalle seguia en julio— y mientras tanto el tablero
mostraba un mes menos del que CADAM ya habia publicado.

El Cuadro 8 del informe trae marca, modelo y tipo ("SUV mediano B") por mes,
y ese tipo es exactamente el `tipo_cadam` del row-level: alcanza para armar
filas equivalentes a las del detalle en todo lo que la app usa (marca,
modelo, segmento, mes, unidades). El Cuadro 19 hace lo mismo para camiones.

QUE HACE
--------
Para el snapshot activo, mira hasta que mes llega el row-level de
importacion y hasta que mes llega el informe mas reciente. Los meses que
tiene el informe y no tiene el row-level se insertan en `importacion` (y
`importacion_camion`) marcados con `fuente = 'informe'`.

QUE NO HACE
-----------
- No toca meses que el row-level ya tiene: el detalle manda siempre.
- No inventa lo que el informe no trae: `origen`, `tipo_detalle` y las
  medidas se copian del mismo modelo en meses anteriores si existe; si no,
  quedan vacios. Ninguna consulta de la app los usa.
- No completa NEV: el Cuadro 10A solo tiene totales por combustible, no
  por modelo, y `importacion_nev` es por modelo.

COMO SE DESHACE
---------------
Solo. La ingesta del row-level borra el snapshot entero y lo reescribe, asi
que cuando llegue "base importacion.xlsx" con agosto, las filas del informe
desaparecen y quedan las de verdad. Y correr esto dos veces no duplica: se
borran las filas `fuente = 'informe'` antes de volver a insertar.
"""
from __future__ import annotations

import sqlite3

from . import normalize

FUENTE_INFORME = "informe"
FUENTE_ROWLEVEL = "row-level"

# tipo_cadam del informe -> (segmento canonico, TIPO GRAL equivalente). El
# orden importa: "PICK UP" antes que cualquier cosa que empiece con P.
_SEGMENTO_POR_PREFIJO = [
    ("PICK UP", normalize.SEGMENTO_PICKUP, "PICK UP"),
    ("PICKUP", normalize.SEGMENTO_PICKUP, "PICK UP"),
    ("SUV", normalize.SEGMENTO_SUV, "SUV"),
    ("CITY CAR", normalize.SEGMENTO_AUTOMOVIL, "AUTO"),
    ("AUTO", normalize.SEGMENTO_AUTOMOVIL, "AUTO"),
    ("FURGON", normalize.SEGMENTO_FURGON, "FURGON"),
    ("MINIBUS", normalize.SEGMENTO_MINIBUS, "MINIBUS"),
]


def _segmento(tipo_cadam: str) -> tuple[str, str]:
    for prefijo, seg, raw in _SEGMENTO_POR_PREFIJO:
        if tipo_cadam.startswith(prefijo):
            return seg, raw
    return normalize.SEGMENTO_OTROS, ""


def _tipo_detalle(tipo_cadam: str) -> str:
    """'SUV MEDIANO B' -> 'SUV B', 'AUTO MEDIANO C' -> 'AUTO C'. Es la
    convencion del row-level cuando coincide; cuando no coincide, el
    row-level manda y esto ni se usa."""
    partes = tipo_cadam.split()
    if len(partes) == 3 and partes[1] in ("MEDIANO", "GRANDE", "PEQUENO"):
        return f"{partes[0]} {partes[2]}"
    return tipo_cadam


def asegurar_columna_fuente(con: sqlite3.Connection) -> None:
    for tabla in ("importacion", "importacion_camion"):
        existe = con.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name=?", (tabla,)
        ).fetchone()
        if not existe:
            continue
        cols = {r[1] for r in con.execute(f"PRAGMA table_info({tabla})")}
        if "fuente" not in cols:
            con.execute(
                f"ALTER TABLE {tabla} ADD COLUMN fuente TEXT NOT NULL DEFAULT '{FUENTE_ROWLEVEL}'"
            )


def _snapshot_activo(con) -> str | None:
    r = con.execute("SELECT periodo FROM snapshots ORDER BY periodo DESC LIMIT 1").fetchone()
    return r[0] if r else None


def _informe_reciente(con) -> str | None:
    r = con.execute(
        "SELECT periodo FROM informes WHERE tipo='importacion' ORDER BY periodo DESC LIMIT 1"
    ).fetchone()
    return r[0] if r else None


def complementar(con: sqlite3.Connection, snapshot: str | None = None) -> list[tuple]:
    """-> entradas para carga_log: (snapshot, archivo, nivel, categoria, mensaje, n)."""
    tablas = {r[0] for r in con.execute("SELECT name FROM sqlite_master WHERE type='table'")}
    if not {"importacion", "informes", "importacion_modelo_mensual", "snapshots"} <= tablas:
        return []
    asegurar_columna_fuente(con)

    snapshot = snapshot or _snapshot_activo(con)
    informe = _informe_reciente(con)
    if not snapshot or not informe:
        return []

    # Siempre se parte de cero: lo que haya del informe se borra y se vuelve
    # a decidir. Asi el script es idempotente y, si el row-level avanzo, el
    # informe retrocede solo.
    con.execute(
        "DELETE FROM importacion WHERE snapshot=? AND fuente=?", (snapshot, FUENTE_INFORME)
    )
    if "importacion_camion" in tablas:
        con.execute(
            "DELETE FROM importacion_camion WHERE snapshot=? AND fuente=?",
            (snapshot, FUENTE_INFORME),
        )

    anio_inf = int(informe[:4])
    mes_inf = int(informe[5:7])
    r = con.execute(
        "SELECT MAX(mes) FROM importacion WHERE snapshot=? AND anio=? AND fuente=?",
        (snapshot, anio_inf, FUENTE_ROWLEVEL),
    ).fetchone()
    mes_rowlevel = r[0] or 0
    if mes_inf <= mes_rowlevel:
        con.commit()
        return []

    meses = list(range(mes_rowlevel + 1, mes_inf + 1))

    # Atributos que el informe no trae, copiados del mismo modelo en el
    # row-level del mismo snapshot (la fila con mas unidades manda).
    conocidos: dict[tuple[str, str], tuple] = {}
    for marca, modelo, tipo_detalle, tipo_cadam, origen, largo, ancho, alto, u in con.execute(
        """SELECT marca, modelo, tipo_detalle, tipo_cadam, origen, largo, ancho, alto,
                  SUM(unidades) u
           FROM importacion WHERE snapshot=? AND fuente=?
           GROUP BY marca, modelo, tipo_detalle, tipo_cadam, origen, largo, ancho, alto
           ORDER BY u""",
        (snapshot, FUENTE_ROWLEVEL),
    ):
        # ORDER BY u ascendente: la ultima que se escribe es la de mas unidades.
        conocidos[(marca, normalize.clave_modelo(modelo))] = (
            modelo, tipo_detalle, tipo_cadam, origen, largo, ancho, alto
        )

    filas = []
    unidades = 0
    for anio, mes, marca_raw, modelo_raw, tipo_raw, u in con.execute(
        """SELECT anio, mes, marca, modelo, tipo, unidades FROM importacion_modelo_mensual
           WHERE informe_periodo=? AND anio=? AND mes BETWEEN ? AND ?""",
        (informe, anio_inf, meses[0], meses[-1]),
    ):
        marca = normalize.marca(marca_raw)
        modelo = normalize.norm_txt(modelo_raw)
        tipo_cadam = normalize.norm_txt(tipo_raw)
        segmento, segmento_raw = _segmento(tipo_cadam)
        previo = conocidos.get((marca, normalize.clave_modelo(modelo)))
        if previo:
            # Misma grafia que el row-level, para que el ranking no parta el
            # modelo en dos filas por una coma o un guion.
            modelo, tipo_detalle, _tc, origen, largo, ancho, alto = previo
        else:
            tipo_detalle, origen, largo, ancho, alto = _tipo_detalle(tipo_cadam), "", None, None, None
        filas.append((snapshot, anio, mes, marca, modelo, segmento, segmento_raw,
                      tipo_detalle, tipo_cadam, origen, largo, ancho, alto, u, FUENTE_INFORME))
        unidades += u

    # Dos modelos del informe pueden caer en la misma clave del row-level
    # (grafias distintas): se suman en vez de chocar con la clave primaria.
    agrupado: dict[tuple, list] = {}
    for f in filas:
        clave = (f[0], f[1], f[2], f[3], f[4], f[5], f[7])
        if clave in agrupado:
            agrupado[clave][13] += f[13]
        else:
            agrupado[clave] = list(f)
    con.executemany(
        """INSERT INTO importacion (snapshot, anio, mes, marca, modelo, segmento, segmento_raw,
             tipo_detalle, tipo_cadam, origen, largo, ancho, alto, unidades, fuente)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
        [tuple(v) for v in agrupado.values()],
    )

    # Camiones, mismo criterio.
    unidades_camion = 0
    if "importacion_camion" in tablas and "importacion_camion_modelo_mensual" in tablas:
        r = con.execute(
            "SELECT MAX(mes) FROM importacion_camion WHERE snapshot=? AND anio=? AND fuente=?",
            (snapshot, anio_inf, FUENTE_ROWLEVEL),
        ).fetchone()
        mes_rl_camion = r[0] or 0
        if mes_inf > mes_rl_camion:
            camiones: dict[tuple, int] = {}
            for anio, mes, marca_raw, modelo_raw, tipo_raw, u in con.execute(
                """SELECT anio, mes, marca, modelo, tipo, unidades
                   FROM importacion_camion_modelo_mensual
                   WHERE informe_periodo=? AND anio=? AND mes BETWEEN ? AND ?""",
                (informe, anio_inf, mes_rl_camion + 1, mes_inf),
            ):
                clave = (snapshot, anio, mes, normalize.marca(marca_raw),
                         normalize.norm_txt(modelo_raw), normalize.norm_txt(tipo_raw))
                camiones[clave] = camiones.get(clave, 0) + u
                unidades_camion += u
            con.executemany(
                """INSERT INTO importacion_camion (snapshot, anio, mes, marca, modelo, tipo, unidades, fuente)
                   VALUES (?,?,?,?,?,?,?,?)""",
                [(*k, u, FUENTE_INFORME) for k, u in camiones.items()],
            )

    con.commit()
    if not filas:
        return []
    etiqueta = ", ".join(f"{anio_inf}-{m:02d}" for m in meses)
    return [(snapshot, None, "aviso", "complemento_informe",
             f"Importacion {etiqueta}: el detalle por vehiculo todavia no llego y se "
             f"completo desde el Cuadro 8 del informe estadistico de CADAM "
             f"({unidades:,} vehiculos livianos en {len(agrupado)} modelos"
             + (f", {unidades_camion:,} camiones y omnibus" if unidades_camion else "")
             + "). Tiene marca, modelo, segmento y tipo, pero no origen ni medidas. "
             f"Se reemplaza solo cuando entre el archivo de detalle.",
             len(agrupado))]
