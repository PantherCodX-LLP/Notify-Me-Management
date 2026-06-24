"use client";

import { useEffect, useState, useCallback } from "react";
import { useApi, fmtNum, Loading, ErrorBox, Empty, Cell } from "../components/ui";

export default function TablesPage() {
  // Pull table list from the schema endpoint.
  const schema = useApi<any>("/api/schema");
  const [table, setTable] = useState<string>("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [sortCol, setSortCol] = useState<string>("");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Default to first table once schema loads.
  useEffect(() => {
    if (!table && schema.data?.tables?.length) {
      setTable(schema.data.tables[0].name);
    }
  }, [schema.data, table]);

  const load = useCallback(async () => {
    if (!table) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        table,
        page: String(page),
        pageSize: String(pageSize),
        search,
      });
      if (sortCol) {
        params.set("sortCol", sortCol);
        params.set("sortDir", sortDir);
      }
      const res = await fetch(`/api/table?${params.toString()}`, { cache: "no-store" });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "Request failed");
      setData(json.data);
    } catch (e: any) {
      setError(e?.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [table, page, pageSize, search, sortCol, sortDir]);

  useEffect(() => {
    load();
  }, [load]);

  function onPickTable(name: string) {
    setTable(name);
    setPage(1);
    setSearch("");
    setSearchInput("");
    setSortCol("");
  }

  function onSort(col: string) {
    if (sortCol === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortCol(col);
      setSortDir("desc");
    }
    setPage(1);
  }

  function applySearch() {
    setSearch(searchInput);
    setPage(1);
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Table Explorer</h1>
          <p>Browse every table and row directly. Nothing hidden.</p>
        </div>
        <button className="btn" onClick={load} disabled={loading || !table}>
          ↻ Refresh
        </button>
      </div>

      {schema.error ? <ErrorBox message={schema.error} /> : null}
      {schema.loading ? <Loading label="Loading table list…" /> : null}

      {schema.data ? (
        <>
          <div className="controls">
            <select
              className="inp"
              value={table}
              onChange={(e) => onPickTable(e.target.value)}
              style={{ minWidth: 220 }}
            >
              {schema.data.tables.map((t: any) => (
                <option key={t.name} value={t.name}>
                  {t.name} ({fmtNum(t.rowEstimate)})
                </option>
              ))}
            </select>

            <input
              className="inp"
              placeholder="Search text columns…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && applySearch()}
              style={{ minWidth: 220 }}
            />
            <button className="btn primary" onClick={applySearch}>
              Search
            </button>
            {search ? (
              <button
                className="btn"
                onClick={() => {
                  setSearch("");
                  setSearchInput("");
                  setPage(1);
                }}
              >
                Clear
              </button>
            ) : null}

            <div className="spacer" />

            <select
              className="inp"
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
            >
              {[25, 50, 100, 200].map((n) => (
                <option key={n} value={n}>
                  {n} / page
                </option>
              ))}
            </select>
          </div>

          {error ? <ErrorBox message={error} /> : null}
          {loading ? <Loading /> : null}

          {data && !loading ? (
            <>
              <div className="muted" style={{ marginBottom: 10 }}>
                <strong className="mono">{data.table}</strong> — {fmtNum(data.totalRows)}{" "}
                rows{search ? ` matching “${search}”` : ""} · page {data.page} of{" "}
                {data.totalPages}
              </div>

              {data.rows.length ? (
                <div className="table-wrap">
                  <table className="data">
                    <thead>
                      <tr>
                        {data.columns.map((c: any) => (
                          <th key={c.name} onClick={() => onSort(c.name)}>
                            {c.name}
                            {sortCol === c.name ? (sortDir === "asc" ? " ▲" : " ▼") : ""}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {data.rows.map((row: any, i: number) => (
                        <tr key={i}>
                          {data.columns.map((c: any) => (
                            <td key={c.name}>
                              <Cell value={row[c.name]} />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <Empty>No rows.</Empty>
              )}

              <div className="controls" style={{ marginTop: 14 }}>
                <button
                  className="btn"
                  disabled={data.page <= 1}
                  onClick={() => setPage(1)}
                >
                  « First
                </button>
                <button
                  className="btn"
                  disabled={data.page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  ‹ Prev
                </button>
                <span className="muted">
                  Page {data.page} / {data.totalPages}
                </span>
                <button
                  className="btn"
                  disabled={data.page >= data.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next ›
                </button>
                <button
                  className="btn"
                  disabled={data.page >= data.totalPages}
                  onClick={() => setPage(data.totalPages)}
                >
                  Last »
                </button>
              </div>
            </>
          ) : null}
        </>
      ) : null}
    </>
  );
}
