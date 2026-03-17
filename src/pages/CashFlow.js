import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../components/AuthContext'

export default function CashFlow() {
  const { user } = useAuth()
  const [summaries, setSummaries] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  const load = async () => {
    const { data } = await supabase.from('daily_summary').select('*').eq('user_id', user.id).order('summary_date', { ascending: true })
    setSummaries(data || [])
    setLoading(false)
  }

  if (loading) return <div style={s.loading}>Loading...</div>

  const totalRevenue = summaries.reduce((a, d) => a + (d.total_revenue || 0), 0)
  const totalCosts = summaries.reduce((a, d) => a + (d.total_ingredient_cost || 0) + (d.total_labor_cost || 0) + (d.total_waste_value || 0), 0)
  const totalNet = summaries.reduce((a, d) => a + (d.net_profit || 0), 0)
  const avgMargin = summaries.length > 0 ? (summaries.reduce((a, d) => a + (d.gross_margin || 0), 0) / summaries.length).toFixed(1) : 0

  // Monthly breakdown
  const monthly = {}
  summaries.forEach(d => {
    const month = d.summary_date?.slice(0, 7)
    if (!monthly[month]) monthly[month] = { revenue: 0, costs: 0, net: 0, days: 0 }
    monthly[month].revenue += d.total_revenue || 0
    monthly[month].costs += (d.total_ingredient_cost || 0) + (d.total_labor_cost || 0) + (d.total_waste_value || 0)
    monthly[month].net += d.net_profit || 0
    monthly[month].days++
  })
  const months = Object.entries(monthly).sort((a, b) => b[0].localeCompare(a[0]))

  // Running balance
  let running = 0
  const withRunning = summaries.map(d => {
    running += d.net_profit || 0
    return { ...d, running }
  })
  const latest = withRunning[withRunning.length - 1]

  return (
    <div>
      <div style={s.header}>
        <div style={s.title}>💳 Cash Flow</div>
        <div style={s.badge}>FINANCIAL OVERVIEW</div>
      </div>

      {summaries.length === 0 ? (
        <div style={s.emptyState}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>💳</div>
          <div style={{ fontSize: 16, color: '#F0C040', marginBottom: 8 }}>No financial data yet</div>
          <div style={{ fontSize: 13, color: 'rgba(253,246,236,0.5)', lineHeight: 1.7 }}>
            Close your first day using the "Close day" tab on the Today page to start seeing your cash flow data here.
          </div>
        </div>
      ) : (
        <>
          <div style={s.kpiStrip}>
            <KPI label="TOTAL REVENUE" value={`UGX ${fmt(totalRevenue)}`} color="#F0C040" />
            <KPI label="TOTAL COSTS" value={`UGX ${fmt(totalCosts)}`} color="#F08070" />
            <KPI label="NET PROFIT" value={`UGX ${fmt(totalNet)}`} color={totalNet > 0 ? '#90D0A0' : '#F08070'} />
            <KPI label="AVG MARGIN" value={`${avgMargin}%`} color={parseFloat(avgMargin) >= 30 ? '#90D0A0' : '#F0B070'} />
          </div>

          {/* Running balance */}
          <div style={s.balanceCard}>
            <div style={s.cardTitle}>CUMULATIVE CASH POSITION</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 11, color: '#C8862A', fontFamily: "'DM Mono', monospace", letterSpacing: 1.5, marginBottom: 6 }}>CURRENT BALANCE</div>
                <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 40, fontWeight: 900, color: latest?.running > 0 ? '#90D0A0' : '#F08070' }}>
                  UGX {fmt(latest?.running || 0)}
                </div>
                <div style={{ fontSize: 12, color: 'rgba(253,246,236,0.4)', marginTop: 6 }}>Cumulative net profit across {summaries.length} days</div>
              </div>
              <MiniChart data={withRunning.slice(-14)} />
            </div>
          </div>

          {/* Cost structure */}
          <div style={s.card}>
            <div style={s.cardTitle}>COST STRUCTURE (ALL TIME)</div>
            <CostBar label="Ingredient / COGS" amount={summaries.reduce((a, d) => a + (d.total_ingredient_cost || 0), 0)} total={totalRevenue} color="#C8862A" />
            <CostBar label="Labor" amount={summaries.reduce((a, d) => a + (d.total_labor_cost || 0), 0)} total={totalRevenue} color="#7DBFAD" />
            <CostBar label="Waste" amount={summaries.reduce((a, d) => a + (d.total_waste_value || 0), 0)} total={totalRevenue} color="#F08070" />
            <CostBar label="Net Profit" amount={totalNet} total={totalRevenue} color="#90D0A0" />
          </div>

          {/* Monthly table */}
          <div style={s.card}>
            <div style={s.cardTitle}>MONTHLY BREAKDOWN</div>
            <table style={s.table}>
              <thead><tr>{['Month', 'Revenue', 'Total Costs', 'Net Profit', 'Margin', 'Days'].map(h => <th key={h} style={s.th}>{h}</th>)}</tr></thead>
              <tbody>
                {months.map(([month, m]) => {
                  const margin = m.revenue > 0 ? ((m.net / m.revenue) * 100).toFixed(0) : 0
                  return (
                    <tr key={month}>
                      <td style={s.td}>{new Date(month + '-01').toLocaleDateString('en-UG', { month: 'long', year: 'numeric' })}</td>
                      <td style={s.td}>UGX {fmt(m.revenue)}</td>
                      <td style={{ ...s.td, color: '#F08070' }}>UGX {fmt(m.costs)}</td>
                      <td style={{ ...s.td, color: m.net > 0 ? '#90D0A0' : '#F08070', fontWeight: 600 }}>UGX {fmt(m.net)}</td>
                      <td style={{ ...s.td, color: parseFloat(margin) >= 30 ? '#90D0A0' : '#F0B070' }}>{margin}%</td>
                      <td style={s.td}>{m.days}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Daily log */}
          <div style={s.card}>
            <div style={s.cardTitle}>DAILY LOG</div>
            <table style={s.table}>
              <thead><tr>{['Date', 'Revenue', 'Net Profit', 'Margin', 'Units Sold'].map(h => <th key={h} style={s.th}>{h}</th>)}</tr></thead>
              <tbody>
                {[...summaries].reverse().slice(0, 14).map(d => (
                  <tr key={d.id}>
                    <td style={s.td}>{d.summary_date}</td>
                    <td style={s.td}>UGX {fmt(d.total_revenue)}</td>
                    <td style={{ ...s.td, color: d.net_profit > 0 ? '#90D0A0' : '#F08070' }}>UGX {fmt(d.net_profit)}</td>
                    <td style={{ ...s.td, color: d.gross_margin >= 30 ? '#90D0A0' : '#F0B070' }}>{d.gross_margin?.toFixed(0)}%</td>
                    <td style={s.td}>{d.units_sold}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

function MiniChart({ data }) {
  if (data.length < 2) return null
  const max = Math.max(...data.map(d => d.running))
  const min = Math.min(...data.map(d => d.running))
  const range = max - min || 1
  const h = 70, w = 200
  const points = data.map((d, i) => `${(i / (data.length - 1)) * w},${h - ((d.running - min) / range) * h}`).join(' ')
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: 200, height: 70 }} preserveAspectRatio="none">
      <polyline points={points} fill="none" stroke="#C8862A" strokeWidth="2" />
    </svg>
  )
}

function CostBar({ label, amount, total, color }) {
  const pct = total > 0 ? Math.max(0, (amount / total) * 100) : 0
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 5 }}>
        <span style={{ color: 'rgba(253,246,236,0.7)' }}>{label}</span>
        <span style={{ fontFamily: "'DM Mono', monospace", color }}>UGX {fmt(amount)} ({pct.toFixed(0)}%)</span>
      </div>
      <div style={{ background: 'rgba(255,255,255,0.07)', borderRadius: 99, height: 7 }}>
        <div style={{ height: 7, borderRadius: 99, width: `${Math.min(100, Math.max(0, pct))}%`, background: color }} />
      </div>
    </div>
  )
}

