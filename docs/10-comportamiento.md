# 10. Comportamiento

> Responde: ¿qué objetos colaboran para cumplir cada caso de uso, en qué orden, y qué estados recorren las entidades?
> Es la realización de los casos de uso: cada mensaje se rastrea a un paso del escenario o a una extensión de `04-casos-de-uso.md`. Un mensaje que no se puede rastrear sobra, o el escenario está incompleto.
> Versión 2026-11-24. Completo para el núcleo ejecutable (CU-06, CU-11, CU-14); el resto se completará.

## 10.1 Quién recibe cada evento del sistema

Un controlador por caso de uso (patrón Controlador de GRASP): una clase de la capa de aplicación con un único método público `ejecutar()`. Coordina; las reglas viven en el dominio.

| Evento del sistema | Controlador (aplicación) | Dependencias por constructor | Objetos de dominio que tienen las reglas |
| --- | --- | --- | --- |
| `asignarTurno` (CU-06) | `AsignarTurno` | `Autorizacion`, `CalendarioAcademico`, `ConsultaAsistentes`, `RepositorioTurnos`, `UnidadDeTrabajo`, `Notificador`, `Reloj` | `Franja`, `Turno`, `AgendaDelAsistente`, `AgendaDelLaboratorio` |
| `reservarMaquina` (CU-11) | `ReservarMaquina` | `RepositorioMaquinas`, `RepositorioReservas`, `CoberturaDeLaboratorio`, `UnidadDeTrabajo`, `Reloj` | `Franja`, `Reserva`, `Maquina`, `AgendaDeLaMaquina`, `CupoSemanalDelEstudiante` |
| `cerrarMes` (CU-14) | `CerrarMes` | `RepositorioCierres`, `HorasTrabajadas`, `DatosDeAsistentes`, `TablaTarifas`, `GeneradorArchivoBecas`, `Notificador`, `Reloj` | `MesDeLiquidacion`, `TarifasDelPeriodo`, `LiquidacionDelAsistente`, `LineaDeLiquidacion`, `CierreMensual` |

`AsignarTurno` y `CerrarMes` tienen siete dependencias, por encima de las cinco que el material marca como señal de alerta. Se revisó: `UnidadDeTrabajo`, `Notificador` y `Reloj` son técnicas y comunes a todo caso de uso que cambia estado; las otras cuatro son las que el caso de uso necesita. No se parten en dos casos de uso porque el actor tiene un solo objetivo.

## 10.2 CU-06 · Asignar un turno

```mermaid
---
title: CU-06 · Colaboración interna (realización) · 2026-11-24
---
sequenceDiagram
    actor CL as Coord. laboratorio
    participant API as RutaTurnos
    participant UC as AsignarTurno
    participant AUT as Autorizacion
    participant CAL as CalendarioAcademico
    participant CA as ConsultaAsistentes
    participant UT as UnidadDeTrabajo
    participant RT as RepositorioTurnos
    participant AA as AgendaDelAsistente
    participant AL as AgendaDelLaboratorio
    participant T as Turno
    participant N as Notificador

    CL->>API: POST /laboratorios/{id}/turnos + Idempotency-Key
    API->>UC: ejecutar(usuario, solicitud)
    Note over UC: paso 1
    UC->>AUT: puedeModificarHorario(usuario, idLab)
    AUT-->>UC: falso → SinPermisoSobreLaboratorio (ext 2a)
    Note over UC: paso 2
    UC->>UC: Franja.delTurno(fecha, inicio, fin) → FranjaDeTurnoInvalida (ext 3a)
    UC->>CAL: semestreVigente() → FueraDelSemestre (ext 3b)
    UC->>UC: reloj.ahora() ≥ inicio → TurnoEnElPasado (ext 3c)
    UC->>CA: obtener(idAsistente)
    CA-->>UC: asistente (activo, tope, disponibilidad)
    Note over UC: paso 3
    UC->>UT: ejecutar(trabajo)
    activate UT
    UC->>RT: porClaveDeSolicitud(usuario, clave)
    RT-->>UC: turno existente → se devuelve sin cambios (ext 5b)
    UC->>RT: bloquearAgendaDe(idAsistente)
    Note right of RT: ADR-0009 (ext 5a)
    UC->>RT: delAsistenteEntre(semana)
    UC->>AA: AgendaDelAsistente.de(asistente, turnosSemana)
    UC->>AA: evaluar(franja)
    AA-->>UC: AsistenteNoActivo (3d) · TraslapeDeTurno (4a) · TopeSemanalExcedido (4c) · o {dentroDeDisponibilidad}
    UC->>RT: delLaboratorioEntre(día)
    UC->>AL: verificarLibre(franja) → FranjaOcupadaEnLaboratorio (ext 4b)
    Note over UC: paso 4
    UC->>T: Turno.asignar(id, lab, asistente, franja, dentroDeDisponibilidad, clave)
    T-->>UC: t (ASIGNADO o PENDIENTE_ACEPTACION, ext 4d) · P1–P5, P7
    UC->>RT: guardar(t)
    Note over UC: paso 5
    opt t.estado = PENDIENTE_ACEPTACION
        UC->>N: avisar(asistente, TURNO_PENDIENTE_ACEPTACION) · P6
    end
    deactivate UT
    UC-->>API: TurnoAsignadoDTO
    Note over UC: paso 6
    API-->>CL: 201 (o 200 en reenvío)
```

