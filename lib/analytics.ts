import { query, quoteId } from "./db";
import {
  getDatabaseName,
  getTables,
  listDatabases,
  TableInfo,
} from "./introspect";
import { resolveMapping, SchemaMapping } from "./mapping";

// ---------------------------------------------------------------------------
// Cached context (schema is read once and reused for a short window)
// ---------------------------------------------------------------------------
interface Context {
  db: string;
  databases: string[];
  tables: TableInfo[];
  mapping: SchemaMapping;
  detected: SchemaMapping;
}

let cache: { ctx: Context; at: number } | null = null;
const TTL = 60_000; // 1 minute

export async function getContext(force = false): Promise<Context> {
  if (!force && cache && Date.now() - cache.at < TTL) return cache.ctx;
  const [db, databases] = await Promise.all([getDatabaseName(), listDatabases()]);
  const tables = await getTables(db);
  const { mapping, detected } = resolveMapping(tables);
  const ctx: Context = { db, databases, tables, mapping, detected };
  cache = { ctx, at: Date.now() };
  return ctx;
}

export function tableByName(ctx: Context, name?: string): TableInfo | undefined {
  if (!name) return undefined;
  return ctx.tables.find((t) => t.name === name);
}

export function columnExists(ctx: Context, table?: string, col?: string): boolean {
  if (!table || !col) return false;
  const t = tableByName(ctx, table);
  return !!t && t.columns.some((c) => c.name === col);
}

// ---------------------------------------------------------------------------
// Low-level query helpers (all identifiers are validated against the schema)
// ---------------------------------------------------------------------------
function ref(db: string, table: string): string {
  return `${quoteId(db)}.${quoteId(table)}`;
}

async function countAll(db: string, table: string): Promise<number> {
  const r = await query<{ c: number }>(`SELECT COUNT(*) AS c FROM ${ref(db, table)}`);
  return Number(r[0]?.c) || 0;
}

async function countWhere(db: string, table: string, where: string): Promise<number> {
  const r = await query<{ c: number }>(
    `SELECT COUNT(*) AS c FROM ${ref(db, table)} WHERE ${where}`
  );
  return Number(r[0]?.c) || 0;
}

export interface SeriesPoint {
  bucket: string;
  count: number;
}

/** Monthly time series for the last `months` months (zero-filled). */
async function monthlySeries(
  db: string,
  table: string,
  dateCol: string,
  months = 12
): Promise<SeriesPoint[]> {
  const rows = await query<{ b: string; c: number }>(
    `SELECT DATE_FORMAT(${quoteId(dateCol)}, '%Y-%m-01') AS b, COUNT(*) AS c
       FROM ${ref(db, table)}
      WHERE ${quoteId(dateCol)} IS NOT NULL
        AND ${quoteId(dateCol)} >= DATE_FORMAT(DATE_SUB(CURRENT_DATE, INTERVAL ${
      months - 1
    } MONTH), '%Y-%m-01')
      GROUP BY b
      ORDER BY b`
  );
  const map = new Map<string, number>();
  rows.forEach((r) => map.set(String(r.b).slice(0, 7), Number(r.c) || 0));
  const out: SeriesPoint[] = [];
  const now = new Date();
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    out.push({ bucket: key, count: map.get(key) || 0 });
  }
  return out;
}

