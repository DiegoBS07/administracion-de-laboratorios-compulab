import type { Selectable } from "kysely";
import { Franja, type Semana } from "../../../compartido/dominio/index.js";
import { fechaDe, instanteDe, restriccionViolada, type UnidadDeTrabajoPostgres } from "../../../compartido/infraestructura/postgres/conexion.js";
import type { TablaReservas } from "../../../compartido/infraestructura/postgres/esquema.js";
import { ClaveDeSolicitudReutilizada } from "../aplicacion/errores.js";
import type { RepositorioMaquinas, RepositorioReservas } from "../aplicacion/puertos.js";
import { MaquinaNoDisponible, YaTieneReservaActiva } from "../dominio/errores.js";
import type { EstadoReserva } from "../dominio/estado-reserva.js";
import { Maquina } from "../dominio/maquina.js";
import { Reserva } from "../dominio/reserva.js";

const ACTIVAS = ["ACTIVA", "EN_USO"];

function aReserva(fila: Selectable<TablaReservas>): Reserva {
  return Reserva.reconstituir({
    id: fila.id,
    idEstudiante: fila.id_estudiante,
    idMaquina: fila.id_maquina,
    franja: Franja.de(instanteDe(fila.inicio), instanteDe(fila.fin)),
    estado: fila.estado as EstadoReserva,
    claveSolicitud: fila.clave_solicitud
  });
}

export class RepositorioMaquinasPostgres implements RepositorioMaquinas {
  readonly #unidad: UnidadDeTrabajoPostgres;

  constructor(unidad: UnidadDeTrabajoPostgres) {
    this.#unidad = unidad;
  }

  async porId(idMaquina: string): Promise<Maquina | null> {
    const fila = await this.#unidad.ejecutor().selectFrom("maquinas").selectAll().where("id", "=", idMaquina).executeTakeFirst();
    return fila ? aMaquina(fila) : null;
  }

  async delLaboratorio(idLaboratorio: string): Promise<Maquina[]> {
    const filas = await this.#unidad.ejecutor().selectFrom("maquinas").selectAll().where("id_laboratorio", "=", idLaboratorio).orderBy("codigo").execute();
    return filas.map(aMaquina);
  }
}

function aMaquina(fila: { id: string; id_laboratorio: string; codigo: string; en_servicio: boolean }): Maquina {
  return Maquina.reconstituir({ id: fila.id, idLaboratorio: fila.id_laboratorio, codigo: fila.codigo, enServicio: fila.en_servicio });
}

/**
 * RepositorioReservas sobre PostgreSQL (ADR-0009, ADR-0010): la exclusión por máquina, el índice de
 * una reserva activa por estudiante y la clave única de V4__reservas.sql se traducen a
 * MaquinaNoDisponible (ext 7a), YaTieneReservaActiva (ext 7c) y ClaveDeSolicitudReutilizada.
 */
export class RepositorioReservasPostgres implements RepositorioReservas {
  readonly #unidad: UnidadDeTrabajoPostgres;

  constructor(unidad: UnidadDeTrabajoPostgres) {
    this.#unidad = unidad;
  }

  async porClaveDeSolicitud(idEstudiante: string, claveSolicitud: string): Promise<Reserva | null> {
    const fila = await this.#consulta().where("id_estudiante", "=", idEstudiante).where("clave_solicitud", "=", claveSolicitud).executeTakeFirst();
    return fila ? aReserva(fila) : null;
  }

  async activaDelEstudiante(idEstudiante: string): Promise<Reserva | null> {
    const fila = await this.#consulta().where("id_estudiante", "=", idEstudiante).where("estado", "in", ACTIVAS).executeTakeFirst();
    return fila ? aReserva(fila) : null;
  }

  async delEstudianteEnSemana(idEstudiante: string, semana: Semana): Promise<Reserva[]> {
    const { inicio, fin } = semana.franja();
    const filas = await this.#consulta()
      .where("id_estudiante", "=", idEstudiante)
      .where("inicio", ">=", fechaDe(inicio))
      .where("inicio", "<", fechaDe(fin))
      .orderBy("inicio")
      .execute();
    return filas.map(aReserva);
  }

  async deMaquinaEntre(idMaquina: string, franja: Franja): Promise<Reserva[]> {
    const filas = await this.#consulta()
      .where("id_maquina", "=", idMaquina)
      .where("inicio", "<", fechaDe(franja.fin))
      .where("fin", ">", fechaDe(franja.inicio))
      .orderBy("inicio")
      .execute();
    return filas.map(aReserva);
  }

  async guardar(reserva: Reserva): Promise<void> {
    try {
      await this.#unidad.protegido((db) =>
        db
          .insertInto("reservas")
          .values({
            id: reserva.id,
            id_estudiante: reserva.idEstudiante,
            id_maquina: reserva.idMaquina,
            inicio: reserva.franja.inicio.aISO(),
            fin: reserva.franja.fin.aISO(),
            estado: reserva.estado,
            clave_solicitud: reserva.claveSolicitud
          })
          .execute()
      );
    } catch (error) {
      throw await this.#traducir(error, reserva);
    }
  }

  async #traducir(error: unknown, reserva: Reserva): Promise<unknown> {
    switch (restriccionViolada(error)?.restriccion) {
      case "reservas_sin_traslape_maquina": {
        const [otra] = (await this.deMaquinaEntre(reserva.idMaquina, reserva.franja)).filter((r) => r.estaActiva());
        const franja = (otra ?? reserva).franja;
        return new MaquinaNoDisponible(reserva.idMaquina, franja.inicio.aISO(), franja.fin.aISO());
      }
      case "reservas_una_activa_por_estudiante": {
        const otra = (await this.activaDelEstudiante(reserva.idEstudiante)) ?? reserva;
        return new YaTieneReservaActiva(otra.id, otra.franja.inicio.aISO(), otra.franja.fin.aISO());
      }
      case "reservas_clave_de_solicitud_unica":
        return new ClaveDeSolicitudReutilizada(reserva.claveSolicitud ?? "");
      default:
        return error;
    }
  }

  #consulta() {
    return this.#unidad.ejecutor().selectFrom("reservas").selectAll();
  }
}
