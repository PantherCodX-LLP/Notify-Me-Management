"use client";

import {
  useApi,
  fmtNum,
  fmtMoney,
  Card,
  StatCard,
  ColumnChart,
  Loading,
  ErrorBox,
  monthLabel,
} from "../components/ui";

export default function MrrPage() {
  const { data, error, loading, reload } = useApi<any>("/api/mrr");

  const overReported =
    data && data.naiveActiveRevenue != null && data.mrr != null
      ? data.naiveActiveRevenue - data.mrr
      : 0;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>MRR &amp; Recurring Revenue</h1>
          <p>
            Monthly Recurring Revenue — test charges and blocked merchants
            excluded, annual plans normalized to a monthly basis.
          </p>
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
            <StatCard
              label="Current MRR"
              value={fmtMoney(data.mrr)}
              icon="$"
              tone="green"
              hint="active recurring charges, annual ÷ 12, test excluded"
            />
            <StatCard
              label="ARR (MRR × 12)"
              value={fmtMoney(data.arr)}
              icon="∑"
              tone="indigo"
            />
            <StatCard
              label="Paying merchants"
              value={fmtNum(data.payingMerchants)}
              icon="◆"
              tone="indigo"
              hint={`${fmtNum(data.activeSubs)} active subscriptions`}
            />
            <StatCard
              label="ARPA"
              value={fmtMoney(data.arpa)}
              icon="÷"
              tone="amber"
              hint="avg revenue per paying account / mo"
            />
          </div>

          <div className="grid stats" style={{ marginTop: 16 }}>
            <StatCard
              label="MoM growth"
              value={`${data.momGrowth > 0 ? "+" : ""}${fmtNum(data.momGrowth)}%`}
              icon="↗"
              tone={data.momGrowth >= 0 ? "green" : "red"}
              hint="vs previous month-end MRR"
            />
            <StatCard
              label="Test charges excluded"
              value={fmtNum(data.test?.excludedActive)}
              icon="⚗"
              tone="red"
              hint={`active test charges worth ${fmtMoney(data.test?.excludedActiveRaw)} not counted`}
            />
            <StatCard
              label="Annual plans"
              value={fmtNum(data.annual?.count)}
              icon="📅"
              tone="indigo"
              hint={`${fmtMoney(data.annual?.rawAnnual)}/yr → ${fmtMoney(
                data.annual?.monthlyEquivalent
              )}/mo`}
            />
            <StatCard
              label="Over-reported (naive)"
              value={fmtMoney(overReported)}
              icon="⚠"
              tone="amber"
              hint={`naive sum ${fmtMoney(data.naiveActiveRevenue)} vs true MRR ${fmtMoney(
                data.mrr
              )}`}
            />
          </div>

          <div className="card" style={{ marginTop: 16 }}>
            <h3>
              MRR trend <span className="card-sub">net active MRR at each month-end</span>
            </h3>
            <ColumnChart
              data={data.series}
              labelFmt={monthLabel}
              color="#18a957"
              height={240}
            />
          </div>

          <div className="grid cols-2" style={{ marginTop: 16 }}>
            <Card title="New MRR by month" sub="charges activated in month">
              <ColumnChart
                data={(data.series || []).map((s: any) => ({ bucket: s.bucket, count: s.newMrr }))}
                labelFmt={monthLabel}
                color="#6366f1"
              />
            </Card>
            <Card title="Churned MRR by month" sub="charges cancelled in month">
              <ColumnChart
                data={(data.series || []).map((s: any) => ({ bucket: s.bucket, count: s.churnedMrr }))}
                labelFmt={monthLabel}
                color="#e0526a"
              />
            </Card>
          </div>

          <div className="card" style={{ marginTop: 16 }}>
            <h3>
              MRR by plan{" "}
              <span className="card-sub">
                active subscriptions · test charges shown separately (not in MRR)
              </span>
            </h3>
            <div className="table-wrap" style={{ border: "none" }}>
              <table className="data">
                <thead>
                  <tr>
                    <th>Plan</th>
                    <th className="num">Subscriptions</th>
                    <th className="num">MRR</th>
                    <th className="num">% of MRR</th>
                    <th className="num">Avg / sub</th>
                    <th className="num">Test subs</th>
                    <th className="num">Test MRR (excl.)</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.byPlan || []).map((r: any, i: number) => (
                    <tr key={i}>
                      <td>{r.label}</td>
                      <td className="num">{fmtNum(r.subscriptions)}</td>
                      <td className="num">{fmtMoney(r.mrr)}</td>
                      <td className="num">{fmtNum(r.share)}%</td>
                      <td className="num">{fmtMoney(r.avg)}</td>
                      <td className="num">{r.testSubscriptions ? fmtNum(r.testSubscriptions) : "—"}</td>
                      <td className="num">{r.testSubscriptions ? fmtMoney(r.testMrr) : "—"}</td>
                    </tr>
                  ))}
                  {data.byPlan?.length ? (
                    <tr style={{ fontWeight: 600, borderTop: "2px solid #eef1f7" }}>
                      <td>Total</td>
                      <td className="num">{fmtNum(data.activeSubs)}</td>
                      <td className="num">{fmtMoney(data.mrr)}</td>
                      <td className="num">100%</td>
                      <td className="num">{fmtMoney(data.arpa)}</td>
                      <td className="num">{fmtNum(data.test?.excludedActive)}</td>
                      <td className="num">{fmtMoney(data.test?.excludedActiveMrr)}</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card" style={{ marginTop: 16 }}>
            <h3>
              MRR by billing interval <span className="card-sub">normalized to monthly</span>
            </h3>
            <div className="table-wrap" style={{ border: "none" }}>
              <table className="data">
                <thead>
                  <tr>
                    <th>Interval</th>
                    <th className="num">Subscriptions</th>
                    <th className="num">MRR contribution</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.byInterval || []).map((r: any, i: number) => (
                    <tr key={i}>
                      <td>{r.label}</td>
                      <td className="num">{fmtNum(r.subscriptions)}</td>
                      <td className="num">{fmtMoney(r.mrr)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card" style={{ marginTop: 16 }}>
            <h3>
              Top active subscriptions{" "}
              <span className="card-sub">individual merchants, by monthly contribution</span>
            </h3>
            <div className="table-wrap" style={{ border: "none" }}>
              <table className="data">
                <thead>
                  <tr>
                    <th>Shop</th>
                    <th>Website</th>
                    <th>Plan</th>
                    <th>Interval</th>
                    <th className="num">List price</th>
                    <th className="num">Monthly value</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.topSubs || []).map((r: any, i: number) => (
                    <tr key={i}>
                      <td>
                        {r.shopId ? (
                          <a href={`/shops/${r.shopId}`}>{r.shop}</a>
                        ) : (
                          r.shop
                        )}
                      </td>
                      <td>
                        {r.website ? (
                          <a href={`https://${r.website}`} target="_blank" rel="noopener noreferrer">
                            {r.website}
                          </a>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                      <td>{r.plan}</td>
                      <td>{r.interval}</td>
                      <td className="num">{fmtMoney(r.price)}</td>
                      <td className="num">{fmtMoney(r.monthly)}</td>
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
