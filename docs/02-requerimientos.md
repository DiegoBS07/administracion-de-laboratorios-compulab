# 2. Requerimientos

> Responde: ¿qué tiene que hacer CompuLab y bajo qué reglas?
> Los requerimientos de calidad están en `05-atributos-de-calidad.md` y las restricciones en `06-restricciones-tecnologicas.md`.
> Versión 2026-11-24.

Columna **Núcleo**: ✔ = se implementa en el núcleo ejecutable; vacío = se diseña pero no se programa en esta entrega.

## 2.1 Requerimientos funcionales

### Identidad y acceso
| ID | Requerimiento | Actor | CU | Núcleo |
| --- | --- | --- | --- | --- |
| RF-01 | Iniciar sesión con las credenciales del Directorio institucional; el sistema obtiene nombre, carné, correo y condición de estudiante. | Todos | — (subfunción) | |
| RF-02 | Asignar a un usuario el rol de coordinador de un laboratorio. | Coord. soporte | — | |

### Reclutamiento y asistentes
| ID | Requerimiento | Actor | CU | Núcleo |
| --- | --- | --- | --- | --- |
| RF-03 | Abrir y cerrar la convocatoria del semestre. | Coord. soporte | CU-01 | |
| RF-04 | Postularse indicando bloques de disponibilidad y laboratorios de interés. | Postulante | CU-02 | |
| RF-05 | Registrar la entrevista: quién la hizo, cuándo y con qué resultado. | Coord. soporte | CU-03 | |
| RF-06 | Admitir al postulante asignándole categoría y tope semanal, o rechazarlo. | Coord. soporte | CU-03 | |
| RF-07 | Corregir el tope semanal de un asistente, conservando el historial. | Coord. soporte | CU-04 | |
| RF-08 | Terminar la asistencia por renuncia o por baja; los turnos futuros quedan vacantes y se avisa. | Asistente / Coord. soporte | CU-05 | |
| RF-09 | Registrar tarifas por categoría y porcentaje de recargo con fecha de vigencia. | Coord. soporte | CU-15 | |

### Horarios y turnos
| ID | Requerimiento | Actor | CU | Núcleo |
| --- | --- | --- | --- | --- |
| RF-10 | Asignar un turno a un asistente validando RN-04 a RN-09. | Coord. laboratorio (su lab) / Coord. soporte (todos) | CU-06 | ✔ |
| RF-11 | Consultar el horario semanal de un laboratorio. | Coord. laboratorio / Coord. soporte / Asistente | CU-06 (apoyo) | ✔ |
| RF-12 | Reasignar o eliminar un turno futuro, con las mismas validaciones que al asignar. | Coord. laboratorio / Coord. soporte | CU-06 (variante) | |
| RF-13 | Aceptar o rechazar un turno asignado fuera de la disponibilidad declarada. | Asistente | CU-06 (ext 4c) | |
| RF-14 | Ofrecer un turno propio y retirar la oferta mientras nadie la haya tomado. | Asistente | CU-07 | |
| RF-15 | Tomar una oferta de un asistente del mismo laboratorio. | Asistente | CU-08 | |
| RF-16 | Aprobar o rechazar la toma de una oferta, revalidando traslape y tope. | Coord. laboratorio | CU-09 | |
| RF-17 | Vencer automáticamente las ofertas no tomadas 24 h antes del turno. | Reloj | — (regla RN-11) | |

### Asistencia
| ID | Requerimiento | Actor | CU | Núcleo |
| --- | --- | --- | --- | --- |
| RF-18 | Marcar entrada y salida del turno desde el celular, en el laboratorio. | Asistente | CU-10 | |
| RF-19 | Marcar como no cubierto el turno que termina sin entrada, y avisar al coordinador y a los estudiantes con reserva. | Reloj | — (regla RN-13) | |
| RF-20 | Consultar, para una semana, los turnos vacantes y los no cubiertos. | Coord. laboratorio / Coord. soporte | CU-16 | |
| RF-21 | Regularizar una marca incompleta (entrada sin salida) antes del cierre. | Coord. laboratorio | CU-10 (variante) | |

### Máquinas y reservas
| ID | Requerimiento | Actor | CU | Núcleo |
| --- | --- | --- | --- | --- |
| RF-22 | Consultar las franjas en que un laboratorio estará abierto y las máquinas libres. | Estudiante | CU-11 (apoyo) | ✔ |
| RF-23 | Reservar una máquina validando RN-15 a RN-17 y RN-20. | Estudiante | CU-11 | ✔ |
| RF-24 | Cancelar una reserva propia. | Estudiante | CU-11 (variante) | |
| RF-25 | Confirmar la presentación al llegar a la máquina. | Estudiante | CU-11 (variante) | |
| RF-26 | Liberar automáticamente la reserva sin presentación a los 15 minutos. | Reloj | — (regla RN-18) | |
| RF-27 | Marcar una máquina fuera de servicio, cancelar sus reservas futuras y avisar a los afectados. | Asistente de turno / Coordinadores | CU-12 | |
| RF-28 | Registrar que una máquina fue reparada. | Asistente / Coordinadores | CU-13 | |
| RF-29 | Consultar por laboratorio y semana las máquinas fuera de servicio y el uso de las demás. | Coord. soporte (todos) / Coord. laboratorio (el suyo) | CU-17 | |
| RF-30 | Mantener el catálogo de laboratorios y máquinas (identificador y laboratorio). | Coord. soporte | — | |

