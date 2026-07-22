# Mercado Automotor PY

Plataforma de inteligencia comercial sobre el mercado automotor paraguayo, para
Santa Rosa Paraguay S.A. (Jetour, GWM, JAC, Renault, Mitsubishi, Dongfeng,
Soueast, Leapmotor, Zeekr, JMEV).

**Register:** product. El diseño sirve a la tarea; la herramienta tiene que
desaparecer detrás del dato.

## Qué hace

Convierte los informes mensuales de CADAM/DNRA (importaciones y matriculaciones)
en dashboards navegables: evolución, rankings por marca/modelo/versión,
segmentos, tecnologías de propulsión, market share, brecha importación vs.
matriculación, un centro de inteligencia por reglas y un copiloto que responde
preguntas consultando la misma base.

## Quién lo usa y dónde

El director comercial y su equipo, en una notebook, durante la jornada, y
proyectado en pantalla grande en la reunión de los lunes. Miran el número,
deciden algo, y siguen. Nadie "explora" por gusto: vienen con una pregunta.

Esa doble situación —notebook a un metro y proyector a cinco— manda en el
diseño: los números tienen que leerse de lejos y la densidad tiene que
aguantar de cerca.

## Principios innegociables (heredados del pipeline de datos)

1. **Nunca inventar datos.** Lo que falta se muestra como "sin datos", jamás
   como cero. Una variación sin base comparativa dice "sin base", no +100%.
2. **Honestidad estadística.** Bases menores a 30 unidades no generan
   porcentajes. Los meses sin dato quedan como hueco en las series, no unidos
   por la línea.
3. **Declarar la fuente.** Cada título dice sobre qué está calculado
   (matriculaciones / importaciones), porque las dos fuentes tienen
   granularidad y cobertura distintas.
4. **Trazabilidad.** Toda carga registra archivo, fecha y validación contra los
   totales oficiales de CADAM.

## Estado

12 secciones en producción. Los filtros viven en la URL (compartibles), se
acumulan entre sí y se aplican con un clic sobre cualquier gráfico o fila.
