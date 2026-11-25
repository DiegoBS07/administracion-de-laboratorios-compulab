// Formato común de la API (docs/08-componentes.md, 8.7): healthcheck, errores y X-Request-Id.
import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { crearServidor, iniciarServidor } from "../../src/arranque/servidor.js";
import { RelojFijo } from "../dobles/reloj-fijo.js";

let app: FastifyInstance | null = null;

afterEach(async () => {
  await app?.close();
  app = null;
});

const nueva = () => {
  app = crearServidor({ reloj: new RelojFijo("2026-11-24T10:00:00-06:00") });
  return app;
};

describe("servidor de arranque", () => {
  it("GET /health responde 200 con estado ok, sin sesión", async () => {
    const respuesta = await nueva().inject({ method: "GET", url: "/health" });

    expect(respuesta.statusCode).toBe(200);
    expect(respuesta.json()).toEqual({ estado: "ok" });
  });

  it("una ruta inexistente responde 404 con el formato de error y el idSolicitud de la cabecera", async () => {
    const respuesta = await nueva().inject({ method: "GET", url: "/no-existe" });

    expect(respuesta.statusCode).toBe(404);
    expect(respuesta.json()).toEqual({
      codigo: "RECURSO_NO_ENCONTRADO",
      mensaje: "La ruta no existe.",
      detalle: {},
      idSolicitud: respuesta.headers["x-request-id"]
    });
  });

  it("respeta el X-Request-Id del cliente y reemplaza uno que no es seguro de registrar", async () => {
    const servidor = nueva();

    const propio = await servidor.inject({ method: "GET", url: "/health", headers: { "x-request-id": "prueba-123" } });
    const inseguro = await servidor.inject({ method: "GET", url: "/health", headers: { "x-request-id": "a b\nc" } });

    expect(propio.headers["x-request-id"]).toBe("prueba-123");
    expect(inseguro.headers["x-request-id"]).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("escucha en un puerto real (healthcheck de docker-compose)", async () => {
    app = await iniciarServidor({ puerto: 0, host: "127.0.0.1", reloj: new RelojFijo("2026-11-24T10:00:00-06:00") });
    const direccion = app.server.address();
    const puerto = typeof direccion === "object" && direccion ? direccion.port : 0;

    const respuesta = await fetch(`http://127.0.0.1:${puerto}/health`);

    expect(respuesta.status).toBe(200);
  });
});
