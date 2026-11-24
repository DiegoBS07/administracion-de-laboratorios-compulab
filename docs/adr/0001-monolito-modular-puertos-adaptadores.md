# ADR-0001 · Monolito modular con puertos y adaptadores

**Estado:** aceptado · 2026-11-24

## Contexto
- QA-6 y R-5 a R-8: el dominio se debe probar con dobles, sin base de datos, red ni reloj; las dependencias externas se declaran como interfaces y se inyectan.
- Un solo equipo pequeño, un solo ritmo de cambio y un volumen bajo (4 laboratorios, decenas de asistentes).
- Ninguna de las cuatro razones para separar servicios aplica: escala distinta, ritmo de cambio distinto, dueño distinto o aislamiento de falla.

## Decisión
El backend es **un solo contenedor** dividido en módulos por razón de cambio (horarios, reservas, liquidación, asistencia, asistentes, reclutamiento, identidad, notificaciones). Cada módulo tiene capas `dominio → aplicacion → infraestructura`. Los casos de uso dependen de puertos (interfaces) que la infraestructura implementa. Los módulos no se importan entre sí: `arranque/` los conecta. FA-1 y FA-2 vigilan estas reglas.

## Alternativas descartadas
- **Microservicios por módulo:** agrega red, despliegues coordinados y patrones de fallo distribuido (idempotencia, reintentos) sin un driver que lo pague; con una base compartida sería un monolito distribuido.
- **Capas técnicas sin módulos** (`controllers/`, `services/`, `repositories/`): cambiar una regla de reservas tocaría varias carpetas, y la estructura no diría qué hace el sistema.
- **Casos de uso que usan el ORM directamente:** impide probar las reglas sin base de datos (incumple R-8).

## Consecuencias
- \+ Todas las reglas de CU-06, CU-11 y CU-14 se prueban en milisegundos con dobles.
- \+ Un cambio de reglas de reservas toca un solo módulo.
- \+ Si algún día un módulo necesita escalar aparte, ya tiene sus fronteras.
- − Más interfaces y archivos que un CRUD directo.
- − Los puentes entre módulos en `arranque/` son código adicional que hay que mantener.
