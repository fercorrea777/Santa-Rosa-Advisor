#!/usr/bin/env bash
#
# Baja los informes de CADAM desde OneDrive, los ingesta y deja la base
# lista para la app, en un solo paso.
#
#     ./actualizar-desde-onedrive.sh              # sync + ingesta real
#     ./actualizar-desde-onedrive.sh --dry-run    # muestra qué haría
#     ./actualizar-desde-onedrive.sh --sin-sync   # ingesta lo que ya está en disco
#
# La carpeta de origen sale de CADAM_ORIGEN; si no está, usa el default de
# abajo. Cambiala sin tocar el script:
#
#     CADAM_ORIGEN="/otra/ruta" ./actualizar-desde-onedrive.sh
#
set -euo pipefail

# Carpeta sincronizada de OneDrive. El default asume el cliente abraunegg
# (`sudo apt install onedrive`), que sincroniza a ~/OneDrive, y que la
# carpeta compartida por amino se agregó con "Agregar acceso directo a Mis
# archivos" — sin ese paso la cuenta propia no la ve y no baja nada.
ORIGEN="${CADAM_ORIGEN:-$HOME/OneDrive/DASH FER}"

# Nombre de la carpeta dentro de OneDrive, para el sync selectivo. Bajar el
# OneDrive entero para leer cuatro planillas por mes es tirar ancho de banda
# y disco a la basura.
CARPETA_REMOTA="${CADAM_CARPETA_REMOTA:-DASH FER}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

DRY_RUN=""
SIN_SYNC=""
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN="--dry-run" ;;
    --sin-sync) SIN_SYNC="1" ;;
    -h|--help) sed -n '2,20p' "${BASH_SOURCE[0]}" | sed 's/^# \?//'; exit 0 ;;
    *) echo "Opción desconocida: $arg" >&2; exit 2 ;;
  esac
done

# ---------------------------------------------------------------- 1. sync
if [ -z "$SIN_SYNC" ]; then
  if ! command -v onedrive >/dev/null 2>&1; then
    cat >&2 <<'FIN'
ERROR: no está instalado el cliente de OneDrive.

    sudo apt install onedrive     # Ubuntu 24.04 trae el de abraunegg
    onedrive                      # autenticar (login de Microsoft)

Y antes de eso, la carpeta compartida tiene que estar agregada a tu propio
OneDrive con "Agregar acceso directo a Mis archivos" en la web: el cliente
autentica con TU cuenta y sin ese paso no ve lo que te compartieron.

Si ya tenés los archivos en disco por otra vía, saltá el sync:

    ./actualizar-desde-onedrive.sh --sin-sync
FIN
    exit 1
  fi
  echo ">> Sincronizando '$CARPETA_REMOTA' desde OneDrive…"
  # --download-only: esto es un consumidor de los informes, no su dueño. Sin
  # esto, un borrado local se propagaría a la carpeta compartida de otra
  # persona.
  onedrive --synchronize --download-only \
           --single-directory "$CARPETA_REMOTA"
fi

# ------------------------------------------------------------- 2. ingesta
if [ ! -d "$ORIGEN" ]; then
  echo "ERROR: no existe la carpeta de origen: $ORIGEN" >&2
  echo "Definila con CADAM_ORIGEN si está en otro lado." >&2
  exit 1
fi

echo ">> Ingestando desde: $ORIGEN"
cd "$SCRIPT_DIR"
# --correcciones aplica correcciones.sql antes de cargar; en --dry-run corre
# contra una copia en memoria y no toca la base.
python3 ingest.py --carpeta "$ORIGEN" --correcciones $DRY_RUN

# ------------------------------------------- 3. copiar la base a la app
if [ -n "$DRY_RUN" ]; then
  echo ">> DRY RUN: no se copia la base a data/."
  exit 0
fi

echo ">> Copiando base y parámetros a data/…"
cd "$APP_DIR"
npm run sync-datos

echo
echo "Listo. Revisá el dashboard; si va a producción, commiteá data/."
