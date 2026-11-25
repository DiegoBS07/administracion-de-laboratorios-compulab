// Rutas de la aplicación (docs/diseno-ux-ui.md, 15.5). Cada ruta verifica el rol antes de mostrarse
// (nivel 2 de protección); el backend vuelve a verificar el permiso en cada operación (nivel 3).
import { BrowserRouter, Route, Routes } from "react-router";
import type { Rol } from "../compartido/api/tipos";
import { PantallaCierreDelMes, PantallaCierres } from "../funcionalidades/cierre-mensual/pantallas";
import { PantallaHorario } from "../funcionalidades/horario-laboratorio/pantallas";
import { PantallaMisReservas, PantallaReservar, PantallaReservarLaboratorio } from "../funcionalidades/reservar-maquina/pantallas";
import { Ingresar } from "./Ingresar";
import { ProveedorDeSesion } from "./sesion";
import {
  Avisos,
  FueraDelNucleo,
  Inicio,
  ListaDeLaboratorios,
  Mas,
  Panel,
  PendientesDelLaboratorio,
  Protegida,
  SinPermiso
} from "./vistas-generales";

const ESTUDIANTES: Rol[] = ["ESTUDIANTE", "ASISTENTE"];
const COORDINACION: Rol[] = ["COORDINADOR_LABORATORIO", "COORDINADOR_SOPORTE"];
const SOPORTE: Rol[] = ["COORDINADOR_SOPORTE"];

/** Pantallas fuera del núcleo: [ruta, roles, título, qué contendrá]. */
const FUERA_DEL_NUCLEO: [string, Rol[], string, string][] = [
  ["/postulacion", ["ESTUDIANTE"], "Postulación", "Aquí el estudiante marcará en una cuadrícula semanal los bloques en que puede trabajar y elegirá los laboratorios que le interesan."],
  ["/mi-turno", ["ASISTENTE"], "Mi turno", "El turno actual o el próximo, con el botón grande de marcar entrada y salida, y los atajos para reportar o reparar una máquina."],
  ["/mis-turnos", ["ASISTENTE"], "Mis turnos", "Sus turnos por semana, con la opción de aceptar los pendientes y de ofrecer un turno."],
  ["/ofertas", ["ASISTENTE"], "Ofertas", "Turnos que otros asistentes de sus laboratorios ofrecen para que los cubra."],
  ["/seleccion", SOPORTE, "Selección de asistentes", "Convocatoria del semestre, postulaciones por evaluar, entrevistas y decisión."],
  ["/asistentes", SOPORTE, "Asistentes", "Asistentes del semestre: corregir el tope de horas o dar de baja."],
  ["/tarifas", SOPORTE, "Tarifas", "Tarifa por hora de cada categoría y porcentaje de recargo, con su fecha de vigencia."],
  ["/uso-de-maquinas", SOPORTE, "Uso de máquinas", "Por laboratorio y semana: máquinas fuera de servicio y porcentaje de uso de las demás."]
];

const SECCIONES_DEL_LABORATORIO: [string, string, string][] = [
  ["cambios", "Cambios por aprobar", "Tomas de ofertas de turnos pendientes de aprobar o rechazar."],
  ["cobertura", "Cobertura", "Turnos vacantes y no cubiertos de una semana, y regularización de marcas incompletas."],
  ["maquinas", "Máquinas", "Estado de las máquinas del laboratorio y registro de reparaciones."]
];

export function App() {
  return (
    <BrowserRouter>
      <ProveedorDeSesion>
        <Routes>
          <Route path="/ingresar" element={<Ingresar />} />
          <Route path="/" element={<Inicio />} />

          <Route path="/reservar" element={<Protegida roles={ESTUDIANTES}><PantallaReservar /></Protegida>} />
          <Route path="/reservar/:idLaboratorio" element={<Protegida roles={ESTUDIANTES}><PantallaReservarLaboratorio /></Protegida>} />
          <Route path="/mis-reservas" element={<Protegida roles={ESTUDIANTES}><PantallaMisReservas /></Protegida>} />

          <Route path="/laboratorios" element={<Protegida roles={SOPORTE}><ListaDeLaboratorios /></Protegida>} />
          <Route path="/laboratorios/:idLaboratorio/horario" element={<Protegida roles={COORDINACION} porLaboratorio><PantallaHorario /></Protegida>} />
          <Route path="/laboratorios/:idLaboratorio/pendientes" element={<Protegida roles={COORDINACION} porLaboratorio><PendientesDelLaboratorio /></Protegida>} />
          {SECCIONES_DEL_LABORATORIO.map(([seccion, titulo, texto]) => (
            <Route
              key={seccion}
              path={`/laboratorios/:idLaboratorio/${seccion}`}
              element={<Protegida roles={COORDINACION} porLaboratorio><FueraDelNucleo titulo={titulo} texto={texto} /></Protegida>}
            />
          ))}

          <Route path="/panel" element={<Protegida roles={SOPORTE}><Panel /></Protegida>} />
          <Route path="/cierres" element={<Protegida roles={SOPORTE}><PantallaCierres /></Protegida>} />
          <Route path="/cierres/:anio/:mes" element={<Protegida roles={SOPORTE}><PantallaCierreDelMes /></Protegida>} />

          {FUERA_DEL_NUCLEO.map(([ruta, roles, titulo, texto]) => (
            <Route key={ruta} path={ruta} element={<Protegida roles={roles}><FueraDelNucleo titulo={titulo} texto={texto} /></Protegida>} />
          ))}

          <Route path="/avisos" element={<Protegida roles={null}><Avisos /></Protegida>} />
          <Route path="/mas" element={<Protegida roles={null}><Mas /></Protegida>} />
          <Route path="/sin-permiso" element={<Protegida roles={null}><SinPermiso /></Protegida>} />
          <Route path="*" element={<Inicio />} />
        </Routes>
      </ProveedorDeSesion>
    </BrowserRouter>
  );
}
