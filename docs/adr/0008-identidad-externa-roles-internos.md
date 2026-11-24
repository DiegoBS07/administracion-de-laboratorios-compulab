# ADR-0008 · Identidad del Directorio, roles dentro de CompuLab

**Estado:** aceptado · 2026-11-24

## Contexto
- El Directorio institucional dice quién es quién al iniciar sesión (RF-01), pero no sabe quién coordina qué laboratorio ni quién es asistente este semestre.
- QA-3: si el Directorio está lento en matrícula, CompuLab no debería degradarse.
- QA-7: la autorización se verifica en el backend.
- El protocolo del Directorio está por confirmar (SUP-04).

## Decisión
- El backend autentica contra el Directorio a través del puerto `DirectorioInstitucional` (adaptador LDAP u OIDC) con tiempo de espera.
- Tras autenticar, el backend emite **su propia sesión** (cookie `httpOnly`) y no vuelve a consultar el Directorio en cada petición.
- Los **roles** (coordinador de soporte, coordinador de un laboratorio, asistente activo) se guardan y administran en CompuLab.

## Alternativas descartadas
- **Leer roles del Directorio:** el Directorio no tiene esa información y no la administra la Escuela.
- **Intermediario de identidad (Keycloak):** útil si varias aplicaciones comparten inicio de sesión; aquí es un contenedor más sin necesidad.
- **Consultar el Directorio en cada petición:** acopla la disponibilidad de CompuLab a la del Directorio (incumple QA-3).

## Consecuencias
- \+ Si el Directorio falla, quien ya tiene sesión sigue trabajando.
- \+ Cambiar de LDAP a OIDC toca solo el adaptador.
- − Hay que administrar en CompuLab la asignación de coordinadores (RF-02).
- − Una persona dada de baja en el Directorio conserva su sesión hasta que expire; se mitiga con sesiones de duración limitada.
