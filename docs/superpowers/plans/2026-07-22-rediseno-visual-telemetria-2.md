# Rediseño visual "Telemetría 2.0" — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Evolucionar el sistema visual "Telemetría" documentado en `DESIGN.md` — panel con radios suaves + glow en vez de muesca recortada, motion de entrada habilitado, y remoción completa de `lucide-react` en favor de tipografía/glifos de texto — sin tocar la lógica de datos de ninguna pantalla.

**Architecture:** Los cambios de identidad viven casi enteros en `src/app/globals.css` (panel, motion) y en un puñado de componentes compartidos (`KpiCard`, los 4 charts de ECharts) — las 13 pantallas los heredan automáticamente porque todas componen `Card`/`KpiCard`/los charts. El resto del trabajo es remover íconos de 14 archivos puntuales, con reemplazos concretos por archivo (texto, glifos Unicode, o directamente ninguno si eran decorativos).

**Tech Stack:** Next.js 16 (App Router), Tailwind v4, `@base-ui/react`, ECharts 6 + `echarts-for-react`, `class-variance-authority`.

**Nota sobre verificación:** este repo no tiene test runner (no hay Jest/Vitest/Playwright como dependencia). Por diseño (ver spec), no se agrega uno para este trabajo — los pasos de "verificar" en este plan son manuales: `npm run dev` + revisión en navegador (claro/oscuro, `prefers-reduced-motion`) y capturas con Playwright (ya instalado globalmente vía `npx`, no como dependencia del proyecto). Esto reemplaza el "run test / see it fail" del formato estándar de este proceso.

---

### Task 1: Panel HUD — radios suaves + glow (reemplazar la muesca)

**Files:**
- Modify: `src/app/globals.css:216-260`
- Modify: `src/components/ui/card.tsx:14-18` (solo el comentario)

- [ ] **Step 1: Reemplazar el bloque del panel en `globals.css`**

Buscar este bloque completo (líneas 216-260 aprox., dentro de `@layer components`):

```css
  /* ---- Panel HUD ----------------------------------------------------------
     La esquina inferior derecha recortada y el borde luminoso son lo que da
     el carácter de instrumento. Deliberadamente NO se usa una franja de color
     al costado de la tarjeta: es el tic visual más gastado y además compite
     con el contenido.
  ------------------------------------------------------------------------ */
  [data-slot="card"] {
    position: relative;
    border-radius: 0.5rem;
    background-color: color-mix(in oklab, var(--card) 92%, transparent);
    box-shadow:
      inset 0 1px 0 0 color-mix(in oklab, var(--panel-edge) 55%, transparent),
      0 0 0 1px color-mix(in oklab, var(--panel-edge) 60%, transparent),
      0 18px 40px -28px oklch(0 0 0 / 60%);
    /* Muesca en la esquina inferior derecha. */
    clip-path: polygon(
      0 0, 100% 0, 100% calc(100% - 14px),
      calc(100% - 14px) 100%, 0 100%
    );
  }
  .dark [data-slot="card"] {
    background-image: radial-gradient(
      120% 90% at 0% 0%,
      var(--panel-glow) 0%,
      transparent 60%
    );
  }
  /* Diagonal que cierra la muesca, para que el recorte se lea como bisel y no
     como un error de render. */
  [data-slot="card"]::after {
    content: "";
    position: absolute;
    right: -1px;
    bottom: -1px;
    width: 20px;
    height: 20px;
    background: linear-gradient(
      135deg,
      transparent 0 49%,
      color-mix(in oklab, var(--panel-edge) 90%, transparent) 49% 52%,
      transparent 52%
    );
    pointer-events: none;
  }
```

Reemplazar por:

```css
  /* ---- Panel HUD (Telemetría 2.0) ------------------------------------------
     Radios suaves + glow selectivo en vez de la muesca recortada de la v1.
     Cambio de identidad intencional (ver docs/superpowers/specs/2026-07-22-
     rediseno-visual-y-bot-agentico-design.md, Parte 1). Deliberadamente NO se
     usa una franja de color al costado de la tarjeta: sigue siendo el tic
     visual más gastado y compite con el contenido.
  ------------------------------------------------------------------------ */
  [data-slot="card"] {
    position: relative;
    border-radius: 0.875rem;
    background-color: color-mix(in oklab, var(--card) 92%, transparent);
    box-shadow:
      inset 0 1px 0 0 color-mix(in oklab, var(--panel-edge) 55%, transparent),
      0 0 0 1px color-mix(in oklab, var(--panel-edge) 60%, transparent),
      0 18px 40px -28px oklch(0 0 0 / 60%);
  }
  .dark [data-slot="card"] {
    background-image: radial-gradient(
      120% 90% at 0% 0%,
      var(--panel-glow) 0%,
      transparent 60%
    );
  }
```

- [ ] **Step 2: Actualizar el comentario en `card.tsx`**

En `src/components/ui/card.tsx`, el comentario que dice:

```tsx
      // El borde luminoso, el radio y la muesca de esquina los define
      // globals.css sobre [data-slot="card"]: aca no van `ring-*` ni
      // `rounded-*` porque las utilidades de Tailwind pisarian el
      // box-shadow del panel HUD.
```

Reemplazar por:

```tsx
      // El borde luminoso y el radio los define globals.css sobre
      // [data-slot="card"]: aca no van `ring-*` ni `rounded-*` porque las
      // utilidades de Tailwind pisarian el box-shadow del panel HUD.
```

- [ ] **Step 3: Verificar manualmente**

Run: `npm run dev` (en el directorio del repo), abrir `http://localhost:3000`.
Expected: los paneles (Cards) en Inicio se ven con esquinas redondeadas parejas en las 4 puntas (sin recorte en la inferior derecha), borde luminoso cian visible en modo oscuro. Cambiar a modo claro con el toggle: el borde se ve más sutil pero presente. No debe haber ningún elemento visual roto (diagonal fantasma, sombra cortada).

- [ ] **Step 4: Commit**

```bash
git add src/app/globals.css src/components/ui/card.tsx
git commit -m "Panel HUD: radios suaves + glow en vez de muesca recortada"
```

---

### Task 2: Motion de entrada — keyframes + utilidades

**Files:**
- Modify: `src/app/globals.css` (agregar sección nueva, al final de `@layer components`, antes del `@media (prefers-reduced-motion: reduce)` de cierre)

- [ ] **Step 1: Agregar keyframes y clases de utilidad**

Insertar este bloque nuevo dentro de `@layer components`, después del bloque `.metric` (línea ~283, antes del `}` que cierra `@layer components`):

```css

  /* ---- Motion de entrada (Telemetría 2.0) ----------------------------------
     Desvío intencional de la v1 (que decía "sin secuencias de entrada al
     cargar la página"): paneles y cifras aparecen con una entrada corta y
     escalonada. `prefers-reduced-motion` sigue cortando todo via el bloque
     global al final de este archivo — no hace falta repetirlo acá.
  ------------------------------------------------------------------------ */
  @keyframes reveal-rise {
    from {
      opacity: 0;
      transform: translateY(8px);
    }
    to {
      opacity: 1;
      transform: none;
    }
  }
  .reveal {
    animation: reveal-rise 420ms cubic-bezier(0.16, 0.84, 0.44, 1) both;
  }
  .reveal-d1 { animation-delay: 40ms; }
  .reveal-d2 { animation-delay: 90ms; }
  .reveal-d3 { animation-delay: 140ms; }
  .reveal-d4 { animation-delay: 190ms; }
  .reveal-d5 { animation-delay: 260ms; }
  .reveal-d6 { animation-delay: 330ms; }
```

- [ ] **Step 2: Aplicar `.reveal` a los KPIs de Inicio**

