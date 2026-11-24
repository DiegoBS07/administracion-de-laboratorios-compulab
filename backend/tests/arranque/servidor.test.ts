import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { iniciarServidor } from "../../src/arranque/servidor.js";

// Prueba de humo de la sección 0: el contenedor responde al healthcheck de docker-compose.
describe("servidor de arranque", () => {
  let servidor: Server;
  let base: string;

  beforeAll(async () => {
    servidor = await iniciarServidor({ puerto: 0 });
    base = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;
  });

  afterAll(() => new Promise<void>((resolver) => servidor.close(() => resolver())));

  it("GET /health responde 200 con estado ok", async () => {
    const respuesta = await fetch(`${base}/health`);
    expect(respuesta.status).toBe(200);
    expect(await respuesta.json()).toEqual({ estado: "ok" });
  });

  it("una ruta inexistente responde 404 con el formato de error de la API", async () => {
    const respuesta = await fetch(`${base}/no-existe`);
    expect(respuesta.status).toBe(404);
    expect(await respuesta.json()).toMatchObject({ codigo: "RECURSO_NO_ENCONTRADO" });
  });
});
