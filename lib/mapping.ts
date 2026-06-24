import { TableInfo, ColumnInfo } from "./introspect";

/**
 * The dashboard auto-detects which tables/columns hold installs, uninstalls,
 * plans and notifications by matching common naming patterns. Detection is
 * heuristic — once you confirm your real schema you can pin any of these
 * values in OVERRIDES below and the guesswork is bypassed.
 */
export interface SchemaMapping {
  // Shop / install entity
  installTable?: string;
  installDateCol?: string;
  uninstallDateCol?: string; // timestamp set when a shop uninstalls (nullable)
  activeCol?: string; // boolean/status column indicating active install
  shopIdentCol?: string; // shop domain / name / email for display
  // Uninstall reasons (may live in install table or a dedicated feedback table)
  uninstallReasonTable?: string;
  uninstallReasonCol?: string;
  uninstallReasonDateCol?: string;
  // Plans / billing
  planTable?: string;
  planNameCol?: string;
  planPriceCol?: string;
  planStatusCol?: string;
  // Notifications / back-in-stock requests
  notificationTable?: string;
  notificationDateCol?: string;
  notificationStatusCol?: string;
  notificationChannelCol?: string;
}

/**
 * Manual overrides. Fill in exact names once known to bypass auto-detection.
 * Example:
 *   export const OVERRIDES: SchemaMapping = { installTable: "shops", installDateCol: "created_at" };
 */
export const OVERRIDES: SchemaMapping = {};

// ---------------------------------------------------------------------------
// Detection helpers
// ---------------------------------------------------------------------------

const DATE_TYPES = new Set([
  "datetime",
  "timestamp",
  "date",
]);

function isDateCol(c: ColumnInfo): boolean {
  return DATE_TYPES.has(c.dataType);
}

function findCol(t: TableInfo, rx: RegExp, predicate?: (c: ColumnInfo) => boolean): string | undefined {
  const matches = t.columns.filter((c) => rx.test(c.name) && (!predicate || predicate(c)));
  return matches[0]?.name;
}

function tableScore(t: TableInfo, rx: RegExp): number {
  // Higher score = more likely. Name match is required; rows break ties.
  if (!rx.test(t.name)) return -1;
  return 1000 + Math.min(t.rowEstimate, 1_000_000) / 1000;
}

function pickTable(tables: TableInfo[], rx: RegExp): TableInfo | undefined {
  let best: TableInfo | undefined;
  let bestScore = -1;
  for (const t of tables) {
    const s = tableScore(t, rx);
    if (s > bestScore) {
      bestScore = s;
      best = t;
    }
  }
  return bestScore >= 0 ? best : undefined;
}

const RX = {
  shopTable: /(shop|store|merchant|install|account|customer_app)/i,
  installDate: /(install(ed)?(_?(at|date|on))?|created_?at|created|signup|registered_?at|first_?seen|joined)/i,
  uninstallDate: /(uninstall(ed)?(_?(at|date|on))?|deleted_?at|removed_?at|cancel(l)?ed_?at|churned_?at|deactivated_?at)/i,
  active: /(is_?active|active|enabled|is_?installed|installed|uninstalled|deleted|status|state)/i,
  shopIdent: /(myshopify|shop_?domain|store_?domain|shop_?url|domain|shop_?name|store_?name|shop|email|name)/i,
  reasonTable: /(uninstall|churn|cancel|feedback|reason|survey)/i,
  reason: /(uninstall_?reason|cancel(l)?ation_?reason|churn_?reason|reason|feedback|comment|note|message)/i,
  planTable: /(plan|subscription|billing|charge|pricing|package|recurring)/i,
  planName: /(plan_?name|plan|tier|package|level|subscription_?name|name)/i,
  planPrice: /(price|amount|cost|monthly|fee|charge)/i,
  planStatus: /(status|state|active|cancelled|canceled)/i,
  notifTable: /(notif|alert|subscriber|back_?in_?stock|backinstock|restock|waitlist|request|email_?log|sms_?log|message|reminder)/i,
  notifDate: /(sent_?at|notified_?at|created_?at|created|date|timestamp|requested_?at)/i,
  notifStatus: /(status|sent|delivered|state|is_?sent|fulfilled)/i,
  notifChannel: /(channel|type|method|medium|via)/i,
};

