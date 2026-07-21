"""Parsers de los archivos row-level de CADAM-DATA.

Los cuatro archivos son tablas largas de una sola hoja (a diferencia de
los informes estadisticos, que son ~50 tablas dinamicas). Estructura real
verificada sobre CADAM-DATA/JULIO 2026/ (jul-2026):

  matriculaciones.xlsx     32.957 filas  2022-01..2026-06
      Fecha | Grupo | Marca | Modelo | Valor | TIPO | EMPRESA
  base importacion.xlsx    44.704 filas  2019-01..2026-06
      Marca | Modelo | Tipo cadam | Fecha | Valor | ORIGEN | TIPO GRAL
      | LARGO | ANCHO | ALTO | TIPO DETALLE
  import nev.xlsx           4.180 filas  2024-01..2026-06
      FECHA | MOVILIDAD | MARCA | MODELO | CANTIDAD
  importacion camiones.xlsx 10.470 filas 2023-01..2026-06
      Marca | Modelo | Tipo | Fecha | Valor

Validado contra el informe estadistico de jun-2026: matriculacion 2026
suma 28.722 y importacion 2026 suma 24.047 en ambas fuentes.
"""
import pandas as pd

from . import normalize as N


class Log:
    """Junta los avisos de una carga para escribirlos en `carga_log`."""

    def __init__(self, snapshot: str, archivo: str):
        self.snapshot = snapshot
        self.archivo = archivo
        self.entradas: list[tuple] = []

    def add(self, nivel: str, categoria: str, mensaje: str, n: int = 1):
        if n:
            self.entradas.append((self.snapshot, self.archivo, nivel,
                                  categoria, mensaje, int(n)))

    def aviso(self, categoria, mensaje, n=1):
        self.add("aviso", categoria, mensaje, n)

    def info(self, categoria, mensaje, n=1):
        self.add("info", categoria, mensaje, n)


def _columna(df, *nombres):
    """Devuelve la Serie de la primera columna que matchee (normalizando
    el encabezado), o None. Tolera que CADAM cambie mayusculas/acentos."""
    mapa = {N.norm_txt(c): c for c in df.columns}
    for n in nombres:
        real = mapa.get(N.norm_txt(n))
        if real is not None:
            return df[real]
    return None


def _fechas(df, log, *nombres):
    """-> (anio, mes) como Series. Las filas sin fecha valida se
    descartan y se reportan."""
    col = _columna(df, *nombres)
    fecha = pd.to_datetime(col, errors="coerce")
    invalidas = int(fecha.isna().sum())
    log.aviso("fecha_invalida",
              "Filas descartadas por fecha vacia o ilegible", invalidas)
    return fecha


def _unidades(df, log, *nombres):
    col = _columna(df, *nombres)
    v = pd.to_numeric(col, errors="coerce")
    nulos = int(v.isna().sum())
    # Son filas de modelo listadas sin unidades ese mes. Cuentan 0, no se
    # descartan: el modelo igual existe en el catalogo del mes.
    log.info("valor_vacio",
             "Filas con unidades vacias, computadas como 0", nulos)
    negativos = int((v < 0).sum())
    log.aviso("valor_negativo", "Filas con unidades negativas", negativos)
    return v.fillna(0).astype(int)


def _a_tuplas(df, columnas) -> list[tuple]:
    """DataFrame -> lista de tuplas lista para sqlite3. Convierte los
    nulos de pandas (NaN/NA/NaT) a None: sqlite3 no sabe bindear NAType."""
    filas = []
    for fila in df[columnas].itertuples(index=False, name=None):
        filas.append(tuple(None if pd.isna(v) else v for v in fila))
    return filas


def _aplicar_correcciones(serie, correcciones: dict):
    if not correcciones:
        return serie
    return serie.map(lambda v: correcciones.get(v, v))


