import { ErrorDeDominio } from "../../../compartido/dominio/index.js";

/** Precondición de CU-11: no existe una máquina con ese identificador (404). */
export class MaquinaNoExiste extends ErrorDeDominio {
  constructor(idMaquina: string) {
    super("MAQUINA_NO_EXISTE", "No existe una máquina con ese identificador.", { idMaquina });
  }
}

/** RF-22: no existe un laboratorio con ese identificador (404). */
export class LaboratorioNoExiste extends ErrorDeDominio {
  constructor(idLaboratorio: string) {
    super("LABORATORIO_NO_EXISTE", "No existe un laboratorio con ese identificador.", { idLaboratorio });
  }
}

/** ADR-0010 · Se reutilizó una clave de solicitud con datos distintos (422). */
export class ClaveDeSolicitudReutilizada extends ErrorDeDominio {
  constructor(claveSolicitud: string) {
    super("CLAVE_DE_SOLICITUD_REUTILIZADA", "Esa clave de solicitud ya se usó con otros datos.", { claveSolicitud });
  }
}