### Liquidación
| ID | Requerimiento | Actor | CU | Núcleo |
| --- | --- | --- | --- | --- |
| RF-31 | Cerrar el mes anterior el día 1: horas efectivas y monto por asistente. | Reloj (o Coord. soporte si no corrió) | CU-14 | ✔ |
| RF-32 | Generar el archivo CSV para Becas/Planilla y permitir descargarlo. | Reloj / Coord. soporte | CU-14 | ✔ |
| RF-33 | Informar al coordinador de soporte las horas trabajadas por encima del tope, que no se pagan. | Reloj | CU-14 | ✔ |
| RF-34 | Registrar una constancia de corrección sobre un mes cerrado, sin recalcularlo. | Coord. soporte | — | |

### Notificaciones
| ID | Requerimiento | Actor | CU | Núcleo |
| --- | --- | --- | --- | --- |
| RF-35 | Avisar en la aplicación y por correo los eventos de la tabla 2.4. | Sistema → destinatarios | varios | Parcial: en el núcleo se registra el aviso a través del puerto `Notificador` (doble de prueba) |

## 2.2 Reglas de negocio

### Reclutamiento y asistentes
- **RN-01** Hay una convocatoria por semestre; solo se aceptan postulaciones mientras está abierta. Un estudiante tiene como máximo una postulación por convocatoria.
- **RN-02** Una postulación indica al menos un bloque de disponibilidad y al menos un laboratorio.
- **RN-03** Admitir exige asignar una de las dos categorías y un tope semanal mayor que cero. Un rechazado puede postularse el semestre siguiente sin impedimento.
- **RN-04** Un asistente está activo desde su admisión hasta el fin del semestre, salvo que renuncie o lo den de baja. A un asistente no activo no se le asignan turnos. Al dejar de estar activo, sus turnos futuros quedan **vacantes** y se avisa a los coordinadores de los laboratorios afectados y al coordinador de soporte.

### Horarios y turnos
- **RN-05** Un turno tiene un laboratorio, una fecha dentro del semestre, una hora de inicio menor que la hora de fin (el mismo día, SUP-21) y **exactamente un** asistente responsable. No hay turnos compartidos.
- **RN-06** Un asistente no puede tener dos turnos que se traslapen, aunque sean de laboratorios o campus distintos. Dos franjas se traslapan si comparten algún instante con duración mayor que cero (un turno que termina a las 10:00 no traslapa con uno que empieza a las 10:00).
- **RN-07** En ninguna semana la suma de horas programadas de los turnos de un asistente puede superar su tope semanal vigente. Se cuentan todos sus turnos de esa semana salvo los vacantes y los rechazados.
- **RN-08** La franja de un turno debe quedar completamente dentro de un bloque de disponibilidad declarado para ese día de la semana (los bloques contiguos del mismo día cuentan como uno solo). Si no, el turno queda **pendiente de aceptación** del asistente; si lo rechaza, el turno se descarta.
- **RN-09** Un laboratorio no tiene dos turnos que se traslapen: en cada franja hay un solo responsable (SUP-22).
- **RN-10** Una oferta solo la ven los asistentes activos del mismo laboratorio. El primero que la toma queda como candidato; el coordinador de laboratorio aprueba o rechaza sin dar razón. Al aprobar se vuelven a verificar RN-04, RN-06 y RN-07 sobre quien la toma; si alguna falla, no se puede aprobar.
- **RN-11** Una oferta no tomada vence 24 horas antes del inicio del turno y el turno vuelve a ser responsabilidad de quien lo ofreció. Quien ofreció puede retirarla mientras nadie la haya tomado. Una oferta tomada y pendiente de aprobación no vence (SUP-10).

### Asistencia
- **RN-12** El asistente marca entrada desde 15 minutos antes del inicio hasta el fin del turno, y salida después de la entrada (SUP-23). Las horas trabajadas de un turno son la intersección entre [entrada, salida] y [inicio, fin] del turno (SUP-07).
- **RN-13** Si un turno termina sin marca de entrada queda **no cubierto** y se avisa al coordinador del laboratorio. A los 15 minutos del inicio sin entrada se envía un aviso temprano (SUP-09).
- **RN-14** Un laboratorio está **abierto** mientras hay un turno en curso con entrada marcada; si no, está cerrado.

