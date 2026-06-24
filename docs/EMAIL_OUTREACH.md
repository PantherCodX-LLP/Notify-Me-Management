# Email Outreach (Growth → Email Outreach)

Targets **paying merchants who aren't using all four features** and proposes a
personalised growth email for each, built from that shop's own stats.

## Who it targets
- **Paid only** — a shop with an ACTIVE recurring charge (free users are excluded).
- **Still installed** — `users.deleted_at IS NULL`.
- **Missing ≥1 feature** — feature = Back in Stock / Price Drop / Sale Alerts /
  Pre-orders. "Using" a feature = the shop appears in that feature's usage set
  (`lib/stats.ts` → `getFeatureSets`).
- Ranked by **revenue opportunity** (existing app-driven revenue, then signups).
- Recommended feature priority: Pre-orders → Price Drop → Sale Alerts → Back in Stock.

## What you see
- Summary: number of paid targets and how many are missing each feature.
- A paginated list (20/page) of target shops: plan, app revenue, missing features,
  the recommended feature, and the email subject.
- **Preview pane** — click *Preview ✉* to render the exact personalised HTML email
  for that shop (greeting, their results, the missing feature + benefit, CTA).

Templates live in `lib/email.ts` (`buildEmail`, `FEATURE_INFO`) — edit copy there.

## Daily refresh (9 AM IST)
The page reads the **local snapshot**, which the importer refreshes every morning
(set `TZ=Asia/Kolkata`, `IMPORT_HOUR=9`, `IMPORT_MINUTE=0` in `.env`). So each
morning the recommendations reflect the latest data automatically.

## Sending the emails (opt-in — not enabled)
For safety, **nothing is sent automatically**. The dashboard only recommends and
previews. To actually send, the planned next step is a small dispatcher that:
1. calls `getEmailRecommendations` for the day's targets,
2. renders `buildEmail` per shop,
3. sends via **your** SMTP/ESP (e.g. SES, SendGrid, SMTP) using credentials you
   provide in env, with a daily cap and a suppression list.

Tell me your email provider and we'll wire the scheduled 9 AM send (with a dry-run
mode first). Until then, use the previews to review and send through your existing
tool.

## Editing the design (merge tags)

The Email Outreach tab now has a **composer**. Click *Compose ✉* on any target to
edit the email for that shop:

- **Subject + HTML** are fully editable — paste your own HTML design.
- Use **merge tags** like `{{store_name}}` that fill in per shop. Click any tag
  chip to insert it at the cursor. Available tags:

  `{{store_name}}` `{{shop_domain}}` `{{store_url}}` `{{email}}` `{{plan}}`
  `{{app_revenue}}` `{{app_orders}}` `{{signups}}` `{{alerts_sent}}`
  `{{used_features}}` `{{missing_features}}` `{{recommended_feature}}`
  `{{recommended_how}}` `{{recommended_benefit}}`
  `{{most_requested_products}}` (HTML list) `{{most_requested_block}}` (heading+list, empty if none)
  `{{most_requested_products_text}}` `{{app_url}}` `{{date}}`

- The **preview** (right, large + scrollable) renders the template merged with the
  selected shop's real data live as you type.
- Your template is saved in the browser (localStorage). **Reset to default**
  restores the built-in design. Default template lives in `lib/email.ts`.

## Sending (opt-in)

Sending is **off until SMTP is configured**. To enable, set these in `.env`
(passed through to the dashboard container):

```
SMTP_HOST=smtp.your-provider.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=...
SMTP_PASS=...
MAIL_FROM="Notify Me <noreply@yourdomain.com>"
```

Then in the composer use **Send test** (to any address) to check rendering, and
**Send to shop** to send to the merchant's email. Each send is a manual click —
there is no automatic blast.

## Languages

Emails auto-adapt to the **store's language** (`users.shop_current_language`):
- The composer detects the store language and translates the default template's
  copy + the feature pitch (`{{recommended_feature/how/benefit}}`) into it.
- Supported out of the box: English, Español, Français, Deutsch, Italiano,
  Português (others fall back to English, still fully editable).
- A **Language** dropdown lets you switch; the preview re-renders in that language.
- `{{language}}` / `{{language_name}}` are available as merge tags, and the target
  list shows each shop's language.
- Translations live in `lib/email.ts` (`I18N`, `FEATURE_I18N`) — edit/extend there.
