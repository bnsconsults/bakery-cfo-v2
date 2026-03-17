import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../components/AuthContext'

export default function Today({ onNavigate }) {
  const { user } = useAuth()
  const [profile, setProfile] = useState(null)
  const [plans, setPlans] = useState([])
  const [sales, setSales] = useState([])
  const [staff, setStaff] = useState([])
  const [laborLogs, setLaborLogs] = useState([])
  const [recipes, setRecipes] = useState([])
  const [lowStock, setLowStock] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('morning')
  const [closingDay, setClosingDay] = useState(false)
  const [dayClosed, setDayClosed] = useState(false)

  const today = new Date().toISOString().split('T')[0]
  const hour = new Date().getHours()

  useEffect(() => {
    if (hour >= 6 && hour < 12) setTab('morning')
    else if (hour >= 12 && hour < 18) setTab('sell')
    else setTab('close')
    loadAll()
  }, [])

  const loadAll = async () => {
    const [profileRes, plansRes, salesRes, staffRes, laborRes, recipesRes, ingRes, summaryRes] = await Promise.all([
      supabase.from('bakery_profile').select('*').eq('user_id', user.id).single(),
      supabase.from('production_plans').select('*, recipes(name, sell_price, batch_size)').eq('user_id', user.id).eq('plan_date', today),
      supabase.from('sales_log').select('*').eq('user_id', user.id).eq('sale_date', today),
      supabase.from('staff').select('*').eq('user_id', user.id).eq('active', true),
      supabase.from('labor_log').select('*').eq('user_id', user.id).eq('log_date', today),
      supabase.from('recipes').select('*').eq('user_id', user.id).eq('active', true),
      supabase.from('ingredients').select('*').eq('user_id', user.id),
      supabase.from('daily_summary').select('*').eq('user_id', user.id).eq('summary_date', today).single()
    ])
    setProfile(profileRes.data)
    setPlans(plansRes.data || [])
    setSales(salesRes.data || [])
    setStaff(staffRes.data || [])
    setLaborLogs(laborRes.data || [])
    setRecipes(recipesRes.data || [])
    setLowStock((ingRes.data || []).filter(i => i.stock <= i.reorder_level))
    if (summaryRes.data) setDayClosed(true)
    setLoading(false)
  }

  // Calculations
  const totalRevenue = sales.reduce((a, s) => a + (s.total_revenue || 0), 0)
  const totalUnits = sales.reduce((a, s) => a + (s.units_sold || 0), 0)
  const totalWasted = sales.reduce((a, s) => a + (s.units_wasted || 0), 0)
  const totalLabor = laborLogs.reduce((a, l) => {
    const member = staff.find(s => s.id === l.staff_id)
    return a + ((l.hours_worked || 0) * (member?.hourly_rate || 0)) + ((l.overtime_hours || 0) * (member?.hourly_rate || 0) * 1.5)
  }, 0)
  const estIngredientCost = totalRevenue * 0.35
  const netProfit = totalRevenue - estIngredientCost - totalLabor
  const margin = totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(0) : 0

  const closeDay = async () => {
    setClosingDay(true)
    await supabase.from('daily_summary').upsert({
      user_id: user.id,
      summary_date: today,
      total_revenue: totalRevenue,
      total_ingredient_cost: estIngredientCost,
      total_labor_cost: totalLabor,
      total_waste_value: totalWasted * 2500,
      net_profit: netProfit,
      gross_margin: parseFloat(margin),
      units_sold: totalUnits,
      units_wasted: totalWasted
    }, { onConflict: 'user_id,summary_date' })
    setDayClosed(true)
    setClosingDay(false)
  }

  if (loading) return <div style={s.loading}>Loading your bakery...</div>

  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const name = profile?.owner_name || profile?.bakery_name || 'Chef'

  return (
    <div>
      <div style={s.header}>
        <div>
          <div style={s.greeting}>{greeting}, {name} 🧁</div>
          <div style={s.date}>{new Date().toLocaleDateString('en-UG', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div>
        </div>
        <div style={s.liveBadge}>🟢 LIVE</div>
      </div>

      {lowStock.length > 0 && (
        <div style={s.alert}>
          ⚠️ <strong>{lowStock.length} ingredient{lowStock.length > 1 ? 's' : ''} low on stock:</strong> {lowStock.map(i => i.name).join(', ')}
          <span style={s.alertLink} onClick={() => onNavigate('suppliers')}> → Order now</span>
        </div>
      )}

      {/* Tabs */}
      <div style={s.tabs}>
        {[['morning', '🌅 Morning brief'], ['sell', '🛒 Sell'], ['close', '📊 Close day']].map(([id, label]) => (
          <button key={id} style={{ ...s.tab, ...(tab === id ? s.tabActive : {}) }} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>

      {/* KPI strip */}
      <div style={s.kpiStrip}>
        <KPI label="Revenue today" value={`UGX ${fmt(totalRevenue)}`} color="#F0C040" />
        <KPI label="Units sold" value={totalUnits} color="#7DBFAD" />
        <KPI label="Net profit" value={`UGX ${fmt(netProfit)}`} color={netProfit > 0 ? '#90D0A0' : '#F08070'} />
        <KPI label="Margin" value={`${margin}%`} color={parseFloat(margin) >= (profile?.target_margin || 40) ? '#90D0A0' : '#F08070'} />
      </div>

      {/* MORNING TAB */}
      {tab === 'morning' && (
        <div style={s.grid2}>
          <div style={s.card}>
            <div style={s.cardTitle}>TODAY'S PRODUCTION PLAN</div>
            {plans.length === 0 ? (
              <div style={s.empty}>
                No production plan for today.
                <button style={s.emptyBtn} onClick={() => onNavigate('production')}>+ Create Plan</button>
              </div>
            ) : plans.map(p => (
              <div key={p.id} style={s.planRow}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#FDF6EC' }}>{p.recipes?.name}</div>
                  <div style={{ fontSize: 11, color: 'rgba(253,246,236,0.5)', marginTop: 2 }}>
                    {p.planned_units} units · UGX {fmt((p.recipes?.sell_price || 0) * p.planned_units)} est.
                  </div>
                </div>
                <div style={{ ...s.statusPill, ...getStatusStyle(p.status) }}>{p.status}</div>
              </div>
            ))}
            {plans.length > 0 && (
              <div style={{ marginTop: 14, fontSize: 12, color: 'rgba(253,246,236,0.5)' }}>
                Est. revenue if all sells: UGX {fmt(plans.reduce((a, p) => a + ((p.recipes?.sell_price || 0) * (p.planned_units || 0)), 0))}
              </div>
            )}
          </div>

          <div style={s.card}>
            <div style={s.cardTitle}>STAFF ON SHIFT TODAY</div>
            {staff.length === 0 ? (
              <div style={s.empty}>No staff added yet.
                <button style={s.emptyBtn} onClick={() => onNavigate('staff')}>+ Add Staff</button>
              </div>
            ) : staff.map(m => {
              const log = laborLogs.find(l => l.staff_id === m.id)
              return (
                <div key={m.id} style={s.staffRow}>
                  <div style={s.avatar}>{m.name[0]}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#FDF6EC' }}>{m.name}</div>
                    <div style={{ fontSize: 11, color: 'rgba(253,246,236,0.5)' }}>{m.role} · UGX {fmt(m.hourly_rate)}/hr</div>
                  </div>
                  {log ? (
                    <div style={s.hoursTag}>{log.hours_worked}h logged</div>
                  ) : (
                    <div style={{ ...s.hoursTag, background: 'rgba(255,255,255,0.05)', color: 'rgba(253,246,236,0.3)' }}>not logged</div>
                  )}
                </div>
              )
            })}
            <button style={s.logLaborBtn} onClick={() => onNavigate('staff')}>+ Log Today's Hours</button>
          </div>
        </div>
      )}

      {/* SELL TAB */}
      {tab === 'sell' && (
        <div>
          <div style={s.card}>
            <div style={s.cardTitle}>QUICK SELL — TAP TO RECORD</div>
            <div style={s.hint}>Tap a product each time you make a sale. Running total updates live.</div>
            {recipes.length === 0 ? (
              <div style={s.empty}>No recipes set up yet.
                <button style={s.emptyBtn} onClick={() => onNavigate('recipes')}>+ Add Recipes</button>
              </div>
            ) : (
              <POSGrid recipes={recipes} sales={sales} userId={user.id} today={today} onSale={loadAll} />
            )}
          </div>
        </div>
      )}

      {/* CLOSE DAY TAB */}
      {tab === 'close' && (
        <div>
          {dayClosed ? (
            <div style={s.closedBox}>
              ✅ Day closed! Your summary has been saved and your WhatsApp report will be sent at 8:00 PM.
            </div>
          ) : (
            <div style={s.card}>
              <div style={s.cardTitle}>END OF DAY SUMMARY</div>
              <div style={s.summaryGrid}>
                <SummaryRow label="Total Revenue" value={`UGX ${fmt(totalRevenue)}`} color="#F0C040" big />
                <div style={s.divider} />
                <SummaryRow label="Est. Ingredient Cost (35%)" value={`UGX ${fmt(estIngredientCost)}`} color="#C8862A" />
                <SummaryRow label="Labor Cost" value={`UGX ${fmt(totalLabor)}`} color="#7DBFAD" />
                <SummaryRow label="Units Wasted" value={totalWasted} color="#F08070" />
                <div style={s.divider} />
                <SummaryRow label="Net Profit" value={`UGX ${fmt(netProfit)}`} color={netProfit > 0 ? '#90D0A0' : '#F08070'} big />
                <SummaryRow label="Net Margin" value={`${margin}%`} color={parseFloat(margin) >= 30 ? '#90D0A0' : '#F08070'} />
              </div>

              <div style={s.waBox}>
                📱 A WhatsApp summary will be sent automatically at 8:00 PM to {profile?.whatsapp_number || 'your registered number'}
              </div>

              <button style={s.closeBtn} onClick={closeDay} disabled={closingDay}>
                {closingDay ? 'Saving...' : '✅ Close Today & Save Summary'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function POSGrid({ recipes, sales, userId, today, onSale }) {
  const [saving, setSaving] = useState(null)

  const getSold = (recipeId) => sales.filter(s => s.recipe_id === recipeId).reduce((a, s) => a + s.units_sold, 0)
  const totalRevenue = sales.reduce((a, s) => a + (s.total_revenue || 0), 0)

  const recordSale = async (recipe, qty = 1) => {
    setSaving(recipe.id)
    const existing = sales.find(s => s.recipe_id === recipe.id)
    if (existing) {
      await supabase.from('sales_log').update({
        units_sold: existing.units_sold + qty,
        total_revenue: (existing.units_sold + qty) * recipe.sell_price
      }).eq('id', existing.id)
    } else {
      await supabase.from('sales_log').insert({
        user_id: userId, recipe_id: recipe.id, product_name: recipe.name,
        sale_date: today, units_sold: qty, unit_price: recipe.sell_price,
        total_revenue: qty * recipe.sell_price, channel: 'walk-in'
      })
    }
    setSaving(null)
    onSale()
  }

  const undoSale = async (recipe) => {
    const existing = sales.find(s => s.recipe_id === recipe.id)
    if (!existing || existing.units_sold <= 0) return
    if (existing.units_sold === 1) {
      await supabase.from('sales_log').delete().eq('id', existing.id)
    } else {
      await supabase.from('sales_log').update({
        units_sold: existing.units_sold - 1,
        total_revenue: (existing.units_sold - 1) * recipe.sell_price
      }).eq('id', existing.id)
    }
    onSale()
  }

  return (
    <>
      <div style={pos.grid}>
        {recipes.map(r => {
          const sold = getSold(r.id)
          return (
            <div key={r.id} style={{ ...pos.item, ...(sold > 0 ? pos.itemActive : {}) }}>
              <div style={pos.name}>{r.name}</div>
              <div style={pos.price}>UGX {fmt(r.sell_price)}</div>
              <div style={pos.count}>{sold}</div>
              <div style={pos.countLabel}>sold</div>
              <div style={pos.btns}>
                <button style={pos.undoBtn} onClick={() => undoSale(r)} disabled={sold === 0}>−</button>
                <button style={pos.addBtn} onClick={() => recordSale(r)} disabled={saving === r.id}>
                  {saving === r.id ? '...' : '+1'}
                </button>
              </div>
            </div>
          )
        })}
      </div>
      <div style={pos.total}>
        <span style={{ color: 'rgba(253,246,236,0.6)', fontSize: 13 }}>Running total today</span>
        <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 20, fontWeight: 700, color: '#F0C040' }}>UGX {fmt(totalRevenue)}</span>
      </div>
    </>
  )
}

const getStatusStyle = (status) => {
  if (status === 'done') return { background: 'rgba(90,158,111,0.2)', color: '#90D0A0', border: '1px solid rgba(90,158,111,0.3)' }
  if (status === 'baking') return { background: 'rgba(200,134,42,0.2)', color: '#C8862A', border: '1px solid rgba(200,134,42,0.3)' }
  return { background: 'rgba(255,255,255,0.07)', color: 'rgba(253,246,236,0.5)', border: '1px solid rgba(255,255,255,0.1)' }
}

const KPI = ({ label, value, color }) => (
  <div style={s.kpi}>
    <div style={s.kpiLabel}>{label}</div>
    <div style={{ ...s.kpiVal, color }}>{value}</div>
  </div>
)

const SummaryRow = ({ label, value, color, big }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', padding: big ? '10px 0' : '6px 0', fontSize: big ? 14 : 13 }}>
    <span style={{ color: 'rgba(253,246,236,0.7)' }}>{label}</span>
    <span style={{ fontFamily: "'DM Mono', monospace", color, fontWeight: big ? 700 : 500 }}>{value}</span>
  </div>
)

const fmt = (n) => Number(Math.round(n) || 0).toLocaleString()

const pos = {
  grid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 },
  item: { background: 'rgba(26,14,8,0.5)', border: '1px solid rgba(200,134,42,0.15)', borderRadius: 12, padding: '14px 12px', textAlign: 'center' },
  itemActive: { background: 'rgba(200,134,42,0.12)', border: '1px solid rgba(200,134,42,0.4)' },
  name: { fontSize: 13, fontWeight: 600, color: '#FDF6EC', marginBottom: 3 },
  price: { fontSize: 11, color: 'rgba(253,246,236,0.5)', marginBottom: 10 },
  count: { fontSize: 28, fontWeight: 700, color: '#F0C040', lineHeight: 1 },
  countLabel: { fontSize: 10, color: 'rgba(253,246,236,0.4)', marginBottom: 10 },
  btns: { display: 'flex', gap: 6, justifyContent: 'center' },
  undoBtn: { background: 'rgba(214,79,59,0.15)', color: '#F08070', border: '1px solid rgba(214,79,59,0.3)', borderRadius: 6, padding: '5px 12px', fontSize: 14, cursor: 'pointer' },
  addBtn: { background: '#C8862A', color: '#1A0E08', border: 'none', borderRadius: 6, padding: '5px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer', flex: 1 },
  total: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(26,14,8,0.6)', border: '1px solid rgba(200,134,42,0.3)', borderRadius: 10, padding: '14px 18px' }
}

const s = {
  loading: { color: 'rgba(253,246,236,0.4)', textAlign: 'center', padding: 60 },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  greeting: { fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 700, color: '#FDF6EC' },
  date: { fontSize: 12, color: '#C8862A', fontFamily: "'DM Mono', monospace", marginTop: 4 },
  liveBadge: { fontSize: 11, color: '#90D0A0', fontFamily: "'DM Mono', monospace" },
  alert: { background: 'rgba(224,140,58,0.12)', border: '1px solid rgba(224,140,58,0.3)', color: '#F0B070', borderRadius: 10, padding: '10px 16px', fontSize: 13, marginBottom: 16 },
  alertLink: { color: '#F0C040', cursor: 'pointer', textDecoration: 'underline' },
  tabs: { display: 'flex', gap: 4, background: 'rgba(26,14,8,0.5)', borderRadius: 10, padding: 4, marginBottom: 16, border: '1px solid rgba(200,134,42,0.2)' },
  tab: { flex: 1, padding: '9px 8px', border: 'none', borderRadius: 7, cursor: 'pointer', fontSize: 13, fontWeight: 600, background: 'transparent', color: 'rgba(253,246,236,0.4)', fontFamily: "'DM Sans', sans-serif" },
  tabActive: { background: '#C8862A', color: '#1A0E08' },
  kpiStrip: { display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 16 },
  kpi: { background: 'rgba(61,43,31,0.6)', border: '1px solid rgba(200,134,42,0.18)', borderRadius: 10, padding: '12px 14px' },
  kpiLabel: { fontSize: 9, color: '#C8862A', fontFamily: "'DM Mono', monospace", letterSpacing: 1.5, marginBottom: 5 },
  kpiVal: { fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 900 },
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 },
  card: { background: 'rgba(61,43,31,0.6)', border: '1px solid rgba(200,134,42,0.18)', borderRadius: 12, padding: 20, marginBottom: 16 },
  cardTitle: { fontSize: 10, color: '#C8862A', fontFamily: "'DM Mono', monospace", letterSpacing: 1.5, marginBottom: 14 },
  hint: { fontSize: 12, color: 'rgba(253,246,236,0.45)', marginBottom: 14 },
  planRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' },
  statusPill: { fontSize: 9, padding: '3px 10px', borderRadius: 20, fontFamily: "'DM Mono', monospace" },
  staffRow: { display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' },
  avatar: { width: 32, height: 32, borderRadius: '50%', background: 'rgba(200,134,42,0.25)', color: '#C8862A', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700 },
  hoursTag: { fontSize: 10, background: 'rgba(90,158,111,0.15)', color: '#90D0A0', padding: '3px 9px', borderRadius: 20, fontFamily: "'DM Mono', monospace" },
  logLaborBtn: { width: '100%', marginTop: 12, padding: '9px', background: 'rgba(200,134,42,0.15)', color: '#C8862A', border: '1px solid rgba(200,134,42,0.3)', borderRadius: 8, fontSize: 12, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" },
  summaryGrid: { background: 'rgba(26,14,8,0.4)', border: '1px solid rgba(200,134,42,0.2)', borderRadius: 10, padding: '14px 18px', marginBottom: 14 },
  divider: { height: 1, background: 'rgba(200,134,42,0.15)', margin: '6px 0' },
  waBox: { background: 'rgba(90,158,111,0.1)', border: '1px solid rgba(90,158,111,0.25)', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#90D0A0', marginBottom: 14 },
  closeBtn: { width: '100%', padding: '14px', background: '#5A9E6F', color: '#fff', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" },
  closedBox: { background: 'rgba(90,158,111,0.15)', border: '1px solid rgba(90,158,111,0.4)', color: '#90D0A0', borderRadius: 12, padding: '24px', textAlign: 'center', fontSize: 15 },
  empty: { color: 'rgba(253,246,236,0.3)', textAlign: 'center', padding: '20px 0', fontSize: 13 },
  emptyBtn: { display: 'block', margin: '10px auto 0', background: '#C8862A', color: '#1A0E08', border: 'none', borderRadius: 7, padding: '7px 16px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" },
}
