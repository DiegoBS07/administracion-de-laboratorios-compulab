// CU-14 · Cerrar el mes (docs/04-casos-de-uso.md, 4.4).
// Una prueba por el escenario principal, una por cada poscondición (P1–P8) y una por cada extensión.
import { beforeEach, describe, expect, it } from "vitest";
import { DatoInvalido, Dinero, Fecha } from "../../../src/compartido/dominio/index.js";
import {
  CerrarMes,
  CierreNoExiste,
  ConsultarCierre,
  COORDINACION_DE_SOPORTE,
  ENCABEZADO_BECAS,
  ErrorAlGenerarArchivo,
  GeneradorArchivoBecasCsv,
  type GeneradorArchivoBecas,
  MesNoTerminado,
  ObtenerArchivoBecas,
  type RegistroDeTurnoTrabajado,
  type ResumenDeCierreDTO,
  TarifaNoDefinida,
  type VigenciaDeTarifas
} from "../../../src/modulos/liquidacion/index.js";
import { NotificadorEnMemoria } from "../../dobles/notificador-en-memoria.js";
import { RelojFijo } from "../../dobles/reloj-fijo.js";
import {
  DatosDeAsistentesEnMemoria,
  GeneradorArchivoBecasQueFalla,
  HorasTrabajadasEnMemoria,
  RepositorioCierresEnMemoria,
  TablaTarifasEnMemoria,
  turno
} from "./dobles.js";

// Se cierra octubre de 2026 el domingo 1 de noviembre a las 00:05. El 1 de octubre es jueves:
// la primera semana del mes empieza el lunes 28 de septiembre.
const AHORA = "2026-11-01T00:05:00-06:00";

const desde = (fecha: string) => Fecha.desdeTexto(fecha);
const tope = (horas: number) => [{ minutosPorSemana: horas * 60, vigenteDesde: desde("2026-01-01") }];

const ASISTENTES = {
  a1: { carne: "2023100001", nombre: "Diego Vargas", categoria: "B", topes: tope(20) },
  a2: { carne: "2022100002", nombre: "María Solano", categoria: "A", topes: tope(10) },
  a3: { carne: "2021100003", nombre: "José Brenes", categoria: "A", topes: tope(10) },
  a5: { carne: "2024100005", nombre: "Andrés Mora", categoria: "A", topes: tope(8) }
};

const vigencia = (inicio: string, fin: string | null, a: number, b: number | null, recargo = 25): VigenciaDeTarifas => ({
  vigenteDesde: desde(inicio),
  vigenteHasta: fin ? desde(fin) : null,
  tarifaPorHora: b === null ? { A: Dinero.deCentimos(a) } : { A: Dinero.deCentimos(a), B: Dinero.deCentimos(b) },
  porcentajeRecargo: recargo
});

// ₡2 150 la hora para la categoría A, ₡2 600 para la B, 25 % de recargo, desde julio.
const TARIFAS = [vigencia("2026-07-01", null, 215000, 260000)];

const TURNOS: RegistroDeTurnoTrabajado[] = [
  // Diego: 930 min normales y 420 con recargo
  turno("t1", "a1", "2026-10-05", "08:00", "12:00"),
  turno("t2", "a1", "2026-10-07", "13:00", "17:30", "13:05", "17:40"), // 265 min: llegó tarde, salió después
  turno("t3", "a1", "2026-10-08", "18:00", "21:00", "17:55", "21:00"), // nocturno: 180 min con recargo
  turno("t4", "a1", "2026-10-10", "08:00", "12:00"), // sábado: 240 min con recargo
  turno("t5", "a1", "2026-10-13", "07:00", "14:05"), // 425 min
  // María: 12 h en la semana del 12 de octubre con tope de 10 h
  turno("t6", "a2", "2026-10-12", "08:00", "12:00"),
  turno("t7", "a2", "2026-10-14", "08:00", "12:00"),
  turno("t8", "a2", "2026-10-16", "08:00", "12:00"),
  // Andrés: 8 h el 28 y 29 de septiembre llenan su tope de esa semana
  turno("t9", "a5", "2026-09-28", "08:00", "12:00"),
  turno("t10", "a5", "2026-09-29", "08:00", "12:00"),
  turno("t11", "a5", "2026-10-01", "07:00", "11:00"), // sobre el tope (ext 4b)
  turno("t12", "a5", "2026-10-20", "07:00", "11:00", "07:02", null), // marca incompleta (ext 3b)
  turno("t13", "a5", "2026-10-21", "07:00", "11:00", null, null), // no cubierto (ext 3c)
  turno("t14", "a5", "2026-10-22", "07:00", "11:00"),
  // José: solo un turno no cubierto (ext 3a)
  turno("t15", "a3", "2026-10-21", "13:00", "17:00", null, null),
  // fuera del periodo: no se lee
  turno("t16", "a1", "2026-09-25", "08:00", "12:00"),
  turno("t17", "a1", "2026-11-02", "08:00", "12:00")
];

