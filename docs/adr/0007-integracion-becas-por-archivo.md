# ADR-0007 · Integración con Becas por archivo CSV descargado

**Estado:** aceptado · 2026-11-24

## Contexto
- La Oficina de Becas no usa el sistema y recibe una vez al mes lo que hay que pagar a cada asistente (FP-3).
- El formato exacto no está definido (SUP-03) y puede cambiar sin aviso.
- El pago propiamente dicho está fuera del alcance.

## Decisión
Al cerrar el mes, el adaptador `GeneradorArchivoBecas` produce un **CSV** que queda guardado con el cierre. El coordinador de soporte lo **descarga** y lo entrega a Becas/Planilla. El formato vive solo en ese adaptador (capa anticorrupción).

## Alternativas descartadas
- **Envío automático por correo o SFTP:** no hay un canal acordado con Becas; agrega una integración sin confirmación de recepción.
- **API para que Becas consulte:** Becas no tiene sistema que la consuma.
- **Excel (XLSX):** no se pidió; CSV se abre igual en Excel y es más fácil de verificar en pruebas.

## Consecuencias
- \+ Integración mínima, sin dependencia de sistemas ajenos.
- \+ Si Becas cambia el formato, se toca un solo archivo y las pruebas del dominio no se enteran.
- − No hay confirmación automática de que Becas recibió el archivo; la entrega queda bajo responsabilidad del coordinador de soporte.
