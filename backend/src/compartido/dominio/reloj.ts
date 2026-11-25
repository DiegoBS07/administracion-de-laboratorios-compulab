import type { Instante } from "./instante.js";

/**
 * Puerto Reloj (docs/08-componentes.md, 8.3).
 * Devuelve la hora oficial: la del servidor del backend sincronizado por NTP con el TEC,
 * en America/Costa_Rica. Es la única fuente de tiempo del dominio y de la aplicación (R-6);
 * la hora del celular nunca se usa. En pruebas se sustituye por RelojFijo.
 */
export interface Reloj {
  ahora(): Instante;
}
