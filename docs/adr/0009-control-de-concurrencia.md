# ADR-0009 · Control de concurrencia: bloqueo por asistente y restricciones en la base

**Estado:** aceptado · 2026-11-24

## Contexto
- QA-4: dos operaciones simultáneas no pueden violar las reglas que el enunciado dice que "el sistema no puede dejar pasar".
- Leer y luego guardar no es atómico: dos asignaciones al mismo asistente pueden leer la misma agenda, pasar cada una la validación del tope (RN-07) y, juntas, superarlo, aunque no se traslapen.
- Hay reglas que una restricción de la base puede expresar (traslapes, unicidad) y otras que no (sumas por semana).

## Decisión
Cada caso de uso que cambia estado corre en **una transacción**, y cada regla se protege así:

| Regla | Mecanismo |
| --- | --- |
| RN-06 traslape por asistente y RN-07 tope semanal | La transacción de asignar **bloquea la agenda del asistente** (`SELECT … FOR UPDATE` sobre su fila) antes de leer sus turnos: las asignaciones al mismo asistente se ejecutan de una en una y la segunda ve a la primera. Segunda barrera para RN-06: `EXCLUDE USING gist (id_asistente WITH =, franja WITH &&)` sobre turnos asignados, pendientes o en curso. |
| RN-09 un turno por franja del laboratorio | `EXCLUDE USING gist (id_laboratorio WITH =, franja WITH &&)` con el mismo filtro de estados. Si salta al confirmar, se traduce a `FranjaOcupadaEnLaboratorio`. |
| Doble reserva de una máquina | `EXCLUDE USING gist (id_maquina WITH =, franja WITH &&)` sobre reservas activas o en uso. Se traduce a `MaquinaNoDisponible`. |
| RN-17 una reserva activa por estudiante | Índice único parcial `(id_estudiante) WHERE estado IN ('ACTIVA','EN_USO')`. Como solo puede existir una reserva activa a la vez, dos reservas simultáneas no pueden sumar más de 6 h. Se traduce a `YaTieneReservaActiva`. |
| RN-26 un cierre por mes | `UNIQUE (anio, mes)`. Si dos disparos coinciden, el que pierde devuelve el cierre existente. |
| RN-10 el primero que toma la oferta | Actualización condicional `WHERE estado = 'ABIERTA'` (diseño, fuera del núcleo). |

En los puertos esto aparece como `UnidadDeTrabajo.ejecutar(trabajo)`, `RepositorioTurnos.bloquearAgendaDe(idAsistente)` y la obligación de `guardar` de lanzar el error de dominio correspondiente si una restricción salta al confirmar. Los dobles en memoria implementan lo mismo con un cerrojo por asistente y verificaciones dentro de `guardar`, de modo que las pruebas concurrentes (`Promise.all`) ejercitan el mismo contrato.

## Alternativas descartadas
- **Solo validar en el dominio:** correcto con un usuario; falla con dos simultáneos.
- **Aislamiento `SERIALIZABLE` en todas las transacciones:** protege todo sin pensar regla por regla, pero obliga a reintentar transacciones abortadas y vuelve impredecible el rendimiento.
- **Cerrojo en memoria del proceso:** solo funciona mientras haya una instancia y se pierde al reiniciar.

## Consecuencias
- \+ Ninguna de las reglas de QA-4 depende de la suerte; cada una tiene un mecanismo nombrado y una prueba concurrente.
- \+ Las restricciones de la base son una segunda barrera aunque un camino futuro se salte el dominio.
- − Las asignaciones al mismo asistente esperan su turno; con el volumen de CompuLab la espera es de milisegundos (sensibilidad S-2 en `05-atributos-de-calidad.md`).
- − Requiere la extensión `btree_gist` de PostgreSQL 14 (incluida en la imagen oficial).
