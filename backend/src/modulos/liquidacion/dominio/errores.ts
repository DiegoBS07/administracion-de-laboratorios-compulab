import { ErrorDeDominio } from "../../../compartido/dominio/index.js";

/** CU-14 ext 2b · El mes todavía no terminó. */
export class MesNoTerminado extends ErrorDeDominio {
  constructor(mes: string, sePuedeCerrarDesde: string) {
    super("MES_NO_TERMINADO", "Este mes todavía no termina; se podrá cerrar el día 1 del mes siguiente.", { mes, sePuedeCerrarDesde });
  }
}

/** CU-14 ext 5b · No hay tarifa o recargo vigente para una fecha del mes (RN-22, RN-23). */
export class TarifaNoDefinida extends ErrorDeDominio {
  constructor(fecha: string, categoria: string | null) {
    super(
      "TARIFA_NO_DEFINIDA",
      categoria ? `Falta la tarifa de la categoría ${categoria} vigente el ${fecha}.` : `Falta la tarifa vigente el ${fecha}.`,
      { fecha, categoria }
    );
  }
}

/** CU-14 ext 7a · El archivo para Becas no se pudo generar. */
export class ErrorAlGenerarArchivo extends ErrorDeDominio {
  constructor(motivo: string) {
    super("ERROR_AL_GENERAR_ARCHIVO", "No se pudo generar el archivo para Becas.", { motivo });
  }
}
