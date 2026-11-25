// Presentador del horario y la asignación de turnos (CU-06, docs/diseno-ux-ui.md 15.6). La revisión
// previa usa los datos ya cargados solo para prevenir (N-7); la decisión final es del backend.
import { ErrorDeApi, SinRespuesta } from "../../compartido/api/cliente";
import type { AsistenteParaElegir, HorarioSemanal, Laboratorio, TurnoAsignado, TurnoDelHorario } from "../../compartido/api/tipos";
import { DIAS, DIAS_CORTOS, diaDeLaSemana, diaDelMes, fechaDe, horas, hora, minutosDe, minutosDeHora, nombreDelMes, sumarDias } from "../../compartido/ui/formato";

/** La cuadrícula va de 7:00 a 21:00, como el prototipo. */
export const PRIMERA_HORA = 7;
export const ULTIMA_HORA = 21;
export const ALTO_DE_HORA_PX = 44;

/** Un turno ocupa su franja salvo VACANTE y DESCARTADO (10.5). */
const ocupa = (t: TurnoDelHorario) => t.estado !== "VACANTE" && t.estado !== "DESCARTADO";
const seTraslapan = (a1: number, b1: number, a2: number, b2: number) => a1 < b2 && a2 < b1;

export interface DiaDeLaSemana {
  fecha: string;
  etiqueta: string;
  detalle: string;
  esHoy: boolean;
  nombreLargo: string;
}

export interface SemanaVista {
  titulo: string;
  dias: DiaDeLaSemana[];
  /** No se navega a semanas ya pasadas. */
  puedeIrAtras: boolean;
}

export function semanaVista(lunes: string, hoy: string): SemanaVista {
  const domingo = sumarDias(lunes, 6);
  const mismoMes = nombreDelMes(lunes) === nombreDelMes(domingo);
  return {
    titulo: `Semana del ${diaDelMes(lunes)}${mismoMes ? "" : ` de ${nombreDelMes(lunes)}`} al ${diaDelMes(domingo)} de ${nombreDelMes(domingo)}`,
    dias: Array.from({ length: 7 }, (_, i) => {
      const fecha = sumarDias(lunes, i);
      return {
        fecha,
        etiqueta: `${DIAS_CORTOS[diaDeLaSemana(fecha)] ?? ""} ${diaDelMes(fecha)}`,
        detalle: fecha === hoy ? "hoy" : nombreDelMes(fecha).slice(0, 3),
        esHoy: fecha === hoy,
        nombreLargo: `${DIAS[diaDeLaSemana(fecha)] ?? ""} ${diaDelMes(fecha)} de ${nombreDelMes(fecha)}`
      };
    }),
    puedeIrAtras: sumarDias(lunes, 6) >= sumarDias(hoy, 7)
  };
}

export interface BloqueDeTurno {
  id: string;
  arriba: number;
  alto: number;
  clase: string;
  nombre: string;
  horario: string;
  nota: string | null;
}

/** Turnos de un día como bloques posicionados en la cuadrícula. Los descartados no se dibujan. */
export function bloquesDelDia(horario: HorarioSemanal, fecha: string): BloqueDeTurno[] {
  return horario.turnos
    .filter((t) => t.fecha === fecha && t.estado !== "DESCARTADO")
    .map((t) => {
      const ini = Math.max(minutosDeHora(t.horaInicio), PRIMERA_HORA * 60);
      const fin = Math.min(minutosDeHora(t.horaFin), ULTIMA_HORA * 60);
      const pendiente = t.estado === "PENDIENTE_ACEPTACION";
      return {
        id: t.id,
        arriba: ((ini - PRIMERA_HORA * 60) / 60) * ALTO_DE_HORA_PX,
        alto: Math.max(((fin - ini) / 60) * ALTO_DE_HORA_PX - 2, 18),
        clase: `turno turno--${t.estado.toLowerCase()}${pendiente || t.estado === "VACANTE" ? " turno--pendiente" : ""}`,
        nombre: t.asistente?.nombre ?? "Sin responsable",
        horario: `${hora(minutosDeHora(t.horaInicio))} a ${hora(minutosDeHora(t.horaFin))}`,
        nota: pendiente ? "Pendiente de aceptar" : t.estado === "EN_CURSO" ? "En curso" : t.estado === "VACANTE" ? "Vacante" : null
      };
    });
}