En `src/app/page.tsx`, la sección de KPIs (línea ~114):

```tsx
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Matriculaciones acumuladas"
```

Cambiar el `<section>` de apertura y envolver cada `<KpiCard>` en un `<div>` con la clase de reveal correspondiente (1 a 7, ciclando `reveal-d6` para el resto si hay más de 6 — acá hay 7 KPIs, así que el 7mo reusa `reveal-d6`):

```tsx
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="reveal reveal-d1">
          <KpiCard
            label="Matriculaciones acumuladas"
            value={formatUnidades(matric.valor)}
            variacion={matric.variacion}
            periodo={periodo}
            tooltip={`Contra el mismo período de ${f.anio - 1}: ${formatUnidades(matric.baseValor)} u.`}
          />
        </div>
        <div className="reveal reveal-d2">
          <KpiCard
            label="Importaciones acumuladas"
            value={formatUnidades(importa.valor)}
            variacion={importa.variacion}
            periodo={`${periodo} · livianos`}
            tooltip="La base de importación de CADAM cubre vehículos livianos; camiones y ómnibus se reportan en un archivo aparte."
          />
        </div>
        <div className="reveal reveal-d3">
          <KpiCard
            label="Marca líder"
            value={lider?.marca ?? "—"}
            periodo={lider ? `${formatUnidades(lider.unidades)} u. · ${formatPct(lider.participacion)}` : undefined}
            tooltip="Marca con más matriculaciones en el período filtrado."
          />
        </div>
        <div className="reveal reveal-d4">
          <KpiCard
            label="Segmento líder"
            value={segLider?.valor ?? "—"}
            periodo={segLider ? `${formatUnidades(segLider.unidades)} u. · ${formatPct(segLider.participacion)}` : undefined}
            tooltip="Segmento con más matriculaciones. CADAM no clasifica el segmento antes de 2024."
          />
        </div>
        <div className="reveal reveal-d5">
          <KpiCard
            label="Tecnología con mayor crecimiento"
            value={tecGanadora?.valor ?? "—"}
            variacion={tecGanadora?.variacion}
            periodo={tecGanadora ? `${formatUnidades(tecGanadora.unidades)} u.` : "sin base comparable"}
            tooltip="La tecnología (fuera de ICE) que más creció contra el año anterior, sobre una base mínima de 30 unidades."
          />
        </div>
        <div className="reveal reveal-d6">
          <KpiCard
            label={varMesAnterior ? `Variación ${varMesAnterior.mes} vs. mes anterior` : "Variación vs. mes anterior"}
            value={varMesAnterior ? formatUnidades(varMesAnterior.valor) : "—"}
            variacion={varMesAnterior?.variacion}
            periodo={varMesAnterior ? `último mes del rango` : undefined}
            tooltip="Matriculaciones del último mes del rango contra el mes inmediatamente anterior."
          />
        </div>
        <div className="reveal reveal-d6">
          <KpiCard
            label="Participación marcas propias"
            value={formatPct(propiasU / totalU)}
            periodo={`${formatUnidades(propiasU)} u.`}
            tooltip="JETOUR, GWM/GREAT WALL, JAC, Dongfeng, Soueast, Renault, Mitsubishi, Leapmotor, Zeekr y JMEV, sobre el total del período filtrado."
          />
        </div>
        <div className="reveal reveal-d6">
          <KpiCard
            label="Diferencia import. − matric."
            value={formatUnidades(Math.abs(diferencia))}
            periodo={diferencia >= 0 ? "importación por encima" : "matriculación por encima"}
            tooltip="Señal orientativa, no stock real. El detalle está en la sección Import. vs matric."
          />
        </div>
      </section>
```

- [ ] **Step 3: Verificar manualmente**

Run: `npm run dev`, abrir Inicio.
Expected: los 7 paneles de KPI aparecen escalonados (no todos de golpe) al cargar la página, con un desplazamiento vertical corto que se asienta. En DevTools → Rendering → "Emulate CSS prefers-reduced-motion: reduce", recargar: los paneles aparecen todos de inmediato, sin animación (el bloque `@media (prefers-reduced-motion: reduce)` ya existente en `globals.css` cubre esto automáticamente).

- [ ] **Step 4: Commit**

```bash
git add src/app/globals.css src/app/page.tsx
git commit -m "Motion de entrada: keyframes reveal + aplicado a KPIs de Inicio"
```

---

### Task 3: Hook `useCountUp` + integrarlo en `KpiCard`

**Files:**
- Create: `src/lib/use-count-up.ts`
- Modify: `src/components/dashboard/kpi-card.tsx`

- [ ] **Step 1: Crear el hook**

```typescript
"use client";

import { useEffect, useState } from "react";

/**
 * Anima un numero de 0 al valor final en `duracionMs`. Salta directo al
 * valor final si el usuario configuro prefers-reduced-motion.
 */
export function useCountUp(valorFinal: number, duracionMs = 900): number {
  const [valor, setValor] = useState(0);

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) {
      setValor(valorFinal);
      return;
    }
    let inicio: number | null = null;
    let frame: number;
    const paso = (t: number) => {
      if (inicio === null) inicio = t;
      const p = Math.min(1, (t - inicio) / duracionMs);
      const ease = 1 - Math.pow(1 - p, 3);
      setValor(Math.round(valorFinal * ease));
      if (p < 1) frame = requestAnimationFrame(paso);
    };
    frame = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(frame);
  }, [valorFinal, duracionMs]);

  return valor;
}
```

- [ ] **Step 2: Verificar que compila**

Run: `npx tsc --noEmit`
Expected: sin errores nuevos relacionados a `use-count-up.ts`.

- [ ] **Step 3: Commit el hook**

```bash
git add src/lib/use-count-up.ts
git commit -m "Agregar hook useCountUp (respeta prefers-reduced-motion)"
```

- [ ] **Step 4: Integrar en `KpiCard` (backward-compatible)**

En `src/components/dashboard/kpi-card.tsx`, el archivo completo actual es:

```typescript
import { ArrowDownRight, ArrowUpRight, Minus, HelpCircle } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { formatPct } from "@/lib/format";

interface KpiCardProps {
  label: string;
  value: string;
  periodo?: string;
  variacion?: number | null;
  tooltip?: string;
  disponible?: boolean;
}

export function KpiCard({
  label,
  value,
  periodo,
  variacion,
  tooltip,
  disponible = true,
}: KpiCardProps) {
```

Este task solo cambia la firma de props y el render del valor (el bloque `if (!disponible)` y el resto del JSX de abajo no cambian todavía — el reemplazo de íconos de este mismo archivo es el Task 7). Reemplazar el bloque de arriba por:

```typescript
"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { formatPct } from "@/lib/format";
import { useCountUp } from "@/lib/use-count-up";

interface KpiCardProps {
  label: string;
  value: string;
  periodo?: string;
  variacion?: number | null;
  tooltip?: string;
  disponible?: boolean;
  /** Si se pasa, el valor se anima con count-up desde 0 hasta este numero
   *  y `formatearAnimado` decide como se muestra en cada frame. Si no se
   *  pasa, se usa `value` tal cual sin animar — para KPIs de texto (marca,
   *  segmento) que no son un conteo. */
  valorAnimado?: number;
  formatearAnimado?: (n: number) => string;
}

export function KpiCard({
  label,
  value,
  periodo,
  variacion,
  tooltip,
  disponible = true,
  valorAnimado,
  formatearAnimado,
}: KpiCardProps) {
  // Se llama siempre (regla de hooks), aunque no se use el resultado: sin
  // valorAnimado, contado queda en 0 y no se muestra en ningun lado.
  const contado = useCountUp(valorAnimado ?? 0);
  const valorMostrado = valorAnimado !== undefined
    ? (formatearAnimado ? formatearAnimado(contado) : String(contado))
    : value;
```

