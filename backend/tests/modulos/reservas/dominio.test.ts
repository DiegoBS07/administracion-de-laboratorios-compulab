// Invariantes de las clases de dominio del módulo reservas (docs/09-clases.md, 9.3).
import { describe, expect, it } from "vitest";
import { DatoInvalido, Fecha, Franja, Hora, Instante, Semana } from "../../../src/compartido/dominio/index.js";
import { AgendaDeLaMaquina } from "../../../src/modulos/reservas/dominio/agenda-de-la-maquina.js";
import { CupoSemanalDelEstudiante } from "../../../src/modulos/reservas/dominio/cupo-semanal-del-estudiante.js";
import type { EstadoReserva } from "../../../src/modulos/reservas/dominio/estado-reserva.js";
import {
  FranjaDeReservaInvalida,
  FueraDeHorizonteDeReserva,
  LimiteSemanalDeReservaExcedido,
  MaquinaFueraDeServicio,
  MaquinaNoDisponible,
  ReservaExcedeDuracion,
  YaTieneReservaActiva
} from "../../../src/modulos/reservas/dominio/errores.js";
import { Maquina } from "../../../src/modulos/reservas/dominio/maquina.js";
import { Reserva } from "../../../src/modulos/reservas/dominio/reserva.js";

const AHORA = Instante.desdeISO("2026-11-24T10:00:00-06:00"); // martes
const franja = (fecha: string, inicio: string, fin: string) => Franja.delDia(Fecha.desdeTexto(fecha), Hora.desdeTexto(inicio), Hora.desdeTexto(fin));
const crear = (f: Franja) => Reserva.crear({ id: "r", idEstudiante: "ana", idMaquina: "m1", franja: f, claveSolicitud: "k", ahora: AHORA });
const guardada = (id: string, f: Franja, estado: EstadoReserva, estudiante = "ana", maquina = "m1") =>
  Reserva.reconstituir({ id, idEstudiante: estudiante, idMaquina: maquina, franja: f, estado, claveSolicitud: null });

describe("Reserva", () => {
  it("se crea ACTIVA con límite de presentación a los 15 minutos", () => {
    const r = crear(franja("2026-11-24", "14:00", "16:00"));
    expect(r.estado).toBe("ACTIVA");
    expect(r.limitePresentacion.aISO()).toBe("2026-11-24T14:15:00-06:00");
  });

  it("no puede empezar ahora ni en el pasado (RN-16)", () => {
    expect(() => crear(franja("2026-11-24", "10:00", "11:00"))).toThrow(FranjaDeReservaInvalida);
    expect(() => crear(franja("2026-11-24", "10:01", "11:00"))).not.toThrow();
  });

  it("dura como máximo 2 horas (RN-16)", () => {
    expect(() => crear(franja("2026-11-24", "14:00", "16:00"))).not.toThrow();
    expect(() => crear(franja("2026-11-24", "14:00", "16:01"))).toThrow(ReservaExcedeDuracion);
  });

  it("se reserva para hoy o para los 6 días siguientes (SUP-15)", () => {
    expect(() => crear(franja("2026-11-30", "08:00", "09:00"))).not.toThrow();
    expect(() => crear(franja("2026-12-01", "08:00", "09:00"))).toThrow(FueraDeHorizonteDeReserva);
  });

  it("exige clave de solicitud e identificadores no vacíos", () => {
    expect(() => Reserva.crear({ id: "r", idEstudiante: "ana", idMaquina: "m1", franja: franja("2026-11-24", "14:00", "15:00"), claveSolicitud: " ", ahora: AHORA })).toThrow(DatoInvalido);
    expect(() => guardada("", franja("2026-11-24", "14:00", "15:00"), "ACTIVA")).toThrow(DatoInvalido);
  });

  it("está activa en ACTIVA y EN_USO; para las 6 h cuentan también FINALIZADA y LIBERADA (SUP-15)", () => {
    const f = franja("2026-11-24", "14:00", "15:00");
    const estados: [EstadoReserva, boolean, boolean][] = [
      ["ACTIVA", true, true],
      ["EN_USO", true, true],
      ["FINALIZADA", false, true],
      ["LIBERADA", false, true],
      ["CANCELADA_POR_ESTUDIANTE", false, false],
      ["CANCELADA_POR_SISTEMA", false, false]
    ];
    for (const [estado, activa, cuenta] of estados) {
      const r = guardada("r", f, estado);
      expect([estado, r.estaActiva(), r.cuentaParaElLimiteSemanal()]).toEqual([estado, activa, cuenta]);
    }
  });
});

