# 3. Alcance

> Responde: ¿qué entra, qué no entra, qué se programa en esta entrega y qué se supuso donde el enunciado no es claro?
> Versión 2026-11-24.

## 3.1 Lo que entra en el sistema (diseño completo)

| Área | Incluye | Requerimientos |
| --- | --- | --- |
| Reclutamiento | Convocatoria por semestre, postulación con disponibilidad y laboratorios, entrevista, admisión con categoría y tope, rechazo. | RF-03 a RF-06 |
| Asistentes | Corrección del tope, renuncia y baja con turnos vacantes y aviso. | RF-07, RF-08 |
| Tarifas | Tarifas por categoría y porcentaje de recargo, con vigencia. | RF-09 |
| Horarios | Asignación con validaciones, consulta, reasignación, aceptación fuera de disponibilidad, ofertas, toma y aprobación, vencimiento. | RF-10 a RF-17 |
| Asistencia | Marcas desde el celular, turnos no cubiertos, consulta semanal de cobertura, regularización. | RF-18 a RF-21 |
| Máquinas y reservas | Consulta de disponibilidad, reserva, cancelación, presentación, liberación automática, fuera de servicio, reparación, métricas, catálogo. | RF-22 a RF-30 |
| Liquidación | Cierre mensual, archivo para Becas, horas sobre el tope, constancia de corrección. | RF-31 a RF-34 |
| Transversal | Inicio de sesión con el Directorio, roles por laboratorio, avisos en la app y por correo. | RF-01, RF-02, RF-35 |

## 3.2 Lo que NO entra (exclusiones del enunciado)

| Exclusión | Qué significa en el diseño | Lo que sí queda dentro |
| --- | --- | --- |
| **Asignación de becas y sus requisitos** | No hay reglas para decidir quién merece beca, ni cálculo de categoría o tope, ni consulta a sistemas de Becas. | El coordinador de soporte **registra** categoría y tope, y los corrige si Becas los cambia. El sistema solo los **usa**. |
| **El pago propiamente dicho** | No hay transferencias, banco, pasarela, comprobantes ni seguimiento de si se pagó. | El **cálculo** mensual y el **archivo** que se entrega a Becas/Planilla. |
| **Inventario de hardware** | No hay especificaciones, número de serie, software instalado, garantías ni historial técnico de reparaciones. | Qué máquinas hay en cada laboratorio (identificador) y si están **en servicio o no**, con fechas, solo para la métrica semanal. |

Consecuencias de lo anterior (decisiones del equipo, no exclusiones del enunciado):
- Un mes cerrado no se corrige dentro del sistema; solo se anota la constancia (RN-25).
- El archivo no se envía automáticamente a Becas: el coordinador de soporte lo descarga y lo entrega (ADR-0007).
- No se monta infraestructura de alta disponibilidad empresarial; basta Docker Compose con reinicio automático y respaldos (ADR-0004).

## 3.3 Núcleo ejecutable (lo que se programa en esta entrega)

| Código | Funcionalidad prioritaria | Caso de uso | Requerimientos | Medida de aceptación |
| --- | --- | --- | --- | --- |
| **FP-1** | Asignar un turno a un asistente, con todas sus reglas | CU-06 | RF-10, RF-11 | Una prueba por poscondición del contrato y una por extensión; todas pasan. |
| **FP-2** | Reservar una máquina, con todas sus reglas | CU-11 | RF-22, RF-23 | Ídem. |
| **FP-3** | Cerrar el mes, calcular el pago de cada asistente y generar el archivo para Becas | CU-14 | RF-31 a RF-33 | Ídem, más casos de cálculo: recargo nocturno, fin de semana, exceso de tope, cambio de tarifa a mitad de mes. |

Además, según el enunciado:

| Pieza | Mínimo exigido | Cómo se cumple |
| --- | --- | --- |
| Pantallas | Front-end con criterios UX/UI; no necesita base de datos. | Las tres pantallas de 3.4, con datos simulados o contra la API. |
| Clases de dominio | Invariantes verificadas en el constructor y atributos privados; nada de modelo anémico. | `Turno`, `Reserva`, `CierreMensual`, etc. con campos `#privados` y fábricas que validan. |
| Dependencias externas | Interfaces inyectadas; sin red, archivos ni reloj en el dominio. | Puertos en `08-componentes.md` (`Reloj`, repositorios, `Notificador`, `GeneradorArchivoBecas`). |
| Pruebas | Una por poscondición y una por extensión, con dobles. | Vitest con dobles escritos a mano (fakes en memoria). |
| Funciones de aptitud | Al menos dos que fallen el build, cada una con su prueba que planta una violación. | FA-1 y FA-2 en `07-arquitectura.md`. |
| README | Instalar y correr pruebas en ≤ 10 líneas. | `README.md` de la raíz. |