def _unificar_modelos(out, log, corr):
    """Unifica las grafias del mismo modelo dentro de cada marca.

    Dos pasos, en este orden:
      1. Correcciones manuales (marca, alias) -> modelo. Mandan siempre.
      2. Regla automatica: los modelos que comparten clave_modelo() son
         el mismo; se adopta la grafia con MAS unidades (la mas usada por
         la fuente), y ante empate la alfabeticamente menor para que el
         resultado sea estable entre cargas.

    Ver normalize.clave_modelo() para por que el '+' NO se ignora.
    """
    mod_corr = corr.get("modelo", {})
    if mod_corr:
        out["modelo"] = [mod_corr.get((mk, mo), mo)
                         for mk, mo in zip(out["marca"], out["modelo"])]

    claves = out["modelo"].map(N.clave_modelo)
    # unidades por (marca, clave, grafia) para elegir la dominante
    conteo = (out.assign(clavemod=claves)
                 .groupby(["marca", "clavemod", "modelo"], sort=False)["unidades"]
                 .sum().reset_index())
    conteo = conteo.sort_values(["marca", "clavemod", "unidades", "modelo"],
                                ascending=[True, True, False, True])
    canonico = {(r.marca, r.clavemod): r.modelo
                for r in conteo.drop_duplicates(["marca", "clavemod"]).itertuples()}

    grupos = conteo.groupby(["marca", "clavemod"])["modelo"].nunique()
    n_grupos = int((grupos > 1).sum())
    if n_grupos:
        ejemplos = [f"{mk} {canonico[(mk, k)]}"
                    for (mk, k), n in grupos.items() if n > 1][:5]
        log.info("modelos_unificados",
                 "Modelos con varias grafias en el origen (espacios, guiones, "
                 "barras o puntos) unificados a la mas frecuente. Ej.: "
                 + "; ".join(ejemplos), n_grupos)

    out["modelo"] = [canonico[(mk, k)] for mk, k in zip(out["marca"], claves)]
    return out


def _agrupar(df, claves, log, etiqueta):
    """Suma duplicados en vez de asumir que la clave es unica."""
    antes = len(df)
    out = df.groupby(claves, as_index=False, sort=False)["unidades"].sum()
    dup = antes - len(out)
    log.info("filas_agrupadas",
             f"Filas de {etiqueta} con la misma clave, sumadas", dup)
    return out


# --- matriculaciones ---------------------------------------------------

def parse_matriculacion(df, log, corr) -> list[tuple]:
    fecha = _fechas(df, log, "Fecha")
    out = pd.DataFrame({
        "anio": fecha.dt.year,
        "mes": fecha.dt.month,
        "marca": _columna(df, "Marca").map(N.marca),
        "modelo": _columna(df, "Modelo").map(N.norm_txt),
        "segmento_raw": _columna(df, "Grupo").map(N.norm_txt),
        "tecnologia_raw": _columna(df, "TIPO").map(N.norm_txt),
        "empresa": _columna(df, "EMPRESA").map(N.norm_txt),
        "unidades": _unidades(df, log, "Valor"),
    })
    out = out[fecha.notna()]

    out["marca"] = _aplicar_correcciones(out["marca"], corr.get("marca", {}))
    out["segmento"] = out["segmento_raw"].map(N.segmento_matriculacion)
    seg_corr = corr.get("segmento_matriculacion", {})
    if seg_corr:
        out["segmento"] = [seg_corr.get(raw, seg)
                           for raw, seg in zip(out["segmento_raw"], out["segmento"])]

    tec = out["tecnologia_raw"].map(N.tecnologia)
    desconocidas = out.loc[tec.isna(), "tecnologia_raw"].unique().tolist()
    if desconocidas:
        log.aviso("tecnologia_desconocida",
                  "Valores de TIPO no reconocidos: " + ", ".join(map(str, desconocidas[:8])),
                  int(tec.isna().sum()))
    out["tecnologia"] = tec.fillna(N.TEC_ICE)

    sin_segmento = int((out["segmento"] == N.SEGMENTO_ND).sum())
    log.info("segmento_sin_clasificar",
             "Filas sin segmento en el origen (Grupo='NDA'); se muestran "
             "como dato no disponible, no como un segmento mas", sin_segmento)

    out = out[out["unidades"] != 0]
    out = _unificar_modelos(out, log, corr)

    # Correccion manual de tecnologia: gana sobre lo que trae el archivo.
    #
    # Va DESPUES de _unificar_modelos a proposito. Las correcciones se
    # escriben con el nombre YA unificado ('SONG PRO DMI'), asi que
    # aplicarlas antes dejaba sin corregir las filas que todavia venian
    # con la grafia original ('SONG PRO DM-I') -- 26 de las 102 unidades
    # de ese modelo se quedaban como ICE.
    mod_corr = corr.get("modelo_tecnologia", {})
    if mod_corr:
        antes = out["tecnologia"].copy()
        out["tecnologia"] = [mod_corr.get((mk, mo), t) for mk, mo, t
                             in zip(out["marca"], out["modelo"], out["tecnologia"])]
        cambiadas = int((antes != out["tecnologia"]).sum())
        log.info("tecnologia_corregida",
                 "Filas reclasificadas por correccion manual de tecnologia",
                 cambiadas)

    claves = ["anio", "mes", "marca", "modelo", "segmento", "segmento_raw",
              "tecnologia", "empresa"]
    out = _agrupar(out, claves, log, "matriculacion")
    return _a_tuplas(out, claves + ["unidades"])


