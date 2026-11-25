import { Dinero, Fecha } from "../../../compartido/dominio/index.js";
import { instanteDe, restriccionViolada, type UnidadDeTrabajoPostgres } from "../../../compartido/infraestructura/postgres/conexion.js";
import { CierreYaExiste } from "../aplicacion/errores.js";
import type { RepositorioCierres, TablaTarifas } from "../aplicacion/puertos.js";
import { CierreMensual } from "../dominio/cierre-mensual.js";
import { LineaDeLiquidacion, type MotivoNoPagado } from "../dominio/linea-de-liquidacion.js";
import { MesDeLiquidacion } from "../dominio/mes-de-liquidacion.js";
import type { VigenciaDeTarifas } from "../dominio/tarifas-del-periodo.js";

/**
 * RepositorioCierres sobre PostgreSQL. guardar escribe el cierre, sus tarifas aplicadas, sus líneas
 * y sus horas no pagadas en una sola transacción (garantía mínima de CU-14); la llave primaria
 * (anio, mes) de V5__cierres.sql rechaza un segundo cierre del mes, que se traduce a CierreYaExiste.
 */
export class RepositorioCierresPostgres implements RepositorioCierres {
  readonly #unidad: UnidadDeTrabajoPostgres;

  constructor(unidad: UnidadDeTrabajoPostgres) {
    this.#unidad = unidad;
  }

  async porMes(mes: MesDeLiquidacion): Promise<CierreMensual | null> {
    const db = this.#unidad.ejecutor();
    const cierre = await db.selectFrom("cierres").selectAll().where("anio", "=", mes.anio).where("mes", "=", mes.mes).executeTakeFirst();
    if (!cierre) return null;
    const [tarifas, lineas, noPagados] = await Promise.all([
      db.selectFrom("tarifas_aplicadas").selectAll().where("anio", "=", mes.anio).where("mes", "=", mes.mes).orderBy("vigente_desde").execute(),
      db.selectFrom("lineas_liquidacion").selectAll().where("anio", "=", mes.anio).where("mes", "=", mes.mes).orderBy("carne").execute(),
      db.selectFrom("horas_no_pagadas").selectAll().where("anio", "=", mes.anio).where("mes", "=", mes.mes).orderBy("semana").orderBy("motivo").execute()
    ]);
    return CierreMensual.reconstituir({
      mes,
      fechaDeCierre: instanteDe(cierre.fecha_de_cierre),
      tarifasAplicadas: tarifas.map((t) => ({
        vigenteDesde: Fecha.desdeTexto(t.vigente_desde),
        vigenteHasta: t.vigente_hasta ? Fecha.desdeTexto(t.vigente_hasta) : null,
        tarifaPorHora: Object.fromEntries(Object.entries(t.tarifa_por_hora).map(([categoria, c]) => [categoria, Dinero.deCentimos(c)])),
        porcentajeRecargo: t.porcentaje_recargo
      })),
      lineas: lineas.map((l) =>
        LineaDeLiquidacion.de({
          idAsistente: l.id_asistente,
          carne: l.carne,
          nombre: l.nombre,
          categoria: l.categoria,
          minutosNormales: l.minutos_normales,
          minutosConRecargo: l.minutos_con_recargo,
          monto: Dinero.deCentimos(l.monto_centimos),
          noPagados: noPagados
            .filter((n) => n.id_asistente === l.id_asistente)
            .map((n) => ({ semana: n.semana, motivo: n.motivo as MotivoNoPagado, minutos: n.minutos }))
        })
      ),
      archivo: { nombre: cierre.archivo_nombre, tipo: "text/csv", contenido: cierre.archivo_contenido }
    });
  }

  async delAnio(anio: number): Promise<CierreMensual[]> {
    const meses = await this.#unidad.ejecutor().selectFrom("cierres").select("mes").where("anio", "=", anio).orderBy("mes").execute();
    const cierres = await Promise.all(meses.map((m) => this.porMes(MesDeLiquidacion.de(anio, m.mes))));
    return cierres.filter((c): c is CierreMensual => c !== null);
  }

