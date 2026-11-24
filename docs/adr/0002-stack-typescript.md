# ADR-0002 · TypeScript en backend y frontend

**Estado:** aceptado · 2026-11-24

## Contexto
- La Escuela no eligió lenguaje; exige código abierto (R-4) y contenedores Linux (R-1).
- El núcleo ejecutable exige interfaces inyectadas (`Protocol` o clase abstracta), atributos privados e invariantes en el constructor (R-5, R-7).
- El frontend es web y debe verse bien en el celular (QA-8).

## Decisión
- **Backend:** Node.js 24 LTS + TypeScript, con Fastify para HTTP, `pg` + Kysely para SQL, Vitest para pruebas y dependency-cruiser para las funciones de aptitud.
- **Frontend:** React + TypeScript, compilado con Vite y servido por Nginx.
- Las interfaces de TypeScript cumplen el papel de `Protocol` (tipado estructural); los atributos privados usan campos `#privados` de ECMAScript.

## Alternativas descartadas
- **Python + FastAPI** (lenguaje de los ejemplos del curso): válido, pero obliga a dos lenguajes en el equipo (Python y TypeScript en el frontend) y dos cadenas de herramientas.
- **Java + Spring:** más ceremonia y un arranque más pesado para un sistema de este tamaño.
- **NestJS:** sus decoradores tienden a meterse en las clases de dominio y contradicen R-6; Fastify mantiene el framework en la infraestructura.
- **Prisma:** trae su propio sistema de migraciones y su modelo, que chocan con Flyway como único dueño del esquema.

## Consecuencias
- \+ Un solo lenguaje y los mismos tipos de datos de la API en el frontend y el backend.
- \+ Las interfaces se reemplazan por dobles sin librerías de mocks.
- − Node.js es de un solo hilo: una tarea pesada bloquearía la API. Se acepta porque el cierre mensual procesa poco volumen (ADR-0003).
- − Los ejemplos del curso están en Python; hay que traducir los patrones.
