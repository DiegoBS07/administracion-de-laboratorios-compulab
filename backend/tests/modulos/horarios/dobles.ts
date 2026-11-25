// Dobles de las interfaces requeridas del módulo horarios (docs/08-componentes.md, 8.4).
import { Fecha, type Franja } from "../../../src/compartido/dominio/index.js";
import type {
  AsistenteParaHorario,
  Autorizacion,
  CalendarioAcademico,
  ConsultaAsistentes,
  RepositorioTurnos,
  UsuarioActual
} from "../../../src/modulos/horarios/index.js";
import { FranjaOcupadaEnLaboratorio, TraslapeDeTurno, type Turno } from "../../../src/modulos/horarios/index.js";
import { resumenDeConflicto } from "../../../src/modulos/horarios/dominio/errores.js";
import { Cerrojos, type Transaccion, type UnidadDeTrabajoEnMemoria } from "../../dobles/unidad-de-trabajo-en-memoria.js";

/**
 * Repositorio de turnos en memoria que respeta el contrato de ADR-0009:
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
      propios = [];
    }
    return [...this.#confirmados, ...propios];
  }
}

export class ConsultaAsistentesFija implements ConsultaAsistentes {
  readonly #asistentes: Map<string, AsistenteParaHorario>;

  constructor(asistentes: readonly AsistenteParaHorario[]) {
    this.#asistentes = new Map(asistentes.map((a) => [a.id, a]));
  }

  async obtener(idAsistente: string): Promise<AsistenteParaHorario | null> {
    return this.#asistentes.get(idAsistente) ?? null;
  }
}

export class CalendarioFijo implements CalendarioAcademico {
  readonly #semestre: { inicio: Fecha; fin: Fecha } | null;

  constructor(inicio: string | null, fin?: string) {
    this.#semestre = inicio && fin ? { inicio: Fecha.desdeTexto(inicio), fin: Fecha.desdeTexto(fin) } : null;
  }

  async semestreVigente(): Promise<{ inicio: Fecha; fin: Fecha } | null> {
    return this.#semestre;
  }
}

/** Doble de Autorizacion: cada usuario puede modificar ciertos laboratorios ("*" = coordinador de soporte). */
export class AutorizacionFija implements Autorizacion {
  readonly denegados: { idUsuario: string; idLaboratorio: string }[] = [];
  readonly #permisos: Record<string, readonly string[]>;

  constructor(permisos: Record<string, readonly string[]>) {
    this.#permisos = permisos;
  }

  async puedeModificarHorario(usuario: UsuarioActual, idLaboratorio: string): Promise<boolean> {
    const labs = this.#permisos[usuario.id] ?? [];
    const puede = labs.includes("*") || labs.includes(idLaboratorio);
    if (!puede) this.denegados.push({ idUsuario: usuario.id, idLaboratorio });
    return puede;
  }
}
