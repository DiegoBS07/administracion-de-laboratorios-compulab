import { DatoInvalido, type Dinero } from "../../../compartido/dominio/index.js";

export type MotivoNoPagado = "SOBRE_TOPE" | "MARCA_INCOMPLETA";

export interface HorasNoPagadas {
  /** Lunes de la semana, "AAAA-MM-DD". */
  semana: string;
  motivo: MotivoNoPagado;
  minutos: number;
}

export interface DatosLineaDeLiquidacion {
  idAsistente: string;
  carne: string;
  nombre: string;
  categoria: string;
  minutosNormales: number;
  minutosConRecargo: number;
  noPagados: readonly HorasNoPagadas[];
  monto: Dinero;
}

/**
 * Lo que se le paga a un asistente por un mes (CU-14 P3, P4). Inmutable.
 * Invariantes: datos del asistente no vacíos; minutos enteros no negativos; cada grupo de horas
 * no pagadas tiene más de cero minutos; la línea tiene al menos un minuto (SUP-26).
 */
export class LineaDeLiquidacion {
  readonly #datos: DatosLineaDeLiquidacion;

  private constructor(datos: DatosLineaDeLiquidacion) {
    this.#datos = { ...datos, noPagados: datos.noPagados.map((n) => ({ ...n })) };
  }

  static de(datos: DatosLineaDeLiquidacion): LineaDeLiquidacion {
    for (const campo of ["idAsistente", "carne", "nombre", "categoria"] as const) {
      if (!datos[campo]?.trim()) {
        throw new DatoInvalido(campo, datos[campo], `El campo ${campo} de la línea no puede venir vacío.`);
      }
    }
    for (const [campo, valor] of [["minutosNormales", datos.minutosNormales], ["minutosConRecargo", datos.minutosConRecargo]] as const) {
      if (!Number.isInteger(valor) || valor < 0) {
        throw new DatoInvalido(campo, valor, "Los minutos deben ser un entero no negativo.");
      }
    }
    if (datos.noPagados.some((n) => !Number.isInteger(n.minutos) || n.minutos <= 0)) {
      throw new DatoInvalido("noPagados", datos.noPagados, "Cada grupo de horas no pagadas debe tener minutos positivos.");
    }
    const total = datos.minutosNormales + datos.minutosConRecargo + datos.noPagados.reduce((s, n) => s + n.minutos, 0);
    if (total === 0) {
      throw new DatoInvalido("minutos", 0, "Una línea de liquidación tiene al menos un minuto trabajado (SUP-26).");
    }
    return new LineaDeLiquidacion(datos);
  }

  get idAsistente(): string {
    return this.#datos.idAsistente;
  }

  get carne(): string {
    return this.#datos.carne;
  }

  get nombre(): string {
    return this.#datos.nombre;
  }

  get categoria(): string {
    return this.#datos.categoria;
  }

  get minutosNormales(): number {
    return this.#datos.minutosNormales;
  }

  get minutosConRecargo(): number {
    return this.#datos.minutosConRecargo;
  }

  get minutosNoPagados(): number {
    return this.#datos.noPagados.reduce((total, n) => total + n.minutos, 0);
  }

  get noPagados(): readonly HorasNoPagadas[] {
    return this.#datos.noPagados.map((n) => ({ ...n }));
  }

  get monto(): Dinero {
    return this.#datos.monto;
  }

  tieneHorasSobreElTope(): boolean {
    return this.#datos.noPagados.some((n) => n.motivo === "SOBRE_TOPE");
  }
}
