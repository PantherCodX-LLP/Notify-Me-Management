/**
 * Reconciliation checks (READ ONLY).  Run:  node scripts/verify-all.mjs
 *
 * Independently recomputes the dashboard's headline numbers and asserts they are
 * internally consistent. Prints PASS/FAIL for each and exits non-zero on FAIL,
 * so it can be wired into a health check / cron.
 */
import mysql from "mysql2/promise";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
function loadEnv() {
  const env = {};
  const file = path.join(ROOT, ".env.local");
  if (fs.existsSync(file))
    for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
      if (m && !line.trim().startsWith("#")) env[m[1]] = m[2].trim();
    }
  return { ...env, ...process.env };
}

let pass = 0, fail = 0;
function check(name, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
  ok ? pass++ : fail++;
}
const N = (v) => Number(v) || 0;

async function main() {
  const env = loadEnv();
  const conn = await mysql.createConnection({
    host: env.DB_HOST, port: Number(env.DB_PORT || 3306),
    user: env.DB_USER, password: env.DB_PASSWORD, database: env.DB_NAME || "app_bis",
    ssl: (env.DB_SSL ?? "true").toLowerCase() !== "false" ? { rejectUnauthorized: false } : undefined,
    dateStrings: true,
  });
  const one = async (sql, p = []) => (await conn.query(sql, p))[0][0];
  const all = async (sql, p = []) => (await conn.query(sql, p))[0];

  console.log("\n================ RECONCILIATION ================\n");

  // 1. merchants total = active + churned
  const u = await one(`SELECT COUNT(*) total,
      SUM(deleted_at IS NULL) active, SUM(deleted_at IS NOT NULL) churned FROM users`);
  check("merchants: total = active + churned",
    N(u.total) === N(u.active) + N(u.churned),
    `total=${u.total} active=${u.active} churned=${u.churned}`);

  // 2. plan split (active) sums to active merchants
  const planRows = await all(
    `SELECT COUNT(*) c FROM users u WHERE u.deleted_at IS NULL`);
  const planSum = await all(
    `SELECT COALESCE(p.name, IF(u.plan_id IS NULL,'FREE_USER',CONCAT('Plan #',u.plan_id))) label, COUNT(*) c
       FROM users u LEFT JOIN plans p ON p.id=u.plan_id WHERE u.deleted_at IS NULL GROUP BY label`);
  const planTotal = planSum.reduce((s, r) => s + N(r.c), 0);
  check("plan breakdown sums to active merchants",
    planTotal === N(planRows[0].c), `sum=${planTotal} active=${planRows[0].c}`);

  // 3. notifications total = sum of ALL fun_type groups
  const notif = await one(`SELECT COUNT(*) total,
      SUM(is_sent IS NOT NULL) sent, SUM(is_sent IS NULL) unsent FROM variant_stock_notifications`);
  const funRows = await all(`SELECT COUNT(*) c FROM variant_stock_notifications GROUP BY fun_type`);
  const funSum = funRows.reduce((s, r) => s + N(r.c), 0);
  check("notifications: total = sum over all fun_type", funSum === N(notif.total),
    `groupsum=${funSum} total=${notif.total}`);
  check("notifications: total = sent + unsent", N(notif.total) === N(notif.sent) + N(notif.unsent),
    `total=${notif.total} sent=${notif.sent} unsent=${notif.unsent}`);

  // 4. paying <= active
  const paying = N((await one(
    `SELECT COUNT(DISTINCT user_id) c FROM charges WHERE status='ACTIVE' AND deleted_at IS NULL`)).c);
  check("paying merchants <= active merchants", paying <= N(u.active), `paying=${paying} active=${u.active}`);

  // 5. funnel monotonic
  const f = await one(`SELECT SUM(total_alerts_sent) sent, SUM(delivered) delivered,
      SUM(opened) opened, SUM(clicked) clicked, SUM(orders_generated) orders FROM bis_analytics_daily`);
  const mono = N(f.sent) >= N(f.delivered) && N(f.delivered) >= N(f.opened)
      && N(f.opened) >= N(f.clicked) && N(f.clicked) >= N(f.orders);
  check("funnel monotonic (sent>=delivered>=opened>=clicked>=orders)", mono,
    `${f.sent}/${f.delivered}/${f.opened}/${f.clicked}/${f.orders}`);

  // 6. billing: active recurring revenue = sum of per-plan totals
  const rev = N((await one(
    `SELECT SUM(price) c FROM charges WHERE status='ACTIVE' AND deleted_at IS NULL`)).c);
  const revByPlan = await all(
    `SELECT SUM(price) t FROM charges WHERE status='ACTIVE' AND deleted_at IS NULL GROUP BY plan_id`);
  const revSum = revByPlan.reduce((s, r) => s + N(r.t), 0);
  check("billing: active revenue = sum of per-plan revenue",
    Math.abs(rev - revSum) < 0.01, `total=${rev.toFixed(2)} sum=${revSum.toFixed(2)}`);

  // 7. per-shop rollup: sum of per-user app revenue = global app revenue
  const globalRev = N((await one(`SELECT SUM(revenue_generated) c FROM bis_analytics_daily`)).c);
  const perUserSum = N((await one(
    `SELECT SUM(t) c FROM (SELECT SUM(revenue_generated) t FROM bis_analytics_daily GROUP BY user_id) x`)).c);
  check("app revenue: per-shop sum = global total",
    Math.abs(globalRev - perUserSum) < 0.01, `global=${globalRev.toFixed(2)} rollup=${perUserSum.toFixed(2)}`);

  // Informational: plan label coverage
  const cov = await one(`SELECT
      SUM(plan_id IS NULL) free_user,
      SUM(plan_id IS NOT NULL AND p.id IS NULL) orphan,
      SUM(p.id IS NOT NULL) matched
    FROM users u LEFT JOIN plans p ON p.id=u.plan_id`);
  console.log(`\nPlan label coverage: FREE_USER(null)=${cov.free_user}  orphan(Plan #id)=${cov.orphan}  matched=${cov.matched}`);

  await conn.end();
  console.log(`\n================ ${pass} passed, ${fail} failed ================\n`);
  process.exit(fail ? 1 : 0);
}
main().catch((e) => { console.error("verify-all failed:", e.message); process.exit(2); });
