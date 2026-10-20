"""Completar la matriculacion con el archivo por combustible cuando el
detalle saltea un mes.

POR QUE EXISTE
--------------
CADAM manda la matriculacion en tres archivos que salen de la misma base de
la DNRA: el detalle ("matriculaciones.xlsx": marca, modelo, segmento,
tecnologia, importador), por combustible ("MATRICULACIONES CON MOVILIDAD")
y por localidad. El 19/10/2026 llego un detalle de enero 2022 a septiembre
2026 SIN agosto 2026, mientras los otros dos si lo traian (4.161 vehiculos
en los dos). Con el hueco, agosto quedaba "sin dato" y el acumulado del
anio daba 4.161 menos de lo que CADAM publico.

El archivo por combustible trae marca, version ("Modelo"), mes y unidades,
y en todos los meses que tienen los dos coincide con el detalle version por
version. Lo que no trae (segmento, tecnologia, importador) es un atributo
de la version, no del mes: se copia del detalle.

QUE HACE
--------
Para el snapshot, los meses que tiene el archivo por combustible y no
tiene el detalle se insertan en `matriculacion` con `fuente = 'movilidad'`.
Solo si en los meses que tienen los dos el total coincide exacto: si no
coincide, no se completa nada y queda un aviso en `carga_log`.

Los atributos salen, en este orden:
  1. De la misma version en el detalle, en el mes mas cercano que la tenga
     (si ahi hay mas de una combinacion, la de mas unidades).
  2. Si la version no esta escrita igual en ningun mes (la DNRA la tipeo
     distinto: 'TACOMA TRD HIBRIDO' contra 'TACOMA TRD 2026 HIBRIDO'),
     segmento e importador salen de su MODELO -- el del catalogo de
     importacion, con el mismo criterio que ingest.derivar_modelo_base --,
     y la tecnologia de su nombre (normalize.tecnologia_por_nombre) o, si
     el nombre no la dice, de su combustible.
  3. Si tampoco hay modelo, queda "Sin clasificar" y sin importador. No se
     adivina.

QUE NO HACE
-----------
No toca meses que el detalle ya tiene, ni completa meses a medias.

COMO SE DESHACE
---------------
Solo. La ingesta del detalle borra el snapshot entero y lo reescribe, asi
que cuando llegue un "matriculaciones.xlsx" con agosto estas filas
desaparecen y quedan las de verdad. Y correr esto dos veces no duplica: se
borran las filas `fuente = 'movilidad'` antes de volver a decidir.
"""
from __future__ import annotations

import sqlite3

from . import normalize

FUENTE_MOVILIDAD = "movilidad"
FUENTE_DETALLE = "row-level"


def asegurar_columna_fuente(con: sqlite3.Connection) -> None:
    cols = {r[1] for r in con.execute("PRAGMA table_info(matriculacion)")}
    if cols and "fuente" not in cols:
        con.execute(
            "ALTER TABLE matriculacion ADD COLUMN fuente TEXT NOT NULL "
            f"DEFAULT '{FUENTE_DETALLE}'"
        )


def _etiqueta(meses: list[tuple[int, int]]) -> str:
    return ", ".join(f"{a}-{m:02d}" for a, m in meses)


def _indice(anio: int, mes: int) -> int:
    return anio * 12 + mes - 1


def _mas_cercano(por_mes: dict[int, dict[tuple, int]], anio: int, mes: int) -> tuple[tuple, bool]:
    """-> (combinacion de atributos, habia mas de una) en el mes mas
    cercano que tenga datos. La de mas unidades; ante empate, la menor,
    para que el resultado no dependa del orden de la consulta."""
    t = _indice(anio, mes)
    distancia = min(abs(i - t) for i in por_mes)
    combos: dict[tuple, int] = {}
    for i, c in por_mes.items():
        if abs(i - t) == distancia:
            for clave, u in c.items():
                combos[clave] = combos.get(clave, 0) + u
    return min(combos, key=lambda c: (-combos[c], c)), len(combos) > 1


