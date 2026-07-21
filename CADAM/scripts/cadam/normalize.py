"""Normalizacion de texto y de las taxonomias de CADAM.

Los archivos de CADAM traen la misma categoria escrita de varias formas
(mayusculas, acentos, espacios dobles). Ej. reales medidos sobre
'base importacion.xlsx' (jul-2026):

    'Tipo cadam'   69 variantes crudas -> 30 normalizadas
                   ('SUV mediano C' / 'SUV Mediano C' / 'SUV mediano c')
    'TIPO GRAL'    10 -> 9  ('FURGON' vs 'FURGÓN')
    'TIPO DETALLE' 23 -> 22 ('FURGON GRANDE' vs 'FURGÓN GRANDE')

Todo lo que viene del Excel pasa primero por norm_txt() y despues por el
mapa de la dimension correspondiente. Los mapas viven aca (no dispersos
en ifs) para que se puedan ampliar en un solo lugar; los alias que el
usuario corrige a mano se guardan en la tabla `segmento_alias` de la BD y
tienen prioridad sobre estos (ver schema.py).
"""
import re
import unicodedata

# --- texto -------------------------------------------------------------

def norm_txt(valor) -> str:
    """'  SUV mediano c ' -> 'SUV MEDIANO C'. Sin acentos, sin espacios
    repetidos, en mayusculas. Devuelve '' para nulos/NaN."""
    if valor is None:
        return ""
    s = str(valor)
    if s.strip().lower() in ("nan", "nat", "none", ""):
        return ""
    s = " ".join(s.split()).upper()
    return "".join(c for c in unicodedata.normalize("NFD", s)
                   if unicodedata.category(c) != "Mn")


def titulo(valor: str) -> str:
    """'SUV MEDIANO C' -> 'SUV mediano C'. Solo para mostrar en la UI
    cuando no hay una etiqueta curada."""
    s = norm_txt(valor)
    if not s:
        return ""
    return s[0] + s[1:].lower()


# --- segmento ----------------------------------------------------------
# Conjunto canonico al que se mapean AMBAS fuentes. Se eligio uno que
# ambas puedan alcanzar sin inventar precision: matriculacion trae
# 'Camioneta' (que en PY es la pick up) y 'SUV/St. Wagon' juntos, e
# importacion trae 'PICK UP' y 'SUV' por separado -- coinciden.
SEGMENTO_AUTOMOVIL = "Automovil"
SEGMENTO_SUV = "SUV"
SEGMENTO_PICKUP = "Pick Up"
SEGMENTO_FURGON = "Furgon"
SEGMENTO_MINIBUS = "Minibus"
SEGMENTO_CAMION = "Camion"
SEGMENTO_OMNIBUS = "Omnibus"
SEGMENTO_CITY = "City car"
SEGMENTO_OTROS = "Otros"
SEGMENTO_ND = "Sin clasificar"

# Orden de presentacion en rankings y graficos.
SEGMENTOS_ORDEN = [
    SEGMENTO_SUV, SEGMENTO_PICKUP, SEGMENTO_AUTOMOVIL, SEGMENTO_CITY,
    SEGMENTO_FURGON, SEGMENTO_MINIBUS, SEGMENTO_CAMION, SEGMENTO_OMNIBUS,
    SEGMENTO_OTROS, SEGMENTO_ND,
]

# matriculaciones.xlsx, columna 'Grupo'
SEGMENTO_MATRICULACION = {
    "AUTOMOVIL": SEGMENTO_AUTOMOVIL,
    "SUV/ST. WAGON": SEGMENTO_SUV,
    "SUV/ST WAGON": SEGMENTO_SUV,
    "CAMIONETA": SEGMENTO_PICKUP,
    "FURGON": SEGMENTO_FURGON,
    "MINIBUS": SEGMENTO_MINIBUS,
    "CAMION": SEGMENTO_CAMION,
    "OMNIBUS": SEGMENTO_OMNIBUS,
    "MINI": SEGMENTO_CITY,
    # 'NDA' = el archivo no trae el segmento (todo 2022 y 2023). NO es
    # un segmento real: se marca como sin clasificar para que la UI lo
    # muestre como dato no disponible y no como una categoria mas.
    "NDA": SEGMENTO_ND,
}

# base importacion.xlsx, columna 'TIPO GRAL'
SEGMENTO_IMPORTACION = {
    "AUTO": SEGMENTO_AUTOMOVIL,
    "SUV": SEGMENTO_SUV,
    "PICK UP": SEGMENTO_PICKUP,
    "PICKUP": SEGMENTO_PICKUP,
    "FURGON": SEGMENTO_FURGON,
    "MINIBUS": SEGMENTO_MINIBUS,
    "CAMION": SEGMENTO_CAMION,
    "OMNIBUS": SEGMENTO_OMNIBUS,
    "CITY": SEGMENTO_CITY,
    "OTROS": SEGMENTO_OTROS,
    "NO": SEGMENTO_ND,
}


def segmento_matriculacion(grupo) -> str:
    return SEGMENTO_MATRICULACION.get(norm_txt(grupo), SEGMENTO_OTROS)


