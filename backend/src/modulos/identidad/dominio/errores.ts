import { ErrorDeDominio } from "../../../compartido/dominio/index.js";

/** Usuario o secreto incorrectos (401). */
export class CredencialesInvalidas extends ErrorDeDominio {
  constructor() {
    super("CREDENCIALES_INVALIDAS", "El usuario o la contraseña no son correctos.");
  }
}

/** ADR-0011 · El Directorio no responde: se falla cerrado (503). */
export class DirectorioNoDisponible extends ErrorDeDominio {
  constructor() {
    super("DIRECTORIO_NO_DISPONIBLE", "El directorio institucional no responde; intente en unos minutos.");
  }
}

/** No hay sesión o ya venció (401). */
export class NoAutenticado extends ErrorDeDominio {
  constructor() {
    super("NO_AUTENTICADO", "Inicie sesión para continuar.");
  }
}

/** La persona se autenticó pero no tiene ningún rol en CompuLab (403). */
export class SinAccesoACompuLab extends ErrorDeDominio {
  constructor(idUsuario: string) {
    super("SIN_PERMISO", "Su cuenta no tiene acceso a CompuLab.", { idUsuario });
  }
}
