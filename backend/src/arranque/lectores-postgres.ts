// Lectores PostgreSQL de los datos que en el diseño pertenecen a módulos fuera del núcleo
// (asistentes, asistencia, calendario académico). Hacen las veces de esos módulos detrás de los
// puertos de horarios y liquidación, igual que sus equivalentes en memoria de puentes.ts.
import { Fecha, type Reloj } from "../compartido/dominio/index.js";
import { horaDe, instanteDe, type UnidadDeTrabajoPostgres } from "../compartido/infraestructura/postgres/conexion.js";
import type * as horarios from "../modulos/horarios/index.js";
import type * as liquidacion from "../modulos/liquidacion/index.js";
import type { Marcas } from "./datos-de-demostracion.js";
import type { LectorDeMarcas } from "./puentes.js";

export class CatalogoDeLaboratoriosPostgres implements horarios.CatalogoDeLaboratorios {
  readonly #unidad: UnidadDeTrabajoPostgres;

  constructor(unidad: UnidadDeTrabajoPostgres) {
    this.#unidad = unidad;
  }

  async todos(): Promise<horarios.Laboratorio[]> {
    return this.#unidad.ejecutor().selectFrom("laboratorios").selectAll().orderBy("nombre").execute();
  }

  async porId(idLaboratorio: string): Promise<horarios.Laboratorio | null> {
    return (await this.#unidad.ejecutor().selectFrom("laboratorios").selectAll().where("id", "=", idLaboratorio).executeTakeFirst()) ?? null;
  }
}

type AsistenteCompleto = horarios.AsistenteDelLaboratorio & liquidacion.DatosDeUnAsistente;

/** Asistentes con su tope vigente hoy (RF-07), disponibilidad y laboratorios. */
export class AsistentesPostgres implements horarios.ConsultaAsistentes, horarios.AsistentesDelLaboratorio {
  readonly #unidad: UnidadDeTrabajoPostgres;
  readonly #reloj: Reloj;

  constructor(unidad: UnidadDeTrabajoPostgres, reloj: Reloj) {
    this.#unidad = unidad;
    this.#reloj = reloj;
  }

  async obtener(idAsistente: string): Promise<AsistenteCompleto | null> {
    const [asistente] = await this.#cargar([idAsistente]);
    return asistente ?? null;
  }

  async activosDe(idLaboratorio: string): Promise<horarios.AsistenteDelLaboratorio[]> {
    const ids = await this.#unidad
      .ejecutor()
      .selectFrom("asistentes_laboratorios")
      .innerJoin("asistentes", "asistentes.id", "asistentes_laboratorios.id_asistente")
      .select("asistentes.id")
      .where("asistentes_laboratorios.id_laboratorio", "=", idLaboratorio)
      .where("asistentes.activo", "=", true)
      .execute();
    return this.#cargar(ids.map((f) => f.id));
  }

  paraLiquidacion(): liquidacion.DatosDeAsistentes {
    return {
      obtener: async (idAsistente) => {
        const asistente = await this.obtener(idAsistente);
        if (!asistente) throw new Error(`El asistente ${idAsistente} tiene turnos pero no está registrado.`);
        return asistente;
      }
    };
  }

  async #cargar(ids: string[]): Promise<AsistenteCompleto[]> {
    if (ids.length === 0) return [];
    const db = this.#unidad.ejecutor();
    const [asistentes, topes, bloques] = await Promise.all([
      db.selectFrom("asistentes").selectAll().where("id", "in", ids).execute(),
      db.selectFrom("topes_asistentes").selectAll().where("id_asistente", "in", ids).orderBy("vigente_desde").execute(),
      db.selectFrom("disponibilidad_asistentes").selectAll().where("id_asistente", "in", ids).orderBy("dia").orderBy("hora_inicio").execute()
    ]);
    const hoy = this.#reloj.ahora().fecha.aTexto();
    return asistentes.map((a) => {
      const suyos = topes.filter((t) => t.id_asistente === a.id);
      const vigente = suyos.filter((t) => t.vigente_desde <= hoy).at(-1) ?? suyos[0];
      return {
        id: a.id,
        nombre: a.nombre,
        carne: a.carne,
        categoria: a.categoria,
        activo: a.activo,
        topeSemanalMinutos: vigente?.minutos_por_semana ?? 0,
        topes: suyos.map((t) => ({ minutosPorSemana: t.minutos_por_semana, vigenteDesde: Fecha.desdeTexto(t.vigente_desde) })),
        disponibilidad: bloques
          .filter((b) => b.id_asistente === a.id)
          .map((b) => ({ dia: b.dia, horaInicio: horaDe(b.hora_inicio), horaFin: horaDe(b.hora_fin) }))
      };
    });
  }
}

/** El semestre que contiene la fecha de hoy, o null si hoy no hay semestre (ext 3b de CU-06). */
export class CalendarioPostgres implements horarios.CalendarioAcademico {
  readonly #unidad: UnidadDeTrabajoPostgres;
  readonly #reloj: Reloj;

  constructor(unidad: UnidadDeTrabajoPostgres, reloj: Reloj) {
    this.#unidad = unidad;
    this.#reloj = reloj;
  }

  async semestreVigente(): Promise<{ inicio: Fecha; fin: Fecha } | null> {
    const hoy = this.#reloj.ahora().fecha.aTexto();
    const fila = await this.#unidad.ejecutor().selectFrom("semestres").selectAll().where("inicio", "<=", hoy).where("fin", ">=", hoy).executeTakeFirst();
    return fila ? { inicio: Fecha.desdeTexto(fila.inicio), fin: Fecha.desdeTexto(fila.fin) } : null;
  }
}

/** Marcas de entrada y salida (tabla del módulo asistencia, que en el núcleo solo se lee). */
export class LectorDeMarcasPostgres implements LectorDeMarcas {
  readonly #unidad: UnidadDeTrabajoPostgres;

  constructor(unidad: UnidadDeTrabajoPostgres) {
    this.#unidad = unidad;
  }

  async de(idsTurnos: readonly string[]): Promise<ReadonlyMap<string, Marcas>> {
    if (idsTurnos.length === 0) return new Map();
    const filas = await this.#unidad.ejecutor().selectFrom("marcas").selectAll().where("id_turno", "in", [...idsTurnos]).execute();
    return new Map(filas.map((f) => [f.id_turno, { entrada: instanteDe(f.entrada), salida: f.salida ? instanteDe(f.salida) : null }]));
  }
}