- [ ] **Step 5: Usar `valorMostrado` en vez de `value` en el render**

Más abajo en el mismo archivo, la línea:

```tsx
        <p className="metric text-[1.75rem] text-foreground">{value}</p>
```

Cambiar a:

```tsx
        <p className="metric text-[1.75rem] text-foreground">{valorMostrado}</p>
```

(Nota: el bloque `if (!disponible) { return (...) }` de más arriba en el archivo sigue usando `label`/`tooltip` sin cambios — no lo toca este step.)

- [ ] **Step 6: Verificar que compila**

Run: `npx tsc --noEmit`
Expected: sin errores. `KpiCard` sigue aceptando todas las llamadas existentes sin `valorAnimado` (backward-compatible).

- [ ] **Step 7: Commit**

```bash
git add src/components/dashboard/kpi-card.tsx
git commit -m "KpiCard: soporte opcional de count-up (valorAnimado)"
```

---

### Task 4: Wire de count-up en los KPIs numéricos de Inicio

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Aplicar `valorAnimado` a los 5 KPIs numéricos**

De los 7 KPIs de Inicio, 5 son numéricos y animables (matriculaciones, importaciones, variación mes anterior, participación propias, diferencia); 2 son texto/categoría (marca líder, segmento líder, tecnología ganadora — esta última muestra el NOMBRE de la tecnología, no un conteo) y quedan sin animar. Sobre el JSX ya escrito en el Task 2 (Step 2), agregar `valorAnimado` + `formatearAnimado` a estos 5:

```tsx
        <div className="reveal reveal-d1">
          <KpiCard
            label="Matriculaciones acumuladas"
            value={formatUnidades(matric.valor)}
            valorAnimado={matric.valor}
            formatearAnimado={formatUnidades}
            variacion={matric.variacion}
            periodo={periodo}
            tooltip={`Contra el mismo período de ${f.anio - 1}: ${formatUnidades(matric.baseValor)} u.`}
          />
        </div>
        <div className="reveal reveal-d2">
          <KpiCard
            label="Importaciones acumuladas"
            value={formatUnidades(importa.valor)}
            valorAnimado={importa.valor}
            formatearAnimado={formatUnidades}
            variacion={importa.variacion}
            periodo={`${periodo} · livianos`}
            tooltip="La base de importación de CADAM cubre vehículos livianos; camiones y ómnibus se reportan en un archivo aparte."
          />
        </div>
```

Los KPIs de "Marca líder" y "Segmento líder" (reveal-d3, reveal-d4) quedan **sin cambios** (son texto).

El de "Tecnología con mayor crecimiento" (reveal-d5) queda **sin cambios** (`value` es el nombre de la tecnología, ej. "PHEV").

Para "Variación vs. mes anterior" (primer `reveal-d6`):

```tsx
        <div className="reveal reveal-d6">
          <KpiCard
            label={varMesAnterior ? `Variación ${varMesAnterior.mes} vs. mes anterior` : "Variación vs. mes anterior"}
            value={varMesAnterior ? formatUnidades(varMesAnterior.valor) : "—"}
            valorAnimado={varMesAnterior ? varMesAnterior.valor : undefined}
            formatearAnimado={formatUnidades}
            variacion={varMesAnterior?.variacion}
            periodo={varMesAnterior ? `último mes del rango` : undefined}
            tooltip="Matriculaciones del último mes del rango contra el mes inmediatamente anterior."
          />
        </div>
```

Para "Participación marcas propias" (segundo `reveal-d6`) — acá el valor mostrado es un porcentaje (`formatPct`), no unidades:

```tsx
        <div className="reveal reveal-d6">
          <KpiCard
            label="Participación marcas propias"
            value={formatPct(propiasU / totalU)}
            valorAnimado={propiasU / totalU}
            formatearAnimado={(n) => formatPct(n)}
            periodo={`${formatUnidades(propiasU)} u.`}
            tooltip="JETOUR, GWM/GREAT WALL, JAC, Dongfeng, Soueast, Renault, Mitsubishi, Leapmotor, Zeekr y JMEV, sobre el total del período filtrado."
          />
        </div>
```

Para "Diferencia import. − matric." (tercer `reveal-d6`):

```tsx
        <div className="reveal reveal-d6">
          <KpiCard
            label="Diferencia import. − matric."
            value={formatUnidades(Math.abs(diferencia))}
            valorAnimado={Math.abs(diferencia)}
            formatearAnimado={formatUnidades}
            periodo={diferencia >= 0 ? "importación por encima" : "matriculación por encima"}
            tooltip="Señal orientativa, no stock real. El detalle está en la sección Import. vs matric."
          />
        </div>
```

- [ ] **Step 2: Verificar manualmente**

Run: `npm run dev`, abrir Inicio.
Expected: los 5 KPIs numéricos cuentan desde 0 hasta su valor final al cargar la página (no de golpe). "Marca líder", "Segmento líder" y "Tecnología con mayor crecimiento" aparecen directo con su texto, sin contar. Con `prefers-reduced-motion: reduce` emulado: todos los valores aparecen directo en su valor final, sin conteo.

- [ ] **Step 3: Commit**

```bash
git add src/app/page.tsx
git commit -m "Inicio: wire de count-up en los 5 KPIs numéricos"
```

---

### Task 5: Animación de entrada en los 4 charts de ECharts

**Files:**
- Modify: `src/components/charts/serie-anios-chart.tsx:38-49`
- Modify: `src/components/charts/barras-filtro-chart.tsx:46-53`
- Modify: `src/components/charts/distribucion-chart.tsx:67-79`
- Modify: `src/components/charts/brecha-chart.tsx:30-40`

ECharts ya trae animación de entrada nativa (`animationDuration`, `animationEasing`, `animationDelay`) — no hace falta ninguna librería nueva ni código de animación a mano. Este task solo agrega esas opciones al `option` de cada chart.

- [ ] **Step 1: `serie-anios-chart.tsx`**

En el objeto `option` (empieza en línea 38), después de `color: theme.series,`:

```typescript
  const option = {
    color: theme.series,
    animationDuration: 700,
    animationEasing: "cubicOut" as const,
    grid: { left: 8, right: 8, top: 36, bottom: 24, containLabel: true },
```

- [ ] **Step 2: `barras-filtro-chart.tsx`**

En el objeto `option` (empieza en línea 46), después de la línea de apertura `const option = {`:

```typescript
  const option = {
    animationDuration: 600,
    animationEasing: "cubicOut" as const,
    grid: { left: 8, right: 48, top: 8, bottom: 8, containLabel: true },
```

- [ ] **Step 3: `distribucion-chart.tsx`**

En el objeto `option` (empieza en línea 67), después de `color: [...theme.series, theme.axis],`:

```typescript
  const option = {
    color: [...theme.series, theme.axis],
    animationDuration: 700,
    animationEasing: "cubicOut" as const,
    tooltip: {
```

- [ ] **Step 4: `brecha-chart.tsx`**

En el objeto `option` (empieza en línea 30), después del comentario y `color: [...]`:

```typescript
  const option = {
    // El orden sigue al de `series`: barra de diferencia, importaciones,
    // matriculaciones.
    color: [theme.series[3], theme.series[0], theme.series[1]],
    animationDuration: 700,
    animationEasing: "cubicOut" as const,
    grid: { left: 8, right: 8, top: 36, bottom: 24, containLabel: true },
```

- [ ] **Step 5: Verificar manualmente**

