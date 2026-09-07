# Presupuesto 2026 por marca en el Advisor — diseño

Fecha: 2026-09-07 · Estado: aprobado en conversación, pendiente de revisión del spec escrito.

## 1. Qué se resuelve

El Advisor ya sabe comparar lo facturado (Cars) contra una meta por marca y
mes: `metas_mensuales` en `parametros.json`, la grilla de Configuración y
las columnas Meta / Cumplimiento / Proyección de `/operacion`. Nunca se
cargó nada, así que `/operacion` dice «Sin metas cargadas» desde que
existe.

Finanzas mantiene el presupuesto en un Excel: `Budget Importadora-Retail
FY 2026 - SRA PY EJERCICIO VF 8.3.xlsx`, hoy en
`~/Escritorio/DASHBOARD FERNANDO/`. Cambia de versión cada tanto (8.3 hoy).
Esta entrega lleva ese archivo al dashboard, solo, cada vez que cambie, y
muestra el objetivo de cada marca donde el gerente mira la operación.

## 2. Decisiones tomadas (con Croman, 07/09/2026)

| Pregunta | Decisión |
|---|---|
| Qué número es «el objetivo» | **Los dos, separados.** El presupuesto original del año (columna P de cada hoja, 2.450 u.) como vara del año, y el ejercicio vigente (v8.3, 3.873 u.) como plan mes a mes de lo que falta |
| Cómo entra y se mantiene | **Automático desde el Excel.** Script de Hermes en la notebook, cron cada hora, empuja solo si el archivo cambió. Configuración muestra qué versión está cargada |
| Alcance | **Marcas ahora, canales después.** Las hojas `Venta Unidades CDE` y `WHOLESALE` quedan para una segunda entrega |
| Plata | **Solo unidades.** Ventas USD, costo y margen del Excel no se cargan ni se muestran |

## 3. El archivo

38 hojas. Las que se leen:

- `Venta(s) Unidades <marca>` (10 hojas; 9 se cargan, Renew solo se lee
  para el control). Fila cuyo `A` es
  `Volumen`: `C..N` = enero a diciembre 2026, `O` = total, `P` = presupuesto
  anual original (vacía en Renault y Xpeng). Enero a mayo son **reales** (la
  suma de mayo de las hojas cierra exacto con el REAL de `Hoja1`:
  US$ 8.327.270); de junio en adelante es plan.
- `Hoja1`: celda `A3` = fecha del último mes cerrado (`2026-05-01`).
- `Compilado`: fila `Total Unidades`, columna `P` = 3.873. Es la suma de las
  diez hojas de marca; sirve de control.

Verificado contra CADAM (snapshot 2026-08): Jetour facturó 571 en ene–jun
según el Excel y matriculó 593; GWM 417 vs 434. Las hojas de marca son el
volumen entero de la casa por marca, no un canal. Renault (103 vs 165) y
Mitsubishi (112 vs 215) tienen una brecha que vive en las hojas de canal;
queda para la segunda entrega y se anota en Cargas.

Columna P no es el real 2025 (CADAM 2025: Jetour 566, Mitsubishi 349) sino
el presupuesto original; y la suma de las P (2.450) es la que `Compilado
(2)` usa como base del +58 %.

### Mapeo de hojas a marcas del Advisor

| Hoja | Marcas (nombre CADAM, como en `marcas_propias`) | Nota |
|---|---|---|
| Venta Unidades Jetour | JETOUR | |
| Ventas Unidades GWM | GREAT WALL, HAVAL | grupo: CADAM separa Haval; Cars manda todo como GREAT WALL |
| Ventas Unidades Mistubishi | MITSUBISHI | typo del archivo; se mapea igual |
| Ventas Unidades Leap Y JMEV | LEAPMOTOR, JMEV | grupo: una meta para las dos |
| Ventas Unidades JAC | JAC | |
| Ventas Unidades SOUEAST | SOUEAST | |
| Ventas Unidades ZEEKR | ZEEKR | |
| Venta Unidades Renault PY | RENAULT | sin presupuesto anual (P vacía) |
| Ventas Unidades XPENG | XPENG | 4 u. en el año, sin presupuesto. Se agrega XPENG a `marcas_propias` (grupo Xpeng) |
| Ventas Unidades Renew | — | usados. Cars no los manda por marca y mes (`LOCAL USADOS` se excluye en el pusher). Fuera de esta entrega |

