"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  fmtNum,
  fmtMoney,
  StatCard,
  Card,
  BarList,
  ColumnChart,
  Funnel,
  DataTable,
  Loading,
  ErrorBox,
  Empty,
  Cell,
  monthLabel,
} from "../../components/ui";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "var(--panel-2)", border: "1px solid var(--border)", borderRadius: 9, padding: "10px 12px" }}>
      <div className="muted" style={{ fontSize: 11.5, textTransform: "uppercase", letterSpacing: ".04em" }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 600, marginTop: 3, wordBreak: "break-word" }}>{children}</div>
    </div>
  );
}

export default function ShopDetailPage({ params }: { params: { id: string } }) {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // signup-content modal
  const [openId, setOpenId] = useState<number | null>(null);
  const [content, setContent] = useState<any>(null);
  const [contentLoading, setContentLoading] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/shop?id=${encodeURIComponent(params.id)}`, { cache: "no-store" });
        const json = await res.json();
        if (!json.ok) throw new Error(json.error || "Request failed");
        setData(json.data);
      } catch (e: any) {
        setError(e?.message || "Failed to load");
      } finally {
        setLoading(false);
      }
    })();
  }, [params.id]);

  async function openContent(id: number) {
    setOpenId(id);
    setContent(null);
    setContentLoading(true);
    try {
      const res = await fetch(`/api/signup-content?id=${id}`, { cache: "no-store" });
      const json = await res.json();
      if (json.ok) setContent(json.data);
    } catch {
      /* ignore */
    } finally {
      setContentLoading(false);
    }
  }
  function closeContent() { setOpenId(null); setContent(null); }

  const domain: string = data?.profile?.name || "";
  const productUrl = (p: any) =>
    p.handle ? `https://${domain}/products/${p.handle}` : `https://${domain}/search?q=${encodeURIComponent(p.label || "")}`;

  return (
    <>
      <div className="page-head">
        <div>
          <Link href="/shops" className="muted" style={{ fontSize: 13 }}>← Back to Shops</Link>
          <h1 style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 8 }}>
            <span className="muted" style={{ fontWeight: 500 }}>#{data?.profile?.id ?? params.id}</span> {data?.profile?.name || `Shop #${params.id}`}
            {domain ? (
              <a href={`https://${domain}`} target="_blank" rel="noopener noreferrer" title="Open store in new tab" style={{ fontSize: 16, textDecoration: "none" }}>👁</a>
            ) : null}
            {data?.profile?.blocked ? (
              <span className="badge red" title={`meta_data.${data.profile.blockedKey} = ${String(data.profile.blockedValue)}`} style={{ fontSize: 12 }}>⛔ Blocked</span>
            ) : null}
          </h1>
          <p>{data?.profile?.email}</p>
        </div>
      </div>

      {loading ? <Loading /> : null}
      {error ? <ErrorBox message={error} /> : null}
      {data && !data.found ? <Empty>No shop found with id {params.id}.</Empty> : null}

      {data && data.found ? (
        <>
          <div className="card">
            <h3>Profile</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12 }}>
              <Field label="Status">{data.profile.status === "active" ? <span className="badge green">active</span> : <span className="badge red">churned</span>}</Field>
              <Field label="Plan">{data.profile.plan}{data.profile.freemium ? <span className="badge gray" style={{ marginLeft: 6 }}>free</span> : null}</Field>
              <Field label="Plan price">{fmtMoney(data.profile.planPrice)} {data.profile.planInterval || ""}</Field>
              <Field label="Language">{data.profile.language || "—"}</Field>
              <Field label="Installed">{data.profile.installedAt ? String(data.profile.installedAt).slice(0, 10) : "—"}</Field>
              <Field label="Uninstalled">{data.profile.uninstalledAt ? String(data.profile.uninstalledAt).slice(0, 10) : "—"}</Field>
              <Field label="Grandfathered">{data.profile.grandfathered ? "yes" : "no"}</Field>
              <Field label="Shop ID">{data.profile.id}</Field>
              <Field label="Blocked by us">{data.profile.blocked ? <span className="badge red">⛔ blocked</span> : <span className="badge green">no</span>}{data.profile.blockedKey ? <span className="muted" style={{ marginLeft: 6, fontSize: 11 }}>({data.profile.blockedKey}: {String(data.profile.blockedValue)})</span> : null}</Field>
            </div>
          </div>

          <div className="card" style={{ marginTop: 16 }}>
            <h3>Feature adoption <span className="card-sub">what this shop is using</span></h3>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {(data.features || []).map((f: any) => (
                <div key={f.key} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", border: `1px solid ${f.enabled ? "#bfe6cd" : "#f3c0c3"}`, background: f.enabled ? "var(--green-soft)" : "var(--red-soft)", borderRadius: 10, minWidth: 150 }}>
                  <span style={{ fontSize: 16 }}>{f.enabled ? "✅" : "⛔"}</span>
                  <div><div style={{ fontWeight: 600, fontSize: 13.5 }}>{f.label}</div><div className="muted" style={{ fontSize: 11.5 }}>{f.enabled ? "Enabled" : "Not used"}</div></div>
                </div>
              ))}
            </div>
          </div>

          <div className="section-title">Billing — what we charged this shop</div>
          <div className="grid stats">
            <StatCard label="Active recurring /mo" value={fmtMoney(data.billing.activeRecurring)} icon="$" tone="green" />
            <StatCard label="Lifetime charged" value={fmtMoney(data.billing.lifetimeCharged)} icon="∑" tone="indigo" hint="all recurring charges" />
            <StatCard label="Usage billed" value={fmtMoney(data.billing.usageTotal)} icon="⚡" tone="amber" hint="SMS/WhatsApp pay-as-you-go" />
            <StatCard label="Subscriptions" value={`${fmtNum(data.billing.activeCount)} / ${fmtNum(data.billing.cancelledCount)}`} icon="◆" tone="indigo" hint="active / cancelled" />
          </div>

          <div className="card" style={{ marginTop: 16 }}>
            <h3>Charge history</h3>
            <DataTable rows={data.billing.charges} empty="No charges recorded." />
          </div>

          <div className="section-title">Earnings — what this shop made from the app</div>
          <div className="grid stats">
            <StatCard label="Revenue generated" value={fmtMoney(data.earnings.revenue)} icon="↗" tone="green" />
            <StatCard label="Orders generated" value={fmtNum(data.earnings.orders)} icon="🛒" tone="indigo" />
            <StatCard label="Pre-order revenue" value={fmtMoney(data.preorder.revenue)} icon="🏷" tone="amber" hint={`${fmtNum(data.preorder.orders)} pre-orders`} />
          </div>

          <div className="grid cols-2" style={{ marginTop: 16 }}>
            <Card title="Conversion funnel" sub="this shop">
              <Funnel steps={[
                { label: "Alerts sent", value: data.earnings.sent },
                { label: "Delivered", value: data.earnings.delivered },
                { label: "Opened", value: data.earnings.opened },
                { label: "Clicked", value: data.earnings.clicked },
                { label: "Orders", value: data.earnings.orders },
              ]} />
            </Card>
            <Card title="Usage billing by month">
              <ColumnChart data={data.billing.usageByMonth} labelFmt={monthLabel} color="#6366f1" />
            </Card>
          </div>

          <div className="card" style={{ marginTop: 16 }}>
            <h3>Top products by revenue</h3>
            <div className="table-wrap" style={{ border: "none" }}>
              <table className="data">
                <thead><tr><th>Product</th><th className="num">Alerts</th><th className="num">Orders</th><th className="num">Revenue</th></tr></thead>
                <tbody>
                  {(data.earnings.topProducts || []).map((p: any, i: number) => (
                    <tr key={i}>
                      <td style={{ whiteSpace: "normal", maxWidth: 360 }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                          {domain ? (
                            <a href={productUrl(p)} target="_blank" rel="noopener noreferrer" style={{ color: "var(--primary)", fontWeight: 600, textDecoration: "none" }}>{p.label}</a>
                          ) : p.label}
                          {domain ? <a href={productUrl(p)} target="_blank" rel="noopener noreferrer" title="Open product in new tab" style={{ textDecoration: "none", fontSize: 13 }}>👁</a> : null}
                        </span>
                      </td>
                      <td className="num">{fmtNum(p.alerts)}</td>
                      <td className="num">{fmtNum(p.orders)}</td>
                      <td className="num">{fmtMoney(p.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {(!data.earnings.topProducts || !data.earnings.topProducts.length) ? <div className="muted">No product data.</div> : null}
            </div>
          </div>

          <div className="section-title">Notifications</div>
          <div className="grid stats">
            <StatCard label="Total signups" value={fmtNum(data.notifications.total)} icon="🔔" tone="indigo" />
            <StatCard label="Alerts sent" value={fmtNum(data.notifications.sent)} icon="✓" tone="green" />
          </div>
          <div className="grid cols-2" style={{ marginTop: 16 }}>
            <Card title="Signups by feature" sub="fun_type"><BarList items={data.notifications.byFeature} /></Card>
            <Card title="Signups by channel" sub="type"><BarList items={data.notifications.byChannel} /></Card>
          </div>
          <div className="card" style={{ marginTop: 16 }}>
            <h3>Signups by month</h3>
            <ColumnChart data={data.notifications.byMonth} labelFmt={monthLabel} color="#d98a00" />
          </div>

          {data.settings ? (
            <>
              <div className="section-title">BIS configuration</div>
              <div className="card">
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12 }}>
                  <Field label="Send mode">{data.settings.send_notification_type || "—"}</Field>
                  <Field label="Sequencing">{data.settings.configuration_type || "—"}</Field>
                  <Field label="Trigger">{data.settings.notify_me || "—"}</Field>
                  <Field label="Sender email">{data.settings.sender_email || "—"}</Field>
                  <Field label="Sending domain">{data.settings.bis_domain || "—"}</Field>
                  <Field label="Domain status">{data.settings.bis_domain_status || "—"}</Field>
                </div>
              </div>
            </>
          ) : null}

          {/* Recent signups with View content */}
          <div className="section-title">Recent signups <span className="card-sub">view the message that was sent</span></div>
          {data.notifications.recent && data.notifications.recent.length ? (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr><th>Requested</th><th>Shopper</th><th>Product</th><th>Feature</th><th>Channel</th><th>Status</th><th></th></tr>
                </thead>
                <tbody>
                  {data.notifications.recent.map((r: any, i: number) => (
                    <tr key={i}>
                      <td className="num">{r.created_at ? String(r.created_at).slice(0, 16) : "—"}</td>
                      <td>{r.name || <span className="null">—</span>}<div className="muted" style={{ fontSize: 11 }}>{r.email}</div></td>
                      <td style={{ whiteSpace: "normal", maxWidth: 280 }}>
                        {domain && r.product ? (
                          <a href={`https://${domain}/search?q=${encodeURIComponent(r.product)}`} target="_blank" rel="noopener noreferrer" style={{ color: "var(--primary)", textDecoration: "none" }}>{r.product}</a>
                        ) : (r.product || <span className="null">—</span>)}
                      </td>
                      <td>{r.fun_type}</td>
                      <td>{r.type}</td>
                      <td>{r.is_sent ? <span className="badge green">sent</span> : <span className="badge amber">pending</span>}</td>
                      <td className="right">
                        {r.id ? <button className="btn" onClick={() => openContent(r.id)}>View ✉</button> : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <Empty>No signups for this shop.</Empty>}
        </>
      ) : null}

      {/* content modal */}
      {openId !== null ? (
        <div
          onClick={closeContent}
          style={{ position: "fixed", inset: 0, background: "rgba(16,24,40,.45)", display: "grid", placeItems: "center", zIndex: 50, padding: 20 }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ width: "min(760px, 96vw)", maxHeight: "88vh", overflow: "auto", background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 12, padding: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h3 style={{ margin: 0 }}>Sent content</h3>
              <button className="btn" onClick={closeContent}>✕ Close</button>
            </div>
            {contentLoading ? <Loading label="Loading message…" /> : null}
            {content && content.found ? (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10, marginBottom: 14 }}>
                  <Field label="Shopper">{content.info.shopper || "—"}</Field>
                  <Field label="Email">{content.info.email || "—"}</Field>
                  <Field label="Product">{domain && content.info.product ? <a href={`https://${domain}/search?q=${encodeURIComponent(content.info.product)}`} target="_blank" rel="noopener noreferrer" style={{ color: "var(--primary)", textDecoration: "none" }}>{content.info.product}</a> : (content.info.product || "—")}{content.info.variant ? ` · ${content.info.variant}` : ""}</Field>
                  <Field label="Feature / Channel">{content.info.feature} · {content.info.channel}</Field>
                  <Field label="Status">{content.info.status === "sent" ? <span className="badge green">sent</span> : <span className="badge amber">pending</span>}{content.info.sent_count ? ` ×${content.info.sent_count}` : ""}</Field>
                  <Field label="Sent at">{content.info.sent_at ? String(content.info.sent_at).slice(0, 16) : "—"}</Field>
                  <Field label="Plan">{content.info.plan || "—"}</Field>
                </div>

                {content.info.custom_message ? (
                  <div className="notice" style={{ marginBottom: 12 }}>Custom message: {content.info.custom_message}</div>
                ) : null}

                {content.mailBody ? (
                  <>
                    <div className="muted" style={{ fontSize: 12.5, marginBottom: 6 }}>Email body{content.mailChannel ? ` · channel: ${content.mailChannel}` : ""}</div>
                    <div style={{ height: 460, overflow: "auto", border: "1px solid var(--border)", borderRadius: 10, background: "#fff" }}>
                      <iframe title="sent-email" style={{ width: "100%", height: 900, border: "none" }} srcDoc={content.mailBody} />
                    </div>
                  </>
                ) : (
                  <div className="notice" style={{ background: "var(--panel-2)", border: "1px solid var(--border)", borderRadius: 10, padding: "14px 16px", color: "var(--muted)", fontSize: 13.5 }}>
                    <strong style={{ color: "var(--text)" }}>No email body to show.</strong>
                    <div style={{ marginTop: 4 }}>{content.mailReason || "No email body was stored for this notification."}</div>
                  </div>
                )}

                {content.sms && content.sms.length ? (
                  <div style={{ marginTop: 14 }}>
                    <div className="muted" style={{ fontSize: 12.5, marginBottom: 6 }}>SMS / WhatsApp delivery</div>
                    <div className="table-wrap">
                      <table className="data">
                        <thead><tr><th>Provider</th><th>Status</th><th>At</th><th>Error</th></tr></thead>
                        <tbody>
                          {content.sms.map((m: any, i: number) => (
                            <tr key={i}>
                              <td>{m.provider || "—"}</td>
                              <td>{m.whatsapp_status || "—"}</td>
                              <td className="num">{m.whatsapp_status_at ? String(m.whatsapp_status_at).slice(0, 16) : "—"}</td>
                              <td><Cell value={m.whatsapp_error} /></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : null}
              </>
            ) : null}
            {content && !content.found ? <Empty>Content not found.</Empty> : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
