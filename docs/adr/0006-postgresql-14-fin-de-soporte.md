# ADR-0006 · Aceptar PostgreSQL 14 pese a su fin de soporte

**Estado:** aceptado · 2026-11-24

## Contexto
- R-2: la infraestructura del TEC ofrece PostgreSQL en su versión 14; es condición no negociable.
- La comunidad de PostgreSQL publicó la última versión menor de PostgreSQL 14 en noviembre de 2026; desde entonces no recibe parches de seguridad nuevos.

## Decisión
Se usa la imagen `postgres:14` con la versión mayor fijada. No se usan funciones exclusivas de versiones posteriores. El riesgo queda registrado para que la Escuela planifique la migración.

## Alternativas descartadas
- **Usar PostgreSQL 16 o 17:** incumple una restricción del cliente.
- **Otra base de datos:** incumple R-2.

## Consecuencias
- \+ Se cumple la restricción del cliente.
- − Riesgo de seguridad creciente con el tiempo. Se mitiga con que la base solo se publica en `127.0.0.1` del servidor y no es accesible desde fuera.
- − Al migrar de versión habrá que probar las migraciones Flyway contra la nueva versión; como solo se usa SQL estándar de PostgreSQL 14, el costo esperado es bajo.
