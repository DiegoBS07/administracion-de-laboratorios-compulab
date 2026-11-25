// Interfaces requeridas del módulo liquidacion (docs/08-componentes.md, 8.6), en el idioma de este módulo.
import type { Fecha, Franja, Instante } from "../../../compartido/dominio/index.js";
import type { Archivo, CierreMensual } from "../dominio/cierre-mensual.js";
import type { TopeVigente } from "../dominio/liquidacion-del-asistente.js";
import type { MesDeLiquidacion } from "../dominio/mes-de-liquidacion.js";
import type { VigenciaDeTarifas } from "../dominio/tarifas-del-periodo.js";

export interface RepositorioCierres {
  porMes(mes: MesDeLiquidacion): Promise<CierreMensual | null>;
  /**
   * Todo o nada: el cierre con sus líneas, tarifas aplicadas y archivo (garantía mínima de CU-14).
   * Si ya hay un cierre de ese mes (UNIQUE (anio, mes), ext 2c) lanza CierreYaExiste.
   */
  guardar(cierre: CierreMensual): Promise<void>;
}

/** Un turno del periodo con sus marcas, tal como lo entrega el módulo asistencia. */
export interface RegistroDeTurnoTrabajado {
  idTurno: string;
  idAsistente: string;
  inicioProgramado: Instante;
  finProgramado: Instante;
  entrada: Instante | null;
  salida: Instante | null;
  /** Estado del turno (COMPLETADO, NO_CUBIERTO…); el cálculo se basa en las marcas. */
  estado: string;
}

export interface HorasTrabajadas {
  /** Turnos programados dentro del periodo, que empieza el lunes de la primera semana del mes (SUP-05). */
  delPeriodo(periodo: Franja): Promise<RegistroDeTurnoTrabajado[]>;
}

export interface DatosDeUnAsistente {
  carne: string;
  nombre: string;
  categoria: string;
  topes: TopeVigente[];
}

export interface DatosDeAsistentes {
  obtener(idAsistente: string): Promise<DatosDeUnAsistente>;
}

export interface TablaTarifas {
  /** Vigencias que tocan el periodo, ordenadas y sin traslapes; lista vacía si no hay (contrato en 8.6). */
  vigenciasEntre(desde: Fecha, hasta: Fecha): Promise<VigenciaDeTarifas[]>;
}

export interface GeneradorArchivoBecas {
  /** Capa anticorrupción con el formato de Becas (SUP-03). Lanza ErrorAlGenerarArchivo. */
  generar(cierre: CierreMensual): Archivo;
}

/** Destinatario de los avisos del cierre (P8, ext 5b). */
export const COORDINACION_DE_SOPORTE = "COORDINACION_DE_SOPORTE";

export type TipoDeAviso = "CIERRE_LISTO" | "TARIFA_FALTANTE";

export interface Notificador {
  avisar(destinatario: string, tipo: TipoDeAviso, datos: Record<string, string>): Promise<void>;
}
