import type { Franja, Semana } from "../../../compartido/dominio/index.js";
import type { Transaccion, UnidadDeTrabajoEnMemoria } from "../../../compartido/infraestructura/unidad-de-trabajo-en-memoria.js";
import { ClaveDeSolicitudReutilizada } from "../aplicacion/errores.js";
import type { RepositorioReservas } from "../aplicacion/puertos.js";
import { MaquinaNoDisponible, YaTieneReservaActiva } from "../dominio/errores.js";
import type { Reserva } from "../dominio/reserva.js";

/**
 * Repositorio de reservas en memoria: lo usa el núcleo ejecutable (sin PostgreSQL) y las pruebas.
 * Respeta el contrato de ADR-0009 y ADR-0010: lo guardado en una transacción no lo ven las demás
 * hasta que confirma, y guardar actúa como las restricciones de la base (exclusión por máquina,
 * una activa por estudiante, clave única).
 */
export class RepositorioReservasEnMemoria implements RepositorioReservas {
  readonly #confirmadas: Reserva[] = [];
  readonly #enCurso = new Set<Reserva>();
  readonly #propiasDe = new WeakMap<Transaccion, Reserva[]>();
  readonly #unidad: UnidadDeTrabajoEnMemoria;

  constructor(unidad: UnidadDeTrabajoEnMemoria, iniciales: readonly Reserva[] = []) {
    this.#unidad = unidad;
    this.#confirmadas.push(...iniciales);
  }

  get todas(): readonly Reserva[] {
    return [...this.#confirmadas];
  }

  async porClaveDeSolicitud(idEstudiante: string, claveSolicitud: string): Promise<Reserva | null> {
    return this.#visibles().find((r) => r.fueCreadaCon(idEstudiante, claveSolicitud)) ?? null;
  }

  async activaDelEstudiante(idEstudiante: string): Promise<Reserva | null> {
    await Promise.resolve(); // como una consulta real: cede el turno a otras operaciones
    return this.#visibles().find((r) => r.idEstudiante === idEstudiante && r.estaActiva()) ?? null;
  }

  async delEstudianteEnSemana(idEstudiante: string, semana: Semana): Promise<Reserva[]> {
    await Promise.resolve();
    return this.#visibles().filter((r) => r.idEstudiante === idEstudiante && semana.contiene(r.franja.inicio.fecha));
  }

  async deMaquinaEntre(idMaquina: string, franja: Franja): Promise<Reserva[]> {
    await Promise.resolve();
    return this.#visibles().filter((r) => r.idMaquina === idMaquina && r.franja.seTraslapaCon(franja));
  }

  async guardar(reserva: Reserva): Promise<void> {
    const transaccion = this.#unidad.actual();
    const existentes = [...this.#confirmadas, ...this.#enCurso];
    const enLaMaquina = existentes.find((r) => r.idMaquina === reserva.idMaquina && r.chocaCon(reserva.franja));
    if (enLaMaquina && reserva.estaActiva()) {
      throw new MaquinaNoDisponible(reserva.idMaquina, enLaMaquina.franja.inicio.aISO(), enLaMaquina.franja.fin.aISO());
    }
    const otraActiva = existentes.find((r) => r.idEstudiante === reserva.idEstudiante && r.estaActiva());
    if (otraActiva && reserva.estaActiva()) {
      throw new YaTieneReservaActiva(otraActiva.id, otraActiva.franja.inicio.aISO(), otraActiva.franja.fin.aISO());
    }
    if (reserva.claveSolicitud && existentes.some((r) => r.fueCreadaCon(reserva.idEstudiante, reserva.claveSolicitud ?? ""))) {
      throw new ClaveDeSolicitudReutilizada(reserva.claveSolicitud);
    }
    this.#enCurso.add(reserva);
    const propias = this.#propiasDe.get(transaccion) ?? [];
    propias.push(reserva);
    this.#propiasDe.set(transaccion, propias);
    transaccion.alConfirmar(() => this.#confirmadas.push(reserva));
    transaccion.alTerminar(() => this.#enCurso.delete(reserva));
  }

  #visibles(): Reserva[] {
    let propias: Reserva[] = [];
    try {
      propias = this.#propiasDe.get(this.#unidad.actual()) ?? [];
    } catch {
      propias = []; // consulta fuera de una transacción
    }
    return [...this.#confirmadas, ...propias];
  }
}
