# ADR-0010 · Idempotencia de las operaciones de creación por clave de solicitud

**Estado:** aceptado · 2026-11-24

## Contexto
- Entre el frontend y el backend hay una red: una respuesta puede perderse aunque la operación ya se haya hecho. Un tiempo de espera no es un "no", es un "no sé".
- Si el frontend reintenta una reserva que sí se creó, hoy el estudiante recibiría `YA_TIENE_RESERVA_ACTIVA`: un error por algo que salió bien. Lo mismo pasa con un turno reenviado.
- El material del curso pide que repetir una operación devuelva el mismo resultado, no un error, y que la clave la genere quien llama.

## Decisión
- `POST /api/v1/laboratorios/{id}/turnos` y `POST /api/v1/reservas` exigen la cabecera `Idempotency-Key`: un UUID que el frontend genera **una vez por intención del usuario** (al pulsar "Asignar" o "Reservar") y reutiliza en cada reintento.
- La clave viaja hasta el caso de uso y se guarda **con el turno o la reserva** creada. Antes de validar, el caso de uso busca si ya existe un registro con esa clave para ese usuario: si existe, lo devuelve sin crear otro (`200`); si no, sigue el flujo normal (`201`).
- Índice único `(id_usuario, clave_solicitud)` como segunda barrera ante reintentos simultáneos.
- Reutilizar una clave con datos distintos responde `422 CLAVE_DE_SOLICITUD_REUTILIZADA`.
- `POST /api/v1/cierres` no necesita cabecera: es idempotente por mes (RN-26).

## Alternativas descartadas
- **Que el frontend no reintente:** deja al usuario sin saber si su reserva existe.
- **Middleware HTTP que guarda respuestas:** resuelve el borde, pero la idempotencia quedaría fuera del componente y no se podría probar con el caso de uso.
- **Detectar duplicados por contenido (misma máquina y franja):** confunde un reintento con una segunda intención legítima.

## Consecuencias
- \+ Los reintentos son seguros: se pueden hacer automáticamente con espera creciente.
- \+ Cada extensión de "se perdió la respuesta" tiene su prueba en el caso de uso.
- − El frontend debe generar y conservar la clave por intención; si genera una nueva en cada reintento, la protección no existe.
- − Un campo y un índice más en turnos y reservas.
