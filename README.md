# administracion-de-laboratorios-compulab

Requisitos: Node.js 24 o superior (y Docker para levantar los contenedores).

1. Instalar: `cd backend && npm ci`
2. Correr las pruebas: `npm test` (dentro de `backend/`)
3. Verificar tipos y pruebas juntas: `npm run verificar`
4. Levantar con Docker: copiar `.env.example` como `.env` y ejecutar `docker compose up --build`

Diseño en `docs/` (empezar por `docs/README.md`); prototipo en `docs/prototipo/`.
