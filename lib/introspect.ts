import { query } from "./db";

const SYSTEM_SCHEMAS = [
  "mysql",
  "information_schema",
  "performance_schema",
  "sys",
];

export interface ColumnInfo {
  name: string;
  dataType: string; // e.g. "varchar", "int", "datetime"
  columnType: string; // e.g. "varchar(255)"
  nullable: boolean;
  key: string; // "PRI" | "MUL" | "UNI" | ""
  comment: string;
}

export interface TableInfo {
  name: string;
  columns: ColumnInfo[];
  rowEstimate: number; // from information_schema (approximate for InnoDB)
  comment: string;
}

/** All non-system schemas available to the connected user. */
export async function listDatabases(): Promise<string[]> {
  const rows = await query<{ s: string }>(
    `SELECT SCHEMA_NAME AS s
       FROM information_schema.SCHEMATA
      WHERE SCHEMA_NAME NOT IN (?, ?, ?, ?)
      ORDER BY SCHEMA_NAME`,
    SYSTEM_SCHEMAS
  );
  return rows.map((r) => r.s);
}

/** The database to operate on: env override, else first non-system schema. */
export async function getDatabaseName(): Promise<string> {
  const fromEnv = process.env.DB_NAME && process.env.DB_NAME.trim();
  if (fromEnv) return fromEnv;
  const dbs = await listDatabases();
  if (!dbs.length) {
    throw new Error(
      "No user database found on the server. Set DB_NAME in .env.local."
    );
  }
  return dbs[0];
}

/** Full table + column inventory for a schema (base tables only). */
export async function getTables(db: string): Promise<TableInfo[]> {
  const tableRows = await query<{ tn: string; tr: number | null; tc: string | null }>(
    `SELECT TABLE_NAME AS tn, TABLE_ROWS AS tr, TABLE_COMMENT AS tc
       FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE'
      ORDER BY TABLE_NAME`,
    [db]
  );

  const colRows = await query<{
    tn: string;
    cn: string;
    dt: string;
    ct: string;
    isn: string;
    ck: string;
    cc: string;
  }>(
    `SELECT TABLE_NAME AS tn, COLUMN_NAME AS cn, DATA_TYPE AS dt,
            COLUMN_TYPE AS ct, IS_NULLABLE AS isn, COLUMN_KEY AS ck,
            COLUMN_COMMENT AS cc
       FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = ?
      ORDER BY TABLE_NAME, ORDINAL_POSITION`,
    [db]
  );

  const byTable = new Map<string, TableInfo>();
  for (const t of tableRows) {
    byTable.set(t.tn, {
      name: t.tn,
      columns: [],
      rowEstimate: Number(t.tr) || 0,
      comment: t.tc || "",
    });
  }
  for (const c of colRows) {
    const t = byTable.get(c.tn);
    if (!t) continue; // skip columns of views / non-base tables
    t.columns.push({
      name: c.cn,
      dataType: c.dt,
      columnType: c.ct,
      nullable: c.isn === "YES",
      key: c.ck,
      comment: c.cc || "",
    });
  }
  return Array.from(byTable.values());
}

/** Exact row count for a single table (COUNT(*)). */
export async function exactRowCount(db: string, table: string): Promise<number> {
  const { quoteId } = await import("./db");
  const row = await query<{ c: number }>(
    `SELECT COUNT(*) AS c FROM ${quoteId(db)}.${quoteId(table)}`
  );
  return Number(row[0]?.c) || 0;
}
