// Raíz de composición (docs/07-arquitectura.md, 7.3).
// Por ahora solo levanta el servidor HTTP con /health para el healthcheck de docker-compose.
// En la sección 6 se reemplaza por Fastify y aquí se conectan los módulos con sus adaptadores.
import { createServer, type Server } from "node:http";

export interface OpcionesServidor {
  puerto: number;
}

export function crearServidor(): Server {
  return createServer((solicitud, respuesta) => {
    if (solicitud.method === "GET" && solicitud.url === "/health") {
      respuesta.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
      respuesta.end(JSON.stringify({ estado: "ok" }));
      return;
    }
    respuesta.writeHead(404, { "Content-Type": "application/json; charset=utf-8" });
    respuesta.end(JSON.stringify({ codigo: "RECURSO_NO_ENCONTRADO", mensaje: "La ruta no existe." }));
  });
}

export function iniciarServidor({ puerto }: OpcionesServidor): Promise<Server> {
  const servidor = crearServidor();
  return new Promise((resolver) => {
    servidor.listen(puerto, () => resolver(servidor));
  });
}