Run: `npm run dev`, abrir Inicio y Brecha.
Expected: las líneas y áreas de los gráficos se dibujan/crecen al montar la página, en vez de aparecer ya completas. Con `prefers-reduced-motion: reduce` emulado, ECharts respeta el mismo media query a nivel de SO/navegador solo si el navegador lo expone globalmente — **verificar este punto**: si los gráficos siguen animando con reduced-motion activado, no es un blocker (ECharts no lee el media query automáticamente), pero anotarlo como limitación conocida en el commit.

- [ ] **Step 6: Commit**

```bash
git add src/components/charts/serie-anios-chart.tsx src/components/charts/barras-filtro-chart.tsx src/components/charts/distribucion-chart.tsx src/components/charts/brecha-chart.tsx
git commit -m "Charts: animación de entrada nativa de ECharts (sin librería nueva)"
```

---

### Task 6: Quitar íconos — Copiloto (chat)

**Files:**
- Modify: `src/components/copiloto/chat.tsx`

- [ ] **Step 1: Quitar el import de lucide-react**

Cambiar:

```typescript
import { Bot, Loader2, Send, User } from "lucide-react";
```

Por (eliminar la línea completa, no se necesita reemplazo de import).

- [ ] **Step 2: Reemplazar el ícono `Bot` (estado vacío)**

Cambiar:

```tsx
            <Bot className="size-8 text-muted-foreground/50" />
```

Por:

```tsx
            <span className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground/50">
              Copiloto
            </span>
```

- [ ] **Step 3: Reemplazar el spinner `Loader2` (estado "cargando")**

Cambiar:

```tsx
          {cargando && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Consultando la base…
            </div>
          )}
```

Por:

```tsx
          {cargando && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="animate-pulse">Consultando…</span>
            </div>
          )}
```

- [ ] **Step 4: Quitar el ícono `Send` del botón (ya tiene el texto "Enviar")**

Cambiar:

```tsx
        <button
          type="submit"
          disabled={cargando || !texto.trim()}
          className="inline-flex h-10 items-center gap-1.5 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          <Send className="size-4" />
          Enviar
        </button>
```

Por:

```tsx
        <button
          type="submit"
          disabled={cargando || !texto.trim()}
          className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          Enviar
        </button>
```

- [ ] **Step 5: Reemplazar los avatares `Bot`/`User` en cada mensaje**

Cambiar la función `Mensaje`:

```tsx
function Mensaje({ turno }: { turno: Turno }) {
  const esUsuario = turno.role === "user";
  return (
    <div className={cn("flex gap-2.5", esUsuario && "flex-row-reverse")}>
      <div
        className={cn(
          "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full",
          esUsuario ? "bg-primary text-primary-foreground" : "border bg-muted"
        )}
      >
        {esUsuario ? <User className="size-4" /> : <Bot className="size-4" />}
      </div>
```

Por:

```tsx
function Mensaje({ turno }: { turno: Turno }) {
  const esUsuario = turno.role === "user";
  return (
    <div className={cn("flex gap-2.5", esUsuario && "flex-row-reverse")}>
      <div
        className={cn(
          "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold uppercase tracking-wide",
          esUsuario ? "bg-primary text-primary-foreground" : "border bg-muted text-muted-foreground"
        )}
      >
        {esUsuario ? "Vos" : "IA"}
      </div>
```

- [ ] **Step 6: Verificar manualmente**

Run: `npm run dev`, abrir `/copiloto`.
Expected: sin errores de import en consola; el estado vacío muestra "Copiloto" en vez de un ícono; al enviar una pregunta (con `ANTHROPIC_API_KEY` configurada) aparece "Consultando…" pulsando, y los mensajes muestran "Vos"/"IA" en vez de avatares con ícono.

- [ ] **Step 7: Commit**

```bash
git add src/components/copiloto/chat.tsx
git commit -m "Quitar íconos de lucide-react en el chat del Copiloto"
```

---

### Task 7: Quitar íconos — KpiCard (flechas de variación + tooltip)

**Files:**
- Modify: `src/components/dashboard/kpi-card.tsx`

- [ ] **Step 1: Reemplazar las flechas de variación por glifos de texto**

El bloque (después de los cambios del Task 3) que renderiza la variación:

```tsx
              {isUp && <ArrowUpRight className="size-3.5" />}
              {isDown && <ArrowDownRight className="size-3.5" />}
              {!isUp && !isDown && <Minus className="size-3.5" />}
              {formatPct(variacion, { signed: true })}
```

Cambiar por:

```tsx
              <span aria-hidden="true">{isUp ? "▲" : isDown ? "▼" : "–"}</span>
              {formatPct(variacion, { signed: true })}
```

- [ ] **Step 2: Reemplazar `HelpCircle` del tooltip por un glifo "?"**

La función `InfoTip`:

```tsx
function InfoTip({ text }: { text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger className="rounded-full bg-transparent p-0">
        <HelpCircle className="size-3.5 shrink-0 text-muted-foreground/70" />
      </TooltipTrigger>
      <TooltipContent className="max-w-64 text-xs">{text}</TooltipContent>
    </Tooltip>
  );
}
```

Cambiar por:

```tsx
function InfoTip({ text }: { text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger className="flex size-3.5 shrink-0 items-center justify-center rounded-full border border-muted-foreground/40 bg-transparent p-0 text-[9px] font-bold leading-none text-muted-foreground/70">
        ?
      </TooltipTrigger>
      <TooltipContent className="max-w-64 text-xs">{text}</TooltipContent>
    </Tooltip>
  );
}
```

- [ ] **Step 3: Quitar la línea de import de lucide-react**

**Corrección post-Task 3:** la review de Task 3 confirmó que ese task deliberadamente NO quitó este import (los íconos seguían en uso hasta ahora) — este step es el que realmente lo elimina, no es redundante con nada anterior.

Cambiar:

```typescript
import { ArrowDownRight, ArrowUpRight, Minus, HelpCircle } from "lucide-react";
```

Por (eliminar la línea completa).

- [ ] **Step 4: Verificar que ya no queda el import de lucide-react en este archivo**

Run: `grep -n "lucide-react" src/components/dashboard/kpi-card.tsx`
Expected: sin resultados (recién quitado en el Step 3 de este mismo task).

- [ ] **Step 5: Verificar manualmente**

Run: `npm run dev`, abrir Inicio.
Expected: los KPIs con variación muestran ▲/▼/– en vez de flechas SVG; el tooltip de ayuda muestra un círculo con "?" en vez de un ícono, y sigue mostrando el texto de ayuda al pasar el mouse.

- [ ] **Step 6: Commit**

```bash
git add src/components/dashboard/kpi-card.tsx
git commit -m "KpiCard: reemplazar flechas e ícono de ayuda por glifos de texto"
```

---

### Task 8: Quitar íconos — layout (sidebar, app-shell, theme-toggle)

**Files:**
- Modify: `src/components/layout/app-shell.tsx`
- Modify: `src/components/theme-toggle.tsx`

`src/components/layout/sidebar-nav.tsx` no importa `lucide-react` (confirmado) — no se toca.

- [ ] **Step 1: `app-shell.tsx` — quitar el import y el ícono `Gauge` (logo)**

Cambiar:

```tsx
import { Menu, X, Gauge } from "lucide-react";
```

Por:

```tsx
```

(el import se elimina completo; `Menu`/`X` se reemplazan en los steps siguientes).

En el sidebar desktop:

```tsx
        <div className="flex h-14 items-center gap-2.5 border-b px-4">
          <Gauge className="size-5 shrink-0 text-primary" />
          <span className="text-[0.82rem] font-extrabold uppercase leading-tight tracking-[0.06em]">
            Mercado Automotor <span className="text-primary">PY</span>
          </span>
        </div>
```

