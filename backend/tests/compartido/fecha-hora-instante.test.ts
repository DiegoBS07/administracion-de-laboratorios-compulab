import { describe, expect, it } from "vitest";
import { DatoInvalido, Fecha, Hora, Instante } from "../../src/compartido/dominio/index.js";

describe("Fecha", () => {
  it("se crea desde AAAA-MM-DD y vuelve al mismo texto", () => {
    expect(Fecha.desdeTexto("2026-11-24").aTexto()).toBe("2026-11-24");
  });

  it("rechaza fechas que no existen y formatos incorrectos", () => {
    expect(() => Fecha.desdeTexto("2026-02-30")).toThrow(DatoInvalido);
    expect(() => Fecha.desdeTexto("2026-13-01")).toThrow(DatoInvalido);
    expect(() => Fecha.desdeTexto("24/11/2026")).toThrow(DatoInvalido);
    expect(() => Fecha.de(2026, 11, 24.5)).toThrow(DatoInvalido);
  });

  it("acepta el 29 de febrero solo en años bisiestos", () => {
    expect(Fecha.desdeTexto("2028-02-29").dia).toBe(29);
    expect(() => Fecha.desdeTexto("2026-02-29")).toThrow(DatoInvalido);
  });

  it("calcula el día de la semana con lunes = 1 y domingo = 7", () => {
    expect(Fecha.desdeTexto("2026-11-23").diaDeLaSemana).toBe(1); // lunes
    expect(Fecha.desdeTexto("2026-11-24").diaDeLaSemana).toBe(2); // martes
    expect(Fecha.desdeTexto("2026-11-29").diaDeLaSemana).toBe(7); // domingo
  });

  it("sabe si es fin de semana (para el recargo, RN-23)", () => {
    expect(Fecha.desdeTexto("2026-11-28").esFinDeSemana()).toBe(true);
    expect(Fecha.desdeTexto("2026-11-29").esFinDeSemana()).toBe(true);
    expect(Fecha.desdeTexto("2026-11-27").esFinDeSemana()).toBe(false);
  });

  it("suma días cruzando meses y años", () => {
    expect(Fecha.desdeTexto("2026-11-30").sumarDias(1).aTexto()).toBe("2026-12-01");
    expect(Fecha.desdeTexto("2026-12-31").sumarDias(1).aTexto()).toBe("2027-01-01");
    expect(Fecha.desdeTexto("2026-03-01").sumarDias(-1).aTexto()).toBe("2026-02-28");
  });

  it("encuentra el lunes de su semana, también desde un domingo", () => {
    expect(Fecha.desdeTexto("2026-11-24").lunesDeSuSemana().aTexto()).toBe("2026-11-23");
    expect(Fecha.desdeTexto("2026-11-29").lunesDeSuSemana().aTexto()).toBe("2026-11-23");
    expect(Fecha.desdeTexto("2026-11-23").lunesDeSuSemana().aTexto()).toBe("2026-11-23");
  });

  it("compara y mide distancias en días", () => {
    const a = Fecha.desdeTexto("2026-11-24");
    const b = Fecha.desdeTexto("2026-12-01");
    expect(a.esAnteriorA(b)).toBe(true);
    expect(b.esPosteriorA(a)).toBe(true);
    expect(a.comparar(b)).toBe(-1);
    expect(a.diasHasta(b)).toBe(7);
    expect(a.esIgualA(Fecha.de(2026, 11, 24))).toBe(true);
  });
});

describe("Hora", () => {
  it("se crea desde HH:MM y vuelve al mismo texto", () => {
    expect(Hora.desdeTexto("07:30").minutos).toBe(450);
    expect(Hora.desdeTexto("18:00").aTexto()).toBe("18:00");
  });

  it("acepta 24:00 como fin del día", () => {
    const h = Hora.desdeTexto("24:00");
    expect(h.esFinDelDia()).toBe(true);
    expect(h.minutos).toBe(1440);
  });

  it("rechaza horas imposibles y formatos incorrectos", () => {
    expect(() => Hora.desdeTexto("25:00")).toThrow(DatoInvalido);
    expect(() => Hora.desdeTexto("24:30")).toThrow(DatoInvalido);
    expect(() => Hora.desdeTexto("07:60")).toThrow(DatoInvalido);
    expect(() => Hora.desdeTexto("7:00")).toThrow(DatoInvalido);
    expect(() => Hora.deMinutos(-1)).toThrow(DatoInvalido);
  });

  it("compara horas", () => {
    expect(Hora.de(13).esAnteriorA(Hora.de(18))).toBe(true);
    expect(Hora.de(18).comparar(Hora.de(18, 0))).toBe(0);
  });
});

describe("Instante", () => {
  it("combina fecha y hora y se expresa en ISO con el desfase de Costa Rica", () => {
    const i = Instante.de(Fecha.desdeTexto("2026-11-24"), Hora.de(18));
    expect(i.aISO()).toBe("2026-11-24T18:00:00-06:00");
    expect(i.fecha.aTexto()).toBe("2026-11-24");
    expect(i.hora.aTexto()).toBe("18:00");
  });

  it("lee ISO con cualquier zona y lo lleva a la hora oficial de Costa Rica (7.8)", () => {
    expect(Instante.desdeISO("2026-11-24T18:00:00-06:00").aISO()).toBe("2026-11-24T18:00:00-06:00");
    expect(Instante.desdeISO("2026-11-25T00:00:00Z").aISO()).toBe("2026-11-24T18:00:00-06:00");
    expect(Instante.desdeISO("2026-11-24T20:00-04:00").aISO()).toBe("2026-11-24T18:00:00-06:00");
  });

  it("rechaza instantes sin zona horaria o con hora imposible", () => {
    expect(() => Instante.desdeISO("2026-11-24T18:00:00")).toThrow(DatoInvalido);
    expect(() => Instante.desdeISO("2026-11-24T25:00:00-06:00")).toThrow(DatoInvalido);
  });

  it("una hora de fin 24:00 equivale a las 00:00 del día siguiente", () => {
    const fin = Instante.de(Fecha.desdeTexto("2026-11-24"), Hora.desdeTexto("24:00"));
    expect(fin.esIgualA(Instante.de(Fecha.desdeTexto("2026-11-25"), Hora.medianoche()))).toBe(true);
  });

  it("suma minutos cruzando la medianoche y mide distancias", () => {
    const i = Instante.desdeISO("2026-11-24T23:30:00-06:00");
    expect(i.sumarMinutos(45).aISO()).toBe("2026-11-25T00:15:00-06:00");
    expect(i.minutosHasta(i.sumarMinutos(15))).toBe(15);
    expect(i.esAnteriorA(i.sumarMinutos(1))).toBe(true);
  });
});