describe("Maquina", () => {
  it("exige identificador, laboratorio y código", () => {
    expect(() => Maquina.reconstituir({ id: "m1", idLaboratorio: "", codigo: "C1-01", enServicio: true })).toThrow(DatoInvalido);
  });

  it("fuera de servicio no se puede reservar (RN-20)", () => {
    expect(() => Maquina.reconstituir({ id: "m1", idLaboratorio: "c1", codigo: "C1-01", enServicio: false }).verificarReservable()).toThrow(MaquinaFueraDeServicio);
    expect(() => Maquina.reconstituir({ id: "m1", idLaboratorio: "c1", codigo: "C1-01", enServicio: true }).verificarReservable()).not.toThrow();
  });
});

describe("AgendaDeLaMaquina", () => {
  it("solo admite reservas de esa máquina", () => {
    expect(() => AgendaDeLaMaquina.de("m1", [guardada("r", franja("2026-11-24", "14:00", "15:00"), "ACTIVA", "ana", "m2")])).toThrow(DatoInvalido);
  });

  it("una reserva activa ocupa la máquina; una cancelada, liberada o finalizada no (I1)", () => {
    const f = franja("2026-11-24", "14:00", "16:00");
    expect(() => AgendaDeLaMaquina.de("m1", [guardada("r", f, "ACTIVA")]).verificarLibre(franja("2026-11-24", "15:00", "16:00"))).toThrow(MaquinaNoDisponible);
    for (const estado of ["CANCELADA_POR_SISTEMA", "LIBERADA", "FINALIZADA"] as const) {
      expect(() => AgendaDeLaMaquina.de("m1", [guardada("r", f, estado)]).verificarLibre(f)).not.toThrow();
    }
  });

  it("reservas contiguas no chocan", () => {
    const agenda = AgendaDeLaMaquina.de("m1", [guardada("r", franja("2026-11-24", "14:00", "16:00"), "ACTIVA")]);
    expect(() => agenda.verificarLibre(franja("2026-11-24", "16:00", "17:00"))).not.toThrow();
  });
});

describe("CupoSemanalDelEstudiante", () => {
  const semana = Semana.deLaFecha(Fecha.desdeTexto("2026-11-24"));
  const nuevaDe = (inicio: string, fin: string) => crear(franja("2026-11-25", inicio, fin));

  it("rechaza si ya hay una reserva activa (6a)", () => {
    const activa = guardada("a", franja("2026-11-26", "08:00", "09:00"), "ACTIVA");
    expect(() => CupoSemanalDelEstudiante.de({ idEstudiante: "ana", semana, reservasDeLaSemana: [activa], reservaActiva: activa }).verificarQueAdmite(nuevaDe("08:00", "09:00"))).toThrow(
      YaTieneReservaActiva
    );
  });

  it("suma las que cuentan y rechaza al pasar de 6 h (6b)", () => {
    const cupo = CupoSemanalDelEstudiante.de({
      idEstudiante: "ana",
      semana,
      reservasDeLaSemana: [
        guardada("f", franja("2026-11-23", "07:00", "09:00"), "FINALIZADA"),
        guardada("l", franja("2026-11-23", "09:00", "11:00"), "LIBERADA"),
        guardada("c", franja("2026-11-23", "11:00", "13:00"), "CANCELADA_POR_SISTEMA")
      ],
      reservaActiva: null
    });
    expect(cupo.minutosReservados).toBe(240); // la cancelada no cuenta
    expect(() => cupo.verificarQueAdmite(nuevaDe("08:00", "10:00"))).not.toThrow(); // 4 h + 2 h = 6 h exactas
  });

  it("detalla las horas al pasar el límite", () => {
    const cupo = CupoSemanalDelEstudiante.de({
      idEstudiante: "ana",
      semana,
      reservasDeLaSemana: [guardada("f1", franja("2026-11-23", "07:00", "09:00"), "FINALIZADA"), guardada("f2", franja("2026-11-23", "09:00", "11:00"), "FINALIZADA"), guardada("f3", franja("2026-11-23", "13:00", "14:00"), "FINALIZADA")],
      reservaActiva: null
    });
    expect(() => cupo.verificarQueAdmite(nuevaDe("08:00", "10:00"))).toThrow(LimiteSemanalDeReservaExcedido);
  });

  it("solo admite reservas del estudiante y de esa semana", () => {
    expect(() =>
      CupoSemanalDelEstudiante.de({ idEstudiante: "ana", semana, reservasDeLaSemana: [guardada("x", franja("2026-11-23", "07:00", "08:00"), "FINALIZADA", "beto")], reservaActiva: null })
    ).toThrow(DatoInvalido);
    expect(() =>
      CupoSemanalDelEstudiante.de({ idEstudiante: "ana", semana, reservasDeLaSemana: [guardada("x", franja("2026-11-30", "07:00", "08:00"), "FINALIZADA")], reservaActiva: null })
    ).toThrow(DatoInvalido);
  });
});
