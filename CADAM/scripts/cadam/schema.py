"""Esquema de las tablas row-level de CADAM.

Convive con las tablas de los informes estadisticos (matriculacion_marca,
importacion_tipo_mensual, ...) que crea ingest_cadam.py -- no las toca.
Esas alimentan la pantalla Inicio actual; estas alimentan todo lo nuevo.

MODELO DE SNAPSHOT
------------------
Los archivos row-level de CADAM son ACUMULATIVOS: el archivo de julio ya
contiene 2019..2026 completo, no solo julio. Por eso no se acumulan filas
mes a mes (se duplicaria todo el historico).

En cambio cada carga es un `snapshot` identificado por el periodo de la
carpeta (`CADAM-DATA/JULIO 2026/` -> '2026-07'):

  - Los hechos se guardan etiquetados con su snapshot.
  - La app lee SIEMPRE el snapshot mas reciente (vista `v_*_actual`).
  - Los snapshots viejos NO se borran: quedan para trazabilidad y para
    poder auditar que cambio entre una publicacion y la siguiente.

Asi se cumplen las dos reglas a la vez: nunca se pierde historico y nunca
se duplica (CLAUDE.md sec. 7).

CORRECCIONES MANUALES
---------------------
Las tablas `correccion_*` guardan las reclasificaciones que hace el
usuario. Se aplican DESPUES de los mapas de normalize.py y tienen
prioridad sobre ellos. Nunca se borran al reingestar: sobreviven a todas
las cargas futuras (CLAUDE.md sec. 8).
"""

