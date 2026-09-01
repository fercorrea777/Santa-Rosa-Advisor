"""Ingesta de la lista de precios propia de Santa Rosa a cadam.db.

    python ingest_precios.py lista.xlsx --periodo 2026-07 --dry-run
    python ingest_precios.py lista.xlsx --periodo 2026-07

Lee .xlsx/.xls/.csv. Las columnas se detectan por ALIAS, no por posicion ni
por nombre exacto: el mismo dato viene titulado distinto segun quien exporto
el archivo, y el pipeline de CADAM ya resuelve asi el resto de sus fuentes.
Si falta una columna obligatoria lo dice y no carga nada a medias.

ALCANCE: esto es la lista PROPIA, o sea que solo cubre las marcas del grupo
(11 de las 109 del mercado). No sirve para comparar precios contra la
competencia -- ese dato es externo y no esta en CADAM. Sirve para posicionar
la gama propia.
"""
import argparse
import sqlite3
import sys
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))

from cadam.precios import parse_money  # noqa: E402

SCRIPT_DIR = Path(__file__).resolve().parent
DB_PATH = SCRIPT_DIR.parent / "data" / "cadam.db"

# Alias por columna. Se comparan normalizados (sin acentos, sin puntuacion,
# minusculas), asi "Precio M/N" y "precio mn" son la misma.
ALIAS = {
    "marca": ["marca", "brand"],
    "modelo": ["modelo", "model", "modelobase"],
    "version": ["version", "versión", "descripcion", "descripción", "detalle"],
    "precio": ["precio", "preciomn", "preciolista", "pvp", "price", "importe"],
    "moneda": ["moneda", "currency"],
}
OBLIGATORIAS = ("marca", "modelo", "precio")

ESQUEMA = """
create table if not exists precio_modelo (
  marca      text not null,
  modelo     text not null,
  version    text not null default '',
  periodo    text not null,
  precio     real not null,
  moneda     text not null default 'GS',
  fuente     text,
  cargado_en text not null default (datetime('now')),
  primary key (marca, modelo, version, periodo)
);
create index if not exists precio_modelo_periodo_idx on precio_modelo (periodo);
"""


def normalizar(s: str) -> str:
    base = str(s or "").lower()
    for a, b in (("á", "a"), ("é", "e"), ("í", "i"), ("ó", "o"), ("ú", "u"), ("ñ", "n")):
        base = base.replace(a, b)
    return "".join(c for c in base if c.isalnum())


def mapear_columnas(df: pd.DataFrame) -> dict:
    """-> {campo: nombre_real_de_columna}. Solo los que encuentra."""
    encontrado = {}
    normalizadas = {normalizar(c): c for c in df.columns}
    for campo, alias in ALIAS.items():
        for a in alias:
            col = normalizadas.get(normalizar(a))
            if col is not None:
                encontrado[campo] = col
                break
    return encontrado


def leer(ruta: Path) -> pd.DataFrame:
    if ruta.suffix.lower() == ".csv":
        return pd.read_csv(ruta, dtype=str, keep_default_na=False)
    engine = "xlrd" if ruta.suffix.lower() == ".xls" else None
    return pd.read_excel(ruta, dtype=str, keep_default_na=False, engine=engine)


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("archivo", type=Path)
    ap.add_argument("--periodo", required=True,
                    help="periodo de vigencia de la lista, AAAA-MM")
    ap.add_argument("--dry-run", action="store_true",
                    help="no escribe en la base, solo muestra el resultado")
    ap.add_argument("--moneda", default="GS",
                    help="moneda por defecto si el archivo no trae columna (GS)")
    args = ap.parse_args()

    if not args.archivo.exists():
        print(f"ERROR: no existe {args.archivo}")
        sys.exit(1)
    if len(args.periodo) != 7 or args.periodo[4] != "-":
        print(f"ERROR: --periodo debe ser AAAA-MM, vino '{args.periodo}'")
        sys.exit(1)

    try:
        df = leer(args.archivo)
    except Exception as e:
        print(f"ERROR: no se pudo abrir el archivo: {e}")
        sys.exit(1)

    cols = mapear_columnas(df)
    faltan = [c for c in OBLIGATORIAS if c not in cols]
    if faltan:
        print(f"ERROR: no encontre columna(s) para: {', '.join(faltan)}")
        print(f"       columnas del archivo: {list(df.columns)}")
        print("       alias que se aceptan:")
        for campo in faltan:
            print(f"         {campo}: {', '.join(ALIAS[campo])}")
        sys.exit(1)

    print(f"Columnas detectadas: " + ", ".join(f"{k}='{v}'" for k, v in cols.items()))

    filas, sin_precio = [], 0
    for _, r in df.iterrows():
        marca = str(r[cols["marca"]]).strip().upper()
        modelo = str(r[cols["modelo"]]).strip().upper()
        if not marca or not modelo:
            continue
        precio = parse_money(r[cols["precio"]])
        if precio <= 0:
            sin_precio += 1
            continue
        version = str(r[cols["version"]]).strip().upper() if "version" in cols else ""
        moneda = (str(r[cols["moneda"]]).strip().upper() if "moneda" in cols else "") or args.moneda
        filas.append((marca, modelo, version, args.periodo, precio,
                      moneda, args.archivo.name))

    print(f"{len(filas)} filas con precio valido"
          + (f", {sin_precio} sin precio (omitidas)" if sin_precio else ""))
    if not filas:
        print("Nada para cargar.")
        sys.exit(1)

    # Muestra para revisar a ojo ANTES de escribir: si el separador decimal
    # se leyo mal, se ve acá y no tres semanas despues.
    print("\nPrimeras filas:")
    for f in filas[:5]:
        print(f"  {f[0]:<14} {f[1]:<20} {f[4]:>15,.0f} {f[5]}")

    if args.dry_run:
        print("\n>>> DRY RUN: no se escribio nada en la base")
        return

    con = sqlite3.connect(DB_PATH)
    try:
        con.executescript(ESQUEMA)
        # Reingestar un periodo lo REEMPLAZA, no lo duplica — mismo criterio
        # que los snapshots de ingest.py.
        con.execute("delete from precio_modelo where periodo = ?", (args.periodo,))
        con.executemany(
            """insert into precio_modelo
               (marca, modelo, version, periodo, precio, moneda, fuente)
               values (?,?,?,?,?,?,?)""", filas)
        con.commit()
    finally:
        con.close()
    print(f"\nListo: {len(filas)} precios cargados para {args.periodo}.")


if __name__ == "__main__":
    main()
