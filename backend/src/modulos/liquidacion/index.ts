// Interfaz provista del módulo liquidacion (docs/08-componentes.md, 8.6).
// Es lo único que src/arranque/ usa de este módulo; los demás módulos nunca lo importan (FA-2).
export { CerrarMes, type DependenciasCerrarMes, type ResultadoCerrarMes } from "./aplicacion/cerrar-mes.js";
export { ConsultarCierre, ObtenerArchivoBecas } from "./aplicacion/consultar-cierre.js";
export type { ArchivoDTO, ResumenDeCierreDTO } from "./aplicacion/resumen-de-cierre.js";
export {
  COORDINACION_DE_SOPORTE,
  type DatosDeAsistentes,
  type DatosDeUnAsistente,
  type GeneradorArchivoBecas,
  type HorasTrabajadas,
  type Notificador,
  type RegistroDeTurnoTrabajado,
  type RepositorioCierres,
  type TablaTarifas,
  type TipoDeAviso
} from "./aplicacion/puertos.js";
export { CierreNoExiste, CierreYaExiste } from "./aplicacion/errores.js";
export { ErrorAlGenerarArchivo, MesNoTerminado, TarifaNoDefinida } from "./dominio/errores.js";
export { type Archivo, CierreMensual } from "./dominio/cierre-mensual.js";
export { LineaDeLiquidacion, type HorasNoPagadas, type MotivoNoPagado } from "./dominio/linea-de-liquidacion.js";
export { MesDeLiquidacion } from "./dominio/mes-de-liquidacion.js";
export type { VigenciaDeTarifas } from "./dominio/tarifas-del-periodo.js";
export type { TopeVigente } from "./dominio/liquidacion-del-asistente.js";
export { GeneradorArchivoBecasCsv, ENCABEZADO_BECAS } from "./infraestructura/generador-archivo-becas-csv.js";
