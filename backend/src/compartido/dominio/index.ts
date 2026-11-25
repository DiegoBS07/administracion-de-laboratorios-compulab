// Núcleo compartido del dominio (docs/07-arquitectura.md, 7.3; docs/09-clases.md, 9.1).
// Solo objetos valor que varios módulos usan con el mismo significado. No es una carpeta de utilidades.
export { DatoInvalido, ErrorDeDominio, FranjaInvalida } from "./errores.js";
export { Fecha, type DiaDeLaSemana } from "./fecha.js";
export { Hora } from "./hora.js";
export { Instante } from "./instante.js";
export { Franja } from "./franja.js";
export { Semana } from "./semana.js";
export { Dinero } from "./dinero.js";
export type { Reloj } from "./reloj.js";