| Mensaje | Paso / extensión | Poscondición o invariante |
| --- | --- | --- |
| `puedeModificarHorario` | 2 · ext 2a | — |
| `Franja.delTurno`, `semestreVigente`, `reloj.ahora` | 3 · ext 3a, 3b, 3c | — |
| `obtener(idAsistente)` y `AgendaDelAsistente.evaluar` | 3 y 4 · ext 3d, 4a, 4c | I1, I2 |
| `porClaveDeSolicitud` | ext 5b | I5 |
| `bloquearAgendaDe` | ext 5a | I1, I2 bajo concurrencia |
| `AgendaDelLaboratorio.verificarLibre` | 4 · ext 4b | I3 |
| `Turno.asignar` | 5 · ext 4d | P1–P5, P7, I4 |
| `guardar` | 5 | P1 (persistido) |
| `avisar` | ext 4d | P6 |
| `TurnoAsignadoDTO` | 6 | — |

Dónde vive cada regla: traslape y tope en `AgendaDelAsistente` (es quien conoce todos los turnos del asistente en la semana); franja ocupada en `AgendaDelLaboratorio`; forma válida del turno (un responsable, inicio < fin, mismo día) en el constructor de `Turno`. `AsignarTurno` solo coordina.

## 10.3 CU-11 · Reservar una máquina

```mermaid
---
title: CU-11 · Colaboración interna (realización) · 2026-11-24
---
sequenceDiagram
    actor E as Estudiante
    participant API as RutaReservas
    participant UC as ReservarMaquina
    participant UT as UnidadDeTrabajo
    participant RR as RepositorioReservas
    participant RM as RepositorioMaquinas
    participant M as Maquina
    participant CO as CoberturaDeLaboratorio
    participant R as Reserva
    participant AM as AgendaDeLaMaquina
    participant CU as CupoSemanalDelEstudiante

    E->>API: POST /reservas + Idempotency-Key
    API->>UC: ejecutar(usuario, solicitud)
    Note over UC: paso 3
    UC->>UT: ejecutar(trabajo)
    activate UT
    UC->>RR: porClaveDeSolicitud(estudiante, clave)
    RR-->>UC: reserva existente → se devuelve sin cambios (ext 7b)
    UC->>R: Reserva.crear(id, estudiante, máquina, franja, ahora, clave)
    R-->>UC: FranjaDeReservaInvalida (4a) · FueraDeHorizonteDeReserva (4b) · ReservaExcedeDuracion (4c) · o r
    Note over UC: paso 4
    UC->>RM: porId(idMaquina)
    RM-->>UC: máquina
    UC->>CO: franjasAbiertas(lab, inicio, fin)
    UC->>R: estaCubiertaPor(franjas) → LaboratorioCerradoEnFranja (ext 4d)
    UC->>M: verificarReservable() → MaquinaFueraDeServicio (ext 5a)
    UC->>RR: deMaquinaEntre(inicio, fin)
    UC->>AM: verificarLibre(r) → MaquinaNoDisponible (ext 5b)
    Note over UC: paso 5
    UC->>RR: delEstudianteEnSemana(semana)
    UC->>CU: verificarQueAdmite(r) → YaTieneReservaActiva (6a) · LimiteSemanalDeReservaExcedido (6b)
    Note over UC: paso 6
    UC->>RR: guardar(r)
    RR-->>UC: restricción de la base → MaquinaNoDisponible (7a) · YaTieneReservaActiva (7c)
    Note over UC: paso 7
    deactivate UT
    UC-->>API: ReservaDTO (limitePresentacion)
    Note over UC: paso 8
    API-->>E: 201 (o 200 en reenvío)
```