Cambiar por:

```tsx
        <div className="flex h-14 items-center gap-2.5 border-b px-4">
          <span className="text-[0.82rem] font-extrabold uppercase leading-tight tracking-[0.06em]">
            Mercado Automotor <span className="text-primary">PY</span>
          </span>
        </div>
```

En el sidebar mobile (overlay):

```tsx
              <div className="flex items-center gap-2">
                <Gauge className="size-5 text-primary" />
                <span className="text-sm font-semibold tracking-tight">
                  Mercado Automotor PY
                </span>
              </div>
```

Cambiar por:

```tsx
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold tracking-tight">
                  Mercado Automotor PY
                </span>
              </div>
```

En el header mobile (link con logo):

```tsx
          <Link href="/" className="flex items-center gap-2 md:hidden">
            <Gauge className="size-5 text-primary" />
            <span className="text-sm font-semibold">Mercado Automotor PY</span>
          </Link>
```

Cambiar por:

```tsx
          <Link href="/" className="flex items-center gap-2 md:hidden">
            <span className="text-sm font-semibold">Mercado Automotor PY</span>
          </Link>
```

- [ ] **Step 2: Reemplazar `X` (cerrar sidebar mobile) por glifo de texto**

Cambiar:

```tsx
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                aria-label="Cerrar menú"
                onClick={() => setMobileOpen(false)}
              >
                <X className="size-4" />
              </Button>
```

Por:

```tsx
              <Button
                variant="ghost"
                size="icon"
                className="size-8 text-base leading-none"
                aria-label="Cerrar menú"
                onClick={() => setMobileOpen(false)}
              >
                ✕
              </Button>
```

- [ ] **Step 3: Reemplazar `Menu` (abrir sidebar mobile) por glifo de texto**

Cambiar:

```tsx
          <Button
            variant="ghost"
            size="icon"
            className="size-8 md:hidden"
            aria-label="Abrir menú"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="size-4" />
          </Button>
```

Por:

```tsx
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-base leading-none md:hidden"
            aria-label="Abrir menú"
            onClick={() => setMobileOpen(true)}
          >
            ≡
          </Button>
```

- [ ] **Step 4: `theme-toggle.tsx` — reemplazar Moon/Sun por texto del modo destino**

Reemplazar el archivo completo:

```typescript
"use client";

import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { useHasMounted } from "@/lib/use-has-mounted";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useHasMounted();

  if (!mounted) {
    return <Button variant="ghost" size="sm" disabled className="h-8" />;
  }

  const isDark = resolvedTheme === "dark";

  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-8 text-xs"
      aria-label={isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      onClick={() => setTheme(isDark ? "light" : "dark")}
    >
      {isDark ? "Claro" : "Oscuro"}
    </Button>
  );
}
```

- [ ] **Step 5: Verificar manualmente**

Run: `npm run dev`.
Expected: el logo del sidebar/header muestra solo texto "Mercado Automotor PY" (sin ícono a la izquierda). En mobile (achicar la ventana), el botón de abrir menú muestra "≡" y el de cerrar "✕". El botón de tema muestra "Oscuro" en modo claro y "Claro" en modo oscuro, y cambia el tema al hacer clic.

- [ ] **Step 6: Commit**

```bash
git add src/components/layout/app-shell.tsx src/components/theme-toggle.tsx
git commit -m "Quitar íconos de layout (logo, menú mobile, toggle de tema)"
```

---

### Task 9: Quitar íconos — dashboard misc (empty-state, page-header, quitar-filtros, filtro-periodo, placeholder-page)

**Files:**
- Modify: `src/components/dashboard/empty-state.tsx`
- Modify: `src/components/dashboard/page-header.tsx`
- Modify: `src/components/dashboard/quitar-filtros.tsx`
- Modify: `src/components/dashboard/filtro-periodo.tsx`
- Modify: `src/components/dashboard/placeholder-page.tsx`

- [ ] **Step 1: `empty-state.tsx` — quitar `Inbox` (decorativo)**

Reemplazar el archivo completo:

```typescript
export function EmptyState({
  title = "Sin datos cargados todavía",
  description,
}: {
  title?: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-10 text-center">
      <p className="text-sm font-medium text-muted-foreground">{title}</p>
      <p className="max-w-sm text-xs text-muted-foreground/80">{description}</p>
    </div>
  );
}
```

- [ ] **Step 2: `page-header.tsx` — quitar `Info` (funcional, reemplazar por glifo)**

Cambiar:

```typescript
import { Info } from "lucide-react";
```

Por (eliminar la línea).

Cambiar:

```tsx
export function NotaDato({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-muted-foreground">
      <Info className="mt-0.5 size-3.5 shrink-0 text-amber-600 dark:text-amber-500" />
      <span>{children}</span>
    </div>
  );
}
```

Por:

```tsx
export function NotaDato({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-muted-foreground">
      <span
        aria-hidden="true"
        className="mt-0.5 flex size-3.5 shrink-0 items-center justify-center rounded-full border border-amber-600/50 text-[9px] font-bold leading-none text-amber-600 dark:border-amber-500/50 dark:text-amber-500"
      >
        i
      </span>
      <span>{children}</span>
    </div>
  );
}
```

- [ ] **Step 3: `quitar-filtros.tsx` — quitar `FilterX` (ya tiene texto)**

Cambiar:

```typescript
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FilterX } from "lucide-react";
```

Por:

```typescript
import { usePathname, useRouter, useSearchParams } from "next/navigation";
```

Cambiar:

```tsx
    >
      <FilterX className="size-3.5" />
      Quitar {n === 1 ? "el filtro" : `los ${n} filtros`}
    </button>
```

Por:

```tsx
    >
      Quitar {n === 1 ? "el filtro" : `los ${n} filtros`}
    </button>
```

- [ ] **Step 4: `filtro-periodo.tsx` — reemplazar `X` (chip de filtro) por glifo**

Cambiar:

```typescript
import { X } from "lucide-react";
```

Por (eliminar la línea).

Cambiar:

```tsx
            <span className="text-muted-foreground">{label}:</span>
            <span className="font-medium">{valor}</span>
            <X className="size-3.5 opacity-70" />
```

Por:

```tsx
            <span className="text-muted-foreground">{label}:</span>
            <span className="font-medium">{valor}</span>
            <span aria-hidden="true" className="opacity-70">✕</span>
```

- [ ] **Step 5: `placeholder-page.tsx` — quitar `ConstructionIcon` (decorativo)**

Reemplazar el archivo completo:

```typescript
import { Badge } from "@/components/ui/badge";

export function PlaceholderPage({
  title,
  description,
  fase,
}: {
  title: string;
  description: string;
  fase: string;
}) {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 p-4 md:p-6">
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <Badge variant="outline" className="font-normal">
          {fase}
        </Badge>
      </div>
      <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed p-6">
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Verificar manualmente**

Run: `npm run dev`, revisar Inicio (estado vacío si no hay datos), cualquier pantalla con `NotaDato` (ej. Rankings con segmento pre-2024), y una pantalla con filtros activos (clic en un gráfico para generar un chip).
Expected: sin errores de import; los avisos muestran un círculo con "i" en vez de ícono; los chips de filtro muestran "✕" como texto; el botón "Quitar filtros" sigue funcionando sin ícono.

- [ ] **Step 7: Commit**

```bash
git add src/components/dashboard/empty-state.tsx src/components/dashboard/page-header.tsx src/components/dashboard/quitar-filtros.tsx src/components/dashboard/filtro-periodo.tsx src/components/dashboard/placeholder-page.tsx
git commit -m "Quitar íconos de componentes dashboard (empty-state, avisos, filtros)"
```

---

### Task 10: Quitar íconos — tabla-ranking.tsx

**Files:**
- Modify: `src/components/dashboard/tabla-ranking.tsx`

- [ ] **Step 1: Quitar el import**

Cambiar:

```typescript
import {
  ArrowDown, ArrowDownRight, ArrowUp, ArrowUpRight, ChevronsUpDown,
  Download, Minus, Search,
} from "lucide-react";
```

Por (eliminar el bloque completo).

- [ ] **Step 2: Reemplazar los glifos de orden de columna (`th`)**

Cambiar:

```tsx
        {orden.campo !== campo ? (
          <ChevronsUpDown className="size-3 opacity-50" />
        ) : orden.asc ? (
          <ArrowUp className="size-3" />
        ) : (
          <ArrowDown className="size-3" />
        )}