# --- importacion (base) ------------------------------------------------

def parse_importacion(df, log, corr) -> list[tuple]:
    fecha = _fechas(df, log, "Fecha")

    def dim(nombre):
        col = _columna(df, nombre)
        return pd.to_numeric(col, errors="coerce").astype("Int64") if col is not None else None

    out = pd.DataFrame({
        "anio": fecha.dt.year,
        "mes": fecha.dt.month,
        "marca": _columna(df, "Marca").map(N.marca),
        "modelo": _columna(df, "Modelo").map(N.norm_txt),
        "segmento_raw": _columna(df, "TIPO GRAL").map(N.norm_txt),
        "tipo_detalle": _columna(df, "TIPO DETALLE").map(N.norm_txt),
        "tipo_cadam": _columna(df, "Tipo cadam").map(N.norm_txt),
        "origen": _columna(df, "ORIGEN").map(N.norm_txt),
        "largo": dim("LARGO"),
        "ancho": dim("ANCHO"),
        "alto": dim("ALTO"),
        "unidades": _unidades(df, log, "Valor"),
    })
    out = out[fecha.notna()]

    out["marca"] = _aplicar_correcciones(out["marca"], corr.get("marca", {}))
    out["segmento"] = out["segmento_raw"].map(N.segmento_importacion)
    seg_corr = corr.get("segmento_importacion", {})
    if seg_corr:
        out["segmento"] = [seg_corr.get(raw, seg)
                           for raw, seg in zip(out["segmento_raw"], out["segmento"])]

    log.info("segmento_sin_clasificar",
             "Filas con TIPO GRAL='NO' (sin clasificar en el origen)",
             int((out["segmento_raw"] == "NO").sum()))

    out = out[out["unidades"] != 0]
    out = _unificar_modelos(out, log, corr)

    # Los hechos se agregan por la clave del mes; tipo_cadam, origen y las
    # dimensiones son atributos DESCRIPTIVOS del modelo (no del mes), y el
    # archivo a veces trae variantes para el mismo modelo -- se toma la mas
    # frecuente y se avisa cuando hubo mas de una.
    claves = ["anio", "mes", "marca", "modelo", "segmento", "segmento_raw",
              "tipo_detalle"]
    atributos = ["tipo_cadam", "origen", "largo", "ancho", "alto"]

    def moda(s):
        m = s.mode(dropna=True)
        return m.iloc[0] if len(m) else None

    antes = len(out)
    out = (out.groupby(claves, as_index=False, sort=False, dropna=False)
              .agg(**{c: (c, moda) for c in atributos},
                   unidades=("unidades", "sum"),
                   _variantes=("tipo_cadam", "nunique")))
    log.info("filas_agrupadas",
             "Filas de importacion con la misma clave, sumadas", antes - len(out))
    log.aviso("clasificacion_ambigua",
              "Modelos con mas de una clasificacion 'Tipo cadam' en el mismo "
              "mes; se tomo la mas frecuente",
              int((out["_variantes"] > 1).sum()))

    columnas = claves + atributos + ["unidades"]
    return _a_tuplas(out, columnas)


