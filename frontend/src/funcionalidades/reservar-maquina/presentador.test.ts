// Presentador de "Reservar una máquina" (CU-11), sin renderizar.
import { describe, expect, it } from "vitest";
import { ErrorDeApi, SinRespuesta } from "../../compartido/api/cliente";
import type { Disponibilidad, MisReservas } from "../../compartido/api/tipos";
import {
  avisoDeCupo,
  confirmacion,
  diasOfrecidos,
  duracionesPosibles,
  iniciosPosibles,
  mensajeDeErrorDeReserva,
  planoDelLaboratorio,
  sedesDe,
  tarjetaDeLaboratorio,
  textoDelCupo
} from "./presentador";

const F = "2026-11-25";
const i = (hhmm: string, fecha = F) => `${fecha}T${hhmm}:00-06:00`;
const DISPONIBILIDAD: Disponibilidad = {
  idLaboratorio: "c1",
  fecha: F,
  franjasAbiertas: [
    { inicio: i("07:00"), fin: i("15:00") },
    { inicio: i("17:00"), fin: i("00:00", "2026-11-26") }
  ],
  maquinas: [
    { id: "m1", codigo: "C1-01", estado: "EN_SERVICIO", reservas: [] },
    { id: "m2", codigo: "C1-02", estado: "EN_SERVICIO", reservas: [{ inicio: i("08:00"), fin: i("10:00") }] },
    { id: "m3", codigo: "C1-03", estado: "FUERA_DE_SERVICIO", reservas: [] },
    { id: "m4", codigo: "C1-04", estado: "EN_SERVICIO", reservas: [] },
    { id: "m5", codigo: "C1-05", estado: "EN_SERVICIO", reservas: [] }
  ]
};
const MIAS: MisReservas = { semana: "2026-11-23", minutosReservadosSemana: 120, limiteSemanalMinutos: 360, activa: null, deLaSemana: [] };
const LABS = [
  { id: "c1", nombre: "Laboratorio 1", campus: "Cartago" },
  { id: "sj1", nombre: "Laboratorio San José", campus: "San José" },
  { id: "c2", nombre: "Laboratorio 2", campus: "Cartago" }
];

describe("sede, días y laboratorios", () => {
  it("ofrece las sedes sin repetir y solo hoy y los 6 días siguientes (RN-16)", () => {
    expect(sedesDe(LABS)).toEqual(["Cartago", "San José"]);
    const dias = diasOfrecidos("2026-11-24", new Map([["2026-11-29", false]]));
    expect(dias).toHaveLength(7);
    expect(dias[0]).toMatchObject({ etiqueta: "Hoy", detalle: "24 nov" });
    expect(dias[5]).toMatchObject({ fecha: "2026-11-29", etiqueta: "dom", detalle: "cerrado", cerrado: true });
  });

  it("la tarjeta dice cuándo abre el laboratorio (con 24:00 bien leído) y cuántas máquinas sirven", () => {
    expect(tarjetaDeLaboratorio(LABS[0]!, DISPONIBILIDAD)).toEqual({
      id: "c1",
      nombre: "Laboratorio 1",
      abierto: true,
      horario: "Abierto de 7:00 a 15:00 y de 17:00 a 24:00",
      maquinas: "4 de 5 máquinas en servicio"
    });
    expect(tarjetaDeLaboratorio(LABS[0]!, { ...DISPONIBILIDAD, franjasAbiertas: [] }).horario).toBe("Cerrado este día");
  });
});

describe("cupo semanal (RN-17)", () => {
  it("dice cuánto lleva y cuánto le queda", () => {
    expect(textoDelCupo(MIAS)).toBe("Esta semana has reservado 2 h. Te quedan 4 h de las 6 h permitidas.");
    expect(textoDelCupo({ ...MIAS, minutosReservadosSemana: 0 })).toBe("Esta semana has reservado 0 h. Te quedan 6 h de las 6 h permitidas.");
  });

  it("avisa antes de ofrecer máquinas si ya tiene una activa o agotó sus horas (ext 6a, 6b)", () => {
    const activa = { id: "r1", idMaquina: "m2", codigoMaquina: "C1-02", idLaboratorio: "c1", inicio: i("08:00"), fin: i("10:00"), estado: "ACTIVA", limitePresentacion: i("08:15") };
    expect(avisoDeCupo({ ...MIAS, activa }, LABS)?.titulo).toBe("Ya tienes una reserva activa: C1-02, Laboratorio 1, miércoles 25 de noviembre de 8:00 a 10:00.");
    expect(avisoDeCupo({ ...MIAS, minutosReservadosSemana: 360 }, LABS)?.tipo).toBe("agotado");
    expect(avisoDeCupo(MIAS, LABS)).toBeNull();
  });
});

