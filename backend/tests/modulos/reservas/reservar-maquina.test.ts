// CU-11 · Reservar una máquina (docs/04-casos-de-uso.md, 4.3).
// Una prueba por el escenario principal, una por cada poscondición (P1–P7) y una por cada extensión.
import { beforeEach, describe, expect, it } from "vitest";
import { DatoInvalido, Fecha, Franja, Hora } from "../../../src/compartido/dominio/index.js";
import {
  ClaveDeSolicitudReutilizada,
  ConsultarDisponibilidad,
  type EstadoReserva,
  FranjaDeReservaInvalida,
  FueraDeHorizonteDeReserva,
  LaboratorioCerradoEnFranja,
  LaboratorioNoExiste,
  LimiteSemanalDeReservaExcedido,
  Maquina,
  MaquinaFueraDeServicio,
  MaquinaNoDisponible,
  MaquinaNoExiste,
  Reserva,
  ReservaExcedeDuracion,
  ReservarMaquina,
  type SolicitudReserva,
  YaTieneReservaActiva
} from "../../../src/modulos/reservas/index.js";
import { GeneradorDeIdsSecuencial } from "../../dobles/notificador-en-memoria.js";
import { RelojFijo } from "../../dobles/reloj-fijo.js";
import { UnidadDeTrabajoEnMemoria } from "../../dobles/unidad-de-trabajo-en-memoria.js";
import { CoberturaFija, RepositorioMaquinasEnMemoria, RepositorioReservasEnMemoria } from "./dobles.js";

// Hoy: martes 24 de noviembre de 2026, 10:00. Laboratorio Cartago 1 (c1).
const ANA = { id: "ana" };
const BETO = { id: "beto" };
const DANIEL = { id: "daniel" }; // sin reservas

const iso = (fecha: string, hora: string) => `${fecha}T${hora}:00-06:00`;
const franja = (fecha: string, inicio: string, fin: string) => Franja.delDia(Fecha.desdeTexto(fecha), Hora.desdeTexto(inicio), Hora.desdeTexto(fin));

const maquina = (numero: number, enServicio = true) =>
  Maquina.reconstituir({ id: `m${numero}`, idLaboratorio: "c1", codigo: `C1-0${numero}`, enServicio });

function existente(id: string, estudiante: string, idMaquina: string, fecha: string, inicio: string, fin: string, estado: EstadoReserva): Reserva {
  return Reserva.reconstituir({ id, idEstudiante: estudiante, idMaquina, franja: franja(fecha, inicio, fin), estado, claveSolicitud: null });
}

let unidad: UnidadDeTrabajoEnMemoria;
let reservas: RepositorioReservasEnMemoria;
let reservarMaquina: ReservarMaquina;
let consultarDisponibilidad: ConsultarDisponibilidad;

beforeEach(() => {
  unidad = new UnidadDeTrabajoEnMemoria();
  reservas = new RepositorioReservasEnMemoria(unidad, [
    // Ana: 4 h que cuentan esta semana (finalizada + liberada), 2 h canceladas que no cuentan y 2 h de la semana pasada.
    existente("r-fin", "ana", "m3", "2026-11-23", "09:00", "11:00", "FINALIZADA"),
    existente("r-lib", "ana", "m3", "2026-11-23", "13:00", "15:00", "LIBERADA"),
    existente("r-can", "ana", "m4", "2026-11-23", "15:00", "17:00", "CANCELADA_POR_ESTUDIANTE"),
    existente("r-ant", "ana", "m3", "2026-11-20", "09:00", "11:00", "FINALIZADA"),
    // Beto: 5 h que cuentan esta semana.
    existente("r-b1", "beto", "m3", "2026-11-23", "07:00", "09:00", "FINALIZADA"),
    existente("r-b2", "beto", "m3", "2026-11-23", "11:00", "13:00", "FINALIZADA"),
    existente("r-b3", "beto", "m3", "2026-11-23", "15:00", "16:00", "FINALIZADA"),
    // Carla tiene reservada la C1-01 hoy de 14:00 a 16:00.
    existente("r-carla", "carla", "m1", "2026-11-24", "14:00", "16:00", "ACTIVA")
  ]);
  const maquinas = new RepositorioMaquinasEnMemoria([maquina(1), maquina(2, false), maquina(3), maquina(4)]);
  const cobertura = new CoberturaFija({
    c1: [
      franja("2026-11-24", "07:00", "13:00"),
      franja("2026-11-24", "13:00", "17:00"), // contiguo: hoy abre de 7:00 a 17:00
      franja("2026-11-25", "07:00", "11:00"),
      franja("2026-11-25", "13:00", "21:00"), // mañana cierra de 11:00 a 13:00
      franja("2026-11-30", "08:00", "12:00"),
      franja("2026-12-01", "08:00", "12:00")
    ]
  });
  const reloj = new RelojFijo("2026-11-24T10:00:00-06:00");
  reservarMaquina = new ReservarMaquina({ maquinas, reservas, cobertura, unidadDeTrabajo: unidad, reloj, ids: new GeneradorDeIdsSecuencial("r") });
  consultarDisponibilidad = new ConsultarDisponibilidad({ maquinas, reservas, cobertura });
});

