import { describe, expect, it } from "vitest";
import { DatoInvalido, Dinero, ErrorDeDominio } from "../../src/compartido/dominio/index.js";
import { RelojFijo } from "../dobles/reloj-fijo.js";

describe("Dinero", () => {
  it("guarda colones en céntimos enteros (RN-27)", () => {
    expect(Dinero.deCentimos(215000).centimos).toBe(215000);
    expect(Dinero.MONEDA).toBe("CRC");
  });

  it("rechaza céntimos con decimales o negativos", () => {
    expect(() => Dinero.deCentimos(10.5)).toThrow(DatoInvalido);
    expect(() => Dinero.deCentimos(-1)).toThrow(DatoInvalido);
    expect(() => Dinero.deCentimos(Number.NaN)).toThrow(DatoInvalido);
  });

  it("suma montos sin perder céntimos", () => {
    const total = Dinero.sumarTodos([Dinero.deCentimos(10), Dinero.deCentimos(20), Dinero.deCentimos(1)]);
    expect(total.centimos).toBe(31);
    expect(Dinero.cero().sumar(total).esIgualA(total)).toBe(true);
  });

  it("redondea al céntimo, mitad hacia arriba (SUP-25)", () => {
    expect(Dinero.desdeFraccionDeCentimos(5, 2).centimos).toBe(3); // 2,5 → 3
    expect(Dinero.desdeFraccionDeCentimos(9, 4).centimos).toBe(2); // 2,25 → 2
    expect(Dinero.desdeFraccionDeCentimos(11, 4).centimos).toBe(3); // 2,75 → 3
    expect(Dinero.desdeFraccionDeCentimos(8, 4).centimos).toBe(2); // exacto
  });

  it("calcula exacto un pago con recargo: 40 h normales + 8 h con 25 % a ₡2 150 la hora", () => {
    const tarifa = 215000; // céntimos por hora, categoría A
    const numerador = tarifa * 2400 * 100 + tarifa * 480 * 125; // minutos × (100 + recargo)
    const monto = Dinero.desdeFraccionDeCentimos(numerador, 60 * 100);
    expect(monto.centimos).toBe(10_750_000); // ₡107 500,00
  });

  it("rechaza fracciones con denominador cero o valores negativos", () => {
    expect(() => Dinero.desdeFraccionDeCentimos(10, 0)).toThrow(DatoInvalido);
    expect(() => Dinero.desdeFraccionDeCentimos(-10, 3)).toThrow(DatoInvalido);
  });
});

describe("ErrorDeDominio", () => {
  it("lleva un código estable, un detalle inmutable y su propio nombre", () => {
    const error = new DatoInvalido("fecha", "2026-02-30", "La fecha no existe en el calendario.");
    expect(error).toBeInstanceOf(ErrorDeDominio);
    expect(error).toBeInstanceOf(Error);
    expect(error.codigo).toBe("SOLICITUD_INVALIDA");
    expect(error.name).toBe("DatoInvalido");
    expect(error.detalle).toEqual({ campo: "fecha", valor: "2026-02-30" });
    expect(Object.isFrozen(error.detalle)).toBe(true);
  });
});

describe("RelojFijo (doble del puerto Reloj)", () => {
  it("devuelve la hora fijada y permite avanzarla", () => {
    const reloj = new RelojFijo("2026-11-24T10:00:00-06:00");
    expect(reloj.ahora().aISO()).toBe("2026-11-24T10:00:00-06:00");
    reloj.avanzarMinutos(15);
    expect(reloj.ahora().aISO()).toBe("2026-11-24T10:15:00-06:00");
  });
});
