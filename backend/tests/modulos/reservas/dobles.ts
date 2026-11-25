// Dobles de las interfaces requeridas del módulo reservas (docs/08-componentes.md, 8.5).
import { Franja } from "../../../src/compartido/dominio/index.js";
import { type CoberturaDeLaboratorio, LaboratorioNoExiste } from "../../../src/modulos/reservas/index.js";

export { RepositorioMaquinasEnMemoria } from "../../../src/modulos/reservas/infraestructura/repositorio-maquinas-en-memoria.js";
export { RepositorioReservasEnMemoria } from "../../../src/modulos/reservas/infraestructura/repositorio-reservas-en-memoria.js";

/**
 * Doble de CoberturaDeLaboratorio: franjas de turnos asignados por laboratorio. Las devuelve unidas
 * y recortadas al periodo pedido, como dice el contrato de 8.4.
 */
export class CoberturaFija implements CoberturaDeLaboratorio {
  readonly #porLaboratorio: Record<string, readonly Franja[]>;

  constructor(porLaboratorio: Record<string, readonly Franja[]>) {
    this.#porLaboratorio = porLaboratorio;
  }

  async franjasAbiertas(idLaboratorio: string, periodo: Franja): Promise<Franja[]> {
    const turnos = this.#porLaboratorio[idLaboratorio];
    if (!turnos) throw new LaboratorioNoExiste(idLaboratorio);
    return Franja.fusionar(turnos.filter((f) => f.seTraslapaCon(periodo))).map((f) =>
      Franja.de(f.inicio.esAnteriorA(periodo.inicio) ? periodo.inicio : f.inicio, f.fin.esPosteriorA(periodo.fin) ? periodo.fin : f.fin)
    );
  }
}