# --- NEV ---------------------------------------------------------------

def parse_nev(df, log, corr) -> list[tuple]:
    fecha = _fechas(df, log, "FECHA")
    out = pd.DataFrame({
        "anio": fecha.dt.year,
        "mes": fecha.dt.month,
        "marca": _columna(df, "MARCA").map(N.marca),
        "modelo": _columna(df, "MODELO").map(N.norm_txt),
        "tecnologia_raw": _columna(df, "MOVILIDAD").map(N.norm_txt),
        "unidades": _unidades(df, log, "CANTIDAD"),
    })
    out = out[fecha.notna()]
    out["marca"] = _aplicar_correcciones(out["marca"], corr.get("marca", {}))

    tec = out["tecnologia_raw"].map(N.tecnologia)
    desconocidas = out.loc[tec.isna(), "tecnologia_raw"].unique().tolist()
    if desconocidas:
        log.aviso("tecnologia_desconocida",
                  "Valores de MOVILIDAD no reconocidos: " + ", ".join(map(str, desconocidas[:8])),
                  int(tec.isna().sum()))
    out["tecnologia"] = tec
    out = out[tec.notna()]

    out = out[out["unidades"] != 0]
    out = _unificar_modelos(out, log, corr)
    claves = ["anio", "mes", "marca", "modelo", "tecnologia"]
    out = _agrupar(out, claves, log, "NEV")
    return _a_tuplas(out, claves + ["unidades"])


# --- camiones ----------------------------------------------------------

def parse_camion(df, log, corr) -> list[tuple]:
    fecha = _fechas(df, log, "Fecha")
    out = pd.DataFrame({
        "anio": fecha.dt.year,
        "mes": fecha.dt.month,
        "marca": _columna(df, "Marca").map(N.marca),
        "modelo": _columna(df, "Modelo").map(N.norm_txt),
        "tipo": _columna(df, "Tipo").map(N.norm_txt),
        "unidades": _unidades(df, log, "Valor"),
    })
    out = out[fecha.notna()]
    out["marca"] = _aplicar_correcciones(out["marca"], corr.get("marca", {}))
    out = out[out["unidades"] != 0]
    out = _unificar_modelos(out, log, corr)
    claves = ["anio", "mes", "marca", "modelo", "tipo"]
    out = _agrupar(out, claves, log, "camiones")
    return _a_tuplas(out, claves + ["unidades"])


PARSERS = {
    "matriculacion": (parse_matriculacion, "matriculacion",
                      ["anio", "mes", "marca", "modelo", "segmento",
                       "segmento_raw", "tecnologia", "empresa", "unidades"]),
    "importacion": (parse_importacion, "importacion",
                    ["anio", "mes", "marca", "modelo", "segmento",
                     "segmento_raw", "tipo_detalle", "tipo_cadam", "origen",
                     "largo", "ancho", "alto", "unidades"]),
    "nev": (parse_nev, "importacion_nev",
            ["anio", "mes", "marca", "modelo", "tecnologia", "unidades"]),
    "camion": (parse_camion, "importacion_camion",
               ["anio", "mes", "marca", "modelo", "tipo", "unidades"]),
}
