# administracion-de-laboratorios-compulab

Requisitos: Node.js 24 o superior (y Docker para levantar los contenedores).

1. Instalar: `npm ci` dentro de `backend/` y dentro de `frontend/`
2. Correr las pruebas: `npm test` dentro de cada carpeta (`npm run verificar` agrega la verificación de tipos)
3. Levantar todo con Docker: copiar `.env.example` como `.env` y ejecutar `docker compose up --build`
4. Abrir `http://localhost:8080` y entrar como `ana.estudiante`, `marta.coordinadora` o `carlos.soporte` (contraseña `demo`)
5. Sin Docker: `npm run dev` en `backend/` (API en el puerto 2000, datos en memoria) y en `frontend/` (`http://localhost:5173`)
6. Opcional, pruebas contra PostgreSQL: definir `APP_DB_PRUEBAS=postgres://usuario:clave@localhost:5432/base` antes de `npm test` en `backend/`

Diseño en `docs/` (empezar por `docs/README.md`); prototipo en `docs/prototipo/`.

## Qué hay en el repositorio

| Carpeta | Contenido |
| --- | --- |
| `backend/` | Monolito modular en Node.js + TypeScript con Fastify: dominio, casos de uso, adaptadores en memoria y PostgreSQL, API REST (`/api/v1`) y funciones de aptitud |
| `frontend/` | React + TypeScript compilado con Vite y servido por Nginx, que también reenvía `/api` al backend |
| `database/migrations/` | Esquema de PostgreSQL 14 en migraciones Flyway (V1 a V6), única fuente del esquema |
| `docs/` | Diseño completo: requisitos, casos de uso, arquitectura, ADR, componentes, clases, comportamiento, UX/UI y trazabilidad |
| `docker-compose.yml` | Cuatro contenedores: `db`, `migraciones`, `backend` y `frontend` |

## Recorrido de demostración

Los datos de demostración se generan alrededor de la fecha de arranque: siempre hay un mes anterior por cerrar y laboratorios abiertos en los próximos días.

- **Reservar una máquina (CU-11):** como `ana.estudiante`, elegir sede, día, hora, duración y una máquina libre del plano.
- **Asignar un turno (CU-06):** como `marta.coordinadora`, en el horario de la semana tocar una franja libre (por ejemplo, de 15:00 a 17:00) y asignarla a Laura Méndez.
- **Cerrar el mes (CU-14):** como `carlos.soporte`, en Cierre mensual abrir el mes anterior, cerrarlo y descargar el archivo para Becas.

Variables útiles en `.env`: `APP_DATOS_DEMO=false` deja la base vacía; `APP_HORA_SIMULADA` fija la hora de arranque para una demostración; `FRONTEND_PORT` cambia el puerto de la aplicación.
