# Data Sources — what each number means and where it comes from

This document maps **every page and every metric** in the dashboard to the exact
table(s), column(s) and joins used. All queries live in `lib/stats.ts`
(analytics) and `lib/analytics.ts` (table/schema explorer). Database: `app_bis`.
Everything is **read-only** (SELECT only).

---

## 1. Core conventions (read this first)

### 1.1 Merchant identity
A "merchant" / "shop" = one row in **`users`**.
- Install date = `users.created_at`
- Uninstall date = `users.deleted_at` (soft delete)
- Shop domain = `users.name` (e.g. `matedigiloop.myshopify.com`), owner email = `users.email`

### 1.2 Active vs Churned  ⚠️ important
- **Active** = `users.deleted_at IS NULL`
- **Churned** = `users.deleted_at IS NOT NULL`

`deleted_at` is written by the app when Shopify sends the **app/uninstalled
webhook**. If that webhook never arrived or failed, a shop that was uninstalled
in Shopify can still show **Active** here. The `webhook_status` table shows
**2,804 failed** vs 2,194 registered webhooks, so this gap is real.

➡️ This is the most likely reason `matedigiloop.myshopify.com` shows **Active**
even though it is not in your Shopify list. **Usage billing still shows** because
`shopify_usage_base_charges` is historical — past charges are never deleted when a
shop uninstalls, so seeing usage on an inactive shop is expected.
Run `node scripts/verify.mjs matedigiloop.myshopify.com` to see that shop's raw
`users.deleted_at`, latest charge status, and webhook_status in one place.

### 1.3 Plan resolution  ⚠️ explains "(no plan)"
Current plan is read from **`users.plan_id`** joined to **`plans.id`**:

```sql
FROM users u LEFT JOIN plans p ON p.id = u.plan_id
```

The label is resolved through this fallback chain (most authoritative first):

```sql
COALESCE(
  p.name,                                              -- 1. users.plan_id -> plans.name (incl. Free = id 1)
  (SELECT c.name FROM charges c                        -- 2. the shop's current ACTIVE charge name
     WHERE c.user_id=u.id AND c.status='ACTIVE'
     ORDER BY c.activated_on DESC LIMIT 1),
  (SELECT c.name FROM charges c                        -- 3. the shop's most recent charge of any status
     WHERE c.user_id=u.id
     ORDER BY c.activated_on DESC LIMIT 1),
  IF(u.plan_id IS NULL, '(no plan)', CONCAT('Plan #', u.plan_id))  -- 4. last resort
)
```

So a row shows:
- the **plan name** when `users.plan_id` matches a row in `plans` (this covers all
  free shops, since `plans.id=1` = "Free");
- otherwise the **plan name from the `charges` table** — the shop's active
  subscription, then their latest past subscription (this resolves paid shops whose
  `users.plan_id` is NULL or points to a retired plan id);
- **"Plan #<id>"** only when `plan_id` is set, missing from `plans`, AND the shop has
  no charge row at all;
- **"(no plan)"** only when `plan_id IS NULL` AND there is no charge — i.e. the shop
  genuinely never had a plan assigned (typically very old/abandoned installs).

The DB has `plan_id` values up to 1515 but the `plans` table only has 41 rows, so
many shops referenced retired plan ids; pulling the name from `charges` fixes those.

Run `node scripts/verify.mjs` (no args) to see the exact counts of NULL vs orphan
plan ids.

### 1.4 Revenue — two different things
| Term | Meaning | Source |
| --- | --- | --- |
| **What we charged the merchant** (our income) | recurring app subscription | `charges.price` where `status='ACTIVE'` |
| | pay-as-you-go SMS/WhatsApp | `shopify_usage_base_charges.price` |
| **What the merchant earned** (their income via the app) | revenue from back-in-stock driven orders | `bis_analytics_daily.revenue_generated` |
| | attributed orders | `analytics_orders.total_price` where `is_bis_order=1` |

"Active recurring /mo" = `SUM(charges.price) WHERE status='ACTIVE' AND deleted_at IS NULL`.
It assumes the charge interval is monthly (charges are `type='RECURRING'`).

---

## 2. Overview  (`/`, API `/api/overview`, fn `getOverview`)

