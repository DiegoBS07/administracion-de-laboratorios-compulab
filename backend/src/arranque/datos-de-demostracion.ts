// Datos de demostración del núcleo ejecutable (docs/03-alcance.md, 3.3: sin base de datos ni
// Directorio real). Se generan alrededor de la fecha de arranque para que siempre haya un mes
// anterior por cerrar, laboratorios abiertos en los próximos días y una semana actual con turnos.
import { Dinero, Fecha, Franja, Hora, type Instante } from "../compartido/dominio/index.js";
import { type BloqueDeDisponibilidadDTO, type Laboratorio, Turno } from "../modulos/horarios/index.js";
import type { RolAsignado, UsuarioDeDemostracion } from "../modulos/identidad/index.js";
import type { TopeVigente, VigenciaDeTarifas } from "../modulos/liquidacion/index.js";
import { Maquina, Reserva } from "../modulos/reservas/index.js";

/** Contraseña de todos los usuarios de demostración (solo existe en el doble del Directorio). */
export const SECRETO_DE_DEMOSTRACION = "demo";

export interface AsistenteDeDemostracion {
  id: string;
  nombre: string;
  carne: string;
  categoria: "A" | "B";
  activo: boolean;
  topes: TopeVigente[];
  disponibilidad: BloqueDeDisponibilidadDTO[];
  laboratorios: string[];
}

export interface Marcas {
  entrada: Instante | null;
  salida: Instante | null;
}

export interface DatosDeDemostracion {
  laboratorios: Laboratorio[];
  asistentes: AsistenteDeDemostracion[];
  turnos: Turno[];
  /** Marcas de entrada y salida por turno: hacen las veces del módulo asistencia, fuera del núcleo. */
  marcas: Map<string, Marcas>;
  maquinas: Maquina[];
  reservas: Reserva[];
  usuarios: UsuarioDeDemostracion[];
  roles: Record<string, RolAsignado[]>;
  semestre: { inicio: Fecha; fin: Fecha };
  tarifas: VigenciaDeTarifas[];
}

const LUNES_A_VIERNES = [1, 2, 3, 4, 5];
const bloques = (dias: number[], horaInicio: string, horaFin: string): BloqueDeDisponibilidadDTO[] =>
  dias.map((dia) => ({ dia, horaInicio, horaFin }));

/** Horario semanal fijo: [laboratorio, asistente, días, inicio, fin]. */
const PLAN_SEMANAL: [string, string, number[], string, string][] = [
  ["c1", "a1", LUNES_A_VIERNES, "07:00", "11:00"],
  ["c1", "a2", LUNES_A_VIERNES, "11:00", "15:00"],
  ["c1", "a4", [2, 4], "15:00", "17:00"],
  ["c1", "a3", LUNES_A_VIERNES, "17:00", "21:00"],
  ["c1", "a4", [6], "08:00", "12:00"],
  ["c2", "a5", [1, 3, 5], "08:00", "12:00"]
];