const KPI = ({ label, value, color }) => (
  <div style={s.kpi}>
    <div style={s.kpiLabel}>{label}</div>
    <div style={{ ...s.kpiVal, color: color || '#FDF6EC' }}>{value}</div>
  </div>
)

const fmt = (n) => Number(Math.round(n) || 0).toLocaleString()

const s = {
  loading: { color: 'rgba(253,246,236,0.4)', textAlign: 'center', padding: 60 },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  title: { fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 700, color: '#FDF6EC' },
  badge: { fontSize: 10, background: 'rgba(200,134,42,0.2)', color: '#C8862A', padding: '4px 12px', borderRadius: 20, fontFamily: "'DM Mono', monospace" },
  kpiStrip: { display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 16 },
  kpi: { background: 'rgba(61,43,31,0.6)', border: '1px solid rgba(200,134,42,0.18)', borderRadius: 10, padding: '12px 14px' },
  kpiLabel: { fontSize: 9, color: '#C8862A', fontFamily: "'DM Mono', monospace", letterSpacing: 1.5, marginBottom: 5 },
  kpiVal: { fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 900 },
  balanceCard: { background: 'rgba(61,43,31,0.6)', border: '1px solid rgba(200,134,42,0.3)', borderRadius: 12, padding: 20, marginBottom: 16 },
  card: { background: 'rgba(61,43,31,0.6)', border: '1px solid rgba(200,134,42,0.18)', borderRadius: 12, padding: 20, marginBottom: 16 },
  cardTitle: { fontSize: 10, color: '#C8862A', fontFamily: "'DM Mono', monospace", letterSpacing: 1.5, marginBottom: 16 },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 12 },
  th: { textAlign: 'left', padding: '8px 12px', fontSize: 9, color: '#C8862A', fontFamily: "'DM Mono', monospace", letterSpacing: 1.5, borderBottom: '1px solid rgba(200,134,42,0.2)' },
  td: { padding: '9px 12px', borderBottom: '1px solid rgba(255,255,255,0.04)', color: 'rgba(253,246,236,0.8)', fontFamily: "'DM Mono', monospace" },
  emptyState: { textAlign: 'center', padding: '40px 20px', color: 'rgba(253,246,236,0.5)', background: 'rgba(61,43,31,0.4)', borderRadius: 12, border: '1px solid rgba(200,134,42,0.1)' },
}