/** Una hora de la cuadrícula ya pasó (no se puede asignar ahí). */
export function horaPasada(fecha: string, horaDelDia: number, ahora: string): boolean {
  const hoy = fechaDe(ahora);
  return fecha < hoy || (fecha === hoy && horaDelDia * 60 < minutosDe(ahora));
}

export interface Propuesta {
  fecha: string;
  ini: number;
  fin: number;
  idAsistente: string | null;
}

/** Propuesta inicial al tocar una hora libre: una franja de 2 horas, sin pasar de las 21:00. */
export function propuestaDesde(fecha: string, horaDelDia: number): Propuesta {
  const ini = horaDelDia * 60;
  return { fecha, ini, fin: Math.min(ini + 120, ULTIMA_HORA * 60), idAsistente: null };
}

/** Primera hora de inicio que se puede ofrecer ese día (las pasadas no se ofrecen). */
export function primerInicio(fecha: string, ahora: string): number {
  if (fecha !== fechaDe(ahora)) return PRIMERA_HORA * 60;
  return Math.max(PRIMERA_HORA * 60, Math.ceil((minutosDe(ahora) + 1) / 30) * 30);
}

export interface Evaluacion {
  estado: "bien" | "pendiente" | "mal";
  texto: string;
  /** Minutos que ya tiene en la semana. */
  programados: number;
}

/** Revisión previa de un asistente para la propuesta (RN-06, RN-07, RN-08). */
export function evaluarAsistente(asistente: AsistenteParaElegir, horario: HorarioSemanal, propuesta: Propuesta): Evaluacion {
  const programados = asistente.minutosProgramadosSemana;
  const choque = horario.turnos.find(
    (t) => t.asistente?.id === asistente.id && t.fecha === propuesta.fecha && ocupa(t) && seTraslapan(minutosDeHora(t.horaInicio), minutosDeHora(t.horaFin), propuesta.ini, propuesta.fin)
  );
  if (choque) return { estado: "mal", texto: `Ya tiene turno de ${hora(minutosDeHora(choque.horaInicio))} a ${hora(minutosDeHora(choque.horaFin))} en este laboratorio`, programados };
  const total = programados + (propuesta.fin - propuesta.ini);
  if (total > asistente.topeSemanalMinutos) return { estado: "mal", texto: `Pasaría su tope: ${horas(total)} de ${horas(asistente.topeSemanalMinutos)}`, programados };
  const dia = diaDeLaSemana(propuesta.fecha);
  const dentro = asistente.disponibilidad.some((b) => b.dia === dia && minutosDeHora(b.horaInicio) <= propuesta.ini && propuesta.fin <= minutosDeHora(b.horaFin));
  if (!dentro) return { estado: "pendiente", texto: "Fuera de su disponibilidad: quedará pendiente de que acepte", programados };
  return { estado: "bien", texto: "Disponible en ese horario", programados };
}

export interface RevisionDeLaPropuesta {
  /** Si hay bloqueo, "Asignar" queda deshabilitado y se explica por qué. */
  bloqueo: string | null;
  /** Aviso que no bloquea: quedará pendiente de aceptación (ext 4d). */
  aviso: string | null;
}

export function revisarPropuesta(propuesta: Propuesta, horario: HorarioSemanal, asistentes: AsistenteParaElegir[]): RevisionDeLaPropuesta {
  if (propuesta.fin <= propuesta.ini) return { bloqueo: "La hora de fin debe ser posterior a la de inicio.", aviso: null };
  const ocupado = horario.turnos.find(
    (t) => t.fecha === propuesta.fecha && ocupa(t) && seTraslapan(minutosDeHora(t.horaInicio), minutosDeHora(t.horaFin), propuesta.ini, propuesta.fin)
  );
  if (ocupado) {
    return {
      bloqueo: `Ese horario ya tiene responsable en este laboratorio (${ocupado.asistente?.nombre ?? "otro asistente"}, de ${hora(minutosDeHora(ocupado.horaInicio))} a ${hora(minutosDeHora(ocupado.horaFin))}).`,
      aviso: null
    };
  }
  const elegido = asistentes.find((a) => a.id === propuesta.idAsistente);
  if (!elegido) return { bloqueo: null, aviso: null };
  const evaluacion = evaluarAsistente(elegido, horario, propuesta);
  if (evaluacion.estado === "mal") {
    const total = evaluacion.programados + propuesta.fin - propuesta.ini;
    return {
      bloqueo: evaluacion.texto.startsWith("Pasaría")
        ? `${elegido.nombre} llegaría a ${horas(total)} esta semana y su tope es de ${horas(elegido.topeSemanalMinutos)}.`
        : `${elegido.nombre} ${evaluacion.texto.charAt(0).toLowerCase()}${evaluacion.texto.slice(1)}.`,
      aviso: null
    };
  }
  if (evaluacion.estado === "pendiente") {
    return { bloqueo: null, aviso: `Ese horario está fuera de la disponibilidad que ${elegido.nombre} declaró. El turno quedará pendiente hasta que lo acepte, y se le avisará.` };
  }
  return { bloqueo: null, aviso: null };
}

