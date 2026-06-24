# Notify Me — Admin Dashboard

Internal analytics dashboard for the **Notify Me (Back in Stock)** Shopify app.
Connects **read-only** to the `app_bis` MySQL database and reports merchants,
churn, billing, notifications, the four product features and the
signup→order→revenue conversion funnel.

Built with Next.js (App Router) + TypeScript. Only `mysql2` touches the DB and
there is **no write path** in the code.

## Run

```bash
npm install
npm run dev        # http://localhost:3000
```

Credentials live in `.env.local` (already set, gitignored):

```
DB_HOST=backinstock.cpac2qa4usfo.us-east-2.rds.amazonaws.com
DB_PORT=3306
DB_USER=claude
DB_PASSWORD=ant-api03
DB_NAME=app_bis
DB_SSL=true
```

The machine you run this on must be able to reach the RDS host (security-group
allow-listed IP / VPN).

## Pages

| Page | What it shows |
| --- | --- |
| **Overview** | KPIs: merchants, paying, revenue, signups, alerts; install & signup trends; feature/channel split; funnel |
| **Conversion & Revenue** | Funnel (sent→delivered→opened→clicked→orders), revenue by month, BIS vs upsell attribution, top products, free→paid merchant conversion |
| **Shops Explorer** | Every merchant with per-shop signups, alerts, **app revenue** and **what we charged them**. Filters: search, plan, status, install date range. Click any shop → |
| **Shop detail** (`/shops/[id]`) | One merchant in full: profile, plan, **charge history & lifetime billed**, usage billing, earnings funnel, top products, notifications, BIS config, recent signups |
| **Installs** | Installs by month/day, by plan, language, country; recent installs/uninstalls |
| **Churn & Uninstalls** | Merchant churn, cancelled subscriptions, unsubscribes, handprint event log |
| **Plans & Billing** | Active/cancelled subscriptions, recurring revenue by plan, usage billing, trials, plan limits |
| **Notifications** | 1.1M signups by feature/channel/status, delivery via email + SMS/WhatsApp, by country |
| **Features** | The 4 features (Back in Stock, Price Drop, Sale Alerts, Pre-orders) + Upsell |
| **Table Explorer** | Browse any of the 68 tables directly, with search/sort/paging |
| **Schema & Mapping** | Full schema + auto-detected mapping |

## Data model (key tables)

- `users` — merchants (`created_at`=install, `deleted_at`=uninstall, `plan_id`→`plans`)
- `charges` — subscriptions we billed (status ACTIVE/CANCELLED, price, plan_id)
- `shopify_usage_base_charges` — pay-as-you-go SMS/WhatsApp billing
- `variant_stock_notifications` (1.1M) — shopper signups; `fun_type` = feature
  (notify_me / price_drop / sales_alert), `type` = channel (email/mobile/whatsApp)
- `variant_stock_notification_settings` — per-shop BIS config
- `bis_mails`, `sent_s_m_s_responses` — delivery
- `bis_analytics_daily` / `_products` — performance funnel & revenue per shop/product
- `analytics_orders` — attributed orders (`is_bis_order` / `is_upsell_order`)
- `preorder_*`, `upsell_*`, `pricedrops`, `sale_alerts`, `popups` — feature data

## Schema inspector

`npm run inspect` regenerates `schema-report.md` + `schema-dump.json`
(full schema, counts, sample rows, distinct values). Both are gitignored.

## Safety

All queries are SELECT / information_schema only. Identifiers used in the table
explorer are validated against the live schema; filter values are bound
parameters. The DB user is read-only.
