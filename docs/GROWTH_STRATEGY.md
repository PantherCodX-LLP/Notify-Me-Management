# Growth Strategy — Converting Merchants to Paid & Earning App Store Reviews

**App:** Notify Me / Back in Stock — https://apps.shopify.com/notifyme
**Scope:** (1) Convert existing + new free-plan merchants to paid. (2) Ask active, non-blocked merchants to leave a Shopify App Store review.
**Status:** Research-backed playbook. Sources cited inline. Compliance items are non-negotiable — Shopify actively enforces them.

---

## 0. TL;DR — what to do first

1. **Activation is the #1 lever.** Get a new install to capture and send its first back-in-stock alert as fast as possible (target < 15 min, ideally < 5). Users who hit the core action in week 1 convert ~5× more. Nothing else matters if they never reach value.
2. **Sell on proven ROI, not features.** The strongest upgrade moment for a restock app is *right after it recovers a sale*. "Notify Me recovered $X for your store" is your best upgrade and review trigger.
3. **Nudge at the usage limit.** Prompt upgrades when a merchant hits 85–95% of their monthly alert/send quota — the highest-intent window.
4. **Use Shopify App Pricing (managed pricing) for the upgrade flow.** It is now Shopify's default/recommended billing and handles upgrades, trials, proration, and trial-abuse automatically.
5. **Reviews: neutral + opt-in only.** Never incentivize, never ask only for "positive" reviews, never email without consent. Deep link: `https://apps.shopify.com/notifyme#modal-show=WriteReviewModal`. In-admin: App Bridge `shopify.reviews.request()`.

Realistic benchmark: **3–5% free→paid is a solid freemium target; 6%+ is strong.** Don't plan around the 15–50% figures you'll see online — those are credit-card/auto-convert trials, not free-forever apps.

---

## 1. Free → Paid conversion playbook

### 1.1 Billing mechanics (for the app dev team)

The admin dashboard is read-only, so these are implemented in the **merchant-facing app**, not here.

- **Use Shopify App Pricing (formerly "Managed Pricing").** Define plans in the Partner Dashboard; Shopify hosts the plan-selection page and automates recurring charges, free trials, proration, price updates, and **upgrades/downgrades**. It's now the default and recommended path; the classic Billing API is marked legacy. [shopify.dev/docs/apps/launch/billing]
  - Hosted plan page URL: `https://admin.shopify.com/store/:store_handle/charges/:app_handle/pricing_plans`. [shopify.dev/docs/apps/launch/billing/managed-pricing]
  - Built-in **trial-abuse protection**: trial days tracked over a rolling 180-day window so merchants can't reinstall to reset a trial. [same]
  - Up to 4 public plans + 10 private plans (for bespoke deals, up to 20 stores each). [same]
  - Usage-based billing is now supported via the App Events API (fixed/graduated/volume). [shopify.dev/changelog — Shopify App Pricing]
- **If you stay on the legacy Billing API:** the upgrade flow is `appSubscriptionCreate` (args `name`, `returnUrl`, `lineItems`; optional `trialDays`, `test`, `replacementBehavior` for plan swaps) → redirect merchant to the returned `confirmationUrl` → they approve → Shopify returns to `returnUrl` → verify the active subscription. Usage charges via `appUsageRecordCreate`; cap changes via `appSubscriptionLineItemUpdate` (also returns a `confirmationUrl`). [shopify.dev/docs/api/admin-graphql/latest/mutations/appSubscriptionCreate]
- **Embedded-app redirect gotcha:** the upgrade redirect must target the **top window** via App Bridge (`target: "_top"`) — an iframe can't redirect the parent. [shopify.dev/docs/apps/launch/billing/redirect-plan-selection-page]
- **Always verify after approval** by querying subscription status (and subscribe to the `APP_SUBSCRIPTIONS_UPDATE` webhook) — don't trust the redirect alone; webhooks can lag a few minutes. [shopify.dev/docs/apps/launch/billing/managed-pricing]
- **Compliance:** all billing must go through a Shopify billing solution; gated features must be **disabled both visually and functionally** and clearly marked as gated (you cannot show a feature as enabled then paywall it on click). Remember to set `test: false` before launch. [shopify.dev/docs/apps/launch/app-store-review/pass-app-review]

### 1.2 In-app upgrade prompts (paywalls / nudges)

- **Paywall at the value metric, not behind every feature.** Free plan should be genuinely useful but capped on a value metric — for this app that's **monthly alerts/sends**. Users form a habit, then hit a clear paid reason. [growthwithgary.com/p/packaging]
- **Usage-limit nudge:** show a progress bar / remaining-credit counter / reset timer. Soft "approaching limit" nudge at ~85%, strong upgrade CTA at 90–95% and at the hard limit. Lead with the specific unlock ("unlock unlimited alerts"), not "upgrade your plan." [razegrowth.com; stripe.com usage-based pricing]
- **Set the free cap just below the economic break-even** with the first paid tier, so a merchant who consistently maxes out is rationally better off upgrading. [dealhub.io/glossary/overage-billing]
- **Value-moment prompt:** when the app recovers a sale, surface "Notify Me recovered $X for you this month — upgrade to capture more." In-app triggers at high-intent moments convert markedly better than scheduled asks. [productgrowth.in; razegrowth.com]
- **Native surface:** Shopify now shows a billing card on the app's admin settings page (plan, status, usage, upcoming changes), so you don't have to build all paywall UX yourself. [shopify.dev/changelog]

