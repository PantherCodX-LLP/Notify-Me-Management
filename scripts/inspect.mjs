/**
 * Database inspector — READ ONLY.
 *
 * Dumps the full schema, row counts, a few sample rows per table, and the
 * distinct values of "type / status / channel / reason / plan" style columns
 * so the dashboard can be tailored to your exact schema.
 *
 * Run:  npm run inspect
 *
 * Output (written into the project root):
 *   - schema-report.md   (human readable — share this back)
 *   - schema-dump.json   (full machine readable)
 *
 * It only issues SELECT / information_schema queries.
 */
import mysql from "mysql2/promise";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

// --- tiny .env.local parser (no extra deps) ---
function loadEnv() {
  const file = path.join(ROOT, ".env.local");
  const env = {};
  if (fs.existsSync(file)) {
    for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
      if (m && !line.trim().startsWith("#")) {
        let v = m[2].trim();
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))
          v = v.slice(1, -1);
        env[m[1]] = v;
      }
    }
  }
  return { ...env, ...process.env };
}

const SYSTEM = ["mysql", "information_schema", "performance_schema", "sys"];
const DISTINCT_RX =
  /(type|status|channel|kind|category|method|feature|state|reason|plan|tier|event|source|mode|frequency|provider|trigger)/i;
const SAMPLE_ROWS = 3;
const SCAN_CAP = 200000; // bound distinct-value scans on huge tables