/** Daily time series for the last `days` days (zero-filled). */
async function dailySeries(
  db: string,
  table: string,
  dateCol: string,
  days = 30
): Promise<SeriesPoint[]> {
  const rows = await query<{ b: string; c: number }>(
    `SELECT DATE(${quoteId(dateCol)}) AS b, COUNT(*) AS c
       FROM ${ref(db, table)}
      WHERE ${quoteId(dateCol)} IS NOT NULL
        AND ${quoteId(dateCol)} >= DATE_SUB(CURRENT_DATE, INTERVAL ${days - 1} DAY)
      GROUP BY b
      ORDER BY b`
  );
  const map = new Map<string, number>();
  rows.forEach((r) => map.set(String(r.b).slice(0, 10), Number(r.c) || 0));
  const out: SeriesPoint[] = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate()
    ).padStart(2, "0")}`;
    out.push({ bucket: key, count: map.get(key) || 0 });
  }
  return out;
}

export interface Breakdown {
  label: string;
  count: number;
}

/** GROUP BY a column, top N values. */
async function groupBy(
  db: string,
  table: string,
  col: string,
  limit = 20,
  where?: string
): Promise<Breakdown[]> {
  const rows = await query<{ label: any; c: number }>(
    `SELECT COALESCE(CAST(${quoteId(col)} AS CHAR), '(empty)') AS label, COUNT(*) AS c
       FROM ${ref(db, table)}
       ${where ? `WHERE ${where}` : ""}
      GROUP BY ${quoteId(col)}
      ORDER BY c DESC
      LIMIT ${Number(limit)}`
  );
  return rows.map((r) => ({
    label: r.label === null || r.label === "" ? "(empty)" : String(r.label),
    count: Number(r.c) || 0,
  }));
}

// ---------------------------------------------------------------------------
// High-level analytics used by API routes
// ---------------------------------------------------------------------------

export async function getOverview() {
  const ctx = await getContext();
  const m = ctx.mapping;
  const totalRows = ctx.tables.reduce((s, t) => s + t.rowEstimate, 0);

  const result: any = {
    database: ctx.db,
    databases: ctx.databases,
    tableCount: ctx.tables.length,
    estimatedTotalRows: totalRows,
    detected: ctx.detected,
    mapping: m,
    installs: null,
    notifications: null,
    plans: null,
  };

  // Installs
  if (m.installTable) {
    const total = await countAll(ctx.db, m.installTable);
    let uninstalled: number | null = null;
    let active: number | null = null;
    if (m.uninstallDateCol && columnExists(ctx, m.installTable, m.uninstallDateCol)) {
      uninstalled = await countWhere(
        ctx.db,
        m.installTable,
        `${quoteId(m.uninstallDateCol)} IS NOT NULL`
      );
      active = total - uninstalled;
    }
    const installsByMonth =
      m.installDateCol && columnExists(ctx, m.installTable, m.installDateCol)
        ? await monthlySeries(ctx.db, m.installTable, m.installDateCol, 12)
        : [];
    result.installs = { table: m.installTable, total, active, uninstalled, installsByMonth };
  }

  // Notifications
  if (m.notificationTable) {
    const total = await countAll(ctx.db, m.notificationTable);
    const byMonth =
      m.notificationDateCol && columnExists(ctx, m.notificationTable, m.notificationDateCol)
        ? await monthlySeries(ctx.db, m.notificationTable, m.notificationDateCol, 12)
        : [];
    result.notifications = { table: m.notificationTable, total, byMonth };
  }

  // Plans
  if (m.planTable && m.planNameCol && columnExists(ctx, m.planTable, m.planNameCol)) {
    const distribution = await groupBy(ctx.db, m.planTable, m.planNameCol, 12);
    result.plans = { table: m.planTable, distribution };
  }

  return result;
}

export async function getInstalls() {
  const ctx = await getContext();
  const m = ctx.mapping;
  if (!m.installTable) {
    return { available: false, reason: "No install/shop table detected.", mapping: m };
  }
  const total = await countAll(ctx.db, m.installTable);
  let active: number | null = null;
  let uninstalled: number | null = null;
  if (m.uninstallDateCol && columnExists(ctx, m.installTable, m.uninstallDateCol)) {
    uninstalled = await countWhere(
      ctx.db,
      m.installTable,
      `${quoteId(m.uninstallDateCol)} IS NOT NULL`
    );
    active = total - uninstalled;
  }
  const byMonth =
    m.installDateCol && columnExists(ctx, m.installTable, m.installDateCol)
      ? await monthlySeries(ctx.db, m.installTable, m.installDateCol, 12)
      : [];
  const byDay =
    m.installDateCol && columnExists(ctx, m.installTable, m.installDateCol)
      ? await dailySeries(ctx.db, m.installTable, m.installDateCol, 30)
      : [];
  const statusBreakdown =
    m.activeCol && columnExists(ctx, m.installTable, m.activeCol)
      ? await groupBy(ctx.db, m.installTable, m.activeCol, 12)
      : [];

  // Recent installs (most recent rows by install date)
  let recent: any[] = [];
  const cols = [m.shopIdentCol, m.installDateCol, m.uninstallDateCol, m.activeCol].filter(
    (c) => c && columnExists(ctx, m.installTable!, c)
  ) as string[];
  if (m.installDateCol && columnExists(ctx, m.installTable, m.installDateCol)) {
    const select = cols.length ? cols.map((c) => quoteId(c)).join(", ") : "*";
    recent = await query(
      `SELECT ${select} FROM ${quoteId(ctx.db)}.${quoteId(m.installTable)}
        ORDER BY ${quoteId(m.installDateCol)} DESC LIMIT 25`
    );
  }

  return {
    available: true,
    table: m.installTable,
    total,
    active,
    uninstalled,
    byMonth,
    byDay,
    statusBreakdown,
    recent,
    columns: cols,
    mapping: m,
  };
}

export async function getUninstalls() {
  const ctx = await getContext();
  const m = ctx.mapping;
  const out: any = { available: false, mapping: m };

  if (m.installTable && m.uninstallDateCol && columnExists(ctx, m.installTable, m.uninstallDateCol)) {
    out.available = true;
    out.table = m.installTable;
    out.totalUninstalled = await countWhere(
      ctx.db,
      m.installTable,
      `${quoteId(m.uninstallDateCol)} IS NOT NULL`
    );
    out.byMonth = await monthlySeries(ctx.db, m.installTable, m.uninstallDateCol, 12);
    out.byDay = await dailySeries(ctx.db, m.installTable, m.uninstallDateCol, 30);
  }

  // Reasons
  if (
    m.uninstallReasonTable &&
    m.uninstallReasonCol &&
    columnExists(ctx, m.uninstallReasonTable, m.uninstallReasonCol)
  ) {
    out.available = true;
    out.reasonTable = m.uninstallReasonTable;
    out.reasonColumn = m.uninstallReasonCol;
    out.reasons = await groupBy(
      ctx.db,
      m.uninstallReasonTable,
      m.uninstallReasonCol,
      25,
      `${quoteId(m.uninstallReasonCol)} IS NOT NULL AND ${quoteId(
        m.uninstallReasonCol
      )} <> ''`
    );

    // Recent uninstall feedback
    const rcols = [
      m.uninstallReasonCol,
      m.uninstallReasonDateCol,
    ].filter((c) => c && columnExists(ctx, m.uninstallReasonTable!, c)) as string[];
    const orderCol =
      m.uninstallReasonDateCol &&
      columnExists(ctx, m.uninstallReasonTable, m.uninstallReasonDateCol)
        ? m.uninstallReasonDateCol
        : undefined;
    out.recentReasons = await query(
      `SELECT ${rcols.map((c) => quoteId(c)).join(", ") || "*"}
         FROM ${quoteId(ctx.db)}.${quoteId(m.uninstallReasonTable)}
        WHERE ${quoteId(m.uninstallReasonCol)} IS NOT NULL AND ${quoteId(
        m.uninstallReasonCol
      )} <> ''
        ${orderCol ? `ORDER BY ${quoteId(orderCol)} DESC` : ""}
        LIMIT 50`
    );
  }

  if (!out.available) {
    out.reason = "No uninstall date or uninstall-reason column detected.";
  }
  return out;
}

export async function getPlans() {
  const ctx = await getContext();
  const m = ctx.mapping;
  if (!m.planTable || !m.planNameCol || !columnExists(ctx, m.planTable, m.planNameCol)) {
    return { available: false, reason: "No plan/subscription table detected.", mapping: m };
  }
  const total = await countAll(ctx.db, m.planTable);
  const distribution = await groupBy(ctx.db, m.planTable, m.planNameCol, 25);

  let revenueByPlan: any[] = [];
  if (m.planPriceCol && columnExists(ctx, m.planTable, m.planPriceCol)) {
    revenueByPlan = await query(
      `SELECT COALESCE(CAST(${quoteId(m.planNameCol)} AS CHAR),'(empty)') AS label,
              COUNT(*) AS count,
              SUM(${quoteId(m.planPriceCol)}) AS total_price,
              AVG(${quoteId(m.planPriceCol)}) AS avg_price
         FROM ${quoteId(ctx.db)}.${quoteId(m.planTable)}
        GROUP BY ${quoteId(m.planNameCol)}
        ORDER BY count DESC
        LIMIT 25`
    );
  }

  let statusBreakdown: Breakdown[] = [];
  if (m.planStatusCol && columnExists(ctx, m.planTable, m.planStatusCol)) {
    statusBreakdown = await groupBy(ctx.db, m.planTable, m.planStatusCol, 12);
  }

  return {
    available: true,
    table: m.planTable,
    total,
    distribution,
    revenueByPlan,
    statusBreakdown,
    mapping: m,
  };
}

export async function getNotifications() {
  const ctx = await getContext();
  const m = ctx.mapping;
  if (!m.notificationTable) {
    return { available: false, reason: "No notifications table detected.", mapping: m };
  }
  const total = await countAll(ctx.db, m.notificationTable);
  const byMonth =
    m.notificationDateCol && columnExists(ctx, m.notificationTable, m.notificationDateCol)
      ? await monthlySeries(ctx.db, m.notificationTable, m.notificationDateCol, 12)
      : [];
  const byDay =
    m.notificationDateCol && columnExists(ctx, m.notificationTable, m.notificationDateCol)
      ? await dailySeries(ctx.db, m.notificationTable, m.notificationDateCol, 30)
      : [];
  const byStatus =
    m.notificationStatusCol && columnExists(ctx, m.notificationTable, m.notificationStatusCol)
      ? await groupBy(ctx.db, m.notificationTable, m.notificationStatusCol, 12)
      : [];
  const byChannel =
    m.notificationChannelCol && columnExists(ctx, m.notificationTable, m.notificationChannelCol)
      ? await groupBy(ctx.db, m.notificationTable, m.notificationChannelCol, 12)
      : [];

  return {
    available: true,
    table: m.notificationTable,
    total,
    byMonth,
    byDay,
    byStatus,
    byChannel,
    mapping: m,
  };
}

// ---------------------------------------------------------------------------
// Raw table explorer (safe: table/column validated against schema)
// ---------------------------------------------------------------------------
export interface TableQuery {
  table: string;
  page?: number;
  pageSize?: number;
  search?: string;
  sortCol?: string;
  sortDir?: "asc" | "desc";
}

export async function getTableData(q: TableQuery) {
  const ctx = await getContext();
  const t = tableByName(ctx, q.table);
  if (!t) throw new Error(`Unknown table: ${q.table}`);

  const page = Math.max(1, Number(q.page) || 1);
  const pageSize = Math.min(200, Math.max(1, Number(q.pageSize) || 50));
  const offset = (page - 1) * pageSize;

  // WHERE: free-text search across text-ish columns only.
  const textCols = t.columns.filter((c) =>
    ["varchar", "char", "text", "tinytext", "mediumtext", "longtext", "enum"].includes(
      c.dataType
    )
  );
  let where = "";
  const params: any[] = [];
  if (q.search && q.search.trim() && textCols.length) {
    const like = `%${q.search.trim()}%`;
    where =
      "WHERE " +
      textCols.map((c) => `${quoteId(c.name)} LIKE ?`).join(" OR ");
    textCols.forEach(() => params.push(like));
  }

  // ORDER BY: only if sortCol is a real column.
  let orderBy = "";
  if (q.sortCol && t.columns.some((c) => c.name === q.sortCol)) {
    const dir = q.sortDir === "asc" ? "ASC" : "DESC";
    orderBy = `ORDER BY ${quoteId(q.sortCol)} ${dir}`;
  }

  const countRow = await query<{ c: number }>(
    `SELECT COUNT(*) AS c FROM ${quoteId(ctx.db)}.${quoteId(t.name)} ${where}`,
    params
  );
  const totalRows = Number(countRow[0]?.c) || 0;

  const rows = await query(
    `SELECT * FROM ${quoteId(ctx.db)}.${quoteId(t.name)} ${where} ${orderBy} LIMIT ${pageSize} OFFSET ${offset}`,
    params
  );

  return {
    table: t.name,
    columns: t.columns,
    rows,
    page,
    pageSize,
    totalRows,
    totalPages: Math.max(1, Math.ceil(totalRows / pageSize)),
  };
}
