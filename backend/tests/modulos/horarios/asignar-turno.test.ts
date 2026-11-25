// CU-06 · Asignar un turno a un asistente (docs/04-casos-de-uso.md, 4.2).
// Una prueba por el escenario principal, una por cada poscondición (P1–P7) y una por cada extensión.
import { beforeEach, describe, expect, it } from "vitest";
import { DatoInvalido, Fecha, Franja, Hora } from "../../../src/compartido/dominio/index.js";
import {
  AsignarTurno,
  AsistenteNoActivo,
  AsistenteNoExiste,
  type AsistenteParaHorario,
  ClaveDeSolicitudReutilizada,
  FranjaDeTurnoInvalida,
  FranjaOcupadaEnLaboratorio,
  FueraDelSemestre,
  SinPermisoSobreLaboratorio,
  type SolicitudAsignarTurno,
  TopeSemanalExcedido,
  TraslapeDeTurno,
  Turno,
  TurnoEnElPasado
} from "../../../src/modulos/horarios/index.js";
import { RelojFijo } from "../../dobles/reloj-fijo.js";
import { GeneradorDeIdsSecuencial, NotificadorEnMemoria } from "../../dobles/notificador-en-memoria.js";
import { UnidadDeTrabajoEnMemoria } from "../../dobles/unidad-de-trabajo-en-memoria.js";
import { AutorizacionFija, CalendarioFijo, ConsultaAsistentesFija, RepositorioTurnosEnMemoria } from "./dobles.js";

// Hoy: martes 24 de noviembre de 2026, 10:00. Semestre del 3 de agosto al 12 de diciembre.
const LAURA = { id: "laura" }; // coordina el Laboratorio Cartago 1 (c1)
const MARCO = { id: "marco" }; // coordinador de soporte: todos los laboratorios

const lunesAViernes = (inicio: string, fin: string) => [1, 2, 3, 4, 5].map((dia) => ({ dia, horaInicio: inicio, horaFin: fin }));
const DIEGO: AsistenteParaHorario = { id: "a1", nombre: "Diego Solís", activo: true, topeSemanalMinutos: 20 * 60, disponibilidad: lunesAViernes("07:00", "13:00") };
const ANDRES: AsistenteParaHorario = { id: "a5", nombre: "Andrés Brenes", activo: true, topeSemanalMinutos: 8 * 60, disponibilidad: lunesAViernes("07:00", "12:00") };
const SOFIA: AsistenteParaHorario = { id: "a6", nombre: "Sofía Araya", activo: false, topeSemanalMinutos: 12 * 60, disponibilidad: lunesAViernes("07:00", "21:00") };

function turnoExistente(id: string, lab: string, asistente: string, fecha: string, inicio: string, fin: string): Turno {
  return Turno.reconstituir({
    id,
    idLaboratorio: lab,
    idAsistente: asistente,
    franja: Franja.delDia(Fecha.desdeTexto(fecha), Hora.desdeTexto(inicio), Hora.desdeTexto(fin)),
    estado: "ASIGNADO",
    creadoPor: null,
    claveSolicitud: null
  });
}

let reloj: RelojFijo;
let unidad: UnidadDeTrabajoEnMemoria;
let repositorio: RepositorioTurnosEnMemoria;
let notificador: NotificadorEnMemoria;
let autorizacion: AutorizacionFija;
let calendario: CalendarioFijo;
let asignarTurno: AsignarTurno;

function armar(opciones: { calendario?: CalendarioFijo } = {}) {
  reloj = new RelojFijo("2026-11-24T10:00:00-06:00");
  unidad = new UnidadDeTrabajoEnMemoria();
  repositorio = new RepositorioTurnosEnMemoria(unidad, [
    turnoExistente("t-lun", "c1", "a1", "2026-11-30", "07:00", "13:00"), // Diego: 6 h esta semana
    turnoExistente("t-s1", "s1", "a5", "2026-12-02", "07:00", "11:00") // Andrés: 4 h en San José 1
  ]);
  notificador = new NotificadorEnMemoria();
  autorizacion = new AutorizacionFija({ laura: ["c1"], marco: ["*"] });
  calendario = opciones.calendario ?? new CalendarioFijo("2026-08-03", "2026-12-12");
  asignarTurno = new AsignarTurno({
    autorizacion,
    calendario,
    asistentes: new ConsultaAsistentesFija([DIEGO, ANDRES, SOFIA]),
    turnos: repositorio,
    unidadDeTrabajo: unidad,
    notificador,
    reloj,
    ids: new GeneradorDeIdsSecuencial("t")
  });
}

