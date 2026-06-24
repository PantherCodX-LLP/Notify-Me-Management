"use client";

import {
  useApi,
  fmtNum,
  fmtMoney,
  StatCard,
  Card,
  Funnel,
  ColumnChart,
  Loading,
  ErrorBox,
  monthLabel,
} from "../components/ui";

export default function ConversionPage() {
  const { data, error, loading, reload } = useApi<any>("/api/conversion");

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Conversion &amp; Revenue</h1>
          <p>How signups convert into orders and revenue — and free merchants into paying ones.</p>
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
            <StatCard label="Revenue generated" value={fmtMoney(data.funnel.revenue)} icon="$" tone="green" />
            <StatCard label="Orders generated" value={fmtNum(data.funnel.orders)} icon="🛒" tone="indigo" />
            <StatCard label="Avg conversion rate" value={`${data.funnel.avgConversionRate.toFixed(2)}%`} icon="%" tone="amber" />
            <StatCard label="Avg order value" value={fmtMoney(data.funnel.avgOrderValue)} icon="◷" tone="indigo" />
          </div>

          <div className="card" style={{ marginTop: 16 }}>
            <h3>Shopper conversion funnel <span className="card-sub">bis_analytics_daily</span></h3>
            <Funnel
              steps={[
                { label: "Alerts sent", value: data.funnel.sent },
                { label: "Delivered", value: data.funnel.delivered },
                { label: "Opened", value: data.funnel.opened },
                { label: "Clicked", value: data.funnel.clicked },
                { label: "Orders", value: data.funnel.orders },
              ]}
            />
          </div>

          <div className="grid cols-2" style={{ marginTop: 16 }}>
            <Card title="Revenue by month" sub="attributed BIS revenue">
              <ColumnChart data={data.revByMonth} labelFmt={monthLabel} color="#18a957" />
            </Card>
            <Card title="Orders by month">
              <ColumnChart data={data.ordersByMonth} labelFmt={monthLabel} color="#6366f1" />
            </Card>
          </div>

          <div className="section-title">Attributed orders <span className="card-sub">analytics_orders</span></div>
          <div className="grid stats">
            <StatCard label="Total orders" value={fmtNum(data.attribution.totalOrders)} icon="🧾" tone="indigo"
              hint={fmtMoney(data.attribution.totalRevenue)} />
            <StatCard label="Back-in-stock orders" value={fmtNum(data.attribution.bisOrders)} icon="🔔" tone="green"
              hint={fmtMoney(data.attribution.bisRevenue)} />
            <StatCard label="Upsell orders" value={fmtNum(data.attribution.upsellOrders)} icon="✦" tone="amber"
              hint={fmtMoney(data.attribution.upsellRevenue)} />
          </div>

          <div className="section-title">Merchant conversion (free → paid)</div>
          <div className="grid stats">
            <StatCard label="Active merchants" value={fmtNum(data.merchantConversion.active)} icon="🏪" tone="indigo" />
            <StatCard label="Paying" value={fmtNum(data.merchantConversion.paying)} icon="◆" tone="green" />
            <StatCard label="Freemium" value={fmtNum(data.merchantConversion.freemium)} icon="◇" tone="amber" />
            <StatCard label="Paid conversion" value={`${data.merchantConversion.paidRate.toFixed(1)}%`} icon="%" tone="green" />
          </div>

          <div className="card" style={{ marginTop: 16 }}>
            <h3>Top products by revenue <span className="card-sub">bis_analytics_products</span></h3>
            <div className="table-wrap" style={{ border: "none" }}>
              <table className="data">
                <thead>
                  <tr><th>Product</th><th className="num">Alerts</th><th className="num">Orders</th><th className="num">Revenue</th></tr>
                </thead>
                <tbody>
                  {(data.topProducts || []).map((p: any, i: number) => (
                    <tr key={i}>
                      <td>{p.label}</td>
                      <td className="num">{fmtNum(p.alerts)}</td>
                      <td className="num">{fmtNum(p.orders)}</td>
                      <td className="num">{fmtMoney(p.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : null}
    </>
  );
}
