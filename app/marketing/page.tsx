"use client";

import { useEffect, useState } from "react";

type Item = { id: string; title: string; how: string; links?: { label: string; url: string }[] };
type Channel = { key: string; icon: string; title: string; sub: string; items: Item[] };

const REVIEW_LINK = "https://apps.shopify.com/notifyme#modal-show=WriteReviewModal";

const CHANNELS: Channel[] = [
  {
    key: "aso",
    icon: "🔎",
    title: "1 · App Store Optimization (free, highest ROI)",
    sub: "70%+ of installs come from App Store search. Reviews + keywords + Built for Shopify drive ranking.",
    items: [
      { id: "aso-reviews", title: "Close the review gap — the #1 lever", how: "Top competitors have 2,800–3,000 reviews; you have ~100. Reviews are a confirmed Shopify ranking AND conversion signal. Add a neutral, opt-in in-app review prompt (App Bridge shopify.reviews.request()) after a positive value moment or support chat, and use the Review-request campaign in the Email Outreach tab for opted-in merchants.", links: [{ label: "Open review modal (deep link)", url: REVIEW_LINK }, { label: "Shopify review rules", url: "https://shopify.dev/docs/apps/launch/marketing/manage-app-reviews" }] },
      { id: "aso-reply", title: "Reply to every review (esp. negatives)", how: "From Partner Dashboard → Apps → reviews, publicly reply to all reviews. Helpful replies to 1-star reviews show prospective installers you care and often prompt the merchant to raise their rating. Resolve recurring complaints (e.g. feature limits) then ask them to reconsider — allowed, with NO incentive." },
      { id: "aso-name", title: "Put primary keywords in name & tagline", how: "App name ≤ 30 chars (lead with brand + keyword), tagline ≤ 62 chars. Most page-1 apps have the keyword in the name. Target what merchants actually type: 'back in stock', 'restock alert', 'notify me', 'preorder', 'waitlist'." },
      { id: "aso-keywords", title: "Fill all 5 search terms in Partner admin", how: "Partner Dashboard lets you set hidden search terms that feed ranking. Use all 5 with high-intent 2–4 word phrases (e.g. 'back in stock app', 'restock notification', 'preorder app')." },
      { id: "aso-desc", title: "Optimize description & screenshots", how: "Description 100–2,800 chars, plain and benefit-led. AVOID keyword-stuffing, superlatives ('best/first/only') and outcome guarantees — they cause editorial rejection. Add keyword-rich ALT text to every screenshot (also helps Google). Lead with a benefit-focused first screenshot + a demo video." },
      { id: "aso-bfs", title: "Maintain Built for Shopify (already earned)", how: "BFS gives priority placement + plan-based ad targeting and reportedly ~+49% installs. Keep the requirements: admin Web Vitals (LCP ≤2.5s, CLS ≤0.1, INP ≤200ms), storefront Lighthouse impact ≤10, rating threshold, active installs. Re-verify the July-2025 category-specific criteria.", links: [{ label: "BFS requirements", url: "https://shopify.dev/docs/apps/launch/built-for-shopify/requirements" }] },
      { id: "aso-visible", title: "Confirm the listing is fully visible", how: "Partner Dashboard → Apps → Distribution → Manage listing → 'Make fully visible'. Only fully-visible listings are indexed in category pages, App Store search, and Google." },
    ],
  },
  {
    key: "content",
    icon: "✍️",
    title: "2 · Content & SEO",
    sub: "Rank on Google for buying-intent queries and get into 'best back-in-stock apps' roundups.",
    items: [
      { id: "c-compare", title: "Build comparison / alternative pages", how: "Create pages targeting bottom-funnel intent: '[Competitor] alternative', 'best back in stock apps for Shopify', 'Shopify waitlist app'. These convert because the searcher is ready to choose." },
      { id: "c-blog", title: "Publish 2–4 high-intent posts/month", how: "Topics: 'how to recover lost sales from out-of-stock products', 'back in stock email/SMS templates that convert', 'how to set up a Shopify restock waitlist'. Quality over quantity — thin posts don't rank." },
      { id: "c-roundups", title: "Get into third-party app roundups", how: "Sites like DelightChat, Meetanshi, Webcontrive rank for 'best back in stock apps' and hand-test apps. Entry requirement: a polished free plan + responsive support, then pitch with a personalized email showing how you fit their list. Reputable outlets never sell placement — relationships + quality only." },
      { id: "c-docs", title: "Turn help docs + YouTube into SEO assets", how: "Separate, indexable, keyword-targeted help/FAQ pages and a YouTube setup walkthrough capture 'how to' traffic and double as conversion content for hesitant merchants." },
      { id: "c-meta", title: "Mirror keywords into listing meta", how: "Your listing tagline/description act as the title tag + meta description in Google. Put your top 5 keywords there so the fully-visible listing ranks off-platform too." },
    ],
  },
  {
    key: "paid",
    icon: "💸",
    title: "3 · Paid Ads",
    sub: "Start with App Store ads (highest intent + relevance discount). Off-platform ads only for retargeting.",
    items: [
      { id: "p-appstore", title: "Run Shopify App Store ads first", how: "Three native CPC ad types: Search results, Category pages, Homepage (first-price auction). Search ads reward relevance — a highly relevant app pays LESS per click and ranks higher. Bid on your own category keywords (you compete directly with STOQ/Notify!/Essent there). Requires Partner in good standing.", links: [{ label: "App Store advertising", url: "https://shopify.dev/docs/apps/launch/marketing/advertising" }] },
      { id: "p-google", title: "Small Google Search budget on intent terms", how: "Bid on 'Shopify back in stock app', 'restock notification app', and competitor + 'alternative'. Expect ~$3–5 CPC; a $10–50/mo app needs months of LTV to recoup CAC, so keep it bottom-funnel only." },
      { id: "p-retarget", title: "Use Meta only for retargeting", how: "Cold social ads to a niche merchant tool usually lose money. Use Meta/retargeting to re-engage people who visited your listing or site, not for cold acquisition." },
      { id: "p-plan", title: "Target ads by merchant plan (BFS perk)", how: "Because you're Built for Shopify, you can target App Store ads by merchant plan — focus spend on plans most likely to convert to paid." },
    ],
  },
  {
    key: "community",
    icon: "🤝",
    title: "4 · Partnerships & Community",
    sub: "Agencies, affiliates, cross-app co-marketing, and genuine community presence.",
    items: [
      { id: "pa-partner", title: "Join the Shopify Partner Program", how: "Free; unlocks marketing materials, community access, revenue-share, and is required to run App Store ads anyway.", links: [{ label: "Shopify Partners", url: "https://www.shopify.com/partners" }] },
      { id: "pa-agencies", title: "Partner with Shopify agencies / Experts", how: "Agencies build merchant stores constantly. Get listed as their recommended back-in-stock app so they install it during builds. Offer them a simple referral arrangement." },
      { id: "pa-affiliate", title: "Launch an affiliate / referral program", how: "Pay agencies/creators per referred install using UpPromote, ReferralCandy, or Refersion. Never distribute referral links as spam — that's grounds for account termination." },
      { id: "pa-crossapp", title: "Co-market with complementary apps", how: "You already integrate with Klaviyo. Pursue joint content, integration-directory listings, and co-marketing with email/SMS, reviews, and upsell apps whose merchants overlap with yours." },
      { id: "pa-community", title: "Be genuinely helpful in communities", how: "Shopify Community forums, r/Shopify, r/ecommerce, and large ecommerce Facebook groups. Answer 'how do I notify customers when items restock?' questions helpfully — don't spam links. Soft mentions of your app where truly relevant." },
    ],
  },
];

