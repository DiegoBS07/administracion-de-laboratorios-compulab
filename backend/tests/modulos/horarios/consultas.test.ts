// Consultas del módulo horarios (docs/08-componentes.md, 8.4): cobertura, horario y asistentes.
import { describe, expect, it } from "vitest";
import { DatoInvalido, Fecha, Franja, Hora } from "../../../src/compartido/dominio/index.js";
import {
  type CatalogoDeLaboratorios,
  ConsultarAsistentesDelLaboratorio,
  ConsultarCobertura,
  ConsultarHorario,
  ConsultarTurnosProgramados,
  type EstadoTurno,
  LaboratorioNoExiste,
  Turno
} from "../../../src/modulos/horarios/index.js";
import { UnidadDeTrabajoEnMemoria } from "../../dobles/unidad-de-trabajo-en-memoria.js";
import { ConsultaAsistentesFija, RepositorioTurnosEnMemoria } from "./dobles.js";

const LABORATORIOS: CatalogoDeLaboratorios = {
  todos: async () => [{ id: "c1", nombre: "Laboratorio 1", campus: "Cartago" }],
  porId: async (id) => (id === "c1" ? { id, nombre: "Laboratorio 1", campus: "Cartago" } : null)
};
const franja = (fecha: string, inicio: string, fin: string) => Franja.delDia(Fecha.desdeTexto(fecha), Hora.desdeTexto(inicio), Hora.desdeTexto(fin));
const turno = (id: string, idAsistente: string | null, fecha: string, inicio: string, fin: string, estado: EstadoTurno) =>
  Turno.reconstituir({ id, idLaboratorio: "c1", idAsistente, franja: franja(fecha, inicio, fin), estado, creadoPor: null, claveSolicitud: null });

const TURNOS = [
  turno("t1", "a1", "2026-11-25", "07:00", "11:00", "ASIGNADO"),
  turno("t2", "a2", "2026-11-25", "11:00", "15:00", "EN_CURSO"), // contiguo: se une con t1
  turno("t3", "a3", "2026-11-25", "17:00", "19:00", "PENDIENTE_ACEPTACION"), // no abre (RN-15)
  turno("t4", null, "2026-11-25", "19:00", "21:00", "VACANTE"), // no abre
  turno("t5", "a1", "2026-11-26", "07:00", "11:00", "ASIGNADO")
];
const repositorio = () => new RepositorioTurnosEnMemoria(new UnidadDeTrabajoEnMemoria(), TURNOS);
const asistente = (id: string, nombre: string) => ({ id, nombre, activo: true, topeSemanalMinutos: 600, disponibilidad: [] });

describe("ConsultarCobertura (contrato de 8.4)", () => {
  const cobertura = () => new ConsultarCobertura({ laboratorios: LABORATORIOS, turnos: repositorio() });

  it("une los turnos asignados o en curso contiguos y descarta pendientes y vacantes", async () => {
    const abiertas = await cobertura().franjasAbiertas("c1", franja("2026-11-25", "00:00", "24:00"));

    expect(abiertas.map(String)).toEqual([franja("2026-11-25", "07:00", "15:00").toString()]);
  });

  it("recorta las franjas al periodo pedido", async () => {
    const abiertas = await cobertura().franjasAbiertas("c1", franja("2026-11-25", "09:00", "12:00"));

    expect(abiertas.map(String)).toEqual([franja("2026-11-25", "09:00", "12:00").toString()]);
  });

  it("un periodo sin turnos devuelve lista vacía y un laboratorio inexistente lanza LaboratorioNoExiste", async () => {
    expect(await cobertura().franjasAbiertas("c1", franja("2026-11-27", "00:00", "24:00"))).toEqual([]);
    await expect(cobertura().franjasAbiertas("x9", franja("2026-11-27", "00:00", "24:00"))).rejects.toBeInstanceOf(LaboratorioNoExiste);
  });
});

describe("ConsultarHorario", () => {
  const consulta = () =>
    new ConsultarHorario({ laboratorios: LABORATORIOS, turnos: repositorio(), asistentes: new ConsultaAsistentesFija([asistente("a1", "Diego"), asistente("a2", "María")]) });

  it("devuelve los turnos de la semana en orden, con el nombre del responsable o null si está vacante", async () => {
    const horario = await consulta().ejecutar("c1", "2026-11-23");

    expect(horario.turnos.map((t) => t.id)).toEqual(["t1", "t2", "t3", "t4", "t5"]);
    expect(horario.turnos[0]?.asistente).toEqual({ id: "a1", nombre: "Diego" });
    expect(horario.turnos[3]?.asistente).toBeNull();
  });

  it("exige que la semana empiece un lunes", async () => {
    await expect(consulta().ejecutar("c1", "2026-11-24")).rejects.toBeInstanceOf(DatoInvalido);
  });
});

describe("ConsultarAsistentesDelLaboratorio", () => {
  it("suma los minutos que ya cuentan para el tope en esa semana (RN-07)", async () => {
    const consulta = new ConsultarAsistentesDelLaboratorio({
      laboratorios: LABORATORIOS,
      turnos: repositorio(),
      asistentes: { activosDe: async () => [{ ...asistente("a1", "Diego"), categoria: "B" }, { ...asistente("a3", "José"), categoria: "A" }] }
    });

    const lista = await consulta.ejecutar("c1", "2026-11-23");

    expect(lista.map((a) => [a.id, a.minutosProgramadosSemana])).toEqual([["a1", 480], ["a3", 120]]);
  });
});

describe("ConsultarTurnosProgramados", () => {
  it("devuelve los turnos de todos los laboratorios que empiezan en el periodo", async () => {
    const turnos = await new ConsultarTurnosProgramados({ turnos: repositorio() }).delPeriodo(franja("2026-11-26", "00:00", "24:00"));

    expect(turnos.map((t) => [t.id, t.idAsistente, t.estado])).toEqual([["t5", "a1", "ASIGNADO"]]);
  });
});
