// API HTTP del núcleo ejecutable (docs/08-componentes.md, 8.7) con los datos de demostración.
// Prueba el borde: rutas, sesión, permisos por rol, Idempotency-Key y traducción de errores a
// estados HTTP. Las reglas de negocio ya tienen sus pruebas por contrato en tests/modulos/.
import type { FastifyInstance, LightMyRequestResponse } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { crearServidor } from "../../src/arranque/servidor.js";
import { RelojFijo } from "../dobles/reloj-fijo.js";

// Martes 24 de noviembre de 2026, 10:00. El mes anterior (octubre) está por cerrar.
const AHORA = "2026-11-24T10:00:00-06:00";
const SEMANA = "2026-11-23";
const MIERCOLES = "2026-11-25";

let app: FastifyInstance;

beforeEach(() => {
  app = crearServidor({ reloj: new RelojFijo(AHORA) });
});

afterEach(async () => {
  await app.close();
});

async function ingresar(usuario: string, secreto = "demo"): Promise<string> {
  const respuesta = await app.inject({ method: "POST", url: "/api/v1/sesion", payload: { usuario, secreto } });
  expect(respuesta.statusCode).toBe(201);
  return String(respuesta.headers["set-cookie"]).split(";")[0] ?? "";
}

function pedir(cookie: string, method: "GET" | "POST" | "DELETE", url: string, payload?: object, clave?: string) {
  return app.inject({ method, url, payload, headers: { cookie, ...(clave ? { "idempotency-key": clave } : {}) } });
}

const codigo = (r: LightMyRequestResponse) => [r.statusCode, r.json<{ codigo: string }>().codigo];

describe("sesión", () => {
  it("sin sesión responde 401 NO_AUTENTICADO", async () => {
    const respuesta = await app.inject({ method: "GET", url: "/api/v1/sesion" });

    expect(codigo(respuesta)).toEqual([401, "NO_AUTENTICADO"]);
  });

  it("al iniciar sesión deja una cookie HttpOnly de 8 h y devuelve los roles", async () => {
    const respuesta = await app.inject({ method: "POST", url: "/api/v1/sesion", payload: { usuario: "marta.coordinadora", secreto: "demo" } });

    expect(respuesta.statusCode).toBe(201);
    expect(respuesta.json()).toEqual({ id: "coord-c1", nombre: "Marta Jiménez Rojas", roles: [{ rol: "COORDINADOR_LABORATORIO", idLaboratorio: "c1" }] });
    expect(respuesta.headers["set-cookie"]).toMatch(/^compulab_sesion=[\w-]{43}; Path=\/; HttpOnly; SameSite=Lax; Max-Age=28800$/);

    const cookie = String(respuesta.headers["set-cookie"]).split(";")[0] ?? "";
    expect((await pedir(cookie, "GET", "/api/v1/sesion")).json()).toMatchObject({ id: "coord-c1" });
  });

  it("un estudiante de la Escuela recibe el rol ESTUDIANTE sin registro previo (ADR-0008)", async () => {
    const cookie = await ingresar("ana.estudiante");

    expect((await pedir(cookie, "GET", "/api/v1/sesion")).json()).toEqual({ id: "est-ana", nombre: "Ana Rodríguez Mora", roles: [{ rol: "ESTUDIANTE" }] });
  });

  it("rechaza credenciales incorrectas y cuerpos incompletos", async () => {
    const mal = await app.inject({ method: "POST", url: "/api/v1/sesion", payload: { usuario: "marta.coordinadora", secreto: "otra" } });
    const incompleto = await app.inject({ method: "POST", url: "/api/v1/sesion", payload: { usuario: "marta.coordinadora" } });

    expect(codigo(mal)).toEqual([401, "CREDENCIALES_INVALIDAS"]);
    expect(codigo(incompleto)).toEqual([400, "SOLICITUD_INVALIDA"]);
  });

  it("cerrar sesión invalida la cookie", async () => {
    const cookie = await ingresar("carlos.soporte");

    expect((await pedir(cookie, "DELETE", "/api/v1/sesion")).statusCode).toBe(204);
    expect(codigo(await pedir(cookie, "GET", "/api/v1/sesion"))).toEqual([401, "NO_AUTENTICADO"]);
  });

  it("lista los usuarios de demostración para el selector de 15.7", async () => {
    const respuesta = await app.inject({ method: "GET", url: "/api/v1/sesion/usuarios-de-demostracion" });

    expect(respuesta.json<{ usuario: string }[]>().map((u) => u.usuario)).toContain("ana.estudiante");
  });
});

