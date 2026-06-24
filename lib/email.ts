// Personalised, multi-language growth emails. Templates use {{merge_key}}
// placeholders so the design is fully editable; copy auto-translates to the
// store's language. Pure functions (no DB).

export interface FeatureInfo { label: string; how: string; benefit: string; }

// English feature copy (base / fallback)
export const FEATURE_INFO: Record<string, FeatureInfo> = {
  notify_me: { label: "Back in Stock", how: "automatically email, SMS & WhatsApp shoppers the moment an out-of-stock product is available again", benefit: "recover the sales you lose every time a product goes out of stock" },
  price_drop: { label: "Price Drop alerts", how: "notify interested shoppers the moment a product they wanted drops in price", benefit: "bring back price-sensitive shoppers and convert them automatically" },
  sales_alert: { label: "Sale Alerts", how: "alert your subscribers the instant products go on sale", benefit: "turn every promotion into a conversion spike" },
  preorder: { label: "Pre-orders", how: "let customers buy out-of-stock or upcoming products in advance", benefit: "capture revenue you'd otherwise lose to an ‘out of stock’ page" },
};

// Per-language feature copy (fallback to FEATURE_INFO when missing)
export const FEATURE_I18N: Record<string, Record<string, FeatureInfo>> = {
  es: {
    notify_me: { label: "Aviso de Reposición", how: "avisar automáticamente por email, SMS y WhatsApp en cuanto un producto agotado vuelve a estar disponible", benefit: "recuperar las ventas que pierdes cada vez que un producto se agota" },
    price_drop: { label: "Avisos de Bajada de Precio", how: "avisar a los compradores interesados en cuanto baja el precio de un producto", benefit: "recuperar compradores sensibles al precio y convertirlos automáticamente" },
    sales_alert: { label: "Avisos de Rebajas", how: "avisar a tus suscriptores en cuanto los productos entran en oferta", benefit: "convertir cada promoción en un pico de ventas" },
    preorder: { label: "Pedidos Anticipados", how: "permitir comprar productos agotados o próximos por adelantado", benefit: "capturar ingresos que perderías con una página de ‘agotado’" },
  },
  fr: {
    notify_me: { label: "Alerte Retour en Stock", how: "prévenir automatiquement par email, SMS et WhatsApp dès qu’un produit épuisé est de nouveau disponible", benefit: "récupérer les ventes perdues à chaque rupture de stock" },
    price_drop: { label: "Alertes Baisse de Prix", how: "prévenir les clients intéressés dès qu’un produit baisse de prix", benefit: "reconquérir les clients sensibles au prix et les convertir automatiquement" },
    sales_alert: { label: "Alertes Promotions", how: "prévenir vos abonnés dès qu’un produit est en promotion", benefit: "transformer chaque promotion en pic de conversions" },
    preorder: { label: "Précommandes", how: "permettre d’acheter à l’avance les produits épuisés ou à venir", benefit: "capter le chiffre d’affaires perdu sur une page ‘rupture de stock’" },
  },
  de: {
    notify_me: { label: "Wieder-verfügbar-Benachrichtigung", how: "Kund:innen automatisch per E-Mail, SMS & WhatsApp informieren, sobald ein ausverkauftes Produkt wieder verfügbar ist", benefit: "Umsätze zurückgewinnen, die bei Ausverkauf verloren gehen" },
    price_drop: { label: "Preissenkungs-Alerts", how: "interessierte Kund:innen benachrichtigen, sobald ein Produkt im Preis fällt", benefit: "preissensible Kund:innen zurückholen und automatisch konvertieren" },
    sales_alert: { label: "Sale-Benachrichtigungen", how: "Abonnent:innen informieren, sobald Produkte im Angebot sind", benefit: "jede Aktion in einen Conversion-Schub verwandeln" },
    preorder: { label: "Vorbestellungen", how: "Kund:innen ausverkaufte oder kommende Produkte vorab kaufen lassen", benefit: "Umsatz sichern, der sonst an einer ‚ausverkauft‘-Seite verloren geht" },
  },
  it: {
    notify_me: { label: "Avviso Disponibilità", how: "avvisare automaticamente via email, SMS e WhatsApp appena un prodotto esaurito torna disponibile", benefit: "recuperare le vendite perse a ogni esaurimento scorte" },
    price_drop: { label: "Avvisi Calo di Prezzo", how: "avvisare i clienti interessati appena un prodotto cala di prezzo", benefit: "riportare i clienti sensibili al prezzo e convertirli automaticamente" },
    sales_alert: { label: "Avvisi Saldi", how: "avvisare i tuoi iscritti appena i prodotti vanno in offerta", benefit: "trasformare ogni promozione in un picco di conversioni" },
    preorder: { label: "Preordini", how: "permettere di acquistare in anticipo prodotti esauriti o in arrivo", benefit: "recuperare ricavi che perderesti con una pagina ‘esaurito’" },
  },
  pt: {
    notify_me: { label: "Aviso de Reposição", how: "avisar automaticamente por email, SMS e WhatsApp assim que um produto esgotado volta ao estoque", benefit: "recuperar as vendas perdidas sempre que um produto esgota" },
    price_drop: { label: "Alertas de Queda de Preço", how: "avisar os clientes interessados assim que um produto baixa de preço", benefit: "trazer de volta clientes sensíveis a preço e convertê-los automaticamente" },
    sales_alert: { label: "Alertas de Promoção", how: "avisar seus inscritos assim que os produtos entram em promoção", benefit: "transformar cada promoção em um pico de conversões" },
    preorder: { label: "Pré-encomendas", how: "permitir comprar produtos esgotados ou futuros antecipadamente", benefit: "capturar receita que você perderia em uma página de ‘esgotado’" },
  },
};

