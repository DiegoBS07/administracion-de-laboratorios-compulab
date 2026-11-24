# ADR-0004 · Disponibilidad con reinicio automático de Docker, sin réplicas

**Estado:** aceptado · 2026-11-24

## Contexto
- El enunciado pide que el sistema responda rápido, tenga alta disponibilidad y que los picos del TEC (matrícula, finales) no lo afecten (QA-1, QA-2, QA-3).
- El equipo pidió una arquitectura no sobredimensionada, desplegada con Docker Compose (R-1).

## Decisión
- Cada contenedor de larga vida tiene `restart: unless-stopped` y healthcheck; si un proceso cae, Docker lo reinicia.
- CompuLab tiene **su propia base de datos** en su propio contenedor, con volumen persistente y respaldo diario (`pg_dump`).
- Límites de memoria por contenedor para que un fallo no consuma todo el servidor.
- El backend emite su propia sesión después de autenticar, para no depender del Directorio en cada petición.

## Alternativas descartadas
- **Varias réplicas del backend con balanceador:** mejora la disponibilidad, pero obliga a coordinar las tareas programadas y a gestionar sesiones compartidas.
- **Replicación de PostgreSQL con conmutación automática (Patroni):** complejidad operativa alta para el tamaño del sistema.
- **Orquestador (Kubernetes, Swarm):** no se confirmó que el TEC lo ofrezca y excede lo pedido.

## Consecuencias
- \+ Despliegue con un solo comando; nada nuevo que aprender para operar.
- \+ Una caída del proceso se recupera en menos de un minuto (QA-2).
- − Si se cae el servidor completo, el sistema no está disponible hasta restaurarlo; se pierde como máximo lo posterior al último respaldo.
- − Queda registrado como evolución futura: réplicas y replicación si la Escuela lo requiere.