describe("CU-06 · horario y asignación de turnos", () => {
  it("lista los laboratorios; sin sesión responde 401", async () => {
    const cookie = await ingresar("marta.coordinadora");

    expect((await pedir(cookie, "GET", "/api/v1/laboratorios")).json<{ id: string }[]>().map((l) => l.id)).toEqual(["c1", "c2", "sj1"]);
    expect((await app.inject({ method: "GET", url: "/api/v1/laboratorios" })).statusCode).toBe(401);
  });

  it("devuelve el horario de la semana con el estado de cada turno", async () => {
    const cookie = await ingresar("marta.coordinadora");

    const horario = (await pedir(cookie, "GET", `/api/v1/laboratorios/c1/turnos?semana=${SEMANA}`)).json<{
      turnos: { fecha: string; horaInicio: string; estado: string; asistente: { nombre: string } }[];
    }>();

    expect(horario.turnos).toHaveLength(18);
    const de = (fecha: string, hora: string) => horario.turnos.find((t) => t.fecha === fecha && t.horaInicio === hora);
    expect(de("2026-11-23", "07:00")).toMatchObject({ estado: "CUBIERTO", asistente: { nombre: "Diego Vargas Solano" } });
    expect(de("2026-11-24", "07:00")?.estado).toBe("EN_CURSO");
    expect(de("2026-11-24", "11:00")?.estado).toBe("ASIGNADO");
  });

  it("valida la semana y el laboratorio", async () => {
    const cookie = await ingresar("marta.coordinadora");

    expect(codigo(await pedir(cookie, "GET", "/api/v1/laboratorios/c1/turnos?semana=2026-11-24"))).toEqual([400, "SOLICITUD_INVALIDA"]);
    expect(codigo(await pedir(cookie, "GET", `/api/v1/laboratorios/x9/turnos?semana=${SEMANA}`))).toEqual([404, "LABORATORIO_NO_EXISTE"]);
  });

  it("lista los asistentes activos con sus horas de la semana; un estudiante no puede verlos", async () => {
    const coordinadora = await ingresar("marta.coordinadora");
    const estudiante = await ingresar("ana.estudiante");

    const lista = (await pedir(coordinadora, "GET", `/api/v1/laboratorios/c1/asistentes?semana=${SEMANA}`)).json<
      { id: string; topeSemanalMinutos: number; minutosProgramadosSemana: number }[]
    >();

    expect(lista.map((a) => a.id).sort()).toEqual(["a1", "a2", "a3", "a4", "a7"]); // a6 está inactivo
    expect(lista.find((a) => a.id === "a3")).toMatchObject({ topeSemanalMinutos: 900, minutosProgramadosSemana: 1200 });
    expect(lista.find((a) => a.id === "a7")).toMatchObject({ topeSemanalMinutos: 900, minutosProgramadosSemana: 0 });
    expect(codigo(await pedir(estudiante, "GET", `/api/v1/laboratorios/c1/asistentes?semana=${SEMANA}`))).toEqual([403, "SIN_PERMISO"]);
  });

  it("asigna un turno (201), un reenvío con la misma clave responde 200 y la misma clave con otros datos 422", async () => {
    const cookie = await ingresar("marta.coordinadora");
    const cuerpo = { idAsistente: "a7", fecha: MIERCOLES, horaInicio: "15:00", horaFin: "17:00" };

    const creado = await pedir(cookie, "POST", "/api/v1/laboratorios/c1/turnos", cuerpo, "clave-turno-0001");
    const reenvio = await pedir(cookie, "POST", "/api/v1/laboratorios/c1/turnos", cuerpo, "clave-turno-0001");
    const otro = await pedir(cookie, "POST", "/api/v1/laboratorios/c1/turnos", { ...cuerpo, horaFin: "16:00" }, "clave-turno-0001");

    expect(creado.statusCode).toBe(201);
    expect(creado.json()).toMatchObject({ estado: "ASIGNADO", asistente: { id: "a7", nombre: "Laura Méndez Arias" }, minutosSemanaAsistente: 120 });
    expect(reenvio.statusCode).toBe(200);
    expect(reenvio.json()).toEqual(creado.json());
    expect(codigo(otro)).toEqual([422, "CLAVE_DE_SOLICITUD_REUTILIZADA"]);
  });

  it("exige la cabecera Idempotency-Key", async () => {
    const cookie = await ingresar("marta.coordinadora");

    const respuesta = await pedir(cookie, "POST", "/api/v1/laboratorios/c1/turnos", { idAsistente: "a7", fecha: MIERCOLES, horaInicio: "15:00", horaFin: "17:00" });

    expect(codigo(respuesta)).toEqual([400, "SOLICITUD_INVALIDA"]);
  });

  it("traduce las reglas del dominio a 409, 422 y 403", async () => {
    const coordinadora = await ingresar("marta.coordinadora");
    const soporte = await ingresar("carlos.soporte");
    const turno = (idAsistente: string, horaInicio: string, horaFin: string) => ({ idAsistente, fecha: MIERCOLES, horaInicio, horaFin });

    expect(codigo(await pedir(coordinadora, "POST", "/api/v1/laboratorios/c1/turnos", turno("a7", "10:00", "12:00"), "clave-turno-0002"))).toEqual([409, "FRANJA_OCUPADA_EN_LABORATORIO"]);
    expect(codigo(await pedir(coordinadora, "POST", "/api/v1/laboratorios/c1/turnos", turno("a3", "15:00", "17:00"), "clave-turno-0003"))).toEqual([422, "TOPE_SEMANAL_EXCEDIDO"]);
    expect(codigo(await pedir(coordinadora, "POST", "/api/v1/laboratorios/c2/turnos", turno("a7", "13:00", "15:00"), "clave-turno-0004"))).toEqual([403, "SIN_PERMISO_SOBRE_LABORATORIO"]);
    expect((await pedir(soporte, "POST", "/api/v1/laboratorios/c2/turnos", turno("a7", "13:00", "15:00"), "clave-turno-0005")).statusCode).toBe(201);
  });

  it("un turno nuevo abre el laboratorio para reservas (puente horarios → reservas)", async () => {
    const coordinadora = await ingresar("marta.coordinadora");
    await pedir(coordinadora, "POST", "/api/v1/laboratorios/c1/turnos", { idAsistente: "a7", fecha: MIERCOLES, horaInicio: "15:00", horaFin: "17:00" }, "clave-turno-0006");

    const disponibilidad = (await pedir(coordinadora, "GET", `/api/v1/laboratorios/c1/disponibilidad?fecha=${MIERCOLES}`)).json<{ franjasAbiertas: unknown[] }>();

    expect(disponibilidad.franjasAbiertas).toEqual([{ inicio: `${MIERCOLES}T07:00:00-06:00`, fin: `${MIERCOLES}T21:00:00-06:00` }]);
  });
});

