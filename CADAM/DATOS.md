# Diccionario de datos y decisiones técnicas — CADAM

Verificado contra los archivos reales de `CADAM-DATA/JULIO 2026/` el 2026-07-21.
No asumir nada de este documento sin volver a medirlo si CADAM cambia el formato.

## 1. Cómo se organiza CADAM-DATA

```
CADAM-DATA/
  JULIO 2026/          <- el período sale del NOMBRE DE LA CARPETA
    matriculaciones.xlsx
    base importacion.xlsx
    import nev.xlsx
    importacion camiones.xlsx
  AGOSTO 2026/
    ...
```

El nombre de los archivos **no importa**: el tipo se detecta por las columnas
reales (`cadam/detect.py`). Formatos de carpeta reconocidos: `JULIO 2026`,
`jul_2026`, `2026-07`.

## 2. Las cuatro fuentes row-level

| Archivo | Filas | Cobertura | Columnas |
|---|---|---|---|
| `matriculaciones.xlsx` | 32.957 | 2022-01 → 2026-06 | Fecha, Grupo, Marca, Modelo, Valor, TIPO, EMPRESA |
| `base importacion.xlsx` | 44.704 | 2019-01 → 2026-06 | Marca, Modelo, Tipo cadam, Fecha, Valor, ORIGEN, TIPO GRAL, LARGO, ANCHO, ALTO, TIPO DETALLE |
| `import nev.xlsx` | 4.180 | 2024-01 → 2026-06 | FECHA, MOVILIDAD, MARCA, MODELO, CANTIDAD |
| `importacion camiones.xlsx` | 10.470 | 2023-01 → 2026-06 | Marca, Modelo, Tipo, Fecha, Valor |

`Valor` / `CANTIDAD` son **unidades**, no importes.

### ⚠️ `import nev.xlsx` NO se suma — es un subconjunto

Los vehículos de `import nev.xlsx` **ya están dentro** de
`base importacion.xlsx`. Prueba:

```
base importacion 2026        24.047  = informe oficial (Cuadro 3)  ✓
base importacion + NEV 2026  28.145  = excede el oficial en 4.098  ✗
```

Sumarlas duplica exactamente el total del NEV. Por eso:

- **`importacion`** es la fuente de **volumen**.
- **`importacion_nev`** es el detalle de **tecnología** (la base de importación
  no trae columna de tecnología).
- Nunca hacer `UNION` ni sumar las dos. Hay un control automático
  (`validar.py::nev_contenido_en_importacion`) que lo vigila en cada carga.

Hay 18 combinaciones marca+mes donde el NEV excede a la base. Son marcas que
la base agrupa distinto (`HAVAL` bajo `GREAT WALL`) o vehículos que están en
`importacion camiones.xlsx` (`JAC CAMION`, `FARIZON`, `GOTOGO`). Quedan
registradas como aviso, no se suman.

## 3. Validación contra el informe oficial

El ETL se cruzó contra las tablas del informe estadístico de jun-2026:

| Control | Row-level | Informe | Resultado |
|---|---|---|---|
| Matriculación 2026 total | 28.722 | 28.722 (Cuadro 1) | exacto |
| Matriculación 2026 mes a mes | ene 3.214 … jun 3.812 | idem | exacto en los 6 meses |
| Importación 2026 total | 24.047 | 24.047 (Cuadro 3) | exacto |
| Matriculación livianos por marca | 27.213 | 27.213 (Cuadro 2) | 73 de 75 marcas idénticas |

Las 2 marcas restantes son la misma (`LYNK&CO` / `LYNK & CO`), unificada a
propósito por el mapa de alias.

**Conclusión:** el row-level reproduce el informe oficial y además trae
segmento, tecnología, importador e histórico. Es la fuente primaria.

## 4. Decisiones tomadas

### 4.1 Modelo de snapshot (evita duplicados sin perder histórico)
Los archivos son **acumulativos**: el de julio ya contiene 2019–2026 completo.
Acumular filas mes a mes duplicaría todo el histórico.

Cada carpeta se guarda como un `snapshot` completo etiquetado con su período.
La app lee siempre el más reciente (vistas `v_*`). Los snapshots anteriores
**no se borran**: quedan para auditar qué cambió entre publicaciones.

### 4.2 Tecnología: se respeta el detalle, nunca se agrupa por defecto
`matriculaciones.xlsx` ya trae la granularidad completa en la columna `TIPO`:
**ICE, MHEV, HEV, PHEV, REEV, EV**. Se guarda tal cual.