El mapeo vive en el script, en un diccionario `HOJAS` con el nombre exacto de
la hoja, las marcas y nada más. Renew está en el diccionario con `marcas: []`:
se lee para el control contra `Compilado` y no se empuja. Una hoja que no
está en el diccionario se ignora; una del diccionario que no está en el
archivo es error.

## 4. Pipeline

### 4.1 Script `~/.hermes/scripts/advisor-presupuesto.py`

Python 3, `openpyxl`, sin agente. Convenciones de `advisor-precios-competencia.py`:
`HERMES_INGEST_SECRET` de `~/.hermes/.env`, endpoint fijo
`https://advisor.santarosa.lat/api/presupuesto`, `User-Agent`
`hermes-advisor/1.0` (Cloudflare devuelve 403 «error code: 1010» con el de
`urllib`).

1. Busca `Budget*.xlsx` en `~/Escritorio/DASHBOARD FERNANDO/`, ignora los
   `~$Budget*` (archivo abierto en Excel), toma el de `mtime` más nuevo. Sin
   archivo: imprime «sin archivo» y sale 0.
2. Estado en `~/.hermes/state/advisor-presupuesto.json`: `{ archivo, mtime,
   sha256, empujado_en, version }`. Si `mtime` y `sha256` coinciden con el
   estado, sale 0 sin tocar la red. `--force` saltea esta comparación.
3. Abre con `data_only=True`. Por cada hoja del diccionario: localiza la fila
   con `A == "Volumen"` (busca en las primeras 40 filas; no un número fijo),
   lee `C..N` como 12 enteros ≥ 0 (vacío = 0), `P` como entero ≥ 0 o `null`.
4. `real_hasta_mes` = mes de `Hoja1!A3` si es fecha; si no, `null`.
5. `version` = lo que sigue a `EJERCICIO ` en el nombre del archivo, sin la
   extensión (`VF 8.3`); si no matchea, el nombre del archivo entero.
6. `total_compilado` = `Compilado`, fila con `A == "Total Unidades"`, columna
   `P`. Control: la suma de los 12 meses de todas las hojas de marca del
   diccionario **más Renew** (que se lee solo para este control) tiene que
   ser igual a `total_compilado`. Si no, no empuja, imprime la diferencia y
   sale 1.
7. `--dry-run`: imprime la tabla marca × 12 meses, presupuesto anual, control
   y versión, y sale sin empujar ni guardar estado.
8. `POST https://advisor.santarosa.lat/api/presupuesto`, `Authorization: Bearer …`, JSON:

```json
{
  "anio": 2026,
  "version": "VF 8.3",
  "archivo": "Budget Importadora-Retail FY 2026 - SRA PY EJERCICIO VF 8.3.xlsx",
  "modificado": "2026-09-07T11:35:00-03:00",
  "real_hasta_mes": 5,
  "total_compilado": 3873,
  "grupos": [
    { "marcas": ["JETOUR"], "hoja": "Venta Unidades Jetour",
      "plan": [79, 78, 70, 135, 113, 96, 92, 109, 113, 106, 108, 106],
      "presupuesto_anual": 750 },
    { "marcas": ["GREAT WALL", "HAVAL"], "hoja": "Ventas Unidades GWM",
      "plan": [64, 45, 74, 84, 74, 76, 95, 96, 94, 102, 106, 90],
      "presupuesto_anual": 650 },
    { "marcas": ["RENAULT"], "hoja": "Venta Unidades Renault PY",
      "plan": [17, 10, 14, 24, 11, 27, 30, 30, 32, 35, 37, 33],
      "presupuesto_anual": null }
  ]
}
```

9. Con 200: guarda el estado e imprime una línea por marca. Con otro código:
   imprime el cuerpo de la respuesta y sale 1; el estado no se toca, así la
   próxima corrida reintenta sola.

`advisor-presupuesto.sh` envuelve el script como los otros (`set -euo
pipefail`, log a `~/.hermes/logs/`). Job en `~/.hermes/cron/jobs.json`:
`Advisor · Presupuesto (Excel Finanzas)`, `script: advisor-presupuesto.sh`,
`no_agent: true`, `0 * * * *`. Se activa recién después de la verificación
en producción (sección 7).

### 4.2 Ruta `src/app/api/presupuesto/route.ts`

- `POST`, `runtime nodejs`, `force-dynamic`. Cerrojo igual que
  `/api/precios-competencia`: `Authorization === Bearer HERMES_INGEST_SECRET`,
  si no 401.
