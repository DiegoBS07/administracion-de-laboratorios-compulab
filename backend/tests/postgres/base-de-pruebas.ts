// Base de datos para las pruebas de integración con PostgreSQL. Son opcionales: solo corren si
// existe APP_DB_PRUEBAS (por ejemplo postgres://usuario:clave@127.0.0.1:5432/compulab_db). Cada
// archivo de pruebas crea su propio esquema, le aplica las migraciones de database/migrations/ en
// orden (como Flyway) y lo borra al terminar, así que nunca toca los datos del esquema public.
import { randomBytes } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import type { ConfiguracionPostgres } from "../../src/compartido/infraestructura/postgres/conexion.js";

export const URL_DE_PRUEBAS = process.env["APP_DB_PRUEBAS"]?.trim() || null;

const MIGRACIONES = resolve(dirname(fileURLToPath(import.meta.url)), "../../../database/migrations");

const TABLAS = [
  "avisos", "sesiones", "horas_no_pagadas", "lineas_liquidacion", "tarifas_aplicadas", "cierres",
  "reservas", "marcas", "turnos", "roles_usuarios", "tarifas_por_categoria", "vigencias_tarifas",
  "semestres", "disponibilidad_asistentes", "topes_asistentes", "asistentes_laboratorios",
  "asistentes", "maquinas", "laboratorios"
];

export interface EsquemaDePrueba {
  conexion: ConfiguracionPostgres;
  /** Vacía todas las tablas (entre pruebas). */
  vaciar(): Promise<void>;
  /** Borra el esquema (al terminar el archivo). */
  eliminar(): Promise<void>;
}

function configuracion(url: string, esquema: string): ConfiguracionPostgres {
  const u = new URL(url);
  return {
    host: u.hostname,
    puerto: Number(u.port || 5432),
    baseDeDatos: decodeURIComponent(u.pathname.slice(1)),
    usuario: decodeURIComponent(u.username),
    contrasena: decodeURIComponent(u.password),
    maximoDeConexiones: 5,
    esquema
  };
}

export async function crearEsquemaDePrueba(): Promise<EsquemaDePrueba> {
  if (!URL_DE_PRUEBAS) throw new Error("Falta APP_DB_PRUEBAS.");
  const esquema = `prueba_${randomBytes(6).toString("hex")}`;
  const conexion = configuracion(URL_DE_PRUEBAS, esquema);
  const cliente = new pg.Client({
    host: conexion.host,
    port: conexion.puerto,
    database: conexion.baseDeDatos,
    user: conexion.usuario,
    password: conexion.contrasena
  });
  await cliente.connect();
  await cliente.query(`CREATE SCHEMA ${esquema}`);
  await cliente.query(`SET search_path TO ${esquema}, public`);
  const archivos = (await readdir(MIGRACIONES)).filter((a) => /^V\d+__.+\.sql$/.test(a)).sort((a, b) => Number(a.slice(1).split("__")[0]) - Number(b.slice(1).split("__")[0]));
  for (const archivo of archivos) {
    await cliente.query(await readFile(join(MIGRACIONES, archivo), "utf8"));
  }
  return {
    conexion,
    vaciar: async () => {
      await cliente.query(`TRUNCATE ${TABLAS.map((t) => `${esquema}.${t}`).join(", ")} RESTART IDENTITY CASCADE`);
    },
    eliminar: async () => {
      await cliente.query(`DROP SCHEMA ${esquema} CASCADE`);
      await cliente.end();
    }
  };
}
