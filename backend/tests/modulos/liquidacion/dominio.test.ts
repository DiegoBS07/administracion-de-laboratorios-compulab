// Reglas del dominio de liquidación (docs/09-clases.md, 9.4): invariantes y casos de borde.
import { describe, expect, it } from "vitest";
import { DatoInvalido, Dinero, Fecha, Hora, Instante } from "../../../src/compartido/dominio/index.js";
import { CierreMensual, LineaDeLiquidacion, MesDeLiquidacion, TarifaNoDefinida } from "../../../src/modulos/liquidacion/index.js";
import { LiquidacionDelAsistente } from "../../../src/modulos/liquidacion/dominio/liquidacion-del-asistente.js";
import { TarifasDelPeriodo, type VigenciaDeTarifas } from "../../../src/modulos/liquidacion/dominio/tarifas-del-periodo.js";
import { TurnoTrabajado } from "../../../src/modulos/liquidacion/dominio/turno-trabajado.js";
import { turno } from "./dobles.js";

const f = (texto: string) => Fecha.desdeTexto(texto);
const en = (fecha: string, hora: string) => Instante.de(f(fecha), Hora.desdeTexto(hora));
const trabajado = (...args: Parameters<typeof turno>) => TurnoTrabajado.de(turno(...args));
const vigencia = (desde: string, hasta: string | null, a = 215000, recargo = 25): VigenciaDeTarifas => ({
  vigenteDesde: f(desde),
  vigenteHasta: hasta ? f(hasta) : null,
  tarifaPorHora: { A: Dinero.deCentimos(a) },
  porcentajeRecargo: recargo
});
const OCTUBRE = MesDeLiquidacion.de(2026, 10);

describe("MesDeLiquidacion", () => {
  it("conoce su primer y último día, también en febrero bisiesto y en diciembre", () => {
    expect(OCTUBRE.clave).toBe("2026-10");
    expect(MesDeLiquidacion.de(2028, 2).ultimoDia.aTexto()).toBe("2028-02-29");
    expect(MesDeLiquidacion.de(2026, 12).inicioDelSiguiente().aISO()).toBe("2027-01-01T00:00:00-06:00");
  });

  it("termina a las 00:00 del día 1 del mes siguiente", () => {
    expect(OCTUBRE.terminoAntesDe(en("2026-10-31", "23:59"))).toBe(false);
    expect(OCTUBRE.terminoAntesDe(en("2026-11-01", "00:00"))).toBe(true);
  });

  it("el periodo de cálculo empieza el lunes de la semana del día 1", () => {
    expect(OCTUBRE.periodoDeCalculo().inicio.aISO()).toBe("2026-09-28T00:00:00-06:00");
    // junio de 2026 empieza en lunes: el periodo empieza ese mismo día
    expect(MesDeLiquidacion.de(2026, 6).periodoDeCalculo().inicio.aISO()).toBe("2026-06-01T00:00:00-06:00");
  });

  it("rechaza meses y años imposibles", () => {
    expect(() => MesDeLiquidacion.de(2026, 0)).toThrow(DatoInvalido);
    expect(() => MesDeLiquidacion.de(2026, 1.5)).toThrow(DatoInvalido);
    expect(() => MesDeLiquidacion.de(1969, 5)).toThrow(DatoInvalido);
  });
});

