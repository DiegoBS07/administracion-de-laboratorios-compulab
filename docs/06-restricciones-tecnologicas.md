# 6. Restricciones tecnológicas

> Responde: ¿qué está decidido de antemano y no se discute?
> Versión 2026-11-24.

## 6.1 Restricciones del cliente (no negociables)

| ID | Restricción | Origen | Consecuencia en el diseño |
| --- | --- | --- | --- |
| R-1 | Se despliega en la infraestructura del TEC: **contenedores Linux**. | Enunciado | Todo se empaqueta con Docker y se levanta con `docker-compose.yml`. |
| R-2 | Base de datos **PostgreSQL 14**. | Enunciado | Imagen `postgres:14` fijada. PostgreSQL 14 dejó de tener soporte comunitario en noviembre de 2026; se acepta como riesgo (ADR-0006). |
| R-3 | **Sin nube externa** (no hay presupuesto). | Enunciado | No se usan servicios SaaS: correo, identidad y archivos se resuelven con servicios del TEC o propios. |
| R-4 | **Sin licencias:** todo debe ser de código abierto. | Enunciado | Solo herramientas open source (tabla 6.3). |

## 6.2 Restricciones del curso para el núcleo ejecutable

| ID | Restricción | Consecuencia en el diseño |
| --- | --- | --- |
| R-5 | Las dependencias externas se declaran como interfaces (`Protocol` o clase abstracta) y se inyectan. | En TypeScript: `interface` (tipado estructural, equivalente a `Protocol`) inyectada por constructor. |
| R-6 | Ningún acceso real a red, archivos o reloj dentro del dominio. | Puerto `Reloj`; el dominio nunca llama a `new Date()`, `fetch` ni `fs`. |
| R-7 | Clases de dominio con invariantes verificadas en el constructor y atributos privados; sin modelo anémico. | Campos `#privados`, constructor privado y fábrica estática que valida y lanza errores de dominio. |
| R-8 | Al menos una prueba por poscondición de los tres contratos y una por extensión, con dobles, sin base de datos. | Vitest con dobles en memoria; ver "Pruebas que se derivan" en `04-casos-de-uso.md`. |
| R-9 | Al menos dos funciones de aptitud que fallen el build, cada una con una prueba que planta una violación. | FA-1 y FA-2 con dependency-cruiser (`07-arquitectura.md`). |
| R-10 | README con instalación y ejecución de pruebas en ≤ 10 líneas. | `README.md` de la raíz. |

## 6.3 Tecnologías elegidas por el equipo

La Escuela no eligió lenguaje ni framework. La elección y sus alternativas están en ADR-0002.

| Pieza | Tecnología | Licencia | Cumple |
| --- | --- | --- | --- |
| Contenedores | Docker Engine + Docker Compose | Apache 2.0 | R-1, R-4 |
| Base de datos | PostgreSQL 14 | PostgreSQL License | R-2, R-4 |
| Migraciones | Flyway Community 11 (`database/migrations`) | Apache 2.0 | R-4 |
| Backend | Node.js 24 LTS + TypeScript 6 | MIT / Apache 2.0 | R-4, R-5 a R-7 |
| Servidor HTTP del backend | Fastify 5 (versión fijada 5.12.8, con su bitácora pino) | MIT | R-4 |
| Acceso a datos | `pg` 8.23 + Kysely 0.28 (SQL tipado, sin migraciones propias: el esquema lo aplica Flyway) | MIT | R-4 |
| Tareas programadas | node-cron, dentro del backend | ISC | R-4 (ADR-0003) |
| Correo | Nodemailer sobre el SMTP institucional | MIT-0 | R-3, R-4 |
| Bitácora (logs estructurados) | pino | MIT | R-4 |
| Pruebas | Vitest | MIT | R-8 |
| Funciones de aptitud | dependency-cruiser | MIT | R-9 |
| Frontend | React + TypeScript, compilado con Vite y servido por Nginx | MIT / BSD-2 | R-4 |

Versiones fijadas en `backend/package.json`. Se usa **TypeScript 6** y no 7.0: el compilador nativo de TypeScript 7.0 no incluye la API de JavaScript que dependency-cruiser necesita para analizar el código, y dependency-cruiser solo admite TypeScript 7 a partir de la 7.1. Sin esa API no se pueden ejecutar las funciones de aptitud (R-9).

## 6.4 Lo que queda prohibido por estas restricciones

- Servicios en la nube de terceros (Auth0, Firebase, SendGrid, Sentry en la nube, etc.).
- Software con licencia comercial o de uso restringido (incluida Docker Desktop en los servidores).
- Que el dominio importe Fastify, Kysely, `pg`, Nodemailer o cualquier otra librería de infraestructura (lo vigila FA-1).
- Un segundo mecanismo de migraciones además de Flyway.