| Mensaje | Paso / extensión | Poscondición o invariante |
| --- | --- | --- |
| `porClaveDeSolicitud` | ext 7b | I5 |
| `Reserva.crear` | 4 · ext 4a, 4b, 4c | P1–P7; I4 (duración) |
| `franjasAbiertas` + `estaCubiertaPor` | 4 · ext 4d | I4 (cobertura) |
| `Maquina.verificarReservable` | 5 · ext 5a | — |
| `AgendaDeLaMaquina.verificarLibre` | 5 · ext 5b | I1 |
| `CupoSemanalDelEstudiante.verificarQueAdmite` | 6 · ext 6a, 6b | I2, I3 |
| `guardar` | 7 · ext 7a, 7c | I1, I2 bajo concurrencia |
| `ReservaDTO` | 8 | — |

Los pasos 1 y 2 del escenario (consultar disponibilidad) son otra operación del sistema, `ConsultarDisponibilidad`, sin cambio de estado.

## 10.4 CU-14 · Cerrar el mes

```mermaid
---
title: CU-14 · Colaboración interna (realización) · 2026-11-24
---
sequenceDiagram
    actor R as Reloj (tarea cerrar-mes)
    participant UC as CerrarMes
    participant RC as RepositorioCierres
    participant HT as HorasTrabajadas
    participant DA as DatosDeAsistentes
    participant TT as TablaTarifas
    participant L as LiquidacionDelAsistente
    participant C as CierreMensual
    participant G as GeneradorArchivoBecas
    participant N as Notificador

    R->>UC: ejecutar(anio, mes)
    Note over UC: paso 1
    UC->>UC: MesDeLiquidacion(anio, mes).terminoAntesDe(reloj.ahora()) → MesNoTerminado (ext 2b)
    UC->>RC: porMes(anio, mes)
    RC-->>UC: cierre existente → se devuelve sin cambios (ext 2a)
    Note over UC: paso 2
    UC->>HT: delPeriodo(lunes de la 1.ª semana, fin de mes)
    UC->>DA: obtener(idAsistente) por cada asistente con turnos
    UC->>TT: vigenciasEntre(inicio, fin)
    UC->>UC: TarifasDelPeriodo(vigencias) → TarifaNoDefinida (ext 5b)
    Note over UC: paso 3
    loop cada asistente con horas en el mes (ext 3a)
        UC->>L: calcular(turnos, topes, tarifasDelPeriodo, mes)
        L-->>UC: LineaDeLiquidacion · ext 3b, 3c, 4a, 4b, 5a, 5c
    end
    Note over UC: pasos 4 y 5
    UC->>C: CierreMensual.cerrar(mes, líneas, tarifas aplicadas, ahora)
    C-->>UC: c (CERRADO) · P1–P5, P7
    Note over UC: paso 6
    UC->>G: generar(c) → ErrorAlGenerarArchivo (ext 7a)
    UC->>C: adjuntarArchivo(archivo) · P6
    UC->>RC: guardar(c)
    RC-->>UC: CierreYaExiste → se devuelve el existente (ext 2c)
    Note over UC: paso 7
    UC->>N: avisar(coord. soporte, CIERRE_LISTO, horas sobre tope) · P8
    Note over UC: paso 8
    UC-->>R: ResumenDeCierreDTO
```

