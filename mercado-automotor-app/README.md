# Mercado Automotor PY — Santa Rosa Comercial Advisor

Plataforma de inteligencia comercial automotriz (Módulo 01: Mercado Automotor
Paraguayo). Spec completa en [`../CLAUDE.md`](../CLAUDE.md). Estado y roadmap
del proyecto en [`../SANTA_ROSA_COMERCIAL_ADVISOR.md`](../SANTA_ROSA_COMERCIAL_ADVISOR.md).

**Fase actual: Fase 1 — base funcional.** Corre 100% local, sin login ni
Supabase todavía (ver decisión en la sección "Alcance de esta fase" abajo).
Los datos de "Inicio" son reales (matriculación **e importación** CADAM,
informe jun-2026) — no hay datos inventados en ningún lado; lo que falta
cargar se muestra como "Sin datos cargados", nunca como cero ni como número
simulado.

## Cómo abrirlo desde VS Code

1. Abrí la carpeta `PROYECTO CLAUDE` completa en VS Code (no solo esta subcarpeta), para tener también los datos de CADAM a la vista.
2. Abrí una terminal integrada (`` Ctrl+` ``) y pará dentro de esta carpeta:
   ```bash
   cd "mercado-automotor-app"
   ```
3. Instalá las dependencias (solo la primera vez, o cuando se agregue algo nuevo a `package.json`):
   ```bash
   npm install
   ```
4. Levantá el servidor de desarrollo:
   ```bash
   npm run dev
   ```
5. Abrí [http://localhost:3000](http://localhost:3000) en el navegador.

Requisitos: Node.js 20.9+ (probado con Node 22) y Python 3 (para el pipeline de ingesta de CADAM, no para la app en sí).

## De dónde vienen los datos

La app **no tiene base de datos propia**: lee directamente la misma base
SQLite que arma el pipeline de CADAM en
`../SANTA ROSA COMERCIAL ADVISOR/CADAM/data/cadam.db`, y la misma
configuración en `../SANTA ROSA COMERCIAL ADVISOR/CADAM/parametros.json`
(marcas propias, competidores clave, metas). Un solo lugar de verdad para
ambos.

**Carpeta de origen de los Excel: `../../CADAM-DATA/`** (en la raíz de
`PROYECTO CLAUDE`, al lado de esta app). Ahí se sueltan, mes a mes, los dos
archivos que publica CADAM — **sin organizarlos en subcarpetas**, la carpeta
queda plana:

- `Informe de matriculación de automotores <mes>_<año>.xls` → matriculaciones
- `Cadam - Estadisticas totales <mes>_<año> autos_camiones.xlsx` → importaciones

Para cargar lo que haya en esa carpeta (detecta tipo y período automáticamente
por el nombre del archivo, no hace falta indicarlos a mano):

```bash
cd "../SANTA ROSA COMERCIAL ADVISOR/CADAM"
python scripts/ingest_cadam.py
```

Reingestar el mismo mes pisa los datos previos de ese mes (no duplica), así que
correrlo de nuevo después de agregar un archivo nuevo es siempre seguro. Después,
refrescar la app (no hace falta reiniciar el servidor).

> Modo manual (un archivo puntual, con período forzado):
> `python scripts/ingest_cadam.py "<ruta al archivo>" <AAAA-MM>`

## Qué hay armado en esta fase

- **Inicio**: KPIs (matriculaciones e **importaciones** acumuladas, variación
  interanual, marca y segmento líder, participación de marcas propias,
  diferencia importación vs. matriculación), evolución mensual 2025 vs. 2026,
  distribución por tipo/segmento, evolución e importaciones por tipo, y
  ranking de marcas de livianos (74 marcas, con
  Jetour/GWM/JAC/Dongfeng/Soueast/Renault/Mitsubishi destacados como "propia").
- **Filtro de rango de fechas** (selector Desde/Hasta en la parte superior):
  recorta KPIs, gráfico de evolución, distribución por segmento y ranking de
  marcas al rango elegido dentro de los meses disponibles. Las importaciones
  acumuladas quedan fuera del recorte: CADAM no publica el detalle mensual del
  año anterior en ese cuadro, solo el acumulado ya cerrado — se indica en el
  tooltip para no sugerir una precisión que el dato no tiene.
- **Modo claro/oscuro** (toggle en el header) y **diseño responsive** (sidebar
  colapsa a menú lateral en mobile).
- Las otras 11 secciones del menú (Resumen del mercado, Rankings,
  Segmentos, Combustibles, Market Share, Tendencias, Centro de Inteligencia,
  Carga de archivos, Calidad de datos) están **scaffoldeadas con navegación
  real** pero contenido "próximamente" — cada una dice honestamente qué le
  falta y en qué fase entra, sin datos inventados ni pantallas rotas.
- **Configuración** ya muestra en modo lectura lo que hay hoy en
  `parametros.json` (marcas propias, competidores, metas).

## Alcance de esta fase (decisiones tomadas)

- **Sin autenticación ni Supabase todavía**: la app la corre una sola persona,
  en local. Se agregan juntos en Fase 2, cuando entre la carga de archivos con
  interfaz y haya datos que valga la pena proteger.
- **Sin datos inventados**: donde CADAM todavía no da el detalle (importaciones,
  combustible/tecnología, modelo), la pantalla lo dice explícitamente en vez
  de mostrar un gráfico con números simulados.
- **Stack**: Next.js 16 (App Router, Turbopack) + TypeScript + Tailwind CSS v4
  + shadcn/ui (Base UI) + Apache ECharts + next-themes. `better-sqlite3` para
  leer `cadam.db` directo desde Server Components, sin capa de API intermedia.

## Próximos pasos (ver `SANTA_ROSA_COMERCIAL_ADVISOR.md` y `CLAUDE.md` sec. 40)

- Fase 2: carga de archivos con interfaz + Supabase/Postgres + auth
- Fase 3: dashboards completos (rankings interactivos, segmentos con
  drill-down, market share histórico)
- Fase 4: calidad de datos
- Fase 5: Centro de Inteligencia Comercial
- Fase 6: exportación y optimización