let cierres: RepositorioCierresEnMemoria;
let horas: HorasTrabajadasEnMemoria;
let notificador: NotificadorEnMemoria;
let reloj: RelojFijo;

function cerrarMes(opciones: { tarifas?: VigenciaDeTarifas[]; generador?: GeneradorArchivoBecas } = {}): CerrarMes {
  return new CerrarMes({
    cierres,
    horas,
    asistentes: new DatosDeAsistentesEnMemoria(ASISTENTES),
    tarifas: new TablaTarifasEnMemoria(opciones.tarifas ?? TARIFAS),
    generador: opciones.generador ?? new GeneradorArchivoBecasCsv(),
    notificador,
    reloj
  });
}

async function errorDe<E extends Error>(promesa: Promise<unknown>, tipo: abstract new (...args: never[]) => E): Promise<E> {
  const resultado = await promesa.then(
    () => null,
    (error: unknown) => error
  );
  expect(resultado).toBeInstanceOf(tipo);
  return resultado as E;
}

const lineaDe = (cierre: ResumenDeCierreDTO, idAsistente: string) => cierre.lineas.find((l) => l.idAsistente === idAsistente);

beforeEach(() => {
  cierres = new RepositorioCierresEnMemoria();
  horas = new HorasTrabajadasEnMemoria(TURNOS);
  notificador = new NotificadorEnMemoria();
  reloj = new RelojFijo(AHORA);
});

describe("CU-14 · escenario principal", () => {
  it("cierra octubre con una línea por asistente con horas y el total del mes", async () => {
    const { creado, cierre } = await cerrarMes().ejecutar(2026, 10);

    expect(creado).toBe(true);
    expect(cierre).toMatchObject({ id: "cierre-2026-10", anio: 2026, mes: 10, estado: "CERRADO", moneda: "CRC" });
    expect(cierre.lineas.map((l) => l.carne)).toEqual(["2022100002", "2023100001", "2024100005"]);
    expect(cierre.totalCentimos).toBe(9_315_000);
  });

  it("lee las horas desde el lunes de la primera semana del mes hasta el fin del mes (SUP-05)", async () => {
    await cerrarMes().ejecutar(2026, 10);

    expect(horas.periodosPedidos.map((p) => p.toString())).toEqual([
      "[2026-09-28T00:00:00-06:00, 2026-11-01T00:00:00-06:00)"
    ]);
  });
});

