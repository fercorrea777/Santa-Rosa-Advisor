# Mercado Automotor PY

Dashboard interactivo del mercado automotor paraguayo, construido sobre los
datos públicos de **CADAM** (Cámara de Distribuidores de Automotores y
Maquinarias) / DNRA: importaciones y matriculaciones, por marca, modelo,
segmento, tecnología de propulsión e importador.

## Qué incluye

| Carpeta | Qué es |
|---|---|
| `mercado-automotor-app/` | La aplicación web (Next.js 16 + TypeScript + Tailwind v4 + ECharts + SQLite) |
| `CADAM/` | Pipeline de ingesta en Python (pandas) + diccionario de datos (`DATOS.md`) + correcciones versionadas |
| `CADAM-DATA/` | Archivos fuente de CADAM, una subcarpeta por mes |

## Pantallas

Inicio con KPIs y filtros clicables · Resumen del mercado · Evolución mensual
multi-año · Rankings exportables · Segmentos con drill-down · Combustibles y
tecnologías (ICE/MHEV/HEV/PHEV/REEV/EV, sin agrupar categorías incompatibles) ·
Market Share (con Δ de participación en puntos porcentuales) · Importaciones
vs. matriculaciones · Centro de Inteligencia Comercial (motor de reglas con
evidencia) · Copiloto (preguntas en lenguaje natural vía Claude API) · Calidad
de datos.

## Correr localmente

```bash
cd mercado-automotor-app
npm install
npm run dev
# → http://localhost:3000
```

La app lee la base SQLite incluida en `mercado-automotor-app/data/cadam.db`.

Para el Copiloto hace falta una clave de Anthropic en
`mercado-automotor-app/.env.local`:

```
ANTHROPIC_API_KEY=sk-ant-...
```

## Cargar un mes nuevo

1. Crear `CADAM-DATA/<MES AÑO>/` (ej. `AGOSTO 2026`) y poner ahí los archivos
   de CADAM — el nombre de los archivos no importa: el tipo se detecta por las
   columnas reales.
2. ```bash
   cd CADAM/scripts
   python ingest.py --dry-run        # ver qué haría
   python ingest.py --correcciones   # cargar
   ```
3. ```bash
   cd ../../mercado-automotor-app
   npm run sync-datos                # actualiza data/cadam.db
   ```

Cada carga se valida automáticamente contra los totales del informe oficial de
CADAM; los hallazgos quedan en la pantalla *Calidad de datos*.

## Publicar (Vercel)

El proyecto está preparado para desplegarse en Vercel apuntando el proyecto a
la carpeta `mercado-automotor-app/` (Root Directory). La base viaja empaquetada
(`data/`), es de solo lectura en runtime, y se actualiza con
`npm run sync-datos` + push.

## Principios

- **Nunca inventar datos**: lo que falta se muestra como "sin datos", no como
  cero; las variaciones sin base comparativa dicen "sin base", no +100%.
- **Trazabilidad**: cada carga registra archivo, fecha y validaciones.
- **Honestidad estadística**: bases menores a 30 unidades no generan
  porcentajes; los meses sin dato quedan como hueco en las series.