| Metric | Source |
| --- | --- |
| Total merchants | `COUNT(*)` from `users` |
| Active | `COUNT(*)` from `users` WHERE `deleted_at IS NULL` |
| Paying | `COUNT(DISTINCT user_id)` from `charges` WHERE `status='ACTIVE' AND deleted_at IS NULL` |
| Free | Active − Paying |
| Churned | `COUNT(*)` from `users` WHERE `deleted_at IS NOT NULL` |
| Active recurring revenue | `SUM(charges.price)` WHERE `status='ACTIVE' AND deleted_at IS NULL` |
| BIS revenue / orders | `SUM(bis_analytics_daily.revenue_generated)` / `SUM(orders_generated)` |
| Notification signups | `COUNT(*)` from `variant_stock_notifications` |
| Alerts sent | `COUNT(*)` from `variant_stock_notifications` WHERE `is_sent IS NOT NULL` |
| New installs by month | `users.created_at` grouped by month |
| Signups by month | `variant_stock_notifications.created_at` grouped by month |
| Signups by feature | `variant_stock_notifications` GROUP BY `fun_type` |
| Signups by channel | `variant_stock_notifications` GROUP BY `type` |
| Conversion funnel | `bis_analytics_daily`: SUM of `total_alerts_sent, delivered, opened, clicked, orders_generated, revenue_generated` |
| Merchants by plan | `users` LEFT JOIN `plans` GROUP BY plan label, WHERE `deleted_at IS NULL` |

---

## 3. Conversion & Revenue  (`/conversion`, `getConversion`)

| Metric | Source |
| --- | --- |
| Funnel (sent→delivered→opened→clicked→orders) | `bis_analytics_daily` SUM of each column |
| Avg conversion rate | `AVG(bis_analytics_daily.conversion_rate)` (non-zero rows) |
| Avg order value | `AVG(bis_analytics_daily.avg_order_value)` (non-zero rows) |
| Revenue by month | `bis_analytics_daily.revenue_generated` grouped by `report_date` month |
| Orders by month | `bis_analytics_daily.orders_generated` grouped by `report_date` month |
| Attributed orders (total / BIS / upsell) | `analytics_orders`: `COUNT(*)`, `SUM(is_bis_order)`, `SUM(is_upsell_order)`, and `total_price` split by `is_bis_order` / `is_upsell_order` |
| Top products by revenue | `bis_analytics_products` GROUP BY `product_title`, SUM `revenue_generated/orders_generated/alerts_sent` |
| Merchant conversion (free→paid) | active = `users` deleted_at NULL; paying = distinct `charges` ACTIVE; freemium = `users.shopify_freemium=1`; paid rate = paying/active |

---

## 4. Shops Explorer  (`/shops`, API `/api/shops`, fn `getShops`)

Base query: `users u LEFT JOIN plans p ON p.id=u.plan_id`, paginated.

**Filters** (all applied in SQL for speed):
| Filter | Column |
| --- | --- |
| Search | `users.name LIKE` OR `users.email LIKE` |
| Plan | `users.plan_id = ?` |
| Status | `users.deleted_at IS NULL` (active) / `IS NOT NULL` (churned) |
| Date range | `users.created_at BETWEEN from AND to` |
| Sort | `users.created_at` / `users.name` / `plans.name` |

**Per-shop columns** (computed for the current page's user ids via grouped
queries with `WHERE user_id IN (...)`):
| Column | Source |
| --- | --- |
| Plan | label from `plans.name` (see §1.3) |
| Status | `users.deleted_at` |
| Signups | `COUNT(*)` from `variant_stock_notifications` GROUP BY user_id |
| Alerts sent | `SUM(is_sent IS NOT NULL)` from `variant_stock_notifications` |
| App revenue | `SUM(revenue_generated)` from `bis_analytics_daily` |
| Recurring /mo | `SUM(price)` from `charges` WHERE `status='ACTIVE' AND deleted_at IS NULL` |
| Usage billed | `SUM(price)` from `shopify_usage_base_charges` |
| Installed | `users.created_at` |

Plan dropdown options come from `SELECT id, name FROM plans`.

---

## 5. Shop Detail  (`/shops/[id]`, API `/api/shop`, fn `getShopDetail`)

Lookup: `users u LEFT JOIN plans p` WHERE `u.id = ?`.
Sensitive raw fields (`password`, `remember_token`, `refresh_token`) are stripped.

### Profile
`users`: `name, email, plan_id→plans.name, plans.price, plans.interval,
shopify_freemium, shopify_grandfathered, shop_current_language, created_at,
deleted_at`.

