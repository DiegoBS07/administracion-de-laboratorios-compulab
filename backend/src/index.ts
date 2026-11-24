// Punto de entrada del contenedor backend (CMD del Dockerfile: node dist/index.js).
import { iniciarServidor } from "./arranque/servidor.js";

const puerto = Number(process.env["APP_PORT"] ?? 2000);

const servidor = await iniciarServidor({ puerto });
console.log(`CompuLab backend escuchando en el puerto ${puerto}`);

function apagar(): void {
  servidor.close(() => process.exit(0));
}
process.on("SIGTERM", apagar);
process.on("SIGINT", apagar);
