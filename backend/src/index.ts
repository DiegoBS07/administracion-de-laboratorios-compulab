// Punto de entrada del contenedor backend (CMD del Dockerfile: node dist/index.js).
import { Instante } from "./compartido/dominio/index.js";
import { RelojDelSistema } from "./compartido/infraestructura/reloj-del-sistema.js";
import { iniciarServidor } from "./arranque/servidor.js";

const puerto = Number(process.env["APP_PORT"] ?? 2000);
// Opcional, para demostraciones: hora de arranque simulada en ISO-8601, p. ej. 2026-11-24T10:00:00-06:00
const horaSimulada = process.env["APP_HORA_SIMULADA"]?.trim();

const servidor = await iniciarServidor({
  puerto,
  reloj: new RelojDelSistema(horaSimulada ? Instante.desdeISO(horaSimulada) : null),
  registrarSolicitudes: true,
  cookieSegura: process.env["APP_COOKIE_SEGURA"] === "true"
});

async function apagar(): Promise<void> {
  await servidor.close();
  process.exit(0);
}
process.on("SIGTERM", () => void apagar());
process.on("SIGINT", () => void apagar());
