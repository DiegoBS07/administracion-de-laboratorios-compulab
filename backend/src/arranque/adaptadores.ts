// Los dos juegos de adaptadores del backend (docs/08-componentes.md, 8.2 "prueba de reemplazo"):
// en memoria (pruebas y demostración sin base) y PostgreSQL (contenedor). Los casos de uso reciben
// los mismos puertos en ambos casos y no se enteran de cuál se usa.
import { sql } from "kysely";
import type { Reloj } from "../compartido/dominio/index.js";
import { BandejaDeAvisos } from "../compartido/infraestructura/bandeja-de-avisos.js";
import { AvisosPostgres } from "../compartido/infraestructura/postgres/avisos.js";
import { type ConfiguracionPostgres, crearConexion, UnidadDeTrabajoPostgres } from "../compartido/infraestructura/postgres/conexion.js";
import { UnidadDeTrabajoEnMemoria } from "../compartido/infraestructura/unidad-de-trabajo-en-memoria.js";
import * as horarios from "../modulos/horarios/index.js";
import * as identidad from "../modulos/identidad/index.js";
import * as liquidacion from "../modulos/liquidacion/index.js";
import * as reservas from "../modulos/reservas/index.js";
import { crearDatosDeDemostracion } from "./datos-de-demostracion.js";
import { AsistentesPostgres, CalendarioPostgres, CatalogoDeLaboratoriosPostgres, LectorDeMarcasPostgres } from "./lectores-postgres.js";
import { AsistentesDeDemostracion, CalendarioFijo, CatalogoDeLaboratoriosFijo, type LectorDeMarcas, MarcasEnMemoria, TablaTarifasFija } from "./puentes.js";
import { sembrarSiEstaVacia } from "./siembra-postgres.js";

export interface Adaptadores {
  unidadDeTrabajo: horarios.UnidadDeTrabajo;
  turnos: horarios.RepositorioTurnos;
  laboratorios: horarios.CatalogoDeLaboratorios;
  asistentes: horarios.ConsultaAsistentes & horarios.AsistentesDelLaboratorio;
  datosDeAsistentes: liquidacion.DatosDeAsistentes;
  calendario: horarios.CalendarioAcademico;
  maquinas: reservas.RepositorioMaquinas;
  reservas: reservas.RepositorioReservas;
  cierres: liquidacion.RepositorioCierres;
  tarifas: liquidacion.TablaTarifas;
  marcas: LectorDeMarcas;
  roles: identidad.RepositorioRoles;
  sesiones: identidad.RepositorioSesiones;
  notificador: { avisar(destinatario: string, tipo: string, datos: Record<string, string>): Promise<void> };
  /** El Directorio institucional queda fuera del núcleo: siempre es el doble con usuarios fijos. */
  directorio: identidad.DirectorioDeDemostracion;
  /** Para /health: false si la persistencia no responde. */
  comprobarSalud(): Promise<boolean>;
  cerrar(): Promise<void>;
}

/** Todo en memoria con los datos de demostración generados alrededor de la hora del reloj. */
export function crearAdaptadoresEnMemoria(reloj: Reloj): Adaptadores {
  const datos = crearDatosDeDemostracion(reloj.ahora());
  const unidadDeTrabajo = new UnidadDeTrabajoEnMemoria();
  const asistentes = new AsistentesDeDemostracion(datos.asistentes, () => reloj.ahora().fecha);
  return {
    unidadDeTrabajo,
    turnos: new horarios.RepositorioTurnosEnMemoria(unidadDeTrabajo, datos.turnos),
    laboratorios: new CatalogoDeLaboratoriosFijo(datos.laboratorios),
    asistentes,
    datosDeAsistentes: asistentes.paraLiquidacion(),
    calendario: new CalendarioFijo(datos.semestre),
    maquinas: new reservas.RepositorioMaquinasEnMemoria(datos.maquinas),
    reservas: new reservas.RepositorioReservasEnMemoria(unidadDeTrabajo, datos.reservas),
    cierres: new liquidacion.RepositorioCierresEnMemoria(),
    tarifas: new TablaTarifasFija(datos.tarifas),
    marcas: new MarcasEnMemoria(datos.marcas),
    roles: new identidad.RepositorioRolesEnMemoria(datos.roles),
    sesiones: new identidad.RepositorioSesionesEnMemoria(),
    notificador: new BandejaDeAvisos(() => reloj.ahora().aISO()),
    directorio: new identidad.DirectorioDeDemostracion(datos.usuarios),
    comprobarSalud: async () => true,
    cerrar: async () => undefined
  };
}

export interface OpcionesPostgres {
  conexion: ConfiguracionPostgres;
  reloj: Reloj;
  /** Si la base está vacía, la llena con los datos de demostración (APP_DATOS_DEMO=true). */
  sembrarDatosDeDemostracion: boolean;
}

/** PostgreSQL 14 con el esquema de database/migrations/ (lo aplica Flyway antes de arrancar). */
export async function crearAdaptadoresPostgres(opciones: OpcionesPostgres): Promise<Adaptadores> {
  const db = crearConexion(opciones.conexion);
  const datos = crearDatosDeDemostracion(opciones.reloj.ahora());
  if (opciones.sembrarDatosDeDemostracion) await sembrarSiEstaVacia(db, datos);
  const unidadDeTrabajo = new UnidadDeTrabajoPostgres(db);
  const asistentes = new AsistentesPostgres(unidadDeTrabajo, opciones.reloj);
  return {
    unidadDeTrabajo,
    turnos: new horarios.RepositorioTurnosPostgres(unidadDeTrabajo),
    laboratorios: new CatalogoDeLaboratoriosPostgres(unidadDeTrabajo),
    asistentes,
    datosDeAsistentes: asistentes.paraLiquidacion(),
    calendario: new CalendarioPostgres(unidadDeTrabajo, opciones.reloj),
    maquinas: new reservas.RepositorioMaquinasPostgres(unidadDeTrabajo),
    reservas: new reservas.RepositorioReservasPostgres(unidadDeTrabajo),
    cierres: new liquidacion.RepositorioCierresPostgres(unidadDeTrabajo),
    tarifas: new liquidacion.TablaTarifasPostgres(unidadDeTrabajo),
    marcas: new LectorDeMarcasPostgres(unidadDeTrabajo),
    roles: new identidad.RepositorioRolesPostgres(unidadDeTrabajo),
    sesiones: new identidad.RepositorioSesionesPostgres(unidadDeTrabajo),
    notificador: new AvisosPostgres(unidadDeTrabajo),
    directorio: new identidad.DirectorioDeDemostracion(datos.usuarios),
    comprobarSalud: async () => {
      try {
        await sql`SELECT 1`.execute(db);
        return true;
      } catch {
        return false;
      }
    },
    cerrar: () => db.destroy()
  };
}
