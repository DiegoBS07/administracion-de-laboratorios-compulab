// Puentes entre módulos y adaptadores de demostración (docs/07-arquitectura.md, 7.4 regla 4).
// Los módulos no se importan entre sí: aquí se conecta el puerto requerido de uno con la interfaz
// provista de otro, traduciendo sus errores. También están los adaptadores que hacen las veces de
// los módulos fuera del núcleo (asistentes, asistencia, calendario, tarifas).
import type { FastifyBaseLogger } from "fastify";
import type { Fecha, Franja } from "../compartido/dominio/index.js";
import * as horarios from "../modulos/horarios/index.js";
import type { ConsultarRoles } from "../modulos/identidad/index.js";
import type * as liquidacion from "../modulos/liquidacion/index.js";
import * as reservas from "../modulos/reservas/index.js";
import type { AsistenteDeDemostracion, Marcas } from "./datos-de-demostracion.js";

/** reservas.CoberturaDeLaboratorio ← horarios.ConsultarCobertura (8.5: el puente traduce el error). */
export class CoberturaParaReservas implements reservas.CoberturaDeLaboratorio {
  readonly #cobertura: horarios.ConsultarCobertura;

  constructor(cobertura: horarios.ConsultarCobertura) {
    this.#cobertura = cobertura;
  }

  async franjasAbiertas(idLaboratorio: string, periodo: Franja): Promise<Franja[]> {
    try {
      return await this.#cobertura.franjasAbiertas(idLaboratorio, periodo);
    } catch (error) {
      if (error instanceof horarios.LaboratorioNoExiste) throw new reservas.LaboratorioNoExiste(idLaboratorio);
      throw error;
    }
  }
}

/** horarios.Autorizacion ← roles de identidad (8.3). Registra los intentos denegados (QA-7). */
export class AutorizacionPorRoles implements horarios.Autorizacion {
  readonly #roles: ConsultarRoles;
  readonly #bitacora: FastifyBaseLogger | null;

  constructor(roles: ConsultarRoles, bitacora: FastifyBaseLogger | null) {
    this.#roles = roles;
    this.#bitacora = bitacora;
  }

  async puedeModificarHorario(usuario: horarios.UsuarioActual, idLaboratorio: string): Promise<boolean> {
    const roles = await this.#roles.de(usuario.id);
    const puede = roles.some((r) => r.rol === "COORDINADOR_SOPORTE" || (r.rol === "COORDINADOR_LABORATORIO" && r.idLaboratorio === idLaboratorio));
    if (!puede) this.#bitacora?.warn({ seguridad: "horario-denegado", idUsuario: usuario.id, idLaboratorio });
    return puede;
  }
}

/** Estados de turno que no generan horas para liquidar. */
const SIN_HORAS = new Set(["VACANTE", "DESCARTADO", "PENDIENTE_ACEPTACION"]);

/** Marcas de entrada y salida por turno (las guarda el módulo asistencia, fuera del núcleo). */
export interface LectorDeMarcas {
  de(idsTurnos: readonly string[]): Promise<ReadonlyMap<string, Marcas>>;
}

export class MarcasEnMemoria implements LectorDeMarcas {
  readonly #marcas: ReadonlyMap<string, Marcas>;

  constructor(marcas: ReadonlyMap<string, Marcas>) {
    this.#marcas = marcas;
  }

