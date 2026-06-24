"use client";

import { useEffect, useState, useCallback } from "react";

// Data fetching hook ---------------------------------------------------------
export function useApi<T = any>(url: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(url, { cache: "no-store" });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "Request failed");
      setData(json.data as T);
    } catch (e: any) {
      setError(e?.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    load();
  }, [load]);

  return { data, error, loading, reload: load };
}

// Formatting -----------------------------------------------------------------
export function fmtNum(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return "—";
  return new Intl.NumberFormat("en-US").format(Math.round(Number(n)));
}

export function fmtMoney(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(Number(n));
}

export function monthLabel(ym: string): string {
  const [y, m] = ym.split("-");
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleString("en-US", { month: "short", year: "2-digit" });
}

// Primitives -----------------------------------------------------------------
export function Loading({ label = "Loading data…" }: { label?: string }) {
  return (
    <div className="loading">
      <div className="spinner" />
      {label}
    </div>
  );
}

export function ErrorBox({ message }: { message: string }) {
  return (
    <div className="errbox">
      <strong>Could not load data.</strong>
      <div style={{ marginTop: 6, fontSize: 13 }}>{message}</div>
      <div style={{ marginTop: 10, fontSize: 12.5, color: "#a05055" }}>
        Check credentials in <span className="mono">.env.local</span> and that this
        machine can reach the database host.
      </div>
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="empty">{children}</div>;
}

export function StatCard({
  label,
  value,
  icon,
  tone = "indigo",
  hint,
}: {
  label: string;
  value: React.ReactNode;
  icon?: string;
  tone?: "indigo" | "green" | "red" | "amber";
  hint?: string;
}) {
  return (
    <div className="card">
      <div className="stat">
        <div className="label">
          {icon ? <span className={`pill ${tone}`}>{icon}</span> : null}
          {label}
        </div>
        <div className="value">{value}</div>
        {hint ? <div className="muted" style={{ fontSize: 12 }}>{hint}</div> : null}
      </div>
    </div>
  );
}

export function Card({
  title,
  sub,
  children,
}: {
  title?: string;
  sub?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="card">
      {title ? (
        <h3>
          {title}
          {sub ? <span className="card-sub">{sub}</span> : null}
        </h3>
      ) : null}
      {children}
    </div>
  );
}

// Horizontal bar list --------------------------------------------------------
export function BarList({
  items,
  emptyLabel = "No data",
}: {
  items: { label: string; count: number }[];
  emptyLabel?: string;
}) {
  if (!items || !items.length) return <div className="muted">{emptyLabel}</div>;
  const max = Math.max(...items.map((i) => i.count), 1);
  return (
    <div className="barlist">
      {items.map((it, i) => (
        <div className="barrow" key={i}>
          <div className="blabel" title={it.label}>
            {it.label}
          </div>
          <div className="btrack">
            <div className="bfill" style={{ width: `${(it.count / max) * 100}%` }} />
          </div>
          <div className="bval">{fmtNum(it.count)}</div>
        </div>
      ))}
    </div>
  );
}

// SVG column chart -----------------------------------------------------------
export function ColumnChart({
  data,
  labelFmt,
  height = 200,
  color = "#6366f1",
}: {
  data: { bucket: string; count: number }[];
  labelFmt?: (b: string) => string;
  height?: number;
  color?: string;
}) {
  if (!data || !data.length) return <div className="muted">No data</div>;
  const w = 760;
  const h = height;
  const padL = 38;
  const padB = 28;
  const padT = 12;
  const max = Math.max(...data.map((d) => d.count), 1);
  const innerW = w - padL - 10;
  const innerH = h - padB - padT;
  const bw = innerW / data.length;
  const ticks = 4;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" preserveAspectRatio="xMidYMid meet" role="img">
      {Array.from({ length: ticks + 1 }).map((_, i) => {
        const val = Math.round((max / ticks) * i);
        const y = padT + innerH - (innerH / ticks) * i;
        return (
          <g key={i}>
            <line x1={padL} y1={y} x2={w - 10} y2={y} stroke="#eef1f7" strokeWidth={1} />
            <text x={padL - 6} y={y + 3} textAnchor="end" fontSize="10" fill="#9aa2b5">
              {val}
            </text>
          </g>
        );
      })}
      {data.map((d, i) => {
        const bh = (d.count / max) * innerH;
        const x = padL + i * bw + bw * 0.18;
        const y = padT + innerH - bh;
        const showLabel = data.length <= 16 || i % Math.ceil(data.length / 12) === 0;
        return (
          <g key={i}>
            <rect x={x} y={y} width={bw * 0.64} height={Math.max(bh, d.count > 0 ? 2 : 0)} rx={3} fill={color}>
              <title>
                {(labelFmt ? labelFmt(d.bucket) : d.bucket)}: {d.count}
              </title>
            </rect>
            {showLabel ? (
              <text x={padL + i * bw + bw / 2} y={h - 9} textAnchor="middle" fontSize="9.5" fill="#9aa2b5">
                {labelFmt ? labelFmt(d.bucket) : d.bucket}
              </text>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}

// Funnel ---------------------------------------------------------------------
export function Funnel({
  steps,
  money,
}: {
  steps: { label: string; value: number; isMoney?: boolean }[];
  money?: boolean;
}) {
  if (!steps || !steps.length) return <div className="muted">No data</div>;
  const top = Math.max(steps[0]?.value || 0, 1);
  return (
    <div className="barlist">
      {steps.map((s, i) => {
        const prev = i > 0 ? steps[i - 1].value : null;
        const pctOfTop = (s.value / top) * 100;
        const stepConv = prev ? (s.value / (prev || 1)) * 100 : null;
        return (
          <div className="barrow" key={i} style={{ gridTemplateColumns: "150px 1fr 150px" }}>
            <div className="blabel">{s.label}</div>
            <div className="btrack" style={{ height: 24 }}>
              <div className="bfill" style={{ width: `${Math.max(pctOfTop, 1)}%`, height: "100%" }} />
            </div>
            <div className="bval" style={{ textAlign: "right" }}>
              {s.isMoney || money ? fmtMoney(s.value) : fmtNum(s.value)}
              {stepConv !== null ? <span className="muted"> · {stepConv.toFixed(1)}%</span> : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Generic object-array table -------------------------------------------------
export function DataTable({
  rows,
  empty = "No rows.",
  wrap = false,
}: {
  rows: any[];
  empty?: string;
  wrap?: boolean;
}) {
  if (!rows || !rows.length) return <div className="muted">{empty}</div>;
  const cols = Object.keys(rows[0]);
  return (
    <div className="table-wrap">
      <table className="data">
        <thead>
          <tr>
            {cols.map((c) => (
              <th key={c} style={{ cursor: "default" }}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {cols.map((c) => (
                <td key={c} style={wrap ? { whiteSpace: "normal", maxWidth: 480 } : undefined}>
                  <Cell value={r[c]} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Cell -----------------------------------------------------------------------
export function Cell({ value }: { value: any }) {
  if (value === null || value === undefined) return <span className="null">NULL</span>;
  if (typeof value === "object") {
    try {
      return <span className="mono">{JSON.stringify(value)}</span>;
    } catch {
      return <span className="mono">{String(value)}</span>;
    }
  }
  const s = String(value);
  return <span title={s}>{s}</span>;
}