// UI copy strings per language. Placeholders: %store% %plan% %used% %rev% %orders% %signups% %feature%
interface Phrases {
  subject: string; header_kicker: string; header_title: string; greeting: string; intro: string;
  win_label: string; requested_heading: string; takes_minutes: string; cta: string; footer: string;
}
export const I18N: Record<string, Phrases> = {
  en: {
    subject: "%store%: grow your store revenue with %feature%",
    header_kicker: "Notify Me · Back in Stock",
    header_title: "Unlock more revenue for %store%",
    greeting: "Hi %store% team,",
    intro: "You're on the %plan% plan and using %used%. So far the app has driven %rev% from %orders% orders, with %signups% shopper signups collected.",
    win_label: "One quick win you haven't switched on yet:",
    requested_heading: "Your most-requested products right now:",
    takes_minutes: "It takes a couple of minutes to enable and runs automatically alongside your existing alerts.",
    cta: "Enable %feature% →",
    footer: "You're receiving this because %store% is on the %plan% plan. Reply if you'd like a hand setting it up.",
  },
  es: {
    subject: "%store%: haz crecer los ingresos de tu tienda con %feature%",
    header_kicker: "Notify Me · Aviso de Reposición",
    header_title: "Desbloquea más ingresos para %store%",
    greeting: "Hola equipo de %store%,",
    intro: "Estás en el plan %plan% y usas %used%. Hasta ahora la app ha generado %rev% en %orders% pedidos, con %signups% registros de compradores.",
    win_label: "Una mejora rápida que aún no has activado:",
    requested_heading: "Tus productos más solicitados ahora mismo:",
    takes_minutes: "Se activa en un par de minutos y funciona automáticamente junto a tus avisos actuales.",
    cta: "Activar %feature% →",
    footer: "Recibes esto porque %store% está en el plan %plan%. Responde si quieres ayuda para configurarlo.",
  },
  fr: {
    subject: "%store% : augmentez le chiffre d’affaires de votre boutique avec %feature%",
    header_kicker: "Notify Me · Retour en Stock",
    header_title: "Débloquez plus de revenus pour %store%",
    greeting: "Bonjour l’équipe %store%,",
    intro: "Vous êtes sur le plan %plan% et utilisez %used%. L’app a déjà généré %rev% sur %orders% commandes, avec %signups% inscriptions de clients.",
    win_label: "Un gain rapide que vous n’avez pas encore activé :",
    requested_heading: "Vos produits les plus demandés en ce moment :",
    takes_minutes: "L’activation prend deux minutes et fonctionne automatiquement avec vos alertes actuelles.",
    cta: "Activer %feature% →",
    footer: "Vous recevez ceci car %store% est sur le plan %plan%. Répondez si vous souhaitez de l’aide pour la configuration.",
  },
  de: {
    subject: "%store%: steigere den Umsatz deines Shops mit %feature%",
    header_kicker: "Notify Me · Wieder verfügbar",
    header_title: "Mehr Umsatz für %store% freischalten",
    greeting: "Hallo %store%-Team,",
    intro: "Du nutzt den %plan%-Plan und %used%. Bisher hat die App %rev% aus %orders% Bestellungen erzielt, mit %signups% Anmeldungen.",
    win_label: "Ein schneller Gewinn, den du noch nicht aktiviert hast:",
    requested_heading: "Deine derzeit meistgewünschten Produkte:",
    takes_minutes: "Die Aktivierung dauert nur ein paar Minuten und läuft automatisch neben deinen bestehenden Benachrichtigungen.",
    cta: "%feature% aktivieren →",
    footer: "Du erhältst dies, weil %store% den %plan%-Plan nutzt. Antworte, wenn du Hilfe bei der Einrichtung möchtest.",
  },
  it: {
    subject: "%store%: aumenta i ricavi del tuo negozio con %feature%",
    header_kicker: "Notify Me · Disponibilità",
    header_title: "Sblocca più ricavi per %store%",
    greeting: "Ciao team di %store%,",
    intro: "Sei sul piano %plan% e usi %used%. Finora l’app ha generato %rev% da %orders% ordini, con %signups% iscrizioni dei clienti.",
    win_label: "Una vittoria rapida che non hai ancora attivato:",
    requested_heading: "I tuoi prodotti più richiesti in questo momento:",
    takes_minutes: "Si attiva in un paio di minuti e funziona automaticamente insieme ai tuoi avvisi attuali.",
    cta: "Attiva %feature% →",
    footer: "Ricevi questa email perché %store% è sul piano %plan%. Rispondi se vuoi una mano a configurarlo.",
  },
  pt: {
    subject: "%store%: aumente a receita da sua loja com %feature%",
    header_kicker: "Notify Me · Reposição",
    header_title: "Desbloqueie mais receita para %store%",
    greeting: "Olá equipe da %store%,",
    intro: "Você está no plano %plan% e usa %used%. Até agora o app gerou %rev% em %orders% pedidos, com %signups% inscrições de clientes.",
    win_label: "Uma vitória rápida que você ainda não ativou:",
    requested_heading: "Seus produtos mais pedidos agora:",
    takes_minutes: "Leva alguns minutos para ativar e funciona automaticamente junto com seus alertas atuais.",
    cta: "Ativar %feature% →",
    footer: "Você recebe isto porque %store% está no plano %plan%. Responda se quiser ajuda para configurar.",
  },
};