### 1.3 Onboarding-driven conversion (new installs)

- **Target time-to-first-value < 15 min** (< 5 min is world-class). Faster value → higher activation and retention; ~5-min "aha" correlates with ~40% higher 30-day retention. [saasfactor.co; shno.co]
- Industry **activation rate ~37.5%**, top performers > 45%; below ~30% usually means CAC > LTV. Instrument and watch this number. [saasfactor.co]
- Onboarding checklist: install the storefront widget → confirm it's visible on a product page → capture a test "notify me" signup → send/preview the first alert. Each step is a step toward the aha moment.
- **Offer a free trial on the paid plan** during onboarding (Shopify App Pricing handles it). Continued use past trial = an invested user and a better review candidate later.

### 1.4 Pricing & packaging

- **Annual billing**: standard 15–20% discount; annual plans churn far less and lift LTV substantially (directional). Offer monthly + annual. [winsavvy.com; pricingio.com]
- **Anchor tiers** so the plan you want most sits between a weak cheaper option and a pricier one (decoy effect). [pricingio.com]
- **Packaging > price.** Across the PricingSaaS 500, 2024 had more packaging changes than price changes — plan structure drives conversion more than the headline number. Revisit what's in the free vs paid tiers before discounting. [pricingio.com]
- Bill in the merchant's local currency (`shopBillingPreferences`), keep the number of plans small, and consider a $1 / low entry plan. [shopify.dev/docs/apps/launch/billing]

### 1.5 Email campaigns to convert free users (built in this dashboard)

- **Behavior-triggered > time-based drips** (~4× conversion, ~74% higher opens). Segment by what merchants *do*, not by day number. [emailsequencetools.com]
- Segment into **activated / on-track / inactive**: activated users get expansion/upgrade content; inactive users get re-activation help (not a pricing pitch). Activated users convert ~5–10× higher. [emailsequencetools.com]
- Drive early emails to the **activation event**, not the pricing page — activation in the first 48h ≈ 3× more likely to convert. [emailsequencetools.com]
- Keep sequences short and sharp (a focused handful beats a 15-email blast). [emailsequencetools.com]
- **Personalize with their own numbers**: signups collected, alerts sent, revenue the app generated. This is exactly the data this dashboard already computes per shop.

---

## 2. Review-generation playbook

> **Compliance first — Shopify enforces this and penalties escalate to delisting and Partner-account termination.** [shopify.dev/docs/apps/launch/marketing/manage-app-reviews; help.shopify.com/en/partners/help-support/faq/reviews]

### 2.1 Hard rules (do / don't)

- ✅ **You may ask** for a review using **neutral, non-incentivized** language. Shopify-approved example: *"We value feedback! It helps us make our product better and keeps us energized."*
- ❌ **No incentives.** Never offer a discount, free month, credit, or gift card for a review ("Get one month free by leaving a review!" is explicitly banned). Gift cards fall under "discount or other benefit."
- ❌ **Don't ask only for positive reviews.** "Like our service? Leave a positive review!" is prohibited — keep it neutral.
- ❌ **No review gating** by sentiment (asking only happy merchants). Not named by that term, but it conflicts with the neutral-language + no-positive-ask rules. Targeting *active, non-blocked* merchants is fine (engagement filter, not sentiment filter); just keep the ask neutral.
- ❌ **No unsolicited emails.** Review-request emails require **prior opt-in consent** (CAN-SPAM/CASL + Partner agreement). Always include an **opt-out** ("we won't ask again").
- ❌ **Don't ask during onboarding/installation** — they must have used the app enough to form an opinion.
- ❌ **No fake reviews**, no reviewing your own/competitor apps, no pressuring merchants to revise negative reviews.

### 2.2 Who can review

- Only merchants **with the app installed** (or within **45 days of uninstalling**) can review.
- Reviews from free-trial / frozen / non-active-plan stores may be archived and not counted — so **active paid (or active full-plan) merchants are your best review targets**.
- One review per store/account.

### 2.3 Two channels

**A. In-admin native prompt (best, build in the app):** App Bridge **Reviews API** — call `shopify.reviews.request()`; Shopify decides whether to show the modal and enforces caps automatically:
- At most **once per 60 days** and **3× per 365 days**; never in the first **24h** after install; never on mobile; never if already reviewed.
- Best practice: trigger **at the end of a successful workflow** (e.g., after a batch of alerts sends or a recovered sale), **not** on a direct merchant click and **not** at app open. [shopify.dev/docs/api/app-home/apis/.../reviews-api]

