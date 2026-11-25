// Fechas, horas y dinero en el idioma del usuario (heurística 2). Sin dependencias del navegador:
// lo usan los presentadores, que se prueban en Node.
//
// La API envía los instantes en hora de Costa Rica con su desfase (2026-11-24T08:00:00-06:00, 8.7),
// así que la fecha y la hora se leen del texto: nunca se convierten a la zona del dispositivo.

export const DIAS = ["", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];
export const DIAS_CORTOS = ["", "lun", "mar", "mié", "jue", "vie", "sáb", "dom"];
export const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

const aFecha = (s: string) => new Date(`${s}T12:00:00Z`);
const aTexto = (d: Date) => d.toISOString().slice(0, 10);

export function sumarDias(fecha: string, dias: number): string {
  const d = aFecha(fecha);
  d.setUTCDate(d.getUTCDate() + dias);
  return aTexto(d);
}

/** 1 = lunes … 7 = domingo. */
export function diaDeLaSemana(fecha: string): number {
  return aFecha(fecha).getUTCDay() || 7;
}

export const lunesDe = (fecha: string) => sumarDias(fecha, 1 - diaDeLaSemana(fecha));
export const diaDelMes = (fecha: string) => aFecha(fecha).getUTCDate();
export const nombreDelMes = (fecha: string) => MESES[aFecha(fecha).getUTCMonth()] ?? "";
export const mayuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** "martes 24 de noviembre". */
export function fechaLarga(fecha: string): string {
  return `${DIAS[diaDeLaSemana(fecha)]} ${diaDelMes(fecha)} de ${nombreDelMes(fecha)}`;
}

/** Fecha de un instante ISO de la API ("2026-11-24T08:00:00-06:00" → "2026-11-24"). */
export const fechaDe = (iso: string) => iso.slice(0, 10);

/**
 * Minutos desde la medianoche del día `fecha` (por omisión, el del propio instante). Un fin a las
 * 00:00 del día siguiente vale 1440 (24:00).
 */
export function minutosDe(iso: string, fecha = fechaDe(iso)): number {
  const minutos = Number(iso.slice(11, 13)) * 60 + Number(iso.slice(14, 16));
  return fechaDe(iso) > fecha ? 1440 + minutos : minutos;
}

/** "HH:MM" → minutos. */
export const minutosDeHora = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

/** Minutos → "7:30" (para leer). */
export const hora = (minutos: number) => `${Math.floor(minutos / 60)}:${String(minutos % 60).padStart(2, "0")}`;

/** Minutos → "07:30" (para enviar a la API). */
export const horaApi = (minutos: number) => `${String(Math.floor(minutos / 60)).padStart(2, "0")}:${String(minutos % 60).padStart(2, "0")}`;

/** Instante de la API para una fecha y minutos del día en Costa Rica. */
export const instanteApi = (fecha: string, minutos: number) => `${fecha}T${horaApi(minutos)}:00-06:00`;

/** 90 → "1 h 30 min". */
export function duracion(minutos: number): string {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  if (!h) return `${m} min`;
  return m ? `${h} h ${m} min` : `${h} h`;
}

/** 330 → "5,5 h". */
export const horas = (minutos: number) => `${(minutos / 60).toLocaleString("es-CR", { maximumFractionDigits: 1 })} h`;

const colones = new Intl.NumberFormat("es-CR", { style: "currency", currency: "CRC" });
/** Céntimos → "₡63 050,00". */
export const dinero = (centimos: number) => colones.format(centimos / 100);

/** Instante en hora de Costa Rica (UTC−6, sin horario de verano) a partir de milisegundos. */
export function instanteDeCostaRica(ms: number): string {
  return `${new Date(ms - 6 * 3_600_000).toISOString().slice(0, 19)}-06:00`;
}