export const LANG_NAMES: Record<string, string> = {
  en: "English", es: "Español", fr: "Français", de: "Deutsch", it: "Italiano", pt: "Português",
};
export const SUPPORTED_LANGS = Object.keys(I18N);

export function normalizeLang(code?: string): string {
  const c = String(code || "").trim().toLowerCase().slice(0, 2);
  return I18N[c] ? c : "en";
}

export const RECOMMEND_PRIORITY = ["preorder", "price_drop", "sales_alert", "notify_me"];

export interface EmailShop {
  name: string; plan: string; appRevenue: number; appOrders: number;
  signups: number; alertsSent: number; usedKeys: string[]; missingKeys: string[];
  language?: string;
}
export interface ProductReq { title: string; count: number; url?: string | null; }

const money = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Number(n) || 0);
const num = (n: number) => new Intl.NumberFormat("en-US").format(Math.round(Number(n) || 0));
const esc = (s: any) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const fill = (tpl: string, vars: Record<string, string>) => tpl.replace(/%(\w+)%/g, (m, k) => (k in vars ? vars[k] : m));

export function recommendedFor(missingKeys: string[]): string {
  for (const k of RECOMMEND_PRIORITY) if (missingKeys.includes(k)) return k;
  return missingKeys[0];
}
export function storeName(domain: string): string { return (domain || "").replace(/\.myshopify\.com$/i, ""); }
function featureInfo(lang: string, key: string): FeatureInfo {
  return (FEATURE_I18N[lang] && FEATURE_I18N[lang][key]) || FEATURE_INFO[key];
}