describe("CU-14 · poscondiciones", () => {
  it("P1 · se creó y guardó un CierreMensual del mes", async () => {
    await cerrarMes().ejecutar(2026, 10);

    expect(cierres.todos.map((c) => c.id)).toEqual(["cierre-2026-10"]);
  });

  it("P2 · fechaDeCierre es la hora del reloj", async () => {
    const { cierre } = await cerrarMes().ejecutar(2026, 10);

    expect(cierre.fechaDeCierre).toBe(AHORA);
  });

  it("P3 · hay una línea por cada asistente con horas en el mes, asociada al cierre", async () => {
    const { cierre } = await cerrarMes().ejecutar(2026, 10);

    expect(cierre.lineas.map((l) => l.idAsistente).sort()).toEqual(["a1", "a2", "a5"]);
    expect(cierres.todos[0]?.lineas).toHaveLength(3);
  });

  it("P4 · cada línea tiene sus minutos normales, con recargo, no pagados y su monto", async () => {
    const { cierre } = await cerrarMes().ejecutar(2026, 10);

    expect(lineaDe(cierre, "a1")).toMatchObject({
      carne: "2023100001",
      nombre: "Diego Vargas",
      categoria: "B",
      minutosNormales: 930,
      minutosConRecargo: 420,
      minutosNoPagados: 0,
      montoCentimos: 6_305_000, // (930 × 2 600 + 420 × 2 600 × 1,25) / 60
      noPagados: []
    });
    expect(lineaDe(cierre, "a2")).toMatchObject({ minutosNormales: 600, minutosConRecargo: 0, minutosNoPagados: 120, montoCentimos: 2_150_000 });
    expect(lineaDe(cierre, "a5")).toMatchObject({ minutosNormales: 240, minutosConRecargo: 0, minutosNoPagados: 478, montoCentimos: 860_000 });
  });

  it("P5 · el cierre guarda una copia de las tarifas aplicadas", async () => {
    const { cierre } = await cerrarMes().ejecutar(2026, 10);

    expect(cierre.tarifasAplicadas).toEqual([
      { vigenteDesde: "2026-07-01", vigenteHasta: null, tarifaPorHoraCentimos: { A: 215000, B: 260000 }, porcentajeRecargo: 25 }
    ]);
  });

  it("P6 · se generó el archivo CSV para Becas y quedó asociado al cierre", async () => {
    await cerrarMes().ejecutar(2026, 10);

    const archivo = await new ObtenerArchivoBecas({ cierres }).ejecutar(2026, 10);
    expect(archivo.nombre).toBe("becas-2026-10.csv");
    expect(archivo.tipo).toBe("text/csv");
    expect(archivo.contenido.split("\r\n")).toEqual([
      ENCABEZADO_BECAS,
      "2026-10,2022100002,María Solano,A,10.00,0.00,2.00,21500.00",
      "2026-10,2023100001,Diego Vargas,B,15.50,7.00,0.00,63050.00",
      "2026-10,2024100005,Andrés Mora,A,4.00,0.00,7.97,8600.00",
      ""
    ]);
  });

  it("P7 · el cierre queda en estado CERRADO", async () => {
    await cerrarMes().ejecutar(2026, 10);

    expect(cierres.todos[0]?.estado).toBe("CERRADO");
  });

  it("P8 · se avisa al coordinador de soporte, con los asistentes que tuvieron horas sobre el tope", async () => {
    await cerrarMes().ejecutar(2026, 10);

    expect(notificador.avisos).toEqual([
      {
        destinatario: COORDINACION_DE_SOPORTE,
        tipo: "CIERRE_LISTO",
        datos: { mes: "2026-10", totalCentimos: "9315000", lineas: "3", asistentesConHorasSobreElTope: "2022100002,2024100005" }
      }
    ]);
  });
});

