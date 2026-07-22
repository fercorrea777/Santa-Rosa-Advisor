"""Ingesta de CADAM-DATA a la base local SQLite (../data/cadam.db).

Uso:
    python ingest.py                # ingesta todo lo que haya en CADAM-DATA
    python ingest.py --dry-run      # muestra que haria, sin escribir nada
    python ingest.py --periodo 2026-07

Como organizar CADAM-DATA:

    CADAM-DATA/
      JULIO 2026/                   <- el periodo sale del nombre de la carpeta
        matriculaciones.xlsx
        base importacion.xlsx
        import nev.xlsx
        importacion camiones.xlsx
      AGOSTO 2026/
        ...

El nombre de los archivos no importa: el tipo se detecta por las columnas
reales de cada uno. Si un archivo no matchea ninguna estructura conocida,
se omite y queda registrado en `carga_log` con las columnas que faltaron
-- no se adivina ni se carga a medias.

Los archivos de CADAM son acumulativos (el de julio ya trae 2019..2026),
asi que cada carpeta se guarda como un `snapshot` completo y la app lee
siempre el mas reciente. Reingestar un periodo lo reemplaza; los
snapshots anteriores quedan intactos para trazabilidad.
"""
import argparse
import hashlib
import sqlite3
import sys
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))

from cadam import detect, schema, validar  # noqa: E402
from cadam.rowlevel import PARSERS, Log  # noqa: E402

SCRIPT_DIR = Path(__file__).resolve().parent
DB_PATH = SCRIPT_DIR.parent / "data" / "cadam.db"
CADAM_DATA = SCRIPT_DIR.parent.parent / "CADAM-DATA"

EXT = (".xlsx", ".xls", ".xlsm")