**B. Email request (build in this dashboard):** for opted-in, active, non-blocked merchants.
- Deep link (verified): **`https://apps.shopify.com/notifyme#modal-show=WriteReviewModal`** — opens the "write a review" modal. (Do **not** use `ReviewListingModal`; that value is not official.) [shopify.dev/docs/apps/launch/marketing/manage-app-reviews]

### 2.4 Timing / triggers

- After a **value moment**: app recovered a sale / sent a batch of successful alerts.
- After **N days of active use** (e.g., 14–30 days) past any trial.
- After a **positive support interaction**.
- General SaaS guidance: ~3–5 days after a key success event. [userlist.com]
- Mirror Shopify's caps in your email cadence: ≤ 1 ask per 60 days, at most one gentle follow-up, stop on review or opt-out.

### 2.5 Email best practices + approved copy

- **Subject** < ~50 chars, personalized, no clickbait — e.g. *"How's Notify Me working for {{store_name}}?"*
- **One clear CTA** ("Leave a review"), no competing links. Keep body short (< ~60 words). Personalize with their store name + what the app did.
- **Shopify-approved phrasings you can use verbatim:**
  - "We value feedback! It helps us make our product better and keeps us energized. Let us know how we're doing."
  - "We want to hear about your experience with our app! Leave a review on the Shopify App Store."
  - "We value your opinion. Let other merchants know how our app is working for you by leaving a review on the Shopify App Store."
- **Structure:** (1) genuine thank-you referencing their use, (2) 1–2 sentence neutral ask tied to a value moment, (3) one CTA button → the deep link, (4) soft opt-out + support channel.

---

## 3. Segmentation — who to target first (from THIS database)

The dashboard already computes the signals below per shop. Suggested priority order:

### Upgrade targets (free → paid)
1. **Free + highly active** — `FREE_USER`/freemium with high signups collected and alerts sent in the last 30 days. They feel the value and (likely) the limits. **Highest intent.**
2. **Free + at/near usage limit** — cross-reference `shop_current_plan_limits` / "merchants at plan limit." Prime for a usage-limit nudge.
3. **Free + revenue generated** — `bis_analytics_daily.revenue_generated > 0`. Lead with proven ROI.
4. **Free + multi-feature** — using 2+ of the 4 features; already invested.
5. Exclude: churned (`deleted_at`), blocked (`meta_data.is_user_blocked`), and brand-new installs (< a few days — still onboarding).

### Review targets (active, non-blocked)
1. **Active, on a paid/full plan, engaged** (alerts sent above a threshold), **not blocked**, installed > ~14–30 days. Best chance the review counts and is positive-leaning without gating.
2. Recently had a **value moment** (revenue generated / large alert batch).
3. **Opted in** to email + **not asked in the last 60 days** + haven't already reviewed/opted out.
4. Exclude: blocked, churned, free-trial/frozen (their reviews may not count), brand-new installs.

---

## 4. What we're building in this dashboard

Because the dashboard is read-only and separate from the merchant app, we implement the **email** side here (you already have the Email Outreach engine, i18n templates, and per-shop stats). The **in-app billing prompts and App Bridge review modal** are specs for the app dev team (Section 1.1–1.2, 2.3A).

Built here:
- **Upgrade campaign** — targets free, active merchants; compliant upgrade email personalized with their signups/alerts/revenue and the value-metric pitch.
- **Review-request campaign** — targets active, non-blocked, engaged merchants; **neutral, opt-in, non-incentivized** template with the verified deep-link CTA and an opt-out line.

---

## Sources

Conversion / billing: shopify.dev/docs/apps/launch/billing · /billing/managed-pricing · /billing/redirect-plan-selection-page · /docs/api/admin-graphql/latest/mutations/appSubscriptionCreate · /changelog (Shopify App Pricing) · /docs/apps/launch/app-store-review/pass-app-review
Benchmarks / tactics: firstpagesage.com/seo-blog/saas-freemium-conversion-rates · adv.me/articles/conversion-optimization/saas-free-trial-conversion-rate-benchmarks-2025 · razegrowth.com/blog/saas-expansion-revenue-design · growthwithgary.com/p/packaging · pricingio.com/blog/saas-pricing-strategies · emailsequencetools.com/blog/trial-conversion-sequences · saasfactor.co · stripe.com/resources (usage-based pricing) · productgrowth.in/insights/saas/expansion-revenue
Reviews: shopify.dev/docs/apps/launch/marketing/manage-app-reviews · help.shopify.com/en/partners/help-support/faq/reviews · shopify.dev/docs/api/app-home/apis/user-interface-and-interactions/reviews-api · shopify.com/partners/blog/get-reviews-for-your-shopify-apps · wiserreview.com/blog/review-request-email · testimonial.to/resources/review-request-email-examples