const PRIORITY = [
  "Add a neutral in-app review prompt + run the Review-request email campaign (close the review gap).",
  "Reply to all existing reviews and resolve recurring 1-star themes.",
  "Put primary keywords in the app name/tagline and fill all 5 hidden search terms.",
  "Buy App Store search + category ads on your category keywords.",
  "Publish 2–3 comparison/alternative SEO pages and pitch 'best back-in-stock apps' roundups.",
];

const ALL_IDS = CHANNELS.flatMap((c) => c.items.map((i) => i.id));

export default function MarketingPage() {
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("marketing.checklist");
      if (raw) setDone(JSON.parse(raw));
    } catch {}
    setLoaded(true);
  }, []);
  useEffect(() => {
    if (loaded) try { localStorage.setItem("marketing.checklist", JSON.stringify(done)); } catch {}
  }, [done, loaded]);

  const toggle = (id: string) => setDone((d) => ({ ...d, [id]: !d[id] }));
  const total = ALL_IDS.length;
  const completed = ALL_IDS.filter((id) => done[id]).length;
  const pct = Math.round((completed / total) * 100);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Marketing</h1>
          <p>A step-by-step playbook to get more installs and revenue for Notify Me / Back in Stock. Tick items as you go.</p>
        </div>
        <a className="btn" href="https://apps.shopify.com/notifyme" target="_blank" rel="noopener noreferrer">View listing ↗</a>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <h3 style={{ margin: 0 }}>Overall progress</h3>
          <span className="muted" style={{ fontSize: 13 }}>{completed} / {total} done · {pct}%</span>
        </div>
        <div style={{ height: 10, background: "var(--panel-2)", borderRadius: 999, overflow: "hidden", border: "1px solid var(--border)" }}>
          <div style={{ width: `${pct}%`, height: "100%", background: "linear-gradient(90deg,#6366f1,#8b5cf6)", transition: "width .3s" }} />
        </div>
      </div>

      <div className="notice" style={{ marginBottom: 16 }}>
        <strong>Biggest lever:</strong> your listing carries the Built for Shopify badge but has far fewer reviews than top competitors (who have 2,800+). Reviews drive both ranking and conversion, so the review &amp; rating work in Section 1 is the highest-impact thing you can do. Keep all review asks <strong>neutral and opt-in</strong> — Shopify prohibits incentives and asking only for positive reviews.
      </div>

      <div className="card" style={{ marginBottom: 18 }}>
        <h3>🚀 Priority quick-start (do these first)</h3>
        <ol style={{ margin: "8px 0 0", paddingLeft: 20, lineHeight: 1.7 }}>
          {PRIORITY.map((p, i) => <li key={i}>{p}</li>)}
        </ol>
      </div>

      {CHANNELS.map((c) => {
        const cDone = c.items.filter((i) => done[i.id]).length;
        return (
          <div className="card" key={c.key} style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
              <h3 style={{ margin: 0 }}>{c.icon} {c.title}</h3>
              <span className="muted" style={{ fontSize: 12.5, whiteSpace: "nowrap" }}>{cDone}/{c.items.length}</span>
            </div>
            <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>{c.sub}</p>
            <div style={{ marginTop: 8 }}>
              {c.items.map((it) => (
                <div key={it.id} style={{ display: "flex", gap: 10, padding: "12px 0", borderTop: "1px solid var(--border)" }}>
                  <input type="checkbox" checked={!!done[it.id]} onChange={() => toggle(it.id)} style={{ marginTop: 3, cursor: "pointer", width: 16, height: 16, flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, textDecoration: done[it.id] ? "line-through" : "none", opacity: done[it.id] ? 0.6 : 1 }}>{it.title}</div>
                    <div className="muted" style={{ fontSize: 13, marginTop: 3, lineHeight: 1.55 }}>{it.how}</div>
                    {it.links && it.links.length ? (
                      <div style={{ marginTop: 6, display: "flex", gap: 12, flexWrap: "wrap" }}>
                        {it.links.map((l) => (
                          <a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer" style={{ color: "var(--primary)", fontSize: 12.5, textDecoration: "none" }}>{l.label} ↗</a>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>
        Full details, benchmarks and sources are in <strong>docs/MARKETING_PLAN.md</strong> and <strong>docs/GROWTH_STRATEGY.md</strong>. Progress is saved in your browser.
      </div>
    </>
  );
}
