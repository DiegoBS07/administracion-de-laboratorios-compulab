// Consultas del módulo horarios (docs/08-componentes.md, 8.4): no cambian nada.
import { Fecha, Franja, type Instante, Semana } from "../../../compartido/dominio/index.js";
import { AgendaDelAsistente } from "../dominio/agenda-del-asistente.js";
import { Disponibilidad } from "../dominio/disponibilidad.js";
import type { EstadoTurno } from "../dominio/estado-turno.js";
import { LaboratorioNoExiste } from "./errores.js";
import type {
  AsistenteDelLaboratorio,
  AsistentesDelLaboratorio,
  BloqueDeDisponibilidadDTO,
  CatalogoDeLaboratorios,
  ConsultaAsistentes,
  Laboratorio,
  RepositorioTurnos
} from "./puertos.js";

async function exigirLaboratorio(catalogo: CatalogoDeLaboratorios, idLaboratorio: string): Promise<Laboratorio> {
  const laboratorio = await catalogo.porId(idLaboratorio);
  if (!laboratorio) throw new LaboratorioNoExiste(idLaboratorio);
  return laboratorio;
}

/** GET /api/v1/laboratorios. */
export class ListarLaboratorios {
  readonly #laboratorios: CatalogoDeLaboratorios;

  constructor(dependencias: { laboratorios: CatalogoDeLaboratorios }) {
    this.#laboratorios = dependencias.laboratorios;
  }

  async ejecutar(): Promise<Laboratorio[]> {
    return (await this.#laboratorios.todos()).sort((a, b) => a.nombre.localeCompare(b.nombre));
  }
}

/** Respuesta de GET /api/v1/laboratorios/{id}/turnos?semana= (8.7). */
export interface HorarioSemanalDTO {
  idLaboratorio: string;
  semana: string;
  turnos: {
    id: string;
    fecha: string;
    horaInicio: string;
    horaFin: string;
    estado: EstadoTurno;
    asistente: { id: string; nombre: string } | null;
  }[];
}

/** RF-11 · Turnos del laboratorio en la semana que empieza ese lunes. */
export class ConsultarHorario {
  readonly #d: { laboratorios: CatalogoDeLaboratorios; turnos: RepositorioTurnos; asistentes: ConsultaAsistentes };

  constructor(dependencias: { laboratorios: CatalogoDeLaboratorios; turnos: RepositorioTurnos; asistentes: ConsultaAsistentes }) {
    this.#d = dependencias;
  }