describe("CU-11 · disponibilidad y reserva", () => {
  const reserva = (idMaquina: string, inicio: string, fin: string) => ({
    idMaquina,
    inicio: `${MIERCOLES}T${inicio}:00-06:00`,
    fin: `${MIERCOLES}T${fin}:00-06:00`
  });

  it("muestra las franjas abiertas y el estado de cada máquina", async () => {
    const cookie = await ingresar("ana.estudiante");

    const d = (await pedir(cookie, "GET", `/api/v1/laboratorios/c1/disponibilidad?fecha=${MIERCOLES}`)).json<{
      franjasAbiertas: { inicio: string; fin: string }[];
      maquinas: { id: string; estado: string; reservas: unknown[] }[];
    }>();

    expect(d.franjasAbiertas).toEqual([
      { inicio: `${MIERCOLES}T07:00:00-06:00`, fin: `${MIERCOLES}T15:00:00-06:00` },
      { inicio: `${MIERCOLES}T17:00:00-06:00`, fin: `${MIERCOLES}T21:00:00-06:00` }
    ]);
    expect(d.maquinas).toHaveLength(8);
    expect(d.maquinas.find((m) => m.id === "m-c1-08")?.estado).toBe("FUERA_DE_SERVICIO");
    expect(d.maquinas.find((m) => m.id === "m-c1-02")?.reservas).toEqual([{ inicio: `${MIERCOLES}T08:00:00-06:00`, fin: `${MIERCOLES}T10:00:00-06:00` }]);
  });

  it("reserva una máquina (201) y el reenvío con la misma clave responde 200", async () => {
    const cookie = await ingresar("ana.estudiante");

    const creada = await pedir(cookie, "POST", "/api/v1/reservas", reserva("m-c1-01", "08:00", "10:00"), "clave-reserva-01");
    const reenvio = await pedir(cookie, "POST", "/api/v1/reservas", reserva("m-c1-01", "08:00", "10:00"), "clave-reserva-01");

    expect(creada.statusCode).toBe(201);
    expect(creada.json()).toMatchObject({ idMaquina: "m-c1-01", estado: "ACTIVA", limitePresentacion: `${MIERCOLES}T08:15:00-06:00` });
    expect(reenvio.statusCode).toBe(200);
    expect(reenvio.json()).toEqual(creada.json());
  });

  it("traduce las reglas del dominio a 409 y 422", async () => {
    const diego = await ingresar("diego.asistente");

    expect(codigo(await pedir(diego, "POST", "/api/v1/reservas", reserva("m-c1-02", "08:00", "09:00"), "clave-reserva-02"))).toEqual([409, "MAQUINA_NO_DISPONIBLE"]);
    expect(codigo(await pedir(diego, "POST", "/api/v1/reservas", reserva("m-c1-01", "15:00", "16:00"), "clave-reserva-03"))).toEqual([422, "LABORATORIO_CERRADO_EN_FRANJA"]);
    expect(codigo(await pedir(diego, "POST", "/api/v1/reservas", reserva("m-c1-01", "07:00", "10:00"), "clave-reserva-04"))).toEqual([422, "RESERVA_EXCEDE_DURACION"]);
    expect(codigo(await pedir(diego, "POST", "/api/v1/reservas", reserva("m-c1-08", "08:00", "09:00"), "clave-reserva-05"))).toEqual([422, "MAQUINA_FUERA_DE_SERVICIO"]);
  });

  it("solo un estudiante puede reservar", async () => {
    const coordinadora = await ingresar("marta.coordinadora");

    expect(codigo(await pedir(coordinadora, "POST", "/api/v1/reservas", reserva("m-c1-01", "08:00", "09:00"), "clave-reserva-06"))).toEqual([403, "SIN_PERMISO"]);
  });
});

