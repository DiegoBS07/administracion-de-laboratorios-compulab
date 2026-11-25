// Invariantes de las clases de dominio del módulo horarios (docs/09-clases.md, 9.2).
import { describe, expect, it } from "vitest";
import { DatoInvalido, Fecha, Franja, Hora, Instante, Semana } from "../../../src/compartido/dominio/index.js";
import { AgendaDelAsistente } from "../../../src/modulos/horarios/dominio/agenda-del-asistente.js";
import { AgendaDelLaboratorio } from "../../../src/modulos/horarios/dominio/agenda-del-laboratorio.js";
import { Disponibilidad } from "../../../src/modulos/horarios/dominio/disponibilidad.js";
import type { EstadoTurno } from "../../../src/modulos/horarios/dominio/estado-turno.js";
import { AsistenteNoActivo, FranjaOcupadaEnLaboratorio, TopeSemanalExcedido, TraslapeDeTurno } from "../../../src/modulos/horarios/dominio/errores.js";
import { Turno } from "../../../src/modulos/horarios/dominio/turno.js";

const VIERNES = Fecha.desdeTexto("2026-12-04");
const franja = (inicio: string, fin: string, fecha = VIERNES) => Franja.delDia(fecha, Hora.desdeTexto(inicio), Hora.desdeTexto(fin));

function turno(id: string, inicio: string, fin: string, estado: EstadoTurno = "ASIGNADO", fecha = VIERNES, asistente: string | null = "a1", lab = "c1"): Turno {
  return Turno.reconstituir({ id, idLaboratorio: lab, idAsistente: asistente, franja: franja(inicio, fin, fecha), estado, creadoPor: null, claveSolicitud: null });
}

function agenda(turnos: Turno[], opciones: { activo?: boolean; tope?: number } = {}) {
  return AgendaDelAsistente.de({
    idAsistente: "a1",
    activo: opciones.activo ?? true,
    topeSemanalMinutos: opciones.tope ?? 600,
    disponibilidad: Disponibilidad.de([{ dia: 5, horaInicio: "07:00", horaFin: "13:00" }]),
    semana: Semana.deLaFecha(VIERNES),
    turnos
  });
}

describe("Turno", () => {
  it("se asigna ASIGNADO o PENDIENTE_ACEPTACION según la disponibilidad (RN-08)", () => {
    const base = { id: "t", idLaboratorio: "c1", idAsistente: "a1", franja: franja("08:00", "12:00"), creadoPor: "laura", claveSolicitud: "k" };
    expect(Turno.asignar({ ...base, dentroDeDisponibilidad: true }).estado).toBe("ASIGNADO");
    expect(Turno.asignar({ ...base, dentroDeDisponibilidad: false }).estado).toBe("PENDIENTE_ACEPTACION");
  });

  it("exige identificadores y clave de solicitud no vacíos", () => {
    const base = { id: "t", idLaboratorio: "c1", idAsistente: "a1", franja: franja("08:00", "12:00"), creadoPor: "laura", claveSolicitud: "k", dentroDeDisponibilidad: true };
    expect(() => Turno.asignar({ ...base, id: "" })).toThrow(DatoInvalido);
    expect(() => Turno.asignar({ ...base, idAsistente: " " })).toThrow(DatoInvalido);
    expect(() => Turno.asignar({ ...base, claveSolicitud: "" })).toThrow(DatoInvalido);
  });

  it("tiene exactamente un responsable; solo un turno VACANTE no tiene asistente (I4, SUP-01)", () => {
    expect(() => turno("t", "08:00", "12:00", "ASIGNADO", VIERNES, null)).toThrow(DatoInvalido);
    expect(() => turno("t", "08:00", "12:00", "VACANTE", VIERNES, "a1")).toThrow(DatoInvalido);
    expect(turno("t", "08:00", "12:00", "VACANTE", VIERNES, null).idAsistente).toBeNull();
  });

  it("empieza y termina el mismo día (SUP-21); puede terminar a las 24:00", () => {
    const dosDias = Franja.de(Instante.desdeISO("2026-12-04T22:00:00-06:00"), Instante.desdeISO("2026-12-05T02:00:00-06:00"));
    expect(() => Turno.reconstituir({ id: "t", idLaboratorio: "c1", idAsistente: "a1", franja: dosDias, estado: "ASIGNADO", creadoPor: null, claveSolicitud: null })).toThrow(DatoInvalido);
    expect(turno("t", "20:00", "24:00").horaFin.aTexto()).toBe("24:00");
  });

  it("los vacantes y descartados no ocupan su franja; los demás estados sí", () => {
    expect(turno("t", "08:00", "12:00", "VACANTE", VIERNES, null).ocupaLaFranja()).toBe(false);
    expect(turno("t", "08:00", "12:00", "DESCARTADO").ocupaLaFranja()).toBe(false);
    for (const estado of ["PENDIENTE_ACEPTACION", "ASIGNADO", "EN_CURSO", "CUBIERTO", "NO_CUBIERTO", "MARCA_INCOMPLETA"] as const) {
      expect(turno("t", "08:00", "12:00", estado).ocupaLaFranja()).toBe(true);
    }
  });

  it("solo los asignados y en curso abren el laboratorio (RN-15)", () => {
    expect(turno("t", "08:00", "12:00", "ASIGNADO").abreElLaboratorio()).toBe(true);
    expect(turno("t", "08:00", "12:00", "PENDIENTE_ACEPTACION").abreElLaboratorio()).toBe(false);
  });
});