describe("TarifasDelPeriodo", () => {
  it("elige la vigencia de cada fecha, con fin inclusive", () => {
    const tarifas = TarifasDelPeriodo.de([vigencia("2026-10-16", null, 230000), vigencia("2026-07-01", "2026-10-15")]);

    expect(tarifas.tarifaPorHora("A", f("2026-10-15")).centimos).toBe(215000);
    expect(tarifas.tarifaPorHora("A", f("2026-10-16")).centimos).toBe(230000);
    expect(tarifas.vigencias.map((v) => v.vigenteDesde.aTexto())).toEqual(["2026-07-01", "2026-10-16"]);
  });

  it("lanza TarifaNoDefinida sin vigencia para la fecha o sin tarifa para la categoría", () => {
    const tarifas = TarifasDelPeriodo.de([vigencia("2026-10-10", null)]);

    expect(() => tarifas.porcentajeRecargo(f("2026-10-09"))).toThrow(TarifaNoDefinida);
    expect(() => tarifas.tarifaPorHora("B", f("2026-10-10"))).toThrow(TarifaNoDefinida);
    expect(() => tarifas.exigirCobertura(f("2026-10-01"), f("2026-10-31"))).toThrow(TarifaNoDefinida);
  });

  it("rechaza vigencias que se traslapan, que terminan antes de empezar o con recargo inválido", () => {
    expect(() => TarifasDelPeriodo.de([vigencia("2026-07-01", "2026-10-16"), vigencia("2026-10-16", null)])).toThrow(DatoInvalido);
    expect(() => TarifasDelPeriodo.de([vigencia("2026-07-01", null), vigencia("2026-10-16", null)])).toThrow(DatoInvalido);
    expect(() => TarifasDelPeriodo.de([vigencia("2026-07-01", "2026-06-30")])).toThrow(DatoInvalido);
    expect(() => TarifasDelPeriodo.de([vigencia("2026-07-01", null, 215000, 2.5)])).toThrow(DatoInvalido);
  });
});

describe("TurnoTrabajado", () => {
  it("paga la intersección entre las marcas y la franja programada (SUP-07)", () => {
    expect(trabajado("t", "a", "2026-10-05", "08:00", "12:00", "07:40", "12:30").minutosTrabajados()).toBe(240);
    expect(trabajado("t", "a", "2026-10-05", "08:00", "12:00", "08:10", "11:50").minutosTrabajados()).toBe(220);
    expect(trabajado("t", "a", "2026-10-05", "08:00", "12:00", "12:10", "13:00").minutosTrabajados()).toBe(0);
  });

  it("sin salida no paga nada y cuenta la marca incompleta desde la entrada hasta el fin (SUP-08)", () => {
    const incompleto = trabajado("t", "a", "2026-10-05", "08:00", "12:00", "07:50", null);

    expect(incompleto.minutosTrabajados()).toBe(0);
    expect(incompleto.minutosConMarcaIncompleta()).toBe(240);
  });

  it("lleva recargo desde las 18:00 o en fin de semana, y nunca dos veces (SUP-06)", () => {
    expect(trabajado("t", "a", "2026-10-05", "17:59", "21:00").llevaRecargo()).toBe(false);
    expect(trabajado("t", "a", "2026-10-05", "18:00", "21:00").llevaRecargo()).toBe(true);
    expect(trabajado("t", "a", "2026-10-11", "08:00", "12:00").llevaRecargo()).toBe(true);
    expect(trabajado("t", "a", "2026-10-10", "18:00", "21:00").llevaRecargo()).toBe(true);
  });

  it("rechaza salida sin entrada y salida antes de la entrada", () => {
    expect(() => trabajado("t", "a", "2026-10-05", "08:00", "12:00", null, "12:00")).toThrow(DatoInvalido);
    expect(() => trabajado("t", "a", "2026-10-05", "08:00", "12:00", "10:00", "09:00")).toThrow(DatoInvalido);
  });
});

