import { DatoInvalido, type DiaDeLaSemana, Franja, Hora } from "../../../compartido/dominio/index.js";

export interface BloqueDeclarado {
  /** 1 = lunes … 7 = domingo. */
  dia: number;
  horaInicio: string;
  horaFin: string;
}

interface Bloque {
  dia: DiaDeLaSemana;
  inicio: Hora;
  fin: Hora;
}

/**
 * Bloques semanales en que el asistente declaró que puede trabajar (RN-08).
 * Invariantes: cada bloque tiene un día de la semana válido y su inicio es anterior a su fin.
 * Los bloques contiguos del mismo día se consideran uno solo, igual que los turnos para la
 * cobertura (RN-15): declarar 07:00–10:00 y 10:00–13:00 equivale a 07:00–13:00.
 */
export class Disponibilidad {
  readonly #bloques: readonly Bloque[];

  private constructor(bloques: readonly Bloque[]) {
    this.#bloques = bloques;
  }

  static de(declarados: readonly BloqueDeclarado[]): Disponibilidad {
    const bloques = declarados.map((b) => {
      if (!Number.isInteger(b.dia) || b.dia < 1 || b.dia > 7) {
        throw new DatoInvalido("disponibilidad.dia", b.dia, "El día de la semana debe ir de 1 (lunes) a 7 (domingo).");
      }
      const inicio = Hora.desdeTexto(b.horaInicio);
      const fin = Hora.desdeTexto(b.horaFin);
      if (!inicio.esAnteriorA(fin)) {
        throw new DatoInvalido("disponibilidad", `${b.horaInicio}-${b.horaFin}`, "Un bloque de disponibilidad debe terminar después de empezar.");
      }
      return { dia: b.dia as DiaDeLaSemana, inicio, fin };
    });
    return new Disponibilidad(bloques);
  }

  /** Verdadero si la franja queda completamente dentro de la disponibilidad de ese día de la semana. */
  cubre(franja: Franja): boolean {
    const fecha = franja.inicio.fecha;
    const delDia = this.#bloques
      .filter((b) => b.dia === fecha.diaDeLaSemana)
      .map((b) => Franja.delDia(fecha, b.inicio, b.fin));
    return franja.estaCubiertaPor(delDia);
  }
}
