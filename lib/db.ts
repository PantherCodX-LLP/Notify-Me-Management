import mysql from "mysql2/promise";

/**
 * Singleton read-only MySQL connection pool, tuned for long-running (24x7) use.
 *
 * - keepAlive pings idle sockets so AWS RDS / NAT idle timeouts don't silently
 *   drop connections.
 * - query() retries once on transient connection errors (the dropped socket is
 *   discarded and a fresh pooled connection is used).
 * - Only SELECT / SHOW / information_schema queries are ever issued; the DB user
 *   is read-only and there is no write path in the codebase.
 */
let pool: mysql.Pool | null = null;

export function getPool(): mysql.Pool {
  if (!pool) {
    const useSsl = (process.env.DB_SSL ?? "true").toLowerCase() !== "false";
    pool = mysql.createPool({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT || 3306),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME || undefined,
      waitForConnections: true,
      connectionLimit: Number(process.env.DB_POOL_SIZE || 8),
      maxIdle: Number(process.env.DB_POOL_SIZE || 8),
      idleTimeout: 60_000,
      connectTimeout: 20_000,
      enableKeepAlive: true,
      keepAliveInitialDelay: 10_000,
      timezone: "Z",
      dateStrings: true,
      ssl: useSsl ? { rejectUnauthorized: false } : undefined,
    });
  }
  return pool;
}

const TRANSIENT = new Set([
  "PROTOCOL_CONNECTION_LOST",
  "ECONNRESET",
  "ETIMEDOUT",
  "EPIPE",
  "ECONNREFUSED",
  "ER_LOCK_WAIT_TIMEOUT",
  "PROTOCOL_SEQUENCE_TIMEOUT",
]);

function isTransient(err: any): boolean {
  return !!err && (TRANSIENT.has(err.code) || /closed state|read ECONN|socket/i.test(err.message || ""));
}

export async function query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  try {
    const [rows] = await getPool().query(sql, params);
    return rows as T[];
  } catch (err: any) {
    if (isTransient(err)) {
      // brief backoff then one retry on a fresh pooled connection
      await new Promise((r) => setTimeout(r, 250));
      const [rows] = await getPool().query(sql, params);
      return rows as T[];
    }
    throw err;
  }
}

export async function queryOne<T = any>(sql: string, params: any[] = []): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows.length ? rows[0] : null;
}

export function quoteId(id: string): string {
  return "`" + String(id).replace(/`/g, "``") + "`";
}

export function qualified(db: string, table: string): string {
  return `${quoteId(db)}.${quoteId(table)}`;
}