describe("LiquidacionDelAsistente", () => {
  const asistente = (topes = [{ minutosPorSemana: 600, vigenteDesde: f("2026-01-01") }]) =>
    LiquidacionDelAsistente.de({ id: "a", carne: "2024100001", nombre: "Ana", categoria: "A", topes });
  const tarifas = TarifasDelPeriodo.de([vigencia("2026-07-01", null)]);

  it("un recargo nocturno de fin de semana se cobra una sola vez", () => {
    const linea = asistente().calcular([trabajado("t", "a", "2026-10-10", "18:00", "20:00")], OCTUBRE, tarifas);

    // 120 min × ₡2 150 × 1,25 / 60
    expect(linea?.monto.centimos).toBe(537_500);
    expect(linea?.minutosConRecargo).toBe(120);
  });

  it("usa el tope vigente el lunes de cada semana (RF-07)", () => {
    const conCambio = asistente([
      { minutosPorSemana: 240, vigenteDesde: f("2026-01-01") },
      { minutosPorSemana: 600, vigenteDesde: f("2026-10-12") }
    ]);
    const turnos = [
      trabajado("t1", "a", "2026-10-05", "07:00", "13:00"), // tope 4 h
      trabajado("t2", "a", "2026-10-12", "07:00", "13:00") // tope 10 h
    ];

    const linea = conCambio.calcular(turnos, OCTUBRE, tarifas);

    expect(linea?.minutosNormales).toBe(240 + 360);
    expect(linea?.noPagados).toEqual([{ semana: "2026-10-05", motivo: "SOBRE_TOPE", minutos: 120 }]);
  });

  it("redondea el monto al céntimo una sola vez, a la mitad hacia arriba (RN-27)", () => {
    // 1 min × 1 céntimo / 60 por cada uno de tres turnos: sin redondeo por turno sería 0
    const centimo = TarifasDelPeriodo.de([{ vigenteDesde: f("2026-07-01"), vigenteHasta: null, tarifaPorHora: { A: Dinero.deCentimos(10) }, porcentajeRecargo: 0 }]);
    const turnos = ["05", "06", "07"].map((d) => trabajado(`t${d}`, "a", `2026-10-${d}`, "08:00", "08:03"));

    // 9 min × 10 céntimos / 60 = 1,5 → 2
    expect(asistente().calcular(turnos, OCTUBRE, centimo)?.monto.centimos).toBe(2);
  });

  it("devuelve null si solo tiene turnos no cubiertos o de días anteriores al mes", () => {
    const turnos = [trabajado("t1", "a", "2026-09-29", "08:00", "12:00"), trabajado("t2", "a", "2026-10-05", "08:00", "12:00", null, null)];

    expect(asistente().calcular(turnos, OCTUBRE, tarifas)).toBeNull();
  });

  it("rechaza turnos de otro asistente y topes no positivos", () => {
    expect(() => asistente().calcular([trabajado("t", "otro", "2026-10-05", "08:00", "12:00")], OCTUBRE, tarifas)).toThrow(DatoInvalido);
    expect(() => asistente([{ minutosPorSemana: 0, vigenteDesde: f("2026-01-01") }])).toThrow(DatoInvalido);
    expect(() => asistente([])).toThrow(DatoInvalido);
  });
});

describe("LineaDeLiquidacion y CierreMensual", () => {
  const linea = (idAsistente = "a", minutosNormales = 60) =>
    LineaDeLiquidacion.de({
      idAsistente,
      carne: `c-${idAsistente}`,
      nombre: "Ana",
      categoria: "A",
      minutosNormales,
      minutosConRecargo: 0,
      noPagados: [],
      monto: Dinero.deCentimos(215000)
    });
  const datos = { mes: OCTUBRE, tarifasAplicadas: [], fechaDeCierre: en("2026-11-01", "00:05") };
  const archivo = { nombre: "becas-2026-10.csv", tipo: "text/csv" as const, contenido: "x" };

  it("una línea sin ningún minuto no existe (SUP-26)", () => {
    expect(() => linea("a", 0)).toThrow(DatoInvalido);
  });

  it("el total del cierre es la suma de sus líneas (I3)", () => {
    const cierre = CierreMensual.cerrar({ ...datos, lineas: [linea("a"), linea("b")] });

    expect(cierre.total.centimos).toBe(430000);
    expect(cierre.id).toBe("cierre-2026-10");
  });

  it("no se cierra antes de terminar el mes ni con dos líneas del mismo asistente", () => {
    expect(() => CierreMensual.cerrar({ ...datos, lineas: [], fechaDeCierre: en("2026-10-31", "23:00") })).toThrow(DatoInvalido);
    expect(() => CierreMensual.cerrar({ ...datos, lineas: [linea("a"), linea("a")] })).toThrow(DatoInvalido);
  });

  it("adjuntar el archivo devuelve un cierre nuevo y solo se puede una vez (I2)", () => {
    const cerrado = CierreMensual.cerrar({ ...datos, lineas: [linea()] });

    const conArchivo = cerrado.adjuntarArchivo(archivo);

    expect(cerrado.archivo).toBeNull();
    expect(conArchivo.archivo).toEqual(archivo);
    expect(() => conArchivo.adjuntarArchivo(archivo)).toThrow(DatoInvalido);
  });
});