- Se agrega `/api/presupuesto` a la lista **exacta** de `proxy.ts`; sin eso
  el proxy responde 401 «Sesión requerida» antes de llegar a la ruta.
- Validación, todo o nada (400 con el motivo y el índice):
  `anio` entero 2020–2100; `version` y `archivo` texto ≤ 200; `modificado`
  fecha ISO; `real_hasta_mes` entero 1–12 o `null`; `total_compilado` entero
  ≥ 0; `grupos` array de 1–20; cada grupo: `marcas` 1–4 nombres presentes en
  `marcas_propias` (si falta una, 400 nombrándola), `plan` exactamente 12
  enteros 0–100.000, `presupuesto_anual` entero 0–100.000 o `null`. Una
  marca no puede aparecer en dos grupos.
- Escritura con `guardarParametros`, que se amplía para aceptar
  `presupuesto`:
  - `metas_mensuales[anio][marcas[0]] = plan`; las otras marcas del grupo
    quedan con `[null × 12]`. Así `/operacion` y la grilla funcionan sin
    cambios, y una meta nunca se cuenta dos veces.
  - `presupuesto = { anio, version, archivo, modificado, cargado_en,
    real_hasta_mes, total_compilado, grupos: [{ marcas, hoja, plan,
    presupuesto_anual }] }`. Reemplaza el bloque anterior entero.
- Respuesta 200: `{ ok: true, anio, version, grupos: n, plan_total,
  presupuesto_total }`.
- Regla de conflicto: el Excel manda. Lo editado a mano en la grilla se pisa
  en la próxima carga. No hay merge.

### 4.3 Tipos en `src/lib/cadam/config.ts`

```ts
export interface GrupoPresupuesto {
  marcas: string[];           // nombres CADAM; la primera lleva la fila en metas_mensuales
  hoja: string;
  plan: number[];             // 12 enteros
  presupuesto_anual: number | null;
}
export interface Presupuesto {
  anio: number;
  version: string;
  archivo: string;
  modificado: string;         // ISO
  cargado_en: string;         // ISO
  real_hasta_mes: number | null;
  total_compilado: number;
  grupos: GrupoPresupuesto[];
}
// en Parametros:
presupuesto?: Presupuesto;
```

`getPresupuesto(anio): Presupuesto | null` devuelve el bloque solo si
`presupuesto.anio === anio`; otro año se trata como ausente.
`guardarParametros` acepta `presupuesto` además de los campos actuales.

## 5. Lógica: `src/lib/informes/presupuesto.ts`

Funciones puras, sin acceso a datos, verificables con `node` suelto:

- `planPeriodo(grupo, mesDesde, mesHasta, realHastaMes)` →
  `{ plan: number, abiertos: number, cerrados: number }`: suma del plan de
  los meses del filtro; `abiertos` = meses del filtro con
  `mes > realHastaMes`. Con `realHastaMes` null todos cuentan como abiertos.
- `cumplimiento(facturado, plan, abiertos)` → `number | null`: `facturado /
  plan` solo si `abiertos > 0` y `plan > 0`; si no, null («cerrado»).
- `porcentajeHecho(facturadoYtd, presupuestoAnual)` → `number | null`.
- `ritmoNecesario(grupo, facturadoYtd, ultimoMesCerrado)` → unidades por mes
  que hacen falta para llegar al plan anual con los meses que quedan (`(plan
  total − facturado YTD) / (12 − ultimoMesCerrado)`); null si no quedan meses.
- `atrasados(grupos, facturadoPorMarca, ritmoPorMarca, ultimoMesCerrado)` →
  lista `{ marcas, ritmo, necesario, faltaPorMes }` de los grupos cuyo ritmo
  de los últimos tres meses cerrados (el mismo `ritmo` que ya calcula
  `/operacion`) es menor que `ritmoNecesario`. Ordenada por `faltaPorMes`
  descendente.

El «último mes cerrado» que usan estas funciones es el de Cars (el que
`/operacion` ya calcula para la proyección), no `real_hasta_mes` del Excel:
el Excel dice hasta dónde el plan es real; Cars dice hasta dónde hay
facturas. Pueden diferir por un mes y las dos cosas se muestran.

## 6. Qué ve el gerente

### 6.1 `/operacion`

