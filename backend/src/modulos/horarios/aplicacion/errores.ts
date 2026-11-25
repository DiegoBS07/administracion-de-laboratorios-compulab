import { ErrorDeDominio } from "../../../compartido/dominio/index.js";

/** CU-06 ext 2a · El usuario no coordina ese laboratorio ni es coordinador de soporte (403). */
export class SinPermisoSobreLaboratorio extends ErrorDeDominio {
  constructor(idUsuario: string, idLaboratorio: string) {
    super("SIN_PERMISO_SOBRE_LABORATORIO", "No tienes permiso para modificar el horario de ese laboratorio.", { idUsuario, idLaboratorio });
  }
}

/** Precondición de CU-06: no existe un asistente con ese identificador (404). */
export class AsistenteNoExiste extends ErrorDeDominio {
  constructor(idAsistente: string) {
    super("ASISTENTE_NO_EXISTE", "No existe un asistente con ese identificador.", { idAsistente });
  }
}

/** ADR-0010 · Se reutilizó una clave de solicitud con datos distintos (422). */
export class ClaveDeSolicitudReutilizada extends ErrorDeDominio {
  constructor(claveSolicitud: string) {
    super("CLAVE_DE_SOLICITUD_REUTILIZADA", "Esa clave de solicitud ya se usó con otros datos.", { claveSolicitud });
  }
}