```

Por:

```tsx
        <span aria-hidden="true" className="text-[10px] leading-none opacity-70">
          {orden.campo !== campo ? "⇅" : orden.asc ? "▲" : "▼"}
        </span>
```

- [ ] **Step 3: Quitar `Search` del input de búsqueda**

Cambiar:

```tsx
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar marca o modelo…"
            className="h-8 w-56 rounded-md border bg-background pl-7 pr-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
```

Por:

```tsx
        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar marca o modelo…"
          className="h-8 w-56 rounded-md border bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
```

- [ ] **Step 4: Quitar `Download` del botón de exportar (ya tiene texto)**

Cambiar:

```tsx
        <button
          type="button"
          onClick={exportar}
          className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium hover:bg-muted"
        >
          <Download className="size-3.5" />
          Exportar CSV
        </button>
```

Por:

```tsx
        <button
          type="button"
          onClick={exportar}
          className="ml-auto inline-flex h-8 items-center rounded-md border px-2.5 text-xs font-medium hover:bg-muted"
        >
          Exportar CSV
        </button>
```

- [ ] **Step 5: Reemplazar flechas de variación en `Variacion`**

Cambiar:

```tsx
      {up && <ArrowUpRight className="size-3.5" />}
      {down && <ArrowDownRight className="size-3.5" />}
      {!up && !down && <Minus className="size-3.5" />}
      {formatPct(v, { signed: true })}
```

Por:

```tsx
      <span aria-hidden="true">{up ? "▲" : down ? "▼" : "–"}</span>
      {formatPct(v, { signed: true })}
```

- [ ] **Step 6: Reemplazar flechas en `CambioPosicion`**

Cambiar:

```tsx
      {sube ? <ArrowUp className="size-3.5" /> : <ArrowDown className="size-3.5" />}
      {Math.abs(cambio)}
```

Por:

```tsx
      <span aria-hidden="true">{sube ? "▲" : "▼"}</span>
      {Math.abs(cambio)}
```

- [ ] **Step 7: Verificar manualmente**

Run: `npm run dev`, abrir Rankings.
Expected: la tabla de ranking funciona igual (ordenar por columna, buscar, exportar CSV), pero con "⇅"/"▲"/"▼" en los encabezados y "▲"/"▼"/"–" en las columnas de variación y cambio de posición, sin íconos SVG.

- [ ] **Step 8: Commit**

```bash
git add src/components/dashboard/tabla-ranking.tsx
git commit -m "Quitar íconos de tabla-ranking (orden, búsqueda, export, variación)"
```

---

### Task 11: Quitar íconos — tabla-share.tsx

**Files:**
- Modify: `src/components/dashboard/tabla-share.tsx`

- [ ] **Step 1: Quitar el import**

Cambiar:

```typescript
import { ArrowDown, ArrowUp, Download, Minus, TriangleAlert } from "lucide-react";
```

Por (eliminar la línea).

- [ ] **Step 2: Quitar `Download` del botón de exportar**

Cambiar:

```tsx
        <button
          type="button"
          onClick={exportar}
          className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium hover:bg-muted"
        >
          <Download className="size-3.5" />
          Exportar CSV
        </button>
```

Por:

```tsx
        <button
          type="button"
          onClick={exportar}
          className="ml-auto inline-flex h-8 items-center rounded-md border px-2.5 text-xs font-medium hover:bg-muted"
        >
          Exportar CSV
        </button>
```

- [ ] **Step 3: Reemplazar `TriangleAlert` (marcador de divergencia) por glifo "⚠"**

Cambiar (dentro de la celda de marca):

```tsx
                      {divergente(f) && (
                        <TriangleAlert
                          className="size-3.5 shrink-0 text-amber-600 dark:text-amber-500"
                          aria-label="Unidades y participación van en sentido contrario"
                        />
                      )}
```

Por:

```tsx
                      {divergente(f) && (
                        <span
                          className="shrink-0 text-amber-600 dark:text-amber-500"
                          role="img"
                          aria-label="Unidades y participación van en sentido contrario"
                        >
                          ⚠
                        </span>
                      )}
```

Y en el pie de tabla:

```tsx
        Las filas con <TriangleAlert className="inline size-3 text-amber-600 dark:text-amber-500" />{" "}
        crecen en unidades pero pierden participación (o al revés): el mercado
```

Cambiar por:

```tsx
        Las filas con <span className="text-amber-600 dark:text-amber-500">⚠</span>{" "}
        crecen en unidades pero pierden participación (o al revés): el mercado
```

- [ ] **Step 4: Reemplazar flechas en `Signo`**

Cambiar:

```tsx
      {up && <ArrowUp className="size-3.5" />}
      {down && <ArrowDown className="size-3.5" />}
      {!up && !down && <Minus className="size-3.5" />}
      {texto}
```

Por:

```tsx
      <span aria-hidden="true">{up ? "▲" : down ? "▼" : "–"}</span>
      {texto}
```

- [ ] **Step 5: Verificar manualmente**

Run: `npm run dev`, abrir Market Share.
Expected: la tabla funciona igual, con "⚠" para filas divergentes y "▲"/"▼"/"–" en las columnas de variación, sin íconos SVG.

- [ ] **Step 6: Commit**

```bash
git add src/components/dashboard/tabla-share.tsx
git commit -m "Quitar íconos de tabla-share (export, divergencia, variación)"
```

---

### Task 12: Quitar íconos — páginas (inteligencia, calidad-datos, cargas)

**Files:**
- Modify: `src/app/inteligencia/page.tsx`
- Modify: `src/app/calidad-datos/page.tsx`
- Modify: `src/app/cargas/page.tsx`

- [ ] **Step 1: `inteligencia/page.tsx` — quitar el campo `icono` de `SECCIONES` y sus usos**

Cambiar:

```typescript
import {
  AlertTriangle, History, Lightbulb, Search, ShieldAlert, TrendingUp,
} from "lucide-react";

