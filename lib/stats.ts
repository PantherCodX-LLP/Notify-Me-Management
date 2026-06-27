import { query } from "./db";
import { cached } from "./cache";
import { buildEmail, emailSubject, recommendedFor, FEATURE_INFO, EmailShop, ProductReq, buildContext, MERGE_KEYS, DEFAULT_SUBJECT, DEFAULT_TEMPLATE_HTML, normalizeLang, LANG_NAMES, SUPPORTED_LANGS, Campaign, templatesFor, subjectFor } from "./email";

/**
 * Concrete analytics for the Notify Me (Back in Stock) Shopify app, mapped to
 * the real `app_bis` schema. The connection pool is already bound to the
 * database (DB_NAME), so tables are referenced unqualified.
 *
 * Data model used here:
 *   users                         -> merchants (created_at=install, deleted_at=uninstall, plan_id)
 *   plans / charges               -> billing (charges.status ACTIVE|CANCELLED)
 *   shopify_usage_base_charges    -> pay-as-you-go SMS/WhatsApp usage billing
 *   variant_stock_notifications   -> every shopper signup/request (fun_type = feature, type = channel)
 *   variant_stock_notification_settings -> per-shop BIS configuration
 *   bis_mails / sent_s_m_s_responses    -> delivery (email / sms+whatsapp)
 *   bis_analytics_daily / _products     -> performance funnel (sent->delivered->opened->clicked->orders->revenue)
 *   analytics_orders / _order_items     -> attributed orders (is_bis_order / is_upsell_order)
 *   pricedrops / sale_alerts / popups   -> feature configs
 *   preorder_*                          -> pre-order feature
 *   upsell_events / upsell_analytics_daily -> upsell feature
 *   handprint                           -> install/uninstall event log
 *   email_unsubscribes / webhooks / webhook_status / integrations -> health
 */

// --------------------------------------------------------------------------
// helpers
// --------------------------------------------------------------------------
const qid = (s: string) => "`" + s.replace(/`/g, "``") + "`";
const num = (v: any) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

async function safe<T>(fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch (e: any) {
    console.error("[stats]", e?.message || e);
    return null;
  }
}

async function count(table: string, where?: string): Promise<number> {
  const r = await query<{ c: number }>(
    `SELECT COUNT(*) c FROM ${qid(table)} ${where ? `WHERE ${where}` : ""}`
  );
  return num(r[0]?.c);
}

async function scalarRow<T = any>(sql: string): Promise<T> {
  const r = await query<T>(sql);
  return (r[0] || {}) as T;
}

export interface Point {
  bucket: string;
  count: number;
}
export interface Item {
  label: string;
  count: number;
}

function fillMonths(rows: { b: string; c: number }[], months: number): Point[] {
  const map = new Map<string, number>();
  rows.forEach((r) => map.set(String(r.b).slice(0, 7), num(r.c)));
  const out: Point[] = [];
  const now = new Date();
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    out.push({ bucket: key, count: map.get(key) || 0 });
  }
  return out;
}