export function buildContext(shop: EmailShop, mostRequested: ProductReq[] = [], langRaw?: string): Record<string, string> {
  const lang = normalizeLang(langRaw || shop.language);
  const t = I18N[lang] || I18N.en;
  const store = storeName(shop.name);
  const recKey = recommendedFor(shop.missingKeys);
  const rec = featureInfo(lang, recKey) || { label: "", how: "", benefit: "" };
  const used = shop.usedKeys.map((k) => featureInfo(lang, k)?.label || k);
  const missing = shop.missingKeys.map((k) => featureInfo(lang, k)?.label || k);

  const vars = {
    store: esc(store), plan: esc(shop.plan), used: esc(used.join(", ") || "—"),
    rev: money(shop.appRevenue), orders: num(shop.appOrders), signups: num(shop.signups),
    feature: esc(rec.label),
  };

  const reqRows = mostRequested
    .map((p) => `<li style="margin:4px 0;">${p.url ? `<a href="${esc(p.url)}" style="color:#4f46e5;text-decoration:none;">${esc(p.title)}</a>` : esc(p.title)} <span style="color:#6b7488;">— ${num(p.count)}</span></li>`)
    .join("");
  const mostRequestedList = reqRows ? `<ul style="margin:8px 0;padding-left:18px;">${reqRows}</ul>` : "";
  const mostRequestedBlock = reqRows ? `<p style="margin:16px 0 4px;font-weight:600;">${esc(t.requested_heading)}</p>${mostRequestedList}` : "";

  return {
    language: lang,
    language_name: LANG_NAMES[lang] || lang,
    store_name: esc(store),
    shop_domain: esc(shop.name),
    store_url: `https://${esc(shop.name)}`,
    email: "",
    plan: esc(shop.plan),
    app_revenue: money(shop.appRevenue),
    app_orders: num(shop.appOrders),
    signups: num(shop.signups),
    alerts_sent: num(shop.alertsSent),
    used_features: esc(used.join(", ") || "none yet"),
    missing_features: esc(missing.join(", ") || "none"),
    recommended_feature: esc(rec.label),
    recommended_how: esc(rec.how),
    recommended_benefit: esc(rec.benefit),
    most_requested_products: mostRequestedList,
    most_requested_block: mostRequestedBlock,
    most_requested_products_text: mostRequested.map((p) => `• ${p.title} (${num(p.count)})`).join("\n"),
    app_url: "https://apps.shopify.com/notifyme",
    review_url: "https://apps.shopify.com/notifyme#modal-show=WriteReviewModal",
    date: new Date().toISOString().slice(0, 10),
    // translated phrase tags used by the default template
    subject_line: fill(t.subject, vars),
    t_header_kicker: esc(t.header_kicker),
    t_header_title: fill(esc(t.header_title), vars),
    t_greeting: fill(esc(t.greeting), vars),
    t_intro: fill(esc(t.intro), vars),
    t_win_label: esc(t.win_label),
    t_takes_minutes: esc(t.takes_minutes),
    t_cta: fill(esc(t.cta), vars),
    t_footer: fill(esc(t.footer), vars),
  };
}

export const MERGE_KEYS: { key: string; desc: string }[] = [
  { key: "store_name", desc: "Store name (no .myshopify.com)" },
  { key: "shop_domain", desc: "Full myshopify domain" },
  { key: "store_url", desc: "Storefront link" },
  { key: "email", desc: "Shop contact email" },
  { key: "plan", desc: "Current plan name" },
  { key: "language_name", desc: "Store language name" },
  { key: "app_revenue", desc: "Revenue the app drove ($)" },
  { key: "app_orders", desc: "Orders the app drove" },
  { key: "signups", desc: "Total signups collected" },
  { key: "alerts_sent", desc: "Total alerts sent" },
  { key: "used_features", desc: "Features already used" },
  { key: "missing_features", desc: "Features NOT used" },
  { key: "recommended_feature", desc: "Top recommended feature (translated)" },
  { key: "recommended_how", desc: "What it does (translated)" },
  { key: "recommended_benefit", desc: "Why it helps (translated)" },
  { key: "most_requested_products", desc: "HTML list of most-requested products" },
  { key: "most_requested_block", desc: "Heading + list (empty if none)" },
  { key: "most_requested_products_text", desc: "Plain-text list" },
  { key: "app_url", desc: "Shopify app URL" },
  { key: "review_url", desc: "Deep link that opens the App Store review modal" },
  { key: "date", desc: "Today (YYYY-MM-DD)" },
];

