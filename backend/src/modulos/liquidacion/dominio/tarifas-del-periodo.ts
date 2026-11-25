import { DatoInvalido, type Dinero, type Fecha } from "../../../compartido/dominio/index.js";
import { TarifaNoDefinida } from "./errores.js";

/** Tarifas por categoría y porcentaje de recargo vigentes entre dos fechas (ADR-0005). */
export interface VigenciaDeTarifas {
  vigenteDesde: Fecha;
  /** Inclusive; null = sigue vigente. */
  vigenteHasta: Fecha | null;
  tarifaPorHora: Readonly<Record<string, Dinero>>;
  /** Porcentaje entero, por ejemplo 25 para un recargo del 25 %. */
  porcentajeRecargo: number;
}

/**
 * Las vigencias de tarifas que tocan un periodo. Elige el valor vigente en la fecha de cada turno
 * (RN-22, RN-23, SUP-17).
 * Invariantes: cada vigencia empieza antes de terminar, tiene al menos una tarifa y un recargo
 * entero no negativo; las vigencias no se traslapan.
 */
export class TarifasDelPeriodo {
  readonly #vigencias: readonly VigenciaDeTarifas[];

  private constructor(vigencias: readonly VigenciaDeTarifas[]) {
    this.#vigencias = vigencias;
  }

  static de(vigencias: readonly VigenciaDeTarifas[]): TarifasDelPeriodo {
    const ordenadas = [...vigencias].sort((a, b) => a.vigenteDesde.comparar(b.vigenteDesde));
    ordenadas.forEach((v, i) => {
      if (v.vigenteHasta && v.vigenteHasta.esAnteriorA(v.vigenteDesde)) {
        throw new DatoInvalido("vigenteHasta", v.vigenteHasta.aTexto(), "Una vigencia no puede terminar antes de empezar.");
      }
      if (Object.keys(v.tarifaPorHora).length === 0) {
        throw new DatoInvalido("tarifaPorHora", v.vigenteDesde.aTexto(), "Una vigencia debe tener al menos una tarifa por categoría.");
      }
      if (!Number.isInteger(v.porcentajeRecargo) || v.porcentajeRecargo < 0) {
        throw new DatoInvalido("porcentajeRecargo", v.porcentajeRecargo, "El recargo debe ser un porcentaje entero no negativo.");
      }
      const siguiente = ordenadas[i + 1];
      if (siguiente && (!v.vigenteHasta || !v.vigenteHasta.esAnteriorA(siguiente.vigenteDesde))) {
        throw new DatoInvalido("vigencias", siguiente.vigenteDesde.aTexto(), "Las vigencias de tarifas no pueden traslaparse.");
      }
    });
    return new TarifasDelPeriodo(ordenadas);
  }

  get vigencias(): readonly VigenciaDeTarifas[] {
    return this.#vigencias;
  }

  vigenteEn(fecha: Fecha): VigenciaDeTarifas {
    const vigencia = this.#vigencias.find(
      (v) => !fecha.esAnteriorA(v.vigenteDesde) && (v.vigenteHasta === null || !fecha.esPosteriorA(v.vigenteHasta))
    );
    if (!vigencia) {
      throw new TarifaNoDefinida(fecha.aTexto(), null);
    }
    return vigencia;
  }

  /** CU-14 ext 5b: cada día del periodo debe tener una vigencia; si no, TarifaNoDefinida. */
  exigirCobertura(desde: Fecha, hasta: Fecha): void {
    for (let fecha = desde; !fecha.esPosteriorA(hasta); fecha = fecha.sumarDias(1)) {
      this.vigenteEn(fecha);
    }
  }

  tarifaPorHora(categoria: string, fecha: Fecha): Dinero {
    const tarifa = this.vigenteEn(fecha).tarifaPorHora[categoria];
    if (!tarifa) {
      throw new TarifaNoDefinida(fecha.aTexto(), categoria);
    }
    return tarifa;
  }

  porcentajeRecargo(fecha: Fecha): number {
    return this.vigenteEn(fecha).porcentajeRecargo;
  }
}