### Billing — "what we charged this shop"
| Field | Exact source |
| --- | --- |
| **Active recurring /mo** | `SELECT SUM(price) FROM charges WHERE user_id=? AND status='ACTIVE' AND deleted_at IS NULL` |
| Lifetime charged | `SELECT SUM(price) FROM charges WHERE user_id=?` (all charges) |
| Usage billed | `SELECT SUM(price) FROM shopify_usage_base_charges WHERE user_id=?` |
| Subscriptions active/cancelled | `COUNT(*)` from `charges` by `status` |
| Charge history table | `charges`: `name, status, price, interval, trial_days, activated_on, trial_ends_on, cancelled_on, billing_on, created_at` |
| Usage by month | `shopify_usage_base_charges.price` grouped by `created_at` month, **WHERE `user_id`=shop** |

### Earnings — "what this shop made from the app"
| Field | Source |
| --- | --- |
| Revenue / Orders | `bis_analytics_daily` SUM `revenue_generated` / `orders_generated` WHERE `user_id=?` |
| Funnel | `bis_analytics_daily` SUM `total_alerts_sent, delivered, opened, clicked, orders_generated` |
| Pre-order revenue / orders | `preorder_orders` SUM `total_price` / `COUNT(*)` WHERE `user_id=?` |
| Top products | `bis_analytics_products` GROUP BY `product_title` WHERE `user_id=?` |

### Notifications
`variant_stock_notifications` WHERE `user_id=?`: total, `SUM(is_sent IS NOT NULL)`,
GROUP BY `fun_type`, GROUP BY `type`, by `created_at` month, and the 25 most recent
rows (`reference_number, email, name, translated_product_title, type, fun_type,
mail_channel, is_sent, sent_count, country, created_at`).

### BIS configuration
`variant_stock_notification_settings` WHERE `user_id=?` (first row):
`send_notification_type, configuration_type, notify_me, sender_email, sender_name,
bis_domain, bis_domain_status, bis_domain_dkim_status, product_request_notification`.

---

## 6. Installs  (`/installs`, API `/api/installs`, fn `getMerchants`)

| Metric | Source |
| --- | --- |
| Total / Active / Churned | `users` count, by `deleted_at` |
| Freemium / Grandfathered | `users.shopify_freemium=1` / `shopify_grandfathered=1` |
| Onboarded | `users.button_state=1` |
| Installs by month / day | `users.created_at` |
| Merchants by plan | `users` LEFT JOIN `plans`, active only |
| By store language | `users.shop_current_language` |
| By country | `handprint` WHERE `Event='Installed'` GROUP BY `Shop country` |
| Recent installs / uninstalls | `users` LEFT JOIN `plans`, ordered by `created_at` / `deleted_at` |

> Note: country uses `handprint` (an event log of 885 rows) because `users` has no
> country column — so country totals cover only shops present in that log.

---

## 7. Churn & Uninstalls  (`/uninstalls`, API `/api/uninstalls`, fn `getChurn`)

| Metric | Source |
| --- | --- |
| Churned merchants / by month | `users.deleted_at` |
| Cancelled subscriptions / by month | `charges` WHERE `status='CANCELLED'`, month from `cancelled_on` |
| Charge status | `charges` GROUP BY `status` |
| Churn by plan | `users` LEFT JOIN `plans` WHERE `deleted_at IS NOT NULL` |
| Email unsubscribes (total/source/month) | `email_unsubscribes`: count, GROUP BY `source`, by `created_at` |
| Uninstall event log | `handprint` WHERE `Event='Uninstalled'` |

> **No dedicated uninstall-reason field exists** in this schema. The closest
> signals are the `handprint` event log and `email_unsubscribes.source`. If you add
> an uninstall survey column later, it can be wired in here.

---

## 8. Plans & Billing  (`/plans`, API `/api/plans`, fn `getBilling`)

| Metric | Source |
| --- | --- |
| Active subscriptions | `charges` WHERE `status='ACTIVE' AND deleted_at IS NULL` |
| Active recurring revenue | `SUM(charges.price)` same filter |
| On trial | `charges` WHERE `trial_ends_on > NOW() AND status='ACTIVE'` |
| Cancelled (all time) | `charges` WHERE `status='CANCELLED'` |
| Usage-based billing total | `SUM(shopify_usage_base_charges.price)` |
| Merchants at plan limit | `shop_current_plan_limits` WHERE `limit_reached=1` |
| Active merchants per plan | `users` LEFT JOIN `plans`, active only |
| New subscriptions by month | `charges.activated_on` |
| Recurring revenue by plan | `charges` LEFT JOIN `plans`, active only, GROUP BY plan: `COUNT`, `SUM(price)`, `AVG(price)` |
| Usage billing by source / month | `shopify_usage_base_charges` GROUP BY `send_by` / by `created_at` |
| All plans | `plans`: `id, name, type, price, interval, trial_days, is_public, on_install` |