const solicitud = (cambios: Partial<SolicitudAsignarTurno> = {}): SolicitudAsignarTurno => ({
  idLaboratorio: "c1",
  idAsistente: "a1",
  fecha: "2026-12-04", // viernes
  horaInicio: "08:00",
  horaFin: "12:00",
  claveSolicitud: "clave-1",
  ...cambios
});

/** Espera que la promesa falle y devuelve el error con su tipo (falla la prueba si no hubo error). */
async function errorDe<E extends Error>(promesa: Promise<unknown>, tipo: abstract new (...args: never[]) => E): Promise<E> {
  const resultado = await promesa.then(
    () => null,
    (error: unknown) => error
  );
  expect(resultado).toBeInstanceOf(tipo);
  return resultado as E;
}

/** Garantía mínima: si la asignación falla, el horario queda exactamente como estaba. */
async function esperarRechazo(promesa: Promise<unknown>, tipo: abstract new (...args: never[]) => Error) {
  const antes = repositorio.todos.length;
  await expect(promesa).rejects.toBeInstanceOf(tipo);
  expect(repositorio.todos).toHaveLength(antes);
  expect(notificador.avisos).toHaveLength(0);
}

beforeEach(() => armar());

describe("CU-06 · escenario principal", () => {
  it("registra el turno como asignado y devuelve las horas semanales actualizadas", async () => {
    const resultado = await asignarTurno.ejecutar(LAURA, solicitud());

    expect(resultado.creado).toBe(true);
    expect(resultado.turno).toEqual({
      id: "t-1",
      idLaboratorio: "c1",
      fecha: "2026-12-04",
      horaInicio: "08:00",
      horaFin: "12:00",
      estado: "ASIGNADO",
      asistente: { id: "a1", nombre: "Diego Solís" },
      minutosSemanaAsistente: 6 * 60 + 4 * 60,
      topeSemanalMinutos: 20 * 60
    });
  });

  it("el coordinador de soporte puede asignar en cualquier laboratorio", async () => {
    const resultado = await asignarTurno.ejecutar(MARCO, solicitud({ idLaboratorio: "s2" }));
    expect(resultado.turno.idLaboratorio).toBe("s2");
  });
});

describe("CU-06 · poscondiciones del contrato asignarTurno", () => {
  const nuevo = () => repositorio.todos.find((t) => t.id === "t-1");

  it("P1 · se creó una instancia de Turno", async () => {
    await asignarTurno.ejecutar(LAURA, solicitud());
    expect(repositorio.todos).toHaveLength(3);
    expect(nuevo()).toBeInstanceOf(Turno);
  });

  it("P2 · fecha, hora de inicio y hora de fin fueron asignadas con los valores recibidos", async () => {
    await asignarTurno.ejecutar(LAURA, solicitud());
    expect(nuevo()?.fecha.aTexto()).toBe("2026-12-04");
    expect(nuevo()?.horaInicio.aTexto()).toBe("08:00");
    expect(nuevo()?.horaFin.aTexto()).toBe("12:00");
  });

  it("P3 · se formó la asociación con el laboratorio", async () => {
    await asignarTurno.ejecutar(LAURA, solicitud());
    expect(nuevo()?.idLaboratorio).toBe("c1");
  });

  it("P4 · se formó la asociación con el asistente como único responsable", async () => {
    await asignarTurno.ejecutar(LAURA, solicitud());
    expect(nuevo()?.idAsistente).toBe("a1");
  });

  it("P5 · el estado es ASIGNADO cuando la franja está dentro de la disponibilidad declarada", async () => {
    await asignarTurno.ejecutar(LAURA, solicitud());
    expect(nuevo()?.estado).toBe("ASIGNADO");
  });

  it("P6 · si queda pendiente de aceptación se crea un aviso para el asistente; si no, ninguno", async () => {
    await asignarTurno.ejecutar(LAURA, solicitud());
    expect(notificador.avisos).toHaveLength(0);

    await asignarTurno.ejecutar(LAURA, solicitud({ horaInicio: "14:00", horaFin: "16:00", claveSolicitud: "clave-2" }));
    expect(notificador.avisos).toEqual([
      {
        destinatario: "a1",
        tipo: "TURNO_PENDIENTE_ACEPTACION",
        datos: { idTurno: "t-2", idLaboratorio: "c1", fecha: "2026-12-04", horaInicio: "14:00", horaFin: "16:00" }
      }
    ]);
  });

  it("P7 · la clave de solicitud quedó guardada con el turno", async () => {
    await asignarTurno.ejecutar(LAURA, solicitud());
    expect(nuevo()?.fueCreadoCon("laura", "clave-1")).toBe(true);
  });
});