describe("CU-14 · cierre mensual", () => {
  type Cierre = {
    id: string;
    totalCentimos: number;
    lineas: { idAsistente: string; minutosNormales: number; minutosConRecargo: number; noPagados: { semana: string; motivo: string; minutos: number }[] }[];
  };

  it("solo el coordinador de soporte puede cerrar o consultar", async () => {
    const estudiante = await ingresar("ana.estudiante");
    const coordinadora = await ingresar("marta.coordinadora");

    expect(codigo(await pedir(estudiante, "POST", "/api/v1/cierres", { anio: 2026, mes: 10 }))).toEqual([403, "SIN_PERMISO"]);
    expect(codigo(await pedir(coordinadora, "GET", "/api/v1/cierres?anio=2026"))).toEqual([403, "SIN_PERMISO"]);
  });

  it("cierra octubre con los casos de demostración: marca incompleta, llegada tarde y horas sobre el tope", async () => {
    const soporte = await ingresar("carlos.soporte");

    const respuesta = await pedir(soporte, "POST", "/api/v1/cierres", { anio: 2026, mes: 10 });
    const cierre = respuesta.json<Cierre>();
    const linea = (id: string) => cierre.lineas.find((l) => l.idAsistente === id);

    expect(respuesta.statusCode).toBe(201);
    expect(cierre.id).toBe("cierre-2026-10");
    expect(cierre.lineas.map((l) => l.idAsistente).sort()).toEqual(["a1", "a2", "a3", "a4", "a5"]);
    // Diego: 22 días hábiles × 240 min, menos 10 min de llegada tarde y el turno sin salida
    expect(linea("a1")).toMatchObject({ minutosNormales: 22 * 240 - 10 - 240, noPagados: [{ semana: "2026-10-19", motivo: "MARCA_INCOMPLETA", minutos: 237 }] });
    // María: un turno no cubierto aporta 0 y no se reporta como no pagado
    expect(linea("a2")).toMatchObject({ minutosNormales: 21 * 240, noPagados: [] });
    // José: turnos de 17:00 a 21:00 (sin recargo: empiezan antes de las 18:00) y 5 h por semana
    // sobre su tope corregido a 15 h; en la semana del 28 de septiembre aún regía el tope de 20 h
    expect(linea("a3")).toMatchObject({ minutosNormales: 2 * 240 + 4 * 900, minutosConRecargo: 0 });
    // Andrés: los sábados llevan recargo
    expect(linea("a4")?.minutosConRecargo).toBe(5 * 240);
    expect(linea("a3")?.noPagados.map((n) => [n.semana, n.motivo, n.minutos])).toEqual([
      ["2026-10-05", "SOBRE_TOPE", 300],
      ["2026-10-12", "SOBRE_TOPE", 300],
      ["2026-10-19", "SOBRE_TOPE", 300],
      ["2026-10-26", "SOBRE_TOPE", 300]
    ]);
  });

  it("es idempotente por mes y se puede consultar y descargar", async () => {
    const soporte = await ingresar("carlos.soporte");
    const primero = await pedir(soporte, "POST", "/api/v1/cierres", { anio: 2026, mes: 10 });

    const segundo = await pedir(soporte, "POST", "/api/v1/cierres", { anio: 2026, mes: 10 });
    const consulta = await pedir(soporte, "GET", "/api/v1/cierres/2026/10");
    const archivo = await pedir(soporte, "GET", "/api/v1/cierres/2026/10/archivo");

    expect(segundo.statusCode).toBe(200);
    expect(segundo.json()).toEqual(primero.json());
    expect(consulta.json()).toEqual(primero.json());
    expect(archivo.headers["content-type"]).toBe("text/csv; charset=utf-8");
    expect(archivo.headers["content-disposition"]).toBe('attachment; filename="becas-2026-10.csv"');
    expect(archivo.body.split("\r\n")[0]).toBe("mes,carne,nombre,categoria,horas_normales,horas_con_recargo,horas_no_pagadas,monto_colones");
    expect(archivo.body.split("\r\n").filter(Boolean)).toHaveLength(6);
  });

  it("lista los meses del año con su estado", async () => {
    const soporte = await ingresar("carlos.soporte");
    await pedir(soporte, "POST", "/api/v1/cierres", { anio: 2026, mes: 10 });

    const meses = (await pedir(soporte, "GET", "/api/v1/cierres?anio=2026")).json<{ mes: number; estado: string }[]>();

    expect(meses).toHaveLength(11);
    expect(meses.find((m) => m.mes === 9)?.estado).toBe("POR_CERRAR");
    expect(meses.find((m) => m.mes === 10)?.estado).toBe("CERRADO");
    expect(meses.find((m) => m.mes === 11)?.estado).toBe("EN_CURSO");
  });

  it("traduce los errores: mes sin terminar 422, sin cierre 404 y mes imposible 400", async () => {
    const soporte = await ingresar("carlos.soporte");

    expect(codigo(await pedir(soporte, "POST", "/api/v1/cierres", { anio: 2026, mes: 11 }))).toEqual([422, "MES_NO_TERMINADO"]);
    expect(codigo(await pedir(soporte, "GET", "/api/v1/cierres/2026/9"))).toEqual([404, "CIERRE_NO_EXISTE"]);
    expect(codigo(await pedir(soporte, "GET", "/api/v1/cierres/2026/13"))).toEqual([400, "SOLICITUD_INVALIDA"]);
  });
});
