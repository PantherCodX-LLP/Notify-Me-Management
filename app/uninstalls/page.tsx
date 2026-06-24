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

export default function ChurnPage() {
  const { data, error, loading, reload } = useApi<any>("/api/uninstalls");

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Churn &amp; Uninstalls</h1>
          <p>Merchants leaving, cancelled subscriptions and shopper unsubscribes.</p>
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
            <StatCard label="Churned merchants" value={fmtNum(data.churnedTotal)} icon="⤴" tone="red" />
            <StatCard label="Cancelled subscriptions" value={fmtNum(data.cancelledCharges)} icon="✕" tone="amber" />
            <StatCard label="Email unsubscribes" value={fmtNum(data.unsubscribes?.total)} icon="✉" tone="indigo" />
          </div>

          {!data.hasReasonField ? (
            <div className="notice" style={{ marginTop: 16 }}>
              The database has no dedicated <strong>uninstall-reason</strong> field. The
              closest available signals are the <strong>handprint</strong> event log (shown
              below) and email-unsubscribe reasons. If you start capturing an uninstall
              survey, point a new column here and I'll wire it in.
            </div>
          ) : null}

          <div className="grid cols-2" style={{ marginTop: 16 }}>
            <Card title="Merchant churn by month" sub="users.deleted_at">
              <ColumnChart data={data.churnByMonth} labelFmt={monthLabel} color="#e0444b" />
            </Card>
            <Card title="Subscription cancellations by month" sub="charges.cancelled_on">
              <ColumnChart data={data.cancelByMonth} labelFmt={monthLabel} color="#d98a00" />
            </Card>
          </div>

          <div className="grid cols-2" style={{ marginTop: 16 }}>
            <Card title="Churn by plan"><BarList items={data.churnByPlan} /></Card>
            <Card title="Charge status"><BarList items={data.chargeStatus} /></Card>
          </div>

          <div className="grid cols-2" style={{ marginTop: 16 }}>
            <Card title="Unsubscribes by source"><BarList items={data.unsubscribes?.bySource || []} /></Card>
            <Card title="Unsubscribes by month">
              <ColumnChart data={data.unsubscribes?.byMonth || []} labelFmt={monthLabel} color="#8b5cf6" />
            </Card>
          </div>

          <div className="section-title">Uninstall event log <span className="card-sub">handprint</span></div>
          <DataTable rows={data.handprintUninstalls} empty="No uninstall events logged." wrap />
        </>
      ) : null}
    </>
  );
}
