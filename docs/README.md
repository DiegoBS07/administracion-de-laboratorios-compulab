# Documento de diseño — CompuLab

Sistema de administración de los laboratorios de cómputo de la Escuela de Computación: reclutamiento de asistentes, horarios, uso de máquinas y cálculo de pago.

Este directorio es la **fuente oficial del diseño**. Nada se implementa en `backend/` o `frontend/` sin estar definido aquí primero; si al implementar aparece algo no previsto, se actualiza el documento (y, si es una decisión difícil de revertir, se escribe un ADR).

## Índice y estado

| # | Sección (enunciado) | Archivo | Estado |
| --- | --- | --- | --- |
| 1 | Contexto | `01-contexto.md` | Base lista |
| 1 | Requerimientos | `02-requerimientos.md` | Base lista |
| 1 | Alcance | `03-alcance.md` | Base lista |
| 2 | Casos de uso | `04-casos-de-uso.md` | 3 casos completos con contrato; resto en ficha breve |
| 3 | Atributos de calidad | `05-atributos-de-calidad.md` | 9 escenarios, árbol de utilidad y resultados ATAM |
| 4 | Restricciones tecnológicas | `06-restricciones-tecnologicas.md` | Base lista |
| 5 | Arquitectura | `07-arquitectura.md` | Vistas 4+1 (C4 nivel 2, procesos, desarrollo, física, escenario), funciones de aptitud y guía de cambios frecuentes |
| 6 | Decisiones ADR | `adr/` | 11 ADR aceptados |
| 7 | Componentes | `08-componentes.md` | C4 nivel 3, prueba de reemplazo, contratos y API de los 3 casos de uso |
| 8 | Clases | `09-clases.md` | Núcleo compartido (9.1), horarios (9.2), reservas (9.3), liquidación (9.4) e identidad (9.5) implementados |
| 9 | Comportamiento | `10-comportamiento.md` | Realización interna de CU-06, CU-11 y CU-14; máquinas de estado de Turno y Reserva |
| 10 | Patrones | `11-patrones.md` | Pendiente |
| 11 | Trazabilidad | `12-trazabilidad.md` | Matriz del núcleo: alcance, RF y RN, contratos, QA y restricciones del curso hasta el código y las pruebas |
| 12 | Evaluación grupal | `13-evaluacion-grupal.md` | Pendiente |
| 13 | Bitácora individual | `14-bitacora-individual.md` | Pendiente |
| 14 | Diseño UX/UI | `diseno-ux-ui.md` | Navegación por rol, rutas, flujos de las 3 pantallas del núcleo, identidad visual del TEC, prototipo navegable (`prototipo/`) y su implementación en `frontend/`; wireframes y evaluación heurística pendientes |
| 15 | Diseño de BD | `16-diseno-bd.md` | Pendiente como documento propio; el modelo de datos implementado está en `07-arquitectura.md` (7.11) y `database/migrations/` |

**Lo mínimo para empezar a programar** ya está: los tres casos de uso del núcleo ejecutable (CU-06, CU-11 y CU-14) tienen escenario, extensiones, contrato con invariantes y realización interna; los módulos tienen sus interfaces; y la API que consume el frontend está definida en `08-componentes.md`.

## Convenciones de códigos

| Prefijo | Significado | Dónde se define |
| --- | --- | --- |
| `RF-` | Requerimiento funcional | `02-requerimientos.md` |
| `RN-` | Regla de negocio | `02-requerimientos.md` |
| `CU-` | Caso de uso | `04-casos-de-uso.md` |
| `QA-` | Atributo de calidad (escenario) | `05-atributos-de-calidad.md` |
| `R-` | Restricción | `06-restricciones-tecnologicas.md` |
| `FP-` | Funcionalidad prioritaria (núcleo ejecutable) | `03-alcance.md` |
| `SUP-` | Supuesto de interpretación del enunciado | `03-alcance.md` |
| `ADR-` | Decisión de arquitectura | `adr/` |
| `FA-` | Función de aptitud | `07-arquitectura.md` |
| `P` / `I` | Poscondición / invariante de un contrato | `04-casos-de-uso.md` |
| `RA-`, `NR-`, `S-`, `C-` | Riesgo, no-riesgo, sensibilidad y compromiso (ATAM) | `05-atributos-de-calidad.md` |

Los códigos se citan tal cual en el código (`// RN-07`, `// CU-06 paso 3`, `// ext 4a`) y en los nombres de las pruebas, para que la trazabilidad salga sola.

## Reglas de redacción

- **Sin links embebidos:** las referencias a otros archivos se escriben como nombre de archivo en texto (`04-casos-de-uso.md`), no como hipervínculo.
- Los diagramas están en Mermaid dentro de cada archivo; cada diagrama lleva título con el nombre de la vista y la fecha, y ninguna flecha va sin verbo o protocolo.
- Fecha de esta versión: 2026-11-24.

## Correspondencia con el formato del curso

El informe final debe incluir portada, tabla de contenidos, introducción, descripción del problema, diseño de la solución, diagramas, prototipo, instalación y uso, conclusiones, distribución del trabajo y referencias. La introducción y la descripción del problema salen de `01-contexto.md`; el diseño y los diagramas, de los archivos 04 a 16; la instalación, del `README.md` de la raíz. Portada, conclusiones, distribución del trabajo y referencias se agregan al armar el informe.
