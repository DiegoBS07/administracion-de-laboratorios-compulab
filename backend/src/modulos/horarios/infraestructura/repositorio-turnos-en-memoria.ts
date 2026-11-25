import type { Franja } from "../../../compartido/dominio/index.js";
import { Cerrojos, type Transaccion, type UnidadDeTrabajoEnMemoria } from "../../../compartido/infraestructura/unidad-de-trabajo-en-memoria.js";
import type { RepositorioTurnos } from "../aplicacion/puertos.js";
import { FranjaOcupadaEnLaboratorio, resumenDeConflicto, TraslapeDeTurno } from "../dominio/errores.js";
import type { Turno } from "../dominio/turno.js";

/**
 * Repositorio de turnos en memoria: lo usa el núcleo ejecutable (sin PostgreSQL) y las pruebas.
 * Respeta el contrato de ADR-0009:
 * - bloquearAgendaDe serializa las transacciones del mismo asistente;
 * - lo que una transacción guarda no lo ven las demás hasta que confirma;
 * - guardar actúa como las restricciones EXCLUDE de la base: falla si choca con lo confirmado
 *   o con lo que otra transacción en curso ya guardó.
 */
export class RepositorioTurnosEnMemoria implements RepositorioTurnos {
  readonly #confirmados: Turno[] = [];
  readonly #enCurso = new Set<Turno>();
  readonly #propiosDe = new WeakMap<Transaccion, Turno[]>();
  readonly #cerrojos = new Cerrojos();
  readonly #unidad: UnidadDeTrabajoEnMemoria;

  constructor(unidad: UnidadDeTrabajoEnMemoria, iniciales: readonly Turno[] = []) {
    this.#unidad = unidad;
    this.#confirmados.push(...iniciales);
  }

  /** Turnos confirmados (para las verificaciones de las pruebas). */
  get todos(): readonly Turno[] {
    return [...this.#confirmados];
  }

  async porClaveDeSolicitud(idUsuario: string, claveSolicitud: string): Promise<Turno | null> {
    return this.#visibles().find((t) => t.fueCreadoCon(idUsuario, claveSolicitud)) ?? null;
  }

  async bloquearAgendaDe(idAsistente: string): Promise<void> {
    const transaccion = this.#unidad.actual();
    const liberar = await this.#cerrojos.adquirir(idAsistente);
    transaccion.alTerminar(liberar);
  }

  async delAsistenteEntre(idAsistente: string, franja: Franja): Promise<Turno[]> {
    await Promise.resolve(); // como una consulta real: cede el turno a otras operaciones
    return this.#visibles().filter((t) => t.idAsistente === idAsistente && t.franja.seTraslapaCon(franja));
  }

  async delLaboratorioEntre(idLaboratorio: string, franja: Franja): Promise<Turno[]> {
    await Promise.resolve();
    return this.#visibles().filter((t) => t.idLaboratorio === idLaboratorio && t.franja.seTraslapaCon(franja));
  }

  async delPeriodo(franja: Franja): Promise<Turno[]> {
    await Promise.resolve();
    return this.#visibles().filter((t) => t.franja.seTraslapaCon(franja));
  }

  async guardar(turno: Turno): Promise<void> {
    const transaccion = this.#unidad.actual();
    const existentes = [...this.#confirmados, ...this.#enCurso];
    const delAsistente = existentes.find((t) => t.idAsistente !== null && t.idAsistente === turno.idAsistente && t.chocaCon(turno.franja));
    if (delAsistente && turno.ocupaLaFranja()) {
      throw new TraslapeDeTurno(resumenDeConflicto(delAsistente));
    }
    const delLaboratorio = existentes.find((t) => t.idLaboratorio === turno.idLaboratorio && t.chocaCon(turno.franja));
    if (delLaboratorio && turno.ocupaLaFranja()) {
      throw new FranjaOcupadaEnLaboratorio(resumenDeConflicto(delLaboratorio));
    }
    this.#enCurso.add(turno);
    const propios = this.#propiosDe.get(transaccion) ?? [];
    propios.push(turno);
    this.#propiosDe.set(transaccion, propios);
    transaccion.alConfirmar(() => this.#confirmados.push(turno));
    transaccion.alTerminar(() => this.#enCurso.delete(turno));
  }

  #visibles(): Turno[] {
    let propios: Turno[] = [];
    try {
      propios = this.#propiosDe.get(this.#unidad.actual()) ?? [];
    } catch {
      propios = []; // consulta fuera de una transacción
    }
    return [...this.#confirmados, ...propios];
  }
}
