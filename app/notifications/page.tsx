"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  fmtNum,
  StatCard,
  Card,
  BarList,
  ColumnChart,
  Loading,
  ErrorBox,
  Empty,
  monthLabel,
} from "../components/ui";

const fmtDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const PAGE_SIZE = 20;

export default function NotificationsPage() {
  const [channel, setChannel] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [ready, setReady] = useState(false);

  // summary (cards + charts)
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // store-wise listing
  const [sort, setSort] = useState<"collected" | "sent">("collected");
  const [page, setPage] = useState(1);
  const [stores, setStores] = useState<any>(null);
  const [storesLoading, setStoresLoading] = useState(true);

  useEffect(() => {
    const today = new Date();
    const yest = new Date();
    yest.setDate(yest.getDate() - 1);
    setFrom(fmtDate(yest));
    setTo(fmtDate(today));
    setReady(true);
  }, []);

  const loadSummary = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const p = new URLSearchParams({ channel, from, to });
      const res = await fetch(`/api/notifications?${p.toString()}`, { cache: "no-store" });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "Request failed");
      setData(json.data);
    } catch (e: any) {
      setError(e?.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [channel, from, to]);

  const loadStores = useCallback(async () => {
    setStoresLoading(true);
    try {
      const p = new URLSearchParams({
        channel, from, to, sort, page: String(page), pageSize: String(PAGE_SIZE),
      });
      const res = await fetch(`/api/notification-stores?${p.toString()}`, { cache: "no-store" });
      const json = await res.json();
      if (json.ok) setStores(json.data);
    } catch {
      /* ignore */
    } finally {
      setStoresLoading(false);
    }
  }, [channel, from, to, sort, page]);

  useEffect(() => { if (ready) loadSummary(); }, [loadSummary, ready]);
  useEffect(() => { if (ready) loadStores(); }, [loadStores, ready]);
  useEffect(() => { setPage(1); }, [channel, from, to, sort]);

  function setPreset(days: number) {
    const today = new Date();
    const start = new Date();
    start.setDate(start.getDate() - days);
    setFrom(fmtDate(start));
    setTo(fmtDate(today));
  }

  const channels = data?.options?.channels || [];

  const FEATS = [
    { key: "bis", label: "Back in Stock" },
    { key: "pricedrop", label: "Price Drop" },
    { key: "salealert", label: "Sale Alerts" },
    { key: "preorder", label: "Pre-orders" },
  ];

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Notifications</h1>
          <p>Store-wise collected vs sent across all four features — defaults to the last 24 hours.</p>
        </div>
        <button className="btn" onClick={() => { loadSummary(); loadStores(); }} disabled={loading}>↻ Refresh</button>
      </div>

      <div className="controls">
        <select className="inp" value={channel} onChange={(e) => setChannel(e.target.value)}>
          <option value="">All channels</option>
          {channels.map((c: string) => <option key={c} value={c}>{c}</option>)}
        </select>
        <span className="muted" style={{ fontSize: 12 }}>Quick:</span>
        <button className="btn" onClick={() => setPreset(1)}>24h</button>
        <button className="btn" onClick={() => setPreset(7)}>7d</button>
        <button className="btn" onClick={() => setPreset(15)}>15d</button>
        <button className="btn" onClick={() => setPreset(30)}>30d</button>
        <label className="muted" style={{ fontSize: 12 }}>From
          <input type="date" className="inp" value={from} style={{ marginLeft: 6 }} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="muted" style={{ fontSize: 12 }}>To
          <input type="date" className="inp" value={to} style={{ marginLeft: 6 }} onChange={(e) => setTo(e.target.value)} />
        </label>
        <div className="spacer" />
        <button className="btn" onClick={() => { setChannel(""); setFrom(""); setTo(""); }}>All time</button>
      </div>

      {error ? <ErrorBox message={error} /> : null}

      {data ? (
        <div className="grid stats">
          <StatCard label="Total collected (signups)" value={fmtNum(data.total)} icon="🔔" tone="indigo" />
          <StatCard label="Total sent (alerts)" value={fmtNum(data.sent)} icon="✓" tone="green" />
          <StatCard label="In queue" value={fmtNum(data.inQueue)} icon="⏳" tone="amber" />
          <StatCard label="Pending" value={fmtNum(data.pending)} icon="•" tone="red" />
        </div>
      ) : loading ? <Loading /> : null}

      {/* Store-wise listing */}
      <div className="section-title" style={{ marginBottom: 8 }}>
        Store-wise notifications <span className="card-sub">collected / sent per feature</span>
      </div>
      <div className="controls" style={{ marginBottom: 10 }}>
        <span className="muted" style={{ fontSize: 12 }}>Sort by:</span>
        <button className={`btn ${sort === "collected" ? "primary" : ""}`} onClick={() => setSort("collected")}>Most collected</button>
        <button className={`btn ${sort === "sent" ? "primary" : ""}`} onClick={() => setSort("sent")}>Most sent</button>
        <div className="spacer" />
        {stores ? (
          <span className="muted" style={{ fontSize: 12.5 }}>
            {fmtNum(stores.totalRows)} stores · page {stores.page} of {stores.totalPages} · 20 / page
          </span>
        ) : null}
      </div>

      {storesLoading ? <Loading label="Loading stores…" /> : null}
      {stores && !storesLoading ? (
        stores.stores.length ? (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Shop</th>
                  <th>Plan</th>
                  {FEATS.map((f) => <th key={f.key} className="num">{f.label}<br /><span className="muted" style={{ fontWeight: 400 }}>collected / sent</span></th>)}
                  <th className="num">Total<br /><span className="muted" style={{ fontWeight: 400 }}>collected / sent</span></th>
                </tr>
              </thead>
              <tbody>
                {stores.stores.map((s: any) => (
                  <tr key={s.id}>
                    <td>
                      <Link href={`/shops/${s.id}`} style={{ color: "var(--primary)", fontWeight: 600 }}><span className="muted" style={{ fontWeight: 500 }}>#{s.id}</span> {s.shop}</Link>
                    </td>
                    <td>{s.plan}</td>
                    <td className="num">{fmtNum(s.bis_collected)} / {fmtNum(s.bis_sent)}</td>
                    <td className="num">{fmtNum(s.pricedrop_collected)} / {fmtNum(s.pricedrop_sent)}</td>
                    <td className="num">{fmtNum(s.salealert_collected)} / {fmtNum(s.salealert_sent)}</td>
                    <td className="num">{fmtNum(s.preorder_collected)} / {fmtNum(s.preorder_sent)}</td>
                    <td className="num"><strong>{fmtNum(s.total_collected)} / {fmtNum(s.total_sent)}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <Empty>No store activity in this window.</Empty>
      ) : null}

      {stores && stores.totalPages > 1 ? (
        <div className="controls" style={{ marginTop: 14 }}>
          <button className="btn" disabled={stores.page <= 1} onClick={() => setPage(1)}>« First</button>
          <button className="btn" disabled={stores.page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>‹ Prev</button>
          <span className="muted">Page {stores.page} / {stores.totalPages}</span>
          <button className="btn" disabled={stores.page >= stores.totalPages} onClick={() => setPage((p) => p + 1)}>Next ›</button>
          <button className="btn" disabled={stores.page >= stores.totalPages} onClick={() => setPage(stores.totalPages)}>Last »</button>
        </div>
      ) : null}

      <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>
        Tip: click a shop to open its full detail. "Collected" = signups received; "Sent" = alerts delivered.
        Back in Stock / Price Drop / Sale Alerts come from notification signups; Pre-orders from pre-order notification logs.
      </div>

      {data ? (
        <>
          <div className="grid cols-2" style={{ marginTop: 20 }}>
            <Card title="Signups by feature" sub="fun_type"><BarList items={data.byFeature} /></Card>
            <Card title="Signups by channel" sub="type"><BarList items={data.byChannel} /></Card>
          </div>

          <div className="grid cols-2" style={{ marginTop: 16 }}>
            <Card title="Signups by month" sub="created_at">
              <ColumnChart data={data.signupsByMonth} labelFmt={monthLabel} color="#6366f1" />
            </Card>
            <Card title="Alerts sent by month" sub="is_sent">
              <ColumnChart data={data.sentByMonth} labelFmt={monthLabel} color="#18a957" />
            </Card>
          </div>

          <div className="section-title">Delivery <span className="card-sub">date filter only</span></div>
          <div className="grid cols-2">
            <Card title="Email delivery by channel" sub="bis_mails">
              <div className="table-wrap" style={{ border: "none" }}>
                <table className="data">
                  <thead><tr><th>Channel</th><th className="num">Records</th><th className="num">Sent count</th></tr></thead>
                  <tbody>
                    {(data.emailDelivery || []).map((r: any, i: number) => (
                      <tr key={i}><td>{r.label}</td><td className="num">{fmtNum(r.count)}</td><td className="num">{fmtNum(r.sent)}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
            <Card title="SMS / WhatsApp status" sub="sent_s_m_s_responses">
              <BarList items={data.smsWhatsapp} emptyLabel="No SMS/WhatsApp responses" />
            </Card>
          </div>
        </>
      ) : null}
    </>
  );
}