const SECCIONES: { tipo: Tipo; titulo: string; icono: React.ElementType; descripcion: string }[] = [
  { tipo: "alerta", titulo: "Alertas", icono: AlertTriangle,
    descripcion: "Movimientos que requieren atención inmediata." },
  { tipo: "oportunidad", titulo: "Oportunidades", icono: Lightbulb,
    descripcion: "Espacios donde hay lugar para crecer." },
  { tipo: "riesgo", titulo: "Riesgos", icono: ShieldAlert,
    descripcion: "Amenazas a la posición actual." },
  { tipo: "hallazgo", titulo: "Hallazgos relevantes", icono: Search,
    descripcion: "Lo que muestran los datos del período." },
  { tipo: "historico", titulo: "Lectura histórica", icono: History,
    descripcion:
      "Sobre toda la serie cargada, no solo el período: estacionalidad, " +
      "tendencia de fondo, meses atípicos y proyección de cierre." },
];
```

Por:

```typescript
const SECCIONES: { tipo: Tipo; titulo: string; descripcion: string }[] = [
  { tipo: "alerta", titulo: "Alertas",
    descripcion: "Movimientos que requieren atención inmediata." },
  { tipo: "oportunidad", titulo: "Oportunidades",
    descripcion: "Espacios donde hay lugar para crecer." },
  { tipo: "riesgo", titulo: "Riesgos",
    descripcion: "Amenazas a la posición actual." },
  { tipo: "hallazgo", titulo: "Hallazgos relevantes",
    descripcion: "Lo que muestran los datos del período." },
  { tipo: "historico", titulo: "Lectura histórica",
    descripcion:
      "Sobre toda la serie cargada, no solo el período: estacionalidad, " +
      "tendencia de fondo, meses atípicos y proyección de cierre." },
];
```

Cambiar el título del resumen ejecutivo:

```tsx
          <CardTitle className="inline-flex items-center gap-2">
            <TrendingUp className="size-4" />
            Resumen ejecutivo
          </CardTitle>
```

Por:

```tsx
          <CardTitle>Resumen ejecutivo</CardTitle>