### Máquinas y reservas
- **RN-15** Solo se reserva dentro de una franja completamente cubierta por turnos asignados o en curso del laboratorio de la máquina (pueden ser turnos contiguos de asistentes distintos). No cuentan los turnos pendientes de aceptación, vacantes ni descartados.
- **RN-16** Una reserva dura como máximo 2 horas, su inicio es menor que su fin, empieza en el futuro y se hace con no más de 7 días de anticipación (SUP-15).
- **RN-17** Un estudiante tiene como máximo **una** reserva activa a la vez y como máximo **6 horas** reservadas por semana. Para las 6 horas cuentan las reservas activas, en uso, finalizadas y liberadas por no presentación; no cuentan las canceladas.
- **RN-18** Si el estudiante no confirma su presentación dentro de los primeros 15 minutos, la reserva se libera sola y la máquina queda disponible.
- **RN-19** Si un turno queda vacante o no cubierto, las reservas de esa franja se cancelan y se avisa a cada estudiante (SUP-24).
- **RN-20** Una máquina fuera de servicio no se puede reservar. Al marcarla fuera de servicio se cancelan sus reservas futuras y se avisa a los afectados. Vuelve a estar disponible cuando un asistente o coordinador registra la reparación.

### Liquidación
- **RN-21** El día 1 de cada mes se cierra el mes anterior con las horas trabajadas según las marcas (RN-12).
- **RN-22** La tarifa base de cada hora es la de la categoría del asistente, vigente en la fecha del turno.
- **RN-23** Las horas de turnos que **empiezan** a las 18:00 o después, y las de turnos en sábado o domingo, se pagan con recargo. El recargo no se acumula (un turno de sábado a las 19:00 lleva un solo recargo). El porcentaje es el vigente en la fecha del turno.
- **RN-24** Las horas trabajadas por encima del tope semanal no se pagan: quedan registradas como no pagadas y se informan al coordinador de soporte. El exceso se determina recorriendo la semana en orden cronológico (SUP-05).
- **RN-25** Un mes cerrado no se recalcula ni se corrige. Los errores se arreglan fuera del sistema y se deja una constancia.
- **RN-26** El cierre de un mes se hace una sola vez: si se intenta de nuevo, el sistema devuelve el cierre existente.
- **RN-27** Los montos se calculan en colones con céntimos enteros (sin decimales flotantes); cada línea se redondea al céntimo, mitad hacia arriba (SUP-25).

## 2.3 Permisos por rol

Leyenda: ✔ permitido · L = solo su laboratorio · P = solo lo propio · — no aplica / no permitido

| Acción | Estudiante | Postulante | Asistente | Coord. lab | Coord. soporte |
| --- | --- | --- | --- | --- | --- |
| Postularse | — | ✔ | — | — | — |
| Abrir convocatoria, entrevistar, admitir o rechazar | — | — | — | — | ✔ |
| Corregir tope, dar de baja | — | — | — | — | ✔ |
| Renunciar | — | — | P | — | — |
| Configurar tarifas y recargo | — | — | — | — | ✔ |
| Ver horario | franjas abiertas | — | sus labs | L | ✔ |
| Asignar, reasignar o eliminar turnos | — | — | — | L | ✔ |
| Aceptar turno fuera de disponibilidad | — | — | P | — | — |
| Ofrecer o retirar oferta | — | — | P | — | — |
| Tomar oferta | — | — | mismo lab | — | — |
| Aprobar o rechazar toma de oferta | — | — | — | L | ✔ |
| Marcar entrada y salida | — | — | P | — | — |
| Regularizar marca incompleta | — | — | — | L | ✔ |
| Consultar turnos vacantes y no cubiertos | — | — | — | L | ✔ |
| Reservar, cancelar, confirmar presentación | ✔ | — | ✔ (como estudiante) | — | — |
| Marcar máquina fuera de servicio | — | — | lab de su turno en curso | L | ✔ |
| Registrar reparación | — | — | lab de su turno en curso | L | ✔ |
| Ver métricas de máquinas | — | — | — | L | ✔ |
| Cerrar mes, descargar archivo, registrar constancia | — | — | — | — | ✔ |
| Administrar laboratorios, máquinas y coordinadores | — | — | — | — | ✔ |

La autorización se verifica en el backend en cada operación, no solo ocultando botones en la interfaz.

## 2.4 Avisos que el sistema debe enviar

| Evento | Destinatarios | Regla |
| --- | --- | --- |
| Turno asignado fuera de disponibilidad | Asistente | RN-08 |
| Turnos que quedan vacantes por renuncia o baja | Coordinadores de los labs afectados, coordinador de soporte | RN-04 |
| Oferta tomada, pendiente de aprobación | Coordinador del laboratorio | RN-10 |
| Toma aprobada o rechazada | Quien ofreció y quien tomó | RN-10 |
| Oferta vencida | Quien ofreció | RN-11 |
| Turno sin entrada a los 15 minutos | Coordinador del laboratorio | RN-13 |
| Turno no cubierto | Coordinador del laboratorio | RN-13 |
| Reserva cancelada (turno caído o máquina dañada) | Estudiante | RN-19, RN-20 |
| Reserva liberada por no presentación | Estudiante | RN-18 |
| Horas sobre el tope en el cierre | Coordinador de soporte | RN-24 |
| Cierre mensual listo | Coordinador de soporte | RN-21 |

## 2.5 Requerimientos no funcionales

Se expresan como escenarios de calidad medibles en `05-atributos-de-calidad.md` (QA-1 a QA-9) y como restricciones en `06-restricciones-tecnologicas.md` (R-1 a R-10).