def segmento_importacion(tipo_gral) -> str:
    return SEGMENTO_IMPORTACION.get(norm_txt(tipo_gral), SEGMENTO_OTROS)


# --- tecnologia --------------------------------------------------------
# matriculaciones.xlsx trae la columna 'TIPO' ya con la granularidad que
# se necesita: ICE / MHEV / HEV / PHEV / REEV / EV. Se respeta tal cual.
#
# IMPORTANTE (CLAUDE.md sec. 9): no agrupar categorias incompatibles.
# MHEV no es HEV, PHEV no es HEV, REEV no es EV. El agrupamiento a
# Combustion / Hibridos / Electricos es OPCIONAL y solo para mostrar:
# el detalle original nunca se pierde.
TEC_ICE = "ICE"
TEC_MHEV = "MHEV"
TEC_HEV = "HEV"
TEC_PHEV = "PHEV"
TEC_REEV = "REEV"
TEC_EV = "EV"

TECNOLOGIAS_ORDEN = [TEC_ICE, TEC_MHEV, TEC_HEV, TEC_PHEV, TEC_REEV, TEC_EV]

TECNOLOGIA = {
    "ICE": TEC_ICE, "COMBUSTION": TEC_ICE, "NAFTA": TEC_ICE,
    "DIESEL": TEC_ICE, "GASOIL": TEC_ICE, "FLEX": TEC_ICE,
    "MHEV": TEC_MHEV, "MILD HYBRID": TEC_MHEV, "MILD-HYBRID": TEC_MHEV,
    "HEV": TEC_HEV, "HIBRIDO": TEC_HEV,
    "PHEV": TEC_PHEV,
    "REEV": TEC_REEV,
    "EV": TEC_EV, "ELECTRICO": TEC_EV, "BEV": TEC_EV,
}

# Agrupacion opcional (nunca reemplaza al detalle).
TECNOLOGIA_GRUPO = {
    TEC_ICE: "Combustion",
    TEC_MHEV: "Hibridos",
    TEC_HEV: "Hibridos",
    TEC_PHEV: "Hibridos",
    TEC_REEV: "Electricos",
    TEC_EV: "Electricos",
}


def tecnologia(valor) -> str | None:
    """Devuelve la tecnologia canonica, o None si no se reconoce.
    None se registra como aviso en el log de carga en vez de inventar
    una categoria."""
    return TECNOLOGIA.get(norm_txt(valor))


# --- marca -------------------------------------------------------------
# Variantes reales detectadas en los archivos de CADAM. Se normaliza a la
# grafia que usa el informe oficial para poder cruzar fuentes.
MARCA_ALIAS = {
    "GREATWALL": "GREAT WALL",
    "GREAT WALL MOTORS": "GREAT WALL",
    "GWM": "GREAT WALL",
    "LINK&CO": "LYNK&CO",
    "LINK & CO": "LYNK&CO",
    "LYNK & CO": "LYNK&CO",
    "MMC": "MITSUBISHI",
    "MISTUBISHI": "MITSUBISHI",       # typo real en la fuente
    "MITSUBISHI MOTORS": "MITSUBISHI",
    "JETUOR": "JETOUR",               # typo real en la fuente
    "MERCEDES-BENZ": "MERCEDES BENZ",
    "VW": "VOLKSWAGEN",
}


def marca(valor) -> str:
    m = norm_txt(valor)
    return MARCA_ALIAS.get(m, m)


# --- modelo -------------------------------------------------------------
# La DNRA carga el nombre del modelo a mano y CADAM lo publica sin
# corregir, asi que el MISMO modelo aparece escrito de varias formas. Casos
# reales medidos (jul-2026), y no son marginales:
#
#   TOYOTA  'HILUX D/C 4X4 SRV AUT' 2.740 u  vs 'HILUX DC 4X4 SRV AUT.' 243 u
#   BYD     'SONG PLUS DMI'           131 u  vs 'SONG PLUS DM I'         83 u
#   MAZDA   'CX5'                     682 u  vs 'CX-5'                  290 u
#
# En total 121 grupos en matriculacion y 6 en importacion. Partidos asi,
# un modelo puede quedar fuera del Top 10 por estar contado en dos filas.
#
# La clave de comparacion ignora espacios, guiones, barras, comas y puntos.

# PERO CONSERVA EL '+', que en este dominio SI distingue modelos distintos:
#   LEXUS 'RX450H+' es el PHEV, no es el 'RX450H'
#   MERCEDES '4MATIC+' no es '4MATIC'
# El costo es que quedan sin unificar casos donde el '+' era ruido
# ('SUNRAY 16+1' vs 'SUNRAY 161'); esos se arreglan a mano con la tabla
# correccion_modelo. Preferimos NO unir dos modelos distintos antes que
# unir todo lo que se parece.
_RE_RUIDO_MODELO = re.compile(r"[\s\-/,.]+")


def clave_modelo(valor) -> str:
    """'SONG PLUS DM I' y 'SONG PLUS DMI' -> 'SONGPLUSDMI'.
    Solo para AGRUPAR: la grafica que se muestra es la mas frecuente."""
    return _RE_RUIDO_MODELO.sub("", norm_txt(valor))