def complementar(con: sqlite3.Connection, snapshot: str) -> list[tuple]:
    """-> entradas para carga_log: (snapshot, archivo, nivel, categoria, mensaje, n)."""
    tablas = {r[0] for r in con.execute("SELECT name FROM sqlite_master WHERE type='table'")}
    if not {"matriculacion", "matriculacion_movilidad", "importacion"} <= tablas:
        return []
    asegurar_columna_fuente(con)
    con.execute(
        "DELETE FROM matriculacion WHERE snapshot=? AND fuente=?", (snapshot, FUENTE_MOVILIDAD)
    )

    detalle = {(a, m): u for a, m, u in con.execute(
        "SELECT anio, mes, SUM(unidades) FROM matriculacion WHERE snapshot=? GROUP BY anio, mes",
        (snapshot,))}
    combustible = {(a, m): u for a, m, u in con.execute(
        "SELECT anio, mes, SUM(unidades) FROM matriculacion_movilidad WHERE snapshot=? "
        "GROUP BY anio, mes", (snapshot,))}
    faltan = sorted(k for k, u in combustible.items() if u > 0 and k not in detalle)
    if not detalle or not faltan:
        con.commit()
        return []

    # Antes de usarlo como detalle, el archivo por combustible tiene que
    # reproducir al detalle en todos los meses que tienen los dos.
    comunes = sorted(set(detalle) & set(combustible))
    distintos = [k for k in comunes if detalle[k] != combustible[k]]
    if not comunes or distintos:
        con.commit()
        if comunes:
            a, m = distintos[0]
            motivo = (f"en {len(distintos)} de {len(comunes)} meses en comun los totales no "
                      f"coinciden (ej. {a}-{m:02d}: detalle {detalle[(a, m)]:,}, "
                      f"combustible {combustible[(a, m)]:,})")
        else:
            motivo = "no hay ningun mes en comun para comprobar que sean el mismo dato"
        return [(snapshot, None, "aviso", "complemento_movilidad",
                 f"Matriculacion {_etiqueta(faltan)}: el detalle no trae el mes y el archivo "
                 f"por combustible si, pero no se completo porque {motivo}.",
                 sum(combustible[k] for k in faltan))]

    # Catalogo de modelos de importacion, del mas largo al mas corto: la
    # version 'COROLLA CROSS XEI' es del modelo 'COROLLA CROSS', no 'COROLLA'.
    catalogo: dict[str, list[str]] = {}
    for marca, modelo in con.execute(
            "SELECT DISTINCT marca, modelo FROM importacion WHERE snapshot=?", (snapshot,)):
        if modelo:
            catalogo.setdefault(marca, []).append(modelo.upper())
    for lista in catalogo.values():
        lista.sort(key=len, reverse=True)
    bases: dict[tuple[str, str], str | None] = {}

    def modelo_de(marca: str, version: str) -> str | None:
        if (marca, version) not in bases:
            v = version.upper()
            bases[(marca, version)] = next(
                (c for c in catalogo.get(marca, ()) if v == c or v.startswith(c + " ")), None)
        return bases[(marca, version)]

    # Atributos por version y por modelo, mes a mes, desde el detalle.
    por_version: dict[tuple[str, str], dict[int, dict[tuple, int]]] = {}
    por_modelo: dict[tuple[str, str], dict[int, dict[tuple, int]]] = {}
    for anio, mes, marca, modelo, segmento, segmento_raw, tecnologia, empresa, u in con.execute(
        """SELECT anio, mes, marca, modelo, segmento, segmento_raw, tecnologia, empresa,
                  SUM(unidades)
           FROM matriculacion WHERE snapshot=? AND fuente=?
           GROUP BY anio, mes, marca, modelo, segmento, segmento_raw, tecnologia, empresa""",
        (snapshot, FUENTE_DETALLE),
    ):
        i = _indice(anio, mes)
        combos = por_version.setdefault((marca, normalize.clave_modelo(modelo)), {}).setdefault(i, {})
        clave = (modelo, segmento, segmento_raw, tecnologia, empresa)
        combos[clave] = combos.get(clave, 0) + u
        base = modelo_de(marca, modelo)
        if base:
            combos = por_modelo.setdefault((marca, base), {}).setdefault(i, {})
            clave = (segmento, segmento_raw, empresa)
            combos[clave] = combos.get(clave, 0) + u

    meses_sql = " OR ".join("(anio=? AND mes=?)" for _ in faltan)
    params = [x for k in faltan for x in k]
    filas: dict[tuple, list] = {}
    unidades = 0
    versiones: set[tuple[str, str]] = set()
    varias: dict[tuple[str, str], int] = {}
    por_su_modelo: dict[tuple[str, str], int] = {}
    sin_clasificar: dict[tuple[str, str], int] = {}
    for anio, mes, marca, modelo, movilidad, u in con.execute(
        f"""SELECT anio, mes, marca, modelo, movilidad, SUM(unidades)
            FROM matriculacion_movilidad
            WHERE snapshot=? AND ({meses_sql})
            GROUP BY anio, mes, marca, modelo, movilidad""",
        (snapshot, *params),
    ):
        historia = por_version.get((marca, normalize.clave_modelo(modelo)))
        if historia:
            (modelo_d, segmento, segmento_raw, tecnologia, empresa), hubo_varias = \
                _mas_cercano(historia, anio, mes)
            if hubo_varias:
                varias[(marca, modelo_d)] = varias.get((marca, modelo_d), 0) + u
        else:
            modelo_d = modelo
            tecnologia = (normalize.tecnologia_por_nombre(modelo)
                          or normalize.tecnologia(movilidad) or normalize.TEC_ICE)
            base = modelo_de(marca, modelo)
            if base and (marca, base) in por_modelo:
                (segmento, segmento_raw, empresa), _ = _mas_cercano(por_modelo[(marca, base)], anio, mes)
                por_su_modelo[(marca, modelo)] = por_su_modelo.get((marca, modelo), 0) + u
            else:
                segmento, segmento_raw, empresa = normalize.SEGMENTO_ND, "", ""
                sin_clasificar[(marca, modelo)] = sin_clasificar.get((marca, modelo), 0) + u
        # Por la clave primaria de la tabla: varios combustibles de la misma
        # version caen en la misma fila y se suman.
        clave = (snapshot, anio, mes, marca, modelo_d, segmento, tecnologia, empresa)
        fila = filas.setdefault(clave, [segmento_raw, 0])
        fila[1] += u
        versiones.add((marca, modelo_d))
        unidades += u

    con.executemany(
        """INSERT INTO matriculacion (snapshot, anio, mes, marca, modelo, segmento,
             tecnologia, empresa, segmento_raw, unidades, fuente)
           VALUES (?,?,?,?,?,?,?,?,?,?,?)""",
        [(*k, raw, u, FUENTE_MOVILIDAD) for k, (raw, u) in filas.items()],
    )
    con.commit()

    def cuantas(d: dict) -> str:
        n, u = len(d), sum(d.values())
        return f"{n} version{'es' if n != 1 else ''} ({u:,} vehiculo{'s' if u != 1 else ''})"

    notas = []
    if varias:
        notas.append(f"{cuantas(varias)} tenian mas de una combinacion en ese mes y se tomo "
                     f"la de mas unidades")
    if por_su_modelo:
        notas.append(f"{cuantas(por_su_modelo)} que el detalle no tiene escritas igual "
                     f"tomaron segmento e importador de su modelo, y la tecnologia de su "
                     f"nombre o de su combustible")
    if sin_clasificar:
        notas.append(f"{cuantas(sin_clasificar)} sin modelo reconocible quedan sin segmento "
                     f"ni importador")
    return [(snapshot, None, "aviso", "complemento_movilidad",
             f"Matriculacion {_etiqueta(faltan)}: el detalle de CADAM (matriculaciones.xlsx) "
             f"no trae {'ese mes' if len(faltan) == 1 else 'esos meses'} y se completo desde el "
             f"archivo por combustible ({unidades:,} vehiculos en {len(versiones)} versiones), "
             f"que en los {len(comunes)} meses que tienen los dos coincide exacto. Segmento, "
             f"tecnologia e importador se copiaron de la misma version en el mes mas cercano"
             + (f". {'; '.join(notas)}" if notas else "")
             + ". Se reemplaza solo cuando el detalle traiga el mes.",
             len(versiones))]
