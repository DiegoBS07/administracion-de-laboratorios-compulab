// Lista de meses para la pantalla /cierres (GET /api/v1/cierres?anio=).
import { describe, expect, it } from "vitest";
import { DatoInvalido, Instante } from "../../../src/compartido/dominio/index.js";
import { CierreMensual, ListarCierresDelAnio, MesDeLiquidacion } from "../../../src/modulos/liquidacion/index.js";
import { RelojFijo } from "../../dobles/reloj-fijo.js";
import { RepositorioCierresEnMemoria } from "./dobles.js";

describe("ListarCierresDelAnio", () => {
  it("marca cada mes como CERRADO, POR_CERRAR o EN_CURSO y omite los que no han empezado", async () => {
    const cierres = new RepositorioCierresEnMemoria();
    await cierres.guardar(
      CierreMensual.cerrar({ mes: MesDeLiquidacion.de(2026, 9), lineas: [], tarifasAplicadas: [], fechaDeCierre: Instante.desdeISO("2026-10-01T00:05:00-06:00") })
    );

    const meses = await new ListarCierresDelAnio({ cierres, reloj: new RelojFijo("2026-11-24T10:00:00-06:00") }).ejecutar(2026);

    expect(meses.map((m) => `${m.mes}:${m.estado}`)).toEqual([
      "1:POR_CERRAR", "2:POR_CERRAR", "3:POR_CERRAR", "4:POR_CERRAR", "5:POR_CERRAR", "6:POR_CERRAR",
      "7:POR_CERRAR", "8:POR_CERRAR", "9:CERRADO", "10:POR_CERRAR", "11:EN_CURSO"
    ]);
  });

  it("un año futuro no tiene meses y un año imposible se rechaza", async () => {
    const listar = new ListarCierresDelAnio({ cierres: new RepositorioCierresEnMemoria(), reloj: new RelojFijo("2026-11-24T10:00:00-06:00") });

    expect(await listar.ejecutar(2027)).toEqual([]);
    await expect(listar.ejecutar(1900)).rejects.toBeInstanceOf(DatoInvalido);
  });
});
