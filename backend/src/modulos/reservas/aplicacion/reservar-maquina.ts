import { DatoInvalido, Franja, FranjaInvalida, Hora, Instante, type Reloj, Semana } from "../../../compartido/dominio/index.js";
import { AgendaDeLaMaquina } from "../dominio/agenda-de-la-maquina.js";
import { CupoSemanalDelEstudiante } from "../dominio/cupo-semanal-del-estudiante.js";
import type { EstadoReserva } from "../dominio/estado-reserva.js";
import { FranjaDeReservaInvalida, LaboratorioCerradoEnFranja } from "../dominio/errores.js";
import { Reserva } from "../dominio/reserva.js";
import { ClaveDeSolicitudReutilizada, MaquinaNoExiste } from "./errores.js";
import type {
  CoberturaDeLaboratorio,
  GeneradorDeIds,
  RepositorioMaquinas,
  RepositorioReservas,
  UnidadDeTrabajo,
  UsuarioActual
} from "./puertos.js";

/** Lo que manda la interfaz (cuerpo de POST /api/v1/reservas + Idempotency-Key). */
export interface SolicitudReserva {
  idMaquina: string;
  /** Instantes ISO-8601 con zona, por ejemplo "2026-11-24T14:00:00-06:00". */
  inicio: string;
  fin: string;
  claveSolicitud: string;
}

/** Respuesta de la API para CU-11 (docs/08-componentes.md, 8.7). */
export interface ReservaDTO {
  id: string;
  idMaquina: string;
  inicio: string;
  fin: string;
  estado: EstadoReserva;
  limitePresentacion: string;
}

export interface ResultadoReservarMaquina {
  /** false cuando es un reenvío con la misma clave (la API responde 200 en lugar de 201). */
  creada: boolean;
  reserva: ReservaDTO;
}

export interface DependenciasReservarMaquina {
  maquinas: RepositorioMaquinas;
  reservas: RepositorioReservas;
  cobertura: CoberturaDeLaboratorio;
  unidadDeTrabajo: UnidadDeTrabajo;
  reloj: Reloj;
  ids: GeneradorDeIds;
}

/**
 * CU-11 · Reservar una máquina (docs/04-casos-de-uso.md, 4.3; realización en 10.3).
 * Controlador del caso de uso: coordina; las reglas viven en el dominio.
 */
export class ReservarMaquina {
  readonly #d: DependenciasReservarMaquina;

  constructor(dependencias: DependenciasReservarMaquina) {
    this.#d = dependencias;
  }

  async ejecutar(usuario: UsuarioActual, solicitud: SolicitudReserva): Promise<ResultadoReservarMaquina> {
    // paso 3 · el estudiante elige máquina y franja
    const inicio = Instante.desdeISO(solicitud.inicio);
    const fin = Instante.desdeISO(solicitud.fin);
    if (!solicitud.claveSolicitud?.trim()) {
      throw new DatoInvalido("claveSolicitud", solicitud.claveSolicitud, "Falta la clave de solicitud (Idempotency-Key).");
    }

    return this.#d.unidadDeTrabajo.ejecutar(async () => {
      // ext 7b · reenvío con la misma clave (ADR-0010)
      const previa = await this.#d.reservas.porClaveDeSolicitud(usuario.id, solicitud.claveSolicitud);
      if (previa) {
        const misma = previa.idMaquina === solicitud.idMaquina && previa.franja.inicio.esIgualA(inicio) && previa.franja.fin.esIgualA(fin);
        if (!misma) throw new ClaveDeSolicitudReutilizada(solicitud.claveSolicitud);
        return { creada: false, reserva: aDTO(previa) };
      }

      // paso 4 · franja válida (4a), dentro del horizonte (4b), 2 h como máximo (4c)
      const franja = franjaDeReserva(inicio, fin);
      const reserva = Reserva.crear({
        id: this.#d.ids.nuevo(),
        idEstudiante: usuario.id,
        idMaquina: solicitud.idMaquina,
        franja,
        claveSolicitud: solicitud.claveSolicitud,
        ahora: this.#d.reloj.ahora()
      });
      const maquina = await this.#d.maquinas.porId(solicitud.idMaquina);
      if (!maquina) {
        throw new MaquinaNoExiste(solicitud.idMaquina);
      }
      // ext 4d · el laboratorio abierto durante toda la franja (RN-15)
      const abiertas = await this.#d.cobertura.franjasAbiertas(maquina.idLaboratorio, diaDe(franja));
      if (!franja.estaCubiertaPor(abiertas)) {
        throw new LaboratorioCerradoEnFranja(
          maquina.idLaboratorio,
          abiertas.map((f) => ({ inicio: f.inicio.aISO(), fin: f.fin.aISO() }))
        );
      }

      // paso 5 · máquina en servicio (5a) y libre (5b)
      maquina.verificarReservable();
      AgendaDeLaMaquina.de(maquina.id, await this.#d.reservas.deMaquinaEntre(maquina.id, franja)).verificarLibre(franja);

      // paso 6 · una reserva activa (6a) y 6 h por semana (6b)
      const semana = Semana.deLaFecha(franja.inicio.fecha);
      CupoSemanalDelEstudiante.de({
        idEstudiante: usuario.id,
        semana,
        reservasDeLaSemana: await this.#d.reservas.delEstudianteEnSemana(usuario.id, semana),
        reservaActiva: await this.#d.reservas.activaDelEstudiante(usuario.id)
      }).verificarQueAdmite(reserva);

      // paso 7 · se registra (las restricciones de la base cubren 7a y 7c)
      await this.#d.reservas.guardar(reserva);

      // paso 8 · la reserva con su hora límite de presentación
      return { creada: true, reserva: aDTO(reserva) };
    });
  }
}

function franjaDeReserva(inicio: Instante, fin: Instante): Franja {
  try {
    return Franja.de(inicio, fin);
  } catch (error) {
    if (error instanceof FranjaInvalida) {
      throw new FranjaDeReservaInvalida(inicio.aISO(), fin.aISO(), "FIN_NO_POSTERIOR");
    }
    throw error;
  }
}

/** El día completo en que empieza la franja (para pedir la cobertura de ese día). */
export function diaDe(franja: Franja): Franja {
  const fecha = franja.inicio.fecha;
  return Franja.delDia(fecha, Hora.medianoche(), Hora.deMinutos(Hora.MINUTOS_DEL_DIA));
}

function aDTO(reserva: Reserva): ReservaDTO {
  return {
    id: reserva.id,
    idMaquina: reserva.idMaquina,
    inicio: reserva.franja.inicio.aISO(),
    fin: reserva.franja.fin.aISO(),
    estado: reserva.estado,
    limitePresentacion: reserva.limitePresentacion.aISO()
  };
}
