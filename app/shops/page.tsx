"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { fmtNum, fmtMoney, Loading, ErrorBox, Empty } from "../components/ui";

const FEATURES = [
  { key: "notify_me", label: "Back in Stock" },
  { key: "price_drop", label: "Price Drop" },
  { key: "sales_alert", label: "Sale Alerts" },
  { key: "preorder", label: "Pre-orders" },
];

const fmtDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export default function ShopsPage() {
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [planId, setPlanId] = useState("");
  const [status, setStatus] = useState("all");
  const [blocked, setBlocked] = useState("all");
  const [features, setFeatures] = useState<string[]>([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [sort, setSort] = useState("created_at");
  const [dir, setDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [featureUsage, setFeatureUsage] = useState<any[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const p = new URLSearchParams({
        search, planId, status, blocked, features: features.join(","), from, to, sort, dir,
        page: String(page), pageSize: String(pageSize),
      });
      const res = await fetch(`/api/shops?${p.toString()}`, { cache: "no-store" });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "Request failed");
      setData(json.data);
    } catch (e: any) {
      setError(e?.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [search, planId, status, blocked, features, from, to, sort, dir, page, pageSize]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/feature-usage", { cache: "no-store" });
        const json = await res.json();
        if (json.ok) setFeatureUsage(json.data);
      } catch {
        /* ignore */
      }
    })();
  }, []);

  function onSort(col: string) {
    if (sort === col) setDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSort(col); setDir("desc"); }
    setPage(1);
  }
  function toggleFeature(key: string) {
    setFeatures((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
    setPage(1);
  }
  function setPreset(days: number) {
    const today = new Date();
    const start = new Date();
    start.setDate(start.getDate() - days);
    setFrom(fmtDate(start));
    setTo(fmtDate(today));
    setPage(1);
  }
  function resetFilters() {
    setSearch(""); setSearchInput(""); setPlanId(""); setStatus("all"); setBlocked("all"); setFeatures([]);
    setFrom(""); setTo(""); setSort("created_at"); setDir("desc"); setPage(1);
  }

  const planOptions = data?.planOptions || [];

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Shops Explorer</h1>
          <p>Every merchant with their plan, usage, what we charged them and what they earned.</p>
        </div>
        <button className="btn" onClick={load} disabled={loading}>↻ Refresh</button>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3>Feature usage <span className="card-sub">click to filter — stores using each feature</span></h3>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {FEATURES.map((feat) => {
            const usage = featureUsage.find((u: any) => u.key === feat.key);
            const on = features.includes(feat.key);
            return (
              <button
                key={feat.key}
                onClick={() => toggleFeature(feat.key)}
                className="card"
                style={{
                  cursor: "pointer", textAlign: "left", padding: "12px 16px", minWidth: 160,
                  border: on ? "2px solid var(--primary)" : "1px solid var(--border)",
                  background: on ? "var(--primary-soft)" : "var(--panel)",
                }}
              >
                <div className="muted" style={{ fontSize: 12.5, display: "flex", alignItems: "center", gap: 6 }}>
                  <input type="checkbox" readOnly checked={on} /> {feat.label}
                </div>
                <div style={{ fontSize: 22, fontWeight: 700 }}>{usage ? fmtNum(usage.count) : "…"}</div>
                <div className="muted" style={{ fontSize: 11 }}>stores</div>
              </button>
            );
          })}
        </div>
        {features.length > 1 ? (
          <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>
            Showing stores using <strong>any</strong> of the selected features.
          </div>
        ) : null}
      </div>

      <div className="controls">
        <input className="inp" placeholder="Search name or email…" value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { setSearch(searchInput); setPage(1); } }}
          style={{ minWidth: 220 }} />
        <button className="btn primary" onClick={() => { setSearch(searchInput); setPage(1); }}>Search</button>

        <select className="inp" value={planId} onChange={(e) => { setPlanId(e.target.value); setPage(1); }}>
          <option value="">All plans</option>
          {planOptions.map((p: any) => (<option key={p.id} value={p.name}>{p.name}</option>))}
        </select>

        <select className="inp" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="churned">Churned</option>
        </select>

        <select className="inp" value={blocked} onChange={(e) => { setBlocked(e.target.value); setPage(1); }}>
          <option value="all">Blocked: all</option>
          <option value="blocked">⛔ Blocked only</option>
          <option value="notblocked">Not blocked</option>
        </select>

        <span className="muted" style={{ fontSize: 12 }}>Quick:</span>
        <button className="btn" onClick={() => setPreset(1)}>24h</button>
        <button className="btn" onClick={() => setPreset(7)}>7d</button>
        <button className="btn" onClick={() => setPreset(15)}>15d</button>
        <button className="btn" onClick={() => setPreset(30)}>30d</button>
        <label className="muted" style={{ fontSize: 12 }}>From
          <input type="date" className="inp" value={from} style={{ marginLeft: 6 }}
            onChange={(e) => { setFrom(e.target.value); setPage(1); }} /></label>
        <label className="muted" style={{ fontSize: 12 }}>To
          <input type="date" className="inp" value={to} style={{ marginLeft: 6 }}
            onChange={(e) => { setTo(e.target.value); setPage(1); }} /></label>

        <div className="spacer" />
        <button className="btn" onClick={resetFilters}>Clear filters</button>
        <select className="inp" value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}>
          {[25, 50, 100, 200].map((n) => <option key={n} value={n}>{n} / page</option>)}
        </select>
      </div>

      {error ? <ErrorBox message={error} /> : null}
      {loading ? <Loading /> : null}

      {data && !loading ? (
        <>
          <div className="muted" style={{ marginBottom: 10 }}>
            {fmtNum(data.totalRows)} merchants
            {features.length ? ` using ${features.map((k) => FEATURES.find((f) => f.key === k)?.label).join(" / ")}` : ""}
            {" "}· page {data.page} of {data.totalPages}
          </div>
          {data.shops.length ? (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th onClick={() => onSort("name")}>Shop {sort === "name" ? (dir === "asc" ? "▲" : "▼") : ""}</th>
                    <th onClick={() => onSort("plan")}>Plan {sort === "plan" ? (dir === "asc" ? "▲" : "▼") : ""}</th>
                    <th>Status</th>
                    <th className="num">Signups</th>
                    <th className="num">Alerts sent</th>
                    <th className="num">App revenue</th>
                    <th className="num">Recurring /mo</th>
                    <th className="num">Usage billed</th>
                    <th onClick={() => onSort("created_at")} className="num">Installed {sort === "created_at" ? (dir === "asc" ? "▲" : "▼") : ""}</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {data.shops.map((s: any) => (
                    <tr key={s.id} style={s.blocked ? { background: "rgba(224,68,75,.12)" } : undefined}>
                      <td>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                          <Link href={`/shops/${s.id}`} style={{ color: "var(--primary)", fontWeight: 600 }}>
                            <span className="muted" style={{ fontWeight: 500 }}>#{s.id}</span> {s.name || "(unnamed)"}
                          </Link>
                          {s.name ? (
                            <a href={`https://${s.name}`} target="_blank" rel="noopener noreferrer" title="Open store in new tab" style={{ textDecoration: "none", fontSize: 13 }}>👁</a>
                          ) : null}
                          {s.blocked ? <span className="badge red" title="Blocked by us (meta_data.is_user_blocked)" style={{ fontSize: 10.5 }}>⛔ blocked</span> : null}
                        </span>
                        <div className="muted" style={{ fontSize: 11 }}>{s.email}</div>
                      </td>
                      <td>{s.plan}{s.freemium ? <span className="badge gray" style={{ marginLeft: 6 }}>free</span> : null}</td>
                      <td>{s.status === "active" ? <span className="badge green">active</span> : <span className="badge red">churned</span>}</td>
                      <td className="num">{fmtNum(s.signups)}</td>
                      <td className="num">{fmtNum(s.alertsSent)}</td>
                      <td className="num">{fmtMoney(s.appRevenue)}</td>
                      <td className="num">{fmtMoney(s.recurringCharged)}</td>
                      <td className="num">{fmtMoney(s.usageCharged)}</td>
                      <td className="num">{s.createdAt ? String(s.createdAt).slice(0, 10) : "—"}</td>
                      <td className="right"><Link className="btn" href={`/shops/${s.id}`}>View →</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty>No merchants match these filters.</Empty>
          )}

          <div className="controls" style={{ marginTop: 14 }}>
            <button className="btn" disabled={data.page <= 1} onClick={() => setPage(1)}>« First</button>
            <button className="btn" disabled={data.page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>‹ Prev</button>
            <span className="muted">Page {data.page} / {data.totalPages}</span>
            <button className="btn" disabled={data.page >= data.totalPages} onClick={() => setPage((p) => p + 1)}>Next ›</button>
            <button className="btn" disabled={data.page >= data.totalPages} onClick={() => setPage(data.totalPages)}>Last »</button>
          </div>
        </>
      ) : null}
    </>
  );
}