**Tarjeta «Presupuesto 2026»** (reemplaza «Meta del período»). Valor:
`porcentajeHecho` con numerador y denominador sobre el mismo conjunto: el
facturado YTD de los grupos que tienen presupuesto anual, dividido la suma de
esos presupuestos. Renault y Xpeng no entran en ninguno de los dos. Pie:
«plan vigente VF 8.3: 3.873 · facturado a mayo: N». Tooltip explica los dos
números. Sin bloque `presupuesto` del año filtrado: «Sin metas cargadas», con
el mismo texto de hoy.

**Tabla «Marca por marca».** Una fila por grupo presupuestado: `GREAT WALL +
HAVAL` y `LEAPMOTOR + JMEV` suman facturado, matriculado, stock y reservadas
de sus marcas, con la nota «meta conjunta: así la presupuesta Finanzas». Las
marcas sin grupo, una fila cada una como hoy. Marcas con ventas o stock que no
están en ningún grupo (canje, usados) siguen como hoy, sin columnas de meta.

| Columna | Contenido |
|---|---|
| Plan (período) | `planPeriodo().plan`; si `abiertos === 0`, el texto «cerrado» |
| Cumplimiento | `cumplimiento()`; rojo < 85 %, verde ≥ 100 %; «—» si null |
| Presupuesto anual | `presupuesto_anual` o «—» |
| % hecho | `porcentajeHecho(facturado YTD, presupuesto_anual)` |
| Proyección / plan año | la proyección que ya existe, contra la suma de los 12 meses del plan |

La nota de la tabla dice de dónde sale cada cosa: plan del Excel de Finanzas
(versión y fecha), facturado de Cars, y que en los meses cerrados el plan es
el real y por eso no hay cumplimiento mensual ahí.

**Gráfico «Plan vs. facturado, mes a mes»** debajo de la tabla. Barras por
mes: plan (gris neutro) y facturado (color de marca). Meses `≤
real_hasta_mes` con fondo tenue y rótulo «cerrado». Línea punteada horizontal
en `presupuesto_anual / 12` con la leyenda «presupuesto anual ÷ 12, solo
referencia: Finanzas no presupuestó por mes». Con el filtro de marca de la
página muestra ese grupo; sin filtro, la suma de todos los grupos (la línea
usa la suma de los presupuestos anuales). Tooltip por mes con los dos
valores y la diferencia. Sin presupuesto cargado, el gráfico no se muestra.

### 6.2 Inicio, «Acciones de la semana»

Tarjeta «Atrasados contra el plan»: número grande = cantidad de grupos
atrasados; cuerpo = hasta tres grupos con «falta N por mes»; vacía: «Todas al
ritmo del plan». Enlace a `/operacion#marcas`. Sin presupuesto cargado, la
tarjeta dice «Sin presupuesto cargado» y enlaza a Cargas. Calculada con
`atrasados()` en `resumenPresupuesto(f)` en `tablero.ts`, junto a los otros
`resumen*`.

### 6.3 Configuración

Sobre la grilla de metas, un aviso: «Cargado desde *{archivo}* (archivo del
{modificado}, cargado el {cargado_en}, versión {version}). Lo que edites acá
lo pisa la próxima carga del Excel.» Columna de solo lectura «Presupuesto
anual» a la derecha de diciembre, con el valor del grupo en la fila de su
primera marca. Sin bloque: la grilla como hoy, sin aviso.

### 6.4 Cargas

Fila «Presupuesto 2026 (Excel de Finanzas)»: versión, fecha del archivo,
fecha de carga, último mes cerrado, total del plan y del presupuesto. Nota
fija: «Renew (usados) y los canales CDE y Wholesale no entran todavía».
Sin bloque: «Nunca cargado» y el nombre del script que lo carga.

### 6.5 Copiloto y Centro de Inteligencia

- `leer_operacion_propia` con `que = "ventas"` agrega por grupo: plan del
  período, cumplimiento, presupuesto anual, % hecho, y una línea de cierre con
  los atrasados. Todo calculado; el modelo cita, no cruza.
- `copiloto-contexto.ts`: «presupuesto», «objetivo», «meta», «plan»,
  «cumplimiento» → `que = "ventas"`.
- Pregunta sugerida nueva en `/copiloto`: «¿Qué marcas van atrasadas contra
  el presupuesto 2026?».
- `inteligencia-propia.ts`: ítem «Presupuesto 2026» con % hecho total, plan
  vigente y los atrasados con su falta por mes. Sin presupuesto, el ítem no
  aparece.

## 7. Errores

