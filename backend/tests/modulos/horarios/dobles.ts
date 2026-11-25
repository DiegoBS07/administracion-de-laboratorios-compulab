// Dobles de las interfaces requeridas del módulo horarios (docs/08-componentes.md, 8.4).
import { Fecha } from "../../../src/compartido/dominio/index.js";
import type {
  AsistenteParaHorario,
  Autorizacion,
  CalendarioAcademico,
  ConsultaAsistentes,
  UsuarioActual
} from "../../../src/modulos/horarios/index.js";

export { RepositorioTurnosEnMemoria } from "../../../src/modulos/horarios/infraestructura/repositorio-turnos-en-memoria.js";

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
