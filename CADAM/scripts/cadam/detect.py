"""Deteccion del periodo y del tipo de cada archivo de CADAM-DATA.

PERIODO
-------
Sale de la CARPETA, no del nombre del archivo: el usuario organiza
CADAM-DATA/ con una subcarpeta por mes y adentro pone los archivos con
nombres genericos ('matriculaciones.xlsx').

    CADAM-DATA/JULIO 2026/    -> 2026-07
    CADAM-DATA/2026-07/       -> 2026-07
    CADAM-DATA/jul_2026/      -> 2026-07

Si el archivo esta suelto en la raiz de CADAM-DATA (como los informes de
junio), se cae al nombre del archivo.

TIPO
----
Por las COLUMNAS reales, no por el nombre. Los nombres cambian mes a mes
('base importacion.xlsx' vs 'Cadam - Estadisticas totales ... .xlsx') y
la spec pide detectar la estructura, no asumirla. Si un archivo no
matchea ninguna firma conocida, se reporta como error de carga y se
omite -- nunca se adivina.
"""
import re
from .normalize import norm_txt

MESES = {
    "ENERO": 1, "ENE": 1, "FEBRERO": 2, "FEB": 2, "MARZO": 3, "MAR": 3,
    "ABRIL": 4, "ABR": 4, "MAYO": 5, "MAY": 5, "JUNIO": 6, "JUN": 6,
    "JULIO": 7, "JUL": 7, "AGOSTO": 8, "AGO": 8,
    "SEPTIEMBRE": 9, "SETIEMBRE": 9, "SEPT": 9, "SEP": 9, "SET": 9,
    "OCTUBRE": 10, "OCT": 10, "NOVIEMBRE": 11, "NOV": 11,
    "DICIEMBRE": 12, "DIC": 12,
}
_MESES_PAT = "|".join(sorted(MESES, key=len, reverse=True))
_RE_MES_ANIO = re.compile(rf"\b({_MESES_PAT})[\s_\-]*(\d{{4}})\b")
_RE_ANIO_MES = re.compile(r"\b(\d{4})[\s_\-]+(\d{1,2})\b")


def periodo_de_texto(texto: str) -> str | None:
    """'JULIO 2026' | '2026-07' | 'jun_2026' -> '2026-07'. None si no hay."""
    t = norm_txt(texto)
    if not t:
        return None
    m = _RE_MES_ANIO.search(t)
    if m:
        return f"{int(m.group(2)):04d}-{MESES[m.group(1)]:02d}"
    m = _RE_ANIO_MES.search(t)
    if m:
        anio, mes = int(m.group(1)), int(m.group(2))
        if 1 <= mes <= 12 and 1990 <= anio <= 2100:
            return f"{anio:04d}-{mes:02d}"
    return None


def periodo_de_ruta(ruta, raiz) -> str | None:
    """Busca el periodo en la carpeta (desde la mas cercana al archivo
    hacia arriba, sin pasar de `raiz`) y despues en el nombre."""
    try:
        rel = ruta.relative_to(raiz)
    except ValueError:
        rel = ruta
    for parte in reversed(rel.parts[:-1]):
        p = periodo_de_texto(parte)
        if p:
            return p
    return periodo_de_texto(ruta.stem)


# --- firmas de columnas ------------------------------------------------
# `req` son las columnas que DEBEN estar (normalizadas). Se elige la
# firma con mas columnas requeridas satisfechas, para que
# 'importacion_camion' (Marca/Modelo/Tipo/Fecha/Valor) no le gane a
# 'importacion' (que ademas trae TIPO GRAL).
FIRMAS = [
    {
        "tipo": "matriculacion",
        "req": {"FECHA", "GRUPO", "MARCA", "MODELO", "VALOR", "TIPO", "EMPRESA"},
        "desc": "matriculaciones row-level (marca/modelo/segmento/tecnologia/importador)",
    },
    {
        "tipo": "importacion",
        "req": {"MARCA", "MODELO", "TIPO CADAM", "FECHA", "VALOR", "TIPO GRAL"},
        "desc": "importacion row-level (marca/modelo/segmento/dimensiones)",
    },
    {
        "tipo": "nev",
        "req": {"FECHA", "MOVILIDAD", "MARCA", "MODELO", "CANTIDAD"},
        "desc": "importacion de vehiculos de energia nueva (EV/HEV/PHEV)",
    },
    {
        "tipo": "camion",
        "req": {"MARCA", "MODELO", "TIPO", "FECHA", "VALOR"},
        "desc": "importacion de camiones y omnibus",
    },
]


def tipo_por_columnas(columnas) -> tuple[str | None, str, set]:
    """-> (tipo, descripcion, columnas_faltantes_de_la_mejor_firma).
    tipo es None si ninguna firma queda completa."""
    cols = {norm_txt(c) for c in columnas}
    mejor, mejor_faltan = None, None
    for firma in FIRMAS:
        faltan = firma["req"] - cols
        if not faltan:
            # firma completa: gana la mas especifica (mas requeridas)
            if mejor is None or len(firma["req"]) > len(mejor["req"]):
                mejor, mejor_faltan = firma, set()
        elif mejor is None and (mejor_faltan is None or len(faltan) < len(mejor_faltan)):
            mejor_faltan = faltan
    if mejor:
        return mejor["tipo"], mejor["desc"], set()
    return None, "", mejor_faltan or set()


def es_informe_estadistico(sheet_names) -> bool:
    """Los informes clasicos de CADAM traen decenas de hojas numeradas mas
    'Caratula'/'Indice'. Los maneja ingest_cadam.py, no este pipeline."""
    nombres = {norm_txt(s) for s in sheet_names}
    return len(sheet_names) > 5 and bool(nombres & {"INDICE", "CARATULA", "RESUMEN"})
