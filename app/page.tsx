"use client";

import {
  useApi,
  fmtNum,
  fmtMoney,
  StatCard,
  Card,
  BarList,
  ColumnChart,
  Funnel,
  Loading,
  ErrorBox,
  monthLabel,
} from "./components/ui";

export default function OverviewPage() {
  const { data, error, loading, reload } = useApi<any>("/api/overview");

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Overview</h1>
          <p>Notify Me (Back in Stock) — app-wide health at a glance.</p>
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
            <StatCard label="Total merchants" value={fmtNum(data.merchants.total)} icon="🏪" tone="indigo" />
            <StatCard label="Active" value={fmtNum(data.merchants.active)} icon="✓" tone="green" />
            <StatCard label="Paying" value={fmtNum(data.merchants.paying)} icon="◆" tone="amber"
              hint={data.merchants.free != null ? `${fmtNum(data.merchants.free)} free` : undefined} />
            <StatCard label="Churned" value={fmtNum(data.merchants.churned)} icon="⤴" tone="red" />
          </div>

          <div className="grid stats" style={{ marginTop: 16 }}>
            <StatCard label="MRR (recurring revenue)" value={fmtMoney(data.revenue.activeRecurring)} icon="$" tone="green"
              hint="active charges · test excluded · annual ÷ 12" />
            <StatCard label="BIS revenue generated" value={fmtMoney(data.revenue.bisRevenue)} icon="↗" tone="indigo"
              hint={`${fmtNum(data.revenue.bisOrders)} orders`} />
            <StatCard label="Notification signups" value={fmtNum(data.notifications.signupsTotal)} icon="🔔" tone="amber" />
            <StatCard label="Alerts sent" value={fmtNum(data.notifications.alertsSent)} icon="✉" tone="indigo" />
          </div>

          <div className="grid cols-2" style={{ marginTop: 16 }}>
            <Card title="New installs" sub="last 12 months">
              <ColumnChart data={data.installsByMonth} labelFmt={monthLabel} color="#6366f1" />
            </Card>
            <Card title="Notification signups" sub="last 12 months">
              <ColumnChart data={data.signupsByMonth} labelFmt={monthLabel} color="#d98a00" />
            </Card>
          </div>

          <div className="grid cols-2" style={{ marginTop: 16 }}>
            <Card title="Signups by feature" sub="fun_type">
              <BarList items={data.featureSplit} />
            </Card>
            <Card title="Signups by channel" sub="type">
              <BarList items={data.channelSplit} />
            </Card>
          </div>

          <div className="grid cols-2" style={{ marginTop: 16 }}>
            <Card title="Conversion funnel" sub="all-time (bis_analytics_daily)">
              <Funnel
                steps={[
                  { label: "Alerts sent", value: data.funnel.sent },
                  { label: "Delivered", value: data.funnel.delivered },
                  { label: "Opened", value: data.funnel.opened },
                  { label: "Clicked", value: data.funnel.clicked },
                  { label: "Orders", value: data.funnel.orders },
                ]}
              />
              <div className="muted" style={{ marginTop: 12 }}>
                Revenue generated: <strong>{fmtMoney(data.funnel.revenue)}</strong>
              </div>
            </Card>
            <Card title="Merchants by plan" sub="active">
              <BarList items={data.planSplit} />
            </Card>
          </div>
        </>
      ) : null}
    </>
  );
}