```

Cambiar el `.map` de secciones:

```tsx
      {SECCIONES.map(({ tipo, titulo, icono: Icono, descripcion }) => {
        const items = informe.items.filter((i) => i.tipo === tipo);
        return (
          <Card key={tipo}>
            <CardHeader>
              <CardTitle className="inline-flex items-center gap-2">
                <Icono className="size-4" />
                {titulo}
                <span className="font-normal text-muted-foreground">({items.length})</span>
              </CardTitle>
              <p className="text-xs text-muted-foreground">{descripcion}</p>
            </CardHeader>
```

Por:

```tsx
      {SECCIONES.map(({ tipo, titulo, descripcion }) => {
        const items = informe.items.filter((i) => i.tipo === tipo);
        return (
          <Card key={tipo}>
            <CardHeader>
              <CardTitle>
                {titulo}{" "}
                <span className="font-normal text-muted-foreground">({items.length})</span>
              </CardTitle>
              <p className="text-xs text-muted-foreground">{descripcion}</p>
            </CardHeader>
```

- [ ] **Step 2: `calidad-datos/page.tsx` — reemplazar íconos de estado por glifos**

Cambiar el import:

```typescript
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
```

Por (eliminar la línea).

Cambiar el bloque de controles OK:

```tsx
            {controles.map((c, i) => (
              <p key={i} className="flex items-start gap-2 text-sm">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <span>{c.mensaje}</span>
              </p>
            ))}
```

Por:

```tsx
            {controles.map((c, i) => (
              <p key={i} className="flex items-start gap-2 text-sm">
                <span
                  aria-hidden="true"
                  className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-[10px] font-bold text-emerald-600 dark:text-emerald-400"
                >
                  ✓
                </span>
                <span>{c.mensaje}</span>
              </p>
            ))}
```

Cambiar el bloque de errores/avisos:

```tsx
                {l.nivel === "error" ? (
                  <XCircle className="mt-0.5 size-4 shrink-0 text-rose-600 dark:text-rose-400" />
                ) : (
                  <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-500" />
                )}
```

Por:

```tsx
                <span
                  aria-hidden="true"
                  className={cn(
                    "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                    l.nivel === "error"
                      ? "bg-rose-500/15 text-rose-600 dark:text-rose-400"
                      : "bg-amber-500/15 text-amber-600 dark:text-amber-500"
                  )}
                >
                  {l.nivel === "error" ? "✕" : "!"}
                </span>
```

Nota: este cambio necesita `cn` importado — agregar al inicio del archivo:

```typescript
import { cn } from "@/lib/utils";
```

Cambiar el bloque de detalle de procesamiento:

```tsx
              <p key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                <Info className="mt-0.5 size-3.5 shrink-0" />
                <span>
```

Por:

```tsx
              <p key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                <span aria-hidden="true" className="mt-0.5 shrink-0">·</span>
                <span>
```

- [ ] **Step 3: `cargas/page.tsx` — quitar `FolderOpen`/`Terminal` (decorativos)**

Cambiar el import:

```typescript
import { FolderOpen, Terminal } from "lucide-react";
```

Por (eliminar la línea).

Cambiar:

```tsx
          <CardTitle className="inline-flex items-center gap-2">
            <FolderOpen className="size-4" />
            Cómo cargar un mes nuevo
          </CardTitle>
```

Por:

```tsx
          <CardTitle>Cómo cargar un mes nuevo</CardTitle>
```

Cambiar:

```tsx
          <CardTitle className="inline-flex items-center gap-2">
            <Terminal className="size-4" />
            Pendiente: carga desde la interfaz
          </CardTitle>
```

Por:

```tsx
          <CardTitle>Pendiente: carga desde la interfaz</CardTitle>
```

- [ ] **Step 4: Verificar manualmente**

Run: `npm run dev`, abrir Inteligencia, Calidad de datos y Cargas.
Expected: los títulos de sección se ven sin ícono a la izquierda; en Calidad de datos, los controles OK muestran "✓" en un círculo verde, los errores "✕" en rojo, los avisos "!" en ámbar, sin ninguna importación de `lucide-react` restante en estos 3 archivos.

- [ ] **Step 5: Commit**

```bash
git add src/app/inteligencia/page.tsx src/app/calidad-datos/page.tsx src/app/cargas/page.tsx
git commit -m "Quitar íconos de páginas Inteligencia, Calidad de datos y Cargas"
```

---

### Task 13: Remover la dependencia `lucide-react`

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Confirmar que no queda ningún uso**

Run: `grep -rn "lucide-react" src/`
Expected: sin resultados. Si aparece algo, ese archivo quedó afuera de los Tasks 6-12 — resolverlo con el mismo patrón (texto o glifo) antes de continuar.

- [ ] **Step 2: Quitar la dependencia**

Run: `npm uninstall lucide-react`
Expected: `package.json` y `package-lock.json` ya no listan `lucide-react`.

- [ ] **Step 3: Verificar que el build sigue funcionando**

Run: `npm run build`
Expected: build exitoso, sin errores de módulo faltante.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "Remover dependencia lucide-react (sin usos restantes)"
```

---

### Task 14: Actualizar `DESIGN.md`

**Files:**
- Modify: `DESIGN.md`

- [ ] **Step 1: Reescribir la sección "El panel HUD"**

Cambiar:

```markdown
## El panel HUD

`[data-slot="card"]` en `globals.css`:

- Borde luminoso cian a 1px (`box-shadow`, no `border`, para no alterar el
  layout) más un `inset` superior que simula el bisel.
- **Muesca en la esquina inferior derecha** vía `clip-path`, con una diagonal
  en `::after` para que se lea como bisel y no como error de render.
- Glow radial suave desde la esquina superior izquierda, solo en oscuro.
- Título en versalitas espaciadas, como etiqueta de instrumento.

> El componente `Card` **no** lleva `ring-*` ni `rounded-*`: las utilidades de
> Tailwind pisan el `box-shadow` del panel. El estilo lo dueña el CSS.
```

Por:

```markdown
## El panel HUD (Telemetría 2.0)

`[data-slot="card"]` en `globals.css`:

- Borde luminoso cian a 1px (`box-shadow`, no `border`, para no alterar el
  layout) más un `inset` superior que simula el bisel.
- **Radio suave** (`0.875rem`) en las 4 esquinas — reemplaza la muesca
  recortada de la v1 (era `clip-path` en la esquina inferior derecha).
- Glow radial suave desde la esquina superior izquierda, solo en oscuro.
- Título en versalitas espaciadas, como etiqueta de instrumento.

> El componente `Card` **no** lleva `ring-*` ni `rounded-*`: las utilidades de
> Tailwind pisan el `box-shadow` del panel. El estilo lo dueña el CSS.
```

- [ ] **Step 2: Reescribir la sección "Motion"**

Cambiar:

```markdown
## Motion

150–250 ms, solo para estado y feedback. Sin secuencias de entrada al cargar la
página: el usuario viene con una pregunta, no a ver una animación.
`prefers-reduced-motion` está cubierto globalmente en `globals.css`.
```

Por:

```markdown
## Motion

Dos capas:

- **Estado y feedback** (hover, focus, selección de filtro): 150–250 ms, sin
  cambios respecto a la v1.
- **Entrada** (Telemetría 2.0, desvío intencional de la v1): paneles con
  aparición escalonada (`.reveal` + `.reveal-d1`..`.reveal-d6`, 420 ms,
  `cubic-bezier(0.16, 0.84, 0.44, 1)`), cifras de KPI con count-up
  (`useCountUp`, 900 ms), y los 4 gráficos de ECharts con animación de
  entrada nativa (`animationDuration`/`animationEasing` en el `option`, sin
  librería nueva).

`prefers-reduced-motion` está cubierto globalmente en `globals.css` para toda
animación CSS (incluida `.reveal`); `useCountUp` lo respeta explícitamente
(salta directo al valor final). Los gráficos de ECharts no leen el media
query automáticamente — limitación conocida, no bloqueante.
```

- [ ] **Step 3: Actualizar la sección de "Prohibiciones que este proyecto respeta" con la nota de íconos**

Buscar la sección `## Prohibiciones que este proyecto respeta` y agregar un ítem al final de la lista:

```markdown
- **Sin librería de íconos.** `lucide-react` se removió (Telemetría 2.0): la
  interfaz comunica estado con tipografía, glifos Unicode (▲ ▼ ⚠ ✓ ✕ · i ?) y
  texto — nunca con SVGs decorativos.
```

- [ ] **Step 4: Commit**

```bash
git add DESIGN.md
git commit -m "DESIGN.md: documentar Telemetría 2.0 (panel, motion, sin íconos)"
```

---

### Task 15: Botones e inputs — estados hover/focus/active más ricos

**Files:**
- Modify: `src/components/ui/button.tsx:9`
- Modify: `src/app/globals.css` (agregar clase `.input-base` reusable)

El componente `Button` ya tiene hover/focus-visible/active/disabled cubiertos
(`hover:bg-primary/80`, `focus-visible:ring-3`, `active:translate-y-px`).
Este task suma un matiz que falta: un leve *glow* en hover para la variante
`default` (consistente con el glow del panel de la Task 1), y unifica el
estilo de los `<input>`/`<select>` sueltos del repo (hoy cada uno repite la
misma cadena de clases a mano en `filtro-periodo.tsx`, `tabla-ranking.tsx`,
etc.) en una sola clase para que el foco/hover sea idéntico en todos.

- [ ] **Step 1: Agregar glow de hover a la variante `default` del botón**

En `src/components/ui/button.tsx`, dentro de `buttonVariants`, la línea:

```typescript
        default: "bg-primary text-primary-foreground hover:bg-primary/80",
```

Cambiar por:

```typescript
        default:
          "bg-primary text-primary-foreground shadow-[0_0_0_0_var(--primary)] transition-shadow hover:bg-primary/90 hover:shadow-[0_0_16px_-2px_var(--primary)]",
```

- [ ] **Step 2: Agregar una clase reusable para inputs/selects en `globals.css`**

Insertar dentro de `@layer components`, después del bloque `.metric` (antes
del bloque de motion agregado en la Task 2):

```css

  /* ---- Input base (Telemetría 2.0) -----------------------------------------
     Unifica el estilo de los <input>/<select> sueltos del repo (antes cada
     uno repetia la misma cadena de clases). Mismo foco que los botones.
  ------------------------------------------------------------------------ */
  .input-base {
    height: 2rem;
    border-radius: 0.5rem;
    border-width: 1px;
    background-color: var(--background);
    padding-inline: 0.5rem;
    font-size: 0.875rem;
    transition: border-color 150ms, box-shadow 150ms;
  }
  .input-base:hover {
    border-color: color-mix(in oklab, var(--ring) 40%, var(--border));
  }
  .input-base:focus-visible {
    outline: none;
    border-color: var(--ring);
    box-shadow: 0 0 0 3px color-mix(in oklab, var(--ring) 50%, transparent);
  }
```

- [ ] **Step 3: Aplicar `.input-base` en `filtro-periodo.tsx`**

En `src/components/dashboard/filtro-periodo.tsx`, la constante:

```typescript
const selectCls = cn(
  "h-8 rounded-md border bg-background px-2 text-sm",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
);
```

Cambiar por:

```typescript
const selectCls = "input-base";
```

- [ ] **Step 4: Aplicar `.input-base` en el input de búsqueda de `tabla-ranking.tsx`**

En `src/components/dashboard/tabla-ranking.tsx` (después de los cambios de la
Task 10), la línea:

```tsx
          className="h-8 w-56 rounded-md border bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
```

Cambiar por:

```tsx
          className="input-base w-56"
```

- [ ] **Step 5: Verificar manualmente**

Run: `npm run dev`, abrir Inicio y pasar el mouse sobre el botón "Enviar" del
Copiloto (o cualquier botón `default`).
Expected: al hacer hover aparece un glow sutil cian alrededor del botón,
además del cambio de opacidad ya existente. En Rankings y en cualquier
filtro con `<select>`, el foco (Tab) y el hover se ven idénticos entre todos
los campos.

- [ ] **Step 6: Commit**

```bash
git add src/components/ui/button.tsx src/app/globals.css src/components/dashboard/filtro-periodo.tsx src/components/dashboard/tabla-ranking.tsx
git commit -m "Botones e inputs: glow de hover + clase input-base unificada"
```

---

### Task 16: Verificación final manual

**Files:** ninguno (solo verificación)

- [ ] **Step 1: Recorrido completo en navegador**

Run: `npm run dev`, abrir cada una de las 13 pantallas del menú lateral (Inicio, Resumen del mercado, Evolución mensual, Rankings, Segmentos, Combustibles y tecnologías, Market Share, Import. vs matric., Centro de Inteligencia, Copiloto, Carga de archivos, Calidad de datos, Configuración).
Expected: todas cargan sin error de consola; los paneles se ven con radios suaves (sin muesca); ningún ícono SVG visible en ninguna pantalla.

- [ ] **Step 2: Modo claro y oscuro**

Con el botón de tema (ahora dice "Oscuro"/"Claro"), alternar entre ambos modos en 2-3 pantallas.
Expected: el glow del panel solo se ve en oscuro (como antes); el contraste de texto se mantiene legible en ambos modos.

- [ ] **Step 3: `prefers-reduced-motion`**

En Chrome DevTools → More tools → Rendering → "Emulate CSS media feature prefers-reduced-motion" → `reduce`. Recargar Inicio.
Expected: los KPIs aparecen directo en su valor final (sin count-up), los paneles aparecen sin desplazamiento de entrada.

- [ ] **Step 4: Captura de referencia**

Run: `npx playwright screenshot --viewport-size=1440,900 --wait-for-timeout=1500 http://localhost:3000 /tmp/inicio-final.png` (con el dev server corriendo)
Expected: la captura muestra el panel con radios, KPIs ya asentados, sin íconos.

- [ ] **Step 5: Build de producción**

Run: `npm run build`
Expected: build exitoso sin warnings nuevos de TypeScript/ESLint relacionados a los cambios de este plan.