| Situación | Comportamiento |
|---|---|
| No hay `Budget*.xlsx` | Sale 0 con «sin archivo». Ignora `~$Budget*` |
| Falta una hoja del diccionario o su fila `Volumen` | No empuja. Sale 1 nombrando la hoja |
| Suma de hojas ≠ `Compilado` | No empuja. Sale 1 con la diferencia |
| `Hoja1!A3` no es fecha | Empuja con `real_hasta_mes: null`; la app trata todos los meses como abiertos y Cargas lo dice |
| 401 / 400 / 500 del Advisor | Sale 1 con el cuerpo. Estado sin tocar; la próxima corrida reintenta |
| Marca desconocida en `marcas_propias` | 400 nombrándola; nada se escribe |
| `parametros.json` no escribible | 500 con el motivo en el log; el archivo anterior queda intacto (escritura tmp + rename que ya existe) |
| Bloque de otro año que el filtrado | Como sin presupuesto: tarjeta «Sin metas cargadas», columnas y gráfico ocultos |
| Cars caído o sin facturas | Como hoy: «Sin datos de Cars», sin cumplimiento; plan y presupuesto se muestran igual |

## 8. Verificación

El repo no tiene suite de tests; se verifica contra datos reales y en el
navegador, como el resto del Advisor.

1. `advisor-presupuesto.py --dry-run` contra el archivo real: 9 marcas × 12
   meses, presupuestos anuales (750, 650, 250, 200, 200, 120, 30, null,
   null), control 3.873, versión `VF 8.3`, `real_hasta_mes` 5.
2. `presupuesto.ts` con `node` suelto sobre casos fijos: período todo
   cerrado (cumplimiento null), período mixto, `real_hasta_mes` null, grupo
   sin presupuesto anual, `ritmoNecesario` con cero meses restantes.
3. `npx tsc --noEmit` y `npx next build` limpios.
4. Preview local con un bloque `presupuesto` de prueba en
   `data/parametros.json`: `/operacion` (tarjeta, filas de grupo, columnas,
   gráfico con filtro de marca y sin filtro), `/configuracion` (aviso,
   columna), `/cargas` (fila), inicio (tarjeta), `/copiloto` (pregunta
   sugerida).
5. Producción: correr el script a mano una vez, esperar el deploy, capturas
   con Playwright de `/operacion`, `/configuracion`, `/cargas` e inicio, y
   una consulta al Copiloto con la pregunta sugerida. Recién con eso, activar
   el cron.

## 9. Fuera de alcance

Ventas USD, costo y margen; Renew (usados); historia de versiones del plan
(si se pide, se migra el bloque a una tabla Postgres versionada).

## 9b. Segunda entrega: canales CDE y Wholesale (07/09/2026, misma tarde)

Entró con otra regla que la prevista. Se iba a calcular el real por canal
desde Cars (sucursal para CDE, asesores mayoristas para Wholesale), pero
las definiciones no coinciden: la sucursal de Cars da 79 unidades de CDE en
2026 y Finanzas cuenta 310 hasta agosto; los mayoristas de Cars suman 446 a
julio y Finanzas 293. Comparar el objetivo de Finanzas contra otra
definición diría cualquier cosa. Se toma el REAL DE FINANZAS del bloque
derecho de las mismas hojas (hasta el mes del título «ENE AGO»), viaja en
`presupuesto.canales[].real`, y la pantalla dice de dónde sale. Cars no
entra en los canales.

## 10. Archivos que se tocan

- Nuevo: `~/.hermes/scripts/advisor-presupuesto.py`, `advisor-presupuesto.sh`;
  job en `~/.hermes/cron/jobs.json`.
- Nuevo: `src/app/api/presupuesto/route.ts`, `src/lib/informes/presupuesto.ts`,
  `src/components/charts/plan-vs-facturado-chart.tsx`.
- Cambian: `src/proxy.ts` (lista de ingesta), `src/lib/cadam/config.ts`
  (tipos, `getPresupuesto`, `guardarParametros`), `data/parametros.json` y
  `CADAM/parametros.json` (XPENG en `marcas_propias`),
  `src/app/operacion/page.tsx`, `src/app/configuracion/page.tsx` y
  `metas.tsx`, `src/app/cargas/page.tsx`, `src/lib/informes/tablero.ts`,
  `src/lib/informes/inteligencia-propia.ts`, `src/app/api/copiloto/route.ts`,
  `src/lib/cadam/copiloto-contexto.ts`, `src/app/copiloto/page.tsx`, y el
  componente de «Acciones de la semana» del inicio.
