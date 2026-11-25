import { ErrorDeDominio } from "../../../compartido/dominio/index.js";

/** No hay cierre de ese mes (404). */
export class CierreNoExiste extends ErrorDeDominio {
  constructor(mes: string) {
    super("CIERRE_NO_EXISTE", "Ese mes todavía no se ha cerrado.", { mes });
  }
}

/**
 * CU-14 ext 2c · Otro disparo ya guardó el cierre del mes. Lo lanza RepositorioCierres.guardar;
 * el caso de uso lo atrapa y devuelve el cierre existente, así que nunca llega a la API.
 */
export class CierreYaExiste extends ErrorDeDominio {
  constructor(mes: string) {
    super("CIERRE_YA_EXISTE", "Ese mes ya tiene un cierre.", { mes });
  }
}