const solicitud = (cambios: Partial<SolicitudReserva> = {}): SolicitudReserva => ({
  idMaquina: "m4",
  inicio: iso("2026-11-24", "14:00"),
  fin: iso("2026-11-24", "16:00"),
  claveSolicitud: "clave-1",
  ...cambios
});

/** Garantía mínima: si la reserva falla, no queda nada registrado. */
async function esperarRechazo(promesa: Promise<unknown>, tipo: abstract new (...args: never[]) => Error) {
  const antes = reservas.todas.length;
  await expect(promesa).rejects.toBeInstanceOf(tipo);
  expect(reservas.todas).toHaveLength(antes);
}

async function errorDe<E extends Error>(promesa: Promise<unknown>, tipo: abstract new (...args: never[]) => E): Promise<E> {
  const resultado = await promesa.then(
    () => null,
    (error: unknown) => error
  );
  expect(resultado).toBeInstanceOf(tipo);
  return resultado as E;
}

const nueva = () => reservas.todas.find((r) => r.id === "r-1");

describe("CU-11 · escenario principal", () => {
  it("registra la reserva activa con su hora límite de presentación", async () => {
    const resultado = await reservarMaquina.ejecutar(ANA, solicitud());
    expect(resultado).toEqual({
      creada: true,
      reserva: {
        id: "r-1",
        idMaquina: "m4",
        inicio: "2026-11-24T14:00:00-06:00",
        fin: "2026-11-24T16:00:00-06:00",
        estado: "ACTIVA",
        limitePresentacion: "2026-11-24T14:15:00-06:00"
      }
    });
  });

  it("una reserva que pasa de un turno al siguiente está cubierta (turnos contiguos, RN-15)", async () => {
    const resultado = await reservarMaquina.ejecutar(ANA, solicitud({ inicio: iso("2026-11-24", "12:00"), fin: iso("2026-11-24", "14:00") }));
    expect(resultado.creada).toBe(true);
  });
});

describe("CU-11 · poscondiciones del contrato reservarMaquina", () => {
  it("P1 · se creó una instancia de Reserva", async () => {
    await reservarMaquina.ejecutar(ANA, solicitud());
    expect(nueva()).toBeInstanceOf(Reserva);
  });

  it("P2 · inicio y fin fueron asignados con los valores recibidos", async () => {
    await reservarMaquina.ejecutar(ANA, solicitud());
    expect(nueva()?.franja.esIgualA(franja("2026-11-24", "14:00", "16:00"))).toBe(true);
  });

  it("P3 · se formó la asociación con la máquina", async () => {
    await reservarMaquina.ejecutar(ANA, solicitud());
    expect(nueva()?.idMaquina).toBe("m4");
  });

  it("P4 · se formó la asociación con el estudiante", async () => {
    await reservarMaquina.ejecutar(ANA, solicitud());
    expect(nueva()?.idEstudiante).toBe("ana");
  });

  it("P5 · el estado es ACTIVA", async () => {
    await reservarMaquina.ejecutar(ANA, solicitud());
    expect(nueva()?.estado).toBe("ACTIVA");
  });

  it("P6 · el límite de presentación es el inicio más 15 minutos", async () => {
    await reservarMaquina.ejecutar(ANA, solicitud());
    expect(nueva()?.limitePresentacion.aISO()).toBe("2026-11-24T14:15:00-06:00");
  });

  it("P7 · la clave de solicitud quedó guardada con la reserva", async () => {
    await reservarMaquina.ejecutar(ANA, solicitud());
    expect(nueva()?.fueCreadaCon("ana", "clave-1")).toBe(true);
  });
});

