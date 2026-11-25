// Conexión a PostgreSQL 14 con pg + Kysely (docs/06-restricciones-tecnologicas.md, 6.3).
import { AsyncLocalStorage } from "node:async_hooks";
import { Kysely, PostgresDialect, sql, type Transaction } from "kysely";
import pg from "pg";
import { Instante } from "../../dominio/index.js";
import type { BaseDeDatos } from "./esquema.js";

export interface ConfiguracionPostgres {
  host: string;
  puerto: number;
  baseDeDatos: string;
  usuario: string;
  contrasena: string;
  /** Conexiones simultáneas del pool. */
  maximoDeConexiones?: number;
  /** search_path de cada conexión (las pruebas de integración usan un esquema propio). */
  esquema?: string;
}

const OID_DATE = 1082;
const OID_INT8 = 20;

/** date se lee tal cual ("2026-11-24", sin zona) y bigint como number (los céntimos caben). */
const tipos = {
  getTypeParser(oid: number, formato?: "text" | "binary") {
    if (oid === OID_DATE) return (valor: string) => valor;
    if (oid === OID_INT8) {
      return (valor: string) => {
        const numero = Number(valor);
        if (!Number.isSafeInteger(numero)) throw new Error(`Entero fuera de rango: ${valor}`);
        return numero;
      };
    }
    return pg.types.getTypeParser(oid, formato);
  }
};

export function crearConexion(config: ConfiguracionPostgres): Kysely<BaseDeDatos> {
  if (config.esquema !== undefined && !/^[a-z_][a-z0-9_]{0,62}$/.test(config.esquema)) {
    throw new Error("El nombre del esquema solo admite minúsculas, dígitos y guion bajo.");
  }
  const pool = new pg.Pool({
    host: config.host,
    port: config.puerto,
    database: config.baseDeDatos,
    user: config.usuario,
    password: config.contrasena,
    max: config.maximoDeConexiones ?? 10,
    connectionTimeoutMillis: 5000,
    types: tipos,
    ...(config.esquema ? { options: `-c search_path=${config.esquema},public` } : {})
  });
  // Si la base cierra una conexión inactiva (reinicio, caída), pg emite "error" en el pool; sin este
  // oyente Node terminaría el proceso. La conexión se descarta y /health responde 503 mientras tanto.
  pool.on("error", (error) => {
    process.emitWarning(`Conexión inactiva con PostgreSQL perdida: ${error.message}`);
  });
  return new Kysely<BaseDeDatos>({ dialect: new PostgresDialect({ pool }) });
}

/** Instante del dominio desde un timestamptz leído por pg. */
export const instanteDe = (fecha: Date): Instante => Instante.desdeISO(fecha.toISOString());

/** Hora "HH:MM" desde un time de PostgreSQL ("07:00:00", "24:00:00"). */
export const horaDe = (valor: string): string => valor.slice(0, 5);

/** Restricción de la base que rechazó una escritura: 23P01 = EXCLUDE, 23505 = UNIQUE. */
export function restriccionViolada(error: unknown): { codigo: "23P01" | "23505"; restriccion: string } | null {
  if (typeof error !== "object" || error === null) return null;
  const { code, constraint } = error as { code?: string; constraint?: string };
  if ((code === "23P01" || code === "23505") && constraint) return { codigo: code, restriccion: constraint };
  return null;
}

/**
 * Adaptador del puerto UnidadDeTrabajo (8.3) sobre transacciones de PostgreSQL. La transacción en
 * curso viaja en AsyncLocalStorage, igual que en la versión en memoria, y los repositorios la toman
 * con ejecutor(). Una llamada anidada se une a la transacción que ya existe.
 */
export class UnidadDeTrabajoPostgres {
  readonly #db: Kysely<BaseDeDatos>;
  readonly #contexto = new AsyncLocalStorage<Transaction<BaseDeDatos>>();
  #puntos = 0;

  constructor(db: Kysely<BaseDeDatos>) {
    this.#db = db;
  }

  async ejecutar<T>(trabajo: () => Promise<T>): Promise<T> {
    if (this.#contexto.getStore()) return trabajo();
    return this.#db.transaction().execute((trx) => this.#contexto.run(trx, trabajo));
  }

  /** La transacción en curso o, fuera de una, la conexión normal (para consultas). */
  ejecutor(): Kysely<BaseDeDatos> {
    return this.#contexto.getStore() ?? this.#db;
  }

  /** La transacción en curso; para lo que solo tiene sentido dentro de una (FOR UPDATE). */
  transaccion(): Transaction<BaseDeDatos> {
    const trx = this.#contexto.getStore();
    if (!trx) throw new Error("La operación debe ejecutarse dentro de UnidadDeTrabajo.ejecutar().");
    return trx;
  }

  /**
   * Escritura que puede chocar con una restricción. Dentro de una transacción usa un SAVEPOINT:
   * si falla, la transacción sigue viva para consultar el registro en conflicto y armar el error
   * de dominio. Fuera de una transacción, abre la suya (todo o nada).
   */
  async protegido<T>(trabajo: (db: Kysely<BaseDeDatos>) => Promise<T>): Promise<T> {
    const trx = this.#contexto.getStore();
    if (!trx) return this.#db.transaction().execute((nueva) => this.#contexto.run(nueva, () => trabajo(nueva)));
    this.#puntos += 1;
    const punto = sql.id(`punto_${this.#puntos}`);
    await sql`SAVEPOINT ${punto}`.execute(trx);
    try {
      const resultado = await trabajo(trx);
      await sql`RELEASE SAVEPOINT ${punto}`.execute(trx);
      return resultado;
    } catch (error) {
      await sql`ROLLBACK TO SAVEPOINT ${punto}`.execute(trx);
      throw error;
    }
  }
}

/** Date para comparar un instante del dominio contra una columna timestamptz en un WHERE. */
export const fechaDe = (instante: Instante): Date => new Date(instante.aISO());
