// Presentador del horario y la asignación de turnos (CU-06), sin renderizar.
import { describe, expect, it } from "vitest";
import { ErrorDeApi } from "../../compartido/api/cliente";
import type { AsistenteParaElegir, HorarioSemanal } from "../../compartido/api/tipos";
import {
  bloquesDelDia,
  confirmacionDeTurno,
  evaluarAsistente,
  horaPasada,
  mensajeDeErrorDeTurno,
  primerInicio,
  propuestaDesde,
  revisarPropuesta,
  semanaVista
} from "./presentador";

const HORARIO: HorarioSemanal = {
  idLaboratorio: "c1",
  semana: "2026-11-23",
  turnos: [
    { id: "t1", fecha: "2026-11-25", horaInicio: "07:00", horaFin: "11:00", estado: "ASIGNADO", asistente: { id: "a1", nombre: "Diego" } },
    { id: "t2", fecha: "2026-11-25", horaInicio: "11:00", horaFin: "15:00", estado: "PENDIENTE_ACEPTACION", asistente: { id: "a2", nombre: "María" } },
    { id: "t3", fecha: "2026-11-25", horaInicio: "17:00", horaFin: "21:00", estado: "DESCARTADO", asistente: { id: "a3", nombre: "José" } },
    { id: "t4", fecha: "2026-11-24", horaInicio: "07:00", horaFin: "11:00", estado: "EN_CURSO", asistente: { id: "a1", nombre: "Diego" } }
  ]
};
const asistente = (id: string, nombre: string, programados: number, tope: number, disponibilidad: AsistenteParaElegir["disponibilidad"]): AsistenteParaElegir => ({
  id,
  nombre,
  categoria: "A",
  topeSemanalMinutos: tope,
  minutosProgramadosSemana: programados,
  disponibilidad
});
const LAURA = asistente("a7", "Laura", 0, 900, [{ dia: 3, horaInicio: "07:00", horaFin: "21:00" }]);
const JOSE = asistente("a3", "José", 840, 900, [{ dia: 3, horaInicio: "16:00", horaFin: "21:00" }]);
const DIEGO = asistente("a1", "Diego", 480, 1200, [{ dia: 3, horaInicio: "07:00", horaFin: "13:00" }]);

describe("semana y cuadrícula", () => {
  it("titula la semana y marca hoy; no deja ir a semanas pasadas", () => {
    const semana = semanaVista("2026-11-23", "2026-11-24");
    expect(semana.titulo).toBe("Semana del 23 al 29 de noviembre");
    expect(semana.dias[1]).toMatchObject({ etiqueta: "mar 24", detalle: "hoy", esHoy: true });
    expect(semana.puedeIrAtras).toBe(false);
    expect(semanaVista("2026-11-30", "2026-11-24")).toMatchObject({ titulo: "Semana del 30 de noviembre al 6 de diciembre", puedeIrAtras: true });
  });

  it("dibuja los turnos del día en su posición, con insignia si están pendientes, y omite los descartados", () => {
    const bloques = bloquesDelDia(HORARIO, "2026-11-25");
    expect(bloques.map((b) => [b.id, b.arriba, b.alto, b.nota])).toEqual([
      ["t1", 0, 174, null],
      ["t2", 176, 174, "Pendiente de aceptar"]
    ]);
    expect(bloques[1]?.clase).toContain("turno--pendiente");
    expect(bloquesDelDia(HORARIO, "2026-11-24")[0]?.nota).toBe("En curso");
  });

  it("no ofrece horas que ya pasaron", () => {
    expect(horaPasada("2026-11-24", 9, "2026-11-24T10:00:00-06:00")).toBe(true);
    expect(horaPasada("2026-11-24", 11, "2026-11-24T10:00:00-06:00")).toBe(false);
    expect(horaPasada("2026-11-23", 20, "2026-11-24T10:00:00-06:00")).toBe(true);
    expect(primerInicio("2026-11-24", "2026-11-24T10:10:00-06:00")).toBe(10 * 60 + 30);
    expect(primerInicio("2026-11-25", "2026-11-24T10:10:00-06:00")).toBe(7 * 60);
    expect(propuestaDesde("2026-11-25", 20)).toEqual({ fecha: "2026-11-25", ini: 1200, fin: 1260, idAsistente: null });
  });
});