  async de(idsTurnos: readonly string[]): Promise<ReadonlyMap<string, Marcas>> {
    return new Map(idsTurnos.flatMap((id) => (this.#marcas.has(id) ? [[id, this.#marcas.get(id) as Marcas] as const] : [])));
  }
}

/** liquidacion.HorasTrabajadas ← horarios.TurnosProgramados + las marcas de cada turno. */
export class HorasTrabajadasDesdeHorarios implements liquidacion.HorasTrabajadas {
  readonly #turnos: horarios.ConsultarTurnosProgramados;
  readonly #marcas: LectorDeMarcas;

  constructor(turnos: horarios.ConsultarTurnosProgramados, marcas: LectorDeMarcas) {
    this.#turnos = turnos;
    this.#marcas = marcas;
  }

  async delPeriodo(periodo: Franja): Promise<liquidacion.RegistroDeTurnoTrabajado[]> {
    const turnos = (await this.#turnos.delPeriodo(periodo)).filter(
      (t): t is horarios.TurnoProgramadoDTO & { idAsistente: string } => t.idAsistente !== null && !SIN_HORAS.has(t.estado)
    );
    const marcas = await this.#marcas.de(turnos.map((t) => t.id));
    return turnos.map((t) => ({
      idTurno: t.id,
      idAsistente: t.idAsistente,
      inicioProgramado: t.inicio,
      finProgramado: t.fin,
      entrada: marcas.get(t.id)?.entrada ?? null,
      salida: marcas.get(t.id)?.salida ?? null,
      estado: t.estado
    }));
  }
}

/**
 * Hace las veces del módulo asistentes (fuera del núcleo): implementa los puertos de horarios
 * (ConsultaAsistentes, AsistentesDelLaboratorio) y de liquidación (DatosDeAsistentes).
 */
export class AsistentesDeDemostracion implements horarios.ConsultaAsistentes, horarios.AsistentesDelLaboratorio {
  readonly #asistentes: ReadonlyMap<string, AsistenteDeDemostracion>;
  readonly #hoy: () => Fecha;

  constructor(asistentes: readonly AsistenteDeDemostracion[], hoy: () => Fecha) {
    this.#asistentes = new Map(asistentes.map((a) => [a.id, a]));
    this.#hoy = hoy;
  }

  async obtener(idAsistente: string): Promise<horarios.AsistenteDelLaboratorio | null> {
    const a = this.#asistentes.get(idAsistente);
    return a ? this.#paraHorario(a) : null;
  }

  /** Puerto DatosDeAsistentes de liquidación: un asistente con turnos siempre existe. */
  paraLiquidacion(): liquidacion.DatosDeAsistentes {
    return {
      obtener: async (idAsistente) => {
        const a = this.#asistentes.get(idAsistente);
        if (!a) throw new Error(`El asistente ${idAsistente} tiene turnos pero no está registrado.`);
        return this.#paraHorario(a);
      }
    };
  }

  async activosDe(idLaboratorio: string): Promise<horarios.AsistenteDelLaboratorio[]> {
    return [...this.#asistentes.values()].filter((a) => a.activo && a.laboratorios.includes(idLaboratorio)).map((a) => this.#paraHorario(a));
  }

  #paraHorario(a: AsistenteDeDemostracion): horarios.AsistenteDelLaboratorio & liquidacion.DatosDeUnAsistente {
    const hoy = this.#hoy();
    const vigentes = [...a.topes].sort((x, y) => x.vigenteDesde.comparar(y.vigenteDesde)).filter((t) => !t.vigenteDesde.esPosteriorA(hoy));
    const tope = vigentes[vigentes.length - 1] ?? a.topes[0];
    return {
      id: a.id,
      nombre: a.nombre,
      activo: a.activo,
      categoria: a.categoria,
      carne: a.carne,
      topeSemanalMinutos: tope?.minutosPorSemana ?? 0,
      topes: a.topes.map((t) => ({ ...t })),
      disponibilidad: a.disponibilidad.map((b) => ({ ...b }))
    };
  }
}

export class CatalogoDeLaboratoriosFijo implements horarios.CatalogoDeLaboratorios {
  readonly #laboratorios: readonly horarios.Laboratorio[];

  constructor(laboratorios: readonly horarios.Laboratorio[]) {
    this.#laboratorios = laboratorios;
  }

  async todos(): Promise<horarios.Laboratorio[]> {
    return this.#laboratorios.map((l) => ({ ...l }));
  }

  async porId(idLaboratorio: string): Promise<horarios.Laboratorio | null> {
    const laboratorio = this.#laboratorios.find((l) => l.id === idLaboratorio);
    return laboratorio ? { ...laboratorio } : null;
  }
}

export class CalendarioFijo implements horarios.CalendarioAcademico {
  readonly #semestre: { inicio: Fecha; fin: Fecha };

  constructor(semestre: { inicio: Fecha; fin: Fecha }) {
    this.#semestre = semestre;
  }

  async semestreVigente(): Promise<{ inicio: Fecha; fin: Fecha }> {
    return this.#semestre;
  }
}

/** liquidacion.TablaTarifas con las vigencias de demostración (8.6: "tarifas fijas"). */
export class TablaTarifasFija implements liquidacion.TablaTarifas {
  readonly #vigencias: readonly liquidacion.VigenciaDeTarifas[];

  constructor(vigencias: readonly liquidacion.VigenciaDeTarifas[]) {
    this.#vigencias = vigencias;
  }

  async vigenciasEntre(desde: Fecha, hasta: Fecha): Promise<liquidacion.VigenciaDeTarifas[]> {
    return this.#vigencias.filter((v) => !v.vigenteDesde.esPosteriorA(hasta) && (v.vigenteHasta === null || !v.vigenteHasta.esAnteriorA(desde)));
  }
}
