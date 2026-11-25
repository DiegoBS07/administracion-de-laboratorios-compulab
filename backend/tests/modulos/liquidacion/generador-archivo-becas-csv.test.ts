// Adaptador GeneradorArchivoBecas (docs/08-componentes.md, 8.6; formato SUP-03).
import { describe, expect, it } from "vitest";
import { Dinero, Fecha, Hora, Instante } from "../../../src/compartido/dominio/index.js";
import {
  CierreMensual,
  ENCABEZADO_BECAS,
  GeneradorArchivoBecasCsv,
  LineaDeLiquidacion,
  MesDeLiquidacion
} from "../../../src/modulos/liquidacion/index.js";

const linea = (carne: string, nombre: string, minutosNormales: number, centimos: number) =>
  LineaDeLiquidacion.de({
    idAsistente: `a-${carne}`,
    carne,
    nombre,
    categoria: "A",
    minutosNormales,
    minutosConRecargo: 0,
    noPagados: [],
    monto: Dinero.deCentimos(centimos)
  });

const cierreCon = (...lineas: LineaDeLiquidacion[]) =>
  CierreMensual.cerrar({
    mes: MesDeLiquidacion.de(2026, 10),
    lineas,
    tarifasAplicadas: [],
    fechaDeCierre: Instante.de(Fecha.desdeTexto("2026-11-01"), Hora.de(0, 5))
  });

const filas = (contenido: string) => contenido.split("\r\n");

describe("GeneradorArchivoBecasCsv", () => {
  const generador = new GeneradorArchivoBecasCsv();

  it("escribe el encabezado de Becas y una fila por línea, ordenadas por carné", () => {
    const archivo = generador.generar(cierreCon(linea("2023", "Beto", 60, 215000), linea("2021", "Ana", 90, 322500)));

    expect(archivo).toMatchObject({ nombre: "becas-2026-10.csv", tipo: "text/csv" });
    expect(filas(archivo.contenido)).toEqual([
      ENCABEZADO_BECAS,
      "2026-10,2021,Ana,A,1.50,0.00,0.00,3225.00",
      "2026-10,2023,Beto,A,1.00,0.00,0.00,2150.00",
      ""
    ]);
  });

  it("redondea las horas a dos decimales sin errores de coma flotante", () => {
    // 1 min = 0,0166… h → 0.02; 59 min = 0,9833… h → 0.98; 5 céntimos → 0.05
    const archivo = generador.generar(cierreCon(linea("1", "Ana", 1, 5), linea("2", "Beto", 59, 0)));

    expect(filas(archivo.contenido).slice(1, 3)).toEqual(["2026-10,1,Ana,A,0.02,0.00,0.00,0.05", "2026-10,2,Beto,A,0.98,0.00,0.00,0.00"]);
  });

  it("pone comillas a los textos con coma o comillas y neutraliza fórmulas", () => {
    const archivo = generador.generar(cierreCon(linea("1", 'Mora, "Andy"', 60, 0), linea("2", "=HYPERLINK(1)", 60, 0)));

    expect(filas(archivo.contenido)[1]).toBe('2026-10,1,"Mora, ""Andy""",A,1.00,0.00,0.00,0.00');
    expect(filas(archivo.contenido)[2]).toBe("2026-10,2,'=HYPERLINK(1),A,1.00,0.00,0.00,0.00");
  });

  it("es determinista y un mes sin líneas produce solo el encabezado", () => {
    const cierre = cierreCon(linea("1", "Ana", 60, 215000));

    expect(generador.generar(cierre)).toEqual(generador.generar(cierre));
    expect(generador.generar(cierreCon()).contenido).toBe(`${ENCABEZADO_BECAS}\r\n`);
  });
});