function fillDays(rows: { b: string; c: number }[], days: number): Point[] {
  const map = new Map<string, number>();
  rows.forEach((r) => map.set(String(r.b).slice(0, 10), num(r.c)));
  const out: Point[] = [];
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

async function monthly(
  table: string,
  dateCol: string,
  where?: string,
  months = 12
): Promise<Point[]> {
  const w = [
    `${qid(dateCol)} IS NOT NULL`,
    `${qid(dateCol)} >= DATE_FORMAT(DATE_SUB(CURRENT_DATE, INTERVAL ${months - 1} MONTH),'%Y-%m-01')`,
  ];
  if (where) w.push(where);
  const rows = await query<{ b: string; c: number }>(
    `SELECT DATE_FORMAT(${qid(dateCol)},'%Y-%m-01') b, COUNT(*) c
       FROM ${qid(table)} WHERE ${w.join(" AND ")} GROUP BY b ORDER BY b`
  );
  return fillMonths(rows, months);
}

async function sumMonthly(
  table: string,
  dateCol: string,
  valueExpr: string,
  months = 12,
  where?: string
): Promise<Point[]> {
  const rows = await query<{ b: string; c: number }>(
    `SELECT DATE_FORMAT(${qid(dateCol)},'%Y-%m-01') b, SUM(${valueExpr}) c
       FROM ${qid(table)}
      WHERE ${qid(dateCol)} IS NOT NULL
        AND ${qid(dateCol)} >= DATE_FORMAT(DATE_SUB(CURRENT_DATE, INTERVAL ${months - 1} MONTH),'%Y-%m-01')
        ${where ? `AND ${where}` : ""}
      GROUP BY b ORDER BY b`
  );
  return fillMonths(
    rows.map((r) => ({ b: r.b, c: num(r.c) })),
    months
  );
}

async function daily(table: string, dateCol: string, where?: string, days = 30): Promise<Point[]> {
  const w = [
    `${qid(dateCol)} IS NOT NULL`,
    `${qid(dateCol)} >= DATE_SUB(CURRENT_DATE, INTERVAL ${days - 1} DAY)`,
  ];
  if (where) w.push(where);
  const rows = await query<{ b: string; c: number }>(
    `SELECT DATE(${qid(dateCol)}) b, COUNT(*) c
       FROM ${qid(table)} WHERE ${w.join(" AND ")} GROUP BY b ORDER BY b`
  );
  return fillDays(rows, days);
}

async function groupCount(
  table: string,
  col: string,
  opts: { where?: string; limit?: number; join?: string; labelExpr?: string } = {}
): Promise<Item[]> {
  const labelExpr = opts.labelExpr || `COALESCE(CAST(${qid(col)} AS CHAR),'(empty)')`;
  const rows = await query<{ label: any; c: number }>(
    `SELECT ${labelExpr} label, COUNT(*) c
       FROM ${qid(table)} ${opts.join || ""}
       ${opts.where ? `WHERE ${opts.where}` : ""}
      GROUP BY label ORDER BY c DESC LIMIT ${Number(opts.limit || 20)}`
  );
  return rows.map((r) => ({
    label: r.label === null || r.label === "" ? "(empty)" : String(r.label),
    count: num(r.c),
  }));
}

// --------------------------------------------------------------------------
// OVERVIEW
// --------------------------------------------------------------------------
export async function getOverview() {
  const [
    merchantsTotal,
    merchantsActive,
    merchantsChurned,
    paying,
    activeRevenue,
    signupsTotal,
    alertsSent,
    funnel,
    installsByMonth,
    signupsByMonth,
    featureSplit,
    channelSplit,
    planSplit,
  ] = await Promise.all([
    safe(() => count("users")),
    safe(() => count("users", "deleted_at IS NULL")),
    safe(() => count("users", "deleted_at IS NOT NULL")),
    safe(async () =>
      num(
        (
          await scalarRow<{ c: number }>(
            `SELECT COUNT(DISTINCT user_id) c FROM charges WHERE status='ACTIVE' AND deleted_at IS NULL AND test=0`
          )
        ).c
      )
    ),
    safe(async () =>
      num(
        (
          await scalarRow<{ c: number }>(
            // True MRR: exclude test charges, normalize annual plans to monthly.
            `SELECT SUM(CASE WHEN \`interval\`='ANNUAL' THEN price/12 ELSE price END) c
               FROM charges WHERE status='ACTIVE' AND deleted_at IS NULL AND test=0`
          )
        ).c
      )
    ),
    safe(() => count("variant_stock_notifications")),
    safe(() => count("variant_stock_notifications", "is_sent IS NOT NULL")),
    safe(() =>
      scalarRow(
        `SELECT SUM(total_alerts_sent) sent, SUM(delivered) delivered, SUM(opened) opened,
                SUM(clicked) clicked, SUM(orders_generated) orders, SUM(revenue_generated) revenue
           FROM bis_analytics_daily`
      )
    ),
    safe(() => monthly("users", "created_at", undefined, 12)),
    safe(() => monthly("variant_stock_notifications", "created_at", undefined, 12)),
    safe(() => groupCount("variant_stock_notifications", "fun_type", { limit: 10 })),
    safe(() => groupCount("variant_stock_notifications", "type", { limit: 10 })),
    safe(() =>
      query<{ label: string; c: number }>(
        `SELECT COALESCE(p.name, (SELECT c.name FROM charges c WHERE c.user_id=u.id AND c.status='ACTIVE' ORDER BY c.activated_on DESC LIMIT 1), (SELECT c.name FROM charges c WHERE c.user_id=u.id ORDER BY c.activated_on DESC LIMIT 1), IF(u.plan_id IS NULL, 'FREE_USER', CONCAT('Plan #', u.plan_id))) label, COUNT(*) c
           FROM users u LEFT JOIN plans p ON p.id = u.plan_id
          WHERE u.deleted_at IS NULL
          GROUP BY label ORDER BY c DESC LIMIT 15`
      ).then((rows) => rows.map((r) => ({ label: r.label, count: num(r.c) })))
    ),
  ]);

  const f: any = funnel || {};
  return {
    merchants: {
      total: merchantsTotal,
      active: merchantsActive,
      churned: merchantsChurned,
      paying,
      free: merchantsActive != null && paying != null ? merchantsActive - paying : null,
    },
    revenue: {
      activeRecurring: activeRevenue,
      bisRevenue: num(f.revenue),
      bisOrders: num(f.orders),
    },
    notifications: {
      signupsTotal,
      alertsSent,
    },
    funnel: {
      sent: num(f.sent),
      delivered: num(f.delivered),
      opened: num(f.opened),
      clicked: num(f.clicked),
      orders: num(f.orders),
      revenue: num(f.revenue),
    },
    installsByMonth: installsByMonth || [],
    signupsByMonth: signupsByMonth || [],
    featureSplit: featureSplit || [],
    channelSplit: channelSplit || [],
    planSplit: planSplit || [],
  };
}

// --------------------------------------------------------------------------
// MERCHANTS (installs)
// --------------------------------------------------------------------------
export async function getMerchants() {
  const [
    total,
    active,
    churned,
    freemium,
    grandfathered,
    onboarded,
    byMonth,
    byDay,
    byPlan,
    byLanguage,
    byCountry,
    recentInstalls,
    recentUninstalls,
  ] = await Promise.all([
    safe(() => count("users")),
    safe(() => count("users", "deleted_at IS NULL")),
    safe(() => count("users", "deleted_at IS NOT NULL")),
    safe(() => count("users", "shopify_freemium = 1")),
    safe(() => count("users", "shopify_grandfathered = 1")),
    safe(() => count("users", "button_state = 1")),
    safe(() => monthly("users", "created_at", undefined, 12)),
    safe(() => daily("users", "created_at", undefined, 30)),
    safe(() =>
      query<{ label: string; c: number }>(
        `SELECT COALESCE(p.name, (SELECT c.name FROM charges c WHERE c.user_id=u.id AND c.status='ACTIVE' ORDER BY c.activated_on DESC LIMIT 1), (SELECT c.name FROM charges c WHERE c.user_id=u.id ORDER BY c.activated_on DESC LIMIT 1), IF(u.plan_id IS NULL, 'FREE_USER', CONCAT('Plan #', u.plan_id))) label, COUNT(*) c
           FROM users u LEFT JOIN plans p ON p.id=u.plan_id
          WHERE u.deleted_at IS NULL GROUP BY label ORDER BY c DESC LIMIT 20`
      ).then((r) => r.map((x) => ({ label: x.label, count: num(x.c) })))
    ),
    safe(() =>
      groupCount("users", "shop_current_language", {
        where: "deleted_at IS NULL",
        limit: 15,
      })
    ),
    safe(() =>
      groupCount("handprint", "Shop country", {
        labelExpr: "COALESCE(NULLIF(`Shop country`,''),'(unknown)')",
        where: "`Event`='Installed'",
        limit: 20,
      })
    ),
    safe(() =>
      query(
        `SELECT u.name, u.email, COALESCE(p.name, (SELECT c.name FROM charges c WHERE c.user_id=u.id AND c.status='ACTIVE' ORDER BY c.activated_on DESC LIMIT 1), (SELECT c.name FROM charges c WHERE c.user_id=u.id ORDER BY c.activated_on DESC LIMIT 1), IF(u.plan_id IS NULL, 'FREE_USER', CONCAT('Plan #', u.plan_id))) plan, u.created_at, u.shopify_freemium
           FROM users u LEFT JOIN plans p ON p.id=u.plan_id
          WHERE u.deleted_at IS NULL ORDER BY u.created_at DESC LIMIT 25`
      )
    ),
    safe(() =>
      query(
        `SELECT u.name, u.email, COALESCE(p.name, (SELECT c.name FROM charges c WHERE c.user_id=u.id AND c.status='ACTIVE' ORDER BY c.activated_on DESC LIMIT 1), (SELECT c.name FROM charges c WHERE c.user_id=u.id ORDER BY c.activated_on DESC LIMIT 1), IF(u.plan_id IS NULL, 'FREE_USER', CONCAT('Plan #', u.plan_id))) plan, u.created_at, u.deleted_at
           FROM users u LEFT JOIN plans p ON p.id=u.plan_id
          WHERE u.deleted_at IS NOT NULL ORDER BY u.deleted_at DESC LIMIT 25`
      )
    ),
  ]);

  return {
    total,
    active,
    churned,
    freemium,
    grandfathered,
    onboarded,
    byMonth: byMonth || [],
    byDay: byDay || [],
    byPlan: byPlan || [],
    byLanguage: byLanguage || [],
    byCountry: byCountry || [],
    recentInstalls: recentInstalls || [],
    recentUninstalls: recentUninstalls || [],
  };
}

// --------------------------------------------------------------------------
// CHURN & UNINSTALLS
// --------------------------------------------------------------------------
export async function getChurn() {
  const [
    churnedTotal,
    churnByMonth,
    cancelledCharges,
    cancelByMonth,
    chargeStatus,
    churnByPlan,
    handprintUninstalls,
    unsubsTotal,
    unsubsBySource,
    unsubsByMonth,
  ] = await Promise.all([
    safe(() => count("users", "deleted_at IS NOT NULL")),
    safe(() => monthly("users", "deleted_at", undefined, 12)),
    safe(() => count("charges", "status='CANCELLED' AND test=0")),
    safe(() => monthly("charges", "cancelled_on", "status='CANCELLED' AND test=0", 12)),
    safe(() => groupCount("charges", "status", { limit: 10 })),
    safe(() =>
      query<{ label: string; c: number }>(
        `SELECT COALESCE(p.name, (SELECT c.name FROM charges c WHERE c.user_id=u.id AND c.status='ACTIVE' ORDER BY c.activated_on DESC LIMIT 1), (SELECT c.name FROM charges c WHERE c.user_id=u.id ORDER BY c.activated_on DESC LIMIT 1), IF(u.plan_id IS NULL, 'FREE_USER', CONCAT('Plan #', u.plan_id))) label, COUNT(*) c
           FROM users u LEFT JOIN plans p ON p.id=u.plan_id
          WHERE u.deleted_at IS NOT NULL GROUP BY label ORDER BY c DESC LIMIT 20`
      ).then((r) => r.map((x) => ({ label: x.label, count: num(x.c) })))
    ),
    safe(() =>
      query(
        "SELECT `Date`, `Event`, `Details`, `Shop name`, `Shop country`, `shop_domain` FROM handprint WHERE `Event`='Uninstalled' ORDER BY id DESC LIMIT 50"
      )
    ),
    safe(() => count("email_unsubscribes")),
    safe(() => groupCount("email_unsubscribes", "source", { limit: 10 })),
    safe(() => monthly("email_unsubscribes", "created_at", undefined, 12)),
  ]);

  return {
    churnedTotal,
    churnByMonth: churnByMonth || [],
    cancelledCharges,
    cancelByMonth: cancelByMonth || [],
    chargeStatus: chargeStatus || [],
    churnByPlan: churnByPlan || [],
    handprintUninstalls: handprintUninstalls || [],
    unsubscribes: {
      total: unsubsTotal,
      bySource: unsubsBySource || [],
      byMonth: unsubsByMonth || [],
    },
    // No dedicated uninstall-reason field exists in the schema; the closest
    // signal is the handprint event log + email unsubscribe reasons.
    hasReasonField: false,
  };
}

// --------------------------------------------------------------------------
// PLANS & BILLING
// --------------------------------------------------------------------------
export async function getBilling() {
  const [
    plansList,
    merchantsPerPlan,
    activeCharges,
    cancelledCharges,
    activeRevenue,
    newChargesByMonth,
    trials,
    usageTotal,
    usageBySender,
    usageByMonth,
    limitReached,
  ] = await Promise.all([
    safe(() =>
      query(
        `SELECT id, name, type, price, \`interval\`, trial_days, is_public, on_install
           FROM plans ORDER BY price ASC LIMIT 100`
      )
    ),
    safe(() =>
      query<{ label: string; c: number }>(
        `SELECT COALESCE(p.name, (SELECT c.name FROM charges c WHERE c.user_id=u.id AND c.status='ACTIVE' ORDER BY c.activated_on DESC LIMIT 1), (SELECT c.name FROM charges c WHERE c.user_id=u.id ORDER BY c.activated_on DESC LIMIT 1), IF(u.plan_id IS NULL, 'FREE_USER', CONCAT('Plan #', u.plan_id))) label, COUNT(*) c
           FROM users u LEFT JOIN plans p ON p.id=u.plan_id
          WHERE u.deleted_at IS NULL GROUP BY label ORDER BY c DESC LIMIT 25`
      ).then((r) => r.map((x) => ({ label: x.label, count: num(x.c) })))
    ),
    safe(() => count("charges", "status='ACTIVE' AND deleted_at IS NULL AND test=0")),
    safe(() => count("charges", "status='CANCELLED' AND test=0")),
    safe(async () =>
      num(
        (await scalarRow<{ c: number }>(
          // True MRR: exclude test charges, normalize annual plans to a monthly basis.
          `SELECT SUM(CASE WHEN \`interval\`='ANNUAL' THEN price/12 ELSE price END) c
             FROM charges WHERE status='ACTIVE' AND deleted_at IS NULL AND test=0`
        )).c
      )
    ),
    safe(() => monthly("charges", "activated_on", "test=0", 12)),
    safe(() => count("charges", "trial_ends_on > NOW() AND status='ACTIVE' AND test=0")),
    safe(async () =>
      num(
        (await scalarRow<{ c: number }>(`SELECT SUM(price) c FROM shopify_usage_base_charges`)).c
      )
    ),
    safe(() => groupCount("shopify_usage_base_charges", "send_by", { limit: 10 })),
    safe(() => sumMonthly("shopify_usage_base_charges", "created_at", "price", 12)),
    safe(() => count("shop_current_plan_limits", "limit_reached = 1")),
  ]);

  // recurring revenue (MRR) per active plan — test excluded, annual normalized
  const revenueByPlan = await safe(() =>
    query(
      `SELECT COALESCE(p.name, c.name, '(unknown)') label,
              COUNT(*) count,
              SUM(CASE WHEN c.\`interval\`='ANNUAL' THEN c.price/12 ELSE c.price END) total,
              AVG(CASE WHEN c.\`interval\`='ANNUAL' THEN c.price/12 ELSE c.price END) avg
         FROM charges c LEFT JOIN plans p ON p.id=c.plan_id
        WHERE c.status='ACTIVE' AND c.deleted_at IS NULL AND c.test=0
        GROUP BY label ORDER BY total DESC LIMIT 25`
    ).then((r) =>
      r.map((x: any) => ({
        label: x.label,
        count: num(x.count),
        total: num(x.total),
        avg: num(x.avg),
      }))
    )
  );

  return {
    plansList: plansList || [],
    merchantsPerPlan: merchantsPerPlan || [],
    activeCharges,
    cancelledCharges,
    activeRevenue,
    revenueByPlan: revenueByPlan || [],
    newChargesByMonth: newChargesByMonth || [],
    trials,
    usage: {
      total: usageTotal,
      bySender: usageBySender || [],
      byMonth: usageByMonth || [],
    },
    limitReached,
  };
}

// --------------------------------------------------------------------------
// MRR (Monthly Recurring Revenue)
// --------------------------------------------------------------------------
// Correct MRR requires two things the naive "SUM(price) of active charges"
// gets wrong:
//   1. Test charges (charges.test = 1) are Shopify development/test
//      subscriptions that are never really billed -> they must be EXCLUDED.
//   2. Annual plans (charges.interval = 'ANNUAL') bill once a year, so their
//      contribution to *monthly* recurring revenue is price / 12. Counting the
//      full annual price as monthly massively overstates MRR.
// Everything below is computed over RECURRING, non-test, non-deleted charges.

/** Monthly-normalized value of a single charge (annual -> /12). */
function monthlyValue(price: number, interval: string | null | undefined): number {
  const p = num(price);
  return String(interval).toUpperCase() === "ANNUAL" ? p / 12 : p;
}

function toTime(v: any): number | null {
  if (v == null) return null;
  const t = v instanceof Date ? v.getTime() : new Date(v).getTime();
  return Number.isFinite(t) ? t : null;
}

interface MrrCharge {
  user_id: number;
  chargeId: number;
  price: number;
  intv: string | null;
  status: string | null;
  plan: string;
  test: boolean;
  blocked: boolean;
  activatedTs: number | null;
  cancelledTs: number | null;
}

/**
 * A merchant can have more than one row with status='ACTIVE' (e.g. a plan
 * upgrade where the previous charge was never cancelled, or an outright
 * duplicate). They only pay for ONE subscription, so MRR must count a single
 * active charge per merchant — the most recently activated one. This reduces a
 * list of active charges to one per user (latest activated_on, charge_id tiebreak).
 */
function latestPerMerchant(list: MrrCharge[]): MrrCharge[] {
  const best = new Map<number, MrrCharge>();
  for (const c of list) {
    const cur = best.get(c.user_id);
    if (
      !cur ||
      (c.activatedTs ?? 0) > (cur.activatedTs ?? 0) ||
      ((c.activatedTs ?? 0) === (cur.activatedTs ?? 0) && c.chargeId > cur.chargeId)
    ) {
      best.set(c.user_id, c);
    }
  }
  return Array.from(best.values());
}

export async function getMRR(months = 12) {
  // Fetch BOTH real and test charges in one pass; we split them in JS so the
  // by-plan detail can show test charges alongside the (test-excluded) MRR.
  // Blocked merchants (meta_data.is_user_blocked) are flagged here and dropped
  // below so they never count toward MRR.
  const rows =
    (await safe(() =>
      query<any>(
        `SELECT c.user_id, c.charge_id, c.price, c.\`interval\` AS intv, c.status, c.test,
                c.activated_on, c.cancelled_on,
                COALESCE(p.name, c.name, '(unknown)') AS plan,
                (JSON_VALID(u.meta_data)
                   AND LOWER(JSON_UNQUOTE(JSON_EXTRACT(u.meta_data,'$.is_user_blocked'))) IN ('1','true')) AS blocked
           FROM charges c
           LEFT JOIN plans p ON p.id = c.plan_id
           LEFT JOIN users u ON u.id = c.user_id
          WHERE c.type = 'RECURRING' AND c.deleted_at IS NULL`
      )
    )) || [];

  // Drop blocked merchants entirely — we blocked them, so they are not revenue.
  const charges: MrrCharge[] = rows
    .map((r: any) => ({
      user_id: num(r.user_id),
      chargeId: num(r.charge_id),
      price: num(r.price),
      intv: r.intv,
      status: r.status,
      plan: r.plan || "(unknown)",
      test: num(r.test) === 1,
      blocked: num(r.blocked) === 1,
      activatedTs: toTime(r.activated_on),
      cancelledTs: toTime(r.cancelled_on),
    }))
    .filter((c: MrrCharge) => !c.blocked);

  // ---- current MRR (charges active right now) ----
  // Match MySQL's case-/trailing-space-insensitive `status='ACTIVE'` semantics
  // so the JS reconstruction lines up exactly with SQL aggregates.
  const isActive = (s: string | null) => String(s ?? "").trim().toUpperCase() === "ACTIVE";
  const activeAll = charges.filter((c) => isActive(c.status));
  // Collapse multiple active charges per merchant to their single current one,
  // so a stale/duplicate active row can't double-count toward MRR.
  const activeNow = latestPerMerchant(activeAll.filter((c) => !c.test)); // real MRR contributors
  const activeTest = latestPerMerchant(activeAll.filter((c) => c.test)); // excluded from MRR, shown for visibility
  let mrr = 0;
  const payers = new Set<number>();
  // per-plan accumulator holds both real (MRR) and test charge figures
  const planMap = new Map<
    string,
    { subs: number; mrr: number; testSubs: number; testMrr: number }
  >();
  const planRow = (label: string) => {
    let r = planMap.get(label);
    if (!r) {
      r = { subs: 0, mrr: 0, testSubs: 0, testMrr: 0 };
      planMap.set(label, r);
    }
    return r;
  };
  let annualCount = 0;
  let annualRaw = 0;
  let monthlyCount = 0;
  let monthlyMrr = 0;

  for (const c of activeNow) {
    const mv = monthlyValue(c.price, c.intv);
    mrr += mv;
    // "Paying" = actually contributing revenue; $0 free-plan subscriptions are
    // active but not paying, so they must not dilute paying-merchant count / ARPA.
    if (mv > 0) payers.add(c.user_id);
    const pm = planRow(c.plan);
    pm.subs += 1;
    pm.mrr += mv;
    if (String(c.intv).toUpperCase() === "ANNUAL") {
      annualCount += 1;
      annualRaw += c.price;
    } else {
      monthlyCount += 1;
      monthlyMrr += c.price;
    }
  }

  // fold active test charges into the same plan rows (kept out of MRR)
  let testMrrExcluded = 0;
  for (const c of activeTest) {
    const mv = monthlyValue(c.price, c.intv);
    testMrrExcluded += mv;
    const pm = planRow(c.plan);
    pm.testSubs += 1;
    pm.testMrr += mv;
  }

  const byPlan = Array.from(planMap.entries())
    .map(([label, v]) => ({
      label,
      subscriptions: v.subs,
      mrr: Math.round(v.mrr * 100) / 100,
      avg: v.subs ? Math.round((v.mrr / v.subs) * 100) / 100 : 0,
      share: mrr ? Math.round((v.mrr / mrr) * 1000) / 10 : 0,
      testSubscriptions: v.testSubs,
      testMrr: Math.round(v.testMrr * 100) / 100,
    }))
    .sort((a, b) => b.mrr - a.mrr || b.testMrr - a.testMrr);

  const byInterval = [
    { label: "Monthly (EVERY_30_DAYS)", subscriptions: monthlyCount, mrr: Math.round(monthlyMrr * 100) / 100 },
    { label: "Annual (÷12 to monthly)", subscriptions: annualCount, mrr: Math.round((annualRaw / 12) * 100) / 100 },
  ].filter((r) => r.subscriptions > 0);

  // ---- 12-month MRR time series (reconstructed from activation/cancellation) ----
  // A charge contributes to month M if it was activated on/before month-end and
  // not yet cancelled by month-end. new/churned track movement within the month.
  const now = new Date();
  const series: {
    bucket: string;
    count: number; // = MRR at month end (ColumnChart reads `count`)
    mrr: number;
    newMrr: number;
    churnedMrr: number;
    net: number;
  }[] = [];

  // real (non-test) charges only; test never counts toward the trend
  const realCharges = charges.filter((c) => !c.test && c.activatedTs != null);
  // A charge that is ACTIVE right now has not churned, even if it carries a
  // stale cancelled_on date — trust status over the timestamp.
  const effCancel = (c: MrrCharge) => (isActive(c.status) ? null : c.cancelledTs);

  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthStart = d.getTime();
    const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime() - 1;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

    // Reconstruct month-end MRR one subscription per merchant: among each
    // merchant's charges active at month-end, keep only the latest-activated one
    // (so overlapping plan-change charges don't double-count historically too).
    const bestActive = new Map<number, MrrCharge>();
    let newMrr = 0;
    let churnedMrr = 0;
    for (const c of realCharges) {
      const ec = effCancel(c);
      if (c.activatedTs! <= monthEnd && (ec == null || ec > monthEnd)) {
        const cur = bestActive.get(c.user_id);
        if (!cur || c.activatedTs! > cur.activatedTs! || (c.activatedTs! === cur.activatedTs! && c.chargeId > cur.chargeId)) {
          bestActive.set(c.user_id, c);
        }
      }
      if (c.activatedTs! >= monthStart && c.activatedTs! <= monthEnd) newMrr += monthlyValue(c.price, c.intv);
      if (ec != null && ec >= monthStart && ec <= monthEnd) churnedMrr += monthlyValue(c.price, c.intv);
    }
    let active = 0;
    for (const c of bestActive.values()) active += monthlyValue(c.price, c.intv);
    series.push({
      bucket: key,
      count: Math.round(active * 100) / 100,
      mrr: Math.round(active * 100) / 100,
      newMrr: Math.round(newMrr * 100) / 100,
      churnedMrr: Math.round(churnedMrr * 100) / 100,
      net: Math.round((newMrr - churnedMrr) * 100) / 100,
    });
  }

  // month-over-month growth on the reconstructed series
  const last = series[series.length - 1]?.mrr ?? 0;
  const prev = series[series.length - 2]?.mrr ?? 0;
  const momGrowth = prev ? ((last - prev) / prev) * 100 : 0;

  // top active subscriptions (the detail behind the number). Each row is one
  // merchant's subscription — include the shop so equally-priced rows (e.g. lots
  // of $49.99 Business plans) are distinguishable rather than looking duplicated.
  const topSlice = [...activeNow]
    .sort((a, b) => monthlyValue(b.price, b.intv) - monthlyValue(a.price, a.intv))
    .slice(0, 25);
  const topIds = Array.from(new Set(topSlice.map((c) => c.user_id))).filter(Boolean);
  const shopInfo = new Map<number, { name: string; website: string | null }>();
  if (topIds.length) {
    await safe(async () => {
      const us = await query<any>(
        `SELECT id, name, email,
                CASE WHEN JSON_VALID(meta_data)
                     THEN NULLIF(JSON_UNQUOTE(JSON_EXTRACT(meta_data,'$.storefront_domain')),'')
                     END AS website
           FROM users WHERE id IN (?)`,
        [topIds]
      );
      us.forEach((u) =>
        shopInfo.set(num(u.id), {
          name: u.name || u.email || `Shop #${u.id}`,
          website: u.website && u.website !== "null" ? String(u.website) : null,
        })
      );
    });
  }
  const topSubs = topSlice.map((c) => {
    const info = shopInfo.get(c.user_id);
    return {
      shopId: c.user_id,
      shop: info?.name || `Shop #${c.user_id}`,
      // real store website from meta_data.storefront_domain (may differ from the
      // myshopify name); null when we don't have it.
      website: info?.website || null,
      plan: c.plan,
      interval: String(c.intv).toUpperCase() === "ANNUAL" ? "Annual" : "Monthly",
      price: c.price,
      monthly: Math.round(monthlyValue(c.price, c.intv) * 100) / 100,
    };
  });

  const testActiveRaw = activeTest.reduce((s, c) => s + c.price, 0);
  // The original buggy figure: SUM(price) of EVERY active charge — including
  // test, blocked merchants and duplicate active rows, with annual NOT
  // normalized. Computed from the raw rows so it stays a fixed "before" baseline.
  const naiveActiveRevenue = rows
    .filter((r: any) => isActive(r.status))
    .reduce((s: number, r: any) => s + num(r.price), 0);
  const payingMerchants = payers.size;

  return {
    mrr: Math.round(mrr * 100) / 100,
    arr: Math.round(mrr * 12 * 100) / 100,
    activeSubs: activeNow.length,
    payingMerchants,
    arpa: payingMerchants ? Math.round((mrr / payingMerchants) * 100) / 100 : 0,
    momGrowth: Math.round(momGrowth * 10) / 10,
    annual: {
      count: annualCount,
      rawAnnual: Math.round(annualRaw * 100) / 100,
      monthlyEquivalent: Math.round((annualRaw / 12) * 100) / 100,
    },
    monthly: { count: monthlyCount, mrr: Math.round(monthlyMrr * 100) / 100 },
    test: {
      excludedActive: activeTest.length,
      excludedActiveRaw: Math.round(testActiveRaw * 100) / 100,
      excludedActiveMrr: Math.round(testMrrExcluded * 100) / 100,
      excludedTotal: charges.filter((c) => c.test).length,
    },
    // the old, incorrect figure (sum of all active prices incl. test, annual not
    // normalized) — surfaced so the page can show what was being over-reported.
    naiveActiveRevenue: Math.round(naiveActiveRevenue * 100) / 100,
    byPlan,
    byInterval,
    series,
    topSubs,
  };
}

