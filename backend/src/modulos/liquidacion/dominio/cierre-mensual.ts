import { DatoInvalido, Dinero, type Instante } from "../../../compartido/dominio/index.js";
import type { LineaDeLiquidacion } from "./linea-de-liquidacion.js";
import type { MesDeLiquidacion } from "./mes-de-liquidacion.js";
import type { VigenciaDeTarifas } from "./tarifas-del-periodo.js";

/** Archivo para Becas/Planilla (CU-14 P6). Lo produce el adaptador GeneradorArchivoBecas. */
export interface Archivo {
  nombre: string;
  tipo: "text/csv";
  contenido: string;
}

export interface DatosCierreMensual {
  mes: MesDeLiquidacion;
  lineas: readonly LineaDeLiquidacion[];
  tarifasAplicadas: readonly VigenciaDeTarifas[];
  fechaDeCierre: Instante;
  archivo: Archivo | null;
}

/**
 * Cierre de un mes (CU-14). Inmutable: un cierre CERRADO nunca cambia (RN-25, I2); adjuntar el
 * archivo devuelve un cierre nuevo y solo se puede hacer una vez.
 * Invariantes: se cierra después de terminado el mes; a lo sumo una línea por asistente;
 * el total es la suma de los montos de las líneas (I3).
 */
export class CierreMensual {
  readonly #datos: DatosCierreMensual;

  private constructor(datos: DatosCierreMensual) {
    this.#datos = { ...datos, lineas: [...datos.lineas], tarifasAplicadas: [...datos.tarifasAplicadas] };
  }

  /** CU-14 paso 6: P1, P2, P3, P5 y P7. */
  static cerrar(datos: Omit<DatosCierreMensual, "archivo">): CierreMensual {
    return CierreMensual.reconstituir({ ...datos, archivo: null });
  }

  static reconstituir(datos: DatosCierreMensual): CierreMensual {
    if (!datos.mes.terminoAntesDe(datos.fechaDeCierre)) {
      throw new DatoInvalido("fechaDeCierre", datos.fechaDeCierre.aISO(), "Un mes solo se cierra después de terminado.");
    }
    const ids = datos.lineas.map((l) => l.idAsistente);
    if (new Set(ids).size !== ids.length) {
      throw new DatoInvalido("lineas", ids, "Un cierre tiene a lo sumo una línea por asistente.");
    }
    return new CierreMensual(datos);
  }

  get id(): string {
    return `cierre-${this.#datos.mes.clave}`;
  }

  get mes(): MesDeLiquidacion {
    return this.#datos.mes;
  }

  get estado(): "CERRADO" {
    return "CERRADO";
  }

  get fechaDeCierre(): Instante {
    return this.#datos.fechaDeCierre;
  }

  get lineas(): readonly LineaDeLiquidacion[] {
    return [...this.#datos.lineas];
  }

  get tarifasAplicadas(): readonly VigenciaDeTarifas[] {
    return [...this.#datos.tarifasAplicadas];
  }

  get archivo(): Archivo | null {
    return this.#datos.archivo;
  }

  /** I3: el total es siempre la suma de las líneas. */
  get total(): Dinero {
    return Dinero.sumarTodos(this.#datos.lineas.map((l) => l.monto));
  }

  lineasConHorasSobreElTope(): LineaDeLiquidacion[] {
    return this.#datos.lineas.filter((l) => l.tieneHorasSobreElTope());
  }

  /** CU-14 paso 7, P6: devuelve el mismo cierre con su archivo. */
  adjuntarArchivo(archivo: Archivo): CierreMensual {
    if (this.#datos.archivo) {
      throw new DatoInvalido("archivo", archivo.nombre, "El cierre ya tiene su archivo; un cierre no cambia.");
    }
    if (!archivo.nombre.trim() || !archivo.contenido.trim()) {
      throw new DatoInvalido("archivo", archivo.nombre, "El archivo necesita nombre y contenido.");
    }
    return new CierreMensual({ ...this.#datos, archivo });
  }
}
