// Presentador del cierre mensual (CU-14), sin renderizar.
import { describe, expect, it } from "vitest";
import { ErrorDeApi, SinRespuesta } from "../../compartido/api/cliente";
import type { ResumenDeCierre } from "../../compartido/api/tipos";
import { estadoSinCierre, mensajeDeErrorDelCierre, mesesDelAnio, vistaDelCierre } from "./presentador";

const espacios = (s: string) => s.replace(/\s/g, " ");

const CIERRE: ResumenDeCierre = {
  id: "cierre-2026-10",
  anio: 2026,
  mes: 10,
  fechaDeCierre: "2026-11-01T00:05:00-06:00",
  estado: "CERRADO",
  moneda: "CRC",
  totalCentimos: 9_315_000,
  tarifasAplicadas: [{ vigenteDesde: "2026-07-01", vigenteHasta: null, tarifaPorHoraCentimos: { B: 260000, A: 215000 }, porcentajeRecargo: 25 }],
  lineas: [
    { idAsistente: "a1", carne: "2023100001", nombre: "Diego", categoria: "B", minutosNormales: 930, minutosConRecargo: 420, minutosNoPagados: 0, montoCentimos: 6_305_000, noPagados: [] },
    {
      idAsistente: "a5",
      carne: "2024100005",
      nombre: "Andrés",
      categoria: "A",
      minutosNormales: 240,
      minutosConRecargo: 0,
      minutosNoPagados: 478,
      montoCentimos: 860_000,
      noPagados: [
        { semana: "2026-09-28", motivo: "SOBRE_TOPE", minutos: 240 },
        { semana: "2026-10-19", motivo: "MARCA_INCOMPLETA", minutos: 238 }
      ]
    }
  ]
};

describe("lista de meses", () => {
  it("muestra los 12 meses; los que la API no devuelve aún no empiezan y no llevan enlace", () => {
    const meses = mesesDelAnio(2026, [
      { anio: 2026, mes: 9, estado: "CERRADO" },
      { anio: 2026, mes: 10, estado: "POR_CERRAR" },
      { anio: 2026, mes: 11, estado: "EN_CURSO" }
    ]);

    expect(meses).toHaveLength(12);
    expect(meses.slice(8).map((m) => [m.nombre, m.texto, m.tieneEnlace])).toEqual([
      ["Septiembre", "Cerrado", true],
      ["Octubre", "Por cerrar", true],
      ["Noviembre", "En curso", true],
      ["Diciembre", "Aún no empieza", false]
    ]);
  });

  it("sin cierre, un mes terminado está por cerrar y el actual en curso", () => {
    expect(estadoSinCierre(2026, 10, "2026-11-24")).toBe("POR_CERRAR");
    expect(estadoSinCierre(2026, 11, "2026-11-24")).toBe("EN_CURSO");
    expect(estadoSinCierre(2027, 1, "2026-11-24")).toBe("FUTURO");
  });
});

describe("resultado del cierre", () => {
  const vista = vistaDelCierre(CIERRE);

  it("muestra el total, cuándo se cerró y cuántos asistentes tienen horas sin pagar", () => {
    expect(espacios(vista.total)).toBe("₡93 150,00");
    expect(vista.subtitulo).toBe("Total a pagar a 2 asistentes. Cerrado el 1 de noviembre a las 0:05.");
    expect(vista.avisoNoPagados).toBe("1 asistente tiene horas que no se pagan. Están resaltados en la tabla.");
  });

  it("resalta las filas con horas no pagadas y explica cada grupo en lenguaje sencillo", () => {
    const [diego, andres] = vista.lineas;
    expect(diego).toMatchObject({ normales: "15 h 30 min", conRecargo: "7 h", noPagadas: "0 h", resaltada: false });
    expect(andres?.resaltada).toBe(true);
    expect(andres?.notas).toEqual([
      "4 h sobre su tope en la semana del 28 de septiembre. No se pagan.",
      "3 h 58 min sin marca de salida en la semana del 19 de octubre. No se pagan."
    ]);
  });

  it("arma la tabla de tarifas con las categorías en orden y el enlace del archivo para Becas", () => {
    expect(vista.categorias).toEqual(["A", "B"]);
    expect(vista.tarifas.map((t) => [t.vigencia, t.valores.map(espacios), t.recargo])).toEqual([["Desde el 1 de julio de 2026", ["₡2 150,00", "₡2 600,00"], "25 %"]]);
    expect(vista.archivo).toEqual({ url: "/api/v1/cierres/2026/10/archivo", nombre: "becas-2026-10.csv" });
  });
});

describe("mensajes de error", () => {
  it("una tarifa faltante explica qué falta y ofrece ir a tarifas (ext 5b)", () => {
    const mensaje = mensajeDeErrorDelCierre(new ErrorDeApi(422, "TARIFA_NO_DEFINIDA", "x", { fecha: "2026-10-01", categoria: null }));

    expect(mensaje).toEqual({ titulo: "No se pudo cerrar el mes.", texto: "Falta la tarifa vigente el 1 de octubre de 2026. Regístrala y vuelve a cerrar el mes.", irATarifas: true });
  });

  it("un error interno pide reportar el número de solicitud y la falta de respuesta tranquiliza", () => {
    expect(mensajeDeErrorDelCierre(new ErrorDeApi(500, "ERROR_INTERNO", "x", {}, "abc-123")).texto).toBe("Reporta el número de solicitud abc-123.");
    expect(mensajeDeErrorDelCierre(new SinRespuesta()).texto).toMatch(/verás el mismo resultado/);
  });
});
