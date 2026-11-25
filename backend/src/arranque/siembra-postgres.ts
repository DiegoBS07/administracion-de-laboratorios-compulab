// Carga los datos de demostración en una base vacía (APP_DATOS_DEMO=true). Usa el mismo
// crearDatosDeDemostracion que el modo en memoria: hay una sola fuente de datos de ejemplo.
import { type Kysely, sql } from "kysely";
import type { BaseDeDatos } from "../compartido/infraestructura/postgres/esquema.js";
import type { DatosDeDemostracion } from "./datos-de-demostracion.js";

/** Número arbitrario del candado que evita que dos instancias siembren a la vez. */
const CANDADO_DE_SIEMBRA = 724_301;

/** Siembra solo si no hay laboratorios. Devuelve true si sembró. */
export async function sembrarSiEstaVacia(db: Kysely<BaseDeDatos>, datos: DatosDeDemostracion): Promise<boolean> {
  return db.transaction().execute(async (trx) => {
    await sql`SELECT pg_advisory_xact_lock(${CANDADO_DE_SIEMBRA})`.execute(trx);
    const existente = await trx.selectFrom("laboratorios").select("id").limit(1).executeTakeFirst();
    if (existente) return false;

    await trx.insertInto("laboratorios").values(datos.laboratorios).execute();
    await trx
      .insertInto("maquinas")
      .values(datos.maquinas.map((m) => ({ id: m.id, id_laboratorio: m.idLaboratorio, codigo: m.codigo, en_servicio: m.enServicio })))
      .execute();
    await trx
      .insertInto("asistentes")
      .values(datos.asistentes.map((a) => ({ id: a.id, nombre: a.nombre, carne: a.carne, categoria: a.categoria, activo: a.activo })))
      .execute();
    await trx
      .insertInto("asistentes_laboratorios")
      .values(datos.asistentes.flatMap((a) => a.laboratorios.map((id_laboratorio) => ({ id_asistente: a.id, id_laboratorio }))))
      .execute();
    await trx
      .insertInto("topes_asistentes")
      .values(datos.asistentes.flatMap((a) => a.topes.map((t) => ({ id_asistente: a.id, vigente_desde: t.vigenteDesde.aTexto(), minutos_por_semana: t.minutosPorSemana }))))
      .execute();
    await trx
      .insertInto("disponibilidad_asistentes")
      .values(datos.asistentes.flatMap((a) => a.disponibilidad.map((b) => ({ id_asistente: a.id, dia: b.dia, hora_inicio: b.horaInicio, hora_fin: b.horaFin }))))
      .execute();
    await trx.insertInto("semestres").values({ id: "semestre-demo", inicio: datos.semestre.inicio.aTexto(), fin: datos.semestre.fin.aTexto() }).execute();
    for (const v of datos.tarifas) {
      await trx
        .insertInto("vigencias_tarifas")
        .values({ vigente_desde: v.vigenteDesde.aTexto(), vigente_hasta: v.vigenteHasta?.aTexto() ?? null, porcentaje_recargo: v.porcentajeRecargo })
        .execute();
      await trx
        .insertInto("tarifas_por_categoria")
        .values(Object.entries(v.tarifaPorHora).map(([categoria, d]) => ({ vigente_desde: v.vigenteDesde.aTexto(), categoria, centimos_por_hora: d.centimos })))
        .execute();
    }
    await trx
      .insertInto("roles_usuarios")
      .values(Object.entries(datos.roles).flatMap(([id_usuario, roles]) => roles.map((r) => ({ id_usuario, rol: r.rol, id_laboratorio: r.idLaboratorio ?? null }))))
      .execute();
    await trx
      .insertInto("turnos")
      .values(
        datos.turnos.map((t) => ({
          id: t.id,
          id_laboratorio: t.idLaboratorio,
          id_asistente: t.idAsistente,
          inicio: t.franja.inicio.aISO(),
          fin: t.franja.fin.aISO(),
          estado: t.estado,
          creado_por: t.creadoPor,
          clave_solicitud: t.claveSolicitud
        }))
      )
      .execute();
    const marcas = [...datos.marcas].filter(([, m]) => m.entrada !== null);
    if (marcas.length > 0) {
      await trx
        .insertInto("marcas")
        .values(marcas.map(([id_turno, m]) => ({ id_turno, entrada: m.entrada?.aISO() ?? "", salida: m.salida?.aISO() ?? null })))
        .execute();
    }
    await trx
      .insertInto("reservas")
      .values(
        datos.reservas.map((r) => ({
          id: r.id,
          id_estudiante: r.idEstudiante,
          id_maquina: r.idMaquina,
          inicio: r.franja.inicio.aISO(),
          fin: r.franja.fin.aISO(),
          estado: r.estado,
          clave_solicitud: r.claveSolicitud
        }))
      )
      .execute();
    return true;
  });
}
