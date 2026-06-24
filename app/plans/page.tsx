"use client";

import {
  useApi,
  fmtNum,
  fmtMoney,
  Card,
  StatCard,
  BarList,
  ColumnChart,
  DataTable,
  Loading,
  ErrorBox,
  monthLabel,
} from "../components/ui";

export default function BillingPage() {
  const { data, error, loading, reload } = useApi<any>("/api/plans");

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Plans &amp; Billing</h1>
          <p>Subscriptions, recurring revenue and pay-as-you-go usage.</p>
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
            <StatCard label="Active subscriptions" value={fmtNum(data.activeCharges)} icon="◆" tone="green" />
            <StatCard label="Active recurring revenue" value={fmtMoney(data.activeRevenue)} icon="$" tone="indigo" hint="sum of active charge prices" />
            <StatCard label="On trial" value={fmtNum(data.trials)} icon="⏳" tone="amber" />
            <StatCard label="Cancelled (all time)" value={fmtNum(data.cancelledCharges)} icon="✕" tone="red" />
          </div>

          <div className="grid stats" style={{ marginTop: 16 }}>
            <StatCard label="Usage-based billing total" value={fmtMoney(data.usage?.total)} icon="⚡" tone="indigo" hint="SMS / WhatsApp pay-as-you-go" />
            <StatCard label="Merchants at plan limit" value={fmtNum(data.limitReached)} icon="⛔" tone="amber" />
          </div>

          <div className="grid cols-2" style={{ marginTop: 16 }}>
            <Card title="Active merchants per plan"><BarList items={data.merchantsPerPlan} /></Card>
            <Card title="New subscriptions by month" sub="charges.activated_on">
              <ColumnChart data={data.newChargesByMonth} labelFmt={monthLabel} color="#18a957" />
            </Card>
          </div>

          <div className="card" style={{ marginTop: 16 }}>
            <h3>Recurring revenue by plan <span className="card-sub">active charges</span></h3>
            <div className="table-wrap" style={{ border: "none" }}>
              <table className="data">
                <thead>
                  <tr><th>Plan</th><th className="num">Subscriptions</th><th className="num">Total / mo</th><th className="num">Avg price</th></tr>
                </thead>
                <tbody>
                  {(data.revenueByPlan || []).map((r: any, i: number) => (
                    <tr key={i}>
                      <td>{r.label}</td>
                      <td className="num">{fmtNum(r.count)}</td>
                      <td className="num">{fmtMoney(r.total)}</td>
                      <td className="num">{fmtMoney(r.avg)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid cols-2" style={{ marginTop: 16 }}>
            <Card title="Usage billing by source" sub="send_by"><BarList items={data.usage?.bySender || []} /></Card>
            <Card title="Usage billing by month">
              <ColumnChart data={data.usage?.byMonth || []} labelFmt={monthLabel} color="#6366f1" />
            </Card>
          </div>

          <div className="section-title">All plans</div>
          <DataTable rows={data.plansList} empty="No plans found." />
        </>
      ) : null}
    </>
  );
}
