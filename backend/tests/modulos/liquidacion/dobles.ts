// Dobles de las interfaces requeridas del módulo liquidacion (docs/08-componentes.md, 8.6).
import { Fecha, Franja, Hora, Instante } from "../../../src/compartido/dominio/index.js";
import {
  type Archivo,
  type CierreMensual,
  type DatosDeAsistentes,
  type DatosDeUnAsistente,
  ErrorAlGenerarArchivo,
  type GeneradorArchivoBecas,
  type HorasTrabajadas,
  type RegistroDeTurnoTrabajado,
  type TablaTarifas,
  type VigenciaDeTarifas
} from "../../../src/modulos/liquidacion/index.js";

export { RepositorioCierresEnMemoria } from "../../../src/modulos/liquidacion/infraestructura/repositorio-cierres-en-memoria.js";

/** Devuelve los turnos que empiezan dentro del periodo pedido y recuerda qué periodo se pidió. */
export class HorasTrabajadasEnMemoria implements HorasTrabajadas {
  readonly periodosPedidos: Franja[] = [];
  readonly #registros: readonly RegistroDeTurnoTrabajado[];

  constructor(registros: readonly RegistroDeTurnoTrabajado[]) {
    this.#registros = registros;
  }

  async delPeriodo(periodo: Franja): Promise<RegistroDeTurnoTrabajado[]> {
    await Promise.resolve();
    this.periodosPedidos.push(periodo);
    return this.#registros.filter((r) => periodo.contiene(r.inicioProgramado));
  }
}

export class DatosDeAsistentesEnMemoria implements DatosDeAsistentes {
  readonly #datos: ReadonlyMap<string, DatosDeUnAsistente>;

  constructor(datos: Record<string, DatosDeUnAsistente>) {
    this.#datos = new Map(Object.entries(datos));
  }

  async obtener(idAsistente: string): Promise<DatosDeUnAsistente> {
    const datos = this.#datos.get(idAsistente);
    if (!datos) throw new Error(`Asistente desconocido en el doble: ${idAsistente}`);
    return datos;
  }
}

/** Devuelve las vigencias que tocan el periodo, como pide el contrato de TablaTarifas (8.6). */
export class TablaTarifasEnMemoria implements TablaTarifas {
  readonly #vigencias: readonly VigenciaDeTarifas[];

  constructor(vigencias: readonly VigenciaDeTarifas[]) {
    this.#vigencias = vigencias;
  }

  async vigenciasEntre(desde: Fecha, hasta: Fecha): Promise<VigenciaDeTarifas[]> {
    return this.#vigencias.filter((v) => !v.vigenteDesde.esPosteriorA(hasta) && (v.vigenteHasta === null || !v.vigenteHasta.esAnteriorA(desde)));
  }
}

/** Generador que siempre falla (ext 7a). */
export class GeneradorArchivoBecasQueFalla implements GeneradorArchivoBecas {
  generar(_cierre: CierreMensual): Archivo {
    throw new ErrorAlGenerarArchivo("Falla simulada del generador.");
  }
}

// ---- Ayudas para escribir los datos de prueba ----

const instante = (fecha: string, hora: string) => Instante.de(Fecha.desdeTexto(fecha), Hora.desdeTexto(hora));

/** Turno de un día con sus marcas: `entrada` y `salida` en "HH:MM", o null si no se marcó. */
export function turno(
  idTurno: string,
  idAsistente: string,
  fecha: string,
  inicio: string,
  fin: string,
  entrada: string | null = inicio,
  salida: string | null = fin
): RegistroDeTurnoTrabajado {
  return {
    idTurno,
    idAsistente,
    inicioProgramado: instante(fecha, inicio),
    finProgramado: instante(fecha, fin),
    entrada: entrada ? instante(fecha, entrada) : null,
    salida: salida ? instante(fecha, salida) : null,
    estado: entrada === null ? "NO_CUBIERTO" : salida === null ? "MARCA_INCOMPLETA" : "COMPLETADO"
  };
}