export function renderTemplate(tpl: string, ctx: Record<string, string>): string {
  return String(tpl || "").replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (m, k) =>
    Object.prototype.hasOwnProperty.call(ctx, k) ? ctx[k] : m
  );
}

export const DEFAULT_SUBJECT = "{{subject_line}}";

export const DEFAULT_TEMPLATE_HTML = `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#f4f6fb;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1b2130;">
  <div style="max-width:560px;margin:0 auto;padding:24px;">
    <div style="background:#fff;border-radius:14px;overflow:hidden;border:1px solid #e6e9f2;">
      <div style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:22px 26px;color:#fff;">
        <div style="font-size:13px;opacity:.9;">{{t_header_kicker}}</div>
        <div style="font-size:20px;font-weight:700;margin-top:4px;">{{t_header_title}}</div>
      </div>
      <div style="padding:24px 26px;font-size:15px;line-height:1.55;">
        <p style="margin:0 0 14px;">{{t_greeting}}</p>
        <p style="margin:0 0 14px;">{{t_intro}}</p>
        <p style="margin:0 0 6px;">{{t_win_label}}</p>
        <div style="background:#eef0fe;border:1px solid #c7cbf5;border-radius:10px;padding:16px 18px;margin:10px 0 16px;">
          <div style="font-weight:700;font-size:16px;color:#4f46e5;">{{recommended_feature}}</div>
          <div style="margin-top:6px;color:#39406a;">{{recommended_how}} — {{recommended_benefit}}.</div>
        </div>
        {{most_requested_block}}
        <p style="margin:16px 0 20px;">{{t_takes_minutes}}</p>
        <a href="{{app_url}}" style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;font-weight:600;padding:11px 22px;border-radius:9px;">{{t_cta}}</a>
        <p style="margin:22px 0 0;color:#6b7488;font-size:13px;">{{t_footer}}</p>
      </div>
    </div>
    <div style="text-align:center;color:#9aa2b5;font-size:11px;margin-top:14px;">Notify Me — Back in Stock · Shopify</div>
  </div>
</body></html>`;

export function emailSubject(shop: EmailShop, lang?: string): string {
  return renderTemplate(DEFAULT_SUBJECT, buildContext(shop, [], lang));
}

export function buildEmail(shop: EmailShop, mostRequested: ProductReq[] = [], lang?: string): { subject: string; html: string; text: string } {
  const ctx = buildContext(shop, mostRequested, lang);
  const subject = renderTemplate(DEFAULT_SUBJECT, ctx);
  const html = renderTemplate(DEFAULT_TEMPLATE_HTML, ctx);
  const text =
    `${ctx.t_greeting}\n\n${ctx.t_intro}\n\n${ctx.t_win_label} ${ctx.recommended_feature}. ${ctx.recommended_how} — ${ctx.recommended_benefit}.\n` +
    (ctx.most_requested_products_text ? `\n${ctx.most_requested_products_text}\n` : "") +
    `\n${ctx.app_url}`;
  return { subject, html, text };
}


// ==========================================================================
// CAMPAIGN TEMPLATES — upgrade (free -> paid) and review request.
// All wording is Shopify-policy compliant: neutral, non-incentivized, opt-out.
// ==========================================================================
export type Campaign = "feature" | "upgrade" | "review";

export const UPGRADE_SUBJECT = "{{store_name}}, you've collected {{signups}} signups with Notify Me";