| Mensaje | Paso / extensión | Poscondición o invariante |
| --- | --- | --- |
| `MesDeLiquidacion.terminoAntesDe` | 2 · ext 2b | — |
| `porMes` | 2 · ext 2a | I1 |
| `delPeriodo`, `obtener`, `vigenciasEntre` | 3 | — |
| `TarifasDelPeriodo` | ext 5b, 5c | — |
| `LiquidacionDelAsistente.calcular` | 3, 4, 5 · ext 3a–3c, 4a, 4b, 5a | P3, P4, I4 |
| `CierreMensual.cerrar` | 6 | P1, P2, P5, P7, I2, I3 |
| `generar` + `adjuntarArchivo` | 7 · ext 7a | P6 |
| `guardar` | 6 · ext 2c | I1 (todo o nada) |
| `avisar` | 8 | P8 |

El archivo se genera **antes** de guardar para que el cierre quede completo o no quede (garantía mínima), y el aviso va **de último** porque es lo único que no se puede deshacer. El cálculo no aparece como mensajes sueltos: ocurre dentro de `LiquidacionDelAsistente`, que tiene los datos.

## 10.5 Máquinas de estado

### Turno

```mermaid
---
title: Turno · Máquina de estados · 2026-11-24
---
stateDiagram-v2
    [*] --> ASIGNADO: asignar (dentro de disponibilidad)
    [*] --> PENDIENTE_ACEPTACION: asignar (fuera de disponibilidad)
    PENDIENTE_ACEPTACION --> ASIGNADO: el asistente acepta (revalida RN-06, RN-07)
    PENDIENTE_ACEPTACION --> DESCARTADO: el asistente rechaza o llega el inicio (SUP-28)
    ASIGNADO --> VACANTE: el asistente deja de estar activo (RN-04)
    VACANTE --> ASIGNADO: el coordinador lo reasigna
    ASIGNADO --> EN_CURSO: marca de entrada (RN-12)
    ASIGNADO --> NO_CUBIERTO: termina sin entrada (RN-13)
    EN_CURSO --> CUBIERTO: marca de salida
    EN_CURSO --> MARCA_INCOMPLETA: termina sin salida (SUP-08)
    MARCA_INCOMPLETA --> CUBIERTO: el coordinador regulariza (RF-21)
    DESCARTADO --> [*]
    NO_CUBIERTO --> [*]
    CUBIERTO --> [*]
```

Leyenda: rectángulo = estado; flecha = transición con el evento que la dispara. Cuentan para traslape y tope (RN-06, RN-07, RN-09): `PENDIENTE_ACEPTACION`, `ASIGNADO`, `EN_CURSO`. Abren el laboratorio para reservas (RN-15): `ASIGNADO` y `EN_CURSO`. Un cambio de responsable aprobado (CU-09) no cambia el estado, solo el asistente.

### Reserva

```mermaid
---
title: Reserva · Máquina de estados · 2026-11-24
---
stateDiagram-v2
    [*] --> ACTIVA: reservar (CU-11)
    ACTIVA --> EN_USO: el estudiante confirma presentación (RF-25)
    ACTIVA --> LIBERADA: 15 min sin presentación (RN-18)
    ACTIVA --> CANCELADA_POR_ESTUDIANTE: el estudiante cancela (RF-24)
    ACTIVA --> CANCELADA_POR_SISTEMA: máquina dañada o turno caído (RN-19, RN-20)
    EN_USO --> FINALIZADA: llega el fin de la reserva
    LIBERADA --> [*]
    CANCELADA_POR_ESTUDIANTE --> [*]
    CANCELADA_POR_SISTEMA --> [*]
    FINALIZADA --> [*]
```

Leyenda: igual que la anterior. Una reserva es "activa" para RN-17 en `ACTIVA` o `EN_USO`. Para las 6 h semanales cuentan `ACTIVA`, `EN_USO`, `FINALIZADA` y `LIBERADA` (SUP-15).
