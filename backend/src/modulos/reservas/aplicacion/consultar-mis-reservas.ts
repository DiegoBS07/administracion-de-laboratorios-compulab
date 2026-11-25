import { type Reloj, Semana } from "../../../compartido/dominio/index.js";
import { CupoSemanalDelEstudiante } from "../dominio/cupo-semanal-del-estudiante.js";
import type { EstadoReserva } from "../dominio/estado-reserva.js";
import { POLITICA_DE_RESERVAS } from "../dominio/politica-de-reservas.js";
import type { Reserva } from "../dominio/reserva.js";
import type { RepositorioMaquinas, RepositorioReservas, UsuarioActual } from "./puertos.js";

export interface ReservaDelEstudianteDTO {
  id: string;
  idMaquina: string;
  codigoMaquina: string;
  idLaboratorio: string;
  inicio: string;
  fin: string;
  estado: EstadoReserva;
  limitePresentacion: string;
}

/** Respuesta de GET /api/v1/reservas/mias. */
export interface MisReservasDTO {
  /** Lunes de la semana en curso. */
  semana: string;
  minutosReservadosSemana: number;
  limiteSemanalMinutos: number;
  activa: ReservaDelEstudianteDTO | null;
  deLaSemana: ReservaDelEstudianteDTO[];
}

/**
 * Apoyo a CU-11 (no es un RF propio) · La reserva activa del estudiante y lo que lleva reservado en la semana. La pantalla de
 * reservar la consulta antes de ofrecer máquinas para prevenir las extensiones 6a y 6b de CU-11
 * (docs/diseno-ux-ui.md, 15.6). Es una consulta: no cambia nada.
 */
export class ConsultarMisReservas {
  readonly #d: { reservas: RepositorioReservas; maquinas: RepositorioMaquinas; reloj: Reloj };

  constructor(dependencias: { reservas: RepositorioReservas; maquinas: RepositorioMaquinas; reloj: Reloj }) {
    this.#d = dependencias;
  }

  async ejecutar(usuario: UsuarioActual): Promise<MisReservasDTO> {
    const semana = Semana.deLaFecha(this.#d.reloj.ahora().fecha);
    const [deLaSemana, activa] = await Promise.all([
      this.#d.reservas.delEstudianteEnSemana(usuario.id, semana),
      this.#d.reservas.activaDelEstudiante(usuario.id)
    ]);
    const cupo = CupoSemanalDelEstudiante.de({ idEstudiante: usuario.id, semana, reservasDeLaSemana: deLaSemana, reservaActiva: activa });
    return {
      semana: semana.lunes.aTexto(),
      minutosReservadosSemana: cupo.minutosReservados,
      limiteSemanalMinutos: POLITICA_DE_RESERVAS.limiteSemanalMinutos,
      activa: activa ? await this.#aDTO(activa) : null,
      deLaSemana: await Promise.all(deLaSemana.sort((a, b) => a.franja.inicio.comparar(b.franja.inicio)).map((r) => this.#aDTO(r)))
    };
  }

  async #aDTO(reserva: Reserva): Promise<ReservaDelEstudianteDTO> {
    const maquina = await this.#d.maquinas.porId(reserva.idMaquina);
    return {
      id: reserva.id,
      idMaquina: reserva.idMaquina,
      codigoMaquina: maquina?.codigo ?? reserva.idMaquina,
      idLaboratorio: maquina?.idLaboratorio ?? "",
      inicio: reserva.franja.inicio.aISO(),
      fin: reserva.franja.fin.aISO(),
      estado: reserva.estado,
      limitePresentacion: reserva.limitePresentacion.aISO()
    };
  }
}
