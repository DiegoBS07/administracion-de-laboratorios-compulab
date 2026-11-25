// Repositorios PostgreSQL contra una base real (ADR-0009, ADR-0010). Comprueban que FOR UPDATE, las
// restricciones EXCLUDE y UNIQUE y las transacciones hacen lo que los dobles en memoria imitan.
// Se saltan si no existe APP_DB_PRUEBAS (ver base-de-pruebas.ts).
import type { Kysely } from "kysely";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Dinero, Fecha, Franja, Hora, Instante, Semana } from "../../src/compartido/dominio/index.js";
import { crearConexion, UnidadDeTrabajoPostgres } from "../../src/compartido/infraestructura/postgres/conexion.js";
import type { BaseDeDatos } from "../../src/compartido/infraestructura/postgres/esquema.js";
import {
  ClaveDeSolicitudReutilizada as ClaveDeTurnoReutilizada,
  FranjaOcupadaEnLaboratorio,
  RepositorioTurnosPostgres,
  TraslapeDeTurno,
  Turno,
  type EstadoTurno
} from "../../src/modulos/horarios/index.js";
import { GeneradorDeIdsAleatorio } from "../../src/compartido/infraestructura/generador-de-ids-aleatorio.js";
import { RepositorioRolesPostgres, RepositorioSesionesPostgres, Sesion } from "../../src/modulos/identidad/index.js";
import {
  CerrarMes,
  CierreMensual,
  CierreYaExiste,
  GeneradorArchivoBecasCsv,
  LineaDeLiquidacion,
  MesDeLiquidacion,
  RepositorioCierresPostgres,
  TablaTarifasPostgres
} from "../../src/modulos/liquidacion/index.js";
import {
  MaquinaNoDisponible,
  RepositorioMaquinasPostgres,
  RepositorioReservasPostgres,
  Reserva,
  YaTieneReservaActiva
} from "../../src/modulos/reservas/index.js";
import { NotificadorEnMemoria } from "../dobles/notificador-en-memoria.js";
import { RelojFijo } from "../dobles/reloj-fijo.js";
import { DatosDeAsistentesEnMemoria, HorasTrabajadasEnMemoria, turno as registro } from "../modulos/liquidacion/dobles.js";
import { crearEsquemaDePrueba, type EsquemaDePrueba, URL_DE_PRUEBAS } from "./base-de-pruebas.js";

const franja = (fecha: string, inicio: string, fin: string) => Franja.delDia(Fecha.desdeTexto(fecha), Hora.desdeTexto(inicio), Hora.desdeTexto(fin));
const turno = (id: string, idLaboratorio: string, idAsistente: string | null, f: Franja, estado: EstadoTurno = "ASIGNADO", clave: string | null = null) =>
  Turno.reconstituir({ id, idLaboratorio, idAsistente, franja: f, estado, creadoPor: clave ? "coord" : null, claveSolicitud: clave });
const reserva = (id: string, idEstudiante: string, idMaquina: string, f: Franja, clave: string | null = null) =>
  Reserva.reconstituir({ id, idEstudiante, idMaquina, franja: f, estado: "ACTIVA", claveSolicitud: clave });
const esperar = (ms: number) => new Promise((resolver) => setTimeout(resolver, ms));

async function errorDe<E extends Error>(promesa: Promise<unknown>, tipo: abstract new (...args: never[]) => E): Promise<E> {
  const resultado = await promesa.then(
    () => null,
    (error: unknown) => error
  );
  expect(resultado).toBeInstanceOf(tipo);
  return resultado as E;
}