export function autoDetect(tables: TableInfo[]): SchemaMapping {
  const m: SchemaMapping = {};

  // --- Install / shop table ---
  const shop = pickTable(tables, RX.shopTable);
  if (shop) {
    m.installTable = shop.name;
    m.installDateCol = findCol(shop, RX.installDate, isDateCol) || findCol(shop, RX.installDate);
    m.uninstallDateCol = findCol(shop, RX.uninstallDate, isDateCol) || findCol(shop, RX.uninstallDate);
    m.activeCol = findCol(shop, RX.active, (c) =>
      ["tinyint", "boolean", "bool", "bit", "varchar", "enum", "char", "int"].includes(c.dataType)
    );
    m.shopIdentCol = findCol(shop, RX.shopIdent, (c) =>
      ["varchar", "char", "text"].includes(c.dataType)
    );
    // Uninstall reason often lives on the shop table itself.
    const reasonOnShop = findCol(shop, RX.reason, (c) =>
      ["varchar", "text", "char", "enum"].includes(c.dataType)
    );
    if (reasonOnShop) {
      m.uninstallReasonTable = shop.name;
      m.uninstallReasonCol = reasonOnShop;
      m.uninstallReasonDateCol = m.uninstallDateCol;
    }
  }

  // --- Dedicated uninstall/feedback table (preferred if present) ---
  const reasonTbl = pickTable(
    tables.filter((t) => RX.reasonTable.test(t.name)),
    RX.reasonTable
  );
  if (reasonTbl) {
    const col = findCol(reasonTbl, RX.reason, (c) =>
      ["varchar", "text", "char", "enum"].includes(c.dataType)
    );
    if (col) {
      m.uninstallReasonTable = reasonTbl.name;
      m.uninstallReasonCol = col;
      m.uninstallReasonDateCol =
        findCol(reasonTbl, RX.uninstallDate, isDateCol) ||
        findCol(reasonTbl, RX.notifDate, isDateCol);
    }
  }

  // --- Plan / subscription table ---
  const plan = pickTable(tables, RX.planTable);
  if (plan) {
    m.planTable = plan.name;
    m.planNameCol = findCol(plan, RX.planName, (c) =>
      ["varchar", "char", "text", "enum"].includes(c.dataType)
    );
    m.planPriceCol = findCol(plan, RX.planPrice, (c) =>
      ["decimal", "float", "double", "int", "bigint"].includes(c.dataType)
    );
    m.planStatusCol = findCol(plan, RX.planStatus);
  }
  // If no separate plan table, a plan column might live on the shop table.
  if (!m.planTable && shop) {
    const planCol = findCol(shop, /(plan|tier|package|subscription)/i, (c) =>
      ["varchar", "char", "text", "enum"].includes(c.dataType)
    );
    if (planCol) {
      m.planTable = shop.name;
      m.planNameCol = planCol;
      m.planPriceCol = findCol(shop, RX.planPrice);
    }
  }

  // --- Notifications table ---
  // Exclude the shop/plan tables we already identified so we don't double-count.
  const used = new Set([m.installTable, m.planTable].filter(Boolean) as string[]);
  const notif = pickTable(
    tables.filter((t) => !used.has(t.name)),
    RX.notifTable
  );
  if (notif) {
    m.notificationTable = notif.name;
    m.notificationDateCol = findCol(notif, RX.notifDate, isDateCol) || findCol(notif, RX.notifDate);
    m.notificationStatusCol = findCol(notif, RX.notifStatus);
    m.notificationChannelCol = findCol(notif, RX.notifChannel);
  }

  return m;
}

/** Auto-detected mapping merged with manual overrides (overrides win). */
export function resolveMapping(tables: TableInfo[]): {
  mapping: SchemaMapping;
  detected: SchemaMapping;
} {
  const detected = autoDetect(tables);
  const mapping: SchemaMapping = { ...detected };
  for (const [k, v] of Object.entries(OVERRIDES)) {
    if (v !== undefined && v !== null && v !== "") {
      (mapping as any)[k] = v;
    }
  }
  return { mapping, detected };
}