describe("CU-14 · extensiones", () => {
  it("2a · si el mes ya estaba cerrado devuelve el cierre existente sin cambiarlo", async () => {
    const primero = await cerrarMes().ejecutar(2026, 10);
    reloj.avanzarMinutos(60);

    const segundo = await cerrarMes().ejecutar(2026, 10);

    expect(segundo).toEqual({ creado: false, cierre: primero.cierre });
    expect(cierres.todos).toHaveLength(1);
    expect(notificador.avisos).toHaveLength(1);
  });

  it("2b · si el mes no ha terminado lanza MesNoTerminado y no cierra nada", async () => {
    reloj.fijar("2026-10-31T23:59:00-06:00");

    const error = await errorDe(cerrarMes().ejecutar(2026, 10), MesNoTerminado);

    expect(error.detalle).toEqual({ mes: "2026-10", sePuedeCerrarDesde: "2026-11-01T00:00:00-06:00" });
    expect(cierres.todos).toHaveLength(0);
    expect(notificador.avisos).toHaveLength(0);
  });

  it("2c · dos disparos simultáneos producen un solo cierre y ambos reciben el mismo", async () => {
    const resultados = await Promise.allSettled([cerrarMes().ejecutar(2026, 10), cerrarMes().ejecutar(2026, 10)]);

    const valores = resultados.map((r) => (r.status === "fulfilled" ? r.value : null));
    expect(valores.every((v) => v !== null)).toBe(true);
    expect(valores.map((v) => v?.creado).sort()).toEqual([false, true]);
    expect(valores[0]?.cierre).toEqual(valores[1]?.cierre);
    expect(cierres.todos).toHaveLength(1);
    expect(notificador.avisos.filter((a) => a.tipo === "CIERRE_LISTO")).toHaveLength(1);
  });

  it("3a · un asistente sin horas en el mes no tiene línea", async () => {
    const { cierre } = await cerrarMes().ejecutar(2026, 10);

    expect(lineaDe(cierre, "a3")).toBeUndefined();
  });

  it("3b · un turno con entrada y sin salida no se paga y queda como MARCA_INCOMPLETA", async () => {
    const { cierre } = await cerrarMes().ejecutar(2026, 10);

    expect(lineaDe(cierre, "a5")?.noPagados).toContainEqual({ semana: "2026-10-19", motivo: "MARCA_INCOMPLETA", minutos: 238 });
  });

  it("3c · un turno no cubierto aporta 0 minutos", async () => {
    const { cierre } = await cerrarMes().ejecutar(2026, 10);

    // Andrés: solo el turno del 22 se paga; el del 21 (no cubierto) no aparece en ninguna cifra.
    expect(lineaDe(cierre, "a5")).toMatchObject({ minutosNormales: 240, minutosNoPagados: 240 + 238 });
  });

  it("4a · las horas sobre el tope semanal no se pagan y quedan como SOBRE_TOPE", async () => {
    const { cierre } = await cerrarMes().ejecutar(2026, 10);

    expect(lineaDe(cierre, "a2")?.noPagados).toEqual([{ semana: "2026-10-12", motivo: "SOBRE_TOPE", minutos: 120 }]);
  });

  it("4b · en la semana que viene del mes anterior las horas de septiembre cuentan para el tope", async () => {
    const { cierre } = await cerrarMes().ejecutar(2026, 10);

    expect(lineaDe(cierre, "a5")?.noPagados).toContainEqual({ semana: "2026-09-28", motivo: "SOBRE_TOPE", minutos: 240 });
  });

  it("5a · los turnos nocturnos y de fin de semana llevan recargo", async () => {
    const { cierre } = await cerrarMes().ejecutar(2026, 10);

    expect(lineaDe(cierre, "a1")?.minutosConRecargo).toBe(180 + 240);
  });

  it("5b · si falta la tarifa de una fecha del mes lanza TarifaNoDefinida, no cierra y avisa al coordinador de soporte", async () => {
    const error = await errorDe(cerrarMes({ tarifas: [vigencia("2026-10-10", null, 215000, 260000)] }).ejecutar(2026, 10), TarifaNoDefinida);

    expect(error.detalle).toEqual({ fecha: "2026-10-01", categoria: null });
    expect(cierres.todos).toHaveLength(0);
    expect(notificador.avisos).toEqual([
      { destinatario: COORDINACION_DE_SOPORTE, tipo: "TARIFA_FALTANTE", datos: { mes: "2026-10", fecha: "2026-10-01", categoria: "" } }
    ]);
  });

  it("5b · si falta la tarifa de la categoría de un asistente también lanza TarifaNoDefinida", async () => {
    const error = await errorDe(cerrarMes({ tarifas: [vigencia("2026-07-01", null, 215000, null)] }).ejecutar(2026, 10), TarifaNoDefinida);

    expect(error.detalle).toMatchObject({ categoria: "B" });
    expect(cierres.todos).toHaveLength(0);
  });

  it("5c · si la tarifa cambia a mitad de mes se usa la vigente en la fecha de cada turno", async () => {
    const tarifas = [vigencia("2026-07-01", "2026-10-15", 215000, 260000), vigencia("2026-10-16", null, 230000, 260000)];

    const { cierre } = await cerrarMes({ tarifas }).ejecutar(2026, 10);

    // María: 480 min antes del 16 a ₡2 150 y 120 min el 16 a ₡2 300.
    expect(lineaDe(cierre, "a2")?.montoCentimos).toBe(2_180_000);
    expect(cierre.tarifasAplicadas.map((t) => t.vigenteDesde)).toEqual(["2026-07-01", "2026-10-16"]);
  });

  it("7a · si el archivo no se puede generar no se cierra nada ni se avisa", async () => {
    await errorDe(cerrarMes({ generador: new GeneradorArchivoBecasQueFalla() }).ejecutar(2026, 10), ErrorAlGenerarArchivo);

    expect(cierres.todos).toHaveLength(0);
    expect(notificador.avisos).toHaveLength(0);
  });
});

describe("CU-14 · datos de entrada y consultas", () => {
  it("rechaza un mes que no existe", async () => {
    await errorDe(cerrarMes().ejecutar(2026, 13), DatoInvalido);
  });

  it("ConsultarCierre devuelve el mismo resumen que dio el cierre", async () => {
    const { cierre } = await cerrarMes().ejecutar(2026, 10);

    expect(await new ConsultarCierre({ cierres }).ejecutar(2026, 10)).toEqual(cierre);
  });

  it("ConsultarCierre y ObtenerArchivoBecas lanzan CierreNoExiste para un mes sin cerrar", async () => {
    await errorDe(new ConsultarCierre({ cierres }).ejecutar(2026, 9), CierreNoExiste);
    await errorDe(new ObtenerArchivoBecas({ cierres }).ejecutar(2026, 9), CierreNoExiste);
  });
});