Fuera del núcleo ejecutable (se diseña, no se programa): todo lo demás de 3.1, incluidos el Directorio real, el correo real, el reloj programado y la persistencia en PostgreSQL. En el núcleo se sustituyen por dobles detrás de los mismos puertos.

## 3.4 Pantallas mínimas del núcleo ejecutable

| Pantalla | Usuario | Contenido mínimo | CU |
| --- | --- | --- | --- |
| Horario del laboratorio | Coordinador de laboratorio | Semana del laboratorio en cuadrícula; formulario para asignar turno (asistente, fecha, inicio, fin); mensaje claro por cada regla que falla (traslape con el turno X, tope de N h superado, asistente inactivo, fuera de disponibilidad → queda pendiente). | CU-06 |
| Reservar máquina | Estudiante | Selección de laboratorio y día; franjas abiertas; máquinas libres y fuera de servicio; formulario de reserva; mensajes por cada regla (más de 2 h, ya tiene una activa, superaría 6 h, laboratorio cerrado en esa franja). | CU-11 |
| Cierre mensual | Coordinador de soporte | Mes a cerrar; resultado por asistente (horas normales, con recargo, no pagadas y monto); horas sobre el tope destacadas; descarga del CSV. | CU-14 |

La navegación por rol, las rutas y el flujo de cada una de estas pantallas están en `15-diseno-ux-ui.md`; los prototipos y su justificación se agregarán ahí.

## 3.5 Supuestos de interpretación

Donde el enunciado es ambiguo se adopta el supuesto de la tabla para poder avanzar. **Estado: adoptados por el equipo, pendientes de validar con el profesor.** Si alguno cambia, se actualizan las reglas que lo citan.

