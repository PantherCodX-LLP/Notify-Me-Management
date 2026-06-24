"use client";

import {
  useApi,
  fmtNum,
  StatCard,
  Card,
  BarList,
  ColumnChart,
  DataTable,
  Loading,
  ErrorBox,
  monthLabel,
} from "../components/ui";

export default function MerchantsPage() {
  const { data, error, loading, reload } = useApi<any>("/api/installs");

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Merchants &amp; Installs</h1>
          <p>Who installed the app, when, on which plan and in which market.</p>
        </div>
        <button className="btn" onClick={reload} disabled={loading}>
          ↻ Refresh
        </button>
      </div>

      {loading ? <Loading /> : null}
      {error ? <ErrorBox message={error} /> : null}

      {data ? (
        <>
          <div className="grid stats">
            <StatCard label="Total merchants" value={fmtNum(data.total)} icon="🏪" tone="indigo" />
            <StatCard label="Active" value={fmtNum(data.active)} icon="✓" tone="green" />
            <StatCard label="Churned" value={fmtNum(data.churned)} icon="⤴" tone="red" />
            <StatCard label="Freemium" value={fmtNum(data.freemium)} icon="◇" tone="amber"
              hint={`${fmtNum(data.grandfathered)} grandfathered`} />
          </div>

          <div className="card" style={{ marginTop: 16 }}>
            <h3>New installs by month <span className="card-sub">last 12 months</span></h3>
            <ColumnChart data={data.byMonth} labelFmt={monthLabel} color="#6366f1" />
          </div>

          <div className="card" style={{ marginTop: 16 }}>
            <h3>New installs by day <span className="card-sub">last 30 days</span></h3>
            <ColumnChart data={data.byDay} color="#818cf8" />
          </div>

          <div className="grid cols-2" style={{ marginTop: 16 }}>
            <Card title="Merchants by plan" sub="active"><BarList items={data.byPlan} /></Card>
            <Card title="Merchants by store language"><BarList items={data.byLanguage} emptyLabel="No language data" /></Card>
          </div>

          <div className="card" style={{ marginTop: 16 }}>
            <h3>Installs by country <span className="card-sub">from handprint event log</span></h3>
            <BarList items={data.byCountry} emptyLabel="No country data" />
          </div>

          <div className="section-title">Most recent installs</div>
          <DataTable rows={data.recentInstalls} empty="No recent installs." />

          <div className="section-title">Most recent uninstalls</div>
          <DataTable rows={data.recentUninstalls} empty="No recent uninstalls." />
        </>
      ) : null}
    </>
  );
}
