"use client";

import { useState, Fragment } from "react";
import { useApi, fmtNum, Loading, ErrorBox } from "../components/ui";

function MappingTable({ mapping }: { mapping: Record<string, any> }) {
  const rows = Object.entries(mapping || {}).filter(([, v]) => v);
  if (!rows.length) return <div className="muted">Nothing detected.</div>;
  return (
    <div className="kv" style={{ gap: "8px 26px" }}>
      {rows.map(([k, v]) => (
        <div key={k}>
          <span>{k}</span>
          <br />
          <strong className="mono">{String(v)}</strong>
        </div>
      ))}
    </div>
  );
}

export default function SchemaPage() {
  const { data, error, loading, reload } = useApi<any>("/api/schema");
  const [open, setOpen] = useState<string | null>(null);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Schema &amp; Mapping</h1>
          <p>Every table the dashboard can see, plus the auto-detected mapping.</p>
        </div>
        <button className="btn" onClick={reload} disabled={loading}>
          ↻ Refresh
        </button>
      </div>

      {loading ? <Loading /> : null}
      {error ? <ErrorBox message={error} /> : null}

      {data ? (
        <>
          <div className="notice">
            To correct any auto-detection, edit{" "}
            <span className="mono">lib/mapping.ts</span> → <strong>OVERRIDES</strong>{" "}
            with the exact table/column names shown below, then refresh.
          </div>

          <div className="grid cols-2">
            <div className="card">
              <h3>Connection</h3>
              <div className="kv" style={{ gap: "8px 26px" }}>
                <div>
                  <span>Active schema</span>
                  <br />
                  <strong className="mono">{data.database}</strong>
                </div>
                <div>
                  <span>Schemas on server</span>
                  <br />
                  <strong className="mono">
                    {(data.databases || []).join(", ") || "—"}
                  </strong>
                </div>
                <div>
                  <span>Tables</span>
                  <br />
                  <strong>{fmtNum(data.tables?.length)}</strong>
                </div>
              </div>
            </div>
            <div className="card">
              <h3>Auto-detected mapping</h3>
              <MappingTable mapping={data.mapping} />
            </div>
          </div>

          <div className="section-title">All tables</div>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Table</th>
                  <th className="num">Est. rows</th>
                  <th className="num">Columns</th>
                  <th>Comment</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {data.tables.map((t: any) => (
                  <Fragment key={t.name}>
                    <tr>
                      <td className="mono">{t.name}</td>
                      <td className="num">{fmtNum(t.rowEstimate)}</td>
                      <td className="num">{t.columns.length}</td>
                      <td className="muted">{t.comment || ""}</td>
                      <td className="right">
                        <button
                          className="btn"
                          onClick={() => setOpen(open === t.name ? null : t.name)}
                        >
                          {open === t.name ? "Hide" : "Columns"}
                        </button>
                      </td>
                    </tr>
                    {open === t.name ? (
                      <tr>
                        <td colSpan={5} style={{ background: "#fafbff" }}>
                          <div className="table-wrap" style={{ margin: "6px 0" }}>
                            <table className="data">
                              <thead>
                                <tr>
                                  <th>Column</th>
                                  <th>Type</th>
                                  <th>Nullable</th>
                                  <th>Key</th>
                                  <th>Comment</th>
                                </tr>
                              </thead>
                              <tbody>
                                {t.columns.map((c: any) => (
                                  <tr key={c.name}>
                                    <td className="mono">{c.name}</td>
                                    <td>{c.columnType}</td>
                                    <td>{c.nullable ? "yes" : "no"}</td>
                                    <td>
                                      {c.key ? (
                                        <span className="badge gray">{c.key}</span>
                                      ) : (
                                        ""
                                      )}
                                    </td>
                                    <td className="muted">{c.comment || ""}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </>
  );
}
