/**
 * Data verification helper (READ ONLY).
 *
 *   node scripts/verify.mjs                         # runs no-plan diagnostics
 *   node scripts/verify.mjs matedigiloop.myshopify.com   # deep-dive one shop
 *
 * Prints the raw cross-table truth for a shop so you can compare with Shopify.
 */
import mysql from "mysql2/promise";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

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

const shopArg = process.argv[2];

async function main() {
  const env = loadEnv();
  const conn = await mysql.createConnection({
    host: env.DB_HOST, port: Number(env.DB_PORT || 3306),
    user: env.DB_USER, password: env.DB_PASSWORD, database: env.DB_NAME || "app_bis",
    ssl: (env.DB_SSL ?? "true").toLowerCase() !== "false" ? { rejectUnauthorized: false } : undefined,
    dateStrings: true,
  });
  const q = async (sql, p = []) => (await conn.query(sql, p))[0];

  console.log("\n================ PLAN DIAGNOSTICS ================");
  const total = (await q("SELECT COUNT(*) c FROM users"))[0].c;
  const nullPlan = (await q("SELECT COUNT(*) c FROM users WHERE plan_id IS NULL"))[0].c;
  const orphanPlan = (await q(
    `SELECT COUNT(*) c FROM users u LEFT JOIN plans p ON p.id=u.plan_id
      WHERE u.plan_id IS NOT NULL AND p.id IS NULL`
  ))[0].c;
  const matched = (await q(
    `SELECT COUNT(*) c FROM users u JOIN plans p ON p.id=u.plan_id`
  ))[0].c;
  console.log(`users total              : ${total}`);
  console.log(`plan_id IS NULL          : ${nullPlan}   -> shown as "(no plan)"`);
  console.log(`plan_id set but NOT in plans table (orphan): ${orphanPlan}   -> shown as "Plan #<id>"`);
  console.log(`plan_id matched to plans : ${matched}`);
  console.log("\nOrphan plan_ids (set on users but missing from plans table):");
  const orphans = await q(
    `SELECT u.plan_id, COUNT(*) c FROM users u LEFT JOIN plans p ON p.id=u.plan_id
      WHERE u.plan_id IS NOT NULL AND p.id IS NULL GROUP BY u.plan_id ORDER BY c DESC`
  );
  console.table(orphans);

  if (shopArg) {
    console.log(`\n================ SHOP DEEP-DIVE: ${shopArg} ================`);
    const like = `%${shopArg}%`;
    const users = await q(
      `SELECT id, name, email, plan_id, shopify_freemium, shopify_grandfathered,
              created_at, deleted_at
         FROM users WHERE name = ? OR name LIKE ? OR email LIKE ? LIMIT 5`,
      [shopArg, like, like]
    );
    if (!users.length) {
      console.log("No matching user row found for that domain/email.");
    } else {
      for (const u of users) {
        console.log("\n-- users row --");
        console.table([u]);
        console.log(`STATUS shown by dashboard: ${u.deleted_at ? "churned (deleted_at set)" : "ACTIVE (deleted_at IS NULL)"}`);

        const plan = await q(`SELECT id, name, price, \`interval\` FROM plans WHERE id = ?`, [u.plan_id]);
        console.log("-- plan referenced by users.plan_id --");
        console.table(plan.length ? plan : [{ note: `plan_id ${u.plan_id} not found in plans table` }]);

        console.log("-- charges (what we billed) --");
        console.table(await q(
          `SELECT id, name, status, price, \`interval\`, activated_on, trial_ends_on, cancelled_on, deleted_at
             FROM charges WHERE user_id = ? ORDER BY created_at DESC LIMIT 10`, [u.id]));

        const usage = await q(
          `SELECT COUNT(*) records, SUM(price) total, MIN(created_at) first, MAX(created_at) last
             FROM shopify_usage_base_charges WHERE user_id = ?`, [u.id]);
        console.log("-- usage billing (note: historical; persists after uninstall) --");
        console.table(usage);

        const notif = await q(
          `SELECT COUNT(*) signups, SUM(is_sent IS NOT NULL) sent, MAX(created_at) last_signup
             FROM variant_stock_notifications WHERE user_id = ?`, [u.id]);
        console.log("-- notifications activity --");
        console.table(notif);

        console.log("-- webhook_status for this shop (failed app/uninstalled webhook can leave it 'active') --");
        console.table(await q(
          `SELECT topic, status, COUNT(*) c, MAX(updated_at) last
             FROM webhook_status WHERE shop = ? OR shop LIKE ? GROUP BY topic, status`,
          [u.name, like]));

        console.log("-- handprint install/uninstall events --");
        console.table(await q(
          "SELECT `Date`, `Event`, `Details` FROM handprint WHERE shop_domain LIKE ? OR `Shop name` LIKE ? ORDER BY id DESC LIMIT 10",
          [like, like]));
      }
    }
  } else {
    console.log("\nTip: pass a shop domain to deep-dive, e.g.:");
    console.log("     node scripts/verify.mjs matedigiloop.myshopify.com");
  }

  await conn.end();
}
main().catch((e) => { console.error("verify failed:", e.message); process.exit(1); });