/** Mensaje breve después de asignar (15.6). */
export function confirmacionDeTurno(turno: TurnoAsignado): string {
  return turno.estado === "PENDIENTE_ACEPTACION"
    ? `El turno quedó pendiente de que ${turno.asistente.nombre} lo acepte. Se le avisó.`
    : `Turno asignado a ${turno.asistente.nombre}: ahora tiene ${horas(turno.minutosSemanaAsistente)} de ${horas(turno.topeSemanalMinutos)} esta semana.`;
}

export interface MensajeDeError {
  titulo: string;
  texto: string;
}

/** Tabla de mensajes de CU-06 (15.6), con nombres en lugar de identificadores. */
export function mensajeDeErrorDeTurno(error: unknown, contexto: { laboratorios: Laboratorio[]; asistentes: AsistenteParaElegir[]; idAsistente: string | null }): MensajeDeError {
  const nombre = (id: unknown) => contexto.asistentes.find((a) => a.id === id)?.nombre ?? "El asistente";
  if (error instanceof ErrorDeApi) {
    const conflicto = (error.detalle["conflicto"] ?? {}) as { idLaboratorio?: string; idAsistente?: string; inicio?: string; fin?: string };
    switch (error.codigo) {
      case "TRASLAPE_DE_TURNO": {
        const lab = contexto.laboratorios.find((l) => l.id === conflicto.idLaboratorio);
        const desde = conflicto.inicio ? hora(minutosDe(conflicto.inicio)) : "";
        const hasta = conflicto.fin && conflicto.inicio ? hora(minutosDe(conflicto.fin, fechaDe(conflicto.inicio))) : "";
        return {
          titulo: `${nombre(conflicto.idAsistente ?? contexto.idAsistente)} ya tiene un turno de ${desde} a ${hasta}${lab ? ` en ${lab.nombre} (${lab.campus})` : ""}.`,
          texto: "Elige otro asistente u horario."
        };
      }
      case "FRANJA_OCUPADA_EN_LABORATORIO":
        return { titulo: "Ese horario ya tiene responsable en este laboratorio.", texto: "Revisa el turno existente en la cuadrícula." };
      case "TOPE_SEMANAL_EXCEDIDO": {
        const programados = Number(error.detalle["minutosProgramados"] ?? 0);
        const delTurno = Number(error.detalle["minutosDelTurno"] ?? 0);
        const tope = Number(error.detalle["topeSemanalMinutos"] ?? 0);
        return { titulo: `${nombre(contexto.idAsistente)} llegaría a ${horas(programados + delTurno)} esta semana y su tope es de ${horas(tope)}.`, texto: "Acorta el turno o elige otro asistente." };
      }
      case "ASISTENTE_NO_ACTIVO":
        return { titulo: `${nombre(contexto.idAsistente)} ya no es asistente activo.`, texto: "La lista de asistentes se actualizó." };
      case "TURNO_EN_EL_PASADO":
      case "FUERA_DEL_SEMESTRE":
      case "FRANJA_DE_TURNO_INVALIDA":
        return { titulo: "Revisa la fecha y las horas.", texto: "El turno debe ser futuro, del semestre y terminar después de empezar." };
      default:
        if (error.estado >= 500) return { titulo: "Ocurrió un error inesperado.", texto: `Reporta el número de solicitud ${error.idSolicitud ?? ""}.`.trim() };
        return { titulo: "No se pudo asignar el turno.", texto: error.message };
    }
  }
  if (error instanceof SinRespuesta) return { titulo: "No llegó la respuesta del servidor.", texto: "Intenta de nuevo: si el turno ya se asignó, no se duplicará." };
  return { titulo: "Ocurrió un error inesperado.", texto: "Intenta de nuevo." };
}
