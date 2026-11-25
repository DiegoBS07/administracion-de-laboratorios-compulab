// Cliente de la API: formato de error (8.7), idempotencia y reintentos con espera creciente y aleatoria.
import { describe, expect, it } from "vitest";
import { crearClienteApi, ErrorDeApi, SinRespuesta } from "./cliente";

type Llamada = { ruta: string; init: RequestInit };

/** Doble de fetch: responde en orden con lo que se le da; un Error simula que la respuesta no llegó. */
function servidorFalso(respuestas: (Response | Error)[]) {
  const llamadas: Llamada[] = [];
  const pedir = async (ruta: string, init: RequestInit) => {
    llamadas.push({ ruta, init });
    const siguiente = respuestas.shift();
    if (!siguiente || siguiente instanceof Error) throw siguiente ?? new Error("sin respuesta");
    return siguiente;
  };
  return { pedir, llamadas };
}
const json = (estado: number, cuerpo: unknown) => new Response(JSON.stringify(cuerpo), { status: estado, headers: { "content-type": "application/json" } });

describe("cliente de la API", () => {
  it("reintenta con la misma Idempotency-Key cuando la respuesta no llega (ADR-0010)", async () => {
    const { pedir, llamadas } = servidorFalso([new TypeError("red"), json(201, { id: "r-1" })]);
    const esperas: number[] = [];
    let avisos = 0;
    const cliente = crearClienteApi(pedir, async (ms) => void esperas.push(ms), () => 0.5);

    const r = await cliente.post<{ id: string }>("/api/v1/reservas", { cuerpo: { a: 1 }, clave: "clave-1", alReintentar: () => avisos++ });

    expect(r).toEqual({ estado: 201, datos: { id: "r-1" } });
    expect(llamadas.map((l) => (l.init.headers as Record<string, string>)["idempotency-key"])).toEqual(["clave-1", "clave-1"]);
    expect(esperas).toEqual([600]);
    expect(avisos).toBe(1);
  });

  it("la espera crece con cada intento y lleva un factor aleatorio entre 0,5 y 1,5", async () => {
    const { pedir } = servidorFalso([json(503, {}), json(503, {}), json(200, {})]);
    const esperas: number[] = [];
    const factores = [0, 0.999];
    const cliente = crearClienteApi(pedir, async (ms) => void esperas.push(ms), () => factores.shift() ?? 0);

    await cliente.get("/api/v1/hora");

    expect(esperas[0]).toBe(300);
    expect(esperas[1]).toBeCloseTo(2248.5);
  });

  it("no reintenta un POST sin clave ni un error de regla, y traduce el formato de error de 8.7", async () => {
    const sinClave = servidorFalso([new TypeError("red")]);
    await expect(crearClienteApi(sinClave.pedir, async () => undefined).post("/api/v1/sesion", { cuerpo: {} })).rejects.toBeInstanceOf(SinRespuesta);
    expect(sinClave.llamadas).toHaveLength(1);

    const regla = servidorFalso([json(409, { codigo: "MAQUINA_NO_DISPONIBLE", mensaje: "Ocupada", detalle: { idMaquina: "m1" }, idSolicitud: "abc" })]);
    const error = await crearClienteApi(regla.pedir, async () => undefined)
      .post("/api/v1/reservas", { cuerpo: {}, clave: "k" })
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ErrorDeApi);
    expect(error).toMatchObject({ estado: 409, codigo: "MAQUINA_NO_DISPONIBLE", detalle: { idMaquina: "m1" }, idSolicitud: "abc" });
    expect(regla.llamadas).toHaveLength(1);
  });

  it("deja de reintentar después de dos intentos", async () => {
    const { pedir, llamadas } = servidorFalso([new TypeError("a"), new TypeError("b"), new TypeError("c")]);

    await expect(crearClienteApi(pedir, async () => undefined).get("/api/v1/hora")).rejects.toBeInstanceOf(SinRespuesta);
    expect(llamadas).toHaveLength(3);
  });

  it("avisa que se perdió la sesión ante un 401, salvo en las rutas de sesión", async () => {
    let perdidas = 0;
    const { pedir } = servidorFalso([json(401, { codigo: "NO_AUTENTICADO" }), json(401, { codigo: "NO_AUTENTICADO" })]);
    const cliente = crearClienteApi(pedir, async () => undefined);
    cliente.alPerderSesion = () => perdidas++;

    await cliente.get("/api/v1/laboratorios").catch(() => undefined);
    await cliente.get("/api/v1/sesion").catch(() => undefined);

    expect(perdidas).toBe(1);
  });
});