  async guardar(cierre: CierreMensual): Promise<void> {
    const { archivo } = cierre;
    if (!archivo) throw new Error("Un cierre se guarda con su archivo para Becas (P6).");
    const { anio, mes } = cierre.mes;
    try {
      await this.#unidad.protegido(async (db) => {
        await db
          .insertInto("cierres")
          .values({ anio, mes, fecha_de_cierre: cierre.fechaDeCierre.aISO(), archivo_nombre: archivo.nombre, archivo_contenido: archivo.contenido })
          .execute();
        if (cierre.tarifasAplicadas.length > 0) {
          await db
            .insertInto("tarifas_aplicadas")
            .values(
              cierre.tarifasAplicadas.map((t) => ({
                anio,
                mes,
                vigente_desde: t.vigenteDesde.aTexto(),
                vigente_hasta: t.vigenteHasta?.aTexto() ?? null,
                tarifa_por_hora: JSON.stringify(Object.fromEntries(Object.entries(t.tarifaPorHora).map(([categoria, d]) => [categoria, d.centimos]))),
                porcentaje_recargo: t.porcentajeRecargo
              }))
            )
            .execute();
        }
        if (cierre.lineas.length > 0) {
          await db
            .insertInto("lineas_liquidacion")
            .values(
              cierre.lineas.map((l) => ({
                anio,
                mes,
                id_asistente: l.idAsistente,
                carne: l.carne,
                nombre: l.nombre,
                categoria: l.categoria,
                minutos_normales: l.minutosNormales,
                minutos_con_recargo: l.minutosConRecargo,
                monto_centimos: l.monto.centimos
              }))
            )
            .execute();
        }
        const noPagados = cierre.lineas.flatMap((l) => l.noPagados.map((n) => ({ anio, mes, id_asistente: l.idAsistente, ...n })));
        if (noPagados.length > 0) await db.insertInto("horas_no_pagadas").values(noPagados).execute();
      });
    } catch (error) {
      if (restriccionViolada(error)?.restriccion === "cierres_un_cierre_por_mes") throw new CierreYaExiste(cierre.mes.clave);
      throw error;
    }
  }
}

/** TablaTarifas sobre PostgreSQL (contrato en 8.6): vigencias que tocan el periodo, ordenadas. */
export class TablaTarifasPostgres implements TablaTarifas {
  readonly #unidad: UnidadDeTrabajoPostgres;

  constructor(unidad: UnidadDeTrabajoPostgres) {
    this.#unidad = unidad;
  }

  async vigenciasEntre(desde: Fecha, hasta: Fecha): Promise<VigenciaDeTarifas[]> {
    const db = this.#unidad.ejecutor();
    const vigencias = await db
      .selectFrom("vigencias_tarifas")
      .selectAll()
      .where("vigente_desde", "<=", hasta.aTexto())
      .where((eb) => eb.or([eb("vigente_hasta", "is", null), eb("vigente_hasta", ">=", desde.aTexto())]))
      .orderBy("vigente_desde")
      .execute();
    if (vigencias.length === 0) return [];
    const tarifas = await db
      .selectFrom("tarifas_por_categoria")
      .selectAll()
      .where(
        "vigente_desde",
        "in",
        vigencias.map((v) => v.vigente_desde)
      )
      .execute();
    return vigencias.map((v) => ({
      vigenteDesde: Fecha.desdeTexto(v.vigente_desde),
      vigenteHasta: v.vigente_hasta ? Fecha.desdeTexto(v.vigente_hasta) : null,
      porcentajeRecargo: v.porcentaje_recargo,
      tarifaPorHora: Object.fromEntries(
        tarifas.filter((t) => t.vigente_desde === v.vigente_desde).map((t) => [t.categoria, Dinero.deCentimos(t.centimos_por_hora)])
      )
    }));
  }
}