// --------------------------------------------------------------------------
// NOTIFICATIONS (master signups + delivery)
// --------------------------------------------------------------------------
export interface NotifFilters {
  feature?: string;
  channel?: string;
  from?: string;
  to?: string;
}

function sqlStr(v: string): string {
  return "'" + String(v).replace(/'/g, "''") + "'";
}
function validDate(v?: string): string | null {
  return v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
}

export async function getNotifications(f: NotifFilters = {}) {
  // base WHERE (feature + channel + date) applied to all variant_stock_notifications metrics
  const conds: string[] = [];
  if (f.feature) conds.push(`fun_type = ${sqlStr(f.feature)}`);
  if (f.channel) conds.push(`type = ${sqlStr(f.channel)}`);
  const from = validDate(f.from);
  const to = validDate(f.to);
  if (from) conds.push(`created_at >= ${sqlStr(from + " 00:00:00")}`);
  if (to) conds.push(`created_at <= ${sqlStr(to + " 23:59:59")}`);
  const base = conds.length ? conds.join(" AND ") : undefined;
  const and = (extra: string) => (base ? `${base} AND ${extra}` : extra);

  // delivery tables (bis_mails / sms) have created_at but no fun_type/type -> date filter only
  const dconds: string[] = [];
  if (from) dconds.push(`created_at >= ${sqlStr(from + " 00:00:00")}`);
  if (to) dconds.push(`created_at <= ${sqlStr(to + " 23:59:59")}`);
  const dbase = dconds.length ? dconds.join(" AND ") : undefined;

  const [
    total,
    sent,
    inQueue,
    pending,
    autoSent,
    sentToAdmin,
    byFeature,
    byChannel,
    byMailChannel,
    signupsByMonth,
    sentByMonth,
    byCountry,
    emailDelivery,
    smsWhatsapp,
    partialRestock,
    optFeatures,
    optChannels,
  ] = await Promise.all([
    safe(() => count("variant_stock_notifications", base)),
    safe(() => count("variant_stock_notifications", and("is_sent IS NOT NULL"))),
    safe(() => count("variant_stock_notifications", and("in_queue = 1"))),
    safe(() => count("variant_stock_notifications", and("is_sent IS NULL AND in_queue = 0"))),
    safe(() => count("variant_stock_notifications", and("is_auto_sent = 1"))),
    safe(() => count("variant_stock_notifications", and("sent_to_admin = 1"))),
    safe(() => groupCount("variant_stock_notifications", "fun_type", { where: base, limit: 10 })),
    safe(() => groupCount("variant_stock_notifications", "type", { where: base, limit: 15 })),
    safe(() => groupCount("variant_stock_notifications", "mail_channel", { where: base, limit: 10 })),
    safe(() => monthly("variant_stock_notifications", "created_at", base, 12)),
    safe(() => monthly("variant_stock_notifications", "is_sent", base, 12)),
    safe(() =>
      groupCount("variant_stock_notifications", "country", {
        where: and("country IS NOT NULL AND country <> ''"),
        limit: 20,
      })
    ),
    safe(async () => {
      const byChan = await query<{ label: string; c: number; s: number }>(
        `SELECT COALESCE(channel,'(empty)') label, COUNT(*) c, SUM(sent_count) s
           FROM bis_mails ${dbase ? `WHERE ${dbase}` : ""} GROUP BY label ORDER BY c DESC LIMIT 10`
      );
      return byChan.map((r) => ({ label: r.label, count: num(r.c), sent: num(r.s) }));
    }),
    safe(() => groupCount("sent_s_m_s_responses", "whatsapp_status", { where: dbase, limit: 10 })),
    safe(() => count("partial_restock_sends", dbase)),
    // unfiltered option lists for the filter dropdowns
    safe(() => groupCount("variant_stock_notifications", "fun_type", { limit: 25 })),
    safe(() => groupCount("variant_stock_notifications", "type", { limit: 25 })),
  ]);

  return {
    filters: { feature: f.feature || "", channel: f.channel || "", from: from || "", to: to || "" },
    options: {
      features: (optFeatures || []).map((x) => x.label),
      channels: (optChannels || []).map((x) => x.label),
    },
    total,
    sent,
    inQueue,
    pending,
    autoSent,
    sentToAdmin,
    byFeature: byFeature || [],
    byChannel: byChannel || [],
    byMailChannel: byMailChannel || [],
    signupsByMonth: signupsByMonth || [],
    sentByMonth: sentByMonth || [],
    byCountry: byCountry || [],
    emailDelivery: emailDelivery || [],
    smsWhatsapp: smsWhatsapp || [],
    partialRestock,
  };
}

// --------------------------------------------------------------------------
// FEATURES (the 4 features + upsell)
// --------------------------------------------------------------------------
export async function getFeatures() {
  const [
    // Back in Stock
    bisSignups,
    bisSent,
    popups,
    settingsSendType,
    settingsConfig,
    settingsNotifyMe,
    settingsDomain,
    // Price drop
    priceDropConfigs,
    priceDropSignups,
    // Sale alerts
    saleAlertConfigs,
    saleAlertSignups,
    // Pre-order
    preorderOffers,
    preorderOffersByStatus,
    preorderOffersByPayment,
    preorderOffersByType,
    preorderOrders,
    preorderOrdersByStatus,
    preorderRevenue,
    preorderNotifByType,
    preorderNotifByChannel,
    preorderNotifByStatus,
    // Upsell
    upsellByEvent,
    upsellAgg,
  ] = await Promise.all([
    safe(() => count("variant_stock_notifications", "fun_type='notify_me'")),
    safe(() => count("variant_stock_notifications", "fun_type='notify_me' AND is_sent IS NOT NULL")),
    safe(() => count("popups")),
    safe(() => groupCount("variant_stock_notification_settings", "send_notification_type", { limit: 10 })),
    safe(() => groupCount("variant_stock_notification_settings", "configuration_type", { limit: 10 })),
    safe(() => groupCount("variant_stock_notification_settings", "notify_me", { limit: 10 })),
    safe(() => groupCount("variant_stock_notification_settings", "bis_domain_status", { limit: 10 })),

    safe(() => count("pricedrops")),
    safe(() => count("variant_stock_notifications", "fun_type='price_drop'")),

    safe(() => count("sale_alerts")),
    safe(() => count("variant_stock_notifications", "fun_type='sales_alert'")),

    safe(() => count("preorder_offers")),
    safe(() => groupCount("preorder_offers", "status", { limit: 10 })),
    safe(() => groupCount("preorder_offers", "payment_mode", { limit: 10 })),
    safe(() => groupCount("preorder_offers", "product_type", { limit: 10 })),
    safe(() => count("preorder_orders")),
    safe(() => groupCount("preorder_orders", "fulfillment_status", { limit: 10 })),
    safe(async () =>
      num((await scalarRow<{ c: number }>(`SELECT SUM(total_price) c FROM preorder_orders`)).c)
    ),
    safe(() => groupCount("preorder_notification_logs", "notification_type", { limit: 10 })),
    safe(() => groupCount("preorder_notification_logs", "channel", { limit: 10 })),
    safe(() => groupCount("preorder_notification_logs", "status", { limit: 10 })),

    safe(() => groupCount("upsell_events", "event_type", { limit: 10 })),
    safe(() =>
      scalarRow(
        `SELECT SUM(impressions) impressions, SUM(clicks) clicks, SUM(orders) orders, SUM(revenue) revenue
           FROM upsell_analytics_daily`
      )
    ),
  ]);

  const u: any = upsellAgg || {};
  const impressions = num(u.impressions);
  const clicks = num(u.clicks);

  return {
    backInStock: {
      signups: bisSignups,
      sent: bisSent,
      popups,
      settings: {
        sendType: settingsSendType || [],
        configuration: settingsConfig || [],
        notifyMe: settingsNotifyMe || [],
        domainStatus: settingsDomain || [],
      },
    },
    priceDrop: { configs: priceDropConfigs, signups: priceDropSignups },
    saleAlerts: { configs: saleAlertConfigs, signups: saleAlertSignups },
    preorder: {
      offers: preorderOffers,
      offersByStatus: preorderOffersByStatus || [],
      offersByPayment: preorderOffersByPayment || [],
      offersByType: preorderOffersByType || [],
      orders: preorderOrders,
      ordersByStatus: preorderOrdersByStatus || [],
      revenue: preorderRevenue,
      notifByType: preorderNotifByType || [],
      notifByChannel: preorderNotifByChannel || [],
      notifByStatus: preorderNotifByStatus || [],
    },
    upsell: {
      byEvent: upsellByEvent || [],
      impressions,
      clicks,
      orders: num(u.orders),
      revenue: num(u.revenue),
      ctr: impressions ? (clicks / impressions) * 100 : 0,
    },
  };
}

// --------------------------------------------------------------------------
// CONVERSION & REVENUE  ("how/what converts shoppers & merchants")
// --------------------------------------------------------------------------
export async function getConversion() {
  const [funnel, revByMonth, ordersByMonth, attribution, topProducts, merchantConv] =
    await Promise.all([
      safe(() =>
        scalarRow(
          `SELECT SUM(total_alerts_sent) sent, SUM(delivered) delivered, SUM(opened) opened,
                  SUM(clicked) clicked, SUM(orders_generated) orders, SUM(revenue_generated) revenue,
                  AVG(NULLIF(conversion_rate,0)) avg_conv, AVG(NULLIF(avg_order_value,0)) aov
             FROM bis_analytics_daily`
        )
      ),
      safe(() => sumMonthly("bis_analytics_daily", "report_date", "revenue_generated", 12)),
      safe(() => sumMonthly("bis_analytics_daily", "report_date", "orders_generated", 12)),
      safe(() =>
        scalarRow(
          `SELECT COUNT(*) total_orders, SUM(total_price) total_rev,
                  SUM(is_bis_order) bis_orders, SUM(is_upsell_order) upsell_orders,
                  SUM(CASE WHEN is_bis_order=1 THEN total_price ELSE 0 END) bis_rev,
                  SUM(CASE WHEN is_upsell_order=1 THEN total_price ELSE 0 END) upsell_rev
             FROM analytics_orders`
        )
      ),
      safe(() =>
        query(
          `SELECT product_title label, SUM(revenue_generated) revenue,
                  SUM(orders_generated) orders, SUM(alerts_sent) alerts
             FROM bis_analytics_products
            GROUP BY product_title ORDER BY revenue DESC LIMIT 20`
        ).then((r) =>
          r.map((x: any) => ({
            label: x.label || "(untitled)",
            revenue: num(x.revenue),
            orders: num(x.orders),
            alerts: num(x.alerts),
          }))
        )
      ),
      safe(() =>
        scalarRow(
          `SELECT
             (SELECT COUNT(*) FROM users WHERE deleted_at IS NULL) active,
             (SELECT COUNT(DISTINCT user_id) FROM charges WHERE status='ACTIVE' AND deleted_at IS NULL AND test=0) paying,
             (SELECT COUNT(*) FROM users WHERE deleted_at IS NULL AND shopify_freemium=1) freemium`
        )
      ),
    ]);

  const f: any = funnel || {};
  const a: any = attribution || {};
  const m: any = merchantConv || {};
  const active = num(m.active);
  const paying = num(m.paying);

  return {
    funnel: {
      sent: num(f.sent),
      delivered: num(f.delivered),
      opened: num(f.opened),
      clicked: num(f.clicked),
      orders: num(f.orders),
      revenue: num(f.revenue),
      avgConversionRate: num(f.avg_conv),
      avgOrderValue: num(f.aov),
    },
    revByMonth: revByMonth || [],
    ordersByMonth: ordersByMonth || [],
    attribution: {
      totalOrders: num(a.total_orders),
      totalRevenue: num(a.total_rev),
      bisOrders: num(a.bis_orders),
      upsellOrders: num(a.upsell_orders),
      bisRevenue: num(a.bis_rev),
      upsellRevenue: num(a.upsell_rev),
    },
    topProducts: topProducts || [],
    merchantConversion: {
      active,
      paying,
      freemium: num(m.freemium),
      paidRate: active ? (paying / active) * 100 : 0,
    },
  };
}

// ==========================================================================
// SHOPS EXPLORER  (per-merchant stats + filters)
// ==========================================================================
export interface ShopFilters {
  search?: string;
  planId?: string;
  status?: "active" | "churned" | "all";
  features?: string[];
  from?: string;
  to?: string;
  sort?: string;
  dir?: "asc" | "desc";
  blocked?: "all" | "blocked" | "notblocked";
  page?: number;
  pageSize?: number;
}

export async function getPlanOptions() {
  return safe(() =>
    query<{ id: number; name: string }>(
      `SELECT MIN(id) id, name FROM plans WHERE name IS NOT NULL AND name <> '' GROUP BY name ORDER BY name ASC`
    ).then((r) => r.map((x) => ({ id: x.id, name: x.name })))
  );
}

// Per-feature shop-id sets, computed once via a single grouped scan and cached.
// Filtering by feature is then a fast `u.id IN (...)` instead of EXISTS-per-row.
export interface FeatureSets {
  counts: { key: string; label: string; count: number }[];
  sets: Record<string, Set<number>>;
}

export async function getFeatureSets(): Promise<FeatureSets> {
  const [vsnRows, preRows] = await Promise.all([
    safe(() =>
      query<any>(
        `SELECT fun_type, user_id FROM variant_stock_notifications
          WHERE fun_type IN ('notify_me','price_drop','sales_alert')
          GROUP BY fun_type, user_id`
      )
    ),
    safe(() => query<any>(`SELECT DISTINCT user_id FROM preorder_offers`)),
  ]);
  const sets: Record<string, Set<number>> = {
    notify_me: new Set(),
    price_drop: new Set(),
    sales_alert: new Set(),
    preorder: new Set(),
  };
  (vsnRows || []).forEach((r: any) => {
    const set = sets[String(r.fun_type)];
    if (set) set.add(num(r.user_id));
  });
  (preRows || []).forEach((r: any) => sets.preorder.add(num(r.user_id)));
  const counts = [
    { key: "notify_me", label: "Back in Stock", count: sets.notify_me.size },
    { key: "price_drop", label: "Price Drop", count: sets.price_drop.size },
    { key: "sales_alert", label: "Sale Alerts", count: sets.sales_alert.size },
    { key: "preorder", label: "Pre-orders", count: sets.preorder.size },
  ];
  return { counts, sets };
}

// How many DISTINCT shops use each feature (overall).
export async function getFeatureUsage() {
  return (await cached("featureSets", 600_000, getFeatureSets)).counts;
}

export async function getShops(f: ShopFilters) {
  const page = Math.max(1, Number(f.page) || 1);
  const pageSize = Math.min(200, Math.max(1, Number(f.pageSize) || 25));
  const offset = (page - 1) * pageSize;

  const where: string[] = [];
  const params: any[] = [];
  if (f.status === "active") where.push("u.deleted_at IS NULL");
  else if (f.status === "churned") where.push("u.deleted_at IS NOT NULL");
  if (f.planId) {
    // f.planId carries the plan NAME (names can map to several plan rows)
    where.push("EXISTS (SELECT 1 FROM plans pp WHERE pp.id = u.plan_id AND pp.name = ?)");
    params.push(f.planId);
  }
  if (f.search && f.search.trim()) {
    where.push("(u.name LIKE ? OR u.email LIKE ?)");
    const like = `%${f.search.trim()}%`;
    params.push(like, like);
  }
  if (f.from) {
    where.push("u.created_at >= ?");
    params.push(f.from + " 00:00:00");
  }
  if (f.to) {
    where.push("u.created_at <= ?");
    params.push(f.to + " 23:59:59");
  }
  if (f.features && f.features.length) {
    const { sets } = await cached("featureSets", 600_000, getFeatureSets);
    const allowed = new Set<number>();
    for (const k of f.features) {
      const set = (sets as Record<string, Set<number>>)[k];
      if (set) set.forEach((id) => allowed.add(id));
    }
    if (allowed.size === 0) {
      return {
        shops: [],
        page,
        pageSize,
        totalRows: 0,
        totalPages: 1,
        planOptions: (await getPlanOptions()) || [],
        appliedFeatures: f.features,
      };
    }
    where.push(`u.id IN (${Array.from(allowed).join(",")})`);
  }
  if (f.blocked === "blocked") {
    where.push("(JSON_VALID(u.meta_data) AND LOWER(JSON_UNQUOTE(JSON_EXTRACT(u.meta_data,'$.is_user_blocked'))) IN ('1','true'))");
  } else if (f.blocked === "notblocked") {
    where.push("NOT (JSON_VALID(u.meta_data) AND LOWER(JSON_UNQUOTE(JSON_EXTRACT(u.meta_data,'$.is_user_blocked'))) IN ('1','true'))");
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const sortMap: Record<string, string> = {
    created_at: "u.created_at",
    name: "u.name",
    plan: "p.name",
  };
  const sortCol = sortMap[f.sort || "created_at"] || "u.created_at";
  const dir = f.dir === "asc" ? "ASC" : "DESC";

  const totalRow = await query<{ c: number }>(
    `SELECT COUNT(*) c FROM users u LEFT JOIN plans p ON p.id=u.plan_id ${whereSql}`,
    params
  );
  const totalRows = num(totalRow[0]?.c);

  const rows = await query<any>(
    `SELECT u.id, u.name, u.email, u.plan_id, COALESCE(p.name, (SELECT c.name FROM charges c WHERE c.user_id=u.id AND c.status='ACTIVE' ORDER BY c.activated_on DESC LIMIT 1), (SELECT c.name FROM charges c WHERE c.user_id=u.id ORDER BY c.activated_on DESC LIMIT 1), IF(u.plan_id IS NULL, 'FREE_USER', CONCAT('Plan #', u.plan_id))) plan,
            p.price plan_price, u.shopify_freemium, u.shop_current_language,
            u.created_at, u.deleted_at,
            CASE WHEN JSON_VALID(u.meta_data)
                 THEN LOWER(JSON_UNQUOTE(JSON_EXTRACT(u.meta_data,'$.is_user_blocked')))
                 END blocked_raw
       FROM users u LEFT JOIN plans p ON p.id=u.plan_id
       ${whereSql} ORDER BY ${sortCol} ${dir} LIMIT ${pageSize} OFFSET ${offset}`,
    params
  );

  const ids = rows.map((r) => r.id);
  const sig = new Map<number, { signups: number; sent: number }>();
  const earn = new Map<number, { revenue: number; orders: number }>();
  const charged = new Map<number, number>();
  const usage = new Map<number, number>();

  if (ids.length) {
    await Promise.all([
      safe(async () => {
        const r = await query<any>(
          `SELECT user_id, COUNT(*) signups, SUM(is_sent IS NOT NULL) sent
             FROM variant_stock_notifications WHERE user_id IN (?) GROUP BY user_id`,
          [ids]
        );
        r.forEach((x) => sig.set(num(x.user_id), { signups: num(x.signups), sent: num(x.sent) }));
      }),
      safe(async () => {
        const r = await query<any>(
          `SELECT user_id, SUM(revenue_generated) revenue, SUM(orders_generated) orders
             FROM bis_analytics_daily WHERE user_id IN (?) GROUP BY user_id`,
          [ids]
        );
        r.forEach((x) => earn.set(num(x.user_id), { revenue: num(x.revenue), orders: num(x.orders) }));
      }),
      safe(async () => {
        const r = await query<any>(
          `SELECT user_id, SUM(price) total FROM charges
            WHERE status='ACTIVE' AND deleted_at IS NULL AND test=0 AND user_id IN (?) GROUP BY user_id`,
          [ids]
        );
        r.forEach((x) => charged.set(num(x.user_id), num(x.total)));
      }),
      safe(async () => {
        const r = await query<any>(
          `SELECT user_id, SUM(price) total FROM shopify_usage_base_charges
            WHERE user_id IN (?) GROUP BY user_id`,
          [ids]
        );
        r.forEach((x) => usage.set(num(x.user_id), num(x.total)));
      }),
    ]);
  }

  const shops = rows.map((r) => ({
    id: r.id,
    name: r.name,
    email: r.email,
    plan: r.plan,
    planPrice: num(r.plan_price),
    status: r.deleted_at ? "churned" : "active",
    freemium: !!r.shopify_freemium,
    language: r.shop_current_language || "",
    createdAt: r.created_at,
    deletedAt: r.deleted_at,
    signups: sig.get(r.id)?.signups || 0,
    alertsSent: sig.get(r.id)?.sent || 0,
    appRevenue: earn.get(r.id)?.revenue || 0,
    appOrders: earn.get(r.id)?.orders || 0,
    recurringCharged: charged.get(r.id) || 0,
    usageCharged: usage.get(r.id) || 0,
    blocked: r.blocked_raw === "1" || r.blocked_raw === "true",
  }));

  return {
    shops,
    page,
    pageSize,
    totalRows,
    totalPages: Math.max(1, Math.ceil(totalRows / pageSize)),
    planOptions: (await getPlanOptions()) || [],
    appliedFeatures: f.features || [],
  };
}

// ==========================================================================
// SHOP DETAIL  (everything about one merchant)
// ==========================================================================
export async function getShopDetail(idRaw: string | number) {
  const id = Number(idRaw);
  if (!Number.isFinite(id)) throw new Error("Invalid shop id");

  const profile = await safe(() =>
    query<any>(
      `SELECT u.*, COALESCE(p.name, (SELECT c.name FROM charges c WHERE c.user_id=u.id AND c.status='ACTIVE' ORDER BY c.activated_on DESC LIMIT 1), (SELECT c.name FROM charges c WHERE c.user_id=u.id ORDER BY c.activated_on DESC LIMIT 1), IF(u.plan_id IS NULL, 'FREE_USER', CONCAT('Plan #', u.plan_id))) plan_name, p.price plan_price, p.\`interval\` plan_interval
         FROM users u LEFT JOIN plans p ON p.id=u.plan_id WHERE u.id=? LIMIT 1`,
      [id]
    ).then((r) => r[0] || null)
  );
  if (!profile) return { found: false };

  const [
    chargesList,
    chargeActive,
    chargeCancelled,
    activeRecurring,
    lifetimeCharged,
    usageTotal,
    usageByMonth,
    notifTotal,
    notifSent,
    notifByFeature,
    notifByChannel,
    notifByMonth,
    funnel,
    topProducts,
    preorderOrders,
    preorderRevenue,
    settings,
    recentSignups,
  ] = await Promise.all([
    safe(() =>
      query<any>(
        `SELECT name, status, price, \`interval\`, trial_days, activated_on, trial_ends_on,
                cancelled_on, billing_on, created_at
           FROM charges WHERE user_id=? ORDER BY created_at DESC LIMIT 100`,
        [id]
      )
    ),
    safe(() => count("charges", `user_id=${id} AND status='ACTIVE' AND deleted_at IS NULL AND test=0`)),
    safe(() => count("charges", `user_id=${id} AND status='CANCELLED' AND test=0`)),
    safe(async () =>
      num((await scalarRow<{ c: number }>(
        // active recurring revenue (MRR) for this shop — test excluded, annual normalized
        `SELECT SUM(CASE WHEN \`interval\`='ANNUAL' THEN price/12 ELSE price END) c
           FROM charges WHERE user_id=${id} AND status='ACTIVE' AND deleted_at IS NULL AND test=0`
      )).c)
    ),
    safe(async () =>
      num((await scalarRow<{ c: number }>(
        `SELECT SUM(price) c FROM charges WHERE user_id=${id} AND test=0`
      )).c)
    ),
    safe(async () =>
      num((await scalarRow<{ c: number }>(
        `SELECT SUM(price) c FROM shopify_usage_base_charges WHERE user_id=${id}`
      )).c)
    ),
    safe(() => sumMonthly("shopify_usage_base_charges", "created_at", "price", 12, `user_id=${id}`)),
    safe(() => count("variant_stock_notifications", `user_id=${id}`)),
    safe(() => count("variant_stock_notifications", `user_id=${id} AND is_sent IS NOT NULL`)),
    safe(() => groupCount("variant_stock_notifications", "fun_type", { where: `user_id=${id}`, limit: 10 })),
    safe(() => groupCount("variant_stock_notifications", "type", { where: `user_id=${id}`, limit: 15 })),
    safe(() => monthly("variant_stock_notifications", "created_at", `user_id=${id}`, 12)),
    safe(() =>
      scalarRow(
        `SELECT SUM(total_alerts_sent) sent, SUM(delivered) delivered, SUM(opened) opened,
                SUM(clicked) clicked, SUM(orders_generated) orders, SUM(revenue_generated) revenue
           FROM bis_analytics_daily WHERE user_id=${id}`
      )
    ),
    safe(() =>
      query<any>(
        `SELECT bap.product_title label, bap.product_id product_id,
                MAX(pr.product_handle) handle,
                SUM(bap.revenue_generated) revenue, SUM(bap.orders_generated) orders,
                SUM(bap.alerts_sent) alerts
           FROM bis_analytics_products bap
           LEFT JOIN products pr ON pr.user_id = bap.user_id
             AND pr.shopify_product_id = CAST(bap.product_id AS CHAR)
          WHERE bap.user_id=? GROUP BY bap.product_id, bap.product_title
          ORDER BY revenue DESC LIMIT 15`,
        [id]
      ).then((r) =>
        r.map((x: any) => ({
          label: x.label || "(untitled)",
          productId: x.product_id != null ? String(x.product_id) : null,
          handle: x.handle || null,
          revenue: num(x.revenue),
          orders: num(x.orders),
          alerts: num(x.alerts),
        }))
      )
    ),
    safe(() => count("preorder_orders", `user_id=${id}`)),
    safe(async () =>
      num((await scalarRow<{ c: number }>(`SELECT SUM(total_price) c FROM preorder_orders WHERE user_id=${id}`)).c)
    ),
    safe(() =>
      query<any>(
        `SELECT send_notification_type, configuration_type, notify_me, sender_email, sender_name,
                bis_domain, bis_domain_status, bis_domain_dkim_status, product_request_notification
           FROM variant_stock_notification_settings WHERE user_id=? LIMIT 1`,
        [id]
      ).then((r) => r[0] || null)
    ),
    safe(() =>
      query<any>(
        `SELECT id, reference_number, email, name, translated_product_title product, type, fun_type,
                mail_channel, is_sent, sent_count, country, created_at
           FROM variant_stock_notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 25`,
        [id]
      )
    ),
  ]);

  const f: any = funnel || {};
  // strip noisy/sensitive raw fields from profile
  const { password, remember_token, refresh_token, ...safeProfile } = profile || {};

  // "Blocked by us" lives inside users.meta_data (JSON). Detect it robustly:
  // any key containing "block" (except the theme-capability is_app_block_supported)
  // or any value equal to "blocked". Surface the exact key/value for verification.
  let blocked = false;
  let blockedKey: string | null = null;
  let blockedValue: any = null;
  try {
    const md =
      typeof profile.meta_data === "string"
        ? JSON.parse(profile.meta_data)
        : profile.meta_data;
    if (md && typeof md === "object") {
      const truthy = (v: any) =>
        v === true ||
        v === 1 ||
        v === "1" ||
        (typeof v === "string" && /^(true|yes|1|block(ed)?|suspend(ed)?)$/i.test(v.trim()));
      // Exact, known key first (set by the app when an admin blocks a merchant).
      if ("is_user_blocked" in (md as Record<string, any>)) {
        blockedKey = "is_user_blocked";
        blockedValue = (md as Record<string, any>).is_user_blocked;
        blocked = truthy(blockedValue);
      }
      for (const [k, v] of Object.entries(md as Record<string, any>)) {
        if (blocked) break;
        const keyHit = /block|suspend|ban/i.test(k) && !/is_app_block_supported/i.test(k);
        const valHit = typeof v === "string" && /^(blocked?|suspended?|banned?)$/i.test(v.trim());
        if (keyHit || valHit) {
          blockedKey = k;
          blockedValue = v;
          blocked = keyHit ? truthy(v) : true;
          if (blocked) break; // prefer the first key that is actually set
        }
      }
    }
  } catch {
    /* meta_data not valid JSON — ignore */
  }

  // which of the four features this shop is using (from the cached usage sets)
  const fsets = (await cached("featureSets", 600_000, getFeatureSets)).sets as Record<string, Set<number>>;
  const featureStatus = EMAIL_FEATURES.map((ft) => ({
    key: ft.key,
    label: ft.label,
    enabled: !!fsets[ft.key]?.has(id),
  }));

  return {
    found: true,
    profile: {
      id: profile.id,
      name: profile.name,
      email: profile.email,
      plan: profile.plan_name,
      planPrice: num(profile.plan_price),
      planInterval: profile.plan_interval,
      status: profile.deleted_at ? "churned" : "active",
      freemium: !!profile.shopify_freemium,
      grandfathered: !!profile.shopify_grandfathered,
      language: profile.shop_current_language,
      installedAt: profile.created_at,
      uninstalledAt: profile.deleted_at,
      blocked,
      blockedKey,
      blockedValue,
    },
    features: featureStatus,
    billing: {
      charges: chargesList || [],
      activeCount: chargeActive,
      cancelledCount: chargeCancelled,
      activeRecurring,
      lifetimeCharged,
      usageTotal,
      usageByMonth: usageByMonth || [],
    },
    notifications: {
      total: notifTotal,
      sent: notifSent,
      byFeature: notifByFeature || [],
      byChannel: notifByChannel || [],
      byMonth: notifByMonth || [],
      recent: recentSignups || [],
    },
    earnings: {
      sent: num(f.sent),
      delivered: num(f.delivered),
      opened: num(f.opened),
      clicked: num(f.clicked),
      orders: num(f.orders),
      revenue: num(f.revenue),
      topProducts: topProducts || [],
    },
    preorder: { orders: preorderOrders, revenue: preorderRevenue },
    settings: settings || null,
    rawProfile: safeProfile,
  };
}


// ==========================================================================
// NOTIFICATION ROWS  (paginated; kind = "collected" (all) | "sent")
// ==========================================================================
export interface NotifRowFilters extends NotifFilters {
  kind?: "collected" | "sent";
  page?: number;
  pageSize?: number;
}

export async function getNotificationRows(f: NotifRowFilters) {
  const conds: string[] = [];
  if (f.feature) conds.push(`fun_type = ${sqlStr(f.feature)}`);
  if (f.channel) conds.push(`type = ${sqlStr(f.channel)}`);
  const from = validDate(f.from);
  const to = validDate(f.to);
  if (from) conds.push(`created_at >= ${sqlStr(from + " 00:00:00")}`);
  if (to) conds.push(`created_at <= ${sqlStr(to + " 23:59:59")}`);
  const kind = f.kind === "sent" ? "sent" : "collected";
  if (kind === "sent") conds.push("is_sent IS NOT NULL");
  const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";

  const page = Math.max(1, Number(f.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(f.pageSize) || 20));
  const offset = (page - 1) * pageSize;
  const orderCol = kind === "sent" ? "is_sent" : "created_at";

  const totalRow = await query<{ c: number }>(
    `SELECT COUNT(*) c FROM variant_stock_notifications ${where}`
  );
  const totalRows = num(totalRow[0]?.c);

  const rows = await query<any>(
    `SELECT user_id, reference_number, created_at, is_sent, email, name,
            translated_product_title product, type, fun_type, mail_channel,
            sent_count, country
       FROM variant_stock_notifications ${where}
      ORDER BY ${orderCol} DESC LIMIT ${pageSize} OFFSET ${offset}`
  );

  const ids = Array.from(new Set(rows.map((r) => num(r.user_id)))).filter(Boolean);
  const shopMap = new Map<number, string>();
  if (ids.length) {
    const us = await query<any>(`SELECT id, name FROM users WHERE id IN (?)`, [ids]);
    us.forEach((u) => shopMap.set(num(u.id), u.name));
  }

  const mapped = rows.map((r) => ({
    shop: shopMap.get(num(r.user_id)) || `#${r.user_id}`,
    shopper_email: r.email,
    shopper: r.name,
    product: r.product,
    feature: r.fun_type,
    channel: r.type,
    mail_channel: r.mail_channel,
    status: r.is_sent ? "sent" : "pending",
    sent_at: r.is_sent || null,
    sent_count: num(r.sent_count),
    country: r.country,
    requested_at: r.created_at,
    ref: r.reference_number,
  }));

  return {
    kind,
    rows: mapped,
    page,
    pageSize,
    totalRows,
    totalPages: Math.max(1, Math.ceil(totalRows / pageSize)),
  };
}

// ==========================================================================
// STORE-WISE NOTIFICATIONS  (one row per shop: collected vs sent per feature)
// ==========================================================================
export interface StoreNotifFilters {
  channel?: string;
  from?: string;
  to?: string;
  sort?: "collected" | "sent";
  page?: number;
  pageSize?: number;
}

export async function getStoreNotifications(f: StoreNotifFilters) {
  const conds: string[] = [];
  if (f.channel) conds.push(`type = ${sqlStr(f.channel)}`);
  const from = validDate(f.from);
  const to = validDate(f.to);
  if (from) conds.push(`created_at >= ${sqlStr(from + " 00:00:00")}`);
  if (to) conds.push(`created_at <= ${sqlStr(to + " 23:59:59")}`);
  const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";

  const page = Math.max(1, Number(f.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(f.pageSize) || 20));
  const offset = (page - 1) * pageSize;
  const orderCol = f.sort === "sent" ? "total_s" : "total_c";

  const totalRow = await query<{ c: number }>(
    `SELECT COUNT(DISTINCT user_id) c FROM variant_stock_notifications ${where}`
  );
  const totalRows = num(totalRow[0]?.c);

  // Per-store collected/sent counts for the 3 fun_type features (one scan).
  const agg = await query<any>(
    `SELECT user_id,
        SUM(fun_type='notify_me') nm_c,
        SUM(fun_type='notify_me' AND is_sent IS NOT NULL) nm_s,
        SUM(fun_type='price_drop') pd_c,
        SUM(fun_type='price_drop' AND is_sent IS NOT NULL) pd_s,
        SUM(fun_type='sales_alert') sa_c,
        SUM(fun_type='sales_alert' AND is_sent IS NOT NULL) sa_s,
        COUNT(*) total_c,
        SUM(is_sent IS NOT NULL) total_s
       FROM variant_stock_notifications ${where}
      GROUP BY user_id
      ORDER BY ${orderCol} DESC
      LIMIT ${pageSize} OFFSET ${offset}`
  );

  const ids = agg.map((r) => num(r.user_id)).filter(Boolean);
  const shopMap = new Map<number, { name: string; plan: string }>();
  const preMap = new Map<number, { c: number; s: number }>();

  if (ids.length) {
    const pconds: string[] = [`user_id IN (${ids.join(",")})`];
    if (from) pconds.push(`created_at >= ${sqlStr(from + " 00:00:00")}`);
    if (to) pconds.push(`created_at <= ${sqlStr(to + " 23:59:59")}`);
    const pwhere = `WHERE ${pconds.join(" AND ")}`;

    await Promise.all([
      (async () => {
        const us = await query<any>(
          `SELECT u.id, u.name,
              COALESCE(p.name,
                (SELECT c.name FROM charges c WHERE c.user_id=u.id AND c.status='ACTIVE' ORDER BY c.activated_on DESC LIMIT 1),
                (SELECT c.name FROM charges c WHERE c.user_id=u.id ORDER BY c.activated_on DESC LIMIT 1),
                IF(u.plan_id IS NULL, 'FREE_USER', CONCAT('Plan #', u.plan_id))) plan
            FROM users u LEFT JOIN plans p ON p.id=u.plan_id WHERE u.id IN (?)`,
          [ids]
        );
        us.forEach((u) => shopMap.set(num(u.id), { name: u.name, plan: u.plan }));
      })(),
      (async () => {
        const pr = await query<any>(
          `SELECT user_id, COUNT(*) c, SUM(status='sent') s
             FROM preorder_notification_logs ${pwhere} GROUP BY user_id`
        );
        pr.forEach((r) => preMap.set(num(r.user_id), { c: num(r.c), s: num(r.s) }));
      })(),
    ]);
  }

  const stores = agg.map((r) => {
    const id = num(r.user_id);
    const pre = preMap.get(id) || { c: 0, s: 0 };
    const info = shopMap.get(id) || { name: `#${id}`, plan: "" };
    return {
      id,
      shop: info.name,
      plan: info.plan,
      bis_collected: num(r.nm_c),
      bis_sent: num(r.nm_s),
      pricedrop_collected: num(r.pd_c),
      pricedrop_sent: num(r.pd_s),
      salealert_collected: num(r.sa_c),
      salealert_sent: num(r.sa_s),
      preorder_collected: pre.c,
      preorder_sent: pre.s,
      total_collected: num(r.total_c) + pre.c,
      total_sent: num(r.total_s) + pre.s,
    };
  });

  return {
    stores,
    page,
    pageSize,
    totalRows,
    totalPages: Math.max(1, Math.ceil(totalRows / pageSize)),
  };
}

// ==========================================================================
// EMAIL OUTREACH — paid merchants who aren't using all four features
// ==========================================================================
const EMAIL_FEATURES = [
  { key: "notify_me", label: "Back in Stock" },
  { key: "price_drop", label: "Price Drop" },
  { key: "sales_alert", label: "Sale Alerts" },
  { key: "preorder", label: "Pre-orders" },
];

export interface EmailFilters {
  missing?: string;
  campaign?: Campaign;
  page?: number;
  pageSize?: number;
}

// Build the per-shop target list for a campaign:
//  - feature : paid + active + missing >=1 feature (feature-adoption upsell)
//  - upgrade : free (no active recurring charge) + active + not blocked (free->paid)
//  - review  : active + engaged + not blocked, installed a while (App Store review)
async function buildEmailTargets(campaign: Campaign = "feature") {
  const { sets } = await cached("featureSets", 600_000, getFeatureSets);

  let idRows: any[];
  if (campaign === "upgrade") {
    // free = installed but no ACTIVE recurring charge
    idRows = await query<any>(
      `SELECT u.id FROM users u
        WHERE u.deleted_at IS NULL
          AND NOT EXISTS (SELECT 1 FROM charges c WHERE c.user_id=u.id AND c.status='ACTIVE' AND c.deleted_at IS NULL)`
    );
  } else if (campaign === "review") {
    idRows = await query<any>(`SELECT u.id FROM users u WHERE u.deleted_at IS NULL`);
  } else {
    // feature (default): paid + active
    idRows = await query<any>(
      `SELECT DISTINCT c.user_id id FROM charges c
         JOIN users u ON u.id=c.user_id
        WHERE c.status='ACTIVE' AND c.deleted_at IS NULL AND u.deleted_at IS NULL`
    );
  }
  const ids = idRows.map((r) => num(r.id ?? r.user_id)).filter(Boolean);
  if (!ids.length) return [];

  const [users, sig, earn, charged] = await Promise.all([
    query<any>(
      `SELECT u.id, u.name, u.email, u.shop_current_language lang, u.created_at,
          CASE WHEN JSON_VALID(u.meta_data)
               THEN LOWER(JSON_UNQUOTE(JSON_EXTRACT(u.meta_data,'$.is_user_blocked')))
               END blocked_raw,
          COALESCE(p.name,
            (SELECT c.name FROM charges c WHERE c.user_id=u.id AND c.status='ACTIVE' ORDER BY c.activated_on DESC LIMIT 1),
            IF(u.plan_id IS NULL,'FREE_USER',CONCAT('Plan #',u.plan_id))) plan
        FROM users u LEFT JOIN plans p ON p.id=u.plan_id WHERE u.id IN (?)`,
      [ids]
    ),
    query<any>(
      `SELECT user_id, COUNT(*) signups, SUM(is_sent IS NOT NULL) sent
         FROM variant_stock_notifications WHERE user_id IN (?) GROUP BY user_id`,
      [ids]
    ),
    query<any>(
      `SELECT user_id, SUM(revenue_generated) revenue, SUM(orders_generated) orders
         FROM bis_analytics_daily WHERE user_id IN (?) GROUP BY user_id`,
      [ids]
    ),
    query<any>(
      `SELECT user_id, SUM(price) total FROM charges
        WHERE status='ACTIVE' AND deleted_at IS NULL AND user_id IN (?) GROUP BY user_id`,
      [ids]
    ),
  ]);

  const sigMap = new Map<number, any>();
  sig.forEach((r) => sigMap.set(num(r.user_id), r));
  const earnMap = new Map<number, any>();
  earn.forEach((r) => earnMap.set(num(r.user_id), r));
  const chargedMap = new Map<number, number>();
  charged.forEach((r) => chargedMap.set(num(r.user_id), num(r.total)));

  const targets = users
    .map((u: any) => {
      const id = num(u.id);
      const usedKeys = EMAIL_FEATURES.filter((f) => (sets as any)[f.key]?.has(id)).map((f) => f.key);
      const missingKeys = EMAIL_FEATURES.filter((f) => !(sets as any)[f.key]?.has(id)).map((f) => f.key);
      const lang = normalizeLang(u.lang);
      const shop: EmailShop = {
        name: u.name,
        plan: u.plan,
        appRevenue: num(earnMap.get(id)?.revenue),
        appOrders: num(earnMap.get(id)?.orders),
        signups: num(sigMap.get(id)?.signups),
        alertsSent: num(sigMap.get(id)?.sent),
        usedKeys,
        missingKeys,
        language: lang,
      };
      const recKey = recommendedFor(missingKeys);
      const blocked = u.blocked_raw === "1" || u.blocked_raw === "true";
      const ageDays = u.created_at ? (Date.now() - new Date(u.created_at).getTime()) / 86400000 : 9999;
      return {
        id,
        email: u.email,
        shop,
        language: lang,
        languageName: LANG_NAMES[lang] || lang,
        recommendedKey: recKey,
        recommendedLabel: FEATURE_INFO[recKey]?.label || recKey,
        subject: subjectFor(campaign, shop, lang),
        recurringCharged: chargedMap.get(id) || 0,
        blocked,
        ageDays,
      };
    })
    .filter((t) => {
      if (t.blocked) return false; // never email blocked merchants
      if (campaign === "upgrade") {
        // free + showing activity + past the first few onboarding days
        return (t.shop.signups > 0 || t.shop.alertsSent > 0) && t.ageDays >= 3;
      }
      if (campaign === "review") {
        // engaged + had time to form an opinion
        return (t.shop.alertsSent > 0 || t.shop.appRevenue > 0) && t.ageDays >= 14;
      }
      // feature: must be missing at least one feature
      return t.shop.missingKeys.length > 0;
    });

  // ranking: reviews by engagement; upgrade/feature by opportunity size
  if (campaign === "review") {
    targets.sort((a, b) => b.shop.alertsSent - a.shop.alertsSent || b.shop.appRevenue - a.shop.appRevenue);
  } else {
    targets.sort((a, b) => b.shop.appRevenue - a.shop.appRevenue || b.shop.signups - a.shop.signups);
  }
  return targets;
}

export async function getEmailRecommendations(f: EmailFilters) {
  const page = Math.max(1, Number(f.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(f.pageSize) || 20));
  const campaign: Campaign = f.campaign || "feature";

  let targets = await buildEmailTargets(campaign);

  // summary across ALL targets (before paging / missing filter)
  const byMissing = EMAIL_FEATURES.map((ft) => ({
    key: ft.key,
    label: ft.label,
    count: targets.filter((t) => t.shop.missingKeys.includes(ft.key)).length,
  }));
  const totalTargets = targets.length;

  if (f.missing) targets = targets.filter((t) => t.shop.missingKeys.includes(f.missing!));

  const totalRows = targets.length;
  const start = (page - 1) * pageSize;
  const pageItems = targets.slice(start, start + pageSize).map((t) => ({
    id: t.id,
    shop: t.shop.name,
    email: t.email,
    plan: t.shop.plan,
    appRevenue: t.shop.appRevenue,
    signups: t.shop.signups,
    alertsSent: t.shop.alertsSent,
    recurringCharged: t.recurringCharged,
    language: t.language,
    languageName: t.languageName,
    used: t.shop.usedKeys.map((k) => FEATURE_INFO[k]?.label || k),
    missing: t.shop.missingKeys.map((k) => FEATURE_INFO[k]?.label || k),
    recommended: t.recommendedLabel,
    subject: t.subject,
  }));

  return {
    recommendations: pageItems,
    page,
    pageSize,
    totalRows,
    totalPages: Math.max(1, Math.ceil(totalRows / pageSize)),
    summary: { totalTargets, byMissing },
    featureOptions: EMAIL_FEATURES,
    campaign,
  };
}

// Full rendered email for one shop (for the preview pane).
export async function getEmailForShop(idRaw: string | number) {
  const id = Number(idRaw);
  if (!Number.isFinite(id)) throw new Error("Invalid shop id");
  const { sets } = await cached("featureSets", 600_000, getFeatureSets);

  const u = (
    await query<any>(
      `SELECT u.id, u.name, u.email, u.shop_current_language lang,
          COALESCE(p.name,
            (SELECT c.name FROM charges c WHERE c.user_id=u.id AND c.status='ACTIVE' ORDER BY c.activated_on DESC LIMIT 1),
            IF(u.plan_id IS NULL,'FREE_USER',CONCAT('Plan #',u.plan_id))) plan
        FROM users u LEFT JOIN plans p ON p.id=u.plan_id WHERE u.id=? LIMIT 1`,
      [id]
    )
  )[0];
  if (!u) return { found: false };

  const sigRow = (await query<any>(
    `SELECT COUNT(*) signups, SUM(is_sent IS NOT NULL) sent FROM variant_stock_notifications WHERE user_id=?`,
    [id]
  ))[0];
  const earnRow = (await query<any>(
    `SELECT SUM(revenue_generated) revenue, SUM(orders_generated) orders FROM bis_analytics_daily WHERE user_id=?`,
    [id]
  ))[0];

  const usedKeys = EMAIL_FEATURES.filter((ft) => (sets as any)[ft.key]?.has(id)).map((ft) => ft.key);
  const missingKeys = EMAIL_FEATURES.filter((ft) => !(sets as any)[ft.key]?.has(id)).map((ft) => ft.key);

  const shop: EmailShop = {
    name: u.name,
    plan: u.plan,
    appRevenue: num(earnRow?.revenue),
    appOrders: num(earnRow?.orders),
    signups: num(sigRow?.signups),
    alertsSent: num(sigRow?.sent),
    usedKeys,
    missingKeys,
  };
  const built = buildEmail(shop);
  return {
    found: true,
    to: u.email,
    shop: u.name,
    plan: u.plan,
    used: usedKeys.map((k) => FEATURE_INFO[k]?.label || k),
    missing: missingKeys.map((k) => FEATURE_INFO[k]?.label || k),
    ...built,
  };
}

// ==========================================================================
// EMAIL CONTEXT — merge variables for one shop (for the template editor)
// ==========================================================================
export async function getEmailContext(idRaw: string | number, langRaw?: string, campaign: Campaign = "feature") {
  const id = Number(idRaw);
  if (!Number.isFinite(id)) throw new Error("Invalid shop id");
  const { sets } = await cached("featureSets", 600_000, getFeatureSets);

  const u = (
    await query<any>(
      `SELECT u.id, u.name, u.email, u.shop_current_language lang,
          COALESCE(p.name,
            (SELECT c.name FROM charges c WHERE c.user_id=u.id AND c.status='ACTIVE' ORDER BY c.activated_on DESC LIMIT 1),
            IF(u.plan_id IS NULL,'FREE_USER',CONCAT('Plan #',u.plan_id))) plan
        FROM users u LEFT JOIN plans p ON p.id=u.plan_id WHERE u.id=? LIMIT 1`,
      [id]
    )
  )[0];
  if (!u) return { found: false };
  const detectedLang = normalizeLang(u.lang);
  const effLang = langRaw ? normalizeLang(langRaw) : detectedLang;

  const [sigRow, earnRow, reqRows] = await Promise.all([
    query<any>(`SELECT COUNT(*) signups, SUM(is_sent IS NOT NULL) sent FROM variant_stock_notifications WHERE user_id=?`, [id]).then((r) => r[0]),
    query<any>(`SELECT SUM(revenue_generated) revenue, SUM(orders_generated) orders FROM bis_analytics_daily WHERE user_id=?`, [id]).then((r) => r[0]),
    query<any>(
      `SELECT translated_product_title title, COUNT(*) c
         FROM variant_stock_notifications
        WHERE user_id=? AND translated_product_title IS NOT NULL AND translated_product_title <> ''
        GROUP BY translated_product_title ORDER BY c DESC LIMIT 6`,
      [id]
    ),
  ]);

  const usedKeys = ["notify_me", "price_drop", "sales_alert", "preorder"].filter((k) => (sets as any)[k]?.has(id));
  const missingKeys = ["notify_me", "price_drop", "sales_alert", "preorder"].filter((k) => !(sets as any)[k]?.has(id));

  const shop: EmailShop = {
    name: u.name,
    plan: u.plan,
    appRevenue: num(earnRow?.revenue),
    appOrders: num(earnRow?.orders),
    signups: num(sigRow?.signups),
    alertsSent: num(sigRow?.sent),
    usedKeys,
    missingKeys,
    language: effLang,
  };
  const mostRequested: ProductReq[] = (reqRows || []).map((r: any) => ({
    title: r.title,
    count: num(r.c),
    url: u.name ? `https://${u.name}/search?q=${encodeURIComponent(r.title)}` : null,
  }));

  const context = buildContext(shop, mostRequested, effLang);
  context.email = u.email || "";

  return {
    found: true,
    to: u.email || "",
    shop: u.name,
    plan: u.plan,
    detectedLanguage: detectedLang,
    language: effLang,
    languageName: LANG_NAMES[effLang] || effLang,
    availableLanguages: SUPPORTED_LANGS.map((c) => ({ code: c, name: LANG_NAMES[c] || c })),
    context,
    keys: MERGE_KEYS,
    campaign,
    defaultSubject: templatesFor(campaign).subject,
    defaultHtml: templatesFor(campaign).html,
  };
}

// ==========================================================================
// SIGNUP CONTENT — the actual message sent for one notification row
// ==========================================================================
export async function getSignupContent(idRaw: string | number) {
  const id = Number(idRaw);
  if (!Number.isFinite(id)) throw new Error("Invalid id");

  const v = (
    await query<any>(
      `SELECT id, user_id, reference_number, email, name, translated_product_title product,
              translated_variant_title variant, type, fun_type, mail_channel, is_sent,
              sent_count, custom_message, country, created_at
         FROM variant_stock_notifications WHERE id=? LIMIT 1`,
      [id]
    )
  )[0];
  if (!v) return { found: false };

  const [mail, sms, planRow] = await Promise.all([
    safe(() =>
      query<any>(
        `SELECT mail_body, channel, sent_count, event_id, created_at
           FROM bis_mails WHERE notification_id=? ORDER BY id DESC LIMIT 1`,
        [id]
      ).then((r) => r[0] || null)
    ),
    safe(() =>
      query<any>(
        `SELECT provider, whatsapp_status, whatsapp_status_at, whatsapp_error, created_at
           FROM sent_s_m_s_responses WHERE variant_notification_id=? ORDER BY id DESC LIMIT 5`,
        [id]
      )
    ),
    safe(() =>
      query<any>(
        `SELECT COALESCE(p.name,
                  (SELECT c.name FROM charges c WHERE c.user_id=u.id AND c.status='ACTIVE' ORDER BY c.activated_on DESC LIMIT 1),
                  (SELECT c.name FROM charges c WHERE c.user_id=u.id ORDER BY c.activated_on DESC LIMIT 1),
                  IF(u.plan_id IS NULL,'FREE_USER',CONCAT('Plan #',u.plan_id))) plan
           FROM users u LEFT JOIN plans p ON p.id=u.plan_id WHERE u.id=? LIMIT 1`,
        [v.user_id]
      ).then((r) => r[0] || null)
    ),
  ]);

  const plan: string | null = planRow?.plan || null;
  const isFree = !plan || /free/i.test(plan);
  const sent = !!v.is_sent;

  // The app only persists the rendered email HTML (bis_mails) for paid merchants,
  // so explain *why* a body is missing rather than implying an error.
  let mailReason: string | null = null;
  if (!mail?.mail_body) {
    if (!sent) {
      mailReason = "This notification hasn't been sent yet, so there is no email body.";
    } else if (isFree) {
      mailReason =
        "Email bodies are only stored for paid-plan merchants. This shop is on " +
        (plan || "the free plan") +
        ", so the sent email HTML was not retained.";
    } else {
      mailReason = "This notification was sent, but no email body was stored for it.";
    }
  }

  return {
    found: true,
    info: {
      reference_number: v.reference_number,
      email: v.email,
      shopper: v.name,
      product: v.product,
      variant: v.variant,
      channel: v.type,
      mail_channel: v.mail_channel,
      feature: v.fun_type,
      status: v.is_sent ? "sent" : "pending",
      sent_at: v.is_sent,
      sent_count: num(v.sent_count),
      country: v.country,
      requested_at: v.created_at,
      custom_message: v.custom_message,
      plan,
    },
    mailBody: mail?.mail_body || null,
    mailChannel: mail?.channel || null,
    mailReason,
    sms: sms || [],
  };
}
