// Punto de entrada del contenedor backend (CMD del Dockerfile: node dist/index.js).
import { Instante } from "./compartido/dominio/index.js";
import { RelojDelSistema } from "./compartido/infraestructura/reloj-del-sistema.js";
import { type Adaptadores, crearAdaptadoresEnMemoria, crearAdaptadoresPostgres } from "./arranque/adaptadores.js";
import { iniciarServidor } from "./arranque/servidor.js";

const entorno = (nombre: string): string | undefined => process.env[nombre]?.trim() || undefined;

const puerto = Number(entorno("APP_PORT") ?? 2000);
// Opcional, para demostraciones: hora de arranque simulada en ISO-8601, p. ej. 2026-11-24T10:00:00-06:00
const horaSimulada = entorno("APP_HORA_SIMULADA");
const reloj = new RelojDelSistema(horaSimulada ? Instante.desdeISO(horaSimulada) : null);

// APP_PERSISTENCIA=postgres en el contenedor; memoria para correr sin base de datos.
let adaptadores: Adaptadores;
if (entorno("APP_PERSISTENCIA") === "postgres") {
  adaptadores = await crearAdaptadoresPostgres({
    reloj,
    sembrarDatosDeDemostracion: entorno("APP_DATOS_DEMO") === "true",
    conexion: {
      host: entorno("APP_DB_HOST") ?? "localhost",
      puerto: Number(entorno("APP_DB_PORT") ?? 5432),
      baseDeDatos: entorno("APP_DB") ?? "",
      usuario: entorno("APP_DB_USER") ?? "",
      contrasena: entorno("APP_DB_PASSWORD") ?? ""
    }
  });
} else {
  adaptadores = crearAdaptadoresEnMemoria(reloj);
}

const servidor = await iniciarServidor({
  puerto,
  reloj,
  adaptadores,
  registrarSolicitudes: true,
  cookieSegura: entorno("APP_COOKIE_SEGURA") === "true"
});

async function apagar(): Promise<void> {
  await servidor.close();
  process.exit(0);
}
process.on("SIGTERM", () => void apagar());
process.on("SIGINT", () => void apagar());