  async ejecutar(idLaboratorio: string, lunes: string): Promise<HorarioSemanalDTO> {
    const semana = Semana.queEmpiezaEl(Fecha.desdeTexto(lunes));
    await exigirLaboratorio(this.#d.laboratorios, idLaboratorio);
    const turnos = (await this.#d.turnos.delLaboratorioEntre(idLaboratorio, semana.franja())).sort((a, b) =>
      a.franja.inicio.comparar(b.franja.inicio)
    );
    const nombres = new Map<string, string>();
    for (const id of new Set(turnos.map((t) => t.idAsistente).filter((id): id is string => id !== null))) {
      nombres.set(id, (await this.#d.asistentes.obtener(id))?.nombre ?? id);
    }
    return {
      idLaboratorio,
      semana: semana.lunes.aTexto(),
      turnos: turnos.map((t) => ({
        id: t.id,
        fecha: t.fecha.aTexto(),
        horaInicio: t.horaInicio.aTexto(),
        horaFin: t.horaFin.aTexto(),
        estado: t.estado,
        asistente: t.idAsistente ? { id: t.idAsistente, nombre: nombres.get(t.idAsistente) ?? t.idAsistente } : null
      }))
    };
  }
}

/** Respuesta de GET /api/v1/laboratorios/{id}/asistentes?semana= (8.7). */
export interface AsistenteParaElegirDTO {
  id: string;
  nombre: string;
  categoria: string;
  topeSemanalMinutos: number;
  minutosProgramadosSemana: number;
  disponibilidad: BloqueDeDisponibilidadDTO[];
}

/** Asistentes activos del laboratorio con lo necesario para elegir a quién asignar (pantalla de CU-06). */
export class ConsultarAsistentesDelLaboratorio {
  readonly #d: { laboratorios: CatalogoDeLaboratorios; asistentes: AsistentesDelLaboratorio; turnos: RepositorioTurnos };

  constructor(dependencias: { laboratorios: CatalogoDeLaboratorios; asistentes: AsistentesDelLaboratorio; turnos: RepositorioTurnos }) {
    this.#d = dependencias;
  }

  async ejecutar(idLaboratorio: string, lunes: string): Promise<AsistenteParaElegirDTO[]> {
    const semana = Semana.queEmpiezaEl(Fecha.desdeTexto(lunes));
    await exigirLaboratorio(this.#d.laboratorios, idLaboratorio);
    const asistentes = await this.#d.asistentes.activosDe(idLaboratorio);
    const filas = await Promise.all(asistentes.map(async (a) => this.#fila(a, semana)));
    return filas.sort((a, b) => a.nombre.localeCompare(b.nombre));
  }

  async #fila(asistente: AsistenteDelLaboratorio, semana: Semana): Promise<AsistenteParaElegirDTO> {
    const agenda = AgendaDelAsistente.de({
      idAsistente: asistente.id,
      activo: asistente.activo,
      topeSemanalMinutos: asistente.topeSemanalMinutos,
      disponibilidad: Disponibilidad.de(asistente.disponibilidad),
      semana,
      turnos: await this.#d.turnos.delAsistenteEntre(asistente.id, semana.franja())
    });
    return {
      id: asistente.id,
      nombre: asistente.nombre,
      categoria: asistente.categoria,
      topeSemanalMinutos: agenda.topeSemanalMinutos,
      minutosProgramadosSemana: agenda.minutosProgramados,
      disponibilidad: asistente.disponibilidad.map((b) => ({ ...b }))
    };
  }
}

/**
 * Interfaz provista CoberturaDeLaboratorio (contrato en 8.4): franjas en que el laboratorio estará
 * abierto según sus turnos ASIGNADO o EN_CURSO (RN-15), unidas y recortadas al periodo.
 */
export class ConsultarCobertura {
  readonly #d: { laboratorios: CatalogoDeLaboratorios; turnos: RepositorioTurnos };

  constructor(dependencias: { laboratorios: CatalogoDeLaboratorios; turnos: RepositorioTurnos }) {
    this.#d = dependencias;
  }

  async franjasAbiertas(idLaboratorio: string, periodo: Franja): Promise<Franja[]> {
    await exigirLaboratorio(this.#d.laboratorios, idLaboratorio);
    const abiertos = (await this.#d.turnos.delLaboratorioEntre(idLaboratorio, periodo)).filter((t) => t.abreElLaboratorio());
    return Franja.fusionar(abiertos.map((t) => t.franja)).map((f) =>
      Franja.de(f.inicio.esAnteriorA(periodo.inicio) ? periodo.inicio : f.inicio, f.fin.esPosteriorA(periodo.fin) ? periodo.fin : f.fin)
    );
  }
}

/** Un turno programado, tal como lo usan asistencia y liquidación. */
export interface TurnoProgramadoDTO {
  id: string;
  idLaboratorio: string;
  idAsistente: string | null;
  inicio: Instante;
  fin: Instante;
  estado: EstadoTurno;
}

/** Interfaz provista TurnosProgramados (8.4): turnos de todos los laboratorios que empiezan en el periodo. */
export class ConsultarTurnosProgramados {
  readonly #turnos: RepositorioTurnos;

  constructor(dependencias: { turnos: RepositorioTurnos }) {
    this.#turnos = dependencias.turnos;
  }

  async delPeriodo(periodo: Franja): Promise<TurnoProgramadoDTO[]> {
    return (await this.#turnos.delPeriodo(periodo))
      .filter((t) => periodo.contiene(t.franja.inicio))
      .sort((a, b) => a.franja.inicio.comparar(b.franja.inicio))
      .map((t) => ({ id: t.id, idLaboratorio: t.idLaboratorio, idAsistente: t.idAsistente, inicio: t.franja.inicio, fin: t.franja.fin, estado: t.estado }));
  }
}