MHEV no se agrupa con HEV, PHEV no es HEV, REEV no es EV. La agrupación a
Combustión / Híbridos / Eléctricos existe (`TECNOLOGIA_GRUPO`) pero es
**opcional y solo para mostrar** — el detalle original nunca se pierde.

Serie real (matriculaciones, unidades):

| Año | ICE | MHEV | HEV | PHEV | REEV | EV |
|---|---|---|---|---|---|---|
| 2022 | 29.424 | 0 | 511 | 0 | 0 | 53 |
| 2023 | 31.832 | 6 | 667 | 0 | 0 | 28 |
| 2024 | 31.420 | 126 | 887 | 53 | 0 | 71 |
| 2025 | 36.483 | 1.012 | 1.026 | 545 | 81 | 273 |
| 2026 (ene-jun) | 25.735 | 872 | 947 | 685 | 129 | 354 |

> Nota: `TIPO` **no** separa nafta de diésel (todo va como ICE). Ese corte solo
> está en el Cuadro 19 del informe estadístico, y solo para el año en curso.

### 4.3 Segmento: canónico y comparable entre fuentes
Las dos fuentes usan taxonomías distintas. Se mapean a un conjunto común:

| Canónico | matriculaciones (`Grupo`) | base importacion (`TIPO GRAL`) |
|---|---|---|
| SUV | `SUV/St. Wagon` | `SUV` |
| Pick Up | `Camioneta` | `PICK UP` |
| Automovil | `Automóvil` | `AUTO` |
| City car | `MINI` | `CITY` |
| Furgon | `Furgón` | `FURGON` / `FURGÓN` |
| Minibus | `Minibus` | `MINIBUS` |
| Camion | `Camión` | `CAMION` |
| Omnibus | `Omnibus` | — |
| Sin clasificar | `NDA` | `NO` |

### 4.4 Problemas de calidad conocidos

- **Segmento ausente en 2022–2023**: `Grupo='NDA'` en el 100% de esos dos años
  (62.521 unidades). Se marca como *Sin clasificar*, **no** como un segmento
  más. → El análisis por segmento arranca en 2024; marca, modelo, tecnología
  e importador cubren desde 2022.
- **Variantes de escritura**: `Tipo cadam` tenía 69 valores crudos que
  normalizados (mayúsculas + acentos) son 30. `TIPO GRAL` 10 → 9
  (`FURGON`/`FURGÓN`). Se normaliza en `cadam/normalize.py`.
- **`Valor` vacío**: 6.036 filas en 2024 y 325 en 2026. Son filas de modelo
  listadas sin unidades ese mes; se computan como 0, no se descartan.
- **Clasificación ambigua**: 1 modelo con más de un `Tipo cadam` en el mismo
  mes; se toma el más frecuente y queda registrado en `carga_log`.
- **Falta febrero 2022** en `matriculaciones.xlsx`. Verificado contra el
  archivo original: los otros 11 meses de 2022 tienen ~400 filas cada uno y
  febrero no aparece. No es un error de parseo. Se muestra como *sin dato*,
  nunca como cero.

## 4.6 Controles automáticos en cada carga

`cadam/validar.py` corre después de escribir y deja todo en `carga_log`
(pantalla *Calidad de datos*):

| Control | Qué vigila |
|---|---|
| `totales_vs_informe_estadistico` | Que el row-level reproduzca el informe oficial de CADAM, comparando **solo los meses presentes en ambas** fuentes |
| `nev_contenido_en_importacion` | Que el NEV no se escape de la base (doble conteo) |
| `meses_faltantes` | Huecos en el medio de la serie |
| `segmento_sin_clasificar` | Unidades sin segmento en el origen |

Resultado actual (snapshot 2026-07):

```
ok  Matriculacion 2025 (6 meses comparables): 18.651 = informe oficial
ok  Matriculacion 2026 (6 meses comparables): 28.722 = informe oficial
ok  Importacion   2026 (6 meses comparables): 24.047 = informe oficial
```

### 4.5 Lo que CADAM NO tiene
No inventar estos campos ni prometer pantallas que los usen:

- **Versión, motor, transmisión, tracción**: no existen en ninguna fuente. Lo
  más cercano es el nombre de modelo de la DNRA, que a veces incluye la
  cilindrada en el texto (`Q3 1.4 TFSI SPORTBACK`).
- **País de origen**: `ORIGEN` en base importacion es solo un flag
  `CHINA`/`OTROS`, no el país. El país real está en el Cuadro 12 del informe
  de matriculación y el Cuadro 6 del de importación, y solo agregado por año.