SCHEMA = """
-- ---------- trazabilidad ----------

CREATE TABLE IF NOT EXISTS snapshots (
    periodo        TEXT PRIMARY KEY,      -- 'AAAA-MM' derivado de la carpeta
    carpeta        TEXT NOT NULL,
    fecha_ingesta  TEXT NOT NULL DEFAULT (datetime('now')),
    n_archivos     INTEGER NOT NULL DEFAULT 0,
    n_filas        INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS archivos (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    snapshot       TEXT NOT NULL,
    nombre         TEXT NOT NULL,
    ruta           TEXT NOT NULL,
    tipo           TEXT NOT NULL,         -- matriculacion|importacion|nev|camion
    sha1           TEXT,
    filas_leidas   INTEGER NOT NULL DEFAULT 0,
    filas_cargadas INTEGER NOT NULL DEFAULT 0,
    unidades       INTEGER NOT NULL DEFAULT 0,
    fecha_ingesta  TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(snapshot, nombre)
);

-- Alimenta la pantalla "Calidad de datos": todo aviso o error de carga
-- queda registrado en vez de romper la ingesta o pasar desapercibido.
CREATE TABLE IF NOT EXISTS carga_log (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    snapshot  TEXT NOT NULL,
    archivo   TEXT,
    nivel     TEXT NOT NULL,              -- info|aviso|error
    categoria TEXT NOT NULL,              -- columna_faltante|valor_desconocido|...
    mensaje   TEXT NOT NULL,
    n         INTEGER NOT NULL DEFAULT 1, -- cuantas filas afectadas
    fecha     TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ---------- hechos ----------

CREATE TABLE IF NOT EXISTS matriculacion (
    snapshot     TEXT NOT NULL,
    anio         INTEGER NOT NULL,
    mes          INTEGER NOT NULL,
    marca        TEXT NOT NULL,
    modelo       TEXT NOT NULL,
    segmento     TEXT NOT NULL,           -- canonico (normalize.py)
    segmento_raw TEXT NOT NULL,           -- 'Grupo' tal cual vino
    tecnologia   TEXT NOT NULL,           -- ICE|MHEV|HEV|PHEV|REEV|EV
    empresa      TEXT NOT NULL,           -- importador/representante
    unidades     INTEGER NOT NULL,
    PRIMARY KEY (snapshot, anio, mes, marca, modelo, segmento, tecnologia, empresa)
);

CREATE TABLE IF NOT EXISTS importacion (
    snapshot     TEXT NOT NULL,
    anio         INTEGER NOT NULL,
    mes          INTEGER NOT NULL,
    marca        TEXT NOT NULL,
    modelo       TEXT NOT NULL,
    segmento     TEXT NOT NULL,           -- canonico, desde 'TIPO GRAL'
    segmento_raw TEXT NOT NULL,
    tipo_detalle TEXT NOT NULL,           -- 'SUV C', 'PICK UP MEDIANO', ...
    tipo_cadam   TEXT NOT NULL,           -- clasificacion fina de CADAM
    origen       TEXT NOT NULL,           -- CHINA|OTROS (es un flag, no el pais)
    largo        INTEGER,
    ancho        INTEGER,
    alto         INTEGER,
    unidades     INTEGER NOT NULL,
    PRIMARY KEY (snapshot, anio, mes, marca, modelo, segmento, tipo_detalle)
);

-- Vehiculos de energia nueva, por marca/modelo.
--
-- ATENCION: es un SUBCONJUNTO de `importacion`, NO una fuente adicional.
-- Verificado sobre jul-2026:
--     importacion 2026            24.047  = informe oficial (Cuadro 3)
--     importacion + NEV 2026      28.145  = excede el oficial en 4.098
-- Sumarlas duplica exactamente el total de NEV.
--
-- Por eso: `importacion` es la fuente de VOLUMEN e `importacion_nev` es
-- el detalle de TECNOLOGIA (la base de importacion no trae esa columna).
-- NUNCA hacer UNION ni sumar las dos. Solo cubre EV/HEV/PHEV desde 2024
-- (no trae MHEV ni REEV).
CREATE TABLE IF NOT EXISTS importacion_nev (
    snapshot   TEXT NOT NULL,
    anio       INTEGER NOT NULL,
    mes        INTEGER NOT NULL,
    marca      TEXT NOT NULL,
    modelo     TEXT NOT NULL,
    tecnologia TEXT NOT NULL,
    unidades   INTEGER NOT NULL,
    PRIMARY KEY (snapshot, anio, mes, marca, modelo, tecnologia)
);

CREATE TABLE IF NOT EXISTS importacion_camion (
    snapshot TEXT NOT NULL,
    anio     INTEGER NOT NULL,
    mes      INTEGER NOT NULL,
    marca    TEXT NOT NULL,
    modelo   TEXT NOT NULL,
    tipo     TEXT NOT NULL,
    unidades INTEGER NOT NULL,
    PRIMARY KEY (snapshot, anio, mes, marca, modelo, tipo)
);

-- ---------- maestras editables (sobreviven a toda reingesta) ----------

CREATE TABLE IF NOT EXISTS correccion_segmento (
    fuente    TEXT NOT NULL,              -- matriculacion|importacion
    valor_raw TEXT NOT NULL,
    segmento  TEXT NOT NULL,
    nota      TEXT,
    fecha     TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (fuente, valor_raw)
);

CREATE TABLE IF NOT EXISTS correccion_marca (
    alias TEXT PRIMARY KEY,
    marca TEXT NOT NULL,
    nota  TEXT,
    fecha TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS correccion_tecnologia (
    valor_raw  TEXT PRIMARY KEY,
    tecnologia TEXT NOT NULL,
    nota       TEXT,
    fecha      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Unificacion manual de grafias de modelo, para los casos que la regla
-- automatica no puede resolver sola. La regla ignora espacios, guiones,
-- barras y puntos, pero CONSERVA el '+' porque a veces distingue modelos
-- de verdad (LEXUS RX450H+ es el PHEV, no el RX450H). Los casos donde el
-- '+' era ruido -- 'SUNRAY 16+1' vs 'SUNRAY 161' -- se arreglan aca.
CREATE TABLE IF NOT EXISTS correccion_modelo (
    marca  TEXT NOT NULL,
    alias  TEXT NOT NULL,
    modelo TEXT NOT NULL,
    nota   TEXT,
    fecha  TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (marca, alias)
);

-- Reclasificacion de un modelo puntual (ej. separar un HEV que CADAM
-- reporta agregado). Gana sobre la tecnologia que trae el archivo.
CREATE TABLE IF NOT EXISTS correccion_modelo_tecnologia (
    marca      TEXT NOT NULL,
    modelo     TEXT NOT NULL,
    tecnologia TEXT NOT NULL,
    nota       TEXT,
    fecha      TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (marca, modelo)
);

-- ---------- indices ----------

CREATE INDEX IF NOT EXISTS ix_matric_periodo  ON matriculacion (snapshot, anio, mes);
CREATE INDEX IF NOT EXISTS ix_matric_marca    ON matriculacion (snapshot, marca);
CREATE INDEX IF NOT EXISTS ix_matric_segmento ON matriculacion (snapshot, segmento);
CREATE INDEX IF NOT EXISTS ix_import_periodo  ON importacion   (snapshot, anio, mes);
CREATE INDEX IF NOT EXISTS ix_import_marca    ON importacion   (snapshot, marca);
CREATE INDEX IF NOT EXISTS ix_import_segmento ON importacion   (snapshot, segmento);
"""

# Vistas: siempre el snapshot mas reciente. La app consulta estas, nunca
# las tablas base, para no tener que saber cual es el snapshot vigente.
VIEWS = """
DROP VIEW IF EXISTS v_snapshot_actual;
CREATE VIEW v_snapshot_actual AS
    SELECT periodo FROM snapshots ORDER BY periodo DESC LIMIT 1;

DROP VIEW IF EXISTS v_matriculacion;
CREATE VIEW v_matriculacion AS
    SELECT * FROM matriculacion
    WHERE snapshot = (SELECT periodo FROM v_snapshot_actual);

DROP VIEW IF EXISTS v_importacion;
CREATE VIEW v_importacion AS
    SELECT * FROM importacion
    WHERE snapshot = (SELECT periodo FROM v_snapshot_actual);

DROP VIEW IF EXISTS v_importacion_nev;
CREATE VIEW v_importacion_nev AS
    SELECT * FROM importacion_nev
    WHERE snapshot = (SELECT periodo FROM v_snapshot_actual);

DROP VIEW IF EXISTS v_importacion_camion;
CREATE VIEW v_importacion_camion AS
    SELECT * FROM importacion_camion
    WHERE snapshot = (SELECT periodo FROM v_snapshot_actual);
"""


def crear(con):
    con.executescript(SCHEMA)
    con.executescript(VIEWS)
    con.commit()
