"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { fmtNum, fmtMoney, StatCard, Loading, ErrorBox, Empty } from "../components/ui";

const PAGE_SIZE = 20;

const CAMPAIGNS = [
  { key: "feature", label: "Feature adoption", desc: "Paid merchants missing one or more features." },
  { key: "upgrade", label: "Upgrade to paid", desc: "Free, active merchants — nudge them to a paid plan." },
  { key: "review", label: "Review request", desc: "Active, non-blocked merchants — ask for an App Store review (neutral, opt-in)." },
];

function render(tpl: string, ctx: Record<string, string> | null): string {
  if (!ctx) return tpl || "";
  return String(tpl || "").replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (m, k) =>
    Object.prototype.hasOwnProperty.call(ctx, k) ? ctx[k] : m
  );
}

export default function EmailPage() {
  const [campaign, setCampaign] = useState("feature");
  const [missing, setMissing] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // composer
  const [selId, setSelId] = useState<number | null>(null);
  const [ctxData, setCtxData] = useState<any>(null);
  const [ctxLoading, setCtxLoading] = useState(false);
  const [lang, setLang] = useState("");
  const [subject, setSubject] = useState("");
  const [html, setHtml] = useState("");
  const [keys, setKeys] = useState<any[]>([]);
  const [defaults, setDefaults] = useState<{ subject: string; html: string } | null>(null);
  const htmlRef = useRef<HTMLTextAreaElement>(null);

  const [testTo, setTestTo] = useState("");
  const [sendMsg, setSendMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const p = new URLSearchParams({ campaign, missing, page: String(page), pageSize: String(PAGE_SIZE) });
      const res = await fetch(`/api/email-recommendations?${p.toString()}`, { cache: "no-store" });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "Request failed");
      setData(json.data);
    } catch (e: any) {
      setError(e?.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [campaign, missing, page]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [missing, campaign]);
  useEffect(() => { if (campaign !== "feature") setMissing(""); }, [campaign]);

  // template is saved per-campaign; switching campaigns loads that campaign's
  // saved template, or clears so the composer fills in the campaign default.
  useEffect(() => {
    try {
      const s = localStorage.getItem(`emailTpl.${campaign}.subject`);
      const h = localStorage.getItem(`emailTpl.${campaign}.html`);
      setSubject(s || "");
      setHtml(h || "");
    } catch { setSubject(""); setHtml(""); }
  }, [campaign]);
  useEffect(() => { try { if (subject) localStorage.setItem(`emailTpl.${campaign}.subject`, subject); } catch {} }, [subject, campaign]);
  useEffect(() => { try { if (html) localStorage.setItem(`emailTpl.${campaign}.html`, html); } catch {} }, [html, campaign]);

  const loadContext = useCallback(async (id: number, l: string, c: string) => {
    setCtxLoading(true);
    try {
      const res = await fetch(`/api/email-context?id=${id}&lang=${encodeURIComponent(l)}&campaign=${c}`, { cache: "no-store" });
      const json = await res.json();
      if (json.ok && json.data?.found) {
        setCtxData(json.data);
        setKeys(json.data.keys || []);
        setDefaults({ subject: json.data.defaultSubject, html: json.data.defaultHtml });
        setLang(json.data.language || "en");
        setTestTo(json.data.to || "");
        setSubject((cur) => cur || json.data.defaultSubject || "");
        setHtml((cur) => cur || json.data.defaultHtml || "");
      }
    } catch {
      /* ignore */
    } finally {
      setCtxLoading(false);
    }
  }, []);

  function openComposer(id: number) {
    setSelId(id);
    setCtxData(null);
    setSendMsg(null);
    loadContext(id, "", campaign); // auto-detect store language
  }
  function changeLang(l: string) {
    setLang(l);
    if (selId) loadContext(selId, l, campaign);
  }
  // when switching campaign with a composer open, reload its default template
  useEffect(() => {
    if (selId) loadContext(selId, lang || "", campaign);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaign]);

  function resetTemplate() {
    if (defaults) { setSubject(defaults.subject); setHtml(defaults.html); }
  }
  function insertKey(k: string) {
    const token = `{{${k}}}`;
    const ta = htmlRef.current;
    if (!ta) { setHtml((h) => h + token); return; }
    const start = ta.selectionStart ?? html.length;
    const end = ta.selectionEnd ?? html.length;
    const next = html.slice(0, start) + token + html.slice(end);
    setHtml(next);
    requestAnimationFrame(() => { ta.focus(); ta.selectionStart = ta.selectionEnd = start + token.length; });
  }
  async function send(to: string) {
    if (!to) { setSendMsg("Enter a recipient address."); return; }
    setSendMsg("Sending…");
    try {
      const res = await fetch("/api/email-send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to, subject: renderedSubject, html: renderedHtml }),
      });
      const json = await res.json();
      setSendMsg(json.ok ? `✓ Sent to ${to}` : `✕ ${json.error}`);
    } catch (e: any) {
      setSendMsg(`✕ ${e?.message || "send failed"}`);
    }
  }

  const ctx = ctxData?.context || null;
  const renderedSubject = render(subject, ctx);
  const renderedHtml = render(html, ctx);
  const summary = data?.summary;
  const opts = data?.featureOptions || [];
  const langs = ctxData?.availableLanguages || [];
  const camp = CAMPAIGNS.find((c) => c.key === campaign) || CAMPAIGNS[0];
  const targetsLabel = campaign === "feature" ? "Paid targets" : campaign === "upgrade" ? "Free active targets" : "Review targets";

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Email Outreach</h1>
          <p>Pick a campaign, edit the design, auto-translate to the store's language, preview &amp; send.</p>
        </div>
        <button className="btn" onClick={load} disabled={loading}>↻ Refresh</button>
      </div>

      <div className="controls" style={{ marginBottom: 12 }}>
        <span className="muted" style={{ fontSize: 12 }}>Campaign:</span>
        {CAMPAIGNS.map((c) => (
          <button key={c.key} className={`btn ${campaign === c.key ? "primary" : ""}`} onClick={() => setCampaign(c.key)}>{c.label}</button>
        ))}
      </div>

      <div className="notice">
        {campaign === "review" ? (
          <>
            Targets are <strong>active, non-blocked merchants</strong> who have used the app. Keep the ask
            <strong> neutral and opt-in</strong> — Shopify prohibits incentives and asking only for positive reviews. The CTA
            uses the official review deep link. <strong>Nothing sends until you click Send.</strong>
          </>
        ) : campaign === "upgrade" ? (
          <>
            Targets are <strong>free, active merchants</strong> (no active paid charge) past their first onboarding days, blocked shops excluded.
            <strong> Nothing sends until you click Send</strong>, and sending requires SMTP.
          </>
        ) : (
          <>
            Targets are <strong>paying merchants</strong> missing one or more features (free users excluded).
            <strong> Nothing sends until you click Send</strong>, and sending requires SMTP.
          </>
        )}
      </div>

      {error ? <ErrorBox message={error} /> : null}

      {summary ? (
        <div className="grid stats">
          <StatCard label={targetsLabel} value={fmtNum(summary.totalTargets)} icon="🎯" tone="indigo" />
          {campaign === "feature" ? summary.byMissing.map((m: any) => (
            <StatCard key={m.key} label={`Missing: ${m.label}`} value={fmtNum(m.count)} icon="✦" tone="amber" />
          )) : null}
        </div>
      ) : loading ? <Loading /> : null}

      {campaign === "feature" ? (
        <div className="controls" style={{ marginTop: 16 }}>
          <span className="muted" style={{ fontSize: 12 }}>Missing feature:</span>
          <button className={`btn ${missing === "" ? "primary" : ""}`} onClick={() => setMissing("")}>All</button>
          {opts.map((o: any) => (
            <button key={o.key} className={`btn ${missing === o.key ? "primary" : ""}`} onClick={() => setMissing(o.key)}>{o.label}</button>
          ))}
          <div className="spacer" />
          {data ? <span className="muted" style={{ fontSize: 12.5 }}>{fmtNum(data.totalRows)} targets · page {data.page} of {data.totalPages}</span> : null}
        </div>
      ) : (
        <div className="controls" style={{ marginTop: 16 }}>
          <span className="muted" style={{ fontSize: 12.5 }}>{camp.desc}</span>
          <div className="spacer" />
          {data ? <span className="muted" style={{ fontSize: 12.5 }}>{fmtNum(data.totalRows)} targets · page {data.page} of {data.totalPages}</span> : null}
        </div>
      )}

      {data && !loading ? (
        data.recommendations.length ? (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr><th>Shop</th><th>Plan</th><th>Lang</th><th className="num">App rev</th><th className="num">Signups</th><th className="num">Alerts</th><th>Enabled</th><th></th></tr>
              </thead>
              <tbody>
                {data.recommendations.map((r: any) => (
                  <tr key={r.id} style={selId === r.id ? { background: "var(--primary-soft)" } : undefined}>
                    <td><div style={{ fontWeight: 600 }}><span className="muted" style={{ fontWeight: 500 }}>#{r.id}</span> {r.shop}</div><div className="muted" style={{ fontSize: 11 }}>{r.email}</div></td>
                    <td>{r.plan}</td>
                    <td><span className="badge gray">{(r.language || "en").toUpperCase()}</span></td>
                    <td className="num">{fmtMoney(r.appRevenue)}</td>
                    <td className="num">{fmtNum(r.signups)}</td>
                    <td className="num">{fmtNum(r.alertsSent)}</td>
                    <td>{(r.used || []).length ? r.used.map((m: string) => <span key={m} className="badge green" style={{ marginRight: 4, display: "inline-block" }}>{m}</span>) : <span className="muted">—</span>}</td>
                    <td className="right"><button className="btn primary" onClick={() => openComposer(r.id)}>Compose ✉</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <Empty>No merchants match this campaign right now. 🎉</Empty>
      ) : null}

      {data && data.totalPages > 1 ? (
        <div className="controls" style={{ marginTop: 14 }}>
          <button className="btn" disabled={data.page <= 1} onClick={() => setPage(1)}>« First</button>
          <button className="btn" disabled={data.page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>‹ Prev</button>
          <span className="muted">Page {data.page} / {data.totalPages}</span>
          <button className="btn" disabled={data.page >= data.totalPages} onClick={() => setPage((p) => p + 1)}>Next ›</button>
          <button className="btn" disabled={data.page >= data.totalPages} onClick={() => setPage(data.totalPages)}>Last »</button>
        </div>
      ) : null}

      <div className="section-title">Email composer <span className="card-sub">{camp.label}</span></div>
      {!selId ? (
        <Empty>Pick a shop above and click <strong>Compose ✉</strong> to edit &amp; preview its personalised email.</Empty>
      ) : (
        <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 16, alignItems: "start" }}>
          <div className="card">
            <h3>Design <span className="card-sub">{ctxData ? `#${ctxData.id ?? selId} ${ctxData.shop}` : ""}</span></h3>
            {ctxLoading ? <Loading label="Loading shop data…" /> : null}

            <div className="controls" style={{ marginBottom: 10 }}>
              <span className="muted" style={{ fontSize: 12 }}>Language:</span>
              <select className="inp" value={lang} onChange={(e) => changeLang(e.target.value)}>
                {langs.map((l: any) => <option key={l.code} value={l.code}>{l.name}</option>)}
              </select>
              {ctxData?.detectedLanguage ? (
                <span className="muted" style={{ fontSize: 12 }}>
                  store language: <strong>{(ctxData.detectedLanguage || "en").toUpperCase()}</strong>
                </span>
              ) : null}
            </div>

            <label className="muted" style={{ fontSize: 12 }}>Subject</label>
            <input className="inp" style={{ width: "100%", marginBottom: 10 }} value={subject} onChange={(e) => setSubject(e.target.value)} />

            <label className="muted" style={{ fontSize: 12 }}>HTML (paste your design, use merge tags below)</label>
            <textarea ref={htmlRef} className="inp mono" style={{ width: "100%", height: 260, fontSize: 12, lineHeight: 1.45, resize: "vertical" }}
              value={html} onChange={(e) => setHtml(e.target.value)} />

            <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
              <button className="btn" onClick={resetTemplate}>Reset to default</button>
              <button className="btn" onClick={() => navigator.clipboard?.writeText(renderedHtml)}>Copy rendered HTML</button>
            </div>

            <div className="section-title" style={{ fontSize: 13, margin: "16px 0 8px" }}>Merge tags <span className="card-sub">click to insert</span></div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {keys.map((k: any) => (
                <button key={k.key} className="badge gray" title={k.desc} onClick={() => insertKey(k.key)} style={{ cursor: "pointer", border: "none" }}>
                  {`{{${k.key}}}`}
                </button>
              ))}
            </div>

            <div className="section-title" style={{ fontSize: 13, margin: "16px 0 8px" }}>Send <span className="card-sub">opt-in · SMTP required</span></div>
            <div className="controls" style={{ marginBottom: 6 }}>
              <input className="inp" placeholder="test@example.com" value={testTo} onChange={(e) => setTestTo(e.target.value)} style={{ minWidth: 200 }} />
              <button className="btn" onClick={() => send(testTo)}>Send test</button>
              <button className="btn primary" disabled={!ctxData?.to} onClick={() => send(ctxData.to)} title={ctxData?.to || "no email on file"}>
                Send to shop {ctxData?.to ? `(${ctxData.to})` : ""}
              </button>
            </div>
            {sendMsg ? <div className="muted" style={{ fontSize: 12.5 }}>{sendMsg}</div> : null}
          </div>

          <div className="card" style={{ position: "sticky", top: 16 }}>
            <h3>Preview <span className="card-sub">{(lang || "en").toUpperCase()}</span></h3>
            <div style={{ fontSize: 12.5, marginBottom: 8 }}><span className="muted">Subject:</span> <strong>{renderedSubject}</strong></div>
            <div style={{ height: 720, overflow: "auto", border: "1px solid var(--border)", borderRadius: 10, background: "#fff" }}>
              <iframe title="email" style={{ width: "100%", height: 1400, border: "none" }} srcDoc={renderedHtml} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
