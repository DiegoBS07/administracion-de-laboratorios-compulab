# ADR-0011 · Fallar cerrado para nuevos inicios de sesión si el Directorio no responde

**Estado:** aceptado · 2026-11-24 · complementa ADR-0008

## Contexto
- QA-9: el Directorio institucional es un sistema ajeno; en matrícula puede estar lento o caído.
- QA-7: nadie debe operar en CompuLab sin una identidad verificada.
- Compromiso C-1 (`05-atributos-de-calidad.md`): continuidad del servicio frente a control de acceso. Es una decisión de negocio; el equipo propone y la Coordinación de Soporte la valida.

## Decisión
- El adaptador `DirectorioInstitucional` espera como máximo **3 segundos**. Ante un error transitorio hace **un** reintento con espera aleatoria de 200–500 ms.
- Tras **5 fallos consecutivos** se abre un interruptor durante **30 segundos**: los inicios de sesión fallan al instante con `DIRECTORIO_NO_DISPONIBLE` y un mensaje claro, sin esperar el tiempo límite.
- **Nuevos inicios de sesión: fallar cerrado.** No se autentica a nadie sin el Directorio.
- **Sesiones ya abiertas: continúan.** La sesión de CompuLab dura 8 horas y no consulta el Directorio en cada petición (ADR-0008).

## Alternativas descartadas
- **Continuidad controlada** (aceptar credenciales recordadas de un inicio anterior): mantiene el servicio, pero obliga a guardar secretos y abre una vía de acceso sin verificar.
- **Esperar al Directorio sin límite:** una caída del tercero agota las conexiones del backend y tumba también a quienes ya tenían sesión.

## Consecuencias
- \+ Nunca entra alguien sin identidad verificada.
- \+ Una caída del Directorio no afecta a quien ya está trabajando (asistentes de turno, coordinadores).
- − Durante una caída, quien no tenía sesión no puede reservar; se acepta porque la caída del Directorio afecta igual al resto de sistemas del TEC.
- − Los valores (3 s, 5 fallos, 30 s, 8 h) son sensibilidades: se ajustan con mediciones reales.