| ID | Ambigüedad | Supuesto adoptado | Afecta |
| --- | --- | --- | --- |
| SUP-01 | "No existen turnos sin asistente", pero el coordinador consulta "turnos sin asignar" y una baja deja turnos "sin cubrir". | La invariante aplica al **crear** un turno. Si el asistente deja de estar activo, el turno pasa a **vacante** hasta que se reasigne; eso es lo que se lista como "sin asignar". | RN-04, RN-05 |
| SUP-02 | El enunciado dice que el archivo va a "Becas" y también "a Planilla". | Es el mismo receptor: Planilla de la Oficina de Becas. | RF-32 |
| SUP-03 | No se define el formato del "archivo que Becas acepta". | CSV UTF-8 separado por comas con encabezado: `mes,carne,nombre,categoria,horas_normales,horas_con_recargo,horas_no_pagadas,monto_colones`. | RF-32 |
| SUP-04 | No se define el protocolo del Directorio. | LDAP u OIDC detrás del puerto `DirectorioInstitucional`; se confirma con el Centro de Cómputo. | RF-01 |
| SUP-05 | No se define "semana" ni qué pasa con la semana que cruza dos meses. | Semana de lunes 00:00 a domingo 23:59. El exceso se calcula sobre la semana completa en orden cronológico: las primeras horas hasta el tope se pagan, las siguientes no. Cada hora se liquida en el mes en que se trabajó. | RN-07, RN-24 |
| SUP-06 | Recargo nocturno: "turnos que empiezan a las 6 p. m. o después". | Se usa la hora de inicio **programada** del turno; un turno de 16:00 a 20:00 no lleva recargo. Nocturno y fin de semana no se acumulan. | RN-23 |
| SUP-07 | Se paga "lo que estuvo de verdad": ¿y si llega antes o se queda después? | Horas trabajadas = intersección de las marcas con la franja del turno. Llegar tarde descuenta; quedarse de más no suma. | RN-12 |
| SUP-08 | Qué pasa si marca entrada y no marca salida. | El turno queda con **marca incompleta**; el coordinador lo regulariza antes del cierre. Si no se regulariza, esas horas no se pagan y el cierre las reporta. | RF-21, CU-14 |
| SUP-09 | El turno es "no cubierto" recién al terminar, pero quien reservó necesita saberlo antes. | Aviso temprano al coordinador a los 15 minutos sin entrada; el estado "no cubierto" se asigna al terminar. | RN-13 |
| SUP-10 | Una oferta tomada pero no aprobada cuando faltan menos de 24 h. | No vence mientras espera aprobación. Si al iniciar el turno no se aprobó, el turno sigue con quien lo ofreció. | RN-11 |
| SUP-11 | Al aprobar una toma, ¿se valida la disponibilidad declarada? | No: quien toma la oferta la acepta voluntariamente. Solo se revalidan actividad, traslape y tope. | RN-10 |
| SUP-12 | Qué son "los asistentes del mismo laboratorio". | Asistentes activos que tienen al menos un turno en ese laboratorio en el semestre o que lo declararon en su postulación. | RN-10 |
| SUP-13 | Cómo se registra que el estudiante "se presentó". | El estudiante confirma presentación desde su celular en el laboratorio, o lo confirma el asistente de turno. | RF-25, RN-18 |
| SUP-14 | Cómo se comprueba que el asistente marca "en la puerta del laboratorio". | Con un código del laboratorio (por ejemplo QR) detrás del puerto `VerificadorPresencia`. El mecanismo concreto será un ADR. | RF-18 |
| SUP-15 | Con cuánta anticipación se reserva y qué cuenta para las 6 h. | Hasta 7 días antes. Cuentan reservas activas, en uso, finalizadas y liberadas por no presentación; no cuentan las canceladas. | RN-16, RN-17 |
| SUP-16 | Qué es "cuánto se usaron" las máquinas. | Horas de reserva con presentación ÷ (horas con el laboratorio abierto × máquinas en servicio), por laboratorio y semana. | RF-29 |
| SUP-17 | Cambio de tarifa o recargo a mitad de mes. | Se aplica el valor vigente en la fecha del turno; el cierre guarda una copia de los valores aplicados. | RN-22, RN-23 |
| SUP-18 | Quién crea laboratorios, máquinas y asigna coordinadores. | El coordinador de soporte. | RF-02, RF-30 |
| SUP-19 | Cómo sabe el sistema que alguien es estudiante de la Escuela. | Por atributos del Directorio (carrera y condición); a confirmar con el Centro de Cómputo. | RF-01 |
| SUP-20 | Un usuario con varios roles. | Se permite (un asistente también reserva como estudiante), pero nadie aprueba una operación propia. | 2.3 |
| SUP-21 | ¿Un turno puede cruzar la medianoche? | No: inicio y fin el mismo día. | RN-05 |
| SUP-22 | ¿Puede un laboratorio tener dos turnos al mismo tiempo? | No: un responsable por franja y laboratorio. | RN-09 |
| SUP-23 | Desde cuándo se puede marcar entrada. | Desde 15 minutos antes del inicio hasta el fin del turno. | RN-12 |
| SUP-24 | Qué pasa con las reservas de un turno que queda vacante. | Se cancelan de inmediato y se avisa; si el turno se reasigna, el estudiante puede volver a reservar. | RN-19 |
| SUP-25 | Redondeo de montos. | Céntimos enteros; redondeo al céntimo por línea, mitad hacia arriba. | RN-27 |
| SUP-26 | Quién aparece en el archivo de Becas. | Todo asistente con horas trabajadas en el mes (pagadas o no pagadas). | CU-14 |
| SUP-27 | ¿Qué pasa si el día 1 el cierre automático no corre? | El coordinador de soporte puede dispararlo; como el cierre es único (RN-26), no hay riesgo de duplicarlo. | RF-31 |
| SUP-28 | ¿Qué pasa con un turno pendiente de aceptación cuando llega su hora de inicio? | Se descarta y se avisa al coordinador: un turno que nadie aceptó no abre el laboratorio. | RN-08, `10-comportamiento.md` |

## 3.6 Riesgos conocidos

| Riesgo | Impacto | Mitigación |
| --- | --- | --- |
| PostgreSQL 14 sin soporte comunitario desde noviembre de 2026 | Sin parches de seguridad nuevos | Condición del cliente; registrado en ADR-0006. |
| Protocolo del Directorio desconocido (SUP-04) | Retraso en el inicio de sesión real | Puerto con adaptador intercambiable; en el núcleo se usa un doble. |
| Formato de Becas desconocido (SUP-03) | Rechazo del archivo | Adaptador `GeneradorArchivoBecas` aislado: cambiar formato toca un solo archivo. |
| Supuestos no validados (3.5) | Retrabajo en reglas | Cada regla cita su supuesto; validar antes de cerrar la implementación. |
