# ADR-0005 · Tarifas y recargo como datos con vigencia

**Estado:** aceptado · 2026-11-24

## Contexto
- La Coordinación de Soporte cambia las tarifas por categoría y el porcentaje de recargo casi cada semestre y casi nunca con tiempo (QA-5).
- Un mes cerrado no se recalcula (RN-25), así que un cambio de tarifa no puede alterar cierres pasados.
- Puede haber cambios a mitad de mes (SUP-17).

## Decisión
Las tarifas por categoría y el porcentaje de recargo se guardan como **registros con fecha de vigencia** que el coordinador de soporte administra desde la aplicación (CU-15). El cálculo pide el valor vigente en la fecha de cada turno a través del puerto `TablaTarifas`. Cada cierre guarda una **copia** de los valores aplicados.

## Alternativas descartadas
- **Valores en el código o en variables de entorno:** cada cambio exigiría un despliegue (incumple QA-5) y no conserva el historial.
- **Una sola tarifa vigente que se sobrescribe:** impide calcular bien un mes con cambio a mitad y deja los cierres sin evidencia de qué valores se usaron.

## Consecuencias
- \+ Cambiar tarifas es una operación de negocio, sin tocar código.
- \+ Cada cierre es reproducible y auditable con sus valores.
- − Hay que impedir vigencias que se traslapen y cambios con vigencia dentro de un mes ya cerrado (extensiones de CU-15).