describe("Disponibilidad", () => {
  it("cubre una franja dentro de un bloque del mismo día de la semana", () => {
    const d = Disponibilidad.de([{ dia: 5, horaInicio: "07:00", horaFin: "13:00" }]);
    expect(d.cubre(franja("08:00", "12:00"))).toBe(true);
    expect(d.cubre(franja("12:00", "14:00"))).toBe(false);
    expect(d.cubre(franja("08:00", "12:00", Fecha.desdeTexto("2026-12-03")))).toBe(false); // jueves
  });

  it("considera uno solo los bloques contiguos del mismo día", () => {
    const d = Disponibilidad.de([
      { dia: 5, horaInicio: "07:00", horaFin: "10:00" },
      { dia: 5, horaInicio: "10:00", horaFin: "13:00" }
    ]);
    expect(d.cubre(franja("09:00", "11:00"))).toBe(true);
  });

  it("rechaza bloques con día o horas inválidos", () => {
    expect(() => Disponibilidad.de([{ dia: 8, horaInicio: "07:00", horaFin: "10:00" }])).toThrow(DatoInvalido);
    expect(() => Disponibilidad.de([{ dia: 1, horaInicio: "10:00", horaFin: "07:00" }])).toThrow(DatoInvalido);
  });
});

describe("AgendaDelAsistente", () => {
  it("exige un tope entero mayor que cero (RN-03)", () => {
    expect(() => agenda([], { tope: 0 })).toThrow(DatoInvalido);
    expect(() => agenda([], { tope: 90.5 })).toThrow(DatoInvalido);
  });

  it("solo admite turnos del asistente y de esa semana", () => {
    expect(() => agenda([turno("t", "08:00", "10:00", "ASIGNADO", VIERNES, "a5")])).toThrow(DatoInvalido);
    expect(() => agenda([turno("t", "08:00", "10:00", "ASIGNADO", Fecha.desdeTexto("2026-12-11"))])).toThrow(DatoInvalido);
  });

  it("para el tope cuenta los turnos ya trabajados y los pendientes, pero no los descartados (RN-07)", () => {
    // Los vacantes ya no tienen responsable, así que nunca llegan a la agenda de un asistente.
    const lunes = Fecha.desdeTexto("2026-11-30");
    const a = agenda([
      turno("c", "07:00", "09:00", "CUBIERTO", lunes),
      turno("p", "09:00", "10:00", "PENDIENTE_ACEPTACION", lunes),
      turno("d", "10:00", "12:00", "DESCARTADO", lunes)
    ]);
    expect(a.minutosProgramados).toBe(180);
  });

  it("evalúa en orden: activo, traslape, tope; y dice si está en la disponibilidad", () => {
    expect(() => agenda([], { activo: false }).evaluar(franja("08:00", "10:00"))).toThrow(AsistenteNoActivo);
    expect(() => agenda([turno("t", "09:00", "11:00")]).evaluar(franja("08:00", "10:00"))).toThrow(TraslapeDeTurno);
    expect(() => agenda([turno("t", "07:00", "13:00")], { tope: 480 }).evaluar(franja("14:00", "17:00"))).toThrow(TopeSemanalExcedido);
    expect(agenda([]).evaluar(franja("08:00", "10:00"))).toEqual({ dentroDeDisponibilidad: true });
    expect(agenda([]).evaluar(franja("15:00", "17:00"))).toEqual({ dentroDeDisponibilidad: false });
  });

  it("un turno descartado no provoca traslape", () => {
    expect(agenda([turno("t", "08:00", "10:00", "DESCARTADO")]).evaluar(franja("08:00", "10:00")).dentroDeDisponibilidad).toBe(true);
  });
});

describe("AgendaDelLaboratorio", () => {
  it("solo admite turnos de ese laboratorio", () => {
    expect(() => AgendaDelLaboratorio.de("c1", [turno("t", "08:00", "10:00", "ASIGNADO", VIERNES, "a1", "c2")])).toThrow(DatoInvalido);
  });

  it("detecta una franja ocupada por otro responsable (RN-09) pero ignora vacantes y descartados", () => {
    const agendaLab = AgendaDelLaboratorio.de("c1", [
      turno("t1", "08:00", "10:00"),
      turno("t2", "13:00", "15:00", "VACANTE", VIERNES, null),
      turno("t3", "16:00", "18:00", "DESCARTADO")
    ]);
    expect(() => agendaLab.verificarLibre(franja("09:00", "11:00"))).toThrow(FranjaOcupadaEnLaboratorio);
    expect(() => agendaLab.verificarLibre(franja("10:00", "12:00"))).not.toThrow();
    expect(() => agendaLab.verificarLibre(franja("13:00", "15:00"))).not.toThrow();
    expect(() => agendaLab.verificarLibre(franja("16:00", "18:00"))).not.toThrow();
  });
});
