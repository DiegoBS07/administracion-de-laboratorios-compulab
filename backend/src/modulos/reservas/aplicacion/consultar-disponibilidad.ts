import { Fecha, Franja, Hora } from "../../../compartido/dominio/index.js";
import { AgendaDeLaMaquina } from "../dominio/agenda-de-la-maquina.js";
import type { CoberturaDeLaboratorio, RepositorioMaquinas, RepositorioReservas } from "./puertos.js";

/** Respuesta de GET /api/v1/laboratorios/{id}/disponibilidad (docs/08-componentes.md, 8.7). */
export interface DisponibilidadDTO {
  idLaboratorio: string;
  fecha: string;
  franjasAbiertas: { inicio: string; fin: string }[];
  maquinas: {
    id: string;
    codigo: string;
    estado: "EN_SERVICIO" | "FUERA_DE_SERVICIO";
    reservas: { inicio: string; fin: string }[];
  }[];
}

export interface DependenciasConsultarDisponibilidad {
  maquinas: RepositorioMaquinas;
  reservas: RepositorioReservas;
  cobertura: CoberturaDeLaboratorio;
}

/**
 * RF-22 · Consultar las franjas en que un laboratorio estará abierto y el estado de sus máquinas
 * (CU-11 pasos 1 y 2). Es una consulta: no cambia nada. Un día sin franjas abiertas devuelve la
 * lista vacía para que la interfaz lo informe (CU-11 ext 2a).
 */
export class ConsultarDisponibilidad {
  readonly #d: DependenciasConsultarDisponibilidad;

  constructor(dependencias: DependenciasConsultarDisponibilidad) {
    this.#d = dependencias;
  }

  async ejecutar(idLaboratorio: string, fechaTexto: string): Promise<DisponibilidadDTO> {
    const fecha = Fecha.desdeTexto(fechaTexto);
    const dia = Franja.delDia(fecha, Hora.medianoche(), Hora.deMinutos(Hora.MINUTOS_DEL_DIA));
    const abiertas = await this.#d.cobertura.franjasAbiertas(idLaboratorio, dia);
    const maquinas = await this.#d.maquinas.delLaboratorio(idLaboratorio);

    const detalle = await Promise.all(
      maquinas.map(async (maquina) => {
        const agenda = AgendaDeLaMaquina.de(maquina.id, await this.#d.reservas.deMaquinaEntre(maquina.id, dia));
        return {
          id: maquina.id,
          codigo: maquina.codigo,
          estado: maquina.enServicio ? ("EN_SERVICIO" as const) : ("FUERA_DE_SERVICIO" as const),
          reservas: agenda.franjasOcupadas().map((f) => ({ inicio: f.inicio.aISO(), fin: f.fin.aISO() }))
        };
      })
    );

    return {
      idLaboratorio,
      fecha: fecha.aTexto(),
      franjasAbiertas: abiertas.map((f) => ({ inicio: f.inicio.aISO(), fin: f.fin.aISO() })),
      maquinas: detalle.sort((a, b) => a.codigo.localeCompare(b.codigo))
    };
  }
}
