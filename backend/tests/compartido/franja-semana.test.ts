import { describe, expect, it } from "vitest";
import { DatoInvalido, Fecha, Franja, FranjaInvalida, Hora, Instante, Semana } from "../../src/compartido/dominio/index.js";

const MARTES = Fecha.desdeTexto("2026-11-24");
/** Franja del martes 24 de noviembre, por ejemplo f("08:00", "12:00"). */
const f = (inicio: string, fin: string) => Franja.delDia(MARTES, Hora.desdeTexto(inicio), Hora.desdeTexto(fin));

describe("Franja", () => {
  it("exige que el inicio sea anterior al fin", () => {
    expect(() => f("12:00", "12:00")).toThrow(FranjaInvalida);
    expect(() => f("13:00", "12:00")).toThrow(FranjaInvalida);
    expect(f("08:00", "12:00").duracionMinutos).toBe(240);
  });

  it("el error de franja inválida lleva un código para la API", () => {
    try {
      f("13:00", "12:00");
      expect.unreachable();
    } catch (error) {
      expect((error as FranjaInvalida).codigo).toBe("FRANJA_INVALIDA");
    }
  });

  it("detecta traslapes parciales y totales", () => {
    expect(f("08:00", "12:00").seTraslapaCon(f("11:00", "13:00"))).toBe(true);
    expect(f("08:00", "12:00").seTraslapaCon(f("09:00", "10:00"))).toBe(true);
    expect(f("09:00", "10:00").seTraslapaCon(f("08:00", "12:00"))).toBe(true);
  });

  it("dos franjas contiguas no se traslapan (RN-06)", () => {
    expect(f("08:00", "10:00").seTraslapaCon(f("10:00", "12:00"))).toBe(false);
    expect(f("10:00", "12:00").seTraslapaCon(f("08:00", "10:00"))).toBe(false);
  });

  it("franjas de días distintos con la misma hora no se traslapan (traslape entre campus, RN-06)", () => {
    const miercoles = Franja.delDia(MARTES.sumarDias(1), Hora.de(8), Hora.de(12));
    expect(f("08:00", "12:00").seTraslapaCon(miercoles)).toBe(false);
  });

  it("contiene el inicio pero no el fin", () => {
    const franja = f("08:00", "12:00");
    expect(franja.contiene(franja.inicio)).toBe(true);
    expect(franja.contiene(franja.fin)).toBe(false);
    expect(franja.contieneFranja(f("09:00", "12:00"))).toBe(true);
    expect(franja.contieneFranja(f("09:00", "12:30"))).toBe(false);
  });

  it("fusiona franjas contiguas y traslapadas, y deja separadas las que tienen un hueco", () => {
    const fusionadas = Franja.fusionar([f("13:00", "17:00"), f("07:00", "13:00"), f("17:00", "21:00"), f("08:00", "09:00")]);
    expect(fusionadas.map(String)).toEqual([f("07:00", "21:00").toString()]);

    const conHueco = Franja.fusionar([f("08:00", "12:00"), f("13:00", "20:00")]);
    expect(conHueco).toHaveLength(2);
  });

  it("una reserva está cubierta si los turnos la cubren completa, aunque sean contiguos (RN-15)", () => {
    const turnos = [f("07:00", "13:00"), f("13:00", "17:00")];
    expect(f("12:00", "14:00").estaCubiertaPor(turnos)).toBe(true);
    expect(f("16:00", "18:00").estaCubiertaPor(turnos)).toBe(false);
    expect(f("11:00", "14:00").estaCubiertaPor([f("08:00", "12:00"), f("13:00", "20:00")])).toBe(false);
  });

  it("un turno hasta las 24:00 termina a la medianoche", () => {
    expect(f("20:00", "24:00").fin.aISO()).toBe("2026-11-25T00:00:00-06:00");
  });
});

describe("Semana", () => {
  it("va de lunes a domingo (SUP-05)", () => {
    const semana = Semana.deLaFecha(MARTES);
    expect(semana.lunes.aTexto()).toBe("2026-11-23");
    expect(semana.domingo.aTexto()).toBe("2026-11-29");
    expect(semana.dias().map((d) => d.aTexto())).toHaveLength(7);
  });

  it("un domingo pertenece a la semana que empezó el lunes anterior", () => {
    expect(Semana.deLaFecha(Fecha.desdeTexto("2026-11-29")).lunes.aTexto()).toBe("2026-11-23");
    expect(Semana.deLaFecha(Fecha.desdeTexto("2026-11-30")).lunes.aTexto()).toBe("2026-11-30");
  });

  it("solo puede empezar un lunes", () => {
    expect(() => Semana.queEmpiezaEl(MARTES)).toThrow(DatoInvalido);
    expect(Semana.queEmpiezaEl(Fecha.desdeTexto("2026-11-30")).lunes.aTexto()).toBe("2026-11-30");
  });

  it("una semana que cruza dos meses se mantiene completa (SUP-05)", () => {
    const semana = Semana.deLaFecha(Fecha.desdeTexto("2026-10-01"));
    expect(semana.lunes.aTexto()).toBe("2026-09-28");
    expect(semana.contiene(Fecha.desdeTexto("2026-09-30"))).toBe(true);
    expect(semana.contiene(Fecha.desdeTexto("2026-10-04"))).toBe(true);
    expect(semana.contiene(Fecha.desdeTexto("2026-10-05"))).toBe(false);
  });

  it("como franja dura 7 días exactos, de lunes 00:00 al lunes siguiente 00:00", () => {
    const franja = Semana.deLaFecha(MARTES).franja();
    expect(franja.duracionMinutos).toBe(7 * 24 * 60);
    expect(franja.contiene(Instante.desdeISO("2026-11-29T23:59:00-06:00"))).toBe(true);
    expect(franja.contiene(Instante.desdeISO("2026-11-30T00:00:00-06:00"))).toBe(false);
  });

  it("avanza y retrocede de a una semana", () => {
    const semana = Semana.deLaFecha(MARTES);
    expect(semana.siguiente().lunes.aTexto()).toBe("2026-11-30");
    expect(semana.anterior().lunes.aTexto()).toBe("2026-11-16");
    expect(semana.siguiente().anterior().esIgualA(semana)).toBe(true);
  });
});
