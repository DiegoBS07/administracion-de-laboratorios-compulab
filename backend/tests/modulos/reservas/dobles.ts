// Dobles de las interfaces requeridas del módulo reservas (docs/08-componentes.md, 8.5).
import { Franja, type Semana } from "../../../src/compartido/dominio/index.js";
import {
  ClaveDeSolicitudReutilizada,
  type CoberturaDeLaboratorio,
  LaboratorioNoExiste,
  type Maquina,
  MaquinaNoDisponible,
  type RepositorioMaquinas,
  type RepositorioReservas,
  type Reserva,
  YaTieneReservaActiva
} from "../../../src/modulos/reservas/index.js";
import type { Transaccion, UnidadDeTrabajoEnMemoria } from "../../dobles/unidad-de-trabajo-en-memoria.js";

export class RepositorioMaquinasEnMemoria implements RepositorioMaquinas {
  readonly #maquinas: readonly Maquina[];

  constructor(maquinas: readonly Maquina[]) {
    this.#maquinas = maquinas;
  }

  async porId(idMaquina: string): Promise<Maquina | null> {
    return this.#maquinas.find((m) => m.id === idMaquina) ?? null;
  }

  async delLaboratorio(idLaboratorio: string): Promise<Maquina[]> {
    return this.#maquinas.filter((m) => m.idLaboratorio === idLaboratorio);
  }
}

/**
 * Repositorio de reservas en memoria que respeta el contrato de ADR-0009 y ADR-0010:
 * lo guardado en una transacción no lo ven las demás hasta que confirma, y guardar actúa como
 * las restricciones de la base (exclusión por máquina, una activa por estudiante, clave única).
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