export function crearDatosDeDemostracion(ahora: Instante): DatosDeDemostracion {
  const hoy = ahora.fecha;
  const inicioMesAnterior = hoy.mes === 1 ? Fecha.de(hoy.anio - 1, 12, 1) : Fecha.de(hoy.anio, hoy.mes - 1, 1);
  const desde = inicioMesAnterior.lunesDeSuSemana();
  const hasta = hoy.sumarDias(13);
  const haceTiempo = Fecha.de(hoy.anio - 1, 1, 1);

  const asistentes: AsistenteDeDemostracion[] = [
    { id: "a1", nombre: "Diego Vargas Solano", carne: "2022100001", categoria: "B", activo: true, topes: [{ minutosPorSemana: 1200, vigenteDesde: haceTiempo }], disponibilidad: bloques(LUNES_A_VIERNES, "07:00", "13:00"), laboratorios: ["c1"] },
    { id: "a2", nombre: "María Solano Ureña", carne: "2022100002", categoria: "A", activo: true, topes: [{ minutosPorSemana: 1200, vigenteDesde: haceTiempo }], disponibilidad: bloques(LUNES_A_VIERNES, "11:00", "18:00"), laboratorios: ["c1"] },
    {
      id: "a3",
      nombre: "José Brenes Castro",
      carne: "2021100003",
      categoria: "A",
      activo: true,
      // el tope se corrigió a 15 h al iniciar el mes anterior (RF-07): sus turnos de 20 h dejan horas sobre el tope
      topes: [{ minutosPorSemana: 1200, vigenteDesde: haceTiempo }, { minutosPorSemana: 900, vigenteDesde: inicioMesAnterior }],
      disponibilidad: [...bloques(LUNES_A_VIERNES, "16:00", "21:00"), ...bloques([6], "08:00", "12:00")],
      laboratorios: ["c1"]
    },
    { id: "a4", nombre: "Andrés Mora Quirós", carne: "2023100004", categoria: "A", activo: true, topes: [{ minutosPorSemana: 600, vigenteDesde: haceTiempo }], disponibilidad: [...bloques([2, 4], "13:00", "17:00"), ...bloques([6], "08:00", "14:00")], laboratorios: ["c1", "c2"] },
    { id: "a5", nombre: "Sofía Chaves León", carne: "2023100005", categoria: "B", activo: true, topes: [{ minutosPorSemana: 720, vigenteDesde: haceTiempo }], disponibilidad: bloques([1, 3, 5], "07:00", "13:00"), laboratorios: ["c2"] },
    { id: "a6", nombre: "Pablo Castro Vega", carne: "2020100006", categoria: "A", activo: false, topes: [{ minutosPorSemana: 600, vigenteDesde: haceTiempo }], disponibilidad: bloques(LUNES_A_VIERNES, "07:00", "12:00"), laboratorios: ["c1"] },
    { id: "a7", nombre: "Laura Méndez Arias", carne: "2024100007", categoria: "A", activo: true, topes: [{ minutosPorSemana: 900, vigenteDesde: haceTiempo }], disponibilidad: bloques(LUNES_A_VIERNES, "07:00", "21:00"), laboratorios: ["c1", "c2"] }
  ];

  // Excepciones del mes anterior para que el cierre muestre cada caso (CU-14 ext 3b y 3c).
  const delMesAnterior = (diaDeLaSemana: number, numero: number) => {
    let fecha = inicioMesAnterior;
    while (fecha.diaDeLaSemana !== diaDeLaSemana) fecha = fecha.sumarDias(1);
    return fecha.sumarDias(7 * (numero - 1)).aTexto();
  };
  const noCubierto = `${delMesAnterior(3, 2)}|a2`; // segundo miércoles: María no llegó
  const incompleta = `${delMesAnterior(2, 3)}|a1`; // tercer martes: Diego no marcó la salida
  const tarde = `${delMesAnterior(1, 1)}|a1`; // primer lunes: Diego llegó 10 minutos tarde

  const turnos: Turno[] = [];
  const marcas = new Map<string, Marcas>();
  for (let fecha = desde; !fecha.esPosteriorA(hasta); fecha = fecha.sumarDias(1)) {
    for (const [idLaboratorio, idAsistente, dias, inicio, fin] of PLAN_SEMANAL) {
      if (!dias.includes(fecha.diaDeLaSemana)) continue;
      const franja = Franja.delDia(fecha, Hora.desdeTexto(inicio), Hora.desdeTexto(fin));
      const id = `t-${idLaboratorio}-${fecha.aTexto()}-${inicio.replace(":", "")}`;
      const clave = `${fecha.aTexto()}|${idAsistente}`;
      let estado: Turno["estado"] = "ASIGNADO";
      let marca: Marcas | null = null;
      if (!ahora.esAnteriorA(franja.fin)) {
        estado = "CUBIERTO";
        marca = { entrada: franja.inicio, salida: franja.fin };
        if (clave === noCubierto) {
          estado = "NO_CUBIERTO";
          marca = null;
        } else if (clave === incompleta) {
          estado = "MARCA_INCOMPLETA";
          marca = { entrada: franja.inicio.sumarMinutos(3), salida: null };
        } else if (clave === tarde) {
          marca = { entrada: franja.inicio.sumarMinutos(10), salida: franja.fin };
        }
      } else if (!ahora.esAnteriorA(franja.inicio)) {
        estado = "EN_CURSO";
        marca = { entrada: franja.inicio, salida: null };
      }
      turnos.push(Turno.reconstituir({ id, idLaboratorio, idAsistente, franja, estado, creadoPor: null, claveSolicitud: null }));
      if (marca) marcas.set(id, marca);
    }
  }

  const maquinas = [
    ...maquinasDe("c1", 8, [8]),
    ...maquinasDe("c2", 6, [6]),
    ...maquinasDe("sj1", 4, [])
  ];

  // Luis ya tiene una reserva el próximo día hábil, para que se vea una máquina ocupada.
  let diaHabil = hoy.sumarDias(1);
  while (diaHabil.diaDeLaSemana > 5) diaHabil = diaHabil.sumarDias(1);
  const reservas = [
    Reserva.reconstituir({
      id: "r-demo-1",
      idEstudiante: "est-luis",
      idMaquina: "m-c1-02",
      franja: Franja.delDia(diaHabil, Hora.de(8), Hora.de(10)),
      estado: "ACTIVA",
      claveSolicitud: null
    })
  ];

  const identidad = (idUsuario: string, nombre: string, carne: string | null, esEstudianteDeLaEscuela: boolean) => ({
    idUsuario,
    nombre,
    carne,
    correo: `${idUsuario}@estudiantec.cr`,
    esEstudianteDeLaEscuela
  });
  const usuarios: UsuarioDeDemostracion[] = [
    { usuario: "ana.estudiante", secreto: SECRETO_DE_DEMOSTRACION, identidad: identidad("est-ana", "Ana Rodríguez Mora", "2024012345", true) },
    { usuario: "luis.estudiante", secreto: SECRETO_DE_DEMOSTRACION, identidad: identidad("est-luis", "Luis Pérez Solís", "2024067890", true) },
    { usuario: "marta.coordinadora", secreto: SECRETO_DE_DEMOSTRACION, identidad: identidad("coord-c1", "Marta Jiménez Rojas", null, false) },
    { usuario: "carlos.soporte", secreto: SECRETO_DE_DEMOSTRACION, identidad: identidad("soporte", "Carlos Quesada Araya", null, false) },
    { usuario: "diego.asistente", secreto: SECRETO_DE_DEMOSTRACION, identidad: identidad("a1", "Diego Vargas Solano", "2022100001", true) }
  ];
  const roles: Record<string, RolAsignado[]> = {
    "coord-c1": [{ rol: "COORDINADOR_LABORATORIO", idLaboratorio: "c1" }],
    soporte: [{ rol: "COORDINADOR_SOPORTE" }],
    a1: [{ rol: "ASISTENTE" }]
  };

  return {
    laboratorios: [
      { id: "c1", nombre: "Laboratorio 1 · Edificio B3", campus: "Cartago" },
      { id: "c2", nombre: "Laboratorio 2 · Edificio B3", campus: "Cartago" },
      { id: "sj1", nombre: "Laboratorio San José", campus: "San José" }
    ],
    asistentes,
    turnos,
    marcas,
    maquinas,
    reservas,
    usuarios,
    roles,
    semestre: { inicio: desde, fin: hoy.sumarDias(56) },
    tarifas: [
      {
        vigenteDesde: haceTiempo,
        vigenteHasta: null,
        tarifaPorHora: { A: Dinero.deCentimos(215000), B: Dinero.deCentimos(260000) },
        porcentajeRecargo: 25
      }
    ]
  };
}

function maquinasDe(idLaboratorio: string, cantidad: number, fueraDeServicio: number[]): Maquina[] {
  return Array.from({ length: cantidad }, (_, i) => {
    const numero = String(i + 1).padStart(2, "0");
    return Maquina.reconstituir({
      id: `m-${idLaboratorio}-${numero}`,
      idLaboratorio,
      codigo: `${idLaboratorio.toUpperCase()}-${numero}`,
      enServicio: !fueraDeServicio.includes(i + 1)
    });
  });
}