describe("CU-06 · extensiones", () => {
  it("2a · un coordinador sin permiso sobre el laboratorio no cambia el horario", async () => {
    await esperarRechazo(asignarTurno.ejecutar(LAURA, solicitud({ idLaboratorio: "s1" })), SinPermisoSobreLaboratorio);
    expect(autorizacion.denegados).toEqual([{ idUsuario: "laura", idLaboratorio: "s1" }]);
  });

  it("3a · rechaza una franja cuyo fin no es posterior al inicio", async () => {
    await esperarRechazo(asignarTurno.ejecutar(LAURA, solicitud({ horaInicio: "12:00", horaFin: "12:00" })), FranjaDeTurnoInvalida);
    await esperarRechazo(asignarTurno.ejecutar(LAURA, solicitud({ horaInicio: "13:00", horaFin: "09:00" })), FranjaDeTurnoInvalida);
  });

  it("3b · rechaza una fecha fuera del semestre, o cuando no hay semestre vigente", async () => {
    await esperarRechazo(asignarTurno.ejecutar(LAURA, solicitud({ fecha: "2026-12-18" })), FueraDelSemestre);
    armar({ calendario: new CalendarioFijo(null) });
    await esperarRechazo(asignarTurno.ejecutar(LAURA, solicitud()), FueraDelSemestre);
  });

  it("3c · rechaza un turno que ya empezó o ya pasó", async () => {
    await esperarRechazo(asignarTurno.ejecutar(LAURA, solicitud({ fecha: "2026-11-24", horaInicio: "09:00", horaFin: "11:00" })), TurnoEnElPasado);
    await esperarRechazo(asignarTurno.ejecutar(LAURA, solicitud({ fecha: "2026-11-23" })), TurnoEnElPasado);
  });

  it("3d · rechaza a un asistente que no está activo", async () => {
    await esperarRechazo(asignarTurno.ejecutar(LAURA, solicitud({ idAsistente: "a6" })), AsistenteNoActivo);
  });

  it("4a · rechaza un traslape con otro turno del asistente, aunque sea en otro laboratorio y campus", async () => {
    const intento = asignarTurno.ejecutar(LAURA, solicitud({ idAsistente: "a5", fecha: "2026-12-02", horaInicio: "09:00", horaFin: "10:00" }));
    await esperarRechazo(intento, TraslapeDeTurno);
    const error = await errorDe(
      asignarTurno.ejecutar(LAURA, solicitud({ idAsistente: "a5", fecha: "2026-12-02", horaInicio: "09:00", horaFin: "10:00" })),
      TraslapeDeTurno
    );
    expect(error.detalle).toMatchObject({ conflicto: { idTurno: "t-s1", idLaboratorio: "s1" } });
  });

  it("4b · rechaza una franja del laboratorio que ya tiene otro responsable", async () => {
    await esperarRechazo(
      asignarTurno.ejecutar(LAURA, solicitud({ idAsistente: "a5", fecha: "2026-11-30", horaInicio: "08:00", horaFin: "10:00" })),
      FranjaOcupadaEnLaboratorio
    );
  });

  it("4c · rechaza un turno que haría superar el tope semanal, con el detalle de horas", async () => {
    const error = await errorDe(
      asignarTurno.ejecutar(LAURA, solicitud({ idAsistente: "a5", fecha: "2026-12-03", horaInicio: "07:00", horaFin: "12:00" })),
      TopeSemanalExcedido
    );
    expect(error.detalle).toEqual({ minutosProgramados: 240, minutosDelTurno: 300, topeSemanalMinutos: 480, semana: "2026-11-30" });
    expect(repositorio.todos).toHaveLength(2);
  });

  it("4c · llegar exactamente al tope sí se permite", async () => {
    const resultado = await asignarTurno.ejecutar(LAURA, solicitud({ idAsistente: "a5", fecha: "2026-12-03", horaInicio: "07:00", horaFin: "11:00" }));
    expect(resultado.turno.minutosSemanaAsistente).toBe(480);
  });

  it("4d · fuera de la disponibilidad declarada queda pendiente de aceptación y se avisa al asistente", async () => {
    const resultado = await asignarTurno.ejecutar(LAURA, solicitud({ horaInicio: "14:00", horaFin: "16:00" }));
    expect(resultado.turno.estado).toBe("PENDIENTE_ACEPTACION");
    expect(notificador.avisos.map((a) => a.tipo)).toEqual(["TURNO_PENDIENTE_ACEPTACION"]);
  });

  it("5a · dos asignaciones simultáneas al mismo asistente no pasan juntas el tope", async () => {
    // Andrés tiene 4 h de 8 h. Cada turno de 3 h cabe solo; los dos juntos (10 h) no.
    const resultados = await Promise.allSettled([
      asignarTurno.ejecutar(LAURA, solicitud({ idAsistente: "a5", fecha: "2026-12-03", horaInicio: "07:00", horaFin: "10:00", claveSolicitud: "x" })),
      asignarTurno.ejecutar(MARCO, solicitud({ idAsistente: "a5", idLaboratorio: "c2", fecha: "2026-12-04", horaInicio: "07:00", horaFin: "10:00", claveSolicitud: "y" }))
    ]);
    expect(resultados.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const rechazo = resultados.find((r) => r.status === "rejected");
    expect(rechazo?.status === "rejected" && rechazo.reason).toBeInstanceOf(TopeSemanalExcedido);
    expect(repositorio.todos).toHaveLength(3);
  });

  it("5a · dos asistentes distintos en la misma franja del laboratorio al mismo tiempo: solo uno queda", async () => {
    const resultados = await Promise.allSettled([
      asignarTurno.ejecutar(LAURA, solicitud({ idAsistente: "a1", fecha: "2026-12-03", horaInicio: "08:00", horaFin: "10:00", claveSolicitud: "x" })),
      asignarTurno.ejecutar(MARCO, solicitud({ idAsistente: "a5", fecha: "2026-12-03", horaInicio: "09:00", horaFin: "11:00", claveSolicitud: "y" }))
    ]);
    expect(resultados.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const rechazo = resultados.find((r) => r.status === "rejected");
    expect(rechazo?.status === "rejected" && rechazo.reason).toBeInstanceOf(FranjaOcupadaEnLaboratorio);
    expect(repositorio.todos.filter((t) => t.fecha.aTexto() === "2026-12-03")).toHaveLength(1);
  });

  it("5b · un reenvío con la misma clave devuelve el turno ya creado sin crear otro", async () => {
    const primero = await asignarTurno.ejecutar(LAURA, solicitud());
    const reenvio = await asignarTurno.ejecutar(LAURA, solicitud());

    expect(reenvio.creado).toBe(false);
    expect(reenvio.turno).toEqual(primero.turno);
    expect(repositorio.todos).toHaveLength(3);
  });

  it("5b · reutilizar la clave con otros datos se rechaza", async () => {
    await asignarTurno.ejecutar(LAURA, solicitud());
    await esperarRechazo(asignarTurno.ejecutar(LAURA, solicitud({ horaFin: "11:00" })), ClaveDeSolicitudReutilizada);
  });
});

describe("CU-06 · precondiciones y formato", () => {
  it("rechaza un asistente que no existe", async () => {
    await esperarRechazo(asignarTurno.ejecutar(LAURA, solicitud({ idAsistente: "nadie" })), AsistenteNoExiste);
  });

  it("rechaza fechas, horas o clave con formato inválido", async () => {
    await esperarRechazo(asignarTurno.ejecutar(LAURA, solicitud({ fecha: "04/12/2026" })), DatoInvalido);
    await esperarRechazo(asignarTurno.ejecutar(LAURA, solicitud({ horaInicio: "8:00" })), DatoInvalido);
    await esperarRechazo(asignarTurno.ejecutar(LAURA, solicitud({ claveSolicitud: " " })), DatoInvalido);
  });

  it("los errores traen el código que usa la API (8.7)", async () => {
    const error = await errorDe(asignarTurno.ejecutar(LAURA, solicitud({ idLaboratorio: "s1" })), SinPermisoSobreLaboratorio);
    expect(error.codigo).toBe("SIN_PERMISO_SOBRE_LABORATORIO");
  });
});