async function main() {
  const env = loadEnv();
  const useSsl = (env.DB_SSL ?? "true").toLowerCase() !== "false";
  const conn = await mysql.createConnection({
    host: env.DB_HOST,
    port: Number(env.DB_PORT || 3306),
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME || undefined,
    ssl: useSsl ? { rejectUnauthorized: false } : undefined,
    connectTimeout: 20000,
    dateStrings: true,
  });

  const q = async (sql, params = []) => (await conn.query(sql, params))[0];
  const qid = (id) => "`" + String(id).replace(/`/g, "``") + "`";

  // Resolve database name
  let db = env.DB_NAME && env.DB_NAME.trim();
  if (!db) {
    const rows = await q(
      `SELECT SCHEMA_NAME s FROM information_schema.SCHEMATA
        WHERE SCHEMA_NAME NOT IN (?,?,?,?) ORDER BY SCHEMA_NAME`,
      SYSTEM
    );
    db = rows[0]?.s;
  }
  if (!db) throw new Error("No database found. Set DB_NAME in .env.local");

  const allSchemas = (
    await q(
      `SELECT SCHEMA_NAME s FROM information_schema.SCHEMATA
        WHERE SCHEMA_NAME NOT IN (?,?,?,?) ORDER BY SCHEMA_NAME`,
      SYSTEM
    )
  ).map((r) => r.s);

  console.log(`Inspecting database: ${db}`);

  const tableRows = await q(
    `SELECT TABLE_NAME tn, TABLE_ROWS tr, TABLE_COMMENT tc
       FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = ? AND TABLE_TYPE='BASE TABLE'
      ORDER BY TABLE_NAME`,
    [db]
  );
  const colRows = await q(
    `SELECT TABLE_NAME tn, COLUMN_NAME cn, DATA_TYPE dt, COLUMN_TYPE ct,
            IS_NULLABLE isn, COLUMN_KEY ck, COLUMN_COMMENT cc
       FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = ?
      ORDER BY TABLE_NAME, ORDINAL_POSITION`,
    [db]
  );
  const colsByTable = new Map();
  for (const c of colRows) {
    if (!colsByTable.has(c.tn)) colsByTable.set(c.tn, []);
    colsByTable.get(c.tn).push(c);
  }

  const out = { database: db, schemas: allSchemas, generatedAt: new Date().toISOString(), tables: [] };

  for (const t of tableRows) {
    const cols = colsByTable.get(t.tn) || [];
    console.log(`  · ${t.tn} (${cols.length} cols)`);

    let exactCount = null;
    try {
      const r = await q(`SELECT COUNT(*) c FROM ${qid(db)}.${qid(t.tn)}`);
      exactCount = Number(r[0]?.c) || 0;
    } catch (e) {
      console.log(`    ! count failed: ${e.message}`);
    }

    let sample = [];
    try {
      sample = await q(`SELECT * FROM ${qid(db)}.${qid(t.tn)} LIMIT ${SAMPLE_ROWS}`);
    } catch (e) {
      console.log(`    ! sample failed: ${e.message}`);
    }

    // distinct values for categorical columns
    const distinct = {};
    for (const c of cols) {
      const lowCardType = ["varchar", "char", "enum", "tinyint", "int", "smallint", "bool", "boolean"].includes(
        c.dt
      );
      if (!DISTINCT_RX.test(c.cn) || !lowCardType) continue;
      try {
        const rows = await q(
          `SELECT v, COUNT(*) c FROM (
             SELECT ${qid(c.cn)} v FROM ${qid(db)}.${qid(t.tn)} LIMIT ${SCAN_CAP}
           ) x GROUP BY v ORDER BY c DESC LIMIT 30`
        );
        distinct[c.cn] = rows.map((r) => ({ value: r.v, count: Number(r.c) }));
      } catch (e) {
        /* ignore */
      }
    }

    out.tables.push({
      name: t.tn,
      comment: t.tc || "",
      rowEstimate: Number(t.tr) || 0,
      exactCount,
      columns: cols.map((c) => ({
        name: c.cn,
        type: c.ct,
        dataType: c.dt,
        nullable: c.isn === "YES",
        key: c.ck,
        comment: c.cc || "",
      })),
      sample,
      distinct,
    });
  }

  await conn.end();

  // --- write JSON ---
  fs.writeFileSync(path.join(ROOT, "schema-dump.json"), JSON.stringify(out, null, 2));

  // --- write Markdown report ---
  const md = [];
  md.push(`# Schema report — \`${db}\``);
  md.push(`Generated ${out.generatedAt}`);
  md.push(`\nSchemas on server: ${allSchemas.join(", ")}`);
  md.push(`\nTotal tables: **${out.tables.length}**\n`);
  md.push(`## Table overview\n`);
  md.push(`| Table | Rows | Cols | Comment |`);
  md.push(`| --- | ---: | ---: | --- |`);
  for (const t of out.tables) {
    md.push(`| \`${t.name}\` | ${t.exactCount ?? t.rowEstimate} | ${t.columns.length} | ${t.comment.replace(/\|/g, "/")} |`);
  }
  md.push(`\n---\n`);
  for (const t of out.tables) {
    md.push(`## \`${t.name}\`  — ${t.exactCount ?? t.rowEstimate} rows`);
    if (t.comment) md.push(`> ${t.comment}`);
    md.push(`\n| Column | Type | Null | Key | Comment |`);
    md.push(`| --- | --- | --- | --- | --- |`);
    for (const c of t.columns) {
      md.push(`| \`${c.name}\` | ${c.type} | ${c.nullable ? "Y" : "N"} | ${c.key || ""} | ${c.comment.replace(/\|/g, "/")} |`);
    }
    const distKeys = Object.keys(t.distinct);
    if (distKeys.length) {
      md.push(`\n**Distinct values**`);
      for (const k of distKeys) {
        const vals = t.distinct[k]
          .map((d) => `${d.value === null ? "NULL" : d.value} (${d.count})`)
          .join(", ");
        md.push(`- \`${k}\`: ${vals}`);
      }
    }
    md.push("");
  }
  fs.writeFileSync(path.join(ROOT, "schema-report.md"), md.join("\n"));

  console.log(`\nDone.`);
  console.log(`  schema-report.md  (${out.tables.length} tables)`);
  console.log(`  schema-dump.json`);
}

main().catch((e) => {
  console.error("Inspection failed:", e.message);
  process.exit(1);
});