describe("revisión previa (N-7)", () => {
  const propuesta = { fecha: "2026-11-25", ini: 15 * 60, fin: 17 * 60, idAsistente: null };

  it("evalúa a cada asistente: disponible, fuera de disponibilidad o pasaría su tope", () => {
    expect(evaluarAsistente(LAURA, HORARIO, propuesta)).toMatchObject({ estado: "bien", texto: "Disponible en ese horario" });
    expect(evaluarAsistente(JOSE, HORARIO, propuesta)).toMatchObject({ estado: "mal", texto: "Pasaría su tope: 16 h de 15 h" });
    expect(evaluarAsistente(DIEGO, HORARIO, propuesta)).toMatchObject({ estado: "pendiente" });
    expect(evaluarAsistente(DIEGO, HORARIO, { ...propuesta, ini: 10 * 60, fin: 12 * 60 }).texto).toBe("Ya tiene turno de 7:00 a 11:00 en este laboratorio");
  });

  it("bloquea si el horario ya tiene responsable o el elegido no puede, y avisa si quedará pendiente", () => {
    expect(revisarPropuesta({ ...propuesta, ini: 14 * 60 }, HORARIO, [LAURA]).bloqueo).toBe("Ese horario ya tiene responsable en este laboratorio (María, de 11:00 a 15:00).");
    expect(revisarPropuesta({ ...propuesta, idAsistente: "a3" }, HORARIO, [JOSE]).bloqueo).toBe("José llegaría a 16 h esta semana y su tope es de 15 h.");
    expect(revisarPropuesta({ ...propuesta, idAsistente: "a1" }, HORARIO, [DIEGO]).aviso).toMatch(/quedará pendiente hasta que lo acepte/);
    expect(revisarPropuesta({ ...propuesta, idAsistente: "a7" }, HORARIO, [LAURA])).toEqual({ bloqueo: null, aviso: null });
    expect(revisarPropuesta({ ...propuesta, fin: 15 * 60 }, HORARIO, [LAURA]).bloqueo).toBe("La hora de fin debe ser posterior a la de inicio.");
  });

  it("un turno descartado no ocupa la franja", () => {
    expect(revisarPropuesta({ ...propuesta, ini: 17 * 60, fin: 19 * 60 }, HORARIO, [LAURA]).bloqueo).toBeNull();
  });
});

describe("resultado y errores", () => {
  it("confirma la asignación con las horas de la semana o avisa que quedó pendiente", () => {
    const turno = { id: "t9", fecha: "2026-11-25", horaInicio: "15:00", horaFin: "17:00", asistente: { id: "a7", nombre: "Laura" }, minutosSemanaAsistente: 120, topeSemanalMinutos: 900 };
    expect(confirmacionDeTurno({ ...turno, estado: "ASIGNADO" })).toBe("Turno asignado a Laura: ahora tiene 2 h de 15 h esta semana.");
    expect(confirmacionDeTurno({ ...turno, estado: "PENDIENTE_ACEPTACION" })).toBe("El turno quedó pendiente de que Laura lo acepte. Se le avisó.");
  });

  it("explica un traslape con el nombre del asistente, la hora y el laboratorio (tabla de 15.6)", () => {
    const error = new ErrorDeApi(409, "TRASLAPE_DE_TURNO", "x", {
      conflicto: { idTurno: "t1", idLaboratorio: "c2", idAsistente: "a1", inicio: "2026-11-25T07:00:00-06:00", fin: "2026-11-25T11:00:00-06:00" }
    });
    const mensaje = mensajeDeErrorDeTurno(error, { laboratorios: [{ id: "c2", nombre: "Laboratorio 2", campus: "Cartago" }], asistentes: [DIEGO], idAsistente: "a1" });

    expect(mensaje.titulo).toBe("Diego ya tiene un turno de 7:00 a 11:00 en Laboratorio 2 (Cartago).");
  });

  it("explica el tope con las horas que tendría", () => {
    const error = new ErrorDeApi(422, "TOPE_SEMANAL_EXCEDIDO", "x", { minutosProgramados: 840, minutosDelTurno: 120, topeSemanalMinutos: 900 });

    expect(mensajeDeErrorDeTurno(error, { laboratorios: [], asistentes: [JOSE], idAsistente: "a3" }).titulo).toBe("José llegaría a 16 h esta semana y su tope es de 15 h.");
  });
});