describe("CU-11 · extensiones", () => {
  it("2a · un día sin franjas abiertas se informa con la lista vacía (ConsultarDisponibilidad)", async () => {
    const domingo = await consultarDisponibilidad.ejecutar("c1", "2026-11-29");
    expect(domingo.franjasAbiertas).toEqual([]);
    expect(domingo.maquinas.map((m) => m.codigo)).toEqual(["C1-01", "C1-02", "C1-03", "C1-04"]);
  });

  it("4a · rechaza una reserva que empieza en el pasado o que no termina después de empezar", async () => {
    await esperarRechazo(reservarMaquina.ejecutar(ANA, solicitud({ inicio: iso("2026-11-24", "09:00"), fin: iso("2026-11-24", "10:30") })), FranjaDeReservaInvalida);
    await esperarRechazo(reservarMaquina.ejecutar(ANA, solicitud({ inicio: iso("2026-11-24", "14:00"), fin: iso("2026-11-24", "14:00") })), FranjaDeReservaInvalida);
  });

  it("4b · rechaza una reserva para más allá de los próximos 6 días; el sexto día sí se permite", async () => {
    const error = await errorDe(reservarMaquina.ejecutar(ANA, solicitud({ inicio: iso("2026-12-01", "08:00"), fin: iso("2026-12-01", "10:00") })), FueraDeHorizonteDeReserva);
    expect(error.detalle).toMatchObject({ fechaMaxima: "2026-11-30" });
    const sextoDia = await reservarMaquina.ejecutar(ANA, solicitud({ inicio: iso("2026-11-30", "08:00"), fin: iso("2026-11-30", "10:00"), claveSolicitud: "k" }));
    expect(sextoDia.creada).toBe(true);
  });

  it("4c · rechaza una reserva de más de 2 horas", async () => {
    await esperarRechazo(reservarMaquina.ejecutar(ANA, solicitud({ inicio: iso("2026-11-24", "13:00"), fin: iso("2026-11-24", "15:30") })), ReservaExcedeDuracion);
  });

  it("4d · rechaza una franja que no está cubierta completa por turnos, e informa las franjas abiertas", async () => {
    const error = await errorDe(
      reservarMaquina.ejecutar(ANA, solicitud({ inicio: iso("2026-11-25", "10:00"), fin: iso("2026-11-25", "12:00") })),
      LaboratorioCerradoEnFranja
    );
    expect(error.detalle).toEqual({
      idLaboratorio: "c1",
      franjasAbiertas: [
        { inicio: "2026-11-25T07:00:00-06:00", fin: "2026-11-25T11:00:00-06:00" },
        { inicio: "2026-11-25T13:00:00-06:00", fin: "2026-11-25T21:00:00-06:00" }
      ]
    });
    expect(reservas.todas.filter((r) => r.idEstudiante === "ana" && r.estaActiva())).toHaveLength(0);
  });

  it("5a · rechaza una máquina fuera de servicio", async () => {
    await esperarRechazo(reservarMaquina.ejecutar(ANA, solicitud({ idMaquina: "m2" })), MaquinaFueraDeServicio);
  });

  it("5b · rechaza una máquina que ya tiene una reserva que se traslapa", async () => {
    await esperarRechazo(reservarMaquina.ejecutar(ANA, solicitud({ idMaquina: "m1", inicio: iso("2026-11-24", "15:00"), fin: iso("2026-11-24", "16:00") })), MaquinaNoDisponible);
  });

  it("6a · rechaza a un estudiante que ya tiene una reserva activa", async () => {
    await reservarMaquina.ejecutar(ANA, solicitud());
    const error = await errorDe(
      reservarMaquina.ejecutar(ANA, solicitud({ idMaquina: "m3", inicio: iso("2026-11-25", "07:00"), fin: iso("2026-11-25", "08:00"), claveSolicitud: "otra" })),
      YaTieneReservaActiva
    );
    expect(error.detalle).toMatchObject({ idReservaActiva: "r-1" });
  });

  it("6b · rechaza una reserva que haría superar 6 horas en la semana, con el detalle", async () => {
    const error = await errorDe(reservarMaquina.ejecutar(BETO, solicitud()), LimiteSemanalDeReservaExcedido);
    expect(error.detalle).toEqual({ minutosReservados: 300, minutosDeLaReserva: 120, limiteSemanalMinutos: 360, semana: "2026-11-23" });
  });

  it("6b · llegar exactamente a 6 horas sí se permite; las canceladas y las de otra semana no cuentan", async () => {
    // Ana tiene 4 h que cuentan (más 2 h canceladas y 2 h de la semana pasada): 4 h + 2 h = 6 h.
    const resultado = await reservarMaquina.ejecutar(ANA, solicitud());
    expect(resultado.creada).toBe(true);
  });

  it("7a · dos estudiantes reservan la misma máquina y franja al mismo tiempo: solo una se confirma", async () => {
    const resultados = await Promise.allSettled([
      reservarMaquina.ejecutar(ANA, solicitud({ claveSolicitud: "a" })),
      reservarMaquina.ejecutar(DANIEL, solicitud({ claveSolicitud: "d" }))
    ]);
    expect(resultados.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const rechazo = resultados.find((r) => r.status === "rejected");
    expect(rechazo?.status === "rejected" && rechazo.reason).toBeInstanceOf(MaquinaNoDisponible);
    expect(reservas.todas.filter((r) => r.idMaquina === "m4" && r.estaActiva())).toHaveLength(1);
  });

  it("7b · un reenvío con la misma clave devuelve la reserva ya creada sin crear otra", async () => {
    const primera = await reservarMaquina.ejecutar(ANA, solicitud());
    const reenvio = await reservarMaquina.ejecutar(ANA, solicitud());
    expect(reenvio).toEqual({ creada: false, reserva: primera.reserva });
    expect(reservas.todas.filter((r) => r.idEstudiante === "ana" && r.estaActiva())).toHaveLength(1);
  });

  it("7b · reutilizar la clave con otros datos se rechaza", async () => {
    await reservarMaquina.ejecutar(ANA, solicitud());
    await esperarRechazo(reservarMaquina.ejecutar(ANA, solicitud({ idMaquina: "m3" })), ClaveDeSolicitudReutilizada);
  });

  it("7c · el mismo estudiante envía dos reservas distintas al mismo tiempo: solo una se confirma", async () => {
    const resultados = await Promise.allSettled([
      reservarMaquina.ejecutar(ANA, solicitud({ idMaquina: "m4", claveSolicitud: "a" })),
      reservarMaquina.ejecutar(ANA, solicitud({ idMaquina: "m3", claveSolicitud: "b" }))
    ]);
    expect(resultados.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const rechazo = resultados.find((r) => r.status === "rejected");
    expect(rechazo?.status === "rejected" && rechazo.reason).toBeInstanceOf(YaTieneReservaActiva);
    expect(reservas.todas.filter((r) => r.idEstudiante === "ana" && r.estaActiva())).toHaveLength(1);
  });
});

describe("CU-11 · precondiciones y formato", () => {
  it("rechaza una máquina que no existe", async () => {
    await esperarRechazo(reservarMaquina.ejecutar(ANA, solicitud({ idMaquina: "m9" })), MaquinaNoExiste);
  });

  it("rechaza instantes sin zona horaria o sin clave de solicitud", async () => {
    await esperarRechazo(reservarMaquina.ejecutar(ANA, solicitud({ inicio: "2026-11-24T14:00:00" })), DatoInvalido);
    await esperarRechazo(reservarMaquina.ejecutar(ANA, solicitud({ claveSolicitud: "" })), DatoInvalido);
  });

  it("los errores traen el código que usa la API (8.7)", async () => {
    const error = await errorDe(reservarMaquina.ejecutar(ANA, solicitud({ idMaquina: "m2" })), MaquinaFueraDeServicio);
    expect(error.codigo).toBe("MAQUINA_FUERA_DE_SERVICIO");
  });
});

describe("RF-22 · ConsultarDisponibilidad", () => {
  it("devuelve las franjas abiertas del día unidas y el estado de cada máquina con sus reservas activas", async () => {
    const hoy = await consultarDisponibilidad.ejecutar("c1", "2026-11-24");
    expect(hoy.franjasAbiertas).toEqual([{ inicio: "2026-11-24T07:00:00-06:00", fin: "2026-11-24T17:00:00-06:00" }]);
    expect(hoy.maquinas).toEqual([
      { id: "m1", codigo: "C1-01", estado: "EN_SERVICIO", reservas: [{ inicio: "2026-11-24T14:00:00-06:00", fin: "2026-11-24T16:00:00-06:00" }] },
      { id: "m2", codigo: "C1-02", estado: "FUERA_DE_SERVICIO", reservas: [] },
      { id: "m3", codigo: "C1-03", estado: "EN_SERVICIO", reservas: [] },
      { id: "m4", codigo: "C1-04", estado: "EN_SERVICIO", reservas: [] }
    ]);
  });

  it("no muestra como ocupadas las reservas canceladas o terminadas", async () => {
    const lunes = await consultarDisponibilidad.ejecutar("c1", "2026-11-23");
    expect(lunes.maquinas.every((m) => m.reservas.length === 0)).toBe(true);
  });

  it("rechaza un laboratorio que no existe", async () => {
    await expect(consultarDisponibilidad.ejecutar("zz", "2026-11-24")).rejects.toBeInstanceOf(LaboratorioNoExiste);
  });

  it("no cambia nada: es una consulta", async () => {
    const antes = reservas.todas.length;
    await consultarDisponibilidad.ejecutar("c1", "2026-11-24");
    expect(reservas.todas).toHaveLength(antes);
    expect(unidad.ejecuciones).toBe(0);
  });
});