describe.skipIf(!URL_DE_PRUEBAS)("repositorios PostgreSQL", () => {
  let esquema: EsquemaDePrueba;
  let db: Kysely<BaseDeDatos>;
  let unidad: UnidadDeTrabajoPostgres;

  beforeAll(async () => {
    esquema = await crearEsquemaDePrueba();
  });

  afterAll(async () => {
    await esquema?.eliminar();
  });

  beforeEach(async () => {
    await esquema.vaciar();
    db = crearConexion(esquema.conexion);
    unidad = new UnidadDeTrabajoPostgres(db);
    await db.insertInto("laboratorios").values([{ id: "c1", nombre: "Lab 1", campus: "Cartago" }, { id: "c2", nombre: "Lab 2", campus: "Cartago" }]).execute();
    await db
      .insertInto("asistentes")
      .values([
        { id: "a1", nombre: "Diego", carne: "1", categoria: "B", activo: true },
        { id: "a2", nombre: "María", carne: "2", categoria: "A", activo: true }
      ])
      .execute();
    await db
      .insertInto("maquinas")
      .values([
        { id: "m1", id_laboratorio: "c1", codigo: "C1-01", en_servicio: true },
        { id: "m2", id_laboratorio: "c1", codigo: "C1-02", en_servicio: false }
      ])
      .execute();
  });

  afterEach(async () => {
    await db.destroy();
  });

  describe("RepositorioTurnosPostgres", () => {
    const repo = () => new RepositorioTurnosPostgres(unidad);

    it("guarda y lee un turno con sus mismos datos", async () => {
      const original = turno("t1", "c1", "a1", franja("2026-11-25", "07:00", "24:00"), "PENDIENTE_ACEPTACION", "clave-1");
      await unidad.ejecutar(() => repo().guardar(original));

      const [leido] = await repo().delLaboratorioEntre("c1", franja("2026-11-25", "00:00", "24:00"));
      expect(leido?.franja.esIgualA(original.franja)).toBe(true);
      expect([leido?.estado, leido?.idAsistente, leido?.claveSolicitud]).toEqual(["PENDIENTE_ACEPTACION", "a1", "clave-1"]);
      expect((await repo().porClaveDeSolicitud("coord", "clave-1"))?.id).toBe("t1");
      expect(await repo().delPeriodo(franja("2026-11-26", "00:00", "24:00"))).toEqual([]);
    });

    it("la restricción EXCLUDE por asistente se traduce a TraslapeDeTurno con el turno en conflicto", async () => {
      await unidad.ejecutar(() => repo().guardar(turno("t1", "c1", "a1", franja("2026-11-25", "07:00", "11:00"))));

      const error = await errorDe(unidad.ejecutar(() => repo().guardar(turno("t2", "c2", "a1", franja("2026-11-25", "10:00", "12:00")))), TraslapeDeTurno);

      expect(error.detalle).toMatchObject({ conflicto: { idTurno: "t1", idAsistente: "a1" } });
    });

    it("la restricción EXCLUDE por laboratorio se traduce a FranjaOcupadaEnLaboratorio", async () => {
      await unidad.ejecutar(() => repo().guardar(turno("t1", "c1", "a1", franja("2026-11-25", "07:00", "11:00"))));

      await errorDe(unidad.ejecutar(() => repo().guardar(turno("t2", "c1", "a2", franja("2026-11-25", "10:00", "12:00")))), FranjaOcupadaEnLaboratorio);
    });

    it("los turnos contiguos, vacantes o descartados no chocan", async () => {
      await unidad.ejecutar(async () => {
        await repo().guardar(turno("t1", "c1", "a1", franja("2026-11-25", "07:00", "11:00")));
        await repo().guardar(turno("t2", "c1", "a1", franja("2026-11-25", "11:00", "13:00")));
        await repo().guardar(turno("t3", "c1", null, franja("2026-11-25", "07:00", "11:00"), "VACANTE"));
        await repo().guardar(turno("t4", "c1", "a2", franja("2026-11-25", "07:00", "11:00"), "DESCARTADO"));
      });

      expect(await repo().delPeriodo(franja("2026-11-25", "00:00", "24:00"))).toHaveLength(4);
    });

    it("una clave de solicitud repetida se traduce a ClaveDeSolicitudReutilizada", async () => {
      await unidad.ejecutar(() => repo().guardar(turno("t1", "c1", "a1", franja("2026-11-25", "07:00", "11:00"), "ASIGNADO", "k")));

      await errorDe(unidad.ejecutar(() => repo().guardar(turno("t2", "c2", "a2", franja("2026-11-26", "07:00", "11:00"), "ASIGNADO", "k"))), ClaveDeTurnoReutilizada);
    });

    it("todo o nada: si el trabajo falla después de guardar, no queda nada", async () => {
      await expect(
        unidad.ejecutar(async () => {
          await repo().guardar(turno("t1", "c1", "a1", franja("2026-11-25", "07:00", "11:00")));
          throw new Error("falla después de guardar");
        })
      ).rejects.toThrow("falla después de guardar");

      expect(await repo().delPeriodo(franja("2026-11-25", "00:00", "24:00"))).toEqual([]);
    });

    it("tras un choque la transacción sigue viva gracias al SAVEPOINT", async () => {
      await unidad.ejecutar(() => repo().guardar(turno("t1", "c1", "a1", franja("2026-11-25", "07:00", "11:00"))));

      await unidad.ejecutar(async () => {
        await expect(repo().guardar(turno("t2", "c1", "a2", franja("2026-11-25", "08:00", "09:00")))).rejects.toBeInstanceOf(FranjaOcupadaEnLaboratorio);
        await repo().guardar(turno("t3", "c2", "a2", franja("2026-11-25", "08:00", "09:00")));
      });

      expect((await repo().delPeriodo(franja("2026-11-25", "00:00", "24:00"))).map((t) => t.id)).toEqual(["t1", "t3"]);
    });

    it("bloquearAgendaDe serializa dos transacciones del mismo asistente (ADR-0009)", async () => {
      const visto: number[] = [];
      const primera = unidad.ejecutar(async () => {
        await repo().bloquearAgendaDe("a1");
        await esperar(150);
        await repo().guardar(turno("t1", "c1", "a1", franja("2026-11-25", "07:00", "11:00")));
      });
      await esperar(30);
      const segunda = unidad.ejecutar(async () => {
        await repo().bloquearAgendaDe("a1");
        visto.push((await repo().delAsistenteEntre("a1", Semana.deLaFecha(Fecha.desdeTexto("2026-11-25")).franja())).length);
      });

      await Promise.all([primera, segunda]);

      expect(visto).toEqual([1]); // la segunda esperó y vio el turno de la primera
    });
  });

  describe("RepositorioReservasPostgres", () => {
    const repo = () => new RepositorioReservasPostgres(unidad);

    it("guarda y consulta reservas por clave, por activa, por semana y por máquina", async () => {
      await unidad.ejecutar(() => repo().guardar(reserva("r1", "ana", "m1", franja("2026-11-25", "08:00", "10:00"), "k1")));

      expect((await repo().porClaveDeSolicitud("ana", "k1"))?.id).toBe("r1");
      expect((await repo().activaDelEstudiante("ana"))?.id).toBe("r1");
      expect(await repo().delEstudianteEnSemana("ana", Semana.deLaFecha(Fecha.desdeTexto("2026-11-25")))).toHaveLength(1);
      expect(await repo().deMaquinaEntre("m1", franja("2026-11-25", "09:00", "11:00"))).toHaveLength(1);
      expect(await repo().deMaquinaEntre("m1", franja("2026-11-25", "10:00", "11:00"))).toHaveLength(0);
    });

    it("las restricciones se traducen a MaquinaNoDisponible y YaTieneReservaActiva", async () => {
      await unidad.ejecutar(() => repo().guardar(reserva("r1", "ana", "m1", franja("2026-11-25", "08:00", "10:00"))));

      await errorDe(unidad.ejecutar(() => repo().guardar(reserva("r2", "luis", "m1", franja("2026-11-25", "09:00", "10:00")))), MaquinaNoDisponible);
      const error = await errorDe(unidad.ejecutar(() => repo().guardar(reserva("r3", "ana", "m2", franja("2026-11-26", "08:00", "09:00")))), YaTieneReservaActiva);
      expect(error.detalle).toMatchObject({ idReservaActiva: "r1" });
    });

    it("dos reservas simultáneas de la misma máquina: una gana y la otra recibe MaquinaNoDisponible (ext 7a)", async () => {
      const intento = (id: string, estudiante: string) =>
        unidad.ejecutar(async () => {
          await esperar(20);
          await repo().guardar(reserva(id, estudiante, "m1", franja("2026-11-25", "08:00", "10:00")));
        });

      const resultados = await Promise.allSettled([intento("r1", "ana"), intento("r2", "luis")]);

      expect(resultados.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      expect(resultados.find((r) => r.status === "rejected")?.reason).toBeInstanceOf(MaquinaNoDisponible);
    });

    it("RepositorioMaquinasPostgres lee el estado de servicio", async () => {
      const maquinas = new RepositorioMaquinasPostgres(unidad);

      expect((await maquinas.delLaboratorio("c1")).map((m) => [m.codigo, m.enServicio])).toEqual([["C1-01", true], ["C1-02", false]]);
      expect(await maquinas.porId("nada")).toBeNull();
    });
  });

  describe("RepositorioCierresPostgres y TablaTarifasPostgres", () => {
    const octubre = MesDeLiquidacion.de(2026, 10);
    const cierre = () =>
      CierreMensual.cerrar({
        mes: octubre,
        fechaDeCierre: Instante.desdeISO("2026-11-01T00:05:00-06:00"),
        tarifasAplicadas: [{ vigenteDesde: Fecha.desdeTexto("2026-07-01"), vigenteHasta: null, tarifaPorHora: { A: Dinero.deCentimos(215000) }, porcentajeRecargo: 25 }],
        lineas: [
          LineaDeLiquidacion.de({
            idAsistente: "a2",
            carne: "2",
            nombre: "María",
            categoria: "A",
            minutosNormales: 600,
            minutosConRecargo: 0,
            noPagados: [{ semana: "2026-10-12", motivo: "SOBRE_TOPE", minutos: 120 }],
            monto: Dinero.deCentimos(2_150_000)
          })
        ]
      }).adjuntarArchivo({ nombre: "becas-2026-10.csv", tipo: "text/csv", contenido: "mes,carne\r\n" });

    it("guarda y reconstruye el cierre completo", async () => {
      const cierres = new RepositorioCierresPostgres(unidad);
      await cierres.guardar(cierre());

      const leido = await cierres.porMes(octubre);

      expect(leido?.total.centimos).toBe(2_150_000);
      expect(leido?.lineas[0]?.noPagados).toEqual([{ semana: "2026-10-12", motivo: "SOBRE_TOPE", minutos: 120 }]);
      expect(leido?.tarifasAplicadas[0]?.tarifaPorHora["A"]?.centimos).toBe(215000);
      expect(leido?.archivo?.nombre).toBe("becas-2026-10.csv");
      expect(leido?.fechaDeCierre.aISO()).toBe("2026-11-01T00:05:00-06:00");
      expect((await cierres.delAnio(2026)).map((c) => c.id)).toEqual(["cierre-2026-10"]);
    });

    it("un segundo cierre del mes se traduce a CierreYaExiste y no deja nada a medias", async () => {
      const cierres = new RepositorioCierresPostgres(unidad);
      await cierres.guardar(cierre());

      await errorDe(cierres.guardar(cierre()), CierreYaExiste);
      expect((await db.selectFrom("lineas_liquidacion").selectAll().execute()).length).toBe(1);
    });

    it("dos CerrarMes simultáneos producen un solo cierre con la restricción real (ext 2c)", async () => {
      await db.insertInto("vigencias_tarifas").values({ vigente_desde: "2026-07-01", vigente_hasta: null, porcentaje_recargo: 25 }).execute();
      await db.insertInto("tarifas_por_categoria").values({ vigente_desde: "2026-07-01", categoria: "A", centimos_por_hora: 215000 }).execute();
      const cerrar = () =>
        new CerrarMes({
          cierres: new RepositorioCierresPostgres(unidad),
          horas: new HorasTrabajadasEnMemoria([registro("t1", "a2", "2026-10-05", "08:00", "12:00")]),
          asistentes: new DatosDeAsistentesEnMemoria({ a2: { carne: "2", nombre: "María", categoria: "A", topes: [{ minutosPorSemana: 600, vigenteDesde: Fecha.desdeTexto("2026-01-01") }] } }),
          tarifas: new TablaTarifasPostgres(unidad),
          generador: new GeneradorArchivoBecasCsv(),
          notificador: new NotificadorEnMemoria(),
          reloj: new RelojFijo("2026-11-01T00:05:00-06:00")
        }).ejecutar(2026, 10);

      const resultados = await Promise.all([cerrar(), cerrar()]);

      expect(resultados.map((r) => r.creado).sort()).toEqual([false, true]);
      expect(resultados[0]?.cierre).toEqual(resultados[1]?.cierre);
      expect(resultados[0]?.cierre.totalCentimos).toBe(860_000);
    });

    it("TablaTarifasPostgres devuelve solo las vigencias que tocan el periodo", async () => {
      await db
        .insertInto("vigencias_tarifas")
        .values([
          { vigente_desde: "2026-01-01", vigente_hasta: "2026-06-30", porcentaje_recargo: 20 },
          { vigente_desde: "2026-07-01", vigente_hasta: null, porcentaje_recargo: 25 }
        ])
        .execute();
      await db
        .insertInto("tarifas_por_categoria")
        .values([
          { vigente_desde: "2026-01-01", categoria: "A", centimos_por_hora: 200000 },
          { vigente_desde: "2026-07-01", categoria: "A", centimos_por_hora: 215000 },
          { vigente_desde: "2026-07-01", categoria: "B", centimos_por_hora: 260000 }
        ])
        .execute();

      const vigencias = await new TablaTarifasPostgres(unidad).vigenciasEntre(Fecha.desdeTexto("2026-10-01"), Fecha.desdeTexto("2026-10-31"));

      expect(vigencias.map((v) => [v.vigenteDesde.aTexto(), v.porcentajeRecargo, Object.keys(v.tarifaPorHora).sort()])).toEqual([["2026-07-01", 25, ["A", "B"]]]);
    });
  });

  describe("identidad", () => {
    it("guarda la sesión por la huella del token y lee los roles", async () => {
      await db.insertInto("roles_usuarios").values({ id_usuario: "coord", rol: "COORDINADOR_LABORATORIO", id_laboratorio: "c1" }).execute();
      const sesiones = new RepositorioSesionesPostgres(unidad);
      const token = new GeneradorDeIdsAleatorio("x").nuevo().padEnd(43, "x");
      const roles = await new RepositorioRolesPostgres(unidad).de("coord");

      await sesiones.guardar(Sesion.iniciar({ token, idUsuario: "coord", nombre: "Marta", roles, ahora: Instante.desdeISO("2026-11-24T08:00:00-06:00") }));

      expect(roles).toEqual([{ rol: "COORDINADOR_LABORATORIO", idLaboratorio: "c1" }]);
      expect((await sesiones.porToken(token))?.venceEn.aISO()).toBe("2026-11-24T16:00:00-06:00");
      expect((await db.selectFrom("sesiones").select("huella_token").executeTakeFirst())?.huella_token).not.toContain(token.slice(0, 10));
      await sesiones.eliminar(token);
      expect(await sesiones.porToken(token)).toBeNull();
    });
  });
});
