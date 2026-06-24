"use client";

import {
  useApi,
  fmtNum,
  fmtMoney,
  StatCard,
  Card,
  BarList,
  Loading,
  ErrorBox,
} from "../components/ui";

export default function FeaturesPage() {
  const { data, error, loading, reload } = useApi<any>("/api/features");

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Features</h1>
          <p>Usage across the four notification features plus upsell.</p>
        </div>
        <button className="btn" onClick={reload} disabled={loading}>
          ↻ Refresh
        </button>
      </div>

      {loading ? <Loading /> : null}
      {error ? <ErrorBox message={error} /> : null}

      {data ? (
        <>
          {/* 1. Back in Stock */}
          <div className="section-title">1 · Back in Stock (Notify Me)</div>
          <div className="grid stats">
            <StatCard label="Signups" value={fmtNum(data.backInStock.signups)} icon="🔔" tone="indigo" />
            <StatCard label="Alerts sent" value={fmtNum(data.backInStock.sent)} icon="✓" tone="green" />
            <StatCard label="Popups configured" value={fmtNum(data.backInStock.popups)} icon="▭" tone="amber" />
          </div>
          <div className="grid cols-2" style={{ marginTop: 16 }}>
            <Card title="Send mode" sub="settings"><BarList items={data.backInStock.settings.sendType} /></Card>
            <Card title="Notification sequencing"><BarList items={data.backInStock.settings.configuration} /></Card>
          </div>
          <div className="grid cols-2" style={{ marginTop: 16 }}>
            <Card title="Trigger (notify on)"><BarList items={data.backInStock.settings.notifyMe} /></Card>
            <Card title="Sending domain status"><BarList items={data.backInStock.settings.domainStatus} /></Card>
          </div>

          {/* 2. Price Drop */}
          <div className="section-title">2 · Price Drop alerts</div>
          <div className="grid stats">
            <StatCard label="Shops configured" value={fmtNum(data.priceDrop.configs)} icon="◆" tone="indigo" />
            <StatCard label="Signups" value={fmtNum(data.priceDrop.signups)} icon="🔔" tone="amber" />
          </div>

          {/* 3. Sale Alerts */}
          <div className="section-title">3 · Sale alerts</div>
          <div className="grid stats">
            <StatCard label="Shops configured" value={fmtNum(data.saleAlerts.configs)} icon="◆" tone="indigo" />
            <StatCard label="Signups" value={fmtNum(data.saleAlerts.signups)} icon="🔔" tone="amber" />
          </div>

          {/* 4. Pre-order */}
          <div className="section-title">4 · Pre-orders</div>
          <div className="grid stats">
            <StatCard label="Offers" value={fmtNum(data.preorder.offers)} icon="🏷" tone="indigo" />
            <StatCard label="Pre-orders placed" value={fmtNum(data.preorder.orders)} icon="🛒" tone="green" />
            <StatCard label="Pre-order revenue" value={fmtMoney(data.preorder.revenue)} icon="$" tone="amber" />
          </div>
          <div className="grid cols-2" style={{ marginTop: 16 }}>
            <Card title="Offers by status"><BarList items={data.preorder.offersByStatus} /></Card>
            <Card title="Offers by payment mode"><BarList items={data.preorder.offersByPayment} /></Card>
          </div>
          <div className="grid cols-2" style={{ marginTop: 16 }}>
            <Card title="Pre-orders by fulfilment"><BarList items={data.preorder.ordersByStatus} /></Card>
            <Card title="Offers by product scope"><BarList items={data.preorder.offersByType} /></Card>
          </div>
          <div className="grid cols-2" style={{ marginTop: 16 }}>
            <Card title="Pre-order notifications by type"><BarList items={data.preorder.notifByType} /></Card>
            <Card title="Pre-order notifications by channel"><BarList items={data.preorder.notifByChannel} /></Card>
          </div>

          {/* Bonus: Upsell */}
          <div className="section-title">Bonus · Upsell</div>
          <div className="grid stats">
            <StatCard label="Impressions" value={fmtNum(data.upsell.impressions)} icon="👁" tone="indigo" />
            <StatCard label="Clicks" value={fmtNum(data.upsell.clicks)} icon="☞" tone="green" />
            <StatCard label="CTR" value={`${data.upsell.ctr.toFixed(2)}%`} icon="%" tone="amber" />
            <StatCard label="Upsell revenue" value={fmtMoney(data.upsell.revenue)} icon="$" tone="indigo"
              hint={`${fmtNum(data.upsell.orders)} orders`} />
          </div>
        </>
      ) : null}
    </>
  );
}