export const UPGRADE_TEMPLATE_HTML = `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#f4f6fb;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1b2130;">
  <div style="max-width:560px;margin:0 auto;padding:24px;">
    <div style="background:#fff;border-radius:14px;overflow:hidden;border:1px solid #e6e9f2;">
      <div style="background:linear-gradient(135deg,#4f46e5,#7c3aed);padding:22px 26px;color:#fff;">
        <div style="font-size:13px;opacity:.9;">Notify Me — Back in Stock</div>
        <div style="font-size:20px;font-weight:700;margin-top:4px;">Turn your demand into recovered sales</div>
      </div>
      <div style="padding:24px 26px;font-size:15px;line-height:1.55;">
        <p style="margin:0 0 14px;">Hi {{store_name}},</p>
        <p style="margin:0 0 14px;">Your shoppers are already raising their hands — Notify Me has collected <strong>{{signups}} back-in-stock signups</strong> and sent <strong>{{alerts_sent}} alerts</strong> for your store so far.</p>
        <div style="background:#eef0fe;border:1px solid #c7cbf5;border-radius:10px;padding:16px 18px;margin:10px 0 16px;">
          <div style="font-weight:700;font-size:16px;color:#4f46e5;">Upgrade to send unlimited alerts</div>
          <div style="margin-top:6px;color:#39406a;">Paid plans remove the monthly send limit and unlock {{missing_features}} — so every waiting shopper gets notified the moment stock returns.</div>
        </div>
        {{most_requested_block}}
        <p style="margin:16px 0 20px;">It takes about a minute to upgrade right from your Shopify admin.</p>
        <a href="{{store_url}}/admin/apps" style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;font-weight:600;padding:11px 22px;border-radius:9px;">Upgrade my plan</a>
        <p style="margin:22px 0 0;color:#6b7488;font-size:13px;">Questions about which plan fits? Just reply — we're happy to help. If you'd rather not get these emails, reply "unsubscribe".</p>
      </div>
    </div>
    <div style="text-align:center;color:#9aa2b5;font-size:11px;margin-top:14px;">Notify Me — Back in Stock · Shopify</div>
  </div>
</body></html>`;

export const REVIEW_SUBJECT = "How's Notify Me working for {{store_name}}?";

export const REVIEW_TEMPLATE_HTML = `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#f4f6fb;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1b2130;">
  <div style="max-width:560px;margin:0 auto;padding:24px;">
    <div style="background:#fff;border-radius:14px;overflow:hidden;border:1px solid #e6e9f2;">
      <div style="background:linear-gradient(135deg,#0ea5e9,#6366f1);padding:22px 26px;color:#fff;">
        <div style="font-size:13px;opacity:.9;">Notify Me — Back in Stock</div>
        <div style="font-size:20px;font-weight:700;margin-top:4px;">We'd love your feedback</div>
      </div>
      <div style="padding:24px 26px;font-size:15px;line-height:1.55;">
        <p style="margin:0 0 14px;">Hi {{store_name}},</p>
        <p style="margin:0 0 14px;">Thanks for using Notify Me — it has sent <strong>{{alerts_sent}} back-in-stock alerts</strong> for your store.</p>
        <p style="margin:0 0 18px;">We value feedback! It helps us make our product better and keeps us energized. If you have a minute, let other merchants know how the app is working for you by leaving a review on the Shopify App Store.</p>
        <a href="{{review_url}}" style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;font-weight:600;padding:11px 22px;border-radius:9px;">Leave a review</a>
        <p style="margin:22px 0 0;color:#6b7488;font-size:13px;">Either way, thank you for being a customer. If you'd prefer not to receive these, reply "unsubscribe" and we won't ask again.</p>
      </div>
    </div>
    <div style="text-align:center;color:#9aa2b5;font-size:11px;margin-top:14px;">Notify Me — Back in Stock · Shopify</div>
  </div>
</body></html>`;

export function templatesFor(campaign: Campaign): { subject: string; html: string } {
  if (campaign === "upgrade") return { subject: UPGRADE_SUBJECT, html: UPGRADE_TEMPLATE_HTML };
  if (campaign === "review") return { subject: REVIEW_SUBJECT, html: REVIEW_TEMPLATE_HTML };
  return { subject: DEFAULT_SUBJECT, html: DEFAULT_TEMPLATE_HTML };
}

export function subjectFor(campaign: Campaign, shop: EmailShop, lang?: string): string {
  const { subject } = templatesFor(campaign);
  return renderTemplate(subject, buildContext(shop, [], lang));
}