describe("hora, duración y plano (N-7)", () => {
  it("ofrece inicios cada 30 min dentro de las franjas y, si es hoy, solo los que no han pasado", () => {
    const inicios = iniciosPosibles(DISPONIBILIDAD, "2026-11-24T10:00:00-06:00");
    expect(inicios[0]).toBe(7 * 60);
    expect(inicios).toContain(14 * 60 + 30);
    expect(inicios).not.toContain(15 * 60);
    expect(inicios.at(-1)).toBe(23 * 60 + 30);
    expect(iniciosPosibles(DISPONIBILIDAD, "2026-11-25T10:10:00-06:00")[0]).toBe(10 * 60 + 30);
  });

  it("deshabilita las duraciones que pasan el cierre de la franja o las horas que le quedan", () => {
    const opciones = duracionesPosibles(DISPONIBILIDAD, 14 * 60, 90, false);
    expect(opciones.map((o) => [o.minutos, o.habilitada, o.razon])).toEqual([
      [30, true, null],
      [60, true, null],
      [90, false, "cierra antes"],
      [120, false, "cierra antes"]
    ]);
    expect(duracionesPosibles(DISPONIBILIDAD, 8 * 60, 90, false).map((o) => o.razon)).toEqual([null, null, null, "pasa tus 6 h"]);
    expect(duracionesPosibles(DISPONIBILIDAD, 8 * 60, 360, true).every((o) => !o.habilitada)).toBe(true);
  });

  it("el plano marca libres, reservadas en ese horario y fuera de servicio, en filas de 4", () => {
    const filas = planoDelLaboratorio(DISPONIBILIDAD, 9 * 60, 60, "m1", false);
    expect(filas.map((f) => f.length)).toEqual([4, 1]);
    expect(filas[0]?.map((p) => [p.codigo, p.estado, p.habilitado])).toEqual([
      ["C1-01", "libre", true],
      ["C1-02", "ocupada", false],
      ["C1-03", "fuera", false],
      ["C1-04", "libre", true]
    ]);
    expect(filas[0]?.[0]?.elegida).toBe(true);
    expect(planoDelLaboratorio(DISPONIBILIDAD, 10 * 60, 60, null, false)[0]?.[1]?.estado).toBe("libre");
    expect(planoDelLaboratorio(DISPONIBILIDAD, null, null, null, false)[0]?.[0]?.estado).toBe("espera");
  });

  it("la confirmación dice hasta qué hora presentarse y cuánto le quedará", () => {
    expect(confirmacion("C1-01", "Laboratorio 1", F, 9 * 60, 60, 240)).toEqual({
      codigo: "C1-01",
      laboratorio: "Laboratorio 1",
      dia: "miércoles 25 de noviembre",
      horario: "De 9:00 a 10:00",
      limite: "9:15",
      quedan: "3 h"
    });
  });
});

describe("mensajes de error (tabla de 15.6)", () => {
  it("traduce cada código a lenguaje sencillo con su acción", () => {
    expect(mensajeDeErrorDeReserva(new ErrorDeApi(409, "MAQUINA_NO_DISPONIBLE", "x")).accion).toBe("otra-maquina");
    expect(mensajeDeErrorDeReserva(new ErrorDeApi(409, "YA_TIENE_RESERVA_ACTIVA", "x")).accion).toBe("mis-reservas");
    expect(mensajeDeErrorDeReserva(new ErrorDeApi(422, "LIMITE_SEMANAL_DE_RESERVA_EXCEDIDO", "x", { minutosReservados: 300, limiteSemanalMinutos: 360 })).texto).toBe(
      "Acorta la reserva; te quedan 1 h."
    );
    expect(mensajeDeErrorDeReserva(new SinRespuesta()).texto).toMatch(/no se duplicará/);
  });
});
