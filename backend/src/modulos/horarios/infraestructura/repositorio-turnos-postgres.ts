import type { Selectable } from "kysely";
import { Franja } from "../../../compartido/dominio/index.js";
import { fechaDe, instanteDe, restriccionViolada, type UnidadDeTrabajoPostgres } from "../../../compartido/infraestructura/postgres/conexion.js";
import type { TablaTurnos } from "../../../compartido/infraestructura/postgres/esquema.js";
import { ClaveDeSolicitudReutilizada } from "../aplicacion/errores.js";
import type { RepositorioTurnos } from "../aplicacion/puertos.js";
import { FranjaOcupadaEnLaboratorio, resumenDeConflicto, TraslapeDeTurno } from "../dominio/errores.js";
import type { EstadoTurno } from "../dominio/estado-turno.js";
import { Turno } from "../dominio/turno.js";

function aTurno(fila: Selectable<TablaTurnos>): Turno {
  return Turno.reconstituir({
    id: fila.id,
    idLaboratorio: fila.id_laboratorio,
    idAsistente: fila.id_asistente,
    franja: Franja.de(instanteDe(fila.inicio), instanteDe(fila.fin)),
    estado: fila.estado as EstadoTurno,
    creadoPor: fila.creado_por,
    claveSolicitud: fila.clave_solicitud
  });
}

/**
 * RepositorioTurnos sobre PostgreSQL (ADR-0009): bloquearAgendaDe toma la fila del asistente con
 * FOR UPDATE y las restricciones EXCLUDE de V3__turnos.sql son la segunda barrera; si saltan, se
 * traducen a TraslapeDeTurno o FranjaOcupadaEnLaboratorio con el turno en conflicto.
 */
export class RepositorioTurnosPostgres implements RepositorioTurnos {
  readonly #unidad: UnidadDeTrabajoPostgres;

  constructor(unidad: UnidadDeTrabajoPostgres) {
    this.#unidad = unidad;
  }

  async porClaveDeSolicitud(idUsuario: string, claveSolicitud: string): Promise<Turno | null> {
    const fila = await this.#unidad
      .ejecutor()
      .selectFrom("turnos")
      .selectAll()
      .where("creado_por", "=", idUsuario)
      .where("clave_solicitud", "=", claveSolicitud)
      .executeTakeFirst();
    return fila ? aTurno(fila) : null;
  }

  async bloquearAgendaDe(idAsistente: string): Promise<void> {
    await this.#unidad.transaccion().selectFrom("asistentes").select("id").where("id", "=", idAsistente).forUpdate().execute();
  }

  async delAsistenteEntre(idAsistente: string, franja: Franja): Promise<Turno[]> {
    return this.#entre(franja, { columna: "id_asistente", valor: idAsistente });
  }

  async delLaboratorioEntre(idLaboratorio: string, franja: Franja): Promise<Turno[]> {
    return this.#entre(franja, { columna: "id_laboratorio", valor: idLaboratorio });
  }

  async delPeriodo(franja: Franja): Promise<Turno[]> {
    return this.#entre(franja);
  }

  async guardar(turno: Turno): Promise<void> {
    try {
      await this.#unidad.protegido((db) =>
        db
          .insertInto("turnos")
          .values({
            id: turno.id,
            id_laboratorio: turno.idLaboratorio,
            id_asistente: turno.idAsistente,
            inicio: turno.franja.inicio.aISO(),
            fin: turno.franja.fin.aISO(),
            estado: turno.estado,
            creado_por: turno.creadoPor,
            clave_solicitud: turno.claveSolicitud
          })
          .execute()
      );
    } catch (error) {
      throw await this.#traducir(error, turno);
    }
  }

  async #traducir(error: unknown, turno: Turno): Promise<unknown> {
    const violada = restriccionViolada(error);
    if (violada?.restriccion === "turnos_clave_de_solicitud_unica") {
      return new ClaveDeSolicitudReutilizada(turno.claveSolicitud ?? "");
    }
    if (violada?.restriccion === "turnos_sin_traslape_asistente" && turno.idAsistente) {
      const [otro] = (await this.delAsistenteEntre(turno.idAsistente, turno.franja)).filter((t) => t.ocupaLaFranja());
      return new TraslapeDeTurno(resumenDeConflicto(otro ?? turno));
    }
    if (violada?.restriccion === "turnos_sin_traslape_laboratorio") {
      const [otro] = (await this.delLaboratorioEntre(turno.idLaboratorio, turno.franja)).filter((t) => t.ocupaLaFranja());
      return new FranjaOcupadaEnLaboratorio(resumenDeConflicto(otro ?? turno));
    }
    return error;
  }

  async #entre(franja: Franja, filtro?: { columna: "id_asistente" | "id_laboratorio"; valor: string }): Promise<Turno[]> {
    let consulta = this.#unidad.ejecutor().selectFrom("turnos").selectAll();
    if (filtro) consulta = consulta.where(filtro.columna, "=", filtro.valor);
    const filas = await consulta.where("inicio", "<", fechaDe(franja.fin)).where("fin", ">", fechaDe(franja.inicio)).orderBy("inicio").execute();
    return filas.map(aTurno);
  }
}
