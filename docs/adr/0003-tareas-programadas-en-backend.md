# ADR-0003 · Tareas programadas dentro del backend

**Estado:** aceptado · 2026-11-24

## Contexto
- Varias reglas dependen del tiempo: vencer ofertas (RN-11), aviso de turno sin entrada y turno no cubierto (RN-13), liberar reservas (RN-18) y cerrar el mes el día 1 (RN-21).
- El volumen es bajo: el cierre procesa decenas de asistentes y unos cientos de turnos.
- Se pidió una arquitectura simple con Docker Compose.

## Decisión
Un módulo `tareas-programadas/` dentro del contenedor `backend` usa **node-cron** para invocar, a su hora, los mismos casos de uso que usaría una persona (por ejemplo, `CerrarMes.ejecutar(anio, mes)`). Hay una sola instancia del backend, así que cada tarea corre una vez. Todas las tareas son idempotentes: si se ejecutan de nuevo, no duplican efectos (RN-26).

## Alternativas descartadas
- **Contenedor *worker* aparte:** aísla la carga, pero no hay carga que aislar; agrega un contenedor más que operar.
- **pg-boss u otra cola sobre PostgreSQL:** útil con varias réplicas; con una sola instancia es complejidad sin beneficio.
- **cron del sistema operativo llamando a la API:** reparte la lógica entre el host y la aplicación y no viaja con el contenedor.

## Consecuencias
- \+ Ninguna pieza nueva de infraestructura; las tareas se prueban como cualquier caso de uso, con un `Reloj` falso.
- − Si el backend está caído a la hora de una tarea, esa ejecución se pierde. Se mitiga con tareas que procesan "todo lo pendiente" (por ejemplo, liberar todas las reservas vencidas, no solo las del último minuto) y con el disparo manual del cierre (SUP-27).
- − Si en el futuro hay varias réplicas del backend, esta decisión debe sustituirse.