def sha1(ruta: Path) -> str:
    h = hashlib.sha1()
    with open(ruta, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def cargar_correcciones(con) -> dict:
    """Las reclasificaciones manuales del usuario. Se aplican encima de
    los mapas de normalize.py y sobreviven a toda reingesta."""
    corr = {"marca": {}, "modelo": {}, "segmento_matriculacion": {},
            "segmento_importacion": {}, "modelo_tecnologia": {}}
    for alias, marca in con.execute("SELECT alias, marca FROM correccion_marca"):
        corr["marca"][alias] = marca
    for mk, alias, modelo in con.execute(
            "SELECT marca, alias, modelo FROM correccion_modelo"):
        corr["modelo"][(mk, alias)] = modelo
    for fuente, raw, seg in con.execute(
            "SELECT fuente, valor_raw, segmento FROM correccion_segmento"):
        clave = f"segmento_{fuente}"
        if clave in corr:
            corr[clave][raw] = seg
    for mk, mo, tec in con.execute(
            "SELECT marca, modelo, tecnologia FROM correccion_modelo_tecnologia"):
        corr["modelo_tecnologia"][(mk, mo)] = tec
    return corr


def derivar_modelo_base(con, snapshot: str) -> tuple[int, int, int]:
    """Separa MODELO de VERSION en matriculacion.

    Las dos fuentes de CADAM tienen granularidad distinta y eso se puede
    aprovechar en vez de sufrirlo:

        base importacion.xlsx  ->  'HILUX'                  (modelo)
        matriculaciones.xlsx   ->  'HILUX D/C 4X4 SRV AUT'  (version)

    Asi que el catalogo de modelos sale de importacion, y para cada
    version de matriculacion se busca el modelo mas LARGO de esa marca que
    sea prefijo. El mas largo importa: 'COROLLA CROSS' tiene que ganarle a
    'COROLLA'.

    Cuando no hay ningun modelo que matchee (marcas que no importaron este
    periodo, o unidades importadas en anos anteriores), `modelo_base`
    repite la version completa. Es deliberado: preferimos mostrar una
    version en el ranking de modelos antes que adivinar un corte y fusionar
    dos modelos distintos.

    -> (filas con modelo identificado, filas sin identificar, unidades sin identificar)
    """
    catalogo: dict[str, list[str]] = {}
    for marca, modelo in con.execute(
            "SELECT DISTINCT marca, modelo FROM importacion WHERE snapshot = ?",
            (snapshot,)):
        if modelo:
            catalogo.setdefault(marca, []).append(modelo.upper())
    # Del mas largo al mas corto: la primera coincidencia ya es la mejor.
    for marca in catalogo:
        catalogo[marca].sort(key=len, reverse=True)

    filas = con.execute(
        "SELECT rowid, marca, modelo FROM matriculacion WHERE snapshot = ?",
        (snapshot,)).fetchall()

    updates, con_base, sin_base = [], 0, 0
    for rowid, marca, version in filas:
        v = (version or "").upper()
        base = None
        for cand in catalogo.get(marca, ()):
            if v == cand or v.startswith(cand + " "):
                base = cand
                break
        if base:
            con_base += 1
        else:
            base = version
            sin_base += 1
        updates.append((base, rowid))

    con.executemany("UPDATE matriculacion SET modelo_base = ? WHERE rowid = ?", updates)
    unidades_sin = con.execute(
        "SELECT COALESCE(SUM(unidades), 0) FROM matriculacion "
        "WHERE snapshot = ? AND modelo_base = modelo AND modelo NOT IN "
        "(SELECT modelo FROM importacion WHERE snapshot = ?)",
        (snapshot, snapshot)).fetchone()[0]
    con.commit()
    return con_base, sin_base, unidades_sin


def archivos_de(carpeta: Path):
    for p in sorted(carpeta.rglob("*")):
        if p.is_file() and p.suffix.lower() in EXT and not p.name.startswith("~$"):
            yield p


def leer(ruta: Path):
    """-> (df, sheet_names). Devuelve (None, sheets) si no es row-level."""
    engine = "xlrd" if ruta.suffix.lower() == ".xls" else None
    xl = pd.ExcelFile(ruta, engine=engine)
    if detect.es_informe_estadistico(xl.sheet_names):
        return None, xl.sheet_names
    return xl.parse(xl.sheet_names[0]), xl.sheet_names


def ingestar_archivo(con, ruta: Path, periodo: str, corr: dict, dry: bool):
    """-> (tipo, filas_leidas, filas_cargadas, unidades, entradas_log)"""
    log = Log(periodo, ruta.name)
    try:
        df, sheets = leer(ruta)
    except Exception as e:
        log.add("error", "lectura", f"No se pudo abrir el archivo: {e}")
        return None, 0, 0, 0, log.entradas

    if df is None:
        log.info("omitido",
                 f"Informe estadistico de CADAM ({len(sheets)} hojas); "
                 f"lo procesa ingest_cadam.py, no este pipeline")
        return None, 0, 0, 0, log.entradas

    tipo, desc, faltan = detect.tipo_por_columnas(df.columns)
    if tipo is None:
        log.add("error", "estructura_desconocida",
                "No coincide con ninguna estructura conocida. Columnas del "
                f"archivo: {', '.join(map(str, df.columns))}. Falta(n) para "
                f"la firma mas parecida: {', '.join(sorted(faltan))}")
        return None, len(df), 0, 0, log.entradas

    parser, tabla, columnas = PARSERS[tipo]
    filas = parser(df, log, corr)
    unidades = sum(f[-1] for f in filas)
    log.info("cargado", f"Detectado como {desc}", len(filas))

    if not dry:
        con.execute(f"DELETE FROM {tabla} WHERE snapshot = ?", (periodo,))
        marcadores = ", ".join(["?"] * (len(columnas) + 1))
        con.executemany(
            f"INSERT INTO {tabla} (snapshot, {', '.join(columnas)}) "
            f"VALUES ({marcadores})",
            [(periodo, *f) for f in filas],
        )
        con.execute(
            "INSERT INTO archivos (snapshot, nombre, ruta, tipo, sha1, "
            "filas_leidas, filas_cargadas, unidades) VALUES (?,?,?,?,?,?,?,?) "
            "ON CONFLICT(snapshot, nombre) DO UPDATE SET "
            "ruta=excluded.ruta, tipo=excluded.tipo, sha1=excluded.sha1, "
            "filas_leidas=excluded.filas_leidas, "
            "filas_cargadas=excluded.filas_cargadas, "
            "unidades=excluded.unidades, fecha_ingesta=datetime('now')",
            (periodo, ruta.name, str(ruta), tipo, sha1(ruta),
             len(df), len(filas), unidades),
        )
    return tipo, len(df), len(filas), unidades, log.entradas


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--dry-run", action="store_true",
                    help="no escribe en la base, solo muestra el resultado")
    ap.add_argument("--periodo", help="ingestar solo este periodo (AAAA-MM)")
    ap.add_argument("--carpeta", type=Path, default=CADAM_DATA)
    ap.add_argument("--correcciones", action="store_true",
                    help="aplica ../correcciones.sql antes de ingestar")
    args = ap.parse_args()

    if not args.carpeta.exists():
        print(f"ERROR: no existe la carpeta {args.carpeta}")
        sys.exit(1)

    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    con = sqlite3.connect(DB_PATH)
    schema.crear(con)

    if args.correcciones:
        sql = SCRIPT_DIR.parent / "correcciones.sql"
        if not sql.exists():
            print(f"ERROR: no existe {sql}")
            sys.exit(1)
        con.executescript(sql.read_text(encoding="utf-8"))
        con.commit()
        print(f"Correcciones aplicadas desde {sql.name}")

    corr = cargar_correcciones(con)
    if any(corr.values()):
        print("Correcciones manuales activas: " + ", ".join(
            f"{k}={len(v)}" for k, v in corr.items() if v))

    # Agrupar por periodo (carpeta). Los archivos sin periodo detectable
    # se reportan y se omiten -- no se asume el mes actual.
    por_periodo: dict[str, list[Path]] = {}
    sin_periodo: list[Path] = []
    for ruta in archivos_de(args.carpeta):
        p = detect.periodo_de_ruta(ruta, args.carpeta)
        if p is None:
            sin_periodo.append(ruta)
        else:
            por_periodo.setdefault(p, []).append(ruta)

    for ruta in sin_periodo:
        print(f"  [omitido] {ruta.name}: no se pudo determinar el periodo. "
              f"Ponelo en una subcarpeta tipo 'JULIO 2026' o '2026-07'.")

    if args.periodo:
        por_periodo = {k: v for k, v in por_periodo.items() if k == args.periodo}
        if not por_periodo:
            print(f"No hay archivos para el periodo {args.periodo}")
            sys.exit(1)

    if args.dry_run:
        print(">>> DRY RUN: no se escribe nada en la base\n")

    total_log = []
    for periodo in sorted(por_periodo):
        rutas = por_periodo[periodo]
        print(f"\n=== Snapshot {periodo}  ({len(rutas)} archivo(s))")
        n_arch = n_filas = 0
        for ruta in rutas:
            tipo, leidas, cargadas, unidades, entradas = ingestar_archivo(
                con, ruta, periodo, corr, args.dry_run)
            total_log += entradas
            estado = tipo or "OMITIDO"
            print(f"  {ruta.name:<32} {estado:<14} "
                  f"{leidas:>7} leidas -> {cargadas:>7} filas, {unidades:>8} unid.")
            for _s, _a, nivel, cat, msg, n in entradas:
                if nivel in ("aviso", "error") and n:
                    print(f"      [{nivel}] {cat}: {msg} ({n})")
            if tipo:
                n_arch += 1
                n_filas += cargadas
        if not args.dry_run:
            carpeta = rutas[0].parent
            con.execute(
                "INSERT INTO snapshots (periodo, carpeta, n_archivos, n_filas) "
                "VALUES (?,?,?,?) ON CONFLICT(periodo) DO UPDATE SET "
                "carpeta=excluded.carpeta, n_archivos=excluded.n_archivos, "
                "n_filas=excluded.n_filas, fecha_ingesta=datetime('now')",
                (periodo, str(carpeta), n_arch, n_filas),
            )

    if not args.dry_run:
        for periodo in sorted(por_periodo):
            con.execute("DELETE FROM carga_log WHERE snapshot = ?", (periodo,))
        con.executemany(
            "INSERT INTO carga_log (snapshot, archivo, nivel, categoria, mensaje, n) "
            "VALUES (?,?,?,?,?,?)", total_log)
        con.commit()

        # Separar modelo de version: necesita TODOS los archivos del
        # snapshot ya cargados (el catalogo sale de importacion), asi que
        # va aca y no dentro del parser de matriculacion.
        for periodo in sorted(por_periodo):
            con_base, sin_base, unid_sin = derivar_modelo_base(con, periodo)
            if con_base or sin_base:
                total = con_base + sin_base
                print(f"\n--- Modelo vs version {periodo}")
                print(f"  {con_base} de {total} filas con modelo identificado "
                      f"desde el catalogo de importacion")
                print(f"  {sin_base} sin identificar ({unid_sin:,} unidades): "
                      f"se muestran con la version completa")
                con.execute(
                    "INSERT INTO carga_log (snapshot, archivo, nivel, categoria, mensaje, n) "
                    "VALUES (?,?,?,?,?,?)",
                    (periodo, None, "info", "modelo_derivado",
                     f"Modelo separado de version usando el catalogo de importacion: "
                     f"{con_base} de {total} filas identificadas. Las {sin_base} "
                     f"restantes ({unid_sin:,} unidades) muestran la version completa "
                     f"en el ranking de modelos, en vez de adivinar el corte.",
                     sin_base))
        con.commit()

        # Controles cruzados entre fuentes (incluye el cruce contra el
        # informe oficial de CADAM). Se corren con los datos ya escritos.
        for periodo in sorted(por_periodo):
            print(f"\n--- Controles de consistencia {periodo}")
            hallazgos = validar.correr(con, periodo)
            con.executemany(
                "INSERT INTO carga_log (snapshot, archivo, nivel, categoria, mensaje, n) "
                "VALUES (?,?,?,?,?,?)", hallazgos)
            for _s, _a, nivel, _cat, msg, n in hallazgos:
                marca = {"info": "  ok ", "aviso": " avi", "error": "ERR "}.get(nivel, "    ")
                print(f"  [{marca}] {msg}" + (f"  ({n})" if nivel != "info" else ""))
            if not hallazgos:
                print("  sin hallazgos")
        con.commit()
        activo = con.execute("SELECT periodo FROM v_snapshot_actual").fetchone()
        print(f"\nSnapshot activo (el que lee la app): {activo[0] if activo else 'ninguno'}")
        print(f"Listo -> {DB_PATH}")
    con.close()


if __name__ == "__main__":
    main()
