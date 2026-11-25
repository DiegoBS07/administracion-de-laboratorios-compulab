import { CierreYaExiste } from "../aplicacion/errores.js";
import type { RepositorioCierres } from "../aplicacion/puertos.js";
import type { CierreMensual } from "../dominio/cierre-mensual.js";
import type { MesDeLiquidacion } from "../dominio/mes-de-liquidacion.js";

/**
 * Repositorio de cierres en memoria: lo usa el núcleo ejecutable (sin PostgreSQL) y las pruebas.
 * Actúa como la restricción UNIQUE (anio, mes) de la base: guardar un segundo cierre del mismo mes
 * lanza CierreYaExiste (ext 2c). Las consultas ceden el turno, como una consulta real, para que dos
 * cierres simultáneos puedan intercalarse.
 */
export class RepositorioCierresEnMemoria implements RepositorioCierres {
  readonly #cierres = new Map<string, CierreMensual>();

  get todos(): readonly CierreMensual[] {
    return [...this.#cierres.values()];
  }

  async porMes(mes: MesDeLiquidacion): Promise<CierreMensual | null> {
    await Promise.resolve();
    return this.#cierres.get(mes.clave) ?? null;
  }

  async delAnio(anio: number): Promise<CierreMensual[]> {
    await Promise.resolve();
    return this.todos.filter((c) => c.mes.anio === anio).sort((a, b) => a.mes.mes - b.mes.mes);
  }

  async guardar(cierre: CierreMensual): Promise<void> {
    await Promise.resolve();
    if (this.#cierres.has(cierre.mes.clave)) throw new CierreYaExiste(cierre.mes.clave);
    this.#cierres.set(cierre.mes.clave, cierre);
  }
}