---

## 9. Notifications  (`/notifications`, API `/api/notifications`, fn `getNotifications`)

All from **`variant_stock_notifications`** (1,137,259 rows) unless noted.

| Metric | Source |
| --- | --- |
| Total signups | `COUNT(*)` |
| Alerts sent | `is_sent IS NOT NULL` |
| In queue | `in_queue = 1` |
| Pending | `is_sent IS NULL AND in_queue = 0` |
| Auto-sent / Sent to admin | `is_auto_sent=1` / `sent_to_admin=1` |
| By feature | GROUP BY `fun_type` (notify_me / price_drop / sales_alert) |
| By channel | GROUP BY `type` (email / mobile / whatsApp / combos) |
| By mail channel | GROUP BY `mail_channel` (app / mobile / whatsapp / klaviyo) |
| Signups by month / Alerts sent by month | `created_at` / `is_sent` |
| Top countries | GROUP BY `country` |
| Email delivery by channel | `bis_mails` GROUP BY `channel`, SUM `sent_count` |
| SMS / WhatsApp status | `sent_s_m_s_responses` GROUP BY `whatsapp_status` |
| Partial restock sends | `COUNT(*)` from `partial_restock_sends` |

---

## 10. Features  (`/features`, API `/api/features`, fn `getFeatures`)

| Feature | Source |
| --- | --- |
| **Back in Stock** signups / sent | `variant_stock_notifications` WHERE `fun_type='notify_me'` |
| Popups configured | `COUNT(*)` from `popups` |
| BIS settings (send mode, sequencing, trigger, domain) | `variant_stock_notification_settings` GROUP BY `send_notification_type` / `configuration_type` / `notify_me` / `bis_domain_status` |
| **Price Drop** configs / signups | `pricedrops` count / `variant_stock_notifications` WHERE `fun_type='price_drop'` |
| **Sale Alerts** configs / signups | `sale_alerts` count / `variant_stock_notifications` WHERE `fun_type='sales_alert'` |
| **Pre-orders** offers | `preorder_offers`: count, GROUP BY `status` / `payment_mode` / `product_type` |
| Pre-orders placed / revenue | `preorder_orders`: count, `SUM(total_price)`, GROUP BY `fulfillment_status` |
| Pre-order notifications | `preorder_notification_logs` GROUP BY `notification_type` / `channel` / `status` |
| **Upsell** impressions/clicks/orders/revenue | `upsell_analytics_daily` SUM; events from `upsell_events` GROUP BY `event_type`; CTR = clicks/impressions |

---

## 11. Table Explorer & Schema  (`/tables`, `/schema`)

These use `lib/analytics.ts` + `lib/introspect.ts`, reading `information_schema`
directly. The Table Explorer runs `SELECT *` on any chosen table with validated
identifiers, free-text search across text columns (bound parameters), sorting and
paging. Schema page lists all 68 tables, their columns, and the auto-detected
mapping.

---

## 12. Known data caveats

1. **Active status can lag Shopify** when the app/uninstalled webhook failed —
   see §1.2. Cross-check a shop with `scripts/verify.mjs <domain>`.
2. **Usage/charges persist after uninstall** — historical billing rows are never
   deleted, so a churned shop can still show usage/revenue. This is correct.
3. **"(no plan)" vs "Plan #id"** — see §1.3. Orphan plan ids now show "Plan #id".
4. **No uninstall-reason field** exists (§7).
5. **Country coverage is partial** — only shops in the `handprint` log (§6).
6. **`TABLE_ROWS` estimates** in the Schema page are InnoDB approximations; the
   analytics pages always use exact `COUNT(*)`.
7. **Revenue interval** — "recurring /mo" assumes monthly; verify against
   `charges.interval` if you offer annual plans.

---

## 13. How to verify anything yourself

- `npm run inspect` → regenerates `schema-report.md` + `schema-dump.json` (full
  schema, row counts, sample rows, distinct values).
- `node scripts/verify.mjs` → plan diagnostics (NULL vs orphan plan ids).
- `node scripts/verify.mjs <shop-domain>` → full cross-table dump for one shop
  (users row, plan, charges, usage, notifications, webhook_status, handprint).