- **Valor CIF**: no está en el row-level; sí en el Cuadro 8 del informe.

### 4.7 Unificación de grafías de modelo

La DNRA carga el nombre del modelo a mano y CADAM lo publica sin corregir, así
que **el mismo modelo aparece escrito de varias formas**. No era marginal:

| Marca | Variante A | Variante B |
|---|---|---|
| TOYOTA | `HILUX D/C 4X4 SRV AUT` 2.740 u | `HILUX DC 4X4 SRV AUT.` 243 u |
| MAZDA | `CX5` 682 u | `CX-5` 290 u |
| BYD | `SONG PLUS DMI` 131 u | `SONG PLUS DM I` 83 u |

**121 grupos** en matriculación y **6** en importación. Partido así, un modelo
puede quedar fuera del Top 10 por estar contado en dos filas.

**Regla automática** (`normalize.clave_modelo`): dos modelos de la misma marca
son el mismo si coinciden ignorando espacios, guiones, barras, comas y puntos.
Se adopta la grafía con más unidades; ante empate, la alfabéticamente menor,
para que el resultado sea estable entre cargas.

**El `+` NO se ignora**, porque en este dominio distingue modelos reales:

- `LEXUS RX450H+` es la versión PHEV, **no** es el `RX450H`
- `MERCEDES BENZ AMG GLE 53 4MATIC+` es otra tracción

El costo es que quedan sin unir los casos donde el `+` era ruido
(`SUNRAY 16+1` vs `SUNRAY 161`, `SPRINTER 514 CDI 19+1` vs `19 1`); esos se
resuelven a mano en `correcciones.sql`. **Preferimos no unir dos modelos
distintos antes que unir todo lo que se parece.**

Resultado (jul-2026): 2.821 → 2.709 modelos en matriculación, 0 grupos
duplicados restantes, y las **unidades totales sin cambio** (163.220) — se
consolidó, no se perdió nada. Los tres controles contra el informe oficial
siguen dando exacto.

### 4.8 Tecnología mal clasificada en el origen

La fuente marca como **ICE** muchos modelos cuyo nombre dice explícitamente la
tecnología. Detectado a partir de `BYD SONG PRO DMI`, que venía como ICE en 26
unidades y como PHEV en otras 76 — siendo el mismo auto (*DM-i* es la
denominación PHEV de BYD). Confirmado por el usuario.

Las correcciones se derivan del nombre del modelo con tokens inequívocos, en
este orden de prioridad:

| Token en el nombre | Tecnología |
|---|---|
| `PHEV`, `DM-I` (BYD), `PLUG-IN` | PHEV |
| `MHEV`, `MILD` | MHEV |
| `E-POWER` (Nissan) | REEV — híbrido serie, no paralelo |
| `HEV`, `HIBRIDO`, `HYBRID` | HEV |
| `EV`, `BEV` | EV |

**Trampas evitadas a propósito**: `EVOQUE`, `EVOLUTION` y `EVO` **no** son `EV`.
Los Range Rover Evoque que sí se corrigieron entraron por su token `PHEV`/`MHEV`.

Impacto en 2026 (ene–jun): **589 unidades salen de ICE**.

| | Fuente cruda | Corregido | |
|---|---|---|---|
| ICE | 25.735 | 25.146 | −589 |
| MHEV | 872 | 1.054 | +182 |
| HEV | 947 | 1.065 | +118 |
| PHEV | 685 | 945 | +260 |
| REEV | 129 | 130 | +1 |
| EV | 354 | 382 | +28 |

El total no cambia (28.722) y los tres controles contra el informe oficial
siguen exactos. Después de aplicarlas, **ningún modelo queda con más de una
tecnología**.

> Orden importante: la corrección de tecnología se aplica **después** de
> unificar las grafías de modelo. Al revés, las filas que todavía venían con la
> grafía original (`SONG PRO DM-I`) quedaban sin corregir.

## 5. Correcciones manuales

Las tablas `correccion_marca`, `correccion_segmento`,
`correccion_modelo_tecnologia` guardan las reclasificaciones del usuario.
Se aplican **después** de los mapas de `normalize.py`, tienen prioridad sobre
ellos y **nunca se borran al reingestar**.

## 6. Cómo cargar un mes nuevo

```bash
cd "SANTA ROSA COMERCIAL ADVISOR/CADAM/scripts"
python ingest.py --dry-run    # ver qué haría, sin escribir
python ingest.py              # cargar
```

Reingestar un período lo reemplaza (no duplica). Todo aviso o error queda en
la tabla `carga_log`, que alimenta la pantalla *Calidad de datos*.
